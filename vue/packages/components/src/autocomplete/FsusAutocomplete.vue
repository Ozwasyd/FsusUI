<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  debounce,
  FSUS_KEY,
  useClickOutside,
  useFloating,
  useFsusLocale,
  useFsusZIndex,
  type FsusSize,
} from '@fsusui/core'

defineOptions({ name: 'FsusAutocomplete' })

export interface FsusAutocompleteItem {
  value: string
  [key: string]: unknown
}

export interface FsusAutocompleteProps {
  fetchSuggestions: (query: string) => FsusAutocompleteItem[] | Promise<FsusAutocompleteItem[]>
  placeholder?: string
  disabled?: boolean
  size?: FsusSize
  debounceMs?: number
  teleported?: boolean
}

const {
  fetchSuggestions,
  placeholder,
  disabled = false,
  size = 'md',
  debounceMs = 200,
  teleported = true,
} = defineProps<FsusAutocompleteProps>()

const model = defineModel<string>({ default: '' })
const emit = defineEmits<{ select: [item: FsusAutocompleteItem] }>()

const { t } = useFsusLocale()
const open = ref(false)
const loading = ref(false)
const suggestions = ref<FsusAutocompleteItem[]>([])
const activeIndex = ref(-1)
const refEl = ref<HTMLElement | null>(null)
const floatEl = ref<HTMLElement | null>(null)
const { currentZIndex, nextZIndex } = useFsusZIndex()

const querySuggestions = debounce(async (q: string) => {
  loading.value = true
  try {
    suggestions.value = await fetchSuggestions(q)
    activeIndex.value = suggestions.value.length > 0 ? 0 : -1
  } finally {
    loading.value = false
  }
}, debounceMs)

const onInput = (event: Event) => {
  const val = (event.target as HTMLInputElement).value
  model.value = val
  nextZIndex()
  open.value = true
  querySuggestions(val)
}

const choose = (item: FsusAutocompleteItem) => {
  model.value = item.value
  open.value = false
  emit('select', item)
}

const onKeydown = (event: KeyboardEvent) => {
  if (!open.value || suggestions.value.length === 0) return
  if (event.key === FSUS_KEY.ARROW_DOWN) {
    event.preventDefault()
    activeIndex.value = (activeIndex.value + 1) % suggestions.value.length
  } else if (event.key === FSUS_KEY.ARROW_UP) {
    event.preventDefault()
    activeIndex.value = (activeIndex.value - 1 + suggestions.value.length) % suggestions.value.length
  } else if (event.key === FSUS_KEY.ENTER && activeIndex.value >= 0) {
    event.preventDefault()
    choose(suggestions.value[activeIndex.value]!)
  } else if (event.key === FSUS_KEY.ESCAPE) {
    open.value = false
  }
}

const { floatingStyle } = useFloating(refEl, floatEl, {
  placement: 'bottom-start',
  offsetPx: 6,
  matchWidth: true,
  open,
})

useClickOutside(
  computed(() => [refEl.value, floatEl.value]),
  () => (open.value = false),
  open,
)
</script>

<template>
  <div ref="refEl" class="fsus-autocomplete" :data-size="size">
    <input
      type="text"
      role="combobox"
      class="fsus-input__native fsus-autocomplete__input"
      :value="model"
      :placeholder="placeholder ?? t('common.inputPlaceholder')"
      :disabled="disabled"
      :aria-expanded="open ? 'true' : 'false'"
      @input="onInput"
      @focus="open = true; querySuggestions(model)"
      @keydown="onKeydown"
    />
  </div>
  <Teleport to="body" :disabled="!teleported">
    <div
      v-if="open && !disabled && (loading || suggestions.length > 0)"
      ref="floatEl"
      class="fsus-select__dropdown"
      role="listbox"
      :style="{ ...floatingStyle, zIndex: currentZIndex }"
    >
      <div v-if="loading" class="fsus-select__empty">{{ t('common.loading') }}</div>
      <button
        v-for="(item, idx) in suggestions"
        v-else
        :key="item.value"
        type="button"
        role="option"
        class="fsus-select__option"
        :data-active="idx === activeIndex ? '' : undefined"
        @click="choose(item)"
      >
        <slot :item="item">{{ item.value }}</slot>
      </button>
    </div>
  </Teleport>
</template>
