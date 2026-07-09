import { isLeaf } from '@element-plus/utils'
import type { default as CascaderNode } from './node'

export const getMenuIndex = (el: HTMLElement) => {
  if (!el) return 0
  const pieces = el.id.split('-')
  return Number(pieces[pieces.length - 2])
}

export const checkNode = (el: HTMLElement) => {
  if (!el) return

  const input = el.querySelector('input')
  if (input) {
    input.click()
  } else if (isLeaf(el)) {
    el.click()
  }
}

export const sortByOriginalOrder = (
  oldNodes: CascaderNode[],
  newNodes: CascaderNode[],
) => {
  const remainingNodes = new Map(newNodes.map((node) => [node.uid, node]))
  const res = oldNodes.reduce((acc, item) => {
    const matchedNode = remainingNodes.get(item.uid)
    if (matchedNode) {
      acc.push(matchedNode)
      remainingNodes.delete(item.uid)
    }
    return acc
  }, [] as CascaderNode[])

  res.push(...remainingNodes.values())

  return res
}
