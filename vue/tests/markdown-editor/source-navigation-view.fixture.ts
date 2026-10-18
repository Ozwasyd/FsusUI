import { createApp, defineComponent, h, ref } from 'vue'
import { ElMarkdownEditor } from 'element-plus'
import type {
  MarkdownEditorInstance,
  MarkdownEditorSourceNavigationView,
  MarkdownEditorSession,
  MarkdownEditorSessionDocumentState,
  MarkdownEditorSourceNavigationGesture,
} from 'element-plus'
import '../../packages/theme-chalk/src/index.scss'

declare global {
  interface Window {
    sourceViewFixture: ReturnType<typeof createControls>
  }
}
const query = new URL(location.href).searchParams
const source = query.has('short')
  ? 'Short source.'
  : Array.from(
      { length: 80 },
      (_, n) =>
        `Paragraph ${n} with enough words for a real scrollable document.`,
    ).join('\n\n')
const createControls = (
  read: () => MarkdownEditorInstance | undefined,
  foreign: () => MarkdownEditorInstance | undefined,
  events: MarkdownEditorSourceNavigationGesture[],
  change: (kind: string) => void,
) => {
  let session: MarkdownEditorSession | undefined
  let expected: MarkdownEditorSessionDocumentState | undefined
  let held: MarkdownEditorSourceNavigationView | null = null
  let issuer: MarkdownEditorInstance | undefined
  let controller = new AbortController()
  let admission = true
  const admissionError = new Error('fixture-admission-revoked')
  const assertAdmission = () => {
    if (!admission) throw admissionError
  }
  const options = () => {
    const owner = read()!
    if (!session) {
      session = owner.getSession('view:session')
      expected = session.inspectDocumentState()
    }
    return {
      session,
      expected: expected!,
      signal: controller.signal,
      assertAdmission,
    }
  }
  const capture = () => read()?.readSourceNavigationView(options()) ?? null
  return {
    source,
    events,
    read: capture,
    hold() {
      issuer = read()
      held = capture()
      return held
    },
    current() {
      return held ? issuer!.isCurrentSourceNavigationView(held) : false
    },
    copyCurrent() {
      return held ? read()!.isCurrentSourceNavigationView({ ...held }) : false
    },
    foreignCurrent() {
      return held ? foreign()!.isCurrentSourceNavigationView(held) : false
    },
    foreignSession() {
      const other = foreign()!.getSession('view:session')
      return read()!.readSourceNavigationView({ ...options(), session: other })
    },
    clonedSession() {
      return read()!.readSourceNavigationView({
        ...options(),
        session: { ...options().session },
      })
    },
    wrongExpected() {
      const input = options()
      return read()!.readSourceNavigationView({
        ...input,
        expected: { ...input.expected, revision: input.expected.revision + 1 },
      })
    },
    async reveal(direction: 'backward' | 'forward' = 'backward') {
      const start = Math.max(0, source.indexOf('Paragraph 60'))
      const input = options()
      await read()!.revealSourceRangeAndWait(
        { start, end: Math.min(source.length, start + 12), direction },
        { ...input, timeoutMs: 1500 },
      )
    },
    readonlyWitness() {
      const input = document.querySelector('textarea')!
      const observer = new MutationObserver(() => {})
      observer.observe(document, {
        subtree: true,
        childList: true,
        attributes: true,
        characterData: true,
      })
      const before = {
        active: document.activeElement === input,
        top: input.scrollTop,
        left: input.scrollLeft,
        selection: [
          input.selectionStart,
          input.selectionEnd,
          input.selectionDirection,
        ],
        state: options().session.inspectDocumentState(),
        resources: options().session.inspectResourceParticipants(),
      }
      const view = capture()
      const current = view ? read()!.isCurrentSourceNavigationView(view) : false
      const after = {
        active: document.activeElement === input,
        top: input.scrollTop,
        left: input.scrollLeft,
        selection: [
          input.selectionStart,
          input.selectionEnd,
          input.selectionDirection,
        ],
        state: options().session.inspectDocumentState(),
        resources: options().session.inspectResourceParticipants(),
      }
      const mutations = observer.takeRecords().length
      observer.disconnect()
      return {
        before,
        after,
        view,
        current,
        mutations,
        synchronous: !(view instanceof Promise),
      }
    },
    errors() {
      held = capture()
      admission = false
      let readAdmission = false
      let currentAdmission = false
      try {
        capture()
      } catch (error) {
        readAdmission = error === admissionError
      }
      try {
        read()!.isCurrentSourceNavigationView(held!)
      } catch (error) {
        currentAdmission = error === admissionError
      }
      admission = true
      const reason = new Error('fixture-original-abort')
      controller.abort(reason)
      let readAbort = false
      let currentAbort = false
      try {
        capture()
      } catch (error) {
        readAbort = error === reason
      }
      try {
        read()!.isCurrentSourceNavigationView(held!)
      } catch (error) {
        currentAbort = error === reason
      }
      controller = new AbortController()
      return { readAdmission, currentAdmission, readAbort, currentAbort }
    },
    race() {
      const input = options()
      let calls = 0
      return read()!.readSourceNavigationView({
        ...input,
        assertAdmission() {
          if (++calls === 2) document.querySelector('textarea')!.scrollTop += 15
        },
      })
    },
    pause() {
      options()
        .session.getNativeSurfaceResourceHandle()!
        .pauseOwnedRegistrations()
    },
    resume() {
      options()
        .session.getNativeSurfaceResourceHandle()!
        .resumeOwnedRegistrations()
    },
    change,
  }
}
createApp(
  defineComponent({
    setup() {
      const editor = ref<MarkdownEditorInstance>()
      const second = ref<MarkdownEditorInstance>()
      const mode = ref<'source' | 'preview'>('source')
      const epoch = ref(19)
      const mounted = ref(true)
      const events: MarkdownEditorSourceNavigationGesture[] = []
      window.sourceViewFixture = createControls(
        () => editor.value,
        () => second.value,
        events,
        (kind) => {
          if (kind === 'mode')
            mode.value = mode.value === 'source' ? 'preview' : 'source'
          if (kind === 'epoch') epoch.value += 1
          if (kind === 'unmount') mounted.value = false
          if (kind === 'transaction')
            editor.value!.dispatchTransaction({
              origin: 'api',
              operations: [{ start: 0, end: 0, insert: 'Changed\n' }],
            })
        },
      )
      document.documentElement.classList.toggle(
        'dark',
        query.get('theme') === 'dark',
      )
      return () =>
        h('main', [
          h(
            'div',
            {
              class: 'clip',
              style: query.has('clip') ? 'height: 250px; overflow:hidden' : '',
            },
            [
              mounted.value
                ? h(ElMarkdownEditor, {
                    ref: editor,
                    modelValue: query.has('short') ? 'Short source.' : source,
                    mode: mode.value,
                    documentIdentity: {
                      id: 'source-view-document',
                      epoch: epoch.value,
                    },
                    editorProfile: 'prose',
                    minRows: 8,
                    height: '320px',
                    writingAids: { focus: true },
                    onSourceNavigationGesture: (
                      event: MarkdownEditorSourceNavigationGesture,
                    ) => events.push(event),
                  })
                : null,
            ],
          ),
          h(
            'div',
            { style: 'position:absolute;top:1200px;left:0;width:740px' },
            [
              h(ElMarkdownEditor, {
                ref: second,
                modelValue: source,
                mode: 'source',
                documentIdentity: { id: 'source-view-document', epoch: 19 },
                editorProfile: 'prose',
              }),
            ],
          ),
        ])
    },
  }),
).mount('#app')
