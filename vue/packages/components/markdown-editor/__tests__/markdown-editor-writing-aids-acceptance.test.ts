import { describe, expect, it } from 'vitest'

import {
  commitMarkdownOutlineActive,
  resolveMarkdownOutlineNavigationOwner,
} from '../src/markdown-editor-outline-active'
import {
  calculateTypewriterScrollTarget,
  createMarkdownFocusSegments,
  createWritingAidsController,
  evaluateMarkdownWritingAidsAcceptanceMutations,
  resolveFocusState,
  resolveWritingAids,
} from '../src/markdown-editor-writing-aids'

// Corpus required by #441: table, code, image, Mermaid, LaTeX, attachment
// embed, and continuous empty lines, with projection-derived block identity.
// Ranges are computed while joining so the fixture cannot drift from source.
const corpusBlocks = [
  { id: 'heading:0', kind: 'heading', text: '# Session' },
  { id: 'table:1', kind: 'table', text: '| a | b |\n| --- | --- |\n| 1 | 2 |' },
  { id: 'code:2', kind: 'code', text: '```ts\nconst value = 1\n```' },
  {
    id: 'image:3',
    kind: 'image',
    text: '![Diagram](https://example.test/diagram.png)',
  },
  { id: 'mermaid:4', kind: 'code', text: '```mermaid\ngraph TD; A-->B;\n```' },
  { id: 'latex:5', kind: 'math', text: '$$E = mc^2$$' },
  {
    id: 'embed:6',
    kind: 'embed',
    text: '::embed[target="attachment.pdf" mode="block"]',
  },
  {
    id: 'paragraph:7',
    kind: 'paragraph',
    text: 'Trailing paragraph after continuous empty lines.',
  },
] as const

const corpusSource = (() => {
  let source = ''
  for (const [index, block] of corpusBlocks.entries()) {
    // Continuous empty lines before the trailing paragraph.
    source += index === corpusBlocks.length - 1 ? '\n\n\n' : index > 0 ? '\n\n' : ''
    source += block.text
  }
  return `${source}\n`
})()

const corpusNodes = (() => {
  const nodes: {
    id: string
    kind: string
    rawRange: { start: number; end: number }
  }[] = []
  for (const block of corpusBlocks) {
    const start = corpusSource.indexOf(block.text)
    nodes.push({
      id: block.id,
      kind: block.kind,
      rawRange: { start, end: start + block.text.length },
    })
  }
  return nodes
})()

const corpusCaret = corpusNodes[1]!.rawRange.start + 1

