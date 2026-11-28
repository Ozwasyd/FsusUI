<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { clamp, useFsusLocale } from '@fsusui/core'
import { FsusIcon } from '@fsusui/icons'

defineOptions({ name: 'FsusPagination' })

export interface FsusPaginationProps {
  total: number
  pageSizes?: number[]
  pagerCount?: number
  disabled?: boolean
  showTotal?: boolean
  layout?: string
  hideOnSinglePage?: boolean
}

const props = withDefaults(defineProps<FsusPaginationProps>(), {
  pageSizes: () => [10, 20, 50, 100],
  pagerCount: 7,
  disabled: false,
  showTotal: true,
  layout: 'total, prev, pager, next',
  hideOnSinglePage: false,
})

const currentPage = defineModel<number>('currentPage', { default: 1 })
const pageSize = defineModel<number>('pageSize', { default: 10 })
const emit = defineEmits<{
  change: [page: number]
  currentChange: [page: number]
  sizeChange: [size: number]
}>()

const { t } = useFsusLocale()
const pageCount = computed(() => Math.max(1, Math.ceil(props.total / Math.max(pageSize.value, 1))))
const shouldHide = computed(() => props.hideOnSinglePage && pageCount.value <= 1)

const layoutParts = computed(() => {
  const parts = props.layout
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
  if (!props.showTotal) return parts.filter((p) => p !== 'total')
  return parts
})

const jumpText = ref(String(currentPage.value))
watch(currentPage, (val) => {
  jumpText.value = String(val)
})

const pages = computed<Array<number | 'ellipsis'>>(() => {
  const count = pageCount.value
  const cur = clamp(currentPage.value, 1, count)
  if (count <= props.pagerCount) return Array.from({ length: count }, (_, i) => i + 1)
  const out: Array<number | 'ellipsis'> = [1]
  const half = Math.floor((props.pagerCount - 2) / 2)
  let start = Math.max(2, cur - half)
  let end = Math.min(count - 1, cur + half)
  if (cur <= half + 2) end = props.pagerCount - 2
  if (cur >= count - half - 1) start = count - props.pagerCount + 3
  if (start > 2) out.push('ellipsis')
  for (let i = start; i <= end; i++) out.push(i)
  if (end < count - 1) out.push('ellipsis')
  out.push(count)
  return out
})

const go = (page: number) => {
  if (props.disabled) return
  const next = clamp(Math.trunc(page), 1, pageCount.value)
  jumpText.value = String(next)
  if (next === currentPage.value) return
  currentPage.value = next
  emit('change', next)
  emit('currentChange', next)
}

const onSizeChange = (e: Event) => {
  const nextSize = Number((e.target as HTMLSelectElement).value)
  if (!Number.isFinite(nextSize) || nextSize <= 0) return
  pageSize.value = nextSize
  emit('sizeChange', nextSize)
  const maxPage = Math.max(1, Math.ceil(props.total / nextSize))
  if (currentPage.value > maxPage) {
    currentPage.value = maxPage
    emit('change', maxPage)
    emit('currentChange', maxPage)
  }
}

const commitJump = () => {
  const parsed = Number(jumpText.value)
  if (Number.isFinite(parsed) && parsed >= 1) {
    go(parsed)
  } else {
    jumpText.value = String(currentPage.value)
  }
}
</script>

<template>
  <nav
    v-if="!shouldHide"
    class="fsus-pagination"
    aria-label="Pagination"
    :data-disabled="disabled ? '' : undefined"
  >
    <template v-for="(part, pIdx) in layoutParts" :key="`${part}-${pIdx}`">
      <span v-if="part === 'total'" class="fsus-pagination__total">
        {{ t('pagination.total', { total }) }}
      </span>

      <select
        v-else-if="part === 'sizes'"
        class="fsus-pagination__sizes"
        aria-label="Page size"
        :value="pageSize"
        :disabled="disabled"
        @change="onSizeChange"
      >
        <option v-for="sz in pageSizes" :key="sz" :value="sz">
          {{ t('pagination.perPage', { size: sz }) }}
        </option>
      </select>

      <button
        v-else-if="part === 'prev'"
        type="button"
        class="fsus-pagination__btn"
        :aria-label="t('pagination.prev')"
        :disabled="disabled || currentPage <= 1"
        @click="go(currentPage - 1)"
      >
        <FsusIcon name="arrow-left" :size="14" />
      </button>

      <template v-else-if="part === 'pager'">
        <template v-for="(item, idx) in pages" :key="`${item}-${idx}`">
          <span v-if="item === 'ellipsis'" class="fsus-pagination__ellipsis">…</span>
          <button
            v-else
            type="button"
            class="fsus-pagination__page"
            :aria-current="item === currentPage ? 'page' : undefined"
            :data-active="item === currentPage ? '' : undefined"
            :disabled="disabled"
            @click="go(item)"
          >
            {{ item }}
          </button>
        </template>
      </template>

      <button
        v-else-if="part === 'next'"
        type="button"
        class="fsus-pagination__btn"
        :aria-label="t('pagination.next')"
        :disabled="disabled || currentPage >= pageCount"
        @click="go(currentPage + 1)"
      >
        <FsusIcon name="arrow-right" :size="14" />
      </button>

      <label v-else-if="part === 'jumper'" class="fsus-pagination__jumper">
        <span>{{ t('pagination.goto') }}</span>
        <input
          v-model="jumpText"
          type="number"
          class="fsus-pagination__jumper-input"
          :min="1"
          :max="pageCount"
          :disabled="disabled"
          aria-label="Jump to page"
          @blur="commitJump"
          @keydown.enter.prevent="commitJump"
        />
      </label>

      <slot v-else-if="part === 'slot'" />
    </template>
  </nav>
</template>
