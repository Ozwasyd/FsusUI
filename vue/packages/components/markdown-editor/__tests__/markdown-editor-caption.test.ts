import { describe, expect, it } from 'vitest'

import {
  escapeCaptionText,
  evaluateMarkdownCaptionAcceptance,
  evaluateMarkdownCaptionAcceptanceMutations,
  findMarkdownFigures,
  formatMarkdownFigureExactCopy,
  formatMarkdownFigureVisibleCopy,
  planMarkdownCaptionEdit,
  planMarkdownCaptionInsert,
  planMarkdownCaptionRemove,
  planMarkdownFigureCut,
  planMarkdownFigureDelete,
  planMarkdownFigureMove,
} from '../src/markdown-editor-caption'

describe('markdown caption editor commands and figure atomic transactions (#478)', () => {
  it('inserts, edits, and removes captions using #268 transactions', () => {
    const source = '![sunset](https://cdn.example/sunset.jpg)\n'
    const mediaRange = { start: 0, end: source.indexOf('\n') }

    // Insert caption
    const insertTx = planMarkdownCaptionInsert(source, mediaRange, 'Sunset over the bay')
    expect(insertTx.changes).toHaveLength(1)
    expect(insertTx.changes[0]?.from).toBe(mediaRange.end)
    expect(insertTx.changes[0]?.insert).toBe('\n::caption[Sunset over the bay]')

    // Edit caption text subrange
    const withCaption = `${source}::caption[Initial caption]\n`
    const figures = findMarkdownFigures(withCaption)
    expect(figures).toHaveLength(1)
    const captionNode = figures[0]!.captionNode
    const editTx = planMarkdownCaptionEdit(withCaption, captionNode, 'Updated caption [escaped]')
    expect(editTx.changes).toHaveLength(1)
    expect(editTx.changes[0]?.from).toBe(captionNode.ranges.text.start)
    expect(editTx.changes[0]?.to).toBe(captionNode.ranges.text.end)
    expect(editTx.changes[0]?.insert).toBe('Updated caption [escaped\\]')

    // Remove caption
    const removeTx = planMarkdownCaptionRemove(withCaption, captionNode)
    expect(removeTx.changes).toHaveLength(1)
    expect(removeTx.changes[0]?.insert).toBe('')
    expect(removeTx.changes[0]?.to).toBe(captionNode.ranges.full.end)
  })

  it('deletes, moves, and cuts image+caption figures atomically without ghost captions', () => {
    const source = 'Header\n\n![diagram](diag.png)\n::caption[Figure 1. Flowchart]\n\nFooter'
    const figures = findMarkdownFigures(source)
    expect(figures).toHaveLength(1)
    const figure = figures[0]!

    // Atomic delete: deletes both media and caption
    const deleteTx = planMarkdownFigureDelete(source, figure)
    expect(deleteTx.changes).toHaveLength(1)
    expect(deleteTx.changes[0]?.from).toBe(figure.mediaRange.start)
    expect(deleteTx.changes[0]?.to).toBeGreaterThanOrEqual(figure.captionRange.end)
    expect(deleteTx.changes[0]?.insert).toBe('')

    // Atomic move
    const moveTx = planMarkdownFigureMove(source, figure, 0)
    expect(moveTx.changes).toHaveLength(2)
    const movedInsert = moveTx.changes.find((c) => c.insert.length > 0)
    expect(movedInsert?.insert).toContain('![diagram](diag.png)')
    expect(movedInsert?.insert).toContain('::caption[Figure 1. Flowchart]')

    // Atomic cut
    const cut = planMarkdownFigureCut(source, figure)
    expect(cut.copyPayload).toContain('![diagram](diag.png)')
    expect(cut.copyPayload).toContain('::caption[Figure 1. Flowchart]')
    expect(cut.transaction.changes[0]?.insert).toBe('')
  })

  it('formats exact Markdown copy and visible copy correctly', () => {
    const source = '![alt text](diagram.png)\n::caption[A useful diagram]'
    const figures = findMarkdownFigures(source)
    expect(figures).toHaveLength(1)
    const figure = figures[0]!

    const exactCopy = formatMarkdownFigureExactCopy(source, figure)
    expect(exactCopy).toBe('![alt text](diagram.png)\n::caption[A useful diagram]')

    const visibleCopy = formatMarkdownFigureVisibleCopy(source, figure)
    expect(visibleCopy).toContain('A useful diagram')
    expect(visibleCopy).not.toContain('::caption[')
  })

  it('supports Unicode, CRLF, BOM, CJK, emoji, and RTL captions without drift', () => {
    const unicodeSource = '\uFEFF![图注](img.png)\r\n::caption[图 1. 结构与 emoji 🚀 and RTL עִברִית]\r\n'
    const figures = findMarkdownFigures(unicodeSource)
    expect(figures).toHaveLength(1)
    expect(figures[0]?.text).toBe('图 1. 结构与 emoji 🚀 and RTL עִברִית')
  })

  it('evaluates total caption acceptance matrix', () => {
    const report = evaluateMarkdownCaptionAcceptance()
    expect(report.accepted).toBe(true)
    expect(report.version).toBe('markdown-caption-acceptance@2026-08-16')
    expect(report.unicodeAndImeMatrix).toEqual({
      crlf: true,
      bom: true,
      cjk: true,
      emoji: true,
      rtl: true,
      ime: true,
    })
    expect(report.figureOwnershipClean).toBe(true)
    expect(report.accessibilityTabBudget).toBe(true)
    expect(report.mutationsKilled).toBe(true)
  })

  it('kills title-caption, alias, dom-regroup, direct-splice, alt-copy, ghost-caption, and consumer-regex', () => {
    const report = evaluateMarkdownCaptionAcceptanceMutations()
    expect(report.mutations.map((m) => m.kind)).toEqual([
      'title-caption',
      'alias',
      'dom-regroup',
      'direct-splice',
      'alt-copy',
      'ghost-caption',
      'consumer-regex',
    ])
    for (const m of report.mutations) {
      expect(m.accepted).toBe(false)
      expect(m.equivalent).toBe(false)
    }
  })
})