describe('markdown writing aids combined acceptance (#441)', () => {
  it('covers Focus only, Typewriter only, both, and all-disabled combinations', () => {
    const combinations = [
      { options: { focus: true }, focus: true, typewriter: false },
      { options: { typewriter: true }, focus: false, typewriter: true },
      {
        options: { focus: true, typewriter: true },
        focus: true,
        typewriter: true,
      },
      { options: {}, focus: false, typewriter: false },
    ] as const

    for (const combination of combinations) {
      const resolved = resolveWritingAids(combination.options)
      expect(resolved.focus).toBe(combination.focus)
      expect(resolved.typewriter).toBe(combination.typewriter)
      expect(resolved.typewriterAnchor).toBe('upper-third')

      const controller = createWritingAidsController({
        ...combination.options,
        documentIdentity: 'doc-a',
        documentEpoch: 1,
        revision: 1,
        editorProfile: 'prose',
        source: corpusSource,
        projection: { nodes: corpusNodes },
        caret: corpusCaret,
      })
      expect(controller.focusState.enabled).toBe(combination.focus)

      // Default-disabled and Focus-only combinations never auto-scroll:
      // the async layout task is gated on the typewriter option.
      controller.handleInput()
      const asyncResponse = controller.handleAsyncLayoutChange() as {
        scroll?: boolean
      }
      expect(asyncResponse.scroll).toBe(combination.typewriter)
    }
  })

  it('keeps block attribution and segments projection-derived across the rich corpus', () => {
    const state = resolveFocusState({
      focus: true,
      editorProfile: 'prose',
      source: corpusSource,
      projection: { nodes: corpusNodes },
      caret: corpusCaret, // inside the table block
      exemptions: { searchMatches: ['latex:5'] },
    })
    expect(state.enabled).toBe(true)
    expect(state.activeBlockId).toBe('table:1')
    expect(state.blocks.map((block) => block.id)).toEqual(
      corpusNodes.map((node) => node.id),
    )

    const segments = createMarkdownFocusSegments(corpusSource, state)
    expect(segments.map((segment) => segment.text).join('')).toBe(corpusSource)
    expect(
      segments.find((segment) => segment.nodeId === 'latex:5'),
    ).toMatchObject({ dimmed: false, exempt: true })

    // Typewriter caret line stays anchored on the source offsets even when
    // async features (Mermaid/LaTeX/image) change rendered height below.
    const before = calculateTypewriterScrollTarget({
      anchor: 'upper-third',
      caretSourceOffset: corpusCaret,
      source: corpusSource,
      viewportHeight: 600,
      lineHeight: 20,
    })
    expect(before.caretLine).toBe(2)
  })

  it('restores deterministically after outline/search/reveal take temporary navigation priority', () => {
    const controller = createWritingAidsController({
      typewriter: true,
      typewriterAnchor: 'upper-third',
      documentIdentity: 'doc-a',
      documentEpoch: 1,
      revision: 1,
    })

    // Typing owns navigation first.
    expect(controller.handleInput()).toMatchObject({
      state: 'input-driven',
      scroll: true,
    })
    expect(resolveMarkdownOutlineNavigationOwner('typing', 'typing')).toBe(
      'typing',
    )

    // A search jump takes temporary priority.
    expect(resolveMarkdownOutlineNavigationOwner('typing', 'search')).toBe(
      'search',
    )
    expect(controller.handleExplicitNavigation()).toMatchObject({
      state: 'explicit-navigation',
      scroll: true,
    })

    // Manual scroll suspends the temporary owner; the suspend is immediate.
    expect(resolveMarkdownOutlineNavigationOwner('search', 'manual-scroll')).toBe(
      'manual-scroll',
    )
    expect(controller.handleUserScroll()).toMatchObject({
      state: 'user-scroll-suspended',
      scroll: false,
    })

    // Restoration is deterministic: the first input after a suspend passes
    // through `restoring` without stealing the scroll, the second resumes.
    expect(controller.handleInput()).toMatchObject({
      state: 'restoring',
      scroll: false,
    })
    expect(controller.handleInput()).toMatchObject({
      state: 'input-driven',
      scroll: true,
    })
    expect(
      resolveMarkdownOutlineNavigationOwner('manual-scroll', 'typing'),
    ).toBe('typing')

    // An outline jump re-takes priority, and a stale-epoch outline result is
    // rejected instead of committing against the switched document.
    expect(resolveMarkdownOutlineNavigationOwner('typing', 'outline')).toBe(
      'outline',
    )
    expect(controller.handleNavigation()).toMatchObject({
      state: 'explicit-navigation',
      scroll: true,
    })
    const active = {
      headingId: 'syn:heading:1',
      documentId: 'doc-a',
      documentEpoch: 1,
      revision: 2,
      cause: 'outline' as const,
      owner: 'outline' as const,
      suspended: false,
    }
    expect(
      commitMarkdownOutlineActive(
        { documentId: 'doc-a', documentEpoch: 2, revision: 1 },
        active,
      ),
    ).toEqual({ rejected: 'stale' })
    controller.updateDocument({
      documentIdentity: 'doc-a',
      documentEpoch: 2,
      revision: 1,
    })
    expect(controller.state).toBe('idle')
  })

  it('keeps the default-disabled ordinary profile free of resident observers and bounded per-event cost', () => {
    const ordinary = resolveFocusState({
      writingAids: { focus: true, typewriter: true },
      editorProfile: 'markdown',
      source: corpusSource,
      projection: { nodes: corpusNodes },
      caret: corpusCaret,
    })
    expect(ordinary.enabled).toBe(false)
    expect(ordinary.blocks).toEqual([])

    // Default-disabled selection/projection churn stays cheap: 5,000 events
    // must not approach a per-event full-document cost.
    const controller = createWritingAidsController({
      documentIdentity: 'doc-a',
      documentEpoch: 1,
      revision: 1,
    })
    const started = performance.now()
    for (let index = 0; index < 5_000; index += 1) {
      controller.handleSelectionChange()
      controller.handleProjectionChange()
    }
    const elapsed = performance.now() - started
    expect(elapsed).toBeLessThan(1_000)
  })

  it('kills center default, blur Focus, scroll loop, stale epoch task, and screen-reader caret stealing', () => {
    const report = evaluateMarkdownWritingAidsAcceptanceMutations(
      {
        focus: true,
        editorProfile: 'prose',
        source: corpusSource,
        projection: { nodes: corpusNodes },
        caret: corpusCaret,
        exemptions: { screenReaderBrowseTargetId: 'paragraph:7' },
      },
      { focus: true, typewriter: true },
    )

    expect(report.mutations.map((mutation) => mutation.kind)).toEqual([
      'center-default',
      'blur-focus',
      'scroll-loop',
      'stale-epoch-task',
      'screen-reader-caret-stealing',
    ])
    for (const mutation of report.mutations) {
      expect(mutation.accepted).toBe(false)
      expect(mutation.equivalent).toBe(false)
    }
  })
})
