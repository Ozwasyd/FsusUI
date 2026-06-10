<template>
  <div
    ref="rootEl"
    :class="[
      markdownSurfaceClasses.root,
      markdownSurfaceClasses.body,
      {
        'is-rendering': isRendering,
        'is-rendering-empty': showInitialLoading,
      },
    ]"
    role="article"
    aria-live="polite"
    :aria-busy="isRendering ? 'true' : 'false'"
    v-bind="rootRenderAttrs"
  >
    <div
      v-if="showInitialLoading"
      class="markdown-renderer__loading"
      v-bind="loadingAttrs"
      role="status"
    >
      <span class="markdown-renderer__loading-spinner" aria-hidden="true" />
      <span class="markdown-renderer__loading-text">Rendering markdown...</span>
      <span
        v-for="index in 4"
        :key="index"
        class="markdown-renderer__loading-line"
        aria-hidden="true"
      />
    </div>
    <template v-if="isChunkedRender">
      <div
        class="markdown-renderer__virtual-spacer"
        v-bind="topSpacerAttrs"
        :style="{ height: `${virtualWindow.topSpacer.value}px` }"
      />
      <div
        v-for="(item, visibleIndex) in virtualWindow.visibleItems.value"
        :key="item.key"
        :ref="(element) => setChunkUnitTemplateRef(item.key, element)"
        class="markdown-renderer__virtual-unit"
        v-bind="getChunkUnitAttrs(item, visibleIndex)"
        v-html="item.unit.html"
      />
      <div
        class="markdown-renderer__virtual-spacer"
        v-bind="bottomSpacerAttrs"
        :style="{ height: `${virtualWindow.bottomSpacer.value}px` }"
      />
    </template>
    <div v-else v-html="renderedContent" />
    <span
      v-if="showInlineLoading"
      class="markdown-renderer__loading-pulse"
      v-bind="loadingPulseAttrs"
      aria-hidden="true"
    />
  </div>
</template>

<script lang="ts" setup>
import {
  computed,
  nextTick,
  onBeforeUnmount,
  ref,
  shallowRef,
  watch,
} from 'vue'
import { useGlobalConfig } from '@element-plus/components/config-provider'
import {
  resolveFsusRenderPipelineUnitAttrs,
  useFsusRenderPipelineRuntime,
  useFsusRenderScheduler,
  useFsusVirtualWindow,
} from '@element-plus/hooks'
import {
  MARKDOWN_RENDERER_SURFACE_CLASSES as markdownSurfaceClasses,
  activateMarkdownFeatures,
  buildMarkdownRenderResult,
  defaultCodeHighlightAdapter,
  defaultLatexAdapter,
  defaultMermaidAdapter,
  escapeMarkdownHtml,
  normalizeMarkdownSource,
  renderMarkdownChunksWithRuntime,
  renderMarkdownHtmlWithRuntime,
  renderMarkdownResultWithRuntime,
} from '@element-plus/wasm'
import { isFsusErr, toFsusError } from '@element-plus/utils'
import { markdownRendererProps } from './markdown-renderer'
import {
  getMarkdownRendererRuntimeCache,
  setMarkdownRendererRuntimeCache,
} from './markdown-renderer-cache'
import {
  sanitizeMarkdownChunk,
  sanitizeMarkdownHtml,
  sanitizeMarkdownHtmlResult,
  sanitizeMarkdownRenderResult,
} from './markdown-sanitize'

import type { FsusRenderPipelineAdapter } from '@element-plus/hooks'
import type { FsusErrorDetail } from '@element-plus/utils'
import type {
  MarkdownRenderResult,
  MarkdownRenderChunk,
  MarkdownRenderRequest,
  MarkdownFeatureActivationResult,
  MarkdownRuntimeChunkResult,
  MarkdownRuntimeHtmlResult,
  MarkdownRuntimeProfile,
  MarkdownRuntimeRenderResult,
} from '@element-plus/wasm'
import type { ComponentPublicInstance } from 'vue'

defineOptions({
  name: 'ElMarkdownRenderer',
})

