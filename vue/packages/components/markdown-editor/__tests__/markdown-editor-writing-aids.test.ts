import { describe, expect, it } from 'vitest'
import {
  calculateTypewriterScrollTarget,
  createMarkdownFocusSegments,
  createWritingAidsController,
  evaluateMarkdownFocusMutations,
  evaluateMarkdownTypewriterMutations,
  resolveFocusState,
  resolveWritingAids,
} from '../src/markdown-editor-writing-aids'

describe('markdown-editor writing aids contract', () => {
  it('keeps writing aids disabled by default and defaults an enabled typewriter to upper-third', () => {
    expect(resolveWritingAids()).toMatchObject({
      focus: false,
      typewriter: false,
      typewriterAnchor: 'upper-third',
    })
    expect(resolveWritingAids({ typewriter: true })).toMatchObject({
      focus: false,
      typewriter: true,
      typewriterAnchor: 'upper-third',
    })
    expect(
      resolveWritingAids({ typewriter: true, typewriterAnchor: 'center' }),
    ).toMatchObject({ typewriterAnchor: 'center' })
  })

  it('derives the active block from the projection identity and invalidates stale epochs', () => {
    const controller = createWritingAidsController({
      documentIdentity: 'document-a',
      documentEpoch: 1,
      revision: 4,
      projection: {
        currentBlock: { id: 'block-a', sourceRange: [3, 8] },
        caretAnchor: { blockId: 'block-a', sourceOffset: 5 },
      },
    })

    expect(controller.currentBlock).toMatchObject({ id: 'block-a' })
    expect(controller.caretAnchor).toMatchObject({ blockId: 'block-a' })

    controller.updateDocument({
      documentIdentity: 'document-b',
      documentEpoch: 2,
      revision: 4,
    })
    expect(controller.currentBlock).toBeNull()
    expect(controller.caretAnchor).toBeNull()

    controller.updateDocument({
      documentIdentity: 'document-b',
      documentEpoch: 2,
      revision: 5,
      source: '# Updated',
      currentBlock: { id: 'block-b', sourceRange: [0, 9] },
      caretAnchor: { blockId: 'block-b', sourceOffset: 4 },
    })
    expect(controller.currentBlock).toMatchObject({ id: 'block-b' })
    expect(controller.caretAnchor).toMatchObject({ blockId: 'block-b' })
  })

  it('suspends after manual scrolling and only restores positioning after later input or explicit navigation', () => {
    const controller = createWritingAidsController({
      documentIdentity: 'document-a',
      documentEpoch: 1,
      revision: 1,
      projection: {
        currentBlock: { id: 'block-a', sourceRange: [0, 1] },
        caretAnchor: { blockId: 'block-a', sourceOffset: 0 },
      },
    })

    expect(controller.handleUserScroll()).toMatchObject({
      state: 'user-scroll-suspended',
    })
    expect(controller.handleSelectionChange()).toMatchObject({ scroll: false })
    expect(controller.handleInput()).toMatchObject({
      state: 'restoring',
      scroll: false,
    })
    expect(controller.handleInput()).toMatchObject({
      state: 'input-driven',
      scroll: true,
    })
    expect(controller.handleNavigation()).toMatchObject({
      state: 'explicit-navigation',
      scroll: true,
    })
  })

  it('does not scroll during composition or selection dragging and disables smooth motion when reduced motion is requested', () => {
    const controller = createWritingAidsController({
      documentIdentity: 'document-a',
      documentEpoch: 1,
      revision: 1,
      reducedMotion: true,
      projection: {
        currentBlock: { id: 'block-a', sourceRange: [0, 1] },
        caretAnchor: { blockId: 'block-a', sourceOffset: 0 },
      },
    })

    expect(controller.handleCompositionStart()).toMatchObject({
      state: 'composition-suspended',
      scroll: false,
    })
    expect(controller.handleProjectionChange()).toMatchObject({ scroll: false })
    expect(controller.handleCompositionEnd()).toMatchObject({ smooth: false })
    expect(controller.handleSelectionDragStart()).toMatchObject({
      state: 'selection-drag-suspended',
      scroll: false,
    })
  })
})

