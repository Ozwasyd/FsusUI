import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, expectTypeOf, it } from 'vitest'
import ElMarkdownEditor from '../src/markdown-editor.vue'
import { MarkdownEditorRevealError } from '../src/markdown-editor'
import type {
  MarkdownEditorInstance,
  MarkdownEditorRevealCompletion,
  MarkdownEditorRevealCompletionOptions,
} from '@element-plus/element-plus'

const wrappers: ReturnType<typeof mount>[] = []
const mountEditor = () => {
  const wrapper = mount(ElMarkdownEditor, {
    attachTo: document.body,
    props: {
      modelValue: '# Title\n\nA😀B',
      documentIdentity: { id: 'reveal-document', epoch: 7 },
      mode: 'source',
    },
  })
  wrappers.push(wrapper)
  return wrapper.vm as MarkdownEditorInstance
}
afterEach(() => {
  for (const wrapper of wrappers.splice(0)) wrapper.unmount()
})

describe('public mounted reveal completion refusals', () => {
  const selection = { start: 0, end: 7, direction: 'backward' as const }
  const optionsFor = (
    editor: MarkdownEditorInstance,
  ): MarkdownEditorRevealCompletionOptions => {
    const session = editor.getSession('reveal:test')
    return {
      session,
      expected: session.inspectDocumentState(),
      signal: new AbortController().signal,
      assertAdmission: () => {},
    }
  }

  it('exports the typed completion separately from legacy synchronous admission', () => {
    const editor = mountEditor()
    expectTypeOf(editor.revealSourceRangeAndWait).returns.toEqualTypeOf<
      Promise<MarkdownEditorRevealCompletion>
    >()
    expect(editor.revealSourceRange({ start: -1, end: 0 })).toBe('not-found')
    expect(new MarkdownEditorRevealError('timeout').reason).toBe('timeout')
  })

  it('refuses an already aborted signal before host admission or selection changes', async () => {
    const editor = mountEditor()
    const options = optionsFor(editor)
    const controller = new AbortController()
    const input = document.querySelector('textarea')!
    const before = [input.selectionStart, input.selectionEnd]
    controller.abort()
    let calls = 0
    await expect(
      editor.revealSourceRangeAndWait(selection, {
        ...options,
        signal: controller.signal,
        assertAdmission: () => {
          calls += 1
        },
      }),
    ).rejects.toMatchObject({ reason: 'aborted' })
    expect(calls).toBe(0)
    expect([input.selectionStart, input.selectionEnd]).toEqual(before)
  })

  it('preserves the actual thrown admission cause', async () => {
    const editor = mountEditor()
    const cause = new Error('host navigation revoked')
    await expect(
      editor.revealSourceRangeAndWait(selection, {
        ...optionsFor(editor),
        assertAdmission: () => {
          throw cause
        },
      }),
    ).rejects.toMatchObject({ reason: 'admission-rejected', cause })
  })

  it('rejects a genuine session from another mounted owner with identical ref/document/revision', async () => {
    const editor = mountEditor()
    optionsFor(editor)
    const other = mountEditor()
    await expect(
      editor.revealSourceRangeAndWait(selection, optionsFor(other)),
    ).rejects.toMatchObject({ reason: 'unavailable' })
  })

  it.each(['epoch', 'revision'] as const)(
    'rejects stale %s before layout',
    async (field) => {
      const editor = mountEditor()
      const options = optionsFor(editor)
      const expected =
        field === 'epoch'
          ? {
              ...options.expected,
              documentIdentity: {
                ...options.expected.documentIdentity,
                epoch: 8,
              },
            }
          : { ...options.expected, revision: options.expected.revision + 1 }
      await expect(
        editor.revealSourceRangeAndWait(selection, { ...options, expected }),
      ).rejects.toMatchObject({ reason: 'stale' })
    },
  )

  it('rechecks native context after an admission callback reenters the transaction owner', async () => {
    const editor = mountEditor()
    await expect(
      editor.revealSourceRangeAndWait(selection, {
        ...optionsFor(editor),
        assertAdmission: () => {
          editor.dispatchTransaction({
            changes: [{ from: 0, to: 0, insert: '!' }],
            history: 'separate',
            origin: 'programmatic',
          })
        },
      }),
    ).rejects.toMatchObject({ reason: 'stale' })
  })

  it('rejects grapheme snapping instead of acknowledging a different range', async () => {
    const editor = mountEditor()
    await expect(
      editor.revealSourceRangeAndWait(
        { start: 11, end: 12, direction: 'forward' },
        optionsFor(editor),
      ),
    ).rejects.toMatchObject({ reason: 'invalid-selection' })
  })

  it('cannot turn missing jsdom browser layout into a viewport ACK', async () => {
    const editor = mountEditor()
    await expect(
      editor.revealSourceRangeAndWait(selection, optionsFor(editor)),
    ).rejects.toMatchObject({ reason: 'unsupported' })
  })
})
