import { describe, expect, it } from 'vitest'

import {
  defaultMarkdownEditorCommands,
  defaultMarkdownEditorLocaleText,
  evaluateMarkdownEditorLocaleMutations,
  filterMarkdownEditorCommands,
  isMarkdownEditorCommandEnabled,
  isMarkdownEditorCommandVisible,
  resolveMarkdownEditorLocaleText,
  resolveMarkdownEditorOverflowCommands,
  resolveMarkdownEditorPrimaryCommands,
  resolveMarkdownEditorShortcut,
  resolveMarkdownEditorToolbarLimit,
  type MarkdownEditorCommand,
  type MarkdownEditorCommandContext,
} from '../src/markdown-editor'
import {
  createMarkdownEditorCommandSnapshot,
  evaluateMarkdownEditorCommandMutations,
} from '../src/markdown-editor-command-snapshot'
import {
  abortMarkdownEditorCommandSessions,
  createMarkdownEditorCommandSession,
  evaluateMarkdownEditorCommandAsyncMutations,
  rebaseMarkdownEditorCommandSession,
  resolveMarkdownEditorCommandSession,
  type MarkdownEditorCommandSession,
} from '../src/markdown-editor-command-async'
import {
  evaluateMarkdownEditorStatusMutations,
  resolveMarkdownEditorStatus,
} from '../src/markdown-editor-status'
import {
  evaluateMarkdownSelectionToolbarMutations,
  resolveMarkdownSelectionToolbarFocusReturn,
  resolveMarkdownSelectionToolbarPlacement,
} from '../src/markdown-editor-selection-toolbar'
import {
  evaluateMarkdownCommandPaletteMutations,
  evaluateMarkdownEditorToolbarMutations,
  evaluateMarkdownSlashMenuMutations,
  groupMarkdownEditorCommands,
  planMarkdownSlashCommit,
  resolveMarkdownSlashQuery,
  resolveMarkdownSlashTrigger,
  searchMarkdownEditorCommandSnapshot,
  searchMarkdownEditorCommands,
} from '../src/markdown-editor-surfaces'
import {
  evaluateMarkdownPropertyMutations,
  parseMarkdownLinkNode,
  planMarkdownImageAltChange,
  planMarkdownLinkPropertyEdit,
  planMarkdownLinkUnwrap,
  validateMarkdownPropertyUrl,
} from '../src/markdown-editor-link-image'
import {
  currentMarkdownAnchors,
  evaluateMarkdownAnchorTransactionMutations,
  planMarkdownAnchorCopy,
  planMarkdownAnchorEdit,
  planMarkdownAnchorInsert,
  planMarkdownAnchorRemove,
  planMarkdownBlockMerge,
  planMarkdownBlockMove,
  planMarkdownBlockSplit,
} from '../src/markdown-editor-anchor-commands'
import {
  composeMarkdownEditorPositionMapInstances,
  createMarkdownEditorPositionMap,
} from '../src/markdown-editor-transaction'
import {
  createMarkdownEditorProjection,
  stabilizeMarkdownEditorProjection,
} from '../../../wasm/markdown-runtime'

const projectionFor = (source: string) =>
  stabilizeMarkdownEditorProjection(createMarkdownEditorProjection(source), {
    id: 'command-chain',
    epoch: 1,
  })

const projectedLink = (source: string) => {
  const node = projectionFor(source).nodes.find(
    (candidate) => candidate.kind === 'link',
  )
  if (!node) throw new Error('Expected link projection fixture.')
  return parseMarkdownLinkNode(source, node)
}

const makeContext = (
  overrides?: Partial<MarkdownEditorCommandContext>,
): MarkdownEditorCommandContext => ({
  dispatch: {
    dispatch: () => ({
      accepted: true,
      history: {
        canRedo: false,
        canUndo: false,
        redoDepth: 0,
        retainedUnits: 0,
        undoDepth: 0,
      },
      revision: 1,
      selection: { direction: 'none', end: 0, start: 0 },
      value: '',
    }),
  },
  documentIdentity: { epoch: 1, id: 'doc-1' },
  mode: 'source',
  readonly: false,
  revision: 1,
  selection: { direction: 'none', end: 0, start: 0 },
  signal: new AbortController().signal,
  value: 'Sample markdown text',
  ...overrides,
})

