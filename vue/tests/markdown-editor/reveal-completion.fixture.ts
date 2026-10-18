import { createApp, defineComponent, h, nextTick, ref } from 'vue'
import { ElMarkdownEditor } from 'element-plus'
import type {
  MarkdownEditorInstance,
  MarkdownEditorRevealCompletionOptions,
} from 'element-plus'
import '../../packages/theme-chalk/src/index.scss'

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
          timeoutMs: 400,
          assertAdmission: () => {
            calls += 1
            if (action === 'admission' && calls >= 4) throw new Error('revoked')
          },
        }
        if (action === 'pre-abort') controller.abort()
        const before = session.inspectDocumentState()
        const pending = owner.revealSourceRangeAndWait(selection, options)
        if (action === 'abort') controller.abort()
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
        if (action === 'blur')
          setTimeout(() => document.getElementById('outside')!.focus(), 0)
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
          ].map((action) =>
            h(
              'button',
              { onClick: () => void run(action), 'data-action': action },
              action,
            ),
          ),
          h('output', { 'data-testid': 'outcome' }, outcome.value),
          shown.value
            ? h(ElMarkdownEditor, {
                ref: editor,
                modelValue: source.value,
                documentIdentity: { id: 'browser-document', epoch: 9 },
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
        ])
    },
  }),
).mount('#app')
