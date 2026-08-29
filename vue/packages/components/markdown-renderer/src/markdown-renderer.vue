<template>
  <div
    ref="rootEl"
    :class="[
      markdownSurfaceClasses.root,
      markdownSurfaceClasses.body,
      {
        'is-rendering': isRendering,
        'is-rendering-empty': showInitialLoading(),
      },
    ]"
    role="article"
    aria-live="polite"
    :aria-busy="isRendering ? 'true' : 'false'"
    v-bind="rootRenderAttrs()"
  >
    <div
      v-if="showInitialLoading()"
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
    <template v-if="chunkUnits.length">
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
        v-html="resolveCommittedHtml(item.unit.html)"
      />
      <div
        class="markdown-renderer__virtual-spacer"
        v-bind="bottomSpacerAttrs"
        :style="{ height: `${virtualWindow.bottomSpacer.value}px` }"
      />
    </template>
    <div v-else v-html="resolveCommittedHtml(renderedContent)" />
    <span
      v-if="isRendering && !showInitialLoading()"
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
  toRaw,
  watch,
} from 'vue'
import { useGlobalConfig } from '@element-plus/components/config-provider'
import {
  resolveFsusRenderPipelineUnitAttrs,
  useEmbeddedMarkdownEditorFrameScheduler,
  useFsusRenderPipelineRuntime,
  useFsusVirtualWindow,
} from '@element-plus/hooks'
import {
  MARKDOWN_RENDERER_SURFACE_CLASSES as markdownSurfaceClasses,
  MARKDOWN_RENDERER_VERSION,
  activateMarkdownFeatures,
  renderMarkdownFallbackWithRuntime,
  isMarkdownRuntimeAuthorizedResult,
  normalizeMarkdownSource,
  resolveMarkdownSourceIdentity,
  renderMarkdownChunksWithRuntime,
  renderMarkdownResultWithRuntime,
} from '@element-plus/wasm'
import { isFsusErr, toFsusError } from '@element-plus/utils'
import {
  markdownRendererProps,
  resolveMarkdownWorkerScriptUrl,
} from './markdown-renderer'
import type { FsusRenderPipelineAdapter } from '@element-plus/hooks'
import type { FsusErrorDetail } from '@element-plus/utils'
import type {
  MarkdownRenderChunk,
  MarkdownRenderRequest,
  MarkdownFeatureActivationResult,
  MarkdownRuntimeChunkResult,
  MarkdownRuntimeProfile,
  MarkdownSafeHtml,
  MarkdownSafeRenderAuthority,
  MarkdownSafeRenderResult,
} from '@element-plus/wasm'
import type { ComponentPublicInstance } from 'vue'

defineOptions({
  name: 'ElMarkdownRenderer',
})

const props = defineProps(markdownRendererProps)
const emit = defineEmits<{
  (event: 'render-complete', result: MarkdownSafeRenderResult): void
  (event: 'render-error', error: FsusErrorDetail): void
  (
    event: 'placeholders-ready',
    placeholders: MarkdownSafeRenderResult['placeholders'],
    result: MarkdownSafeRenderResult,
  ): void
  (
    event: 'features-activated',
    activation: MarkdownFeatureActivationResult,
    result: MarkdownSafeRenderResult,
  ): void
  (event: 'render-profile', profile: MarkdownRuntimeProfile): void
}>()

const rootEl = ref<HTMLElement | null>(null)
const initialRequest: MarkdownRenderRequest = {
  source: normalizeMarkdownSource(props.content),
  baseUrl: props.baseUrl,
  mode: props.mode,
  allowLatex: props.allowLatex,
  allowMermaid: props.allowMermaid,
  contentVersion: props.contentVersion,
}
const initialRenderCandidate = props.initialRender
  ? toRaw(props.initialRender)
  : undefined
const validInitialRender =
  isMarkdownRuntimeAuthorizedResult(initialRenderCandidate) &&
  initialRenderCandidate.rendererVersion === MARKDOWN_RENDERER_VERSION &&
  initialRenderCandidate.normalizedSource === initialRequest.source &&
  initialRenderCandidate.sourceIdentity ===
    resolveMarkdownSourceIdentity(initialRequest)
    ? initialRenderCandidate
    : null