const props = defineProps(markdownRendererProps)
const emit = defineEmits<{
  (event: 'render-complete', result: MarkdownRenderResult): void
  (event: 'render-error', error: FsusErrorDetail): void
  (
    event: 'placeholders-ready',
    placeholders: MarkdownRenderResult['placeholders'],
    result: MarkdownRenderResult,
  ): void
  (
    event: 'features-activated',
    activation: MarkdownFeatureActivationResult,
    result: MarkdownRenderResult,
  ): void
  (event: 'render-profile', profile: MarkdownRuntimeProfile): void
}>()

const rootEl = ref<HTMLElement | null>(null)
const rootAttrs = {
  'data-markdown-renderer': 'wasm',
}
const resolveMarkdownHtml = (html: string) =>
  props.sanitizeHtml ? sanitizeMarkdownHtml(html) : html
const renderedContent = shallowRef(
  props.initialHtml.trim() ? resolveMarkdownHtml(props.initialHtml) : '',
)
const chunkUnits = shallowRef<readonly MarkdownRenderChunk[]>([])
const MIN_INITIAL_MARKDOWN_CHUNKS = 3
const MAX_INITIAL_MARKDOWN_CHUNKS = 12
const renderPipelineConfig = useGlobalConfig('renderPipeline')
const renderStrategy = shallowRef<'sync' | 'chunked-main' | 'chunked-worker'>(
  'sync',
)
const isRendering = shallowRef(false)
const isChunkedRender = computed(() => chunkUnits.value.length > 0)
const initialVisibleChunkCount = computed(() => {
  const firstSectionHeadingIndex = chunkUnits.value.findIndex(
    (unit, index) => index > 0 && unit.kind === 'heading',
  )
  if (firstSectionHeadingIndex < 0) return MIN_INITIAL_MARKDOWN_CHUNKS

  return Math.min(
    MAX_INITIAL_MARKDOWN_CHUNKS,
    Math.max(MIN_INITIAL_MARKDOWN_CHUNKS, firstSectionHeadingIndex + 1),
  )
})
const hasRenderedOutput = computed(
  () => isChunkedRender.value || renderedContent.value.trim().length > 0,
)
const showInitialLoading = computed(
  () => isRendering.value && !hasRenderedOutput.value,
)
const showInlineLoading = computed(
  () => isRendering.value && hasRenderedOutput.value,
)
const strategyAttrs = computed(() => ({
  'data-fsus-render-strategy': renderStrategy.value,
}))
const rootRenderAttrs = computed(() => ({
  ...rootAttrs,
  ...strategyAttrs.value,
  ...renderPipelineRuntime.hardwareAttrs.value,
}))
const loadingAttrs = { 'data-markdown-renderer-loading': 'true' }
const loadingPulseAttrs = { 'data-markdown-renderer-loading-pulse': 'true' }
const topSpacerAttrs = { 'data-fsus-render-spacer': 'top' }
const bottomSpacerAttrs = { 'data-fsus-render-spacer': 'bottom' }
const getChunkUnitAttrs = (
  item: {
    index: number
    key: string
    unit: MarkdownRenderChunk
  },
  visibleIndex = 0,
) => {
  return {
    ...resolveFsusRenderPipelineUnitAttrs({
      baseAttrs: renderPipelineRuntime.hardwareAttrs.value,
      layerBudget: resolvedRenderPipelineConfig.value.acceleration.layerBudget,
      unitIndex: visibleIndex,
    }),
    'data-fsus-render-unit': '',
    'data-fsus-render-unit-key': item.key,
    'data-fsus-render-unit-index': item.index,
    'data-fsus-render-unit-kind': item.unit.kind,
    'data-fsus-render-html-start': item.unit.htmlStartOffset,
    'data-fsus-render-html-end': item.unit.htmlEndOffset,
  }
}

let currentTaskId = 0
let debounceTimer: ReturnType<typeof setTimeout> | null = null
let measurementWarmupCancel: (() => void) | null = null

type RenderAnchor = {
  htmlEndOffset?: number
  htmlStartOffset?: number
  path: number[]
  offset: number
  scrollContainer: HTMLElement
  unitKey?: string
}

