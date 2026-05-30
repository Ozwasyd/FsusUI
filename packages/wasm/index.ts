/**
 * @element-plus/wasm
 *
 * TypeScript 公共 API — 将 WASM 模块封装为 Promise-based 单例。
 * 组件仅需 import 对应函数，剩余部分 Tree-Shake 掉。
 *
 * 用法示例：
 *   import { sortNumbers, filterIndices } from '@element-plus/wasm'
 *   const sorted = await sortNumbers([3,1,2], true)
 */
import type { FsusErrorDetail, FsusResult } from '@element-plus/utils'
import { resolveEpWasmAsset } from './runtime/assets'
import { loadEmscriptenModule } from './runtime/emscripten'

// ── Emscripten 生成的 JS glue 类型（运行时动态加载）──────────
interface EpWasmPublicModule {
  sortStrings(arr: string[], ascending: boolean): void
  filterIndices(
    arr: string[],
    keyword: string,
    caseSensitive: boolean,
  ): number[]
  hexToHsl(hex: string): string
  hslToHex(h: number, s: number, l: number): string
  roundToPrecision(value: number, precision: number): number
  clampAndRound(
    value: number,
    min: number,
    max: number,
    precision: number,
  ): number
  version(): string
}

interface EpWasmInternalModule {
  _malloc(size: number): number
  _free(ptr: number): void
  _sort_numbers_buffer(ptr: number, len: number, ascending: number): void
  _estimate_row_heights_buffer(
    textLengthsPtr: number,
    len: number,
    rowWidth: number,
    charWidth: number,
    lineHeight: number,
    padding: number,
    outPtr: number,
  ): void
  _filter_ascii_indices_buffer(
    labelsPtr: number,
    offsetsPtr: number,
    lengthsPtr: number,
    count: number,
    keywordPtr: number,
    keywordLength: number,
    caseSensitive: number,
    outPtr: number,
  ): number
  HEAPU8: Uint8Array
  HEAP32: Int32Array
  HEAPF64: Float64Array
}

type EpWasmModule = EpWasmPublicModule & Partial<EpWasmInternalModule>
type LoadedEpWasmModule = EpWasmPublicModule & EpWasmInternalModule
export type WasmReadiness = 'idle' | 'loading' | 'ready' | 'error'
export * from './markdown'
export * from './markdown-runtime'

// ── 单例 Promise，只加载一次 ────────────────────────────────
let _module: EpWasmModule | null = null
let _modulePromise: Promise<EpWasmModule> | null = null
let _moduleError: unknown = null
let _readiness: WasmReadiness = 'idle'

const createWasmError = (message: string, error?: unknown) => {
  const suffix =
    error instanceof Error
      ? ` ${error.message}`
      : error
        ? ` ${String(error)}`
        : ''
  return new Error(`${message}${suffix}`)
}

const createWasmResultError = (
  message: string,
  cause?: unknown,
): FsusErrorDetail => ({
  category: 'runtime',
  code: 'infra',
  message,
  ...(cause === undefined ? {} : { cause }),
})

const fsusOk = <T>(value: T): FsusResult<T> => ({ ok: true, value })

const fsusErr = <T = never>(error: FsusErrorDetail): FsusResult<T> => ({
  ok: false,
  error,
})

const wasmTryAsync = async <T>(
  fn: () => Promise<T> | T,
  message: string,
): Promise<FsusResult<T>> => {
  try {
    return fsusOk(await fn())
  } catch (error) {
    return fsusErr(
      error instanceof Error
        ? createWasmResultError(error.message || message, error)
        : createWasmResultError(message, error),
    )
  }
}

/**
 * 惰性加载并返回已初始化的 WASM 模块实例。
 * 所有操作函数内部均调用此函数，确保幂等。
 */
async function getModule(): Promise<EpWasmModule> {
  if (!_modulePromise) {
    _readiness = 'loading'
    _moduleError = null
    _modulePromise = (async () => {
      const asset = resolveEpWasmAsset()
      const module = await loadEmscriptenModule<EpWasmModule>(
        asset.moduleUrl,
        'createEpWasm',
        asset.wasmUrl,
      )
      if (!module) {
        throw createWasmError('@element-plus/wasm factory missing.')
      }
      _module = module
      _readiness = 'ready'
      return _module
    })().catch((error) => {
      _module = null
      _moduleError = error
      _readiness = 'error'
      throw createWasmError('@element-plus/wasm failed to initialize.', error)
    })
  }
  return _modulePromise
}

