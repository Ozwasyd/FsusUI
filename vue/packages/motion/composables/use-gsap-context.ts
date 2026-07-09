import { getCurrentScope, onScopeDispose, unref } from 'vue'
import { getGsap } from '../gsap/register'
import type { Ref } from 'vue'

export type GsapScope =
  | Element
  | Ref<Element | undefined | null>
  | undefined
  | null

type GsapInstance = ReturnType<typeof getGsap>

export type GsapContextCallback = Parameters<GsapInstance['context']>[0]

export const useGsapContext = (scope?: GsapScope) => {
  const contexts = new Set<gsap.Context>()
  const gsap = getGsap()

  const resolveScope = () => unref(scope) || undefined

  const create = (callback?: GsapContextCallback) => {
    const context = gsap.context(callback || (() => undefined), resolveScope())
    contexts.add(context)
    return context
  }

  const revert = () => {
    for (const context of contexts) {
      context.revert()
    }
    contexts.clear()
  }

  if (getCurrentScope()) {
    onScopeDispose(revert)
  }

  return {
    create,
    revert,
    contexts,
  }
}
