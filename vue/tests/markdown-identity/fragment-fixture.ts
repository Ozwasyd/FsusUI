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
