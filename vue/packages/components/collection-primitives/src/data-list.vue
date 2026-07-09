<template>
  <div :class="listKls" :style="listStyle" v-bind="listAttrs">
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

    <component
      :is="rowTag(row, index)"
      v-for="(row, index) in rows"
      :key="String(getRowKey(row, index))"
      :class="rowKls(row, index)"
      :href="rowHref(row, index)"
      :type="rowButtonType(row, index)"
      :aria-current="isActive(row, index) ? 'true' : undefined"
      role="listitem"
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
        >
          {{ cellValue(row, column) }}
        </slot>
      </span>
    </component>

    <div v-if="rows.length === 0" :class="ns.e('empty')">
      <slot name="empty" />
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
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

const isInteractiveList = computed(() => props.interactive || Boolean(props.href))
const listKls = computed(() => [
  ns.b(),
  ns.m(props.density),
  ns.m(props.variant),
  ns.is('interactive', isInteractiveList.value),
])
const listAttrs = computed(() => ({
  role: 'list',
  'aria-label': props.ariaLabel || undefined,
  'aria-labelledby': props.ariaLabelledby || undefined,
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
  getRowKey(row, index) === props.loadingKey

const rowKls = (row: DataListRow, index: number) => [
  ns.e('row'),
  ns.is('active', isActive(row, index)),
  ns.is('loading', isLoading(row, index)),
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
  const key = getRowKey(row, index)
  emit(CHANGE_EVENT, row, key, event)
  emit('row-click', row, key, event)
}
</script>
