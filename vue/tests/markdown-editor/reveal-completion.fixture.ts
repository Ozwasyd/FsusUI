import { createApp, defineComponent, h, nextTick, ref } from 'vue'
import { ElMarkdownEditor } from 'element-plus'
import type {
  MarkdownEditorInstance,
  MarkdownEditorRevealCompletionOptions,
} from 'element-plus'
import '../../packages/theme-chalk/src/index.scss'

document.documentElement.classList.toggle(
  'dark',
  new URL(location.href).searchParams.get('theme') === 'dark',
)

createApp(
  defineComponent({
    setup() {
      const source = ref(
        Array.from(
          { length: 80 },
          (_, n) =>
            `Paragraph ${n} with enough words for a real scrollable document.`,
        ).join('\n\n'),
      )
      const editor = ref<MarkdownEditorInstance>()
      const shown = ref(true)
      const epoch = ref(9)
      const outcome = ref('idle')
      const target = source.value.indexOf('Paragraph 60')
      const selection = {
        start: target,
        end: target + 12,
        direction: 'backward' as const,
      }
      const run = async (action: string) => {
        outcome.value = 'pending'
        const owner = editor.value!
        const session = owner.getSession('browser:reveal')
        const controller = new AbortController()
        let calls = 0
        const options: MarkdownEditorRevealCompletionOptions = {
          session,
          expected: session.inspectDocumentState(),
          signal: controller.signal,
          timeoutMs: action === 'timeout' ? 150 : 1500,
          assertAdmission: () => {
            calls += 1
            if (
              action === 'abort-after-focus' &&
              document.activeElement?.tagName === 'TEXTAREA'
            )
              controller.abort()
            if (
              action === 'blur' &&
              document.activeElement?.tagName === 'TEXTAREA'
            )
              document.getElementById('outside')!.focus()
            if (
              action === 'focus-return' &&
              document.activeElement?.tagName === 'TEXTAREA'
            ) {
              const input = document.querySelector('textarea')
              document.getElementById('outside')!.focus()
              input?.focus()
            }
            if (action === 'admission' && calls >= 4) throw new Error('revoked')
          },
        }
        if (action === 'pre-abort') controller.abort()
        const before = session.inspectDocumentState()
        const pending = owner.revealSourceRangeAndWait(selection, options)
        if (action === 'abort') controller.abort()
        if (action === 'epoch') {
          epoch.value += 1
          await nextTick()
        }
        if (action === 'selection')
          owner.dispatchTransaction({
            changes: [],
            selection: { start: 0, end: 1, direction: 'forward' },
            history: 'separate',
            origin: 'programmatic',
          })
        if (action === 'superseded')
          void owner
            .revealSourceRangeAndWait(selection, options)
            .catch(() => {})
        if (action === 'unmount') {
          shown.value = false
          await nextTick()
        }
        if (action === 'transaction')
          owner.dispatchTransaction({
            changes: [{ from: 0, to: 0, insert: '!' }],
            history: 'separate',
            origin: 'programmatic',
          })
        if (action === 'timeout') {
          const overlay = document.createElement('div')
          overlay.id = 'occlusion'
          Object.assign(overlay.style, {
            position: 'fixed',
            inset: '0',
            zIndex: '99999',
          })
          document.body.append(overlay)
        }
        try {
          const completion = await pending
          outcome.value = JSON.stringify({
            completion,
            before,
            after: session.inspectDocumentState(),
            calls,
          })
        } catch (error) {
          outcome.value = JSON.stringify({
            error: error instanceof Error ? error.message : String(error),
            calls,
          })
        } finally {
          document.getElementById('occlusion')?.remove()
        }
      }
      return () =>
        h('main', [
          h('button', { id: 'outside' }, 'Outside'),
          ...[
            'success',
            'pre-abort',
            'abort',
            'admission',
            'transaction',
            'unmount',
            'blur',
            'timeout',
            'epoch',
            'selection',
            'superseded',
            'abort-after-focus',
            'focus-return',
          ].map((action) =>
            h(
              'button',
              { onClick: () => void run(action), 'data-action': action },
              action,
            ),
          ),
          shown.value
            ? h(ElMarkdownEditor, {
                ref: editor,
                modelValue: source.value,
                documentIdentity: {
                  id: 'browser-document',
                  epoch: epoch.value,
                },
                mode: 'source',
                editorProfile: 'prose',
                minRows: 8,
                height: '320px',
                writingAids: { focus: true },
                'onUpdate:modelValue': (value: string) => {
                  source.value = value
                },
              })
            : null,
          h('output', { 'data-testid': 'outcome' }, outcome.value),
        ])
    },
  }),
).mount('#app')
