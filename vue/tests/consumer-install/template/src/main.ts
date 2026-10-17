import { createApp, defineAsyncComponent, defineComponent, h } from 'vue'
import type {
  DataListColumn,
  DataListRow,
  DataListRowKey,
} from '__FSUS_PACKAGE_NAME__'
import { ElButton } from '__FSUS_PACKAGE_NAME__/es/components/button/index.mjs'
import {
  ElEmptyState,
  type EmptyStateProps,
} from '__FSUS_PACKAGE_NAME__/es/components/empty-state/index.mjs'
import type {
  MotionPresetName,
  useScrollReveal,
} from '__FSUS_PACKAGE_NAME__/motion'
import type {
  CharacterChallengeProps,
  PerceptionCharacterMedia,
  PerceptionChallengeKind,
} from '__FSUS_PACKAGE_NAME__/perception-challenge'
import '__FSUS_PACKAGE_NAME__/theme-chalk/base.css'
import '__FSUS_PACKAGE_NAME__/theme-chalk/el-button.css'
import '__FSUS_PACKAGE_NAME__/theme-chalk/el-empty-state.css'
import '__FSUS_PACKAGE_NAME__/theme-chalk/el-markdown-renderer.css'
import App from './App.vue'

type AssertMotionDeclaration<T extends true> = T
export type ConsumerScrollRevealControls = AssertMotionDeclaration<
  'reveal' | 'kill' | 'refresh' | 'tweens' extends keyof ReturnType<
    typeof useScrollReveal
  >
    ? true
    : false
>
type RequireScrollRevealOptions<
  T extends Parameters<typeof useScrollReveal>[0],
> = T
// @ts-expect-error compiled motion declarations must reject string disabled values
export type ConsumerInvalidScrollRevealOptions = RequireScrollRevealOptions<{
  disabled: 'true'
}>

const loadPublicShellCriticalCss = () =>
  import('__FSUS_PACKAGE_NAME__/dist/public-shell-critical.css')
void loadPublicShellCriticalCss

const initialMarkdownNodes = () => [
  h('h1', { id: 'consumer-markdown' }, 'Consumer Markdown'),
  h('p', 'This render path validates packaged WASM assets.'),
]
const MarkdownInitialContent = defineComponent({
  name: 'MarkdownInitialContent',
  setup: () => () =>
    h(
      'article',
      { class: ['markdown-renderer', 'markdown-renderer__body'] },
      initialMarkdownNodes(),
    ),
})
const waitForInitialIdle = () =>
  new Promise<void>((resolve) => {
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(() => resolve(), { timeout: 1_000 })
      return
    }
    setTimeout(resolve, 0)
  })
const ElMarkdownRenderer = defineAsyncComponent({
  delay: 0,
  loadingComponent: MarkdownInitialContent,
  loader: async () => {
    await waitForInitialIdle()
    const module =
      await import('__FSUS_PACKAGE_NAME__/es/components/markdown-renderer/index.mjs')
    return module.ElMarkdownRenderer
  },
})

const app = createApp(App)
const emptyStateContract = {
  componentName: ElEmptyState.name,
  props: {
    description: 'The packed package exposes EmptyState types.',
    size: 'compact',
    title: 'EmptyState package export',
  },
} satisfies {
  componentName: string | undefined
  props: Partial<EmptyStateProps>
}

if (emptyStateContract.componentName !== 'ElEmptyState') {
  throw new Error('Packed package EmptyState export drifted.')
}

const fsusBlogPackageContract = {
  columns: [{ key: 'title', label: 'Title' }] satisfies DataListColumn[],
  motionPreset: 'surface-settle' satisfies MotionPresetName,
  perceptionKind: 'text-task' satisfies PerceptionChallengeKind,
  characterKind: 'character' satisfies PerceptionChallengeKind,
  characterMedia: {
    raster: {
      kind: 'image-url',
      src: 'data:image/png;base64,AAAA',
      width: 1,
      height: 1,
    },
  } satisfies PerceptionCharacterMedia,
  characterProps: {
    challengeId: 'consumer-owned-character',
    media: null,
    state: 'ready',
  } satisfies Partial<CharacterChallengeProps>,
  row: { title: 'Packed collection row' } satisfies DataListRow,
  rowKey: 'packed-row' satisfies DataListRowKey,
}
void fsusBlogPackageContract

app.component('ElButton', ElButton)
app.component('ElEmptyState', ElEmptyState)
app.component('ElMarkdownRenderer', ElMarkdownRenderer)

app.mount('#app')