describe('Issue #430: Unified command registry, context, and presentation metadata', () => {
  it('provides single snapshot across surfaces with separate when/enabled semantics', () => {
    const ctx = makeContext()
    const snapshot = createMarkdownEditorCommandSnapshot(
      defaultMarkdownEditorCommands,
      ctx,
    )
    expect(snapshot.length).toBeGreaterThan(0)
    expect(snapshot.every((item) => item.key && item.group)).toBe(true)

    const disabledCtx = makeContext({ readonly: true })
    const boldCmd = defaultMarkdownEditorCommands.find((c) => c.key === 'bold')!
    expect(isMarkdownEditorCommandVisible(boldCmd, disabledCtx)).toBe(true)
    expect(isMarkdownEditorCommandEnabled(boldCmd, disabledCtx)).toBe(false)
  })

  it('fails closed on shortcut conflicts and passes mutation evaluation', () => {
    const ctx = makeContext()
    expect(() =>
      resolveMarkdownEditorShortcut(
        [
          {
            ...defaultMarkdownEditorCommands[0]!,
            shortcut: 'Mod+B',
            key: 'cmd1',
          },
          {
            ...defaultMarkdownEditorCommands[0]!,
            shortcut: 'Mod+B',
            key: 'cmd2',
          },
        ],
        'Mod+B',
      ),
    ).toThrow(/shortcut conflict/)

    const report = evaluateMarkdownEditorCommandMutations(
      defaultMarkdownEditorCommands,
      ctx,
    )
    expect(report.mutations.every((m) => m.accepted === false)).toBe(true)
    expect(
      report.mutations.find((m) => m.kind === 'duplicate-shortcut')?.equivalent,
    ).toBe(false)
  })

  it('rejects malformed registry entries before a surface can render them', () => {
    const ctx = makeContext()
    const bold = defaultMarkdownEditorCommands[0]!
    expect(() =>
      createMarkdownEditorCommandSnapshot(
        [bold, { ...bold, key: bold.key }],
        ctx,
      ),
    ).toThrow(/duplicate command key/)
    expect(() =>
      createMarkdownEditorCommandSnapshot([{ ...bold, group: '' }], ctx),
    ).toThrow(/group must be non-empty and trimmed/)
    expect(() =>
      createMarkdownEditorCommandSnapshot(
        [{ ...bold, icon: 'arbitrary' as never }],
        ctx,
      ),
    ).toThrow(/unregistered icon/)
    expect(() =>
      createMarkdownEditorCommandSnapshot(
        [{ ...bold, apply: bold.run } as MarkdownEditorCommand],
        ctx,
      ),
    ).toThrow(/legacy apply/)
    expect(() =>
      createMarkdownEditorCommandSnapshot(
        [{ ...bold, presentation: ['toolbar', 'unknown' as never] }],
        ctx,
      ),
    ).toThrow(/invalid presentation/)
    expect(() =>
      createMarkdownEditorCommandSnapshot(
        [{ ...bold, priority: Number.NaN }],
        ctx,
      ),
    ).toThrow(/priority must be finite/)
    expect(() =>
      resolveMarkdownEditorShortcut(
        [
          { ...bold, key: 'normalized-1', shortcut: 'Mod+B' },
          { ...bold, key: 'normalized-2', shortcut: 'mod + b' },
        ],
        'MOD+B',
      ),
    ).toThrow(/shortcut conflict/)
  })
})