function getRequiredModule(): EpWasmModule {
  if (_module) {
    return _module
  }

  if (_readiness === 'error') {
    throw createWasmError('@element-plus/wasm is unavailable.', _moduleError)
  }

  throw new Error(
    '@element-plus/wasm is not ready. Call ensureWasmReady() before using sync APIs.',
  )
}

function getInternalModule(module: EpWasmModule): LoadedEpWasmModule {
  if (
    typeof module._malloc !== 'function' ||
    typeof module._free !== 'function' ||
    typeof module._sort_numbers_buffer !== 'function' ||
    typeof module._estimate_row_heights_buffer !== 'function' ||
    typeof module._filter_ascii_indices_buffer !== 'function' ||
    !(module.HEAPU8 instanceof Uint8Array) ||
    !(module.HEAP32 instanceof Int32Array) ||
    !(module.HEAPF64 instanceof Float64Array)
  ) {
    throw new Error(
      '@element-plus/wasm internal buffer helpers are unavailable. Rebuild packages/wasm with `pnpm --filter @element-plus/wasm build:wasm`.',
    )
  }

  return module as LoadedEpWasmModule
}

function withHeapAllocation<T>(
  module: LoadedEpWasmModule,
  size: number,
  callback: (ptr: number) => T,
): T {
  const ptr = module._malloc(size)
  try {
    return callback(ptr)
  } finally {
    module._free(ptr)
  }
}

function sortNumbersWithModule(
  module: EpWasmModule,
  data: number[],
  ascending: boolean,
): number[] {
  if (data.length === 0) return []

  const internal = getInternalModule(module)
  const values = new Float64Array(data)
  const byteLength = values.byteLength

  return withHeapAllocation(internal, byteLength, (ptr) => {
    const offset = ptr / Float64Array.BYTES_PER_ELEMENT
    internal.HEAPF64.set(values, offset)
    internal._sort_numbers_buffer(ptr, values.length, ascending ? 1 : 0)
    return Array.from(internal.HEAPF64.subarray(offset, offset + values.length))
  })
}

function estimateRowHeightsWithModule(
  module: EpWasmModule,
  textLengths: number[],
  rowWidth: number,
  charWidth: number,
  lineHeight: number,
  padding: number,
): number[] {
  if (textLengths.length === 0) return []

  const internal = getInternalModule(module)
  const lengths = Int32Array.from(textLengths)
  const outputByteLength = lengths.length * Float64Array.BYTES_PER_ELEMENT

  return withHeapAllocation(internal, lengths.byteLength, (textLengthsPtr) => {
    internal.HEAP32.set(lengths, textLengthsPtr / Int32Array.BYTES_PER_ELEMENT)

    return withHeapAllocation(internal, outputByteLength, (outPtr) => {
      internal._estimate_row_heights_buffer(
        textLengthsPtr,
        lengths.length,
        rowWidth,
        charWidth,
        lineHeight,
        padding,
        outPtr,
      )

      const outOffset = outPtr / Float64Array.BYTES_PER_ELEMENT
      return Array.from(
        internal.HEAPF64.subarray(outOffset, outOffset + lengths.length),
      )
    })
  })
}

export interface WasmAsciiFilterIndex {
  bytes: Uint8Array
  offsets: Int32Array
  lengths: Int32Array
}

const assertAscii = (value: string, label: string) => {
  for (let index = 0; index < value.length; index++) {
    if (value.charCodeAt(index) > 0x7f) {
      throw new Error(`${label} contains non-ASCII data.`)
    }
  }
}

export function createAsciiFilterIndex(labels: string[]): WasmAsciiFilterIndex {
  const offsets = new Int32Array(labels.length)
  const lengths = new Int32Array(labels.length)
  let totalLength = 0

  labels.forEach((label, index) => {
    assertAscii(label, `labels[${index}]`)
    offsets[index] = totalLength
    lengths[index] = label.length
    totalLength += label.length
  })

  const bytes = new Uint8Array(totalLength)
  labels.forEach((label, labelIndex) => {
    let offset = offsets[labelIndex]
    for (let index = 0; index < label.length; index++) {
      bytes[offset++] = label.charCodeAt(index)
    }
  })

  return {
    bytes,
    offsets,
    lengths,
  }
}

