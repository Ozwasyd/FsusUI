<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { ElButton, ElImageViewer } from '@ozwasyd/element-plus'

const params = new URLSearchParams(window.location.search)
const initialScenario = params.get('scenario') || 'multi'
const showToolbarParam = params.get('toolbar') !== '0'
const infiniteParam = params.get('infinite') !== '0'
const customLabelsParam = params.get('customLabels') === '1'
const customAriaLabelParam = params.get('ariaLabel') || ''

const scenarios: Record<
  string,
  { urls: string[]; alts: string[]; captions: string[] }
> = {
  multi: {
    urls: ['/images/fig-1.svg', '/images/fig-2.svg', '/images/fig-3.svg'],
    alts: [
      'System topology overview diagram',
      'Empty caption figure alt text',
      'Long narrative technical figure',
    ],
    captions: [
      'Figure 1: concise overview caption.',
      '',
      Array.from(
        { length: 48 },
        (_, i) =>
          `Paragraph ${i + 1}: Extended technical description explaining telemetry pipelines, layout invariants, and error boundaries across multiple scrolling lines.`,
      ).join(' '),
    ],
  },
  single: {
    urls: ['/images/fig-1.svg'],
    alts: ['Single diagram image'],
    captions: ['Standalone single figure caption.'],
  },
  circular2: {
    urls: ['/images/fig-1.svg', '/images/fig-2.svg'],
    alts: ['First circular figure', 'Second circular figure'],
    captions: ['Circular A', 'Circular B'],
  },
  broken: {
    urls: ['/images/broken.png', '/images/fig-1.svg'],
    alts: ['Unavailable architecture diagram', 'Fallback valid diagram'],
    captions: ['Broken image caption', 'Valid image caption'],
  },
  brokenNoAlt: {
    urls: ['/images/broken.png'],
    alts: [''],
    captions: ['Broken image without custom alt'],
  },
}

const initial = scenarios[initialScenario] ?? scenarios.multi
const urlList = ref<string[]>([...initial.urls])
const altList = ref<string[]>([...initial.alts])
const captions = ref<string[]>([...initial.captions])
const activeIndex = ref(0)
const visible = ref(false)
const showToolbar = ref(showToolbarParam)
const infinite = ref(infiniteParam)
const eventLog = ref<string[]>([])

const customLabels = computed(() =>
  customLabelsParam
    ? {
        close: 'Dismiss preview',
        previous: 'Back slide',
        next: 'Forward slide',
        zoomOut: 'Shrink image',
        zoomIn: 'Enlarge image',
        toggleMode: 'Switch fit mode',
        rotateLeft: 'Turn counter-clockwise',
        rotateRight: 'Turn clockwise',
      }
    : {},
)

const currentCaption = computed(() => captions.value[activeIndex.value] ?? '')

const onPrevious = (index: number) => {
  eventLog.value.push(`previous:${index}`)
}
const onNext = (index: number) => {
  eventLog.value.push(`next:${index}`)
}
const onSwitch = (index: number) => {
  eventLog.value.push(`switch:${index}`)
}
const onRotate = (deg: number) => {
  eventLog.value.push(`rotate:${deg}`)
}
const onClose = () => {
  eventLog.value.push('close')
}

interface ContentControls {
  setActiveIndex: (index: number) => void
  replaceList: (nextUrls: string[], nextAlts: string[], nextCaptions: string[]) => void
  getEventLog: () => string[]
  clearEventLog: () => void
}

declare global {
  interface Window {
    __viewerContentControls?: ContentControls
  }
}

onMounted(() => {
  window.__viewerContentControls = {
    setActiveIndex(index: number) {
      activeIndex.value = index
    },
    replaceList(nextUrls: string[], nextAlts: string[], nextCaptions: string[]) {
      urlList.value = nextUrls
      altList.value = nextAlts
      captions.value = nextCaptions
    },
    getEventLog() {
      return [...eventLog.value]
    },
    clearEventLog() {
      eventLog.value = []
    },
  }
})

onBeforeUnmount(() => {
  delete window.__viewerContentControls
})
</script>

<template>
  <section data-testid="viewer-content-contract-section">
    <h1>ImageViewer Content &amp; Navigation Contract (#833)</h1>

    <div class="contract-toolbar">
      <ElButton data-testid="open-content-viewer-btn" @click="visible = true">
        Open content viewer
      </ElButton>
    </div>

    <div class="contract-status" data-testid="content-status">
      <div data-testid="active-index-value">{{ activeIndex }}</div>
      <div data-testid="event-log-value">{{ eventLog.join('|') }}</div>
    </div>

    <ElImageViewer
      v-model:visible="visible"
      v-model:active-index="activeIndex"
      :url-list="urlList"
      :alt-list="altList"
      :aria-label="customAriaLabelParam"
      :labels="customLabels"
      :show-toolbar="showToolbar"
      :infinite="infinite"
      hide-on-click-modal
      teleported
      @previous="onPrevious"
      @next="onNext"
      @switch="onSwitch"
      @rotate="onRotate"
      @close="onClose"
    >
      <template #caption="{ index, alt }">
        <div
          class="contract-long-caption"
          data-testid="viewer-caption-body"
          :data-caption-index="index"
          :data-caption-alt="alt"
        >
          {{ currentCaption }}
        </div>
      </template>

      <div class="contract-default-slot-badge" data-testid="viewer-default-slot">
        Slide {{ activeIndex + 1 }} / {{ urlList.length }}
      </div>
    </ElImageViewer>
  </section>
</template>