const anchorCandidateSelector = [
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'p',
  'li',
  'pre',
  'table',
  'blockquote',
  `.${markdownSurfaceClasses.paragraph}`,
  `.${markdownSurfaceClasses.text}`,
  `.${markdownSurfaceClasses.listItem}`,
  `.${markdownSurfaceClasses.mermaid}`,
  `.${markdownSurfaceClasses.latex}`,
].join(',')

const afterFrame = () =>
  new Promise<void>((resolve) => {
    if (typeof requestAnimationFrame !== 'function') {
      resolve()
      return
    }

    requestAnimationFrame(() => resolve())
  })

const findScrollContainer = (element: HTMLElement | null) => {
  let current = element?.parentElement ?? null

  while (current) {
    const style = window.getComputedStyle(current)
    const scrollableY = /(auto|scroll|overlay)/.test(style.overflowY)
    if (scrollableY) {
      return current
    }
    current = current.parentElement
  }

  return document.scrollingElement instanceof HTMLElement
    ? document.scrollingElement
    : document.documentElement
}

const getElementPath = (root: HTMLElement, target: HTMLElement) => {
  const path: number[] = []
  let current: HTMLElement | null = target

  while (current && current !== root) {
    const parent: HTMLElement | null = current.parentElement
    if (!parent) return []
    path.unshift(Array.prototype.indexOf.call(parent.children, current))
    current = parent
  }

  return current === root ? path : []
}

const resolveElementPath = (root: HTMLElement, path: number[]) => {
  let current: Element = root

  for (const index of path) {
    const next = current.children[index]
    if (!(next instanceof HTMLElement)) return null
    current = next
  }

  return current instanceof HTMLElement ? current : null
}