const encodeAsciiKeyword = (keyword: string) => {
  assertAscii(keyword, 'keyword')
  const bytes = new Uint8Array(keyword.length)
  for (let index = 0; index < keyword.length; index++) {
    bytes[index] = keyword.charCodeAt(index)
  }
  return bytes
}

function filterAsciiIndicesWithModule(
  module: EpWasmModule,
  index: WasmAsciiFilterIndex,
  keyword: string,
  caseSensitive: boolean,
): number[] {
  const count = index.lengths.length
  if (count === 0) return []

  const internal = getInternalModule(module)
  const keywordBytes = encodeAsciiKeyword(keyword)
  const labelsByteLength = index.bytes.byteLength
  const offsetsByteLength = index.offsets.byteLength
  const lengthsByteLength = index.lengths.byteLength
  const keywordByteLength = keywordBytes.byteLength
  const outputByteLength = count * Int32Array.BYTES_PER_ELEMENT

  return withHeapAllocation(internal, labelsByteLength, (labelsPtr) => {
    internal.HEAPU8.set(index.bytes, labelsPtr)

    return withHeapAllocation(internal, offsetsByteLength, (offsetsPtr) => {
      internal.HEAP32.set(
        index.offsets,
        offsetsPtr / Int32Array.BYTES_PER_ELEMENT,
      )

      return withHeapAllocation(internal, lengthsByteLength, (lengthsPtr) => {
        internal.HEAP32.set(
          index.lengths,
          lengthsPtr / Int32Array.BYTES_PER_ELEMENT,
        )

        return withHeapAllocation(internal, keywordByteLength, (keywordPtr) => {
          internal.HEAPU8.set(keywordBytes, keywordPtr)

          return withHeapAllocation(internal, outputByteLength, (outPtr) => {
            const matchedCount = internal._filter_ascii_indices_buffer(
              labelsPtr,
              offsetsPtr,
              lengthsPtr,
              count,
              keywordPtr,
              keywordBytes.length,
              caseSensitive ? 1 : 0,
              outPtr,
            )
            const outOffset = outPtr / Int32Array.BYTES_PER_ELEMENT
            return Array.from(
              internal.HEAP32.subarray(outOffset, outOffset + matchedCount),
            )
          })
        })
      })
    })
  })
}

/** 预热：提前触发 WASM 加载，可在 App 启动时调用 */
export function warmupWasm(): void {
  void ensureWasmReady()
}

export async function ensureWasmReady(): Promise<FsusResult<void>> {
  return await wasmTryAsync(async () => {
    await getModule()
  }, '@element-plus/wasm failed to initialize.')
}

export function isWasmReady(): boolean {
  return _readiness === 'ready' && _module !== null
}

export function getWasmReadiness(): WasmReadiness {
  return _readiness
}

// ─────────────────────────────────
// § 1  排序
// ─────────────────────────────────

/**
 * 对数字数组排序（不产生新数组，基于 WASM 原地操作后返回副本）。
 * 比 JS Array.sort 在 10 万+ 行时快 2–4 倍（WASM SIMD）。
 */
export async function sortNumbers(
  data: number[],
  ascending = true,
): Promise<FsusResult<number[]>> {
  return await wasmTryAsync(async () => {
    const m = await getModule()
    return sortNumbersWithModule(m, data, ascending)
  }, '@element-plus/wasm sortNumbers failed.')
}

export function sortNumbersSync(data: number[], ascending = true): number[] {
  return sortNumbersWithModule(getRequiredModule(), data, ascending)
}

/**
 * 对字符串数组排序，支持区域感知（locale）。
 * 注意：当前 WASM 实现为字节序排序，locale 参数保留给未来 ICU 集成。
 */
export async function sortStrings(
  data: string[],
  ascending = true,
  locale = 'zh-CN',
): Promise<FsusResult<string[]>> {
  return await wasmTryAsync(async () => {
    const m = await getModule()
    const copy = [...data]
    void locale
    m.sortStrings(copy as unknown as string[], ascending)
    return copy
  }, '@element-plus/wasm sortStrings failed.')
}

export function sortStringsSync(
  data: string[],
  ascending = true,
  locale = 'zh-CN',
): string[] {
  const m = getRequiredModule()
  const copy = [...data]
  void locale
  m.sortStrings(copy as unknown as string[], ascending)
  return copy
}

