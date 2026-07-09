/**
 * useWasmSort — WASM 加速的表格列排序
 *
 * 策略：
 *   - 行数 >= WASM_THRESHOLD（默认 5000）且列值全为数字或全为字符串时，
 *     走 WASM SIMD 排序（比 JS Array.sort 快 2-4x）。
 *   - 小数据、混合类型、非 ASCII 字符串与用户自定义排序保持 JS primary path。
 *
 * 与 Element Plus 公共合约无关，仅内部使用。
 */
import {
  ensureWasmReady,
  isWasmReady,
  sortNumbersSync,
  sortStringsSync,
  warmupWasm,
} from '@element-plus/wasm'
import { get } from 'lodash-es'
import type { TableColumnCtx } from '../table-column/defaults'

/** 启用 WASM 加速的最小行数阈值 */
const WASM_THRESHOLD = 5_000

const isAsciiOnly = (value: string) => {
  for (let index = 0; index < value.length; index++) {
    if (value.charCodeAt(index) > 0x7f) {
      return false
    }
  }

  return true
}

type AnyRow = Record<string, unknown>

function isAllNumbers(values: unknown[]): values is number[] {
  return values.every((v) => typeof v === 'number' && !isNaN(v as number))
}

function isAllStrings(values: unknown[]): values is string[] {
  return values.every((v) => typeof v === 'string')
}

function isAllAsciiStrings(values: unknown[]): values is string[] {
  return isAllStrings(values) && values.every((value) => isAsciiOnly(value))
}

function groupRowsByValue<T>(
  rows: T[],
  getBucketKey: (row: T) => string | number,
) {
  const bucketMap = new Map<string | number, T[]>()

  for (const row of rows) {
    const key = getBucketKey(row)
    const bucket = bucketMap.get(key)

    if (bucket) {
      bucket.push(row)
      continue
    }

    bucketMap.set(key, [row])
  }

  return bucketMap
}

/**
 * 尝试用 WASM 加速排序。
 * 返回排序后的数组，若不满足 WASM 条件则返回 null（调用方走 JS primary path）。
 */
export function trySortWithWasmSync<T extends AnyRow>(
  array: T[],
  sortProp: string,
  ascending: boolean,
): T[] | null {
  if (array.length < WASM_THRESHOLD) return null
  if (!sortProp) return null

  const values: unknown[] = array.map((row) => get(row, sortProp))

  if (isAllNumbers(values)) {
    const sortedVals = sortNumbersSync(values, ascending)

    // 重建原行顺序（稳定排序：相同值时保留原顺序）
    const indexMap = groupRowsByValue(
      array,
      (row) => get(row, sortProp) as number,
    )
    const usedMap = new Map<number, number>()
    return sortedVals.map((v) => {
      const bucket = indexMap.get(v)!
      const used = usedMap.get(v) ?? 0
      usedMap.set(v, used + 1)
      return bucket[used]!
    })
  }

  if (isAllAsciiStrings(values)) {
    // 与数字同理：WASM 排序字符串键，再映射回原行
    const sorted = sortStringsSync(values, ascending, 'zh-CN')

    const indexMap = groupRowsByValue(
      array,
      (row) => get(row, sortProp) as string,
    )
    const usedMap = new Map<string, number>()
    return sorted.map((v) => {
      const bucket = indexMap.get(v)!
      const used = usedMap.get(v) ?? 0
      usedMap.set(v, used + 1)
      return bucket[used]!
    })
  }

  return null // 混合类型或对象值：JS primary path
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

/**
 * 是否应该尝试 WASM 加速。
 * 供外部检测，避免 async 开销不值当的小数据集。
 */
export function shouldUseWasm<T>(
  array: T[],
  column: TableColumnCtx<T> | null,
): boolean {
  return (
    array.length >= WASM_THRESHOLD &&
    !!column &&
    !column.sortMethod && // 自定义 sortMethod 不走 WASM
    !column.sortBy // 自定义 sortBy 不走 WASM
  )
}
