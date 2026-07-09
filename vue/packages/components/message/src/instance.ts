import { shallowReactive } from 'vue'
import type { ComponentInternalInstance, VNode } from 'vue'
import type { AppContext } from 'vue'
import type { Mutable } from '@element-plus/utils'
import type { MessageHandler, MessageProps } from './message'

export type MessageContext = {
  id: string
  vnode: VNode
  handler: MessageHandler
  vm: ComponentInternalInstance
  props: Mutable<MessageProps>
}

export const instances: MessageContext[] = shallowReactive([])

const scopeInstances = new WeakMap<AppContext, MessageContext[]>()
const scopeById = new Map<string, MessageContext[]>()

export const getMessageScope = (context?: AppContext | null) => {
  if (!context) return instances

  let scopedInstances = scopeInstances.get(context)
  if (!scopedInstances) {
    scopedInstances = shallowReactive([])
    scopeInstances.set(context, scopedInstances)
  }
  return scopedInstances
}

export const bindMessageToScope = (
  id: string,
  scopedInstances: MessageContext[],
) => {
  scopeById.set(id, scopedInstances)
}

export const unbindMessageFromScope = (id: string) => {
  scopeById.delete(id)
}

const getScopeById = (id: string) => scopeById.get(id) ?? instances

export const getInstance = (id: string) => {
  const scopedInstances = getScopeById(id)
  const idx = scopedInstances.findIndex((instance) => instance.id === id)
  const current = scopedInstances[idx]
  let prev: MessageContext | undefined
  if (idx > 0) {
    prev = scopedInstances[idx - 1]
  }
  return { current, prev }
}

export const getLastOffset = (id: string): number => {
  const { prev } = getInstance(id)
  if (!prev) return 0
  return prev.vm.exposed!.bottom.value
}

export const getOffsetOrSpace = (id: string, offset: number) => {
  const scopedInstances = getScopeById(id)
  const idx = scopedInstances.findIndex((instance) => instance.id === id)
  return idx > 0 ? 20 : offset
}