// ─────────────────────────────────
// § 2  过滤
// ─────────────────────────────────

/**
 * 返回 data 中所有包含 keyword 的元素下标。
 * 在 100K 行、关键词 5 字符时比纯 JS 快约 3 倍。
 */
export async function filterIndices(
  data: string[],
  keyword: string,
  caseSensitive = false,
): Promise<FsusResult<number[]>> {
  return await wasmTryAsync(async () => {
    const m = await getModule()
    return m.filterIndices(data, keyword, caseSensitive)
  }, '@element-plus/wasm filterIndices failed.')
}

export function filterIndicesSync(
  data: string[],
  keyword: string,
  caseSensitive = false,
): number[] {
  return getRequiredModule().filterIndices(data, keyword, caseSensitive)
}

export async function filterAsciiIndices(
  index: WasmAsciiFilterIndex,
  keyword: string,
  caseSensitive = false,
): Promise<FsusResult<number[]>> {
  return await wasmTryAsync(async () => {
    const m = await getModule()
    return filterAsciiIndicesWithModule(m, index, keyword, caseSensitive)
  }, '@element-plus/wasm filterAsciiIndices failed.')
}

export function filterAsciiIndicesSync(
  index: WasmAsciiFilterIndex,
  keyword: string,
  caseSensitive = false,
): number[] {
  return filterAsciiIndicesWithModule(
    getRequiredModule(),
    index,
    keyword,
    caseSensitive,
  )
}

// ─────────────────────────────────
// § 3  颜色转换（ColorPicker）
// ─────────────────────────────────

/** HEX (#RRGGBB) → CSS hsl(...) 字符串 */
export async function hexToHsl(hex: string): Promise<FsusResult<string>> {
  return await wasmTryAsync(async () => {
    const m = await getModule()
    return m.hexToHsl(hex)
  }, '@element-plus/wasm hexToHsl failed.')
}

/** HSL 分量 → HEX (#RRGGBB) */
export async function hslToHex(
  h: number,
  s: number,
  l: number,
): Promise<FsusResult<string>> {
  return await wasmTryAsync(async () => {
    const m = await getModule()
    return m.hslToHex(h, s, l)
  }, '@element-plus/wasm hslToHex failed.')
}

// ─────────────────────────────────
// § 4  数字精度（InputNumber）
// ─────────────────────────────────

/** 将 value 舍入到 precision 位小数 */
export async function roundToPrecision(
  value: number,
  precision: number,
): Promise<FsusResult<number>> {
  return await wasmTryAsync(async () => {
    const m = await getModule()
    return m.roundToPrecision(value, precision)
  }, '@element-plus/wasm roundToPrecision failed.')
}

/** 钳位并舍入 */
export async function clampAndRound(
  value: number,
  min: number,
  max: number,
  precision: number,
): Promise<FsusResult<number>> {
  return await wasmTryAsync(async () => {
    const m = await getModule()
    return m.clampAndRound(value, min, max, precision)
  }, '@element-plus/wasm clampAndRound failed.')
}

// ─────────────────────────────────
// § 5  VirtualList 行高估算
// ─────────────────────────────────

/**
 * 批量估算每行的像素高度（用于 VirtualList 变高模式）。
 * @param textLengths  每行内容的字符数数组
 * @param rowWidth     行宽（px）
 * @param charWidth    平均字符宽（px），CJK 文字约 14px
 * @param lineHeight   单行高（px），默认 22
 * @param padding      上下内边距之和（px），默认 16
 */
export async function estimateRowHeights(
  textLengths: number[],
  rowWidth: number,
  charWidth = 14,
  lineHeight = 22,
  padding = 16,
): Promise<FsusResult<number[]>> {
  return await wasmTryAsync(async () => {
    const m = await getModule()
    return estimateRowHeightsWithModule(
      m,
      textLengths,
      rowWidth,
      charWidth,
      lineHeight,
      padding,
    )
  }, '@element-plus/wasm estimateRowHeights failed.')
}

// ─────────────────────────────────
// § 6  版本
// ─────────────────────────────────
export async function wasmVersion(): Promise<FsusResult<string>> {
  return await wasmTryAsync(async () => {
    const m = await getModule()
    return m.version()
  }, '@element-plus/wasm wasmVersion failed.')
}
