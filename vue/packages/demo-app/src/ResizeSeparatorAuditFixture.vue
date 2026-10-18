<template>
  <div class="resize-separator-audit">
    <el-checkbox
      :model-value="disabled"
      @update:model-value="disabled = $event === true"
    >
      Disabled
    </el-checkbox>
    <div
      v-for="orientation in orientations"
      :key="orientation"
      :ref="(element) => setElement(frames, orientation, element)"
      class="resize-separator-audit__frame"
      :class="`is-${orientation}`"
      :data-testid="`resize-frame-${orientation}`"
      :style="tracks(orientation)"
      @pointerdown.capture="refresh"
      @keydown.capture="refresh"
    >
      <section :id="regionId(orientation, 'primary')">
        {{ boundary ? 'Primary region with long review content' : 'Primary' }}
      </section>
      <div
        :ref="(element) => setElement(handles, orientation, element)"
        class="resize-separator-audit__handle"
      >
        <el-resize-separator
          :value="values[orientation]"
          :min="0.2"
          :max="0.8"
          :step="0.05"
          :orientation="orientation"
          :disabled="disabled"
          :label="`Resize ${orientation} primary region`"
          :primary-region-id="regionId(orientation, 'primary')"
          :secondary-region-id="regionId(orientation, 'secondary')"
          :coordinate-range="ranges[orientation]"
          data-audit-focus
          data-audit-target
          data-audit-active
          @proposal="values[orientation] = $event.value"
        />
      </div>
      <section :id="regionId(orientation, 'secondary')">
        {{
          boundary ? 'Secondary region with long review content' : 'Secondary'
        }}
      </section>
    </div>
    <output aria-label="Accepted resize values">
      Vertical {{ values.vertical }}; horizontal {{ values.horizontal }}
    </output>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref, useId } from 'vue'
import { ElCheckbox, ElResizeSeparator } from '../../element-plus'

import type { ComponentPublicInstance } from 'vue'

defineProps<{ boundary?: boolean }>()

const orientations = ['vertical', 'horizontal'] as const
type Orientation = (typeof orientations)[number]
type Elements = Partial<Record<Orientation, HTMLElement>>
const frames: Elements = {}
const handles: Elements = {}
const id = useId()
const disabled = ref(false)
const values = reactive({ vertical: 0.5, horizontal: 0.5 })
const ranges = reactive({
  vertical: { start: 0, end: 0 },
  horizontal: { start: 0, end: 0 },
})
const regionId = (orientation: Orientation, region: string) =>
  `resize-audit-${id}-${orientation}-${region}`
const setElement = (
  elements: Elements,
  orientation: Orientation,
  element: Element | ComponentPublicInstance | null,
) => {
  if (element instanceof HTMLElement) elements[orientation] = element
  else delete elements[orientation]
}
const tracks = (orientation: Orientation) => ({
  [orientation === 'vertical' ? 'gridTemplateColumns' : 'gridTemplateRows']:
    `minmax(0, ${values[orientation]}fr) var(--fsus-icon-target) minmax(0, ${1 - values[orientation]}fr)`,
})
const refresh = () => {
  for (const orientation of orientations) {
    const frame = frames[orientation]?.getBoundingClientRect()
    const handle = handles[orientation]?.getBoundingClientRect()
    const vertical = orientation === 'vertical'
    const extent = frame ? (vertical ? frame.width : frame.height) : 0
    const handleExtent = handle ? (vertical ? handle.width : handle.height) : 0
    const origin = frame ? (vertical ? frame.left : frame.top) : 0
    const available = extent - handleExtent
    const valid =
      Number.isFinite(origin) &&
      Number.isFinite(available) &&
      available > 0 &&
      handleExtent > 0
    // Map min/max to the real handle centre in this fixture's own frame.
    // Mutate the same range so capture-phase refresh precedes handle admission.
    ranges[orientation].start = valid
      ? origin + available * 0.2 + handleExtent / 2
      : 0
    ranges[orientation].end = valid
      ? origin + available * 0.8 + handleExtent / 2
      : 0
  }
}
let observer: ResizeObserver | undefined
onMounted(() => {
  refresh()
  observer = new ResizeObserver(refresh)
  for (const frame of Object.values(frames)) observer.observe(frame)
  window.addEventListener('resize', refresh)
  window.addEventListener('scroll', refresh, true)
})
onBeforeUnmount(() => {
  observer?.disconnect()
  window.removeEventListener('resize', refresh)
  window.removeEventListener('scroll', refresh, true)
})
</script>

<style scoped>
.resize-separator-audit {
  display: grid;
  gap: var(--fsus-space-2);
  min-inline-size: 0;
}

.resize-separator-audit__frame {
  display: grid;
  min-inline-size: 0;
  block-size: calc(var(--fsus-icon-target) * 3);
}

.resize-separator-audit__frame.is-horizontal {
  block-size: calc(var(--fsus-icon-target) * 4);
}

.resize-separator-audit__frame > section {
  min-inline-size: 0;
  min-block-size: 0;
  overflow: auto;
  overflow-wrap: anywhere;
}

.resize-separator-audit__handle {
  display: grid;
  min-inline-size: 0;
  min-block-size: 0;
}
</style>