const renderedContent = shallowRef<MarkdownSafeHtml | null>(
  validInitialRender?.html ?? null,
)
const resolveCommittedHtml = (html: MarkdownSafeHtml | null) =>
  html === null ? null : (props.trustedHtmlFactory?.(html) ?? html)
const chunkUnits = shallowRef<readonly MarkdownRenderChunk[]>([])
const MIN_INITIAL_MARKDOWN_CHUNKS = 3
const MAX_INITIAL_MARKDOWN_CHUNKS = 12
const renderPipelineConfig = useGlobalConfig('renderPipeline')
const renderStrategy = shallowRef<'sync' | 'chunked-main' | 'chunked-worker'>(
  'sync',
)
const isRendering = shallowRef(false)
const resolveInitialChunkCount = (units: readonly MarkdownRenderChunk[]) => {
  const firstSectionHeadingIndex = units.findIndex(
    (unit, index) => index > 0 && unit.kind === 'heading',
  )
  return Math.min(
    units.length,
    firstSectionHeadingIndex < 0
      ? MIN_INITIAL_MARKDOWN_CHUNKS
      : Math.min(
          MAX_INITIAL_MARKDOWN_CHUNKS,
          Math.max(MIN_INITIAL_MARKDOWN_CHUNKS, firstSectionHeadingIndex + 1),
        ),
  )
}
const initialVisibleChunkCount = computed(() =>
  resolveInitialChunkCount(chunkUnits.value),
)
const showInitialLoading = () =>
  isRendering.value && !chunkUnits.value.length && !renderedContent.value
const rootRenderAttrs = () => ({
  'data-markdown-renderer': 'wasm',
  'data-fsus-surface': 'reading',
  'data-fsus-render-strategy': renderStrategy.value,
  ...renderPipelineRuntime.hardwareAttrs.value,
})
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
let activationController: AbortController | null = null
let activationObserver: IntersectionObserver | null = null
let activeChunkResult: MarkdownRuntimeChunkResult | null = null
let activationDurationMs = 0
let commitDurationMs = 0
const activatedChunkKeys = new Set<string>()
const chunkActivationElements = new Map<string, HTMLElement>()

type RenderAnchor = {
  htmlEndOffset?: number
  htmlStartOffset?: number
  path: number[]
  offset: number
  scrollContainer: HTMLElement
  unitKey?: string
}

const anchorCandidateSelector = `h1,h2,h3,h4,h5,h6,p,li,pre,table,blockquote,.${markdownSurfaceClasses.paragraph},.${markdownSurfaceClasses.text},.${markdownSurfaceClasses.listItem},.${markdownSurfaceClasses.mermaid},.${markdownSurfaceClasses.latex}`

const afterFrame = () =>
  new Promise<void>((resolve) =>
    typeof requestAnimationFrame === 'function'
      ? requestAnimationFrame(() => resolve())
      : resolve(),
  )

// Live-surface layout corrections share the editor-owned frame scheduler
// (#640): embedded in ElMarkdownEditor this is the editor instance provided
// via inject; standalone renders create an equivalent local instance.
const frameScheduler = useEmbeddedMarkdownEditorFrameScheduler()
let renderAnchorDelta: number | null = null

const settleRenderViewport = (key: string) =>
  new Promise<void>((resolve) => {
    frameScheduler.schedule({
      key,
      measure: () => virtualWindow.readViewport(),
      postPaint: resolve,
    })
  })

const readPerformanceNow = () =>
  typeof performance === 'undefined' ? Date.now() : performance.now()

