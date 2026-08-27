import { describe, expect, it } from 'vitest'

import {
  commitMarkdownLanguageToolMutation,
  createMarkdownLanguageToolSession,
  evaluateMarkdownLanguageToolMutations,
  planMarkdownLanguageToolReplacement,
  resolveMarkdownLanguageToolCapability,
  resolveMarkdownLanguageToolContextCapability,
} from '../src/markdown-editor-language-tools'

describe('markdown language tool adapter', () => {
  it('emits a #268 transaction rather than a second input pipeline', () => {
    const capability = resolveMarkdownLanguageToolCapability({ spellcheck: true })
    expect(capability.spellcheck).toBe(true)
    const transaction = planMarkdownLanguageToolReplacement(0, 3, 'the')
    expect(transaction.origin).toBe('input')
    expect(transaction.changes[0]).toEqual({ from: 0, to: 3, insert: 'the' })
    const report = evaluateMarkdownLanguageToolMutations()
    expect(report.mutations.every((mutation) => mutation.accepted === false)).toBe(true)
  })

  it('resolves capability states, language hint, and native writing tools', () => {
    const defaultCap = resolveMarkdownLanguageToolCapability()
    expect(defaultCap.spellcheck).toBe(true)
    expect(defaultCap.spellcheckMode).toBe('auto')
    expect(defaultCap.nativeWritingTools).toBe('auto')
    expect(defaultCap.status).toBe('supported')

    const disabledCap = resolveMarkdownLanguageToolCapability({
      spellcheck: 'disabled',
      lang: 'en-US',
      nativeWritingTools: 'disabled',
    })
    expect(disabledCap.spellcheck).toBe(false)
    expect(disabledCap.spellcheckMode).toBe('disabled')
    expect(disabledCap.lang).toBe('en-US')
    expect(disabledCap.nativeWritingTools).toBe('disabled')
    expect(disabledCap.status).toBe('unavailable')
    expect(disabledCap.reason).toBe('disabled')

    const booleanCap = resolveMarkdownLanguageToolCapability({ spellcheck: false })
    expect(booleanCap.spellcheck).toBe(false)
    expect(booleanCap.spellcheckMode).toBe('disabled')
  })

  it('resolves contextual degradation in code, url, atomic nodes, and markers', () => {
    const source = [
      '# Title heading',
      'Normal paragraph text here.',
      '```js',
      'const unspelled = 1',
      '```',
      'Visit [example](https://fsusui.dev/path) for docs.',
      '$$',
      '\\alpha + \\beta',
      '$$',
      '![diagram](img.png)',
    ].join('\n')

    const docId = { epoch: 1, id: 'context-doc' }

    // Prose context -> supported
    const prose = resolveMarkdownLanguageToolContextCapability({
      documentIdentity: docId,
      offset: 18,
      source,
    })
    expect(prose.status).toBe('supported')
    expect(prose.spellcheck).toBe(true)
    expect(prose.reason).toBeUndefined()

    // Inside code block -> degraded with code-block reason
    const codeOffset = source.indexOf('unspelled')
    const inCode = resolveMarkdownLanguageToolContextCapability({
      documentIdentity: docId,
      offset: codeOffset,
      source,
    })
    expect(inCode.status).toBe('degraded')
    expect(inCode.spellcheck).toBe(false)
    expect(inCode.reason).toBe('code-block')

    // Inside link URL -> degraded with url reason
    const urlOffset = source.indexOf('https://') + 4
    const inUrl = resolveMarkdownLanguageToolContextCapability({
      documentIdentity: docId,
      offset: urlOffset,
      source,
    })
    expect(inUrl.status).toBe('degraded')
    expect(inUrl.spellcheck).toBe(false)
    expect(inUrl.reason).toBe('url')

    // Inside math block -> degraded with atomic-node reason
    const mathOffset = source.indexOf('\\alpha')
    const inMath = resolveMarkdownLanguageToolContextCapability({
      documentIdentity: docId,
      offset: mathOffset,
      source,
    })
    expect(inMath.status).toBe('degraded')
    expect(inMath.spellcheck).toBe(false)
    expect(inMath.reason).toBe('atomic-node')

    // Inside heading marker '#' -> degraded with hidden-marker reason
    const inMarker = resolveMarkdownLanguageToolContextCapability({
      documentIdentity: docId,
      offset: 0,
      source,
    })
    expect(inMarker.status).toBe('degraded')
    expect(inMarker.spellcheck).toBe(false)
    expect(inMarker.reason).toBe('hidden-marker')

    // Disabled, readonly, preview, and composition active states
    expect(
      resolveMarkdownLanguageToolContextCapability({ source, disabled: true }).status,
    ).toBe('unavailable')
    expect(
      resolveMarkdownLanguageToolContextCapability({ source, readonly: true }).status,
    ).toBe('unavailable')
    expect(
      resolveMarkdownLanguageToolContextCapability({ source, mode: 'preview' }).status,
    ).toBe('unavailable')
    const composing = resolveMarkdownLanguageToolContextCapability({
      source,
      isComposing: true,
    })
    expect(composing.status).toBe('degraded')
    expect(composing.reason).toBe('composition-active')
  })

  it('binds sessions to document epoch, id, revision, and selection', () => {
    const doc = { epoch: 2, id: 'my-article' }
    const session = createMarkdownLanguageToolSession({
      documentIdentity: doc,
      kind: 'writing-tools',
      revision: 5,
      selection: { start: 10, end: 20, direction: 'forward' },
    })

    expect(session.id).toContain('my-article')
    expect(session.documentIdentity).toEqual(doc)
    expect(session.revision).toBe(5)
    expect(session.kind).toBe('writing-tools')
    expect(session.active).toBe(true)
    expect(session.selection?.start).toBe(10)
    expect(session.selection?.end).toBe(20)
  })

  it('commits native corrections modifying only explicit raw ranges with separate history', () => {
    const doc = { epoch: 1, id: 'commit-doc' }
    const source = 'The quik brown fox'
    const session = createMarkdownLanguageToolSession({
      documentIdentity: doc,
      kind: 'spellcheck',
      revision: 3,
    })

    const commit = commitMarkdownLanguageToolMutation({
      currentDocumentIdentity: doc,
      currentRevision: 3,
      documentIdentity: doc,
      from: 4,
      insert: 'quick',
      revision: 3,
      session,
      source,
      to: 8,
    })

    expect(commit.accepted).toBe(true)
    expect(commit.transaction).toBeDefined()
    expect(commit.transaction?.origin).toBe('input')
    expect(commit.transaction?.history).toBe('separate')
    expect(commit.transaction?.changes).toEqual([{ from: 4, to: 8, insert: 'quick' }])
    expect(commit.transaction?.selection).toEqual({ start: 9, end: 9, direction: 'none' })
    expect(commit.transaction?.metadata?.languageTool).toBe(true)
  })

  it('rejects stale document identity, revision, selection, and session', () => {
    const doc = { epoch: 1, id: 'stale-doc' }
    const otherDoc = { epoch: 2, id: 'stale-doc' }
    const source = 'Hello wrld'
    const session = createMarkdownLanguageToolSession({
      documentIdentity: doc,
      revision: 1,
    })

    // Stale document
    const staleDoc = commitMarkdownLanguageToolMutation({
      currentDocumentIdentity: otherDoc,
      currentRevision: 1,
      documentIdentity: doc,
      from: 6,
      insert: 'world',
      revision: 1,
      session,
      source,
      to: 10,
    })
    expect(staleDoc.accepted).toBe(false)
    expect(staleDoc.reason).toBe('stale-document')

    // Stale revision
    const staleRev = commitMarkdownLanguageToolMutation({
      currentDocumentIdentity: doc,
      currentRevision: 2,
      documentIdentity: doc,
      from: 6,
      insert: 'world',
      revision: 1,
      session,
      source,
      to: 10,
    })
    expect(staleRev.accepted).toBe(false)
    expect(staleRev.reason).toBe('stale-revision')

    // Stale selection
    const staleSel = commitMarkdownLanguageToolMutation({
      currentDocumentIdentity: doc,
      currentRevision: 1,
      currentSelection: { start: 0, end: 2 },
      documentIdentity: doc,
      from: 6,
      insert: 'world',
      revision: 1,
      session,
      source,
      to: 10,
    })
    expect(staleSel.accepted).toBe(false)
    expect(staleSel.reason).toBe('stale-selection')
  })

  it('rejects during active IME composition and distinguishes sessions cleanly', () => {
    const doc = { epoch: 1, id: 'ime-doc' }
    const source = 'Testing input'

    const result = commitMarkdownLanguageToolMutation({
      documentIdentity: doc,
      from: 0,
      insert: 'T',
      isComposing: true,
      revision: 1,
      source,
      to: 1,
    })

    expect(result.accepted).toBe(false)
    expect(result.reason).toBe('composition-active')
  })

  it('rejects DOM authority and full source replacements', () => {
    const doc = { epoch: 1, id: 'authority-doc' }
    const source = 'This is a test document with several words.'

    // DOM authority
    const domResult = commitMarkdownLanguageToolMutation({
      documentIdentity: doc,
      from: 0,
      insert: 'fixed',
      rawHtml: '<span>fixed</span>',
      revision: 1,
      source,
      to: 4,
    })
    expect(domResult.accepted).toBe(false)
    expect(domResult.reason).toBe('dom-authority-rejected')

    // Full source replacement
    const fullResult = commitMarkdownLanguageToolMutation({
      documentIdentity: doc,
      from: 0,
      insert: 'Completely replaced text that does not belong in a word edit',
      revision: 1,
      source,
      to: source.length,
    })
    expect(fullResult.accepted).toBe(false)
    expect(fullResult.reason).toBe('full-source-rejected')
  })

  it('kills all forbidden mutation kinds in evaluation fixture', () => {
    const report = evaluateMarkdownLanguageToolMutations()
    expect(report.mutations.length).toBeGreaterThanOrEqual(6)
    for (const mutation of report.mutations) {
      expect(mutation.accepted).toBe(false)
    }
  })
})
