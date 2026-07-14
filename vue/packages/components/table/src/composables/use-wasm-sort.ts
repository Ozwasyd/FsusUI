import {
  createAsciiFilterIndex,
  ensureWasmReady,
  isWasmReady,
  sortAsciiIndicesSync,
  sortNumberIndicesSync,
  warmupWasm,
} from '@element-plus/wasm'
import { get } from 'lodash-es'

import {
  canUseDataPipelineWorker,
  createFsusDataPipelineClient,
} from '../../../_internal/data-pipeline-client'
import { fsusDataPipelineStrategy } from '../../../_internal/data-pipeline-strategy'

import type { TableColumnCtx } from '../table-column/defaults'

type AnyRow = Record<string, unknown>

const isAsciiOnly = (value: string) => {
  for (let index = 0; index < value.length; index++) {
    if (value.charCodeAt(index) > 0x7f) return false
  }
  return true
}

const now = () =>
  typeof performance !== 'undefined' ? performance.now() : Date.now()

const yieldToMain = () =>
  new Promise<void>((resolve) => {
    const scheduler = globalThis.scheduler as
      | { yield?: () => Promise<void> }
      | undefined
    if (scheduler?.yield) void scheduler.yield().then(resolve)
    else setTimeout(resolve, 0)
  })

export class FsusRowIndexView<T> implements Iterable<T> {
  constructor(
    private readonly rows: readonly T[],
    readonly indices: Uint32Array,
  ) {}

  get length() {
    return this.indices.length
  }

  at(index: number) {
    const sourceIndex = this.indices.at(index)
    return sourceIndex === undefined ? undefined : this.rows[sourceIndex]
  }

  materialize() {
    return Array.from(this.indices, (index) => this.rows[index]!)
  }

  *[Symbol.iterator]() {
    for (const index of this.indices) yield this.rows[index]!
  }
}

const classifyValues = <T extends AnyRow>(
  rows: readonly T[],
  sortProp: string,
) => {
  const numbers = new Float64Array(rows.length)
  const strings: string[] = []
  let kind: 'number' | 'ascii' | 'unsupported' | null = null
  for (let index = 0; index < rows.length; index++) {
    const value = get(rows[index], sortProp)
    if (typeof value === 'number' && Number.isFinite(value)) {
      if (kind === 'ascii') return { kind: 'unsupported' as const }
      kind = 'number'
      numbers[index] = value
      continue
    }
    if (typeof value === 'string' && isAsciiOnly(value)) {
      if (kind === 'number') return { kind: 'unsupported' as const }
      kind = 'ascii'
      strings.push(value)
      continue
    }
    return { kind: 'unsupported' as const }
  }
  return kind === 'number'
    ? { kind, numbers }
    : kind === 'ascii'
      ? { kind, strings }
      : { kind: 'unsupported' as const }
}

export function trySortIndicesWithWasmSync<T extends AnyRow>(
  rows: readonly T[],
  sortProp: string,
  ascending: boolean,
): Uint32Array | null {
  if (!sortProp || !isWasmReady()) return null
  const values = classifyValues(rows, sortProp)
  if (values.kind === 'number') {
    return sortNumberIndicesSync(values.numbers, ascending)
  }
  if (values.kind === 'ascii') {
    return sortAsciiIndicesSync(
      createAsciiFilterIndex(values.strings),
      ascending,
    )
  }
  return null
}

/** Compatibility boundary for the current Table store. #190 can consume the
 * index view directly and remove this final materialization. */
export function trySortWithWasmSync<T extends AnyRow>(
  rows: T[],
  sortProp: string,
  ascending: boolean,
): T[] | null {
  const indices = trySortIndicesWithWasmSync(rows, sortProp, ascending)
  return indices ? new FsusRowIndexView(rows, indices).materialize() : null
}

