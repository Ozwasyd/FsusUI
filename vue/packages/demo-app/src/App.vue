<template>
  <div class="demo-app-container">
    <div v-if="isDefaultGallery" class="demo-nav">
      <h1>FsusUI 组件预览</h1>
      <p class="demo-version">v2.2-STABLE</p>
      <div class="demo-nav-tabs" aria-label="Demo sections">
        <span
          class="demo-nav-active-pill"
          :style="activeNavPillStyle"
          aria-hidden="true"
        />
        <button
          v-for="section in demoSections"
          :key="section.id"
          :ref="(element) => setNavButtonElement(section.id, element)"
          class="demo-nav-tab"
          :class="{ 'is-active': activeSectionId === section.id }"
          type="button"
          :aria-current="activeSectionId === section.id ? 'true' : undefined"
          @click="scrollTo(section.id)"
        >
          {{ section.label }}
        </button>
        <button
          class="demo-nav-tab"
          type="button"
          @click="openMarkdownStress"
        >
          Markdown Stress
        </button>
      </div>
    </div>

    <section
      v-if="isDefaultGallery"
      ref="virtualShell"
      class="demo-virtual-shell"
      data-testid="demo-virtual-home"
      :style="{ height: `${totalVirtualHeight}px` }"
    >
      <div
        v-for="item in visibleVirtualSections"
        :key="item.section.id"
        :ref="(element) => setSectionElement(item.index, element)"
        class="demo-virtual-section"
        v-bind="{ 'data-demo-virtual-section': item.section.id }"
        :style="{ transform: `translate3d(0, ${item.top}px, 0)` }"
      >
        <component :is="item.section.component" />
      </div>
    </section>

    <Transition name="demo-section-fade" mode="out-in">
      <component
        :is="routeSection.component"
        v-if="routeSection"
        :key="props.mode"
        :compact="props.compact"
        :nav-mode="props.navMode"
        :search-mode="props.searchMode"
        :csp-safe="props.cspSafe"
      />
    </Transition>
  </div>
</template>

