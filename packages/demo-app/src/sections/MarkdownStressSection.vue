<template>
  <div
    id="markdown-stress"
    class="demo-section markdown-stress-section"
    data-testid="section-markdown-stress"
  >
    <h2>Markdown Stress</h2>
    <div class="demo-block">
      <h3>Raw HTML Renderer</h3>
      <div
        class="markdown-stress-metrics"
        data-testid="markdown-stress-metrics"
      >
        <span
          >status:
          <strong data-testid="markdown-stress-status">{{
            status
          }}</strong></span
        >
        <span>source: {{ stats.length.toLocaleString() }} chars</span>
        <span>lines: {{ stats.lineCount.toLocaleString() }}</span>
        <span>html: {{ htmlLength.toLocaleString() }} chars</span>
        <span>features: {{ featureCount }}</span>
        <span>placeholders: {{ placeholderCount }}</span>
        <span>engine: {{ engine }}</span>
        <span>version: {{ rendererVersion }}</span>
        <span>elapsed: {{ elapsedMs }}ms</span>
      </div>
      <div
        class="markdown-stress-timings"
        data-testid="markdown-stress-timings"
      >
        <div
          v-for="row in timingRows"
          :key="row.name"
          class="markdown-stress-timing"
        >
          <strong>{{ row.name }}</strong>
          <span>total {{ row.totalMs }}ms</span>
          <span>init {{ row.initMs }}ms</span>
          <span>render {{ row.wasmRenderMs }}ms</span>
          <span>html {{ row.readHtmlMs }}ms</span>
          <span>placeholders {{ row.readPlaceholdersMs }}ms</span>
        </div>
      </div>
      <div data-testid="markdown-stress-renderer">
        <el-scrollbar
          ref="stressScrollbar"
          class="markdown-stress-scrollbar is-heavy-dom-motion"
          height="min(70vh, 760px)"
          view-class="markdown-stress-renderer"
          always
          noresize
          @scroll="handlePreviewScroll"
        >
          <el-markdown-renderer
            class="markdown-stress-content"
            :content="componentContent"
            :allow-html="false"
            :allow-latex="true"
            :allow-mermaid="true"
            mode="article"
            @placeholders-ready="handlePlaceholdersReady"
            @render-complete="handleRenderComplete"
            @render-error="handleRenderError"
            @render-profile="handleRenderProfile"
          />
        </el-scrollbar>
      </div>
      <div
        v-if="placeholders.length"
        class="markdown-stress-placeholders"
        data-testid="markdown-stress-placeholders"
      >
        <span
          v-for="(placeholder, index) in placeholders.slice(0, 8)"
          :key="`${placeholder.kind}-${placeholder.token}-${index}`"
        >
          {{ placeholder.kind }}:{{ placeholder.label }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, shallowRef } from 'vue'
import {
  MARKDOWN_RENDERER_VERSION,
  initMarkdownRuntime,
  renderMarkdownHtmlWithRuntime,
  renderMarkdownResultWithRuntime,
  renderMarkdownSummaryWithRuntime,
  type MarkdownRenderPlaceholder,
  type MarkdownRenderResult,
  type MarkdownRenderTimings,
  type MarkdownRuntimeKind,
  type MarkdownRuntimeProfile,
} from '@element-plus/wasm'
import { isFsusErr } from '@element-plus/utils'
import {
  buildMarkdownStressCorpus,
  describeMarkdownStressCorpus,
} from '../markdown-stress-corpus'

const content = buildMarkdownStressCorpus()
const stats = describeMarkdownStressCorpus(content)
const status = shallowRef<'rendering' | 'complete' | 'error'>('rendering')
const htmlLength = shallowRef(0)
const featureCount = shallowRef(0)
const placeholderCount = shallowRef(0)
const engine = shallowRef<MarkdownRuntimeKind | 'pending'>('pending')
const rendererVersion = shallowRef(MARKDOWN_RENDERER_VERSION)
const elapsedMs = shallowRef(0)
const placeholders = shallowRef<readonly MarkdownRenderPlaceholder[]>([])
const componentContent = shallowRef('')
const stressScrollbar = shallowRef<{ update: () => void } | null>(null)
const timingRows = shallowRef<
  Array<
    MarkdownRenderTimings & {
      name: string
    }
  >
>([])

let renderStartedAt = 0
let refreshFrame = 0
let previousDebugScrollTop = 0
let previousDebugSection = 0
const debugScroll =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('debugScroll') === '1'
const renderPhase = shallowRef('idle')

const request = {
  source: content,
  allowHtml: false,
  allowLatex: true,
  allowMermaid: true,
  mode: 'article' as const,
}

onMounted(() => {
  renderStartedAt = performance.now()
  componentContent.value = content
  refreshStressScrollbar()
  void runStressProfile()
})

onBeforeUnmount(() => {
  if (refreshFrame) {
    window.cancelAnimationFrame(refreshFrame)
    refreshFrame = 0
  }
})

const markElapsed = () => {
  elapsedMs.value = Math.max(0, Math.round(performance.now() - renderStartedAt))
}

const refreshStressScrollbar = () => {
  if (refreshFrame) return

  refreshFrame = window.requestAnimationFrame(() => {
    refreshFrame = 0
    void nextTick(() => {
      stressScrollbar.value?.update()
    })
  })
}

const handlePlaceholdersReady = (
  nextPlaceholders: readonly MarkdownRenderPlaceholder[],
) => {
  if (componentContent.value !== content) return
  placeholders.value = nextPlaceholders
  placeholderCount.value = nextPlaceholders.length
}

