<template>
  <div ref="rootRef" :class="controlKls" v-bind="controlAttrs">
    <button
      v-for="(item, index) in items"
      :key="String(item.value)"
      :class="optionKls(item)"
      :disabled="item.disabled"
      :aria-checked="isSelected(item)"
      :tabindex="optionTabIndex(item)"
      role="radio"
      type="button"
      @click="selectItem(item)"
      @keydown="handleKeydown($event, index)"
    >
      <slot name="item" :item="item" :selected="isSelected(item)">
        {{ item.label }}
      </slot>
    </button>
  </div>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue'
import { CHANGE_EVENT, UPDATE_MODEL_EVENT } from '@element-plus/constants'
import { useNamespace } from '@element-plus/hooks'
import {
  segmentedControlEmits,
  segmentedControlProps,
  type SegmentedControlItem,
} from './segmented-control'

defineOptions({
  name: 'ElSegmentedControl',
})

const props = defineProps(segmentedControlProps)
const emit = defineEmits(segmentedControlEmits)
const ns = useNamespace('segmented-control')
const rootRef = ref<HTMLElement>()

const enabledItems = computed(() =>
  props.items.filter((item) => !item.disabled),
)
const selectedIndex = computed(() =>
  props.items.findIndex((item) => item.value === props.modelValue),
)
const controlKls = computed(() => [ns.b(), ns.m(props.density)])
const controlAttrs = computed(() => ({
  role: 'radiogroup',
  'aria-label': props.ariaLabel || undefined,
  'aria-labelledby': props.ariaLabelledby || undefined,
}))

const isSelected = (item: SegmentedControlItem) =>
  item.value === props.modelValue

const optionKls = (item: SegmentedControlItem) => [
  ns.e('item'),
  ns.is('active', isSelected(item)),
]

const optionTabIndex = (item: SegmentedControlItem) => {
  if (item.disabled) return -1
  if (selectedIndex.value === -1) {
    return enabledItems.value[0]?.value === item.value ? 0 : -1
  }
  return isSelected(item) ? 0 : -1
}

const selectItem = (item: SegmentedControlItem) => {
  if (item.disabled || isSelected(item)) return
  emit(UPDATE_MODEL_EVENT, item.value)
  emit(CHANGE_EVENT, item.value)
}

const focusItem = (index: number) => {
  const buttons = rootRef.value?.querySelectorAll<HTMLButtonElement>('button')
  buttons?.[index]?.focus()
}

const findNextIndex = (currentIndex: number, direction: 1 | -1) => {
  if (!props.items.length) return -1

  for (let step = 1; step <= props.items.length; step += 1) {
    const nextIndex =
      (currentIndex + step * direction + props.items.length) %
      props.items.length

    if (!props.items[nextIndex]?.disabled) return nextIndex
  }

  return -1
}

const findLastEnabledIndex = () => {
  for (let index = props.items.length - 1; index >= 0; index -= 1) {
    if (!props.items[index]?.disabled) return index
  }

  return -1
}

const handleKeydown = (event: KeyboardEvent, index: number) => {
  const keyMap: Record<string, number | 'first' | 'last'> = {
    ArrowRight: 1,
    ArrowDown: 1,
    ArrowLeft: -1,
    ArrowUp: -1,
    Home: 'first',
    End: 'last',
  }
  const action = keyMap[event.key]

  if (action === undefined) return

  event.preventDefault()

  const nextIndex =
    action === 'first'
      ? props.items.findIndex((item) => !item.disabled)
      : action === 'last'
        ? findLastEnabledIndex()
        : findNextIndex(index, action as 1 | -1)
  const nextItem = props.items[nextIndex]

  if (!nextItem) return
  selectItem(nextItem)
  focusItem(nextIndex)
}
</script>