describe('Issue #431: Async command cancellation, anchor rebase, and shared pending state', () => {
  it('tracks session through idle -> pending -> resolved/rejected/aborted/stale/deleted', () => {
    const ctx = makeContext()
    const session = createMarkdownEditorCommandSession('async-cmd', ctx, {
      anchor: { start: 5, end: 10 },
    })
    expect(session.state).toBe('pending')
    expect(session.attemptId).toContain('async-cmd-1-1-')

    // Concurrent submission guard
    const activeMap = new Map<string, MarkdownEditorCommandSession>([
      [session.key, session],
    ])
    expect(() =>
      createMarkdownEditorCommandSession('async-cmd', ctx, {
        activeSessions: activeMap,
        concurrent: false,
      }),
    ).toThrow(/already pending/)

    // Rebase with positionMap
    const positionMap = createMarkdownEditorPositionMap(
      [{ from: 0, to: 0, insert: 'PREFIX ' }],
      { source: 'Sample markdown text' },
    )
    const rebasedState = rebaseMarkdownEditorCommandSession(
      session,
      makeContext({ revision: 2 }),
      positionMap,
    )
    expect(rebasedState).toBe('pending')
    expect(session.anchor?.start).toBe(5 + 'PREFIX '.length)
    expect(session.revision).toBe(2)
    const composedMap = composeMarkdownEditorPositionMapInstances([
      positionMap,
      createMarkdownEditorPositionMap([{ from: 0, to: 0, insert: '>' }], {
        source: 'PREFIX Sample markdown text',
      }),
    ])
    expect(composedMap.map(5, -1)).toBe(13)
    expect(composedMap.mapRange({ start: 5, end: 10 })).toEqual({
      deleted: false,
      partiallyDeleted: false,
      range: { start: 13, end: 18 },
    })
    expect(composedMap.rebase({ start: 5, end: 10 })).toEqual({
      start: 13,
      end: 18,
      status: 'mapped',
    })
    expect(
      resolveMarkdownEditorCommandSession(
        session,
        makeContext({ revision: 2 }),
        'resolved-current',
      ),
    ).toBe('resolved-current')

    const unmapped = createMarkdownEditorCommandSession('unmapped', ctx, {
      anchor: { start: 5, end: 10 },
    })
    expect(
      rebaseMarkdownEditorCommandSession(
        unmapped,
        makeContext({ revision: 2 }),
      ),
    ).toBe('stale')

    const partial = createMarkdownEditorCommandSession('partial', ctx, {
      anchor: { start: 5, end: 10 },
    })
    const partialMap = createMarkdownEditorPositionMap(
      [{ from: 7, to: 8, insert: '' }],
      { source: 'Sample markdown text' },
    )
    expect(
      rebaseMarkdownEditorCommandSession(
        partial,
        makeContext({ revision: 2 }),
        partialMap,
      ),
    ).toBe('pending')
    expect(partial.anchor).toMatchObject({ start: 5, end: 9 })

    // Rebase when anchor is deleted
    session.state = 'pending'
    const deleteMap = createMarkdownEditorPositionMap(
      [{ from: 0, to: 20, insert: '' }],
      { source: 'Sample markdown text' },
    )
    const deletedState = rebaseMarkdownEditorCommandSession(
      session,
      makeContext({ revision: 3 }),
      deleteMap,
    )
    expect(deletedState).toBe('deleted')

    // Document epoch change aborts immediately
    const epochChangedCtx = makeContext({
      documentIdentity: { epoch: 2, id: 'doc-1' },
      revision: 4,
    })
    const abortedState = rebaseMarkdownEditorCommandSession(
      session,
      epochChangedCtx,
    )
    expect(abortedState).toBe('aborted')
    expect(session.abort.signal.aborted).toBe(true)

    // Late commit resolution when revision mismatches is rejected as stale
    const lateSession = createMarkdownEditorCommandSession('late-cmd', ctx)
    const staleResult = resolveMarkdownEditorCommandSession(
      lateSession,
      makeContext({ revision: 99 }),
      'resolved-current',
    )
    expect(staleResult).toBe('stale')
  })

  it('aborts active sessions and passes mutation evaluation', () => {
    const ctx = makeContext()
    const session1 = createMarkdownEditorCommandSession('cmd-1', ctx)
    const session2 = createMarkdownEditorCommandSession('cmd-2', ctx)
    abortMarkdownEditorCommandSessions([session1, session2], 'document reset')
    expect(session1.state).toBe('aborted')
    expect(session2.state).toBe('aborted')

    const report = evaluateMarkdownEditorCommandAsyncMutations()
    expect(report.mutations.every((m) => m.accepted === false)).toBe(true)
    expect(report.mutations.map((m) => m.kind)).toEqual([
      'naked-offset',
      'late-commit',
      'duplicate-submit',
      'local-pending',
      'internal-toast',
      'stale-commit',
      'uncancelled',
    ])
  })
})

