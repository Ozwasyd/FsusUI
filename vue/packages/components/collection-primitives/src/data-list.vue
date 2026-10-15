<template>
  <div
    ref="listRef"
    :class="listKls"
    :style="listStyle"
    v-bind="listAttrs"
    tabindex="-1"
    @focusout="handleFocusOut"
  >
    <div
      v-if="showHeader && columns.length > 0"
      :class="ns.e('head')"
      aria-hidden="true"
    >
      <span
        v-for="column in columns"
        :key="column.key"
        :class="cellKls(column)"
      >
        {{ column.label }}
      </span>
    </div>

    <div
      v-for="(row, index) in rows"
      :key="getRowKey(row, index)"
      :class="ns.e('item')"
      role="listitem"
    >
      <component
        :is="rowTag(row, index)"
        :ref="(element) => setRowRef(getRowKey(row, index), element)"
        :class="rowKls(row, index)"
        :href="isDisabled(row, index) ? undefined : rowHref(row, index)"
        :type="rowButtonType(row, index)"
        :role="rowTag(row, index) === 'a' ? 'link' : undefined"
        :disabled="rowTag(row, index) === 'button' && isDisabled(row, index)"
        :tabindex="rowTag(row, index) === 'a' && isDisabled(row, index) ? -1 : undefined"
        :aria-current="isActive(row, index) ? 'true' : undefined"
        :aria-disabled="isDisabled(row, index) ? 'true' : undefined"
        :aria-busy="isLoading(row, index) ? 'true' : undefined"
        @click="handleRowClick(row, index, $event)"
      >
        <span
          v-for="column in columns"
          :key="column.key"
          :class="cellKls(column)"
        >
          <slot
            name="cell"
            :row="row"
            :column="column"
            :value="cellValue(row, column)"
            :active="isActive(row, index)"
            :loading="isLoading(row, index)"
            :disabled="isDisabled(row, index)"
          >
            {{ cellValue(row, column) }}
          </slot>
        </span>
      </component>
    </div>

    <div v-if="rows.length === 0" :class="ns.e('empty')">
      <slot name="empty" />
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, nextTick, ref, watch } from 'vue'
import { CHANGE_EVENT } from '@element-plus/constants'
import { useNamespace } from '@element-plus/hooks'
import {
  dataListEmits,
  dataListProps,
  type DataListColumn,
  type DataListRow,
  type DataListRowKey,
} from './data-list'

defineOptions({
  name: 'ElDataList',
})

const props = defineProps(dataListProps)
const emit = defineEmits(dataListEmits)
const ns = useNamespace('data-list')
const listRef = ref<HTMLElement>()
const rowElements = new Map<DataListRowKey, HTMLElement>()
let recoveryKey: DataListRowKey | undefined

const setRowRef = (key: DataListRowKey, element: unknown) => {
  if (element instanceof HTMLElement) rowElements.set(key, element)
  else rowElements.delete(key)
}
const handleFocusOut = (event: FocusEvent) => {
  if (event.relatedTarget && !listRef.value?.contains(event.relatedTarget as Node)) {
    recoveryKey = undefined
  }
}

const isInteractiveList = computed(() => props.interactive || Boolean(props.href))
const listKls = computed(() => [
  ns.b(),
  ns.m(props.density),
  ns.m(props.variant),
  ns.is('interactive', isInteractiveList.value),
  ns.is('responsive', props.responsive),
])
const listAttrs = computed(() => ({
  role: 'list',
  'aria-label': props.ariaLabel || undefined,
  'aria-labelledby': props.ariaLabelledby || undefined,
  'aria-busy': props.loading || undefined,
  'aria-disabled': props.disabled || undefined,
}))
const listStyle = computed(() => ({
  '--el-data-list-columns': props.columns
    .map((column) => column.grid || 'minmax(0, 1fr)')
    .join(' '),
}))

const getRowKey = (row: DataListRow, index: number): DataListRowKey => {
  if (typeof props.rowKey === 'function') return props.rowKey(row, index)
  const value = row[props.rowKey]
  return typeof value === 'number' || typeof value === 'string' ? value : index
}

const rowHref = (row: DataListRow, index: number): string | undefined =>
  props.href?.(row, index)
const rowTag = (row: DataListRow, index: number): 'a' | 'button' | 'div' => {
  if (rowHref(row, index)) return 'a'
  return props.interactive ? 'button' : 'div'
}
const rowButtonType = (
  row: DataListRow,
  index: number,
): 'button' | undefined =>
  rowTag(row, index) === 'button' ? 'button' : undefined
const isActive = (row: DataListRow, index: number): boolean =>
  getRowKey(row, index) === props.activeKey
const isLoading = (row: DataListRow, index: number): boolean =>
  props.loading || getRowKey(row, index) === props.loadingKey
const disabledKeys = computed(() => new Set(props.disabledKeys))
const isDisabled = (row: DataListRow, index: number): boolean =>
  props.disabled || isLoading(row, index) || disabledKeys.value.has(getRowKey(row, index))

watch(
  () => props.rows.map((row, index) => ({
    key: getRowKey(row, index),
    enabled: !isDisabled(row, index) && rowTag(row, index) !== 'div',
  })),
  (entries, previousEntries, onCleanup) => {
    const list = listRef.value
    if (!list) return
    const document = list.ownerDocument
    const focused = document.activeElement
    const focusedEntry = [...rowElements].find(([, element]) => element === focused)
    const key = focusedEntry?.[0] ?? (focused === list ? recoveryKey : undefined)
    if (key === undefined) return
    const index = previousEntries.findIndex((entry) => entry.key === key)
    let cancelled = false
    onCleanup(() => { cancelled = true })

    nextTick(() => {
      if (cancelled || !list.isConnected) return
      const currentFocus = document.activeElement
      if (currentFocus !== focused && currentFocus !== document.body) return
      const sameEntry = entries.find((entry) => entry.key === key && entry.enabled)
      const start = Math.max(0, index)
      const target = sameEntry
        ?? entries.slice(start).find((entry) => entry.enabled)
        ?? entries.slice(0, start).reverse().find((entry) => entry.enabled)
      recoveryKey = target?.key ?? key
      const element = target ? rowElements.get(target.key) : list
      if (element && element !== currentFocus) element.focus({ preventScroll: true })
    })
  },
)

const rowKls = (row: DataListRow, index: number) => [
  ns.e('row'),
  ns.is('active', isActive(row, index)),
  ns.is('loading', isLoading(row, index)),
  ns.is('disabled', isDisabled(row, index)),
]

const cellKls = (column: DataListColumn) => [
  ns.e('cell'),
  ns.em('cell', column.align || 'start'),
]

const cellValue = (row: DataListRow, column: DataListColumn): unknown =>
  row[column.key] ?? ''

const handleRowClick = (
  row: DataListRow,
  index: number,
  event: MouseEvent,
): void => {
  if (isDisabled(row, index) || rowTag(row, index) === 'div') {
    event.preventDefault()
    return
  }
  const key = getRowKey(row, index)
  emit(CHANGE_EVENT, row, key, event)
  emit('row-click', row, key, event)
}
</script>
