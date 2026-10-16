import {
  Comment,
  Fragment,
  Text,
  createBlock,
  createCommentVNode,
  isVNode,
  openBlock,
} from 'vue'
import { camelize, isArray } from '@vue/shared'
import { hasOwn } from '../objects'
import { debugWarn } from '../error'
import type {
  VNode,
  VNodeArrayChildren,
  VNodeChild,
  VNodeNormalizedChildren,
} from 'vue'

const SCOPE = 'utils/vue/vnode'

// Ambient enum types retain nominal members; the runtime object uses erasable syntax.
declare enum PatchFlags {
  TEXT = 1,
  CLASS = 2,
  STYLE = 4,
  PROPS = 8,
  FULL_PROPS = 16,
  HYDRATE_EVENTS = 32,
  STABLE_FRAGMENT = 64,
  KEYED_FRAGMENT = 128,
  UNKEYED_FRAGMENT = 256,
  NEED_PATCH = 512,
  DYNAMIC_SLOTS = 1024,
  HOISTED = -1,
  BAIL = -2,
}

const patchFlags = {
  TEXT: 1,
  1: 'TEXT',
  CLASS: 2,
  2: 'CLASS',
  STYLE: 4,
  4: 'STYLE',
  PROPS: 8,
  8: 'PROPS',
  FULL_PROPS: 16,
  16: 'FULL_PROPS',
  HYDRATE_EVENTS: 32,
  32: 'HYDRATE_EVENTS',
  STABLE_FRAGMENT: 64,
  64: 'STABLE_FRAGMENT',
  KEYED_FRAGMENT: 128,
  128: 'KEYED_FRAGMENT',
  UNKEYED_FRAGMENT: 256,
  256: 'UNKEYED_FRAGMENT',
  NEED_PATCH: 512,
  512: 'NEED_PATCH',
  DYNAMIC_SLOTS: 1024,
  1024: 'DYNAMIC_SLOTS',
  HOISTED: -1,
  [-1]: 'HOISTED',
  BAIL: -2,
  [-2]: 'BAIL',
} as typeof PatchFlags

type patchFlags = PatchFlags
declare namespace patchFlags {
  type TEXT = PatchFlags.TEXT
  type CLASS = PatchFlags.CLASS
  type STYLE = PatchFlags.STYLE
  type PROPS = PatchFlags.PROPS
  type FULL_PROPS = PatchFlags.FULL_PROPS
  type HYDRATE_EVENTS = PatchFlags.HYDRATE_EVENTS
  type STABLE_FRAGMENT = PatchFlags.STABLE_FRAGMENT
  type KEYED_FRAGMENT = PatchFlags.KEYED_FRAGMENT
  type UNKEYED_FRAGMENT = PatchFlags.UNKEYED_FRAGMENT
  type NEED_PATCH = PatchFlags.NEED_PATCH
  type DYNAMIC_SLOTS = PatchFlags.DYNAMIC_SLOTS
  type HOISTED = PatchFlags.HOISTED
  type BAIL = PatchFlags.BAIL
}

export { patchFlags as PatchFlags }

export type VNodeChildAtom = Exclude<VNodeChild, Array<any>>
export type RawSlots = Exclude<
  VNodeNormalizedChildren,
  Array<any> | null | string
>

export function isFragment(node: VNode): boolean
export function isFragment(node: unknown): node is VNode
export function isFragment(node: unknown): node is VNode {
  return isVNode(node) && node.type === Fragment
}

export function isText(node: VNode): boolean
export function isText(node: unknown): node is VNode
export function isText(node: unknown): node is VNode {
  return isVNode(node) && node.type === Text
}

export function isComment(node: VNode): boolean
export function isComment(node: unknown): node is VNode
export function isComment(node: unknown): node is VNode {
  return isVNode(node) && node.type === Comment
}

const TEMPLATE = 'template'
export function isTemplate(node: VNode): boolean
export function isTemplate(node: unknown): node is VNode
export function isTemplate(node: unknown): node is VNode {
  return isVNode(node) && node.type === TEMPLATE
}

/**
 * determine if the element is a valid element type rather than fragments and comment e.g. <template> v-if
 * @param node {VNode} node to be tested
 */
export function isValidElementNode(node: VNode): boolean
export function isValidElementNode(node: unknown): node is VNode
export function isValidElementNode(node: unknown): node is VNode {
  return isVNode(node) && !isFragment(node) && !isComment(node)
}

/**
 * get a valid child node (not fragment nor comment)
 * @param node {VNode} node to be searched
 * @param depth {number} depth to be searched
 */
function getChildren(
  node: VNodeNormalizedChildren | VNodeChild,
  depth: number
): VNodeNormalizedChildren | VNodeChild {
  if (isComment(node)) return
  if (isFragment(node) || isTemplate(node)) {
    return depth > 0 ? getFirstValidNode(node.children, depth - 1) : undefined
  }
  return node
}

export const getFirstValidNode = (
  nodes: VNodeNormalizedChildren,
  maxDepth = 3
) => {
  if (Array.isArray(nodes)) {
    return getChildren(nodes[0], maxDepth)
  } else {
    return getChildren(nodes, maxDepth)
  }
}

export function renderIf(
  condition: boolean,
  ...args: Parameters<typeof createBlock>
) {
  return condition ? renderBlock(...args) : createCommentVNode('v-if', true)
}

export function renderBlock(...args: Parameters<typeof createBlock>) {
  return openBlock(), createBlock(...args)
}

export const getNormalizedProps = (node: VNode) => {
  if (!isVNode(node)) {
    debugWarn(SCOPE, '[getNormalizedProps] must be a VNode')
    return {}
  }

  const raw = node.props || {}
  const type = (isVNode(node.type) ? node.type.props : undefined) || {}
  const props: Record<string, any> = {}

  Object.keys(type).forEach((key) => {
    if (hasOwn(type[key], 'default')) {
      props[key] = type[key].default
    }
  })

  Object.keys(raw).forEach((key) => {
    props[camelize(key)] = raw[key]
  })

  return props
}

export const ensureOnlyChild = (children: VNodeArrayChildren | undefined) => {
  if (!isArray(children) || children.length > 1) {
    throw new Error('expect to receive a single Vue element child')
  }
  return children[0]
}

export type FlattenVNodes = Array<VNodeChildAtom | RawSlots>

export const flattedChildren = (
  children: FlattenVNodes | VNode | VNodeNormalizedChildren
): FlattenVNodes => {
  const vNodes = isArray(children) ? children : [children]
  const result: FlattenVNodes = []

  vNodes.forEach((child) => {
    if (isArray(child)) {
      result.push(...flattedChildren(child))
    } else if (isVNode(child) && isArray(child.children)) {
      result.push(...flattedChildren(child.children))
    } else {
      result.push(child)
      if (isVNode(child) && child.component?.subTree) {
        result.push(...flattedChildren(child.component.subTree))
      }
    }
  })
  return result
}