describe('Issue #433: Locale authority, command/mode/capability, and zero write alias', () => {
  it('provides type-safe partial merge and fallback to default locale without write key', () => {
    const merged = resolveMarkdownEditorLocaleText({
      modes: {
        ...defaultMarkdownEditorLocaleText.modes,
        preview: 'Vista previa',
      },
      overflow: 'More tools',
    })
    expect(merged.modes.preview).toBe('Vista previa')
    expect(merged.modes.source).toBe(
      defaultMarkdownEditorLocaleText.modes.source,
    )
    expect(merged.overflow).toBe('More tools')

    // Verify zero write key anywhere in modes or commands
    expect('write' in defaultMarkdownEditorLocaleText.modes).toBe(false)
    expect('write' in defaultMarkdownEditorLocaleText.commands).toBe(false)
    expect('write' in merged.modes).toBe(false)
  })

  it('keeps eight locale overrides and long-copy fixtures isolated', () => {
    const locales = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko', 'ru', 'ar', 'de'].map(
      (locale) =>
        resolveMarkdownEditorLocaleText({
          editorAria: `${locale}-editor`,
          modes: { source: `${locale}-source` },
          commandPalette: {
            empty: `${locale}-empty`,
            searchPlaceholder: `${locale}-search`,
            title: `${locale}-palette`,
          },
          commandGroups: {
            block: `${locale}-block`,
            format: `${locale}-format`,
            insert: `${locale}-insert`,
          },
        }),
    )
    expect(new Set(locales.map((locale) => locale.editorAria)).size).toBe(8)
    expect(new Set(locales.map((locale) => locale.modes.source)).size).toBe(8)
    expect(
      new Set(locales.map((locale) => locale.commandGroups.format)).size,
    ).toBe(8)
    expect(
      locales.every(
        (locale) =>
          locale.modes.preview ===
          defaultMarkdownEditorLocaleText.modes.preview,
      ),
    ).toBe(true)

    const longLocale = resolveMarkdownEditorLocaleText({
      overflow: 'L'.repeat(120),
      commandPalette: {
        searchPlaceholder: 'S'.repeat(160),
      },
    })
    expect(longLocale.overflow).toHaveLength(120)
    expect(longLocale.commandPalette.searchPlaceholder).toHaveLength(160)
  })

  it('kills locale authority mutations with behavior-derived differences', () => {
    const report = evaluateMarkdownEditorLocaleMutations()
    expect(report.mutations.map(({ kind }) => kind)).toEqual([
      'hardcoded-copy',
      'error-string-matching',
      'cross-language-fallback',
      'duplicate-labels',
    ])
    expect(report.mutations.every(({ equivalent }) => !equivalent)).toBe(true)
    expect(report.mutations.every(({ accepted }) => !accepted)).toBe(true)
  })
})

describe('Issue #435: Status density none/minimal/detailed and stable slot payload', () => {
  it('resolves none, minimal, and detailed density with stable slot payload', () => {
    const text = 'Hello world\nSecond line\n'
    const noneStatus = resolveMarkdownEditorStatus(text, 'none')
    expect(noneStatus.visible).toBe(false)
    expect(noneStatus.ariaLiveMessage).toBe('')

    const minStatus = resolveMarkdownEditorStatus(text, 'minimal')
    expect(minStatus.visible).toBe(true)
    expect(minStatus.ariaLiveMessage).toBe('')

    const detailedStatus = resolveMarkdownEditorStatus(
      text,
      'detailed',
      undefined,
      { start: 0, end: 5 },
      ['synced-highlight'],
    )
    expect(detailedStatus.visible).toBe(true)
    expect(detailedStatus.slotPayload.metrics.lineCount).toBe(3)
    expect(detailedStatus.slotPayload.state.mode).toBe('source')
    expect(detailedStatus.slotPayload.capability).toContain('synced-highlight')
    expect(detailedStatus.ariaLiveMessage).toContain('编辑器能力')
  })

  it('passes status mutation evaluation', () => {
    const report = evaluateMarkdownEditorStatusMutations()
    expect(report.mutations.every((m) => m.accepted === false)).toBe(true)
    expect(report.mutations.map((m) => m.kind)).toEqual([
      'empty-footer',
      'badge-dashboard',
      'shrink-11px',
      'capability-swallowed',
      'full-rescan',
      'product-read-time',
    ])
  })
})