const recordCommitDuration = (startedAt: number) => {
  commitDurationMs += readPerformanceNow() - startedAt
  rootEl.value?.setAttribute(
    'data-fsus-markdown-commit-ms',
    commitDurationMs.toFixed(3),
  )
}

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
  const pointCandidate = root.ownerDocument.elementFromPoint?.(
    Math.max(containerRect.left, 0) + 1,
    Math.max(containerRect.top, 0) + 1,
  )
  const pointAnchor =
    pointCandidate instanceof HTMLElement
      ? pointCandidate.closest<HTMLElement>(anchorCandidateSelector)
      : null
  const visibleUnit = virtualWindow.visibleItems.value[0]
  const unitAnchor = visibleUnit
    ? root.querySelector<HTMLElement>(
        `.markdown-renderer__virtual-unit[data-fsus-render-unit-key="${escapeCssAttributeValue(visibleUnit.key)}"]`,
      )
    : null
  const anchor =
    (pointAnchor && root.contains(pointAnchor) ? pointAnchor : null) ??
    unitAnchor ??
    root.querySelector<HTMLElement>(anchorCandidateSelector)

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

  // Measure and mutate share one scheduler frame: the reads run in the
  // measure phase (DOM already patched — microtasks flush before the frame),
  // the scroll correction commits in the mutate phase, and same-frame
  // restores from the editor coalesce under one scheduling authority.
  await new Promise<void>((resolve) => {
    frameScheduler.schedule({
      key: 'markdown-render-anchor-restore',
      measure: () => {
        renderAnchorDelta = null
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
        const nextOffset =
          nextAnchor.getBoundingClientRect().top - containerTop
        renderAnchorDelta = nextOffset - anchor.offset
      },
      mutate: () => {
        if (renderAnchorDelta !== null && Math.abs(renderAnchorDelta) > 0.5) {
          anchor.scrollContainer.scrollTop += renderAnchorDelta
        }
        renderAnchorDelta = null
      },
      postPaint: resolve,
    })
  })
}

const commitRenderedContent = async (
  html: MarkdownSafeHtml,
  preserveAnchor = false,
) => {
  if (renderedContent.value === html) return false

  const startedAt = readPerformanceNow()
  const anchor = preserveAnchor ? captureRenderAnchor() : null
  chunkUnits.value = []
  renderStrategy.value = 'sync'
  renderedContent.value = html
  await restoreRenderAnchor(anchor)
  recordCommitDuration(startedAt)
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
  const previous = chunkActivationElements.get(key)
  if (previous && previous !== element) {
    activationObserver?.unobserve(previous)
    chunkActivationElements.delete(key)
  }
  if (!(element instanceof HTMLElement)) return
  chunkActivationElements.set(key, element)
  observeChunkForActivation(key, element)
}

const setChunkUnitTemplateRef = (
  key: string,
  element: Element | ComponentPublicInstance | null,
) => {
  setChunkUnitRef(key, element instanceof Element ? element : null)
}

const countMarkdownParagraphBreaks = (source: string) => {
  let count = 1
  for (let index = 0; index < source.length - 1; index += 1) {
    if (
      source.charCodeAt(index) === 10 &&
      source.charCodeAt(index + 1) === 10
    ) {
      count += 1
      index += 1
    }
  }
  return count
}

const estimateMarkdownRender = (source: string) => ({
  htmlBytes: source.length * 2,
  items: Math.max(1, countMarkdownParagraphBreaks(source)),
  nodes: Math.max(1, Math.ceil(source.length / 180)),
})

const createMarkdownRenderRequest = (
  source: string,
): MarkdownRenderRequest => ({
  source,
  baseUrl: props.baseUrl,
  mode: props.mode,
  allowLatex: props.allowLatex,
  allowMermaid: props.allowMermaid,
  contentVersion: props.contentVersion,
})

const sampleMarkdownSource = (source: string) => {
  let hash = 0x811c9dc5
  const sampleSize = 64
  const starts = [
    0,
    Math.max(0, Math.floor(source.length / 2) - sampleSize / 2),
    Math.max(0, source.length - sampleSize),
  ]
  for (const start of starts) {
    const end = Math.min(source.length, start + sampleSize)
    for (let index = start; index < end; index += 1) {
      hash ^= source.charCodeAt(index)
      hash = Math.imul(hash, 0x01000193)
    }
  }
  return (hash >>> 0).toString(36)
}

