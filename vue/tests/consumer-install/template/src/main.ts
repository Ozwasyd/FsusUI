import { createApp, defineAsyncComponent, defineComponent, h } from 'vue'
import { FsusButton, FsusEmptyState } from '__FSUS_PACKAGE_NAME__'
import type { MotionPresetName, useScrollReveal } from '__FSUS_PACKAGE_NAME__/motion'
import '__FSUS_PACKAGE_NAME__/styles/fsus.css'
import '__FSUS_PACKAGE_NAME__/styles/markdown.css'
import App from './App.vue'

type AssertMotionDeclaration<T extends true> = T
export type ConsumerScrollRevealControls = AssertMotionDeclaration<
  'reveal' | 'kill' | 'refresh' | 'tweens' extends keyof ReturnType<
    typeof useScrollReveal
  >
    ? true
    : false
>

const motionPreset: MotionPresetName = 'surface-settle'
void motionPreset

const MarkdownInitialContent = defineComponent({
  name: 'MarkdownInitialContent',
  setup: () => () =>
    h('article', { class: ['fsus-markdown', 'fsus-markdown__body'] }, [
      h('h1', { id: 'consumer-markdown' }, 'Consumer Markdown'),
      h('p', 'This render path validates packaged WASM assets.'),
    ]),
})

const FsusMarkdownRenderer = defineAsyncComponent({
  delay: 0,
  loadingComponent: MarkdownInitialContent,
  loader: async () => {
    const module = await import('__FSUS_PACKAGE_NAME__/markdown')
    return module.FsusMarkdownRenderer
  },
})

const app = createApp(App)
app.component('FsusButton', FsusButton)
app.component('FsusEmptyState', FsusEmptyState)
app.component('FsusMarkdownRenderer', FsusMarkdownRenderer)
app.mount('#app')
