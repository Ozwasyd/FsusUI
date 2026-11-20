<template>
  <main
    class="performance-fixture"
    :class="`motion-${motion}`"
    v-bind="{
      'data-performance-ready': ready,
      'data-performance-scenario': scenario,
    }"
  >
    <el-markdown-renderer
      :content="markdown"
      :content-version="markdownContentVersion"
      :allow-latex="true"
      :allow-mermaid="true"
      :features="markdownFeatures"
      :mode="markdownMode"
      :trusted-script-url-factory="markdownTrustedScriptUrlFactory"
      class="performance-scroll-target performance-markdown"
      @features-activated="captureMarkdownFeatureActivation"
      @render-profile="captureWasmProfile"
      @render-complete="captureMarkdownRenderComplete"
      @render-error="captureMarkdownRenderError"
    />
  </main>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { getFsusRenderPipelineDiagnosticsSnapshot } from '@element-plus/hooks'
import { provideMarkdownHeavyFeatureDocumentContext } from '../../hooks/use-markdown-heavy-feature-lifecycle'
import { createMarkdownHeavyFeatureIsolatedRender } from '../../wasm/markdown-heavy-feature-isolated-client'
import {
  MARKDOWN_FEATURE_ACTIVATION_SCENARIO,
  MARKDOWN_HEAVY_LIFECYCLE_SCENARIO,
  MarkdownFeatureActivationSequence,
  createMarkdownFeatureActivationSource,
  createMarkdownHeavyLifecycleSource,
  hasCompleteMarkdownFeatureActivation,
} from './markdown-feature-performance'

import type {
  MarkdownFeatureActivationResult,
  MarkdownRuntimeProfile,
  MarkdownSafeRenderResult,
} from '@element-plus/wasm'

const props = defineProps<{
  scenario: string
  motion: string
}>()

const ready = ref('false')
const markdownActivationRevision = ref(0)
const completedMarkdownActivationRevision = ref(0)
const markdownDocumentEpoch = ref(1)
const markdownDocumentKey = ref('heavy-document-a')
const markdownHeavyLifecycleRevision = ref(1)
const markdownHeavyLifecycleSourcePrefix = ref('')
const markdownFeatures = ref({
  codeHighlight: true,
  latex: true,
  mermaid: true,
})
const markdownMode = ref<'about' | 'article' | 'editor' | 'preview'>('article')
let markdownTrustedScriptUrlPolicy:
  | { createScriptURL: (value: string) => unknown }
  | undefined
const markdownTrustedScriptUrlFactory = (moduleUrl: URL) => {
  const trustedTypes = (
    globalThis as typeof globalThis & {
      trustedTypes?: {
        createPolicy: (
          name: string,
          rules: { createScriptURL: (value: string) => string },
        ) => { createScriptURL: (value: string) => unknown }
      }
    }
  ).trustedTypes
  if (!trustedTypes) return moduleUrl
  markdownTrustedScriptUrlPolicy ??= trustedTypes.createPolicy(
    'fsus-markdown-heavy-feature-fixture',
    { createScriptURL: (value) => value },
  )
  return markdownTrustedScriptUrlPolicy.createScriptURL(moduleUrl.href)
}
const markdownFeatureActivationSequence =
  new MarkdownFeatureActivationSequence()
provideMarkdownHeavyFeatureDocumentContext({
  documentEpoch: () => markdownDocumentEpoch.value,
  documentKey: () => markdownDocumentKey.value,
  revision: () => markdownContentVersion.value ?? 'unversioned',
})
const markdown = computed(() => {
  if (props.scenario === MARKDOWN_FEATURE_ACTIVATION_SCENARIO) {
    return createMarkdownFeatureActivationSource(
      markdownActivationRevision.value,
    )
  }
  return `${markdownHeavyLifecycleSourcePrefix.value}${createMarkdownHeavyLifecycleSource()}`
})
const markdownContentVersion = computed(() =>
  props.scenario === MARKDOWN_FEATURE_ACTIVATION_SCENARIO
    ? `feature-activation-${markdownActivationRevision.value}`
    : props.scenario === MARKDOWN_HEAVY_LIFECYCLE_SCENARIO
      ? `heavy-lifecycle-${markdownHeavyLifecycleRevision.value}`
      : null,
)