const fingerprintMarkdownRenderRequest = (request: MarkdownRenderRequest) =>
  [
    request.contentVersion === null || request.contentVersion === undefined
      ? `sample:${sampleMarkdownSource(request.source)}`
      : `version:${String(request.contentVersion)}`,
    request.source.length,
    request.baseUrl ?? '',
    request.mode,
    request.allowLatex ? 'latex' : 'no-latex',
    request.allowMermaid ? 'mermaid' : 'no-mermaid',
  ].join('\u0000')

const matchesMarkdownRenderRequest = (
  request: MarkdownRenderRequest,
  result: MarkdownSafeRenderResult,
) =>
  result.rendererVersion === MARKDOWN_RENDERER_VERSION &&
  result.normalizedSource === normalizeMarkdownSource(request.source) &&
  result.sourceIdentity === resolveMarkdownSourceIdentity(request)

const brokerAuthorizedResults = new WeakSet<object>()
const markdownChunkKindPattern =
  /^(?:heading|paragraph|list|table|code|blockquote|latex|mermaid|footnotes|rule|generated)$/
const markdownRuntimeKindPattern = /^(?:SIMD-128|SCALAR-BASIC|UNKNOWN)$/

const isFiniteNonNegative = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0

// Wasm emits UTF-8 byte offsets; JS string.length is UTF-16 code units.
const utf8ByteLength = (value: string) =>
  new TextEncoder().encode(value).byteLength
const unboundBaseUrl = (value: string | null | undefined) => value || null

const deepSealBrokerValue = <T,>(value: T): T => {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) {
    return value
  }
  for (const nested of Object.values(value)) {
    deepSealBrokerValue(nested)
  }
  return Object.freeze(value)
}

const authorizeBrokerResult = <T extends object>(
  result: T,
): T & MarkdownSafeRenderAuthority => {
  const sealed = deepSealBrokerValue(result)
  brokerAuthorizedResults.add(sealed)
  return sealed as T & MarkdownSafeRenderAuthority
}

const materializeMarkdownWorkerResult = (
  request: MarkdownRenderRequest,
  result: MarkdownRuntimeChunkResult,
  units: readonly MarkdownRenderChunk[],
): MarkdownRuntimeChunkResult | null => {
  const metadata = result.metadata
  if (
    !matchesMarkdownRenderRequest(request, result) ||
    result.chunks !== units ||
    !markdownRuntimeKindPattern.test(result.engine) ||
    !Array.isArray(result.features) ||
    !Array.isArray(result.placeholders) ||
    !Array.isArray(result.chunks) ||
    result.chunks.length === 0 ||
    !metadata ||
    metadata.mode !== (request.mode ?? 'article') ||
    unboundBaseUrl(metadata.baseUrl) !== unboundBaseUrl(request.baseUrl) ||
    metadata.allowLatex !== (request.allowLatex !== false) ||
    metadata.allowMermaid !== (request.allowMermaid !== false) ||
    metadata.sourceLength !== request.source.length ||
    metadata.normalizedSourceLength !== result.normalizedSource.length ||
    metadata.featureCount !== result.features.length ||
    (result.placeholders.length > 0 &&
      metadata.placeholderCount !== result.placeholders.length) ||
    metadata.rendererVersion !== MARKDOWN_RENDERER_VERSION ||
    !Object.values(result.timings).every(isFiniteNonNegative)
  ) {
    return null
  }

  let expectedOffset = 0
  let combinedHtml = ''
  const chunkKeys = new Set<string>()
  for (const chunk of result.chunks) {
    const chunkByteLength = utf8ByteLength(chunk.html)
    if (
      typeof chunk.key !== 'string' ||
      chunkKeys.has(chunk.key) ||
      !markdownChunkKindPattern.test(chunk.kind) ||
      typeof chunk.html !== 'string' ||
      !Number.isFinite(chunk.estimatedSize) ||
      chunk.estimatedSize <= 0 ||
      chunk.htmlStartOffset !== expectedOffset ||
      chunk.htmlEndOffset !== expectedOffset + chunkByteLength
    ) {
      return null
    }
    chunkKeys.add(chunk.key)
    expectedOffset = chunk.htmlEndOffset
    combinedHtml += chunk.html
  }
  if (
    combinedHtml !== result.html ||
    expectedOffset !== utf8ByteLength(result.html)
  ) {
    return null
  }

  return authorizeBrokerResult({
    parser: result.parser,
    rawSource: result.rawSource,
    html: result.html,
    normalizedSource: result.normalizedSource,
    sourceIdentity: result.sourceIdentity,
    features: [...result.features],
    placeholders: result.placeholders.map((placeholder) => ({
      ...placeholder,
    })),
    rendererVersion: result.rendererVersion,
    metadata: { ...metadata },
    chunks: result.chunks.map((chunk) => ({ ...chunk })),
    engine: result.engine,
    timings: { ...result.timings },
  })
}

