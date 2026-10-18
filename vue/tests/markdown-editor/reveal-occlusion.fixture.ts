import { createApp, defineComponent, h, ref } from 'vue'
import { ElMarkdownEditor } from 'element-plus'
import type {
  MarkdownEditorInstance,
  MarkdownEditorResolvedSelection,
} from 'element-plus'
import '../../packages/theme-chalk/src/index.scss'

const query = new URL(location.href).searchParams
const kind = query.get('kind') ?? 'partial'
const multiline = query.get('range') === 'multiline'
document.documentElement.classList.toggle('dark', query.get('theme') === 'dark')

// Test-only source-to-presentation layout. Production canonical identity is never obtained here.
const selectedRects = (
  source: string,
  selection: MarkdownEditorResolvedSelection,
) => {
  const layer = document.querySelector('.el-markdown-editor__focus-layer')
  if (!layer || layer.textContent !== source)
    throw new Error('fixture-source-layout-mismatch')
  const walker = document.createTreeWalker(layer, NodeFilter.SHOW_TEXT)
  const range = document.createRange()
  let offset = 0
  let start = false
  while (walker.nextNode()) {
    const node = walker.currentNode
    const length = node.textContent?.length ?? 0
    if (!start && selection.start <= offset + length) {
      range.setStart(node, selection.start - offset)
      start = true
    }
    if (selection.end <= offset + length) {
      range.setEnd(node, selection.end - offset)
      return Array.from(range.getClientRects()).filter(
        (rect) => rect.width > 0 && rect.height > 0,
      )
    }
    offset += length
  }
  throw new Error('fixture-selection-unresolved')
}

createApp(
  defineComponent({
    setup() {
      const source = Array.from(
        { length: 80 },
        (_, n) =>
          `Paragraph ${n} with enough words for a real scrollable document.`,
      ).join('\n\n')
      const editor = ref<MarkdownEditorInstance>()
      const outcome = ref('idle')
      const trace: Array<Record<string, unknown>> = []
      const start = source.indexOf('Paragraph 60')
      const selection: MarkdownEditorResolvedSelection = {
        start,
        end: multiline ? source.indexOf('Paragraph 62') - 2 : start + 12,
        direction: 'backward',
      }
      const run = async () => {
        outcome.value = 'pending'
        const owner = editor.value!
        const session = owner.getSession('review:session')
        const controller = new AbortController()
        let moving: number | undefined
        let started = false
        const pending = owner.revealSourceRangeAndWait(selection, {
          session,
          expected: session.inspectDocumentState(),
          signal: controller.signal,
          timeoutMs: Number(query.get('timeout') ?? 600),
          assertAdmission: () => {
            const textarea = document.querySelector('textarea')
            if (
              started ||
              document.activeElement !== textarea ||
              !textarea ||
              textarea.scrollTop <= 0
            )
              return
            const rects = selectedRects(source, selection)
            const input = textarea.getBoundingClientRect()
            if (
              rects.some(
                (rect) => rect.top < input.top || rect.bottom > input.bottom,
              )
            )
              return
            started = true
            const selected =
              kind === 'last-fragment'
                ? rects.at(-1)!
                : kind === 'middle-fragment'
                  ? rects[Math.floor(rects.length / 2)]!
                  : rects[0]!
            if (kind !== 'moving' && kind !== 'clear') {
              const overlay = document.createElement('div')
              overlay.id = 'partial-occlusion'
              Object.assign(overlay.style, {
                position: 'fixed',
                left: `${selected.left + 5}px`,
                top: `${selected.top + 4}px`,
                width: '5px',
                height: `${Math.max(3, selected.height - 8)}px`,
                background: 'rgb(255, 0, 0)',
                zIndex: '999999',
                pointerEvents: kind === 'pointer-none' ? 'none' : 'auto',
              })
              document.body.append(overlay)
              trace.push({
                event: 'covered',
                time: performance.now(),
                rect: overlay.getBoundingClientRect().toJSON(),
                fragments: rects.map((rect) => rect.toJSON()),
                hit: document.elementFromPoint(
                  selected.left + 7,
                  selected.top + 6,
                )?.id,
              })
            }
            if (kind === 'clear')
              trace.push({
                event: 'clear',
                fragments: rects.map((rect) => rect.toJSON()),
              })
            if (kind === 'moving') {
              const main = document.querySelector('main')!
              let step = 0
              const move = () => {
                main.style.position = 'relative'
                main.style.left = `${++step % 2 ? 7 : 0}px`
                moving = requestAnimationFrame(move)
              }
              moving = requestAnimationFrame(move)
            }
            if (kind === 'abort')
              requestAnimationFrame(() => controller.abort())
          },
        })
        try {
          const completion = await pending
          trace.push({
            event: 'completed',
            time: performance.now(),
            overlayPresent: !!document.getElementById('partial-occlusion'),
            resources: session.inspectResourceParticipants(),
          })
          outcome.value = JSON.stringify({ completion, trace })
        } catch (error) {
          trace.push({
            event: 'rejected',
            time: performance.now(),
            overlayPresent: !!document.getElementById('partial-occlusion'),
            resources: session.inspectResourceParticipants(),
          })
          outcome.value = JSON.stringify({
            error: error instanceof Error ? error.message : String(error),
            trace,
          })
        } finally {
          if (moving !== undefined) cancelAnimationFrame(moving)
        }
      }
      return () =>
        h('main', [
          h(
            'button',
            { 'data-testid': 'run', onClick: () => void run() },
            'Reveal',
          ),
          h(ElMarkdownEditor, {
            ref: editor,
            modelValue: source,
            documentIdentity: { id: 'independent-document', epoch: 19 },
            mode: 'source',
            editorProfile: 'prose',
            minRows: 8,
            height: '320px',
            writingAids: { focus: true },
          }),
          h('output', { 'data-testid': 'outcome' }, outcome.value),
        ])
    },
  }),
).mount('#app')
