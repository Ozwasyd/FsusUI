// @ts-nocheck
import { computed, nextTick, ref, toRefs, watch } from 'vue'
import { isEqual, pick } from 'lodash-unified'
import { UPDATE_MODEL_EVENT } from '@element-plus/constants'
import { isFunction } from '@element-plus/utils'
import {
  createAsciiFilterIndex,
  ensureWasmReady,
  filterAsciiIndicesSync,
  isWasmReady,
} from '@element-plus/wasm'
import ElTree from '@element-plus/components/tree'
import TreeSelectOption from './tree-select-option'
import {
  isValidArray,
  isValidValue,
  toValidArray,
  treeEach,
  treeFind,
} from './utils'
import type { CacheOption } from './cache-options'
import type { Ref } from 'vue'
import type ElSelect from '@element-plus/components/select'
import type { TreeNodeData } from '@element-plus/components/tree'

type TreeNodeInstance = NonNullable<
  ReturnType<InstanceType<typeof ElTree>['getNode']>
>

const TREE_SELECT_WASM_FILTER_THRESHOLD = 500
const isAsciiOnly = (value: string) => {
  for (let index = 0; index < value.length; index++) {
    if (value.charCodeAt(index) > 0x7f) {
      return false
    }
  }

  return true
}

export const useTree = (
  props,
  { attrs, slots, emit },
  {
    select,
    tree,
    key,
  }: {
    select: Ref<InstanceType<typeof ElSelect> | undefined>
    tree: Ref<InstanceType<typeof ElTree> | undefined>
    key: Ref<string>
  }
) => {
  watch(
    () => props.modelValue,
    () => {
      if (props.showCheckbox) {
        nextTick(() => {
          const treeInstance = tree.value
          if (
            treeInstance &&
            !isEqual(
              treeInstance.getCheckedKeys(),
              toValidArray(props.modelValue)
            )
          ) {
            treeInstance.setCheckedKeys(toValidArray(props.modelValue))
          }
        })
      }
    },
    {
      immediate: true,
      deep: true,
    }
  )

  const propsMap = computed(() => ({
    value: key.value,
    label: 'label',
    children: 'children',
    disabled: 'disabled',
    isLeaf: 'isLeaf',
    ...props.props,
  }))
  const wasmFilterError = ref<unknown>(null)
  let wasmFilterReadyPromise: Promise<void> | null = null
  let pendingWasmFilterValue: string | null = null

  const requestWasmFilterReady = (value?: string) => {
    if (value) {
      pendingWasmFilterValue = value
    }

    if (wasmFilterReadyPromise) return
    wasmFilterReadyPromise = ensureWasmReady()
      .then((result) => {
        wasmFilterReadyPromise = null
        if (!result.ok) {
          wasmFilterError.value = result.error
          return
        }
        const nextFilterValue = pendingWasmFilterValue
        pendingWasmFilterValue = null
        if (nextFilterValue) {
          tree.value?.filter(nextFilterValue)
        }
      })
      .catch((error) => {
        wasmFilterReadyPromise = null
        wasmFilterError.value = error
      })
  }

  const getNodeValByProp = (
    prop: 'value' | 'label' | 'children' | 'disabled' | 'isLeaf',
    data: TreeNodeData
  ) => {
    const propVal = propsMap.value[prop]
    if (isFunction(propVal)) {
      return propVal(
        data,
        tree.value?.getNode(getNodeValByProp('value', data)) as TreeNodeInstance,
      )
    } else {
      return data[propVal as string]
    }
  }

  const canUseWasmFilter = computed(() => {
    if (props.filterNodeMethod || props.lazy) {
      return false
    }

    const { value, label, children } = propsMap.value
    return (
      (typeof value === 'string' || value === undefined) &&
      (typeof label === 'string' || label === undefined) &&
      (typeof children === 'string' || children === undefined)
    )
  })

  const wasmFilterIndex = computed(() => {
    if (!canUseWasmFilter.value) {
      return null
    }

    const labels: string[] = []
    const nodeKeys: Array<string | number> = []
    const parentKeyByNodeKey = new Map<string | number, string | number>()

    treeEach(
      props.data || [],
      (node, index, siblings, parent) => {
        const nodeKey = getNodeValByProp('value', node)
        if (nodeKey === undefined || nodeKey === null) {
          return
        }

        nodeKeys.push(nodeKey)
        parentKeyByNodeKey.set(
          nodeKey,
          parent ? getNodeValByProp('value', parent) : undefined
        )

        const label = getNodeValByProp('label', node)
        labels.push(typeof label === 'string' ? label : '')
      },
      (data) => getNodeValByProp('children', data)
    )

    if (labels.length < TREE_SELECT_WASM_FILTER_THRESHOLD) {
      return null
    }

    if (!labels.every((label) => isAsciiOnly(label))) {
      return null
    }

    return {
      filterIndex: createAsciiFilterIndex(labels),
      labels,
      nodeKeys,
      parentKeyByNodeKey,
    }
  })

  watch(
    wasmFilterIndex,
    (index) => {
      if (index) {
        requestWasmFilterReady()
      }
    },
    {
      immediate: true,
    }
  )

  const defaultExpandedParentKeys = toValidArray(props.modelValue)
    .map((value) => {
      return treeFind(
        props.data || [],
        (data) => getNodeValByProp('value', data) === value,
        (data) => getNodeValByProp('children', data),
        (data, index, array, parent) =>
          parent && getNodeValByProp('value', parent)
      )
    })
    .filter((item) => isValidValue(item))

  const cacheOptions = computed(() => {
    if (!props.renderAfterExpand && !props.lazy) return []

    const options: CacheOption[] = []

    treeEach(
      props.data.concat(props.cacheData),
      (node) => {
        const value = getNodeValByProp('value', node)
        options.push({
          value,
          currentLabel: getNodeValByProp('label', node),
          isDisabled: getNodeValByProp('disabled', node),
        })
      },
      (data) => getNodeValByProp('children', data)
    )

    return options
  })

  const cacheOptionsMap = computed(() => {
    return Object.fromEntries(
      cacheOptions.value.map((option) => [option.value, option])
    )
  })

  const filterNodeMethod = (value, data, node) => {
    if (props.filterNodeMethod)
      return props.filterNodeMethod(value, data, node)
    if (!value) return true
    return getNodeValByProp('label', data)?.includes(value)
  }

  filterNodeMethod.__epWasmFilter = (value: string) => {
    const index = wasmFilterIndex.value
    if (!index || !value) {
      return null
    }

    if (!isAsciiOnly(value)) {
      return null
    }

    if (wasmFilterError.value) {
      throw wasmFilterError.value
    }

    if (!isWasmReady()) {
      requestWasmFilterReady(value)
      return { pending: true }
    }

    const matchedIndices = filterAsciiIndicesSync(index.filterIndex, value, true)

    const visibleNodeKeys = new Set<string | number>()
    matchedIndices.forEach((matchedIndex) => {
      let nodeKey = index.nodeKeys[matchedIndex]
      while (nodeKey !== undefined && nodeKey !== null) {
        if (visibleNodeKeys.has(nodeKey)) {
          break
        }

        visibleNodeKeys.add(nodeKey)
        nodeKey = index.parentKeyByNodeKey.get(nodeKey)
      }
    })

    return { visibleNodeKeys }
  }

  return {
    ...pick(toRefs(props), Object.keys(ElTree.props)),
    ...attrs,
    nodeKey: key,

    // only expand on click node when the `check-strictly` is false
    expandOnClickNode: computed(() => {
      return !props.checkStrictly && props.expandOnClickNode
    }),

    // show current selected node only first time,
    // fix the problem of expanding multiple nodes when checking multiple nodes
    defaultExpandedKeys: computed(() => {
      return props.defaultExpandedKeys
        ? props.defaultExpandedKeys.concat(defaultExpandedParentKeys)
        : defaultExpandedParentKeys
    }),

    renderContent: (h, { node, data, store }) => {
      return h(
        TreeSelectOption,
        {
          value: getNodeValByProp('value', data),
          label: getNodeValByProp('label', data),
          disabled: getNodeValByProp('disabled', data),
        },
        props.renderContent
          ? () => props.renderContent(h, { node, data, store })
          : slots.default
          ? () => slots.default({ node, data, store })
          : undefined
      )
    },
    filterNodeMethod,
    onNodeClick: (data, node, e) => {
      attrs.onNodeClick?.(data, node, e)

      // `onCheck` is trigger when `checkOnClickNode`
      if (props.showCheckbox && props.checkOnClickNode) return

      // now `checkOnClickNode` is false, only no checkbox and `checkStrictly` or `isLeaf`
      if (!props.showCheckbox && (props.checkStrictly || node.isLeaf)) {
        if (!getNodeValByProp('disabled', data)) {
          const option = select.value?.options.get(
            getNodeValByProp('value', data)
          )
          select.value?.handleOptionSelect(option)
        }
      } else if (props.expandOnClickNode) {
        e.proxy.handleExpandIconClick()
      }
    },
    onCheck: (data, params) => {
      // ignore when no checkbox, like only `checkOnClickNode` is true
      if (!props.showCheckbox) return

      const dataValue = getNodeValByProp('value', data)

      // fix: checkedKeys has not cached keys
      const uncachedCheckedKeys = params.checkedKeys
      const cachedKeys = props.multiple
        ? toValidArray(props.modelValue).filter(
            (item) =>
              item in cacheOptionsMap.value &&
              !tree.value.getNode(item) &&
              !uncachedCheckedKeys.includes(item)
          )
        : []
      const checkedKeys = uncachedCheckedKeys.concat(cachedKeys)

      if (props.checkStrictly) {
        emit(
          UPDATE_MODEL_EVENT,
          // Checking for changes may come from `check-on-node-click`
          props.multiple
            ? checkedKeys
            : checkedKeys.includes(dataValue)
            ? dataValue
            : undefined
        )
      }
      // only can select leaf node
      else {
        if (props.multiple) {
          emit(
            UPDATE_MODEL_EVENT,
            (tree.value as InstanceType<typeof ElTree>).getCheckedKeys(true)
          )
        } else {
          // select first leaf node when check parent
          const firstLeaf = treeFind(
            [data],
            (data) =>
              !isValidArray(getNodeValByProp('children', data)) &&
              !getNodeValByProp('disabled', data),
            (data) => getNodeValByProp('children', data)
          )
          const firstLeafKey = firstLeaf
            ? getNodeValByProp('value', firstLeaf)
            : undefined

          // unselect when any child checked
          const hasCheckedChild =
            isValidValue(props.modelValue) &&
            !!treeFind(
              [data],
              (data) => getNodeValByProp('value', data) === props.modelValue,
              (data) => getNodeValByProp('children', data)
            )

          emit(
            UPDATE_MODEL_EVENT,
            firstLeafKey === props.modelValue || hasCheckedChild
              ? undefined
              : firstLeafKey
          )
        }
      }

      nextTick(() => {
        const checkedKeys = toValidArray(props.modelValue)
        tree.value.setCheckedKeys(checkedKeys)

        attrs.onCheck?.(data, {
          checkedKeys: tree.value.getCheckedKeys(),
          checkedNodes: tree.value.getCheckedNodes(),
          halfCheckedKeys: tree.value.getHalfCheckedKeys(),
          halfCheckedNodes: tree.value.getHalfCheckedNodes(),
        })
      })
    },

    // else
    cacheOptions,
  }
}
