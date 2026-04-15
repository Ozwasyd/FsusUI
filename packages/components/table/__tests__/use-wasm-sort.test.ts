import { afterEach, describe, expect, it, vi } from 'vitest'

const { sortNumbersSync, sortStringsSync, warmupWasm } = vi.hoisted(() => ({
  sortNumbersSync: vi.fn((data: number[], ascending = true) => {
    const sorted = [...data].sort((a, b) => a - b)
    return ascending ? sorted : sorted.reverse()
  }),
  sortStringsSync: vi.fn((data: string[], ascending = true) => {
    const sorted = [...data].sort()
    return ascending ? sorted : sorted.reverse()
  }),
  warmupWasm: vi.fn(),
}))

vi.mock('@element-plus/wasm', () => ({
  sortNumbersSync,
  sortStringsSync,
  warmupWasm,
}))

import {
  trySortWithWasmSync,
  warmupWasmSort,
} from '../src/composables/use-wasm-sort'

describe('useWasmSort', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should preserve stable order for duplicated numeric values', () => {
    const rows = Array.from({ length: 5_000 }, (_, index) => ({
      id: index,
      runtime: index < 3 ? 10 : 20_000 - index,
    }))

    const sorted = trySortWithWasmSync(rows, 'runtime', true)

    expect(sorted).not.toBeNull()
    expect(sorted!.slice(0, 3).map((row) => row.id)).toEqual([0, 1, 2])
    expect(sortNumbersSync).toHaveBeenCalledTimes(1)
  })

  it('should fall back to JS semantics for non-ascii string datasets', () => {
    const rows = Array.from({ length: 5_000 }, (_, index) => ({
      id: index,
      label: index === 4_999 ? 'Éclair' : `item-${index}`,
    }))

    const sorted = trySortWithWasmSync(rows, 'label', true)

    expect(sorted).toBeNull()
    expect(sortStringsSync).not.toHaveBeenCalled()
  })

  it('should warm the wasm module on demand', () => {
    warmupWasmSort()
    expect(warmupWasm).toHaveBeenCalledTimes(1)
  })
})