const escapeCssAttributeValue = (value: string) =>
  typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
    ? CSS.escape(value)
    : value.replace(/["\\]/g, '\\$&')

const captureRenderAnchor = (): RenderAnchor | null => {
  const root = rootEl.value
  if (!root) return null

  const scrollContainer = findScrollContainer(root)
  if (scrollContainer.scrollTop <= 0) return null

  const containerRect = scrollContainer.getBoundingClientRect()
  const candidates = Array.from(
    root.querySelectorAll<HTMLElement>(anchorCandidateSelector),
  )

  const anchor =
    candidates.find((candidate) => {
      const rect = candidate.getBoundingClientRect()
      return (
        rect.bottom >= containerRect.top && rect.top <= containerRect.top + 32
      )
    }) ??
    candidates.find(
      (candidate) => candidate.getBoundingClientRect().top >= containerRect.top,
    )

  if (!anchor) return null

  const path = getElementPath(root, anchor)
  if (!path.length) return null

  return {
    htmlEndOffset:
      Number(
        anchor
          .closest('.markdown-renderer__virtual-unit')
          ?.getAttribute('data-fsus-render-html-end'),
      ) || undefined,
    htmlStartOffset:
      Number(
        anchor
          .closest('.markdown-renderer__virtual-unit')
          ?.getAttribute('data-fsus-render-html-start'),
      ) || undefined,
    path,
    offset: anchor.getBoundingClientRect().top - containerRect.top,
    scrollContainer,
    unitKey:
      anchor
        .closest('.markdown-renderer__virtual-unit')
        ?.getAttribute('data-fsus-render-unit-key') ?? undefined,
  }
}

const restoreRenderAnchor = async (anchor: RenderAnchor | null) => {
  if (!anchor) return

  await nextTick()
  await afterFrame()

  const root = rootEl.value
  if (!root || !document.contains(anchor.scrollContainer)) return

  const nextAnchor =
    (anchor.unitKey
      ? root.querySelector(
          `.markdown-renderer__virtual-unit[data-fsus-render-unit-key="${escapeCssAttributeValue(anchor.unitKey)}"]`,
        )
      : null) ?? resolveElementPath(root, anchor.path)
  if (!nextAnchor) return

  const containerTop = anchor.scrollContainer.getBoundingClientRect().top
  const nextOffset = nextAnchor.getBoundingClientRect().top - containerTop
  const delta = nextOffset - anchor.offset

  if (Math.abs(delta) > 0.5) {
    anchor.scrollContainer.scrollTop += delta
  }
}

const commitRenderedContent = async (html: string, preserveAnchor = false) => {
  if (renderedContent.value === html) return false

  const anchor = preserveAnchor ? captureRenderAnchor() : null
  chunkUnits.value = []
  renderStrategy.value = 'sync'
  renderedContent.value = html
  await restoreRenderAnchor(anchor)
  return true
}

const virtualWindow = useFsusVirtualWindow<MarkdownRenderChunk>({
  estimateSize: (unit) => unit.estimatedSize,
  getKey: (unit) => unit.key,
  getViewport: () => findScrollContainer(rootEl.value),
  measureBatch: computed(
    () => resolvedRenderPipelineConfig.value.budget.measureBatch,
  ),
  minVisibleItems: initialVisibleChunkCount,
  overscanPx: computed(
    () => resolvedRenderPipelineConfig.value.budget.overscanPx,
  ),
  units: chunkUnits,
})

const setChunkUnitRef = (key: string, element: Element | null) => {
  virtualWindow.setUnitRef(key, element)
}

const setChunkUnitTemplateRef = (
  key: string,
  element: Element | ComponentPublicInstance | null,
) => {
  setChunkUnitRef(key, element instanceof Element ? element : null)
}

const estimateMarkdownRender = (source: string) => ({
  htmlBytes: source.length * 2,
  items: Math.max(1, source.split('\n\n').length),
  nodes: Math.max(1, Math.ceil(source.length / 180)),
})

const createMarkdownRenderRequest = (
  source: string,
): MarkdownRenderRequest => ({
  source,
  baseUrl: props.baseUrl,
  mode: props.mode,
  allowHtml: props.allowHtml,
  allowLatex: props.allowLatex,
  allowMermaid: props.allowMermaid,
})

const fingerprintMarkdownRenderRequest = (request: MarkdownRenderRequest) =>
  [
    request.source,
    request.baseUrl ?? '',
    request.mode,
    request.allowHtml ? 'html' : 'no-html',
    request.allowLatex ? 'latex' : 'no-latex',
    request.allowMermaid ? 'mermaid' : 'no-mermaid',
  ].join('\u0000')

const resolveMarkdownHtmlResult = (result: MarkdownRuntimeHtmlResult) =>
  props.sanitizeHtml ? sanitizeMarkdownHtmlResult(result) : result

const resolveMarkdownRenderResult = <
  TResult extends MarkdownRuntimeChunkResult | MarkdownRuntimeRenderResult,
>(
  result: TResult,
) => (props.sanitizeHtml ? sanitizeMarkdownRenderResult(result) : result)

const canUseMarkdownWorker = () =>
  typeof Worker !== 'undefined' && typeof URL !== 'undefined'

const createMarkdownRendererWorker = () =>
  new Worker(new URL('./markdown-renderer.worker.ts', import.meta.url), {
    type: 'module',
  })

const markdownRenderPipelineAdapter: FsusRenderPipelineAdapter<
  MarkdownRenderRequest,
  MarkdownRenderChunk
> = {
  id: 'markdown-renderer',
  canUseWorker: () => canUseMarkdownWorker(),
  estimate: (request) => estimateMarkdownRender(request.source),
  estimateSize: (unit) => unit.estimatedSize,
  fingerprint: fingerprintMarkdownRenderRequest,
  keyOf: (unit) => unit.key,
  prepare: async (request, signal, strategy) => {
    if (strategy !== 'chunked-main' && strategy !== 'chunked-worker') {
      return { units: [] }
    }

    const cacheKey = fingerprintMarkdownRenderRequest(request)
    const cached = getMarkdownRendererRuntimeCache<MarkdownRuntimeChunkResult>(
      'chunks',
      cacheKey,
    )
    if (cached) {
      return {
        metadata: cached,
        units: cached.chunks,
      }
    }

    const result = await renderMarkdownChunksWithRuntime(request)
    if (signal.aborted) {
      throw new DOMException('Aborted', 'AbortError')
    }
    if (isFsusErr(result)) {
      throw result.error
    }

    setMarkdownRendererRuntimeCache('chunks', cacheKey, result.value)
    return {
      metadata: result.value,
      units: result.value.chunks,
    }
  },
  worker: {
    createWorker: createMarkdownRendererWorker,
    idleTerminateMs: 30_000,
    name: 'fsus-markdown-renderer',
    pool: 'shared',
    poolKey: 'fsus-markdown-renderer',
    requestTimeoutMs: 60_000,
  },
}

const markdownRenderRequest = computed(() =>
  createMarkdownRenderRequest(normalizeMarkdownSource(props.content)),
)

const renderPipelineRuntime = useFsusRenderPipelineRuntime<
  MarkdownRenderRequest,
  MarkdownRenderChunk
>({
  adapter: markdownRenderPipelineAdapter,
  componentName: 'ElMarkdownRenderer',
  config: renderPipelineConfig,
  source: markdownRenderRequest,
})

const resolvedRenderPipelineConfig = renderPipelineRuntime.config
const renderScheduler = useFsusRenderScheduler(
  computed(() => resolvedRenderPipelineConfig.value.budget),
)

const renderMarkdownHtmlCached = async (request: MarkdownRenderRequest) => {
  const cacheKey = fingerprintMarkdownRenderRequest(request)
  const cached = getMarkdownRendererRuntimeCache<MarkdownRuntimeHtmlResult>(
    'html',
    cacheKey,
  )
  if (cached) return { ok: true as const, value: cached }

  const result = await renderMarkdownHtmlWithRuntime(request)
  if (!isFsusErr(result)) {
    setMarkdownRendererRuntimeCache('html', cacheKey, result.value)
  }
  return result
}

const renderMarkdownResultCached = async (request: MarkdownRenderRequest) => {
  const cacheKey = fingerprintMarkdownRenderRequest(request)
  const cached = getMarkdownRendererRuntimeCache<MarkdownRuntimeRenderResult>(
    'result',
    cacheKey,
  )
  if (cached) return { ok: true as const, value: cached }

  const result = await renderMarkdownResultWithRuntime(request)
  if (!isFsusErr(result)) {
    setMarkdownRendererRuntimeCache('result', cacheKey, result.value)
  }
  return result
}

const scheduleMeasurementWarmup = () => {
  measurementWarmupCancel?.()
  measurementWarmupCancel = renderScheduler.schedule(
    () => {
      virtualWindow.readViewport()
      measurementWarmupCancel = null
    },
    { priority: 'background' },
  )
}

const buildFallbackResult = (source: string): MarkdownRenderResult =>
  buildMarkdownRenderResult({
    html: [
      `<div class="${markdownSurfaceClasses.error}">`,
      '<p>Markdown 渲染失败，已回退为安全文本。</p>',
      `<pre><code>${escapeMarkdownHtml(source)}</code></pre>`,
      '</div>',
    ].join(''),
    source,
  })

const resolveMarkdownFeatureOptions = () => ({
  codeHighlight: props.features?.codeHighlight ?? true,
  cspNonce: props.features?.cspNonce ?? true,
  externalLink: props.features?.externalLink ?? true,
  hashLink: props.features?.hashLink ?? true,
  headingSlug: props.features?.headingSlug ?? true,
  latex: props.features?.latex ?? props.allowLatex,
  mermaid: props.features?.mermaid ?? props.allowMermaid,
})

const resolveMarkdownFeatureAdapter = <TAdapter,>(
  adapter: TAdapter | null | undefined,
  defaultAdapter: TAdapter,
) => (adapter === undefined ? defaultAdapter : adapter)

const activateRenderedFeatures = async (result: MarkdownRenderResult) => {
  await nextTick()

  const root = rootEl.value
  if (!root) return

  const activation = await activateMarkdownFeatures({
    baseUrl: props.baseUrl,
    codeHighlightAdapter: resolveMarkdownFeatureAdapter(
      props.codeHighlightAdapter,
      defaultCodeHighlightAdapter,
    ),
    cspNonce: props.cspNonce,
    features: resolveMarkdownFeatureOptions(),
    latexAdapter: resolveMarkdownFeatureAdapter(
      props.latexAdapter,
      defaultLatexAdapter,
    ),
    mermaidAdapter: resolveMarkdownFeatureAdapter(
      props.mermaidAdapter,
      defaultMermaidAdapter,
    ),
    root,
  })
  emit('features-activated', activation, result)
}

const performRender = async () => {
  const taskId = ++currentTaskId
  const source = normalizeMarkdownSource(props.content)
  const request = createMarkdownRenderRequest(source)
  isRendering.value = source.length > 0

  try {
    const strategy = renderPipelineRuntime.strategy.value

    if (strategy === 'chunked-main' || strategy === 'chunked-worker') {
      await renderPipelineRuntime.render()

      if (taskId !== currentTaskId) {
        return
      }

      if (renderPipelineRuntime.error.value) {
        throw renderPipelineRuntime.error.value
      }

      const document = renderPipelineRuntime.document.value
      const result = document?.metadata as
        | MarkdownRuntimeChunkResult
        | undefined

      if (!document || !result || document.units.length === 0) {
        throw toFsusError(
          'markdown_wasm_chunks_unavailable',
          'markdown_wasm_chunks_unavailable',
          'infra',
        )
      }

      const resolvedResult = resolveMarkdownRenderResult(result)
      const resolvedUnits = props.sanitizeHtml
        ? document.units.map(sanitizeMarkdownChunk)
        : document.units

      renderedContent.value = ''
      chunkUnits.value = resolvedUnits
      renderStrategy.value =
        renderPipelineRuntime.renderedStrategy.value === 'chunked-worker'
          ? 'chunked-worker'
          : 'chunked-main'
      emit('render-profile', {
        engine: resolvedResult.engine,
        phase: 'chunks',
        rendererVersion: resolvedResult.rendererVersion,
        timings: resolvedResult.timings,
      })
      emit('placeholders-ready', resolvedResult.placeholders, resolvedResult)
      await nextTick()
      virtualWindow.readViewport()
      await activateRenderedFeatures(resolvedResult)
      emit('render-complete', resolvedResult)
      scheduleMeasurementWarmup()
      return
    }

    const htmlResult = await renderMarkdownHtmlCached(request)

    if (taskId !== currentTaskId) {
      return
    }

    if (isFsusErr(htmlResult)) {
      throw htmlResult.error
    }

    const resolvedHtmlResult = resolveMarkdownHtmlResult(htmlResult.value)

    await commitRenderedContent(resolvedHtmlResult.html)
    emit('render-profile', {
      engine: resolvedHtmlResult.engine,
      phase: 'html-only',
      rendererVersion: resolvedHtmlResult.rendererVersion,
      timings: resolvedHtmlResult.timings,
    })

    const result = await renderMarkdownResultCached(request)

    if (taskId !== currentTaskId) {
      return
    }

    if (isFsusErr(result)) {
      throw result.error
    }

    const resolvedResult = resolveMarkdownRenderResult(result.value)

    await commitRenderedContent(resolvedResult.html, true)
    await activateRenderedFeatures(resolvedResult)
    emit('render-profile', {
      engine: resolvedResult.engine,
      phase: 'full-result',
      rendererVersion: resolvedResult.rendererVersion,
      timings: resolvedResult.timings,
    })
    emit('placeholders-ready', resolvedResult.placeholders, resolvedResult)
    emit('render-complete', resolvedResult)
  } catch (error) {
    if (taskId !== currentTaskId) {
      return
    }

    const fallback = buildFallbackResult(source)
    await commitRenderedContent(fallback.html, true)
    await activateRenderedFeatures(fallback)
    emit(
      'render-error',
      toFsusError(error, 'markdown_renderer_render_failed', 'infra'),
    )
    emit('placeholders-ready', fallback.placeholders, fallback)
    emit('render-complete', fallback)
  } finally {
    if (taskId === currentTaskId) {
      isRendering.value = false
    }
  }
}

watch(
  () => [
    props.content,
    props.allowHtml,
    props.sanitizeHtml,
    props.allowLatex,
    props.allowMermaid,
    props.mode,
    props.baseUrl,
    props.cspNonce,
    props.features,
    props.mermaidAdapter,
    props.latexAdapter,
    props.codeHighlightAdapter,
  ],
  () => {
    if (debounceTimer) {
      clearTimeout(debounceTimer)
    }
    debounceTimer = setTimeout(() => {
      void performRender()
    }, 16)
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }
  measurementWarmupCancel?.()
  measurementWarmupCancel = null
  currentTaskId += 1
  isRendering.value = false
})

defineExpose({
  rootEl,
})
</script>
