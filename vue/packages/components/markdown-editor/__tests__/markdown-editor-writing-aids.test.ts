import { describe, expect, it } from 'vitest'
import {
  createWritingAidsController,
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
    expect(resolveWritingAids({ typewriter: true, typewriterAnchor: 'center' }))
      .toMatchObject({ typewriterAnchor: 'center' })
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

    controller.updateDocument({ documentIdentity: 'document-b', documentEpoch: 2, revision: 4 })
    expect(controller.currentBlock).toBeNull()
    expect(controller.caretAnchor).toBeNull()
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

    expect(controller.handleUserScroll()).toMatchObject({ state: 'user-scroll-suspended' })
    expect(controller.handleSelectionChange()).toMatchObject({ scroll: false })
    expect(controller.handleInput()).toMatchObject({ state: 'restoring', scroll: true })
    expect(controller.handleNavigation()).toMatchObject({ state: 'explicit-navigation', scroll: true })
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

    expect(controller.handleCompositionStart()).toMatchObject({ state: 'composition-suspended', scroll: false })
    expect(controller.handleProjectionChange()).toMatchObject({ scroll: false })
    expect(controller.handleCompositionEnd()).toMatchObject({ smooth: false })
    expect(controller.handleSelectionDragStart()).toMatchObject({ state: 'selection-drag-suspended', scroll: false })
  })
})