const pushTiming = (name: string, timings: MarkdownRenderTimings) => {
  timingRows.value = [...timingRows.value, { name, ...timings }]
}

const runStressProfile = async () => {
  status.value = 'rendering'
  try {
    const preheatStartedAt = performance.now()
    const runtimeEngine = await initMarkdownRuntime()
    if (isFsusErr(runtimeEngine)) throw runtimeEngine.error
    engine.value = runtimeEngine.value
    pushTiming('preheat', {
      initMs: Math.round((performance.now() - preheatStartedAt) * 100) / 100,
      encodeMs: 0,
      wasmRenderMs: 0,
      readHtmlMs: 0,
      readFeaturesMs: 0,
      readPlaceholdersMs: 0,
      readMetadataMs: 0,
      totalMs: Math.round((performance.now() - preheatStartedAt) * 100) / 100,
    })

    const htmlOnly = await renderMarkdownHtmlWithRuntime(request)
    if (isFsusErr(htmlOnly)) throw htmlOnly.error
    htmlLength.value = htmlOnly.value.html.length
    rendererVersion.value =
      htmlOnly.value.rendererVersion || MARKDOWN_RENDERER_VERSION
    engine.value = htmlOnly.value.engine
    pushTiming('html-only', htmlOnly.value.timings)

    const warmHtmlOnly = await renderMarkdownHtmlWithRuntime(request)
    if (isFsusErr(warmHtmlOnly)) throw warmHtmlOnly.error
    pushTiming('html-only-warm', warmHtmlOnly.value.timings)

    const summary = await renderMarkdownSummaryWithRuntime(request)
    if (isFsusErr(summary)) throw summary.error
    htmlLength.value = summary.value.html.length
    featureCount.value = summary.value.features.length
    placeholderCount.value = summary.value.metadata.placeholderCount
    rendererVersion.value =
      summary.value.rendererVersion || MARKDOWN_RENDERER_VERSION
    engine.value = summary.value.engine
    pushTiming('summary', summary.value.timings)

    const full = await renderMarkdownResultWithRuntime(request)
    if (isFsusErr(full)) throw full.error
    htmlLength.value = full.value.html.length
    featureCount.value = full.value.features.length
    placeholderCount.value = full.value.placeholders.length
    rendererVersion.value =
      full.value.rendererVersion || MARKDOWN_RENDERER_VERSION
    engine.value = full.value.engine
    placeholders.value = full.value.placeholders
    pushTiming('full-result', full.value.timings)
    markElapsed()
    refreshStressScrollbar()
  } catch {
    handleRenderError()
  }
}

const handleRenderComplete = (result: MarkdownRenderResult) => {
  if (componentContent.value !== content) return
  status.value = 'complete'
  htmlLength.value = result.html.length
  featureCount.value = result.features.length
  placeholderCount.value = result.placeholders.length
  rendererVersion.value = result.rendererVersion || MARKDOWN_RENDERER_VERSION
  placeholders.value = result.placeholders
  markElapsed()
  refreshStressScrollbar()
}

const handleRenderError = () => {
  status.value = 'error'
  markElapsed()
}

const handleRenderProfile = (profile: MarkdownRuntimeProfile) => {
  if (componentContent.value !== content) return
  renderPhase.value = profile.phase
  engine.value = profile.engine
  rendererVersion.value = profile.rendererVersion || MARKDOWN_RENDERER_VERSION
  pushTiming(`component-${profile.phase}`, profile.timings)
}

const readVisibleStressSection = () => {
  const wrap = document.querySelector<HTMLElement>(
    '.markdown-stress-scrollbar .el-scrollbar__wrap',
  )
  const renderer = document.querySelector<HTMLElement>(
    '.markdown-stress-renderer',
  )
  if (!wrap || !renderer) return 0

  const wrapRect = wrap.getBoundingClientRect()
  const headings = Array.from(
    renderer.querySelectorAll<HTMLElement>('h1,h2,h3'),
  )
  let visibleSection = 0
  let bestTop = Number.NEGATIVE_INFINITY

  for (const heading of headings) {
    const rect = heading.getBoundingClientRect()
    if (rect.top <= wrapRect.top + 32 && rect.top > bestTop) {
      bestTop = rect.top
      visibleSection =
        Number.parseInt(
          /Stress Section\s+(\d+)/.exec(heading.textContent || '')?.[1] || '0',
          10,
        ) || 0
    }
  }

  return visibleSection
}

const handlePreviewScroll = ({
  scrollTop,
}: {
  scrollTop: number
  scrollLeft: number
}) => {
  if (!debugScroll) return

  const wrap = document.querySelector<HTMLElement>(
    '.markdown-stress-scrollbar .el-scrollbar__wrap',
  )
  const visibleSection = readVisibleStressSection()
  const payload = {
    scrollTop,
    scrollHeight: wrap?.scrollHeight ?? 0,
    clientHeight: wrap?.clientHeight ?? 0,
    visibleSection,
    renderPhase: renderPhase.value,
    status: status.value,
  }

  if (
    previousDebugScrollTop &&
    scrollTop < previousDebugScrollTop - 160 &&
    visibleSection < previousDebugSection
  ) {
    console.warn('[markdown-stress-scroll-regression]', {
      previousScrollTop: previousDebugScrollTop,
      previousSection: previousDebugSection,
      ...payload,
    })
  } else {
    console.debug('[markdown-stress-scroll]', payload)
  }

  previousDebugScrollTop = scrollTop
  previousDebugSection = visibleSection
}
</script>