describe('Issue #366: Command toolbar density, grouping, and overflow', () => {
  it('resolves limits and splits primary vs overflow without second command list', () => {
    expect(resolveMarkdownEditorToolbarLimit('minimal', 12)).toBe(2)
    expect(resolveMarkdownEditorToolbarLimit('standard', 12)).toBe(6)
    expect(resolveMarkdownEditorToolbarLimit('full', 12)).toBe(12)

    const cmds = defaultMarkdownEditorCommands
    const primary = resolveMarkdownEditorPrimaryCommands(cmds, 'minimal')
    const overflow = resolveMarkdownEditorOverflowCommands(cmds, 'minimal')
    expect(primary.length).toBe(2)
    expect(overflow.length).toBe(cmds.length - 2)
  })

  it('sorts by priority and group independently of registration order at scale', () => {
    const thousandCommands = Array.from({ length: 1000 }, (_, index) => ({
      key: `command-${index}`,
      group: index % 2 ? 'insert' : 'format',
      priority: index,
    }))
    const forward = resolveMarkdownEditorPrimaryCommands(
      thousandCommands,
      'standard',
    ).map((command) => command.key)
    const reversed = resolveMarkdownEditorPrimaryCommands(
      [...thousandCommands].reverse(),
      'standard',
    ).map((command) => command.key)
    expect(reversed).toEqual(forward)
    expect(forward[0]).toBe('command-999')
    expect(
      resolveMarkdownEditorPrimaryCommands(
        [...thousandCommands].reverse(),
        'standard',
        ['command-1', 'command-999'],
      ).map((command) => command.key),
    ).toEqual(['command-999', 'command-1'])
    expect(resolveMarkdownEditorPrimaryCommands([], 'full')).toEqual([])
    expect(
      resolveMarkdownEditorOverflowCommands(thousandCommands, 'minimal'),
    ).toHaveLength(998)
  })

  it('passes toolbar mutation evaluation', () => {
    const report = evaluateMarkdownEditorToolbarMutations()
    expect(report.mutations.every((m) => m.accepted === false)).toBe(true)
    expect(report.mutations.map((m) => m.kind)).toEqual([
      'local-array',
      'order-grouping',
      'selection-lost',
      'mobile-button-wall',
    ])
  })
})

describe('Issue #367: Selection toolbar source-anchored placement and focus lifecycle', () => {
  it('determines placement correctly and closes on collapsed/stale selection or epoch mismatch', () => {
    const placement = resolveMarkdownSelectionToolbarPlacement(
      { start: 2, end: 8 },
      1,
      1,
      {
        documentEpoch: 1,
        expectedEpoch: 1,
      },
    )
    expect(placement.visible).toBe(true)
    expect(placement.reason).toBe('selection')
    expect(placement.anchor).toEqual({ start: 2, end: 8, epoch: 1 })

    const collapsed = resolveMarkdownSelectionToolbarPlacement(
      { start: 4, end: 4 },
      1,
      1,
    )
    expect(collapsed.visible).toBe(false)
    expect(collapsed.reason).toBe('collapsed')

    const stale = resolveMarkdownSelectionToolbarPlacement(
      { start: 2, end: 8 },
      1,
      2,
    )
    expect(stale.visible).toBe(false)
    expect(stale.reason).toBe('stale')

    const epochMismatch = resolveMarkdownSelectionToolbarPlacement(
      { start: 2, end: 8 },
      1,
      1,
      {
        documentEpoch: 1,
        expectedEpoch: 2,
      },
    )
    expect(epochMismatch.visible).toBe(false)
    expect(epochMismatch.reason).toBe('epoch-mismatch')

    const focusReturn = resolveMarkdownSelectionToolbarFocusReturn({
      start: 2,
      end: 8,
    })
    expect(focusReturn.target).toBe('editor')
    expect(focusReturn.selection).toEqual({ start: 2, end: 8 })
  })

  it('passes selection toolbar mutation evaluation', () => {
    const report = evaluateMarkdownSelectionToolbarMutations()
    expect(report.mutations.every((m) => m.accepted === false)).toBe(true)
    expect(report.mutations.map((m) => m.kind)).toEqual([
      'dom-placement',
      'naked-coordinates',
      'selection-lost',
      'stale-epoch-surface',
    ])
  })
})