const hasMarkdownCommitAuthority = (result: MarkdownSafeRenderResult) =>
  isMarkdownRuntimeAuthorizedResult(result) ||
  brokerAuthorizedResults.has(result)

const canUseMarkdownWorker = () =>
  typeof Worker !== 'undefined' && typeof URL !== 'undefined'

const createMarkdownRendererWorker = () => {
  const moduleUrl = new URL('./markdown-renderer.worker.ts', import.meta.url)
  const trustedModuleUrl = resolveMarkdownWorkerScriptUrl(
    moduleUrl,
    props.trustedScriptUrlFactory,
  )
  return new Worker(trustedModuleUrl as string | URL, {
    type: 'module',
  })
}

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

    const result = await renderMarkdownChunksWithRuntime(request)
    if (signal.aborted) {
      throw new DOMException('Aborted', 'AbortError')
    }
    if (isFsusErr(result)) {
      throw result.error
    }
    if (!matchesMarkdownRenderRequest(request, result.value)) {
      throw new Error('markdown_safe_result_identity_mismatch')
    }

    return {
      metadata: result.value,
      units: result.value.chunks,
    }
  },
  worker: {
    createWorker: createMarkdownRendererWorker,
    idleTerminateMs: 30_000,
    name: 'fsus-markdown-renderer',
    pool: 'runtime',
    requireGenerationEcho: true,
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

const scheduleMeasurementWarmup = () => {
  // The viewport warmup read joins the shared frame scheduler's measure
  // phase; the scheduler key coalesces repeated warmups into one frame.
  frameScheduler.scheduleMeasure('markdown-render-viewport-warmup', () => {
    virtualWindow.readViewport()
  })
}

const resolveMarkdownFeatureOptions = () => ({
  codeHighlight: props.features?.codeHighlight ?? true,
  cspNonce: props.features?.cspNonce ?? true,
  externalLink: props.features?.externalLink ?? true,
  hashLink: props.features?.hashLink ?? true,
  headingSlug: props.features?.headingSlug ?? true,
  latex: props.features?.latex ?? props.allowLatex,
  mermaid: props.features?.mermaid ?? props.allowMermaid,
})

const resetFeatureActivation = () => {
  activationController?.abort()
  activationController = new AbortController()
  activationObserver?.disconnect()
  activationObserver = null
  activeChunkResult = null
  activationDurationMs = 0
  rootEl.value?.removeAttribute('data-fsus-markdown-activation-ms')
  activatedChunkKeys.clear()
  chunkActivationElements.clear()
}

const activateRenderedFeatures = async (
  result: MarkdownSafeRenderResult,
  activationRoot: ParentNode | null = rootEl.value,
  signal: AbortSignal | undefined = activationController?.signal,
) => {
  await nextTick()

  if (!activationRoot || signal?.aborted) return

  const activationStartedAt = readPerformanceNow()
  const activation = await activateMarkdownFeatures({
    baseUrl: props.baseUrl,
    concurrency: 3,
    cspNonce: props.cspNonce,
    features: resolveMarkdownFeatureOptions(),
    root: activationRoot,
    signal,
  })
  if (signal?.aborted) return
  activationDurationMs += readPerformanceNow() - activationStartedAt
  rootEl.value?.setAttribute(
    'data-fsus-markdown-activation-ms',
    activationDurationMs.toFixed(3),
  )
  emit('features-activated', activation, result)
}

async function activateChunkFeatures(
  key: string,
  element: HTMLElement,
  taskId: number,
) {
  if (
    taskId !== currentTaskId ||
    activatedChunkKeys.has(key) ||
    !activeChunkResult ||
    activationController?.signal.aborted
  ) {
    return
  }
  activatedChunkKeys.add(key)
  await activateRenderedFeatures(
    activeChunkResult,
    element,
    activationController?.signal,
  )
}

function observeChunkForActivation(key: string, element: HTMLElement) {
  const taskId = currentTaskId
  if (typeof IntersectionObserver === 'undefined') {
    void activateChunkFeatures(key, element, taskId)
    return
  }
  if (!activationObserver) {
    const viewport = findScrollContainer(rootEl.value)
    const observerRoot =
      viewport === document.documentElement || viewport === document.body
        ? null
        : viewport
    activationObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting || !(entry.target instanceof HTMLElement)) {
            continue
          }
          const unitKey = entry.target.dataset.fsusRenderUnitKey
          if (!unitKey) continue
          activationObserver?.unobserve(entry.target)
          void activateChunkFeatures(unitKey, entry.target, currentTaskId)
        }
      },
      { root: observerRoot, rootMargin: '384px 0px' },
    )
  }
  activationObserver.observe(element)
}