<script setup lang="ts">
import {
  computed,
  markRaw,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from 'vue'
import { initMarkdownRuntime } from '@element-plus/wasm'
import { createDemoState, provideDemoState } from './demo-state'
import BasicSection from './sections/BasicSection.vue'
import CharacterChallengeConformanceSection from './sections/CharacterChallengeConformanceSection.vue'
import DataSection from './sections/DataSection.vue'
import EmptyIllustrationSection from './sections/EmptyIllustrationSection.vue'
import FeedbackSection from './sections/FeedbackSection.vue'
import FoundationBoundarySection from './sections/FoundationBoundarySection.vue'
import FormSection from './sections/FormSection.vue'
import IconsSection from './sections/IconsSection.vue'
import IssuePrimitivesSection from './sections/IssuePrimitivesSection.vue'
import MarkdownStressSection from './sections/MarkdownStressSection.vue'
import MarkdownEditorChromeVisualSection from './sections/MarkdownEditorChromeVisualSection.vue'
import NavigationSection from './sections/NavigationSection.vue'
import OthersSection from './sections/OthersSection.vue'
import PaginationMatrixSection from './sections/PaginationMatrixSection.vue'
import PublicShellNavModeSection from './sections/PublicShellNavModeSection.vue'
import PublicShellSearchModeSection from './sections/PublicShellSearchModeSection.vue'
import SegmentedVisualSection from './sections/SegmentedVisualSection.vue'
import TransferResponsiveSection from './sections/TransferResponsiveSection.vue'
import SettingsCompositionSection from './sections/SettingsCompositionSection.vue'
import MetricCompositionSection from './sections/MetricCompositionSection.vue'
import UploadVisualSection from './sections/UploadVisualSection.vue'
import ViewTransitionSection from './sections/ViewTransitionSection.vue'

import type { ComponentPublicInstance } from 'vue'

type DemoSection = {
  id: string
  label: string
  component: object
  estimate: number
}

const props = withDefaults(
  defineProps<{
    compact?: boolean
    cspSafe?: boolean
    mode?: string
    navMode?: string
    searchMode?: string
    theme?: string
  }>(),
  {
    compact: false,
    cspSafe: false,
    mode: '',
    navMode: 'menu',
    searchMode: 'inline',
    theme: 'system',
  },
)

provideDemoState(createDemoState())

const demoSections: DemoSection[] = [
  { id: 'basic', label: 'Basic', component: markRaw(BasicSection), estimate: 1300 },
  { id: 'form', label: 'Form', component: markRaw(FormSection), estimate: 1500 },
  { id: 'data', label: 'Data', component: markRaw(DataSection), estimate: 2200 },
  {
    id: 'navigation',
    label: 'Navigation',
    component: markRaw(NavigationSection),
    estimate: 900,
  },
  {
    id: 'feedback',
    label: 'Feedback',
    component: markRaw(FeedbackSection),
    estimate: 900,
  },
  { id: 'others', label: 'Others', component: markRaw(OthersSection), estimate: 1200 },
  { id: 'icons', label: 'Icons', component: markRaw(IconsSection), estimate: 2600 },
  {
    id: 'issue-primitives',
    label: 'Issue #1',
    component: markRaw(IssuePrimitivesSection),
    estimate: 1200,
  },
]

const routeSections = new Map<string, DemoSection | { component: object }>([
  ...demoSections.map((section) => [section.id, section] as const),
  [
    'markdown-stress',
    { component: markRaw(MarkdownStressSection) },
  ],
  [
    'markdown-editor-chrome-visual',
    { component: markRaw(MarkdownEditorChromeVisualSection) },
  ],
  ['foundation-boundary', { component: markRaw(FoundationBoundarySection) }],
  [
    'empty-illustration',
    { component: markRaw(EmptyIllustrationSection) },
  ],
  [
    'public-shell-nav-mode',
    { component: markRaw(PublicShellNavModeSection) },
  ],
  [
    'public-shell-search-mode',
    { component: markRaw(PublicShellSearchModeSection) },
  ],
  ['view-transitions', { component: markRaw(ViewTransitionSection) }],
  [
    'character-challenge-conformance',
    { component: markRaw(CharacterChallengeConformanceSection) },
  ],
  [
    'transfer-responsive',
    { component: markRaw(TransferResponsiveSection) },
  ],
  ['segmented-visual', { component: markRaw(SegmentedVisualSection) }],
  ['settings-visual', { component: markRaw(SettingsCompositionSection) }],
  ['metric-visual', { component: markRaw(MetricCompositionSection) }],
  ['upload-visual', { component: markRaw(UploadVisualSection) }],
  ['pagination-matrix', { component: markRaw(PaginationMatrixSection) }],
])

const isDefaultGallery = computed(() => !props.mode)
const routeSection = computed(() => routeSections.get(props.mode || ''))
const virtualShell = ref<HTMLElement | null>(null)
const viewportTop = ref(0)
const viewportBottom = ref(900)
const overscan = ref(900)
const activeSectionId = ref(demoSections[0]?.id ?? '')
const sectionHeights = ref(demoSections.map((section) => section.estimate))
const sectionElements = new Map<number, HTMLElement>()
const observedElements = new Map<number, HTMLElement>()
const navButtonElements = new Map<string, HTMLButtonElement>()
const activeNavRect = ref({ height: 0, left: 0, top: 0, width: 0 })

let resizeObserver: ResizeObserver | null = null
let scrollFrame = 0
let navPillFrame = 0
let markdownPreheatScheduled = false

const sectionOffsets = computed(() => {
  const offsets: number[] = []
  let nextOffset = 0
  for (const height of sectionHeights.value) {
    offsets.push(nextOffset)
    nextOffset += height
  }
  return offsets
})

const totalVirtualHeight = computed(() =>
  sectionHeights.value.reduce((sum, height) => sum + height, 0),
)

const visibleVirtualSections = computed(() => {
  const top = Math.max(0, viewportTop.value - overscan.value)
  const bottom = viewportBottom.value + overscan.value

  return demoSections
    .map((section, index) => ({
      index,
      section,
      top: sectionOffsets.value[index],
      bottom: sectionOffsets.value[index] + sectionHeights.value[index],
    }))
    .filter((item) => item.bottom >= top && item.top <= bottom)
})

const activeNavPillStyle = computed(() => ({
  opacity: activeNavRect.value.width > 0 ? '1' : '0',
  height: `${activeNavRect.value.height}px`,
  transform: `translate3d(${activeNavRect.value.left}px, ${activeNavRect.value.top}px, 0)`,
  width: `${activeNavRect.value.width}px`,
}))

const getElementFromRef = (
  value: Element | ComponentPublicInstance | null,
) => {
  if (!value) return null
  if (value instanceof HTMLElement) return value
  const instance = value as ComponentPublicInstance
  return instance.$el instanceof HTMLElement ? instance.$el : null
}

const measureSection = (index: number, element: HTMLElement) => {
  const nextHeight = Math.ceil(element.getBoundingClientRect().height)
  if (nextHeight <= 0) return

  const currentHeight = sectionHeights.value[index]
  if (Math.abs(currentHeight - nextHeight) <= 1) return

  const nextHeights = sectionHeights.value.slice()
  nextHeights[index] = nextHeight
  sectionHeights.value = nextHeights
}

const measureActiveNavPill = () => {
  navPillFrame = 0
  const activeElement = navButtonElements.get(activeSectionId.value)
  const parent = activeElement?.parentElement
  if (!activeElement || !parent) {
    activeNavRect.value = { height: 0, left: 0, top: 0, width: 0 }
    return
  }

  const parentRect = parent.getBoundingClientRect()
  const activeRect = activeElement.getBoundingClientRect()
  activeNavRect.value = {
    height: activeRect.height,
    left: activeRect.left - parentRect.left,
    top: activeRect.top - parentRect.top,
    width: activeRect.width,
  }
}

const scheduleActiveNavPillMeasure = () => {
  if (navPillFrame) return
  navPillFrame = window.requestAnimationFrame(measureActiveNavPill)
}

const setNavButtonElement = (
  id: string,
  value: Element | ComponentPublicInstance | null,
) => {
  const element = getElementFromRef(value)

  if (!element) {
    navButtonElements.delete(id)
    scheduleActiveNavPillMeasure()
    return
  }

  navButtonElements.set(id, element as HTMLButtonElement)
  scheduleActiveNavPillMeasure()
}

const setSectionElement = (
  index: number,
  value: Element | ComponentPublicInstance | null,
) => {
  const element = getElementFromRef(value)
  const previous = observedElements.get(index)

  if (previous && previous !== element) {
    resizeObserver?.unobserve(previous)
    observedElements.delete(index)
  }

  if (!element) {
    sectionElements.delete(index)
    return
  }

  sectionElements.set(index, element)
  measureSection(index, element)

  if (previous !== element) {
    resizeObserver?.observe(element)
    observedElements.set(index, element)
  }
}

const updateViewport = () => {
  scrollFrame = 0
  const shell = virtualShell.value
  const shellTop = shell
    ? shell.getBoundingClientRect().top + window.scrollY
    : 0
  const top = Math.max(0, window.scrollY - shellTop)
  const height = window.innerHeight || 900
  viewportTop.value = top
  viewportBottom.value = top + height
  overscan.value = Math.max(720, height)

  const anchorTop = top + Math.min(height * 0.36, 320)
  let nextActiveId = demoSections[0]?.id ?? ''
  for (let index = 0; index < demoSections.length; index += 1) {
    if (sectionOffsets.value[index] <= anchorTop) {
      nextActiveId = demoSections[index].id
    }
  }
  activeSectionId.value = nextActiveId
}

const scheduleViewportUpdate = () => {
  if (scrollFrame) return
  scrollFrame = window.requestAnimationFrame(updateViewport)
}

const scrollTo = (id: string) => {
  const index = demoSections.findIndex((section) => section.id === id)
  if (isDefaultGallery.value && index >= 0) {
    const shell = virtualShell.value
    const shellTop = shell
      ? shell.getBoundingClientRect().top + window.scrollY
      : 0
    window.scrollTo({
      top: Math.max(0, shellTop + sectionOffsets.value[index] - 16),
      behavior: 'smooth',
    })
    return
  }

  document.getElementById(id)?.scrollIntoView({
    behavior: 'smooth',
    block: 'start',
  })
}

const openMarkdownStress = () => {
  const params = new URLSearchParams(window.location.search)
  params.set('visual', 'markdown-stress')
  params.set('theme', props.theme)
  window.location.search = params.toString()
}

const preheatMarkdownRuntime = () => {
  if (markdownPreheatScheduled) return
  markdownPreheatScheduled = true

  const run = () => {
    void initMarkdownRuntime()
  }

  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(run, { timeout: 2000 })
    return
  }

  window.setTimeout(run, 250)
}

