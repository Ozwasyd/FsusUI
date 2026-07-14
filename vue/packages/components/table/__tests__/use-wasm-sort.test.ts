import { afterEach, describe, expect, it, vi } from 'vitest'
import { fsusOk } from '@element-plus/utils'

const {
  createAsciiFilterIndex,
  ensureWasmReady,
  isWasmReady,
  sortAsciiIndicesSync,
  sortNumberIndicesSync,
  warmupWasm,
} = vi.hoisted(() => ({
  createAsciiFilterIndex: vi.fn((labels: string[]) => ({ labels })),
  ensureWasmReady: vi.fn(() => Promise.resolve({ ok: true, value: undefined })),
  isWasmReady: vi.fn(() => true),
  sortNumberIndicesSync: vi.fn((data: Float64Array, ascending = true) =>
    Uint32Array.from(data, (_, index) => index).sort((left, right) => {
      const compared = data[left]! - data[right]!
      return ascending ? compared || left - right : -compared || left - right
    }),
  ),
  sortAsciiIndicesSync: vi.fn((index: { labels: string[] }, ascending = true) =>
    Uint32Array.from(index.labels, (_, itemIndex) => itemIndex).sort(
      (left, right) => {
        const compared = index.labels[left]!.localeCompare(index.labels[right]!)
        return ascending ? compared || left - right : -compared || left - right
      },
    ),
  ),
  warmupWasm: vi.fn(),
}))

vi.mock('@element-plus/wasm', () => ({
  createAsciiFilterIndex,
  ensureWasmReady,
  isWasmReady,
  sortAsciiIndicesSync,
  sortNumberIndicesSync,
  warmupWasm,
}))

import {
  ensureWasmSortReady,
  FsusRowIndexView,
  isWasmSortReady,
  shouldUseWasm,
  trySortIndicesWithWasmSync,
  trySortWithWasmSync,
  warmupWasmSort,
} from '../src/composables/use-wasm-sort'

describe('useWasmSort', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
  })

  it('should preserve stable order for duplicated numeric values', () => {
    const rows = Array.from({ length: 5_000 }, (_, index) => ({
      id: index,
      runtime: index < 3 ? 10 : 20_000 - index,
    }))

    const sorted = trySortWithWasmSync(rows, 'runtime', true)

    expect(sorted).not.toBeNull()
    expect(sorted!.slice(0, 3).map((row) => row.id)).toEqual([0, 1, 2])
    expect(sortNumberIndicesSync).toHaveBeenCalledTimes(1)
  })

  it('exposes the transferable index result without materializing row objects', () => {
    const rows = [
      { id: 'a', label: 'beta' },
      { id: 'b', label: 'alpha' },
      { id: 'c', label: 'beta' },
    ]
    const indices = trySortIndicesWithWasmSync(rows, 'label', true)
    expect(indices).toEqual(Uint32Array.from([1, 0, 2]))
    const view = new FsusRowIndexView(rows, indices!)
    expect(view.at(0)).toBe(rows[1])
    expect([...view]).toEqual([rows[1], rows[0], rows[2]])
  })

  it.each([5_000, 10_000, 100_000])(
    'keeps stable number index semantics at %i rows',
    (size) => {
      const rows = Array.from({ length: size }, (_, index) => ({
        id: index,
        score: index % 97,
      }))
      const indices = trySortIndicesWithWasmSync(rows, 'score', false)!
      expect(indices).toHaveLength(size)
      expect(rows[indices[0]!]!.score).toBe(96)
      const duplicate = Array.from(indices)
        .filter((index) => rows[index]!.score === 96)
        .slice(0, 4)
      expect(duplicate).toEqual(
        [...duplicate].sort((left, right) => left - right),
      )
    },
  )

  it('keeps CJK, mixed values and custom comparators on semantic JS paths', () => {
    const cjk = Array.from({ length: 5_000 }, (_, index) => ({
      label: index === 0 ? '中文' : `item-${index}`,
    }))
    const mixed = Array.from({ length: 5_000 }, (_, index) => ({
      value: index === 10 ? '10' : index,
    }))
    expect(trySortIndicesWithWasmSync(cjk, 'label', true)).toBeNull()
    expect(trySortIndicesWithWasmSync(mixed, 'value', true)).toBeNull()

    vi.stubGlobal('Worker', class {})
    const rows = Array.from({ length: 100_000 }, (_, index) => ({ id: index }))
    expect(
      shouldUseWasm(rows, { sortMethod: () => 0, sortBy: null } as any),
    ).toBe(false)
    expect(shouldUseWasm(rows, { sortMethod: null, sortBy: 'id' } as any)).toBe(
      false,
    )
  })

  it('should keep non-ascii string datasets on the JS primary path', () => {
    const rows = Array.from({ length: 5_000 }, (_, index) => ({
      id: index,
      label: index === 4_999 ? 'Éclair' : `item-${index}`,
    }))

    const sorted = trySortWithWasmSync(rows, 'label', true)

    expect(sorted).toBeNull()
    expect(sortAsciiIndicesSync).not.toHaveBeenCalled()
  })

  it('should warm the wasm module on demand', () => {
    warmupWasmSort()
    expect(warmupWasm).toHaveBeenCalledTimes(1)
  })

  it('should expose required wasm readiness helpers', async () => {
    await expect(ensureWasmSortReady()).resolves.toEqual(fsusOk(undefined))
    expect(ensureWasmReady).toHaveBeenCalledTimes(1)
    expect(isWasmSortReady()).toBe(true)
    expect(isWasmReady).toHaveBeenCalledTimes(1)
  })
})
