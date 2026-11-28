<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useFsusLocale, type FsusSize } from '@fsusui/core'
import FsusPopover from '../popover/FsusPopover.vue'
import FsusButton from '../button/FsusButton.vue'
import {
  formatColor,
  hsvaToRgba,
  parseColor,
  type FsusColorFormat,
  type HsvaColor,
} from './color-math'

defineOptions({ name: 'FsusColorPicker' })

export type { FsusColorFormat }

export interface FsusColorPickerProps {
  disabled?: boolean
  showAlpha?: boolean
  colorFormat?: FsusColorFormat
  size?: FsusSize
  predefine?: string[]
}

const props = withDefaults(defineProps<FsusColorPickerProps>(), {
  disabled: false,
  showAlpha: false,
  colorFormat: 'hex',
  size: 'md',
  predefine: () => ['#0F0F11', '#2A599C', '#16A34A', '#D97706', '#D92D20', '#71717A'],
})

const model = defineModel<string>({ default: '#2A599C' })
const emit = defineEmits<{
  change: [color: string]
  activeChange: [color: string]
}>()

const { t } = useFsusLocale()
const open = ref(false)
const activeFormat = ref<FsusColorFormat>(props.colorFormat)
const hsva = reactive<HsvaColor>(parseColor(model.value) ?? { h: 215, s: 73, v: 61, a: 1 })
const inputText = ref(model.value || formatColor(hsva, activeFormat.value, props.showAlpha))

const svRef = ref<HTMLElement | null>(null)
const hueRef = ref<HTMLElement | null>(null)
const alphaRef = ref<HTMLElement | null>(null)

const syncFromModel = (raw: string) => {
  const parsed = parseColor(raw)
  if (parsed) {
    hsva.h = parsed.h
    hsva.s = parsed.s
    hsva.v = parsed.v
    hsva.a = parsed.a
    inputText.value = formatColor(hsva, activeFormat.value, props.showAlpha)
  } else if (!raw) {
    inputText.value = ''
  }
}

watch(
  () => model.value,
  (val) => syncFromModel(val),
)

watch(
  () => props.colorFormat,
  (fmt) => {
    activeFormat.value = fmt
    inputText.value = formatColor(hsva, fmt, props.showAlpha)
  },
)

watch(open, (isOpen) => {
  if (isOpen && model.value) syncFromModel(model.value)
})

const currentFormatted = computed(() => formatColor(hsva, activeFormat.value, props.showAlpha))
const currentRgba = computed(() => hsvaToRgba(hsva))
const previewCss = computed(
  () => `rgba(${currentRgba.value.r}, ${currentRgba.value.g}, ${currentRgba.value.b}, ${currentRgba.value.a})`,
)
const opaqueCss = computed(
  () => `rgb(${currentRgba.value.r}, ${currentRgba.value.g}, ${currentRgba.value.b})`,
)
const hueBaseCss = computed(() => `hsl(${hsva.h}, 100%, 50%)`)

const notifyActive = () => {
  const formatted = currentFormatted.value
  inputText.value = formatted
  emit('activeChange', formatted)
}

const bindDrag = (el: HTMLElement | null, update: (rx: number, ry: number) => void, e: PointerEvent) => {
  if (!el) return
  e.preventDefault()
  const compute = (ev: PointerEvent) => {
    const rect = el.getBoundingClientRect()
    const w = rect.width || 1
    const h = rect.height || 1
    const rx = Math.min(1, Math.max(0, (ev.clientX - rect.left) / w))
    const ry = Math.min(1, Math.max(0, (ev.clientY - rect.top) / h))
    update(rx, ry)
  }
  compute(e)
  const onMove = (ev: PointerEvent) => compute(ev)
  const onUp = () => {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
  }
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
}

