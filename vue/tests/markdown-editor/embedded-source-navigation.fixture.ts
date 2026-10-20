import { createApp, defineComponent, h, ref } from 'vue'
import { ElMarkdownEditor } from 'element-plus'
import type { MarkdownEditorInstance } from 'element-plus'
import '../../packages/theme-chalk/src/index.scss'

const query = new URL(location.href).searchParams
const chrome = query.get('chrome')
const mode = query.get('mode') === 'split' ? 'split' : 'source'
const source = Array.from(
  { length: 80 },
  (_, n) => `Paragraph ${n} with enough words for a real scrollable document.`,
).join('\n\n')
document.documentElement.classList.toggle('dark', query.get('theme') === 'dark')
// This source fixture supplies its page backdrop; it is not production bootstrap evidence.
document.body.style.cssText =
  'margin:0;background:var(--el-bg-color);color:var(--el-text-color-primary)'

createApp(
  defineComponent({
    setup() {
      const editor = ref<MarkdownEditorInstance>()
      const session = () => editor.value!.getSession('embedded:source-view')
      const options = () => {
        const owner = session()
        return {
          session: owner,
          expected: owner.inspectDocumentState(),
          signal: new AbortController().signal,
          assertAdmission() {},
        }
      }
      window.embeddedSourceFixture = {
        read: () => editor.value!.readSourceNavigationView(options()),
        select() {
          editor.value!.dispatchTransaction({
            changes: [],
            selection: { start: 0, end: 12, direction: 'forward' },
            origin: 'programmatic',
            history: 'separate',
          })
        },
        async reveal() {
          const start = source.indexOf('Paragraph 60')
          try {
            return await editor.value!.revealSourceRangeAndWait(
              { start, end: start + 12, direction: 'forward' },
              { ...options(), timeoutMs: 600 },
            )
          } catch (error) {
            return {
              error: error instanceof Error ? error.message : String(error),
            }
          }
        },
      }
      return () =>
        h(ElMarkdownEditor, {
          ref: editor,
          modelValue: source,
          documentIdentity: { id: 'embedded-source-view', epoch: 7 },
          chrome:
            chrome === 'framed' || chrome === 'minimal' ? chrome : 'embedded',
          editorProfile: 'prose',
          mode,
          height: '520px',
          surfaces: {
            toolbar: true,
            selectionToolbar: true,
            slashMenu: true,
            commandPalette: true,
          },
        })
    },
  }),
).mount('#app')

declare global {
  interface Window {
    embeddedSourceFixture: {
      read(): unknown
      select(): void
      reveal(): Promise<unknown>
    }
  }
}