describe('focus mode current-block presentation and accessibility (#439)', () => {
  const sampleNodes = [
    { id: 'heading:0', kind: 'heading', rawRange: { start: 0, end: 10 } },
    { id: 'paragraph:1', kind: 'paragraph', rawRange: { start: 12, end: 35 } },
    { id: 'paragraph:2', kind: 'paragraph', rawRange: { start: 37, end: 60 } },
    { id: 'code:3', kind: 'code', rawRange: { start: 62, end: 85 } },
  ]
  const sampleSource =
    '# Heading\n\nFirst paragraph text.\n\nSecond paragraph text.\n\n```ts\ncode block\n```\n'

  it('remains disabled by default and only activates in editable prose scenarios', () => {
    // Default disabled
    const defaultState = resolveFocusState({
      source: sampleSource,
      projection: { nodes: sampleNodes },
      caret: 5,
    })
    expect(defaultState.enabled).toBe(false)
    expect(defaultState.activeBlockId).toBeNull()

    // Disabled in markdown profile (ordinary profile)
    const ordinaryProfileState = resolveFocusState({
      writingAids: { focus: true },
      editorProfile: 'markdown',
      source: sampleSource,
      projection: { nodes: sampleNodes },
      caret: 5,
    })
    expect(ordinaryProfileState.enabled).toBe(false)

    // Disabled when readonly
    const readonlyState = resolveFocusState({
      writingAids: { focus: true },
      editorProfile: 'prose',
      readonly: true,
      source: sampleSource,
      projection: { nodes: sampleNodes },
      caret: 5,
    })
    expect(readonlyState.enabled).toBe(false)

    // Enabled in prose editable mode
    const proseState = resolveFocusState({
      writingAids: { focus: true },
      editorProfile: 'prose',
      source: sampleSource,
      projection: { nodes: sampleNodes },
      caret: 5,
    })
    expect(proseState.enabled).toBe(true)
    expect(proseState.activeBlockId).toBe('heading:0')
  })

  it('determines block attribution unambiguously from source position without DOM querying', () => {
    // Caret at marker / start of heading
    const atMarker = resolveFocusState({
      focus: true,
      editorProfile: 'prose',
      source: sampleSource,
      projection: { nodes: sampleNodes },
      caret: 0,
    })
    expect(atMarker.activeBlockId).toBe('heading:0')

    // Caret inside paragraph
    const insidePara = resolveFocusState({
      focus: true,
      editorProfile: 'prose',
      source: sampleSource,
      projection: { nodes: sampleNodes },
      caret: 20,
    })
    expect(insidePara.activeBlockId).toBe('paragraph:1')

    // Caret at document end
    const atEnd = resolveFocusState({
      focus: true,
      editorProfile: 'prose',
      source: sampleSource,
      projection: { nodes: sampleNodes },
      caret: sampleSource.length,
    })
    expect(atEnd.activeBlockId).toBe('code:3')

    // Caret between blocks on empty line
    const onEmptyLine = resolveFocusState({
      focus: true,
      editorProfile: 'prose',
      source: sampleSource,
      projection: { nodes: sampleNodes },
      caret: 11,
    })
    expect(onEmptyLine.activeBlockId).toBe('heading:0')
  })

  it('keeps the entire selection active when spanning multiple blocks without partial dimming', () => {
    const spanning = resolveFocusState({
      focus: true,
      editorProfile: 'prose',
      source: sampleSource,
      projection: { nodes: sampleNodes },
      selection: { start: 15, end: 45 },
    })

    expect(spanning.enabled).toBe(true)
    expect(spanning.activeBlockIds).toContain('paragraph:1')
    expect(spanning.activeBlockIds).toContain('paragraph:2')
    expect(spanning.activeRange).toEqual({ start: 12, end: 60 })

    const para1 = spanning.blocks.find((b) => b.id === 'paragraph:1')!
    const para2 = spanning.blocks.find((b) => b.id === 'paragraph:2')!
    expect(para1.active).toBe(true)
    expect(para1.dimmed).toBe(false)
    expect(para2.active).toBe(true)
    expect(para2.dimmed).toBe(false)

    // Non-selected blocks are dimmed
    const heading = spanning.blocks.find((b) => b.id === 'heading:0')!
    expect(heading.active).toBe(false)
    expect(heading.dimmed).toBe(true)
  })

  it('exempts search matches, diagnostics, property editor, pending attachments, and screen-reader targets from dimming', () => {
    const exempted = resolveFocusState({
      focus: true,
      editorProfile: 'prose',
      source: sampleSource,
      projection: { nodes: sampleNodes },
      caret: 5,
      exemptions: {
        searchMatches: ['paragraph:2'],
        diagnostics: ['code:3'],
        propertyEditorNodeId: null,
        pendingAttachmentIds: [],
        screenReaderBrowseTargetId: 'paragraph:1',
      },
    })

    expect(exempted.activeBlockId).toBe('heading:0')
    const activeBlock = exempted.blocks.find((b) => b.id === 'heading:0')!
    expect(activeBlock.active).toBe(true)
    expect(activeBlock.dimmed).toBe(false)

    const para1 = exempted.blocks.find((b) => b.id === 'paragraph:1')!
    expect(para1.exempt).toBe(true)
    expect(para1.dimmed).toBe(false)

    const para2 = exempted.blocks.find((b) => b.id === 'paragraph:2')!
    expect(para2.exempt).toBe(true)
    expect(para2.dimmed).toBe(false)

    const codeBlock = exempted.blocks.find((b) => b.id === 'code:3')!
    expect(codeBlock.exempt).toBe(true)
    expect(codeBlock.dimmed).toBe(false)

    const segments = createMarkdownFocusSegments(sampleSource, exempted)
    expect(
      segments.find((segment) => segment.nodeId === 'paragraph:1'),
    ).toMatchObject({ dimmed: false, exempt: true })
    expect(
      segments.find((segment) => segment.nodeId === 'paragraph:2'),
    ).toMatchObject({ dimmed: false, exempt: true })
    expect(
      segments.find((segment) => segment.nodeId === 'code:3'),
    ).toMatchObject({ dimmed: false, exempt: true })
    expect(segments.map((segment) => segment.text).join('')).toBe(sampleSource)
  })

  it('uses only top-level source blocks and disables presentation in preview mode', () => {
    const source = '# [Title](https://example.test)\n'
    const state = resolveFocusState({
      focus: true,
      editorProfile: 'prose',
      mode: 'source',
      source,
      projection: {
        nodes: [
          {
            id: 'heading',
            kind: 'heading',
            parentRawRange: null,
            rawRange: { start: 0, end: source.length },
          },
          {
            id: 'link',
            kind: 'link',
            parentRawRange: { start: 0, end: source.length },
            rawRange: { start: 2, end: source.length - 1 },
          },
        ],
      },
      caret: 4,
    })
    expect(state.blocks.map((block) => block.id)).toEqual(['heading'])

    expect(
      resolveFocusState({
        ...state,
        focus: true,
        editorProfile: 'prose',
        mode: 'preview',
        source,
      } as never).enabled,
    ).toBe(false)
  })

  it('preserves readable WCAG contrast without blur, hide, mask, or glow', () => {
    const state = resolveFocusState({
      focus: true,
      editorProfile: 'prose',
      source: sampleSource,
      projection: { nodes: sampleNodes },
      caret: 5,
    })

    expect(state.presentation.dimmedOpacity).toBeGreaterThanOrEqual(0.6)
    expect(state.presentation.blur).toBe(false)
    expect(state.presentation.hidden).toBe(false)
    expect(state.presentation.mask).toBe(false)
  })

  it('resets focus state upon document switch', () => {
    const docA = resolveFocusState({
      focus: true,
      editorProfile: 'prose',
      source: sampleSource,
      projection: { nodes: sampleNodes },
      caret: 5,
      previousDocumentId: 'doc-a',
      currentDocumentId: 'doc-b',
    })
    expect(docA.enabled).toBe(false)
    expect(docA.activeBlockId).toBeNull()
  })

  it('kills blur/hide, DOM current block, selection partial dim, and ordinary profile observer mutations', () => {
    const report = evaluateMarkdownFocusMutations({
      focus: true,
      editorProfile: 'prose',
      source: sampleSource,
      projection: { nodes: sampleNodes },
      selection: { start: 15, end: 45 },
    })

    expect(report.mutations.map((m) => m.kind)).toEqual([
      'blur-hide',
      'dom-current-block',
      'selection-partial-dim',
      'ordinary-profile-observer',
    ])
    for (const mutation of report.mutations) {
      expect(mutation.accepted).toBe(false)
      expect(mutation.equivalent).toBe(false)
    }
  })
})