const onSvPointerDown = (e: PointerEvent) => {
  bindDrag(
    svRef.value,
    (rx, ry) => {
      hsva.s = Math.round(rx * 100)
      hsva.v = Math.round((1 - ry) * 100)
      notifyActive()
    },
    e,
  )
}

const onSvKeydown = (e: KeyboardEvent) => {
  const step = e.shiftKey ? 10 : 2
  if (e.key === 'ArrowRight') hsva.s = Math.min(100, hsva.s + step)
  else if (e.key === 'ArrowLeft') hsva.s = Math.max(0, hsva.s - step)
  else if (e.key === 'ArrowUp') hsva.v = Math.min(100, hsva.v + step)
  else if (e.key === 'ArrowDown') hsva.v = Math.max(0, hsva.v - step)
  else return
  e.preventDefault()
  notifyActive()
}

const onHuePointerDown = (e: PointerEvent) => {
  bindDrag(
    hueRef.value,
    (rx) => {
      hsva.h = Math.round(rx * 360)
      notifyActive()
    },
    e,
  )
}

const onHueKeydown = (e: KeyboardEvent) => {
  const step = e.shiftKey ? 15 : 3
  if (e.key === 'ArrowRight' || e.key === 'ArrowUp') hsva.h = Math.min(360, hsva.h + step)
  else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') hsva.h = Math.max(0, hsva.h - step)
  else return
  e.preventDefault()
  notifyActive()
}

const onAlphaPointerDown = (e: PointerEvent) => {
  bindDrag(
    alphaRef.value,
    (rx) => {
      hsva.a = Number(rx.toFixed(2))
      notifyActive()
    },
    e,
  )
}

const onAlphaKeydown = (e: KeyboardEvent) => {
  const step = e.shiftKey ? 0.1 : 0.02
  if (e.key === 'ArrowRight' || e.key === 'ArrowUp') hsva.a = Math.min(1, Number((hsva.a + step).toFixed(2)))
  else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') hsva.a = Math.max(0, Number((hsva.a - step).toFixed(2)))
  else return
  e.preventDefault()
  notifyActive()
}

const onInputCommit = () => {
  const parsed = parseColor(inputText.value)
  if (parsed) {
    hsva.h = parsed.h
    hsva.s = parsed.s
    hsva.v = parsed.v
    hsva.a = parsed.a
    notifyActive()
  } else {
    inputText.value = currentFormatted.value
  }
}

const switchFormat = (fmt: FsusColorFormat) => {
  activeFormat.value = fmt
  inputText.value = formatColor(hsva, fmt, props.showAlpha)
}

const applyPreset = (color: string) => {
  const parsed = parseColor(color)
  if (parsed) {
    hsva.h = parsed.h
    hsva.s = parsed.s
    hsva.v = parsed.v
    hsva.a = parsed.a
  }
  const formatted = formatColor(hsva, activeFormat.value, props.showAlpha)
  inputText.value = formatted
  model.value = formatted
  emit('activeChange', formatted)
  emit('change', formatted)
}

const confirm = () => {
  const parsed = parseColor(inputText.value)
  if (parsed) {
    hsva.h = parsed.h
    hsva.s = parsed.s
    hsva.v = parsed.v
    hsva.a = parsed.a
  }
  const finalColor = formatColor(hsva, activeFormat.value, props.showAlpha)
  inputText.value = finalColor
  model.value = finalColor
  emit('change', finalColor)
  open.value = false
}

const clear = () => {
  inputText.value = ''
  model.value = ''
  emit('change', '')
  open.value = false
}

const formats: FsusColorFormat[] = ['hex', 'rgb', 'hsl']
</script>