onMounted(() => {
  resizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const index = Array.from(sectionElements.entries()).find(
        ([, element]) => element === entry.target,
      )?.[0]
      if (index !== undefined && entry.target instanceof HTMLElement) {
        measureSection(index, entry.target)
      }
    }
    scheduleViewportUpdate()
  })
  for (const [index, element] of sectionElements) {
    resizeObserver.observe(element)
    observedElements.set(index, element)
  }

  window.addEventListener('scroll', scheduleViewportUpdate, { passive: true })
  window.addEventListener('resize', scheduleViewportUpdate)
  window.addEventListener('resize', scheduleActiveNavPillMeasure)
  void nextTick(updateViewport)
  void nextTick(scheduleActiveNavPillMeasure)
  if (isDefaultGallery.value || props.mode === 'markdown-stress') {
    preheatMarkdownRuntime()
  }
})

onBeforeUnmount(() => {
  if (scrollFrame) {
    window.cancelAnimationFrame(scrollFrame)
    scrollFrame = 0
  }
  if (navPillFrame) {
    window.cancelAnimationFrame(navPillFrame)
    navPillFrame = 0
  }
  window.removeEventListener('scroll', scheduleViewportUpdate)
  window.removeEventListener('resize', scheduleViewportUpdate)
  window.removeEventListener('resize', scheduleActiveNavPillMeasure)
  resizeObserver?.disconnect()
  resizeObserver = null
})

watch(activeSectionId, () => {
  void nextTick(scheduleActiveNavPillMeasure)
})

watch(
  () => props.mode,
  () => {
    void nextTick(updateViewport)
    if (!props.mode || props.mode === 'markdown-stress') {
      preheatMarkdownRuntime()
    }
  },
)
</script>