describe('upper-third typewriter scrolling state machine (#440)', () => {
  it('strictly defaults anchor to upper-third and requires explicit opt-in for center', () => {
    const defaultAids = resolveWritingAids({ typewriter: true })
    expect(defaultAids.typewriterAnchor).toBe('upper-third')

    const centerAids = resolveWritingAids({
      typewriter: true,
      typewriterAnchor: 'center',
    })
    expect(centerAids.typewriterAnchor).toBe('center')
  })

  it('operates the complete 7-state typewriter state machine correctly', () => {
    const controller = createWritingAidsController({
      typewriter: true,
      typewriterAnchor: 'upper-third',
    })

    // 1. Initial idle state
    expect(controller.state).toBe('idle')

    // 2. Input drives input-driven state
    expect(controller.handleInput()).toMatchObject({
      state: 'input-driven',
      scroll: true,
    })

    // 3. Selection change alone does NOT trigger scroll
    expect(controller.handleSelectionChange()).toMatchObject({ scroll: false })
    expect(controller.state).toBe('input-driven')

    // 4. User scroll suspends positioning
    expect(controller.handleUserScroll()).toMatchObject({
      state: 'user-scroll-suspended',
      scroll: false,
    })
    expect(controller.suspendReason).toBe('user-scroll')

    // 5. Subsequent input restores positioning
    expect(controller.handleInput()).toMatchObject({
      state: 'restoring',
      scroll: false,
    })
    expect(controller.suspendReason).toBeUndefined()
    expect(controller.handleInput()).toMatchObject({
      state: 'input-driven',
      scroll: true,
    })

    // 6. Explicit navigation transitions to explicit-navigation
    expect(controller.handleExplicitNavigation()).toMatchObject({
      state: 'explicit-navigation',
      scroll: true,
    })

    // 7. Selection drag suspends positioning
    expect(controller.handleSelectionDragStart()).toMatchObject({
      state: 'selection-drag-suspended',
      scroll: false,
    })
    expect(controller.handleSelectionDragEnd()).toMatchObject({ scroll: false })
    expect(controller.state).toBe('idle')

    // 8. IME composition suspends positioning
    expect(controller.handleCompositionStart()).toMatchObject({
      state: 'composition-suspended',
      scroll: false,
    })
    expect(controller.handleCompositionEnd()).toMatchObject({ scroll: false })
    expect(controller.state).toBe('idle')
  })

  it('calculates upper-third (1/3) and center (1/2) scroll targets with sticky toolbar, safe area, and visual viewport', () => {
    const multilineSource = Array.from(
      { length: 50 },
      (_, i) => `Line ${i}`,
    ).join('\n')

    // Upper-third calculation
    const upperThirdTarget = calculateTypewriterScrollTarget({
      anchor: 'upper-third',
      caretSourceOffset: 200, // around line 28
      source: multilineSource,
      viewportHeight: 600,
      lineHeight: 20,
      stickyToolbarHeight: 40,
      safeAreaInsetTop: 10,
      safeAreaInsetBottom: 10,
    })

    expect(upperThirdTarget.anchorRatio).toBeCloseTo(1 / 3, 4)
    expect(upperThirdTarget.smooth).toBe(true)
    // Usable height: 600 - 40 - 10 - 10 = 540. Target in viewport: 40 + 10 + 540 * (1/3) = 230.
    expect(upperThirdTarget.targetOffsetInViewport).toBe(230)

    // Center calculation
    const centerTarget = calculateTypewriterScrollTarget({
      anchor: 'center',
      caretSourceOffset: 200,
      source: multilineSource,
      viewportHeight: 600,
      lineHeight: 20,
      stickyToolbarHeight: 40,
      safeAreaInsetTop: 10,
      safeAreaInsetBottom: 10,
    })

    expect(centerTarget.anchorRatio).toBe(0.5)
    // Usable height: 540. Target in viewport: 40 + 10 + 540 * 0.5 = 320.
    expect(centerTarget.targetOffsetInViewport).toBe(320)

    // Soft keyboard / smaller visualViewport
    const keyboardTarget = calculateTypewriterScrollTarget({
      anchor: 'upper-third',
      caretSourceOffset: 200,
      source: multilineSource,
      viewportHeight: 600,
      visualViewportHeight: 350,
      visualViewportOffsetTop: 24,
      lineHeight: 20,
      stickyToolbarHeight: 40,
    })
    // Usable height: 350 - 40 = 310. Target in viewport: 40 + 310 * (1/3) = 143.
    expect(keyboardTarget.targetOffsetInViewport).toBe(
      Math.round(24 + 40 + 310 / 3),
    )
  })

  it('cancels smooth motion when reduced motion is enabled but preserves scroll target', () => {
    const multilineSource = 'Line 0\nLine 1\nLine 2\nLine 3\nLine 4\n'
    const target = calculateTypewriterScrollTarget({
      anchor: 'upper-third',
      caretSourceOffset: 15,
      source: multilineSource,
      viewportHeight: 300,
      lineHeight: 20,
      reducedMotion: true,
    })

    expect(target.smooth).toBe(false)
    expect(typeof target.scrollTop).toBe('number')
  })

  it('keeps source caret line anchored through async height and content expansion', () => {
    const initialSource = 'Header\n\nPara 1\n\nPara 2\n'
    const targetBefore = calculateTypewriterScrollTarget({
      anchor: 'upper-third',
      caretSourceOffset: 10, // In Para 1 (line 2)
      source: initialSource,
      viewportHeight: 500,
      lineHeight: 24,
    })
    expect(targetBefore.caretLine).toBe(2)

    // Content expands below the anchor
    const expandedSource =
      'Header\n\nPara 1\n\n[Async Attachment Image Rendered]\n\nPara 2\n'
    const targetAfter = calculateTypewriterScrollTarget({
      anchor: 'upper-third',
      caretSourceOffset: 10,
      source: expandedSource,
      viewportHeight: 500,
      lineHeight: 24,
    })
    expect(targetAfter.caretLine).toBe(2)
    expect(targetAfter.scrollTop).toBe(targetBefore.scrollTop)

    const controller = createWritingAidsController({ typewriter: true })
    expect(controller.handleAsyncLayoutChange()).toMatchObject({
      scroll: false,
      state: 'idle',
    })
    controller.handleInput()
    expect(controller.handleAsyncLayoutChange()).toMatchObject({
      scroll: true,
      state: 'input-driven',
    })
    controller.handleUserScroll()
    expect(controller.handleAsyncLayoutChange()).toMatchObject({
      scroll: false,
      state: 'user-scroll-suspended',
    })
  })

  it('kills center default, selection change recentering, DOM anchor, scroll stealing, and reduced smooth motion mutations', () => {
    const report = evaluateMarkdownTypewriterMutations({
      typewriter: true,
      typewriterAnchor: 'upper-third',
    })

    expect(report.mutations.map((m) => m.kind)).toEqual([
      'center-default',
      'selection-change-recenter',
      'dom-anchor',
      'scroll-stealing',
      'reduced-smooth-motion',
    ])
    for (const mutation of report.mutations) {
      expect(mutation.accepted).toBe(false)
      expect(mutation.equivalent).toBe(false)
    }
  })
})