<template>
  <span class="fsus-color-picker" :data-size="size" :data-disabled="disabled ? '' : undefined">
    <FsusPopover v-model:open="open" :disabled="disabled" :width="276">
    <template #reference>
      <button
        type="button"
        class="fsus-color-picker__trigger"
        :data-size="size"
        :disabled="disabled"
        :aria-label="`Select color: ${model || 'none'}`"
      >
        <span class="fsus-color-picker__swatch" :style="{ backgroundColor: model || 'transparent' }" />
      </button>
    </template>

    <div class="fsus-color-picker__panel">
      <!-- 2D Saturation / Value Plane -->
      <div
        ref="svRef"
        class="fsus-color-picker__sv"
        role="slider"
        tabindex="0"
        aria-label="Saturation and brightness"
        :aria-valuetext="`Saturation ${hsva.s}%, Brightness ${hsva.v}%`"
        :style="{ backgroundColor: hueBaseCss }"
        @pointerdown="onSvPointerDown"
        @keydown="onSvKeydown"
      >
        <div class="fsus-color-picker__sv-white" />
        <div class="fsus-color-picker__sv-black" />
        <span
          class="fsus-color-picker__sv-cursor"
          :style="{ left: `${hsva.s}%`, top: `${100 - hsva.v}%` }"
        />
      </div>

      <!-- Hue Slider -->
      <div class="fsus-color-picker__sliders">
        <span class="fsus-color-picker__preview" :style="{ backgroundColor: previewCss }" />
        <div class="fsus-color-picker__bars">
          <div
            ref="hueRef"
            class="fsus-color-picker__hue"
            role="slider"
            tabindex="0"
            aria-label="Hue"
            aria-valuemin="0"
            aria-valuemax="360"
            :aria-valuenow="hsva.h"
            @pointerdown="onHuePointerDown"
            @keydown="onHueKeydown"
          >
            <span class="fsus-color-picker__bar-thumb" :style="{ left: `${(hsva.h / 360) * 100}%` }" />
          </div>

          <div
            v-if="showAlpha"
            ref="alphaRef"
            class="fsus-color-picker__alpha-bar"
            role="slider"
            tabindex="0"
            aria-label="Alpha"
            aria-valuemin="0"
            aria-valuemax="1"
            :aria-valuenow="hsva.a"
            @pointerdown="onAlphaPointerDown"
            @keydown="onAlphaKeydown"
          >
            <div
              class="fsus-color-picker__alpha-grad"
              :style="{ background: `linear-gradient(to right, transparent, ${opaqueCss})` }"
            />
            <span class="fsus-color-picker__bar-thumb" :style="{ left: `${hsva.a * 100}%` }" />
          </div>
        </div>
      </div>

      <!-- Format Switcher + Input -->
      <div class="fsus-color-picker__format-row">
        <div class="fsus-color-picker__format-tabs" role="tablist">
          <button
            v-for="fmt in formats"
            :key="fmt"
            type="button"
            role="tab"
            class="fsus-color-picker__format-tab"
            :aria-selected="activeFormat === fmt ? 'true' : 'false'"
            :data-active="activeFormat === fmt ? '' : undefined"
            @click="switchFormat(fmt)"
          >
            {{ fmt.toUpperCase() }}
          </button>
        </div>
        <input
          v-model="inputText"
          type="text"
          class="fsus-input__native fsus-color-picker__hex"
          aria-label="Color value"
          @change="onInputCommit"
          @keydown.enter.prevent="confirm"
        />
      </div>

      <!-- Predefine Swatches -->
      <div v-if="predefine.length" class="fsus-color-picker__presets">
        <button
          v-for="color in predefine"
          :key="color"
          type="button"
          class="fsus-color-picker__preset"
          :style="{ backgroundColor: color }"
          :aria-label="color"
          @click="applyPreset(color)"
        />
      </div>

      <div class="fsus-color-picker__actions">
        <FsusButton size="sm" variant="ghost" @click="clear">{{ t('colorPicker.clear') }}</FsusButton>
        <FsusButton size="sm" variant="primary" @click="confirm">{{ t('colorPicker.confirm') }}</FsusButton>
      </div>
    </div>
  </FsusPopover>
  </span>
</template>
