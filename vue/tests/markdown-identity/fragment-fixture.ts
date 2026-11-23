import { createApp, h, ref } from 'vue'
import { ElConfigProvider, ElMarkdownRenderer } from '@ozwasyd/element-plus'
import '@element-plus/components/markdown-renderer/style'

const fence = '`'.repeat(3)
const blocks = Array.from(
  { length: 45 },
  (_, index) =>
    `Paragraph block ${index + 1} with extended prose so chunked rendering virtualizes offscreen blocks.`,
)
const source = [
  ...blocks,
  '## Heading witness ^harbor',
  'A *paragraph* ^detail',
  `${fence}text\natomic value\n## Fake ^inside-fence\n${fence}\n^sample`,
  'Duplicate heading ^collision',
  'Second valid owner ^collision',
  'Invalid marker ^Upper',
  `${fence}text\nafter gap\n${fence}`,
  '^skipped',
  'Heading ^trailing  ',
  'Heading  ^two',
  'First line ^premature\nThe closing line',
  'First line ^first\nLast line ^last',
].join('\n\n')

export const mountFragmentFixture = (smooth = false) => {
  const host = document.createElement('div')
  document.body.append(host)
  const renderer = ref<InstanceType<typeof ElMarkdownRenderer>>()
  const scroller = ref<HTMLDivElement>()
  const app = createApp({
    render: () =>
      h(
        ElConfigProvider,
        {
          renderPipeline: {
            budget: { overscanPx: 40 },
            thresholds: { estimatedNodes: 2, htmlBytes: 256, itemCount: 2 },
          },
        },
        {
          default: () =>
            h(
              'div',
              {
                ref: scroller,
                style: {
                  height: '180px',
                  overflowY: 'auto',
                  border: '1px solid #999',
                  scrollBehavior: smooth ? 'smooth' : 'auto',
                },
              },
              [
                h(ElMarkdownRenderer, {
                  ref: renderer,
                  content: source,
                  contentVersion: 'chunked-fragment-fixture',
                  mode: 'article',
                }),
              ],
            ),
        },
      ),
  })
  app.mount(host)
  return {
    renderer: renderer.value!,
    scroller: scroller.value!,
    unmount() {
      app.unmount()
      host.remove()
    },
  }
}

const highlightedCodeSource = [
  '## Heading witness ^harbor',
  '',
  'A *paragraph* ^detail',
  '',
  `${fence}typescript`,
  'const answer = 42',
  fence,
  '^sample',
].join('\n')

export const mountHighlightedCodeFragmentFixture = (codeHighlight: boolean) => {
  const host = document.createElement('div')
  document.body.append(host)
  const renderer = ref<InstanceType<typeof ElMarkdownRenderer>>()
  let resolveComplete!: () => void
  const renderComplete = new Promise<void>((resolve) => {
    resolveComplete = resolve
  })
  const activatedKinds: string[] = []
  const app = createApp({
    render: () =>
      h(ElMarkdownRenderer, {
        ref: renderer,
        content: highlightedCodeSource,
        contentVersion: `code-highlight-fragment-${codeHighlight ? 'on' : 'off'}`,
        mode: 'article',
        features: { codeHighlight },
        onFeaturesActivated(payload: { kind?: string }) {
          if (payload?.kind) activatedKinds.push(payload.kind)
        },
        onRenderComplete() {
          resolveComplete()
        },
      }),
  })
  app.mount(host)
  return {
    host,
    renderer: renderer.value!,
    renderComplete,
    activatedKinds,
    unmount() {
      app.unmount()
      host.remove()
    },
  }
}
