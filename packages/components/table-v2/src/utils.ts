import { h, isVNode } from 'vue'
import { addUnit, isArray, isFunction } from '@element-plus/utils'

import type { CSSProperties, Component, Slot, VNode } from 'vue'

const sumReducer = (sum: number, num: number) => sum + num

export const sum = (listLike: number | number[]) => {
  return isArray(listLike) ? listLike.reduce(sumReducer, 0) : listLike
}

export const tryCall = <T>(
  fLike: T,
  params: T extends (...args: infer K) => unknown ? K : any,
  defaultRet = {}
) => {
  return isFunction(fLike) ? fLike(params) : fLike ?? defaultRet
}

export const enforceUnit = (style: CSSProperties) => {
  ;(['width', 'maxWidth', 'minWidth', 'height'] as const).forEach((key) => {
    style[key] = addUnit(style[key])
  })

  return style
}

export const componentToSlot = <T>(
  ComponentLike: VNode | ((props: T) => Component<T>) | undefined
) =>
  isVNode(ComponentLike)
    ? (props: T) => h(ComponentLike as VNode, props as any)
    : (ComponentLike as Slot)
