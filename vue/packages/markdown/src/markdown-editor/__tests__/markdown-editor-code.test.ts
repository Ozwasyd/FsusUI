import { describe, expect, it } from 'vitest'

import {
  applyMarkdownCodeLanguageChange,
  evaluateMarkdownCodeMutations,
  insertMarkdownCodeFence,
  resolveMarkdownCodeCopy,
  resolveMarkdownCodeInput,
  resolveMarkdownCodeLanguage,
  resolveMarkdownCodePresentation,
  resolveMarkdownCodeSession,
} from '../src/markdown-editor-code'
import { applyMarkdownEditorChanges } from '../src/markdown-editor-transaction'

const identity = { epoch: 1, id: 'code' }

describe('markdown fenced code contract', () => {
  it('resolves known aliases from the grammar authority and keeps unknown info', () => {
    expect(resolveMarkdownCodeLanguage('javascript')).toMatchObject({
      available: true,
      canonical: 'js',
      fallback: 'none',
    })
    expect(resolveMarkdownCodeLanguage('typescript').canonical).toBe('ts')
    expect(resolveMarkdownCodeLanguage('shell').canonical).toBe('bash')
    const unknown = resolveMarkdownCodeLanguage('not-a-real-language')
    expect(unknown.available).toBe(false)
    expect(unknown.fallback).toBe('plain')
    expect(unknown.info).toBe('not-a-real-language')
    expect(unknown.list).toEqual(['bash', 'c#', 'js', 'text', 'ts'])
  })

  it('changes only the info range and preserves backtick, tilde, and nested markers', () => {
    const source = '```js\nconst x = 1\n```\n'
    const session = resolveMarkdownCodeSession({
      documentIdentity: identity,
      source,
    })
    const changed = applyMarkdownCodeLanguageChange({
      documentIdentity: identity,
      language: 'ts',
      nodeId: session.node?.nodeId,
      source,
    })
    const next = applyMarkdownEditorChanges(source, changed.transaction!.changes)!.value
    expect(next).toBe('```ts\nconst x = 1\n```\n')
    expect(changed.fallback).toBe('none')

    const unknown = applyMarkdownCodeLanguageChange({
      documentIdentity: identity,
      language: 'not-a-real-language',
      nodeId: session.node?.nodeId,
      source,
    })
    const kept = applyMarkdownEditorChanges(source, unknown.transaction!.changes)!.value
    expect(kept).toBe('```not-a-real-language\nconst x = 1\n```\n')
    expect(unknown.fallback).toBe('plain')

    const nested = insertMarkdownCodeFence({
      fence: '`',
      selection: { direction: 'forward', end: 3, start: 0 },
      source: '```',
    })
    const inserted = applyMarkdownEditorChanges('```', nested.transaction!.changes)!.value
    expect(inserted.startsWith('````')).toBe(true)
    expect(inserted.endsWith('````')).toBe(true)

    const tilde = insertMarkdownCodeFence({
      fence: '~',
      language: 'js',
      selection: { direction: 'none', end: 0, start: 0 },
      source: '',
    })
    expect(applyMarkdownEditorChanges('', tilde.transaction!.changes)!.value).toContain('~~~js')
  })

  it('routes keyboard through the shared input pipeline and rejects composition edits', () => {
    const source = '```js\nconst x = 1\n```\n'
    const enter = resolveMarkdownCodeInput({
      documentIdentity: identity,
      key: 'enter',
      selection: { direction: 'none', end: 8, start: 8 },
      source,
    })
    expect(enter.pipeline).toBe('markdown-input')
    expect(enter.transaction).toBeTruthy()
    const composing = applyMarkdownCodeLanguageChange({
      composing: true,
      documentIdentity: identity,
      language: 'ts',
      source,
    })
    expect(composing.rejected).toBe('composition-active')
    expect(
      insertMarkdownCodeFence({
        composing: true,
        selection: { direction: 'none', end: 0, start: 0 },
        source,
      }).rejected,
    ).toBe('composition-active')
    const copy = resolveMarkdownCodeCopy({
      copyKind: 'source',
      documentIdentity: identity,
      selection: { direction: 'none', end: 0, start: 0 },
      source,
    })
    expect(copy.transaction).toBeNull()
    expect(copy.accessibility.tabStop).toBe(false)
  })

  it('keeps source/live identity and does not add terminal chrome', () => {
    const source = '```js\nconst x = 1\n```\n'
    const live = resolveMarkdownCodeSession({
      documentIdentity: identity,
      mode: 'live',
      revision: 2,
      source,
    })
    const sourceMode = resolveMarkdownCodeSession({
      documentIdentity: identity,
      mode: 'source',
      revision: 2,
      source,
    })
    expect(live.node?.nodeId).toBe(sourceMode.node?.nodeId)
    expect(live.request?.id).toBe(sourceMode.request?.id)
    expect(resolveMarkdownCodePresentation({ language: 'js', mode: 'live' })).toMatchObject({
      overflow: 'internal-scroll',
      presentation: 'highlighted',
      terminalChrome: false,
    })
    expect(live.atomic.accessibility.tabStop).toBe(false)
  })

  it('kills regex fences, body rewrites, remote grammars, extra keydown, and code execution', () => {
    const report = evaluateMarkdownCodeMutations()
    const byKind = Object.fromEntries(
      report.mutations.map((mutation) => [mutation.kind, mutation]),
    )
    expect(report.authority?.kind).toBe('code')
    expect(byKind['regex-fence']?.accepted).toBe(false)
    expect(byKind['body-rewrite']?.accepted).toBe(false)
    expect(byKind['remote-grammar']?.accepted).toBe(false)
    expect(byKind['independent-keydown']?.accepted).toBe(false)
    expect(byKind['code-execution']?.accepted).toBe(false)
  })
})