describe('Issue #368: Command palette search, grouping, and unified state', () => {
  it('searches and groups commands with high performance for 1000 items', () => {
    const ctx = makeContext()
    const thousandCommands: MarkdownEditorCommand[] = Array.from(
      { length: 1000 },
      (_, i) => ({
        key: `cmd-${i}`,
        label: i === 999 ? 'Markdown Bold' : `Command ${i}`,
        group: i % 2 === 0 ? 'formatting' : 'insertion',
        presentation: ['palette' as const],
        run: () => ({}),
      }),
    )

    const start = performance.now()
    const results = searchMarkdownEditorCommands(thousandCommands, ctx, 'mnbd')
    const duration = performance.now() - start
    expect(results.length).toBe(1)
    expect(results[0]?.key).toBe('cmd-999')
    expect(duration).toBeLessThan(100)

    const groups = groupMarkdownEditorCommands(thousandCommands.slice(0, 10))
    expect(groups.has('formatting')).toBe(true)
    expect(groups.has('insertion')).toBe(true)
  })

  it('limits fuzzy search to label, description, and keywords', () => {
    const ctx = makeContext()
    const snapshot = createMarkdownEditorCommandSnapshot(
      [
        {
          group: 'formatting',
          key: 'alpha',
          keywords: ['secondary'],
          label: 'Alpha',
          presentation: ['palette'],
          run: () => ({}),
          title: 'Needle only in title',
        },
      ],
      ctx,
    )

    expect(searchMarkdownEditorCommandSnapshot(snapshot, 'scdy')).toHaveLength(
      1,
    )
    expect(
      searchMarkdownEditorCommandSnapshot(snapshot, 'needle'),
    ).toHaveLength(0)
  })

  it('passes command palette mutation evaluation', () => {
    const report = evaluateMarkdownCommandPaletteMutations()
    expect(report.mutations.every((m) => m.accepted === false)).toBe(true)
    expect(report.mutations.map((m) => m.kind)).toEqual([
      'local-command-list',
      'body-search',
      'stale-state',
      'card-wall',
    ])
  })
})

describe('Issue #369: Syntax input intent driven slash menu', () => {
  it('recognizes slash trigger only in valid block context and rejects forbidden contexts', () => {
    const slash = (source: string, caret: number, extras = {}) =>
      resolveMarkdownSlashQuery(source, caret, {
        projection: projectionFor(source),
        revision: 1,
        ...extras,
      })
    // Valid block start
    expect(slash('/cmd', 4)).toBe('cmd')
    expect(slash('Hello\n/list', 11)).toBe('list')

    // Block-only mode rejects mid-line slash
    expect(slash('word /test', 10, { blockOnly: true })).toBeNull()

    // Rejects URL context
    expect(slash('https://example.com/', 20)).toBeNull()
    expect(slash('http://x/', 9)).toBeNull()

    // Rejects inline code
    expect(slash('`code /slash', 12)).toBeNull()

    // Rejects math context
    expect(slash('$E=mc^2 /test', 13)).toBeNull()

    // Rejects escaped slash
    expect(slash('\\/escaped', 10)).toBeNull()

    // Rejects active composition
    expect(slash('/test', 5, { isComposing: true })).toBeNull()
  })

  it('plans slash commit replacing trigger text via transaction', () => {
    const source = 'Hello\n/cmd'
    const trigger = resolveMarkdownSlashTrigger(source, source.length, {
      projection: projectionFor(source),
      revision: 1,
    })!
    expect(trigger.query).toBe('cmd')
    const commitTx = planMarkdownSlashCommit(trigger.range, {
      changes: [
        {
          from: trigger.range.start,
          to: trigger.range.start,
          insert: '**bold**',
        },
      ],
      history: 'separate',
      origin: 'command',
    })
    expect(commitTx.changes[0]?.insert).toBe('')
    expect(commitTx.changes[0]?.from).toBe(trigger.range.start)
    expect(commitTx.changes[0]?.to).toBe(trigger.range.end)
    expect(commitTx.changes[1]?.insert).toBe('**bold**')
  })

  it('passes slash menu mutation evaluation', () => {
    const report = evaluateMarkdownSlashMenuMutations()
    expect(report.mutations.every((m) => m.accepted === false)).toBe(true)
    expect(report.mutations.map((m) => m.kind)).toEqual([
      'keydown-fork',
      'dom-context',
      'slash-hijack',
      'stale-execution',
    ])
  })
})

