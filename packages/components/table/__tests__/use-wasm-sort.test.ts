import { afterEach, describe, expect, it, vi } from 'vitest'
import { fsusOk } from '@element-plus/utils'

const {
  ensureWasmReady,
  isWasmReady,
  sortNumbersSync,
  sortStringsSync,
  warmupWasm,
} = vi.hoisted(() => ({
  ensureWasmReady: vi.fn(() => Promise.resolve({ ok: true, value: undefined })),
  isWasmReady: vi.fn(() => true),
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
  ensureWasmReady,
  isWasmReady,
  sortNumbersSync,
  sortStringsSync,
  warmupWasm,
}))

import {
  ensureWasmSortReady,
  isWasmSortReady,
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

  it('should keep non-ascii string datasets on the JS primary path', () => {
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

  it('should expose required wasm readiness helpers', async () => {
    await expect(ensureWasmSortReady()).resolves.toEqual(fsusOk(undefined))
    expect(ensureWasmReady).toHaveBeenCalledTimes(1)
    expect(isWasmSortReady()).toBe(true)
    expect(isWasmReady).toHaveBeenCalledTimes(1)
  })
})