const stableJsIndices = async (
  values: readonly (number | string)[],
  ascending: boolean,
) => {
  let width = 1
  let source = Uint32Array.from(values, (_, index) => index)
  let target = new Uint32Array(source.length)
  let sliceStarted = now()
  const compare = (left: number, right: number) => {
    const compared =
      typeof values[left] === 'number'
        ? (values[left] as number) - (values[right] as number)
        : (values[left] as string) < (values[right] as string)
          ? -1
          : (values[left] as string) > (values[right] as string)
            ? 1
            : 0
    return compared === 0 ? left - right : ascending ? compared : -compared
  }
  while (width < source.length) {
    for (let start = 0; start < source.length; start += width * 2) {
      const middle = Math.min(start + width, source.length)
      const end = Math.min(start + width * 2, source.length)
      let left = start
      let right = middle
      let output = start
      while (left < middle || right < end) {
        if (
          right >= end ||
          (left < middle && compare(source[left]!, source[right]!) <= 0)
        ) {
          target[output++] = source[left++]!
        } else {
          target[output++] = source[right++]!
        }
      }
      if (now() - sliceStarted > 6) {
        await yieldToMain()
        sliceStarted = now()
      }
    }
    ;[source, target] = [target, source]
    width *= 2
  }
  return source
}

export const createWasmSortController = (componentId: string) => {
  const client = createFsusDataPipelineClient(`table-${componentId}`)
  const datasets = new Map<
    string,
    {
      classified: ReturnType<typeof classifyValues>
      rows: readonly AnyRow[]
    }
  >()
  return {
    dispose: () => {
      datasets.clear()
      client.dispose()
    },
    async sort<T extends AnyRow>(
      rows: readonly T[],
      sortProp: string,
      ascending: boolean,
      options: {
        changedStart?: number
        datasetVersion?: string | number
        path?: 'auto' | 'js' | 'worker-wasm'
      } = {},
    ): Promise<FsusRowIndexView<T> | null> {
      if (!sortProp) return null
      const datasetKey = `${sortProp}:${options.datasetVersion ?? '0'}`
      const cached = datasets.get(datasetKey)
      let classified = cached?.rows === rows ? cached.classified : null
      if (!classified || options.changedStart !== undefined) {
        classified = classifyValues(rows, sortProp)
        datasets.set(datasetKey, { classified, rows })
      }
      if (classified.kind === 'unsupported') return null
      const started = now()
      const workerPath =
        options.path === 'worker-wasm' ||
        (options.path !== 'js' &&
          fsusDataPipelineStrategy.choose(
            rows.length,
            canUseDataPipelineWorker(),
          ) === 'worker-wasm')
      if (workerPath) {
        const datasetId = `${componentId}:${sortProp}:${options.datasetVersion ?? '0'}`
        const result =
          classified.kind === 'number'
            ? await client.sortNumbers(
                datasetId,
                classified.numbers.slice(),
                ascending,
                options.changedStart,
              )
            : await client.sortAscii(datasetId, classified.strings, ascending)
        if (result?.ok && result.value.indices) {
          fsusDataPipelineStrategy.record({
            commitMs: 0,
            computeMs: now() - started,
            copyMs: 0,
            count: rows.length,
            initializeMs: 0,
            path: 'worker-wasm',
            totalMs: now() - started,
          })
          return new FsusRowIndexView(rows, result.value.indices)
        }
      }
      const values =
        classified.kind === 'number'
          ? Array.from(classified.numbers)
          : classified.strings
      const indices = await stableJsIndices(values, ascending)
      const totalMs = now() - started
      fsusDataPipelineStrategy.record({
        commitMs: 0,
        computeMs: totalMs,
        copyMs: 0,
        count: rows.length,
        initializeMs: 0,
        path: 'js',
        totalMs,
      })
      return new FsusRowIndexView(rows, indices)
    },
  }
}

export function warmupWasmSort(): void {
  warmupWasm()
}

export function ensureWasmSortReady() {
  return ensureWasmReady()
}

export function isWasmSortReady(): boolean {
  return isWasmReady()
}

export function shouldUseWasm<T>(
  rows: T[],
  column: TableColumnCtx<T> | null,
): boolean {
  return Boolean(
    column &&
    !column.sortMethod &&
    !column.sortBy &&
    fsusDataPipelineStrategy.choose(rows.length, canUseDataPipelineWorker()) ===
      'worker-wasm',
  )
}