describe('Issue #443: Link property transaction, unwrap, and contextual interaction', () => {
  it('parses inline, reference, and autolinks with subranges', () => {
    const inline = projectedLink('[Docs](https://example.com "Title")')
    expect(inline.kind).toBe('inline')
    expect(inline.labelText).toBe('Docs')
    expect(inline.url).toBe('https://example.com')
    expect(inline.title).toBe('Title')

    const autolink = projectedLink('<https://test.io>')
    expect(autolink.kind).toBe('autolink')
    expect(autolink.labelText).toBe('https://test.io')

    const reference = projectedLink('[Link][1]')
    expect(reference.kind).toBe('reference')
    expect(reference.labelText).toBe('Link')
  })

  it('edits only the targeted link subranges preserving unaffected bytes', () => {
    const source = '[Docs](https://old.com "Old Title")'
    const parsed = projectedLink(source)
    const tx = planMarkdownLinkPropertyEdit(source, parsed, {
      url: 'https://new.com',
      title: 'New Title',
    })
    expect(tx.changes.length).toBe(2)
    expect(tx.origin).toBe('command')

    const unwrap = planMarkdownLinkUnwrap(source, parsed)
    expect(unwrap.changes[0]?.insert).toBe('Docs')
  })

  it('validates URL state and passes mutation evaluation', () => {
    const validation = validateMarkdownPropertyUrl('https://valid.com', {
      documentEpoch: 1,
      nodeId: 'link-1',
      revision: 1,
      value: 'https://valid.com',
      version: 1,
    })
    expect(validation.state).toBe('valid-external')

    const report = evaluateMarkdownPropertyMutations()
    expect(report.mutations.every((m) => m.accepted === false)).toBe(true)
    expect(report.mutations.map((m) => m.kind)).toEqual([
      'regex-dom',
      'whole-node-rewrite',
      'hover-only',
      'unsafe-url',
      'stale-node-commit',
      'stale-property',
    ])
  })
})

describe('Issue #447: Anchor insert/edit/remove/copy and block move/split/merge transaction', () => {
  it('inserts, edits, removes, and copies anchors via transactions', () => {
    const source = 'Block content'
    const insertTx = planMarkdownAnchorInsert(
      source,
      source.length,
      'my-anchor',
    )
    expect(insertTx.changes[0]?.insert).toBe(' ^my-anchor')

    const withAnchor = `${source}${insertTx.changes[0]?.insert}`
    const anchors = currentMarkdownAnchors(withAnchor)
    expect(anchors.length).toBe(1)
    const anchor = anchors[0]!
    expect(anchor.id).toBe('my-anchor')

    // Edit anchor id
    const editTx = planMarkdownAnchorEdit(withAnchor, anchor, 'updated-anchor')
    expect(editTx.changes[0]?.insert).toBe('updated-anchor')

    // Remove anchor
    const removeTx = planMarkdownAnchorRemove(anchor, withAnchor)
    expect(removeTx.changes[0]?.insert).toBe('')
    expect(removeTx.changes[0]?.from).toBe(anchor.ranges.full.start - 1)

    // Copy exact vs visible
    expect(planMarkdownAnchorCopy(anchor, 'exact')).toBe('^my-anchor')
    expect(planMarkdownAnchorCopy(anchor, 'visible')).toBe('')
  })

  it('handles block split, move, and merge transactions without silent drop', () => {
    const source = 'First paragraph ^first\n\nSecond paragraph ^second'
    const anchors = currentMarkdownAnchors(source)
    expect(anchors.length).toBe(2)

    // Move block
    const moveTx = planMarkdownBlockMove(
      source,
      { start: 0, end: 23 },
      source.length,
    )
    expect(moveTx.changes.length).toBe(2)

    // Merge requires explicit resolution if two anchors exist
    expect(() =>
      planMarkdownBlockMerge(
        source,
        { start: 0, end: 23, anchor: anchors[0] },
        { start: 25, end: source.length, anchor: anchors[1] },
        'reject',
      ),
    ).toThrow(/explicit resolution/)

    // Merge with keep-first removes second anchor
    const mergeTx = planMarkdownBlockMerge(
      source,
      { start: 0, end: 23, anchor: anchors[0] },
      { start: 25, end: source.length, anchor: anchors[1] },
      'keep-first',
    )
    expect(mergeTx.changes.some((c) => c.insert === '')).toBe(true)
  })

  it('passes anchor transaction mutation evaluation', () => {
    const report = evaluateMarkdownAnchorTransactionMutations()
    expect(report.mutations.every((m) => m.accepted === false)).toBe(true)
    expect(report.mutations.map((m) => m.kind)).toEqual([
      'auto-id',
      'direct-splice',
      'split-duplicate',
      'merge-silent-drop',
      'sidecar-state',
    ])
  })
})
