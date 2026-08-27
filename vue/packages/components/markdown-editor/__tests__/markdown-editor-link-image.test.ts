import { describe, expect, it } from 'vitest'

import {
  decomposeMarkdownImageNode,
  evaluateMarkdownImagePropertyMutations,
  planMarkdownImageAltEdit,
  planMarkdownImageAttachmentReplace,
  planMarkdownImageDestinationEdit,
  planMarkdownImageRemove,
  planMarkdownImageTitleEdit,
  validateMarkdownPropertyUrl,
} from '../src/markdown-editor-link-image'

const sampleIdentity = { id: 'doc-img', epoch: 1 }

describe('markdown image property transactions and attachment replace (#444)', () => {
  it('decomposes image nodes strictly by range without regex matching the whole doc', () => {
    const source = 'prefix ![alt text](https://cdn.example/pic.png "sample title") suffix'
    const start = source.indexOf('![')
    const end = source.indexOf(')') + 1
    const decomposed = decomposeMarkdownImageNode(source, { start, end })

    expect(decomposed).not.toBeNull()
    if (!decomposed) return
    expect(decomposed.marker).toEqual({ start, end: start + 2 })
    expect(decomposed.alt.value).toBe('alt text')
    expect(decomposed.destination.value).toBe('https://cdn.example/pic.png')
    expect(decomposed.title?.value).toBe('sample title')
  })

  it('handles empty, long, CJK, RTL, and escaped alt and title', () => {
    const complex = '![CJK 图注 \\] \\\\ RTL عربي](https://cdn.example/cjk.png "quoted \\"title\\"")'
    const decomposed = decomposeMarkdownImageNode(complex, { start: 0, end: complex.length })

    expect(decomposed).not.toBeNull()
    if (!decomposed) return
    expect(decomposed.alt.raw).toBe('CJK 图注 \\] \\\\ RTL عربي')
    expect(decomposed.destination.value).toBe('https://cdn.example/cjk.png')
    expect(decomposed.title?.value).toBe('quoted "title"')
  })

  it('modifies only necessary subranges without rewriting the whole node', () => {
    const source = '![old-alt](https://cdn.example/orig.png "old title")'
    const range = { start: 0, end: source.length }

    // 1. Alt edit modifies ONLY alt subrange
    const altTx = planMarkdownImageAltEdit(source, range, 'new-alt')
    expect(altTx.changes).toHaveLength(1)
    expect(altTx.changes[0]?.from).toBe(2) // immediately after '!['
    expect(altTx.changes[0]?.to).toBe(9) // at ']'
    expect(altTx.changes[0]?.insert).toBe('new-alt')

    // 2. Destination edit modifies ONLY destination subrange
    const destTx = planMarkdownImageDestinationEdit(source, range, 'https://cdn.example/updated.png')
    expect(destTx.changes).toHaveLength(1)
    expect(destTx.changes[0]?.insert).toBe('https://cdn.example/updated.png')

    // 3. Title edit modifies existing title
    const titleEditTx = planMarkdownImageTitleEdit(source, range, 'new title')
    expect(titleEditTx.changes).toHaveLength(1)
    expect(titleEditTx.changes[0]?.insert).toBe('"new title"')

    // 4. Title removal removes title subrange
    const titleRemoveTx = planMarkdownImageTitleEdit(source, range, null)
    expect(titleRemoveTx.changes).toHaveLength(1)
    expect(titleRemoveTx.changes[0]?.insert).toBe('')

    // 5. Title insertion into title-less image
    const untitled = '![alt](https://cdn.example/orig.png)'
    const titleAddTx = planMarkdownImageTitleEdit(untitled, { start: 0, end: untitled.length }, 'added title')
    expect(titleAddTx.changes).toHaveLength(1)
    expect(titleAddTx.changes[0]?.insert).toContain('"added title"')
  })

  it('removes image completely or keeps alt text with predictable caret recovery', () => {
    const source = 'before ![photo of sunset](https://cdn.example/sun.png) after'
    const start = source.indexOf('![')
    const end = source.indexOf(')') + 1
    const range = { start, end }

    // Complete removal
    const removeAll = planMarkdownImageRemove(source, range)
    expect(removeAll.changes[0]?.from).toBe(start)
    expect(removeAll.changes[0]?.to).toBe(end)
    expect(removeAll.changes[0]?.insert).toBe('')

    // Removal keeping alt text
    const keepAlt = planMarkdownImageRemove(source, range, { keepAltText: true })
    expect(keepAlt.changes[0]?.from).toBe(start)
    expect(keepAlt.changes[0]?.to).toBe(end)
    expect(keepAlt.changes[0]?.insert).toBe('photo of sunset')
  })

  it('creates attachment replace intent bound to node anchor', () => {
    const source = '![old](https://cdn.example/old.png)'
    const range = { start: 0, end: source.length }
    const batch = planMarkdownImageAttachmentReplace({
      source,
      imageRange: range,
      documentIdentity: sampleIdentity,
      revision: 4,
      file: { name: 'replaced.jpg', mimeType: 'image/jpeg', byteLength: 500 },
    })

    expect(batch.sourceKind).toBe('pick')
    expect(batch.documentIdentity).toEqual(sampleIdentity)
    expect(batch.revision).toBe(4)
    expect(batch.anchor.range).toEqual(range)
    expect(batch.items).toHaveLength(1)
    expect(batch.items[0]?.name).toBe('replaced.jpg')
  })

  it('validates safe vs unsafe destination URLs', () => {
    const safe = validateMarkdownPropertyUrl('https://example.com/valid.png', {
      documentEpoch: 1,
      revision: 1,
      nodeId: 'node:1',
      value: 'https://example.com/valid.png',
      version: 1,
    })
    expect(safe.state).toBe('valid-external')

    const dangerous = validateMarkdownPropertyUrl('javascript:alert(1)', {
      documentEpoch: 1,
      revision: 1,
      nodeId: 'node:1',
      value: 'javascript:alert(1)',
      version: 1,
    })
    expect(dangerous.state).toBe('blocked-scheme')
  })

  it('kills dom-attributes, ai-alt, unsafe-preview, whole-node-rewrite, and attachment-resurrection', () => {
    const report = evaluateMarkdownImagePropertyMutations()
    expect(report.mutations.map((m) => m.kind)).toEqual([
      'dom-attributes',
      'ai-alt',
      'unsafe-preview',
      'whole-node-rewrite',
      'attachment-resurrection',
    ])
    for (const m of report.mutations) {
      expect(m.accepted).toBe(false)
      expect(m.equivalent).toBe(false)
    }
  })
})
