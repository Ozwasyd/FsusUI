import { computed, ref, unref, watch } from 'vue'

import type { TableV2Props } from '../table'
import type { KeyType } from '../types'
import type { UseRowReturn } from './use-row'

type UseDataProps = {
  expandedRowKeys: UseRowReturn['expandedRowKeys']
  lastRenderedRowIndex: UseRowReturn['lastRenderedRowIndex']
  resetAfterIndex: UseRowReturn['resetAfterIndex']
}

export const useData = (
  props: TableV2Props,
  { expandedRowKeys, lastRenderedRowIndex, resetAfterIndex }: UseDataProps
) => {
  const depthMap = ref<Record<KeyType, number>>({})

  const flattenedData = computed(() => {
    const depths: Record<KeyType, number> = {}
    const { data, rowKey } = props

    const _expandedRowKeys = unref(expandedRowKeys)

    if (!_expandedRowKeys || !_expandedRowKeys.length) return data

    const array: any[] = []
    const keysSet = new Set(_expandedRowKeys)
    const stack: any[] = []

    for (let index = data.length - 1; index >= 0; index--) {
      const item = data[index]
      depths[item[rowKey]] = 0
      stack.push(item)
    }

    while (stack.length > 0) {
      const item = stack.pop()!

      array.push(item)
      if (
        keysSet.has(item[rowKey]) &&
        Array.isArray(item.children) &&
        item.children.length > 0
      ) {
        const depth = depths[item[rowKey]] + 1
        for (let index = item.children.length - 1; index >= 0; index--) {
          const child = item.children[index]
          depths[child[rowKey]] = depth
          stack.push(child)
        }
      }
    }

    depthMap.value = depths
    return array
  })

  const data = computed(() => {
    const { data, expandColumnKey } = props
    return expandColumnKey ? unref(flattenedData) : data
  })

  watch(data, (val, prev) => {
    if (val !== prev) {
      lastRenderedRowIndex.value = -1
      resetAfterIndex(0, true)
    }
  })

  return {
    data,
    depthMap,
  }
}

export type UseDataReturn = ReturnType<typeof useData>
