/**
 * useWasmRowHeight — WASM 加速的批量行高预估
 *
 * 供 dynamic-size-list 在初始化阶段使用：
 * 当 items 数量超过阈值，且每行携带文本内容时，
 * 通过 WASM 批量计算各行估计高度，替代固定 estimatedItemSize，
 * 减少首次滚动时的布局抖动。
 *
 * 与 Element Plus VirtualList 合约兼容：
 *   - 不改变任何 props 签名
 *   - 仅在 initCache 前预填充 size 缓存
 */
import { estimateRowHeights } from '@element-plus/wasm'

/** 启用 WASM 批量预估的最小行数 */
const WASM_VL_THRESHOLD = 2_000

export interface WasmHeightEstimateOptions {
  /** 列表容器宽度（px） */
  rowWidth: number
  /** 平均字符宽（px），CJK≈14，英文≈8 */
  charWidth?: number
  /** 单行行高（px） */
  lineHeight?: number
  /** 上下内边距之和（px） */
  padding?: number
}

/**
 * 批量预估行高。返回 Float64Array 对应每行高度（px）。
 * 若 items 数量不足阈值，返回 null（调用方用 estimatedItemSize 常量）。
 *
 * @param items      数据数组
 * @param textKey    每行中存放文本的 key，用于计算字符数
 * @param options    宽度/字体参数
 */
export async function batchEstimateRowHeights<T extends Record<string, unknown>>(
  items: T[],
  textKey: string,
  options: WasmHeightEstimateOptions
): Promise<number[] | null> {
  if (items.length < WASM_VL_THRESHOLD) return null

  const {
    rowWidth,
    charWidth = 14,
    lineHeight = 22,
    padding = 16,
  } = options

  const textLengths = items.map((item) => {
    const val = item[textKey]
    return typeof val === 'string' ? val.length : 6 // 默认 6 字符
  })

  return estimateRowHeights(textLengths, rowWidth, charWidth, lineHeight, padding)
}
