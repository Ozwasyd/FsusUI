<script setup lang="ts">
import { computed, ref } from 'vue'
import { useFsusLocale } from '@fsusui/core'
import FsusButton from '../button/FsusButton.vue'
import { FsusCheckbox } from '../checkbox'

defineOptions({ name: 'FsusTransfer' })

export interface FsusTransferItem {
  key: string | number
  label: string
  disabled?: boolean
}

export interface FsusTransferProps {
  data: FsusTransferItem[]
  titles?: [string, string]
  filterable?: boolean
}

const { data, titles, filterable = false } = defineProps<FsusTransferProps>()

const model = defineModel<Array<string | number>>({ default: () => [] })
const emit = defineEmits<{ change: [value: Array<string | number>] }>()

const { t } = useFsusLocale()
const leftQuery = ref('')
const rightQuery = ref('')
const leftChecked = ref<Array<string | number>>([])
const rightChecked = ref<Array<string | number>>([])

const targetSet = computed(() => new Set(model.value))
const sourceItems = computed(() =>
  data.filter(
    (item) =>
      !targetSet.value.has(item.key) &&
      (!leftQuery.value || item.label.toLowerCase().includes(leftQuery.value.toLowerCase())),
  ),
)
const targetItems = computed(() =>
  data.filter(
    (item) =>
      targetSet.value.has(item.key) &&
      (!rightQuery.value || item.label.toLowerCase().includes(rightQuery.value.toLowerCase())),
  ),
)

const toggleKey = (side: 'left' | 'right', key: string | number) => {
  const bucket = side === 'left' ? leftChecked : rightChecked
  bucket.value = bucket.value.includes(key)
    ? bucket.value.filter((k) => k !== key)
    : [...bucket.value, key]
}

const moveRight = () => {
  if (leftChecked.value.length === 0) return
  const next = Array.from(new Set([...model.value, ...leftChecked.value]))
  leftChecked.value = []
  model.value = next
  emit('change', next)
}

const moveLeft = () => {
  if (rightChecked.value.length === 0) return
  const removeSet = new Set(rightChecked.value)
  const next = model.value.filter((k) => !removeSet.has(k))
  rightChecked.value = []
  model.value = next
  emit('change', next)
}
</script>

<template>
  <div class="fsus-transfer">
    <section class="fsus-transfer__panel">
      <header class="fsus-transfer__header">
        <span>{{ titles?.[0] ?? t('transfer.sourceTitle') }}</span>
        <span class="fsus-transfer__count">{{ leftChecked.length }}/{{ sourceItems.length }}</span>
      </header>
      <div v-if="filterable" class="fsus-transfer__filter">
        <input
          v-model="leftQuery"
          type="search"
          class="fsus-input__native"
          :placeholder="t('transfer.filterPlaceholder')"
        />
      </div>
      <div class="fsus-transfer__list">
        <div v-if="sourceItems.length === 0" class="fsus-transfer__empty">{{ t('transfer.noData') }}</div>
        <FsusCheckbox
          v-for="item in sourceItems"
          :key="String(item.key)"
          :model-value="leftChecked.includes(item.key)"
          :disabled="item.disabled"
          :label="item.label"
          @update:model-value="toggleKey('left', item.key)"
        />
      </div>
    </section>

    <div class="fsus-transfer__actions">
      <FsusButton
        size="sm"
        icon="arrow-right"
        :disabled="leftChecked.length === 0"
        ariaLabel="Move to target"
        @click="moveRight"
      />
      <FsusButton
        size="sm"
        icon="arrow-left"
        :disabled="rightChecked.length === 0"
        ariaLabel="Move to source"
        @click="moveLeft"
      />
    </div>

    <section class="fsus-transfer__panel">
      <header class="fsus-transfer__header">
        <span>{{ titles?.[1] ?? t('transfer.targetTitle') }}</span>
        <span class="fsus-transfer__count">{{ rightChecked.length }}/{{ targetItems.length }}</span>
      </header>
      <div v-if="filterable" class="fsus-transfer__filter">
        <input
          v-model="rightQuery"
          type="search"
          class="fsus-input__native"
          :placeholder="t('transfer.filterPlaceholder')"
        />
      </div>
      <div class="fsus-transfer__list">
        <div v-if="targetItems.length === 0" class="fsus-transfer__empty">{{ t('transfer.noData') }}</div>
        <FsusCheckbox
          v-for="item in targetItems"
          :key="String(item.key)"
          :model-value="rightChecked.includes(item.key)"
          :disabled="item.disabled"
          :label="item.label"
          @update:model-value="toggleKey('right', item.key)"
        />
      </div>
    </section>
  </div>
</template>