type MarkdownFeatureFixtureApi = {
  act: (iteration: number) => Promise<void>
  markdownPhaseProbe: () => {
    activationRevision: number
    activationMs: number
    commitMs: number
    parseMs: number
    transferMs: number
  } | null
  markdownHeavyLifecycleTransition: (input: {
    codeHighlight: boolean
    documentEpoch: number
    documentKey: string
    latex?: boolean
    mermaid?: boolean
    revision?: number
    sourcePrefix?: string
    theme: 'dark' | 'light'
  }) => Promise<void>
  markdownHeavyLifecycleAbortProbe: () => Promise<{
    after: Readonly<{
      listeners: number
      observers: number
      runtimes: number
      tasks: number
    }>
    before: Readonly<{
      listeners: number
      observers: number
      runtimes: number
      tasks: number
    }>
    remainingFrames: number
    started: boolean
  }>
}

const markdownHeavyLifecycleTransition: MarkdownFeatureFixtureApi['markdownHeavyLifecycleTransition'] =
  async (input) => {
    ready.value = 'false'
    markdownDocumentEpoch.value = input.documentEpoch
    markdownDocumentKey.value = input.documentKey
    if (input.revision !== undefined) {
      markdownHeavyLifecycleRevision.value = input.revision
    }
    if (input.sourcePrefix !== undefined) {
      markdownHeavyLifecycleSourcePrefix.value = input.sourcePrefix
    }
    markdownFeatures.value = {
      codeHighlight: input.codeHighlight,
      latex: input.latex ?? true,
      mermaid: input.mermaid ?? true,
    }
    document.documentElement.classList.toggle('dark', input.theme === 'dark')
    document.documentElement.classList.toggle('light', input.theme === 'light')
    document.documentElement.dataset.themeMode = input.theme
    document.documentElement.dataset.themeResolved = input.theme
    document.documentElement.style.colorScheme = input.theme
    document.documentElement.dispatchEvent(
      new CustomEvent('fsus:theme-change', {
        detail: { mode: input.theme, resolved: input.theme },
      }),
    )
    await nextTick()
  }

const markdownHeavyLifecycleAbortProbe: MarkdownFeatureFixtureApi['markdownHeavyLifecycleAbortProbe'] =
  async () => {
    const handle = createMarkdownHeavyFeatureIsolatedRender({
      kind: 'code-highlight',
      language: 'ts',
      source: Array.from(
        { length: 20_000 },
        (_, index) => `const heavy_${index}: number = ${index}`,
      ).join('\n'),
      theme: document.documentElement.classList.contains('dark')
        ? 'dark'
        : 'light',
      tokens: {},
    })
    const findStarted = () =>
      document.querySelector('iframe[data-fsus-markdown-heavy-work]')
    let resolveStarted!: (value: boolean) => void
    const startedPromise = new Promise<boolean>((resolve) => {
      resolveStarted = resolve
    })
    const observer = new MutationObserver(() => {
      if (findStarted()) resolveStarted(true)
    })
    if (findStarted()) resolveStarted(true)
    else {
      observer.observe(document.body, {
        attributes: true,
        childList: true,
        subtree: true,
      })
    }
    const started = await Promise.race([
      startedPromise,
      handle.promise.then(
        () => false,
        () => false,
      ),
    ])
    observer.disconnect()
    const before = handle.resources()
    handle.teardown()
    await handle.promise.catch(() => undefined)
    return Object.freeze({
      after: handle.resources(),
      before,
      remainingFrames: document.querySelectorAll('iframe[aria-hidden="true"]')
        .length,
      started,
    })
  }

declare global {
  interface Window {
    __FSUSUI_PERFORMANCE_FIXTURE__?: MarkdownFeatureFixtureApi
  }
}

const act = async (_iteration: number) => {
  if (props.scenario !== MARKDOWN_FEATURE_ACTIVATION_SCENARIO) return
  const cycle = markdownFeatureActivationSequence.begin()
  markdownActivationRevision.value = cycle.revision
  await nextTick()
  await cycle.completion
}

