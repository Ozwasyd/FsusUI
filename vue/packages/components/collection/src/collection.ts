import {
  defineComponent,
  inject,
  onBeforeUnmount,
  onMounted,
  provide,
  ref,
  unref,
} from 'vue'

import type { InjectionKey } from 'vue'
import type {
  CollectionItem as CollectionItemType,
  ElCollectionInjectionContext,
  ElCollectionItemInjectionContext,
} from './tokens'

export const COLLECTION_ITEM_SIGN = `data-el-collection-item`

// Make sure the first letter of name is capitalized
export const createCollectionWithScope = (name: string) => {
  const COLLECTION_NAME = `El${name}Collection`
  const COLLECTION_ITEM_NAME = `${COLLECTION_NAME}Item`
  const COLLECTION_INJECTION_KEY: InjectionKey<ElCollectionInjectionContext> =
    Symbol(COLLECTION_NAME)
  const COLLECTION_ITEM_INJECTION_KEY: InjectionKey<ElCollectionItemInjectionContext> =
    Symbol(COLLECTION_ITEM_NAME)

  const ElCollection = defineComponent({
    name: COLLECTION_NAME,
    inheritAttrs: false,
    setup(_, { slots }) {
      const collectionRef = ref<HTMLElement | null>(null)
      const itemMap: ElCollectionInjectionContext['itemMap'] = new Map()
      const getItems = <T = Record<string, any>>(): CollectionItemType<T>[] => {
        const collectionEl = unref(collectionRef)

        if (!collectionEl) return []
        const orderedNodes = Array.from(
          collectionEl.querySelectorAll(`[${COLLECTION_ITEM_SIGN}]`)
        )

        const items = [...itemMap.values()]

        return items.sort(
          (a, b) => orderedNodes.indexOf(a.ref!) - orderedNodes.indexOf(b.ref!)
        ) as unknown as CollectionItemType<T>[]
      }

      provide(COLLECTION_INJECTION_KEY, {
        itemMap,
        getItems,
        collectionRef,
      })
      return () => slots.default?.()
    },
  })

  const ElCollectionItem = defineComponent({
    name: COLLECTION_ITEM_NAME,
    inheritAttrs: false,
    setup(_, { attrs, slots }) {
      const collectionItemRef = ref<HTMLElement | null>(null)
      const collectionInjection = inject(COLLECTION_INJECTION_KEY, undefined)!

      provide(COLLECTION_ITEM_INJECTION_KEY, {
        collectionItemRef,
      })

      onMounted(() => {
        const collectionItemEl = unref(collectionItemRef)
        if (collectionItemEl) {
          collectionInjection.itemMap.set(collectionItemEl, {
            ref: collectionItemEl,
            ...attrs,
          })
        }
      })

      onBeforeUnmount(() => {
        const collectionItemEl = unref(collectionItemRef)!
        collectionInjection.itemMap.delete(collectionItemEl)
      })
      return () => slots.default?.()
    },
  })

  return {
    COLLECTION_INJECTION_KEY,
    COLLECTION_ITEM_INJECTION_KEY,
    ElCollection,
    ElCollectionItem,
  }
}