const performRender = async () => {
  const taskId = ++currentTaskId
  resetFeatureActivation()
  commitDurationMs = 0
  rootEl.value?.removeAttribute('data-fsus-markdown-commit-ms')
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

      const resolvedResult = hasMarkdownCommitAuthority(result)
        ? result
        : materializeMarkdownWorkerResult(request, result, document.units)
      if (!resolvedResult) {
        throw toFsusError(
          'markdown_safe_result_authority_invalid',
          'markdown_safe_result_authority_invalid',
          'invariant',
        )
      }
      const resolvedUnits = resolvedResult.chunks
      const initialCount = resolveInitialChunkCount(resolvedUnits)

      const commitStartedAt = readPerformanceNow()
      renderedContent.value = null
      activeChunkResult = resolvedResult
      chunkUnits.value = resolvedUnits.slice(0, initialCount)
      renderStrategy.value = renderPipelineRuntime.renderedStrategy.value as
        | 'chunked-main'
        | 'chunked-worker'
      emit('render-profile', {
        engine: resolvedResult.engine,
        phase: 'chunks',
        rendererVersion: resolvedResult.rendererVersion,
        timings: resolvedResult.timings,
      })
      emit('placeholders-ready', resolvedResult.placeholders, resolvedResult)
      await nextTick()
      await settleRenderViewport('markdown-render-settle-initial')
      await afterFrame()
      if (initialCount < resolvedUnits.length) {
        if (taskId !== currentTaskId) return
        await afterFrame()
        if (taskId !== currentTaskId) return
        chunkUnits.value = resolvedUnits
        await nextTick()
        await settleRenderViewport('markdown-render-settle-full')
      }
      recordCommitDuration(commitStartedAt)
      emit('render-complete', resolvedResult)
      scheduleMeasurementWarmup()
      return
    }

    const result = await renderMarkdownResultWithRuntime(request)

    if (taskId !== currentTaskId) {
      return
    }

    if (isFsusErr(result)) {
      throw result.error
    }
    if (
      !hasMarkdownCommitAuthority(result.value) ||
      !matchesMarkdownRenderRequest(request, result.value)
    ) {
      throw toFsusError(
        'markdown_safe_result_authority_invalid',
        'markdown_safe_result_authority_invalid',
        'invariant',
      )
    }

    const resolvedResult = result.value

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

    const fallback = renderMarkdownFallbackWithRuntime(request)
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
    props.contentVersion,
    props.allowLatex,
    props.allowMermaid,
    props.mode,
    props.baseUrl,
    props.cspNonce,
    props.features,
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
  activationController?.abort()
  activationController = null
  activationObserver?.disconnect()
  activationObserver = null
  activeChunkResult = null
  activatedChunkKeys.clear()
  chunkActivationElements.clear()
  currentTaskId += 1
  isRendering.value = false
})

defineExpose({
  rootEl,
})
</script>
