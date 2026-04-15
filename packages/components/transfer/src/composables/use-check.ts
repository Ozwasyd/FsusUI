import { computed, watch } from 'vue'
import { filterIndicesSync, warmupWasm } from '@element-plus/wasm'
import { isFunction } from '@element-plus/utils'
import { CHECKED_CHANGE_EVENT } from '../transfer-panel'
import { usePropsAlias } from './use-props-alias'

import type { SetupContext } from 'vue'
import type { CheckboxValueType } from '@element-plus/components/checkbox'
import type { TransferKey } from '../transfer'
import type {
  TransferPanelEmits,
  TransferPanelProps,
  TransferPanelState,
} from '../transfer-panel'

const WASM_TRANSFER_FILTER_THRESHOLD = 1_000

const isAsciiOnly = (value: string) => {
  for (let index = 0; index < value.length; index++) {
    if (value.charCodeAt(index) > 0x7f) {
      return false
    }
  }

  return true
}

export const useCheck = (
  props: TransferPanelProps,
  panelState: TransferPanelState,
  emit: SetupContext<TransferPanelEmits>['emit'],
) => {
  const propsAlias = usePropsAlias(props)
  const filterSourceData = computed(() => [...props.data])
  const filterLabels = computed(() => {
    return filterSourceData.value.map((item) => {
      return String(item[propsAlias.value.label] || item[propsAlias.value.key])
    })
  })
  const shouldUseWasmFilter = computed(() => {
    return (
      !isFunction(props.filterMethod) &&
      panelState.query.length > 0 &&
      filterLabels.value.length >= WASM_TRANSFER_FILTER_THRESHOLD
    )
  })
  const canUseWasmFilter = computed(() => {
    return (
      shouldUseWasmFilter.value &&
      isAsciiOnly(panelState.query) &&
      filterLabels.value.every((label) => isAsciiOnly(label))
    )
  })

  const filteredData = computed(() => {
    if (canUseWasmFilter.value) {
      const matchedIndexes = filterIndicesSync(
        filterLabels.value,
        panelState.query,
        false,
      )

      if (matchedIndexes) {
        const matchedIndexSet = new Set(matchedIndexes)
        return filterSourceData.value.filter((_, index) =>
          matchedIndexSet.has(index),
        )
      }
    }

    return filterSourceData.value.filter((item) => {
      if (isFunction(props.filterMethod)) {
        return props.filterMethod(panelState.query, item)
      } else {
        const label = String(
          item[propsAlias.value.label] || item[propsAlias.value.key],
        )
        return label.toLowerCase().includes(panelState.query.toLowerCase())
      }
    })
  })

  const checkableData = computed(() =>
    filteredData.value.filter((item) => !item[propsAlias.value.disabled]),
  )

  const checkedSummary = computed(() => {
    const checkedLength = panelState.checked.length
    const dataLength = props.data.length
    const { noChecked, hasChecked } = props.format

    if (noChecked && hasChecked) {
      return checkedLength > 0
        ? hasChecked
            .replaceAll(/\${checked}/g, checkedLength.toString())
            .replaceAll(/\${total}/g, dataLength.toString())
        : noChecked.replaceAll(/\${total}/g, dataLength.toString())
    } else {
      return `${checkedLength}/${dataLength}`
    }
  })

  const isIndeterminate = computed(() => {
    const checkedLength = panelState.checked.length
    return checkedLength > 0 && checkedLength < checkableData.value.length
  })

  const updateAllChecked = () => {
    const checkableDataKeys = checkableData.value.map(
      (item) => item[propsAlias.value.key],
    )
    const checkedSet = new Set(panelState.checked)
    panelState.allChecked =
      checkableDataKeys.length > 0 &&
      checkableDataKeys.every((item) => checkedSet.has(item))
  }

  const handleAllCheckedChange = (value: CheckboxValueType) => {
    panelState.checked = value
      ? checkableData.value.map((item) => item[propsAlias.value.key])
      : []
  }

  watch(
    () => panelState.checked,
    (val, oldVal) => {
      updateAllChecked()

      if (panelState.checkChangeByUser) {
        const movedKeys = val
          .concat(oldVal)
          .filter((v) => !val.includes(v) || !oldVal.includes(v))
        emit(CHECKED_CHANGE_EVENT, val, movedKeys)
      } else {
        emit(CHECKED_CHANGE_EVENT, val)
        panelState.checkChangeByUser = true
      }
    },
  )

  watch(checkableData, () => {
    updateAllChecked()
  })

  watch(
    canUseWasmFilter,
    (useWasm) => {
      if (useWasm) {
        warmupWasm()
      }
    },
    {
      immediate: true,
    },
  )

  watch(filterSourceData, () => {
    const checked: TransferKey[] = []
    const filteredDataKeys = new Set(
      filteredData.value.map((item) => item[propsAlias.value.key]),
    )
    panelState.checked.forEach((item) => {
      if (filteredDataKeys.has(item)) {
        checked.push(item)
      }
    })
    panelState.checkChangeByUser = false
    panelState.checked = checked
  })

  watch(
    () => props.defaultChecked,
    (val, oldVal) => {
      if (
        oldVal &&
        val.length === oldVal.length &&
        val.every((item) => oldVal.includes(item))
      )
        return

      const checked: TransferKey[] = []
      const checkableDataKeys = new Set(
        checkableData.value.map((item) => item[propsAlias.value.key]),
      )

      val.forEach((item) => {
        if (checkableDataKeys.has(item)) {
          checked.push(item)
        }
      })
      panelState.checkChangeByUser = false
      panelState.checked = checked
    },
    {
      immediate: true,
    },
  )

  return {
    filteredData,
    checkableData,
    checkedSummary,
    isIndeterminate,
    updateAllChecked,
    handleAllCheckedChange,
  }
}