let initialWasmProfile: {
  startupMs: number
  computeMs: number
  endToEndMs: number
  engine: string
} | null = null

const captureWasmProfile = (profile: MarkdownRuntimeProfile) => {
  if (initialWasmProfile) return
  initialWasmProfile = {
    startupMs: profile.timings.initMs,
    computeMs: Math.max(0, profile.timings.totalMs - profile.timings.initMs),
    endToEndMs: profile.timings.totalMs,
    engine: profile.engine,
  }
}

const captureMarkdownFeatureActivation = (
  activation: MarkdownFeatureActivationResult,
  result: MarkdownSafeRenderResult,
) => {
  if (props.scenario !== MARKDOWN_FEATURE_ACTIVATION_SCENARIO) return
  if (result.normalizedSource !== markdown.value) return
  if (!hasCompleteMarkdownFeatureActivation(activation)) {
    const error = new Error('markdown_feature_activation_incomplete')
    ready.value = 'error'
    markdownFeatureActivationSequence.fail(error)
    return
  }
  completedMarkdownActivationRevision.value = markdownActivationRevision.value
  markdownFeatureActivationSequence.complete(activation)
  ready.value = 'true'
}

const captureMarkdownRenderComplete = () => {
  if (props.scenario !== MARKDOWN_FEATURE_ACTIVATION_SCENARIO) {
    ready.value = 'true'
  }
}

const captureMarkdownRenderError = (error: unknown) => {
  ready.value = 'error'
  const message =
    error && typeof error === 'object' && 'message' in error
      ? String(error.message)
      : String(error)
  document
    .querySelector('[data-performance-scenario]')
    ?.setAttribute('data-performance-error', message)
  markdownFeatureActivationSequence.fail(error)
}

const markdownPhaseProbe = () => {
  if (!props.scenario.startsWith('markdown')) return null
  const diagnostics = getFsusRenderPipelineDiagnosticsSnapshot().filter(
    (event) => event.adapterId === 'markdown-renderer',
  )
  const latestStage = (stage: string) => {
    for (let index = diagnostics.length - 1; index >= 0; index -= 1) {
      const event = diagnostics[index]
      if (event.stage === stage && typeof event.durationMs === 'number') {
        return event.durationMs
      }
    }
    return 0
  }
  const renderer = document.querySelector<HTMLElement>(
    '[data-markdown-renderer="wasm"]',
  )
  return {
    activationRevision: completedMarkdownActivationRevision.value,
    activationMs: Number(renderer?.dataset.fsusMarkdownActivationMs ?? '0'),
    commitMs:
      Number(renderer?.dataset.fsusMarkdownCommitMs ?? '0') ||
      latestStage('vue-commit'),
    parseMs: initialWasmProfile?.endToEndMs ?? latestStage('worker-compute'),
    transferMs: latestStage('worker-transfer'),
  }
}

onMounted(() => {
  window.__FSUSUI_PERFORMANCE_FIXTURE__ = {
    act,
    markdownHeavyLifecycleAbortProbe,
    markdownHeavyLifecycleTransition,
    markdownPhaseProbe,
  }
})

onBeforeUnmount(() => {
  markdownFeatureActivationSequence.fail(
    new Error('markdown_feature_activation_fixture_unmounted'),
  )
  document.documentElement.classList.remove('dark')
  delete window.__FSUSUI_PERFORMANCE_FIXTURE__
})
</script>

<style scoped>
.performance-fixture {
  box-sizing: border-box;
  max-width: 100%;
  min-height: 720px;
  padding: 24px;
  width: 1024px;
}

.performance-markdown {
  height: 640px;
  overflow: auto;
}

.motion-disabled *,
.motion-disabled *::before,
.motion-disabled *::after {
  animation: none !important;
  transition: none !important;
}

@media (prefers-reduced-motion: reduce) {
  .motion-reduced *,
  .motion-reduced *::before,
  .motion-reduced *::after {
    animation-duration: 0.001ms !important;
    transition-duration: 0.001ms !important;
  }
}
</style>
