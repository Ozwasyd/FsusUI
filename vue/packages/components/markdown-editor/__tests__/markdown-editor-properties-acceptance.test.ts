import { describe, expect, it } from 'vitest'

import { commitMarkdownAttachmentResult } from '../src/markdown-editor-attachment'
import {
  evaluateMarkdownImagePropertyMutations,
  evaluateMarkdownPropertyMutations,
  planMarkdownImageAttachmentReplace,
  validateMarkdownPropertyUrl,
} from '../src/markdown-editor-link-image'

describe('Issue #445: Link/image property editor acceptance mutations', () => {
  it('kills regex-dom, whole-node-rewrite, hover-only, unsafe-url, stale-node-commit, and stale-property by executing each mutant', () => {
    const report = evaluateMarkdownPropertyMutations()
    expect(report.mutations.map((mutation) => mutation.kind)).toEqual([
      'regex-dom',
      'whole-node-rewrite',
      'hover-only',
      'unsafe-url',
      'stale-node-commit',
      'stale-property',
    ])
    for (const mutation of report.mutations) {
      expect(mutation.accepted).toBe(false)
    }

    const evidence = report.evidence

    // regex-dom: the naive regex captures through the title boundary and the
    // DOM anchor normalizes the href bytes, so neither reproduces the raw
    // bytes the projection ranges preserve.
    expect(evidence.regexDom.authorityLabelText).toBe('Docs')
    expect(evidence.regexDom.authorityUrl).toBe('https://safe.test')
    expect(evidence.regexDom.authorityTitle).toBe('Title')
    expect(evidence.regexDom.mutantRegexLabel).toBe('Docs')
    expect(evidence.regexDom.mutantRegexUrl).toBe('https://safe.test "Title"')
    expect(evidence.regexDom.mutantDomHref).toBe('https://safe.test/')
    const regexDomEquivalent =
      evidence.regexDom.mutantRegexLabel ===
        evidence.regexDom.authorityLabelText &&
      evidence.regexDom.mutantRegexUrl === evidence.regexDom.authorityUrl &&
      evidence.regexDom.mutantDomHref === evidence.regexDom.authorityUrl

    // whole-node-rewrite: the property edit touches only the destination
    // subrange instead of rewriting the whole node.
    expect(evidence.wholeNodeRewrite.editChangeCount).toBe(1)
    expect(evidence.wholeNodeRewrite.editFrom).toBe(7)
    expect(evidence.wholeNodeRewrite.authorityFullStart).toBe(0)
    const wholeNodeRewriteEquivalent =
      evidence.wholeNodeRewrite.editChangeCount !== 1 ||
      evidence.wholeNodeRewrite.editFrom ===
        evidence.wholeNodeRewrite.authorityFullStart

    // hover-only: text search for the hovered label lands on the first
    // duplicate while the authority targets the second node.
    expect(evidence.hoverOnly.mutantTextSearchStart).toBe(1)
    expect(evidence.hoverOnly.authorityNodeStart).toBe(30)
    const hoverOnlyEquivalent =
      evidence.hoverOnly.mutantTextSearchStart ===
      evidence.hoverOnly.authorityNodeStart

    // unsafe-url: the authority blocks the javascript: destination and never
    // allows opening it.
    expect(evidence.unsafeUrl.dangerousState).toBe('blocked-scheme')
    expect(evidence.unsafeUrl.dangerousOpenAllowed).toBe(false)
    const unsafeUrlEquivalent = evidence.unsafeUrl.dangerousOpenAllowed

    // stale-node-commit: the deleted node no longer resolves as current.
    expect(evidence.staleNodeCommit.resolvedNodeStatus).toBe('deleted')
    const staleNodeCommitEquivalent =
      evidence.staleNodeCommit.resolvedNodeStatus === 'current'

    // stale-property: the planned transaction threads the expected revision
    // the mutant would drop.
    expect(evidence.staleProperty.plannedExpectedRevision).toBe(8)
    const stalePropertyEquivalent =
      evidence.staleProperty.plannedExpectedRevision !== 8

    const equivalenceByKind: Record<string, boolean> = {
      'regex-dom': regexDomEquivalent,
      'whole-node-rewrite': wholeNodeRewriteEquivalent,
      'hover-only': hoverOnlyEquivalent,
      'unsafe-url': unsafeUrlEquivalent,
      'stale-node-commit': staleNodeCommitEquivalent,
      'stale-property': stalePropertyEquivalent,
    }
    for (const mutation of report.mutations) {
      // The reported equivalence must be derived from the executed mutant
      // evidence above, not hardcoded.
      expect(mutation.equivalent).toBe(equivalenceByKind[mutation.kind])
      expect(mutation.equivalent).toBe(false)
    }
  })

  it('kills dom-attributes, ai-alt, unsafe-preview, whole-node-rewrite, and attachment-resurrection by executing each mutant', () => {
    const report = evaluateMarkdownImagePropertyMutations()
    expect(report.mutations.map((mutation) => mutation.kind)).toEqual([
      'dom-attributes',
      'ai-alt',
      'unsafe-preview',
      'whole-node-rewrite',
      'attachment-resurrection',
    ])
    for (const mutation of report.mutations) {
      expect(mutation.accepted).toBe(false)
    }

    const evidence = report.evidence

    // dom-attributes: the rendered <img> attribute carries the unescaped alt
    // and loses the raw source bytes the authority preserves.
    expect(evidence.domAttributes.authorityAltRaw).toBe('CJK \\] alt')
    expect(evidence.domAttributes.mutantRenderedAlt).toBe('CJK ] alt')
    const domAttributesEquivalent =
      evidence.domAttributes.mutantRenderedAlt ===
      evidence.domAttributes.authorityAltRaw

    // ai-alt: backfilling an empty alt from the title diverges from the
    // authority that keeps alt empty and independent.
    expect(evidence.aiAlt.authorityAlt).toBe('')
    expect(evidence.aiAlt.mutantBackfill).toBe('Sunset')
    const aiAltEquivalent =
      evidence.aiAlt.mutantBackfill === evidence.aiAlt.authorityAlt

    // unsafe-preview: the authority blocks the javascript: destination.
    expect(evidence.unsafePreview.dangerousState).toBe('blocked-scheme')
    expect(evidence.unsafePreview.dangerousOpenAllowed).toBe(false)
    const unsafePreviewEquivalent =
      evidence.unsafePreview.dangerousState === 'valid-external'

    // whole-node-rewrite: the alt edit touches only the alt subrange.
    expect(evidence.wholeNodeRewrite.altEditChangeCount).toBe(1)
    expect(evidence.wholeNodeRewrite.altEditFrom).toBe(2)
    expect(evidence.wholeNodeRewrite.altEditTo).toBe(13)
    expect(evidence.wholeNodeRewrite.nodeStart).toBe(0)
    const wholeNodeRewriteEquivalent =
      evidence.wholeNodeRewrite.altEditChangeCount === 1 &&
      evidence.wholeNodeRewrite.altEditFrom ===
        evidence.wholeNodeRewrite.nodeStart &&
      evidence.wholeNodeRewrite.altEditTo === evidence.wholeNodeRewrite.nodeEnd

    // attachment-resurrection: the lifecycle guard rejects the late commit
    // replayed for the deleted node.
    expect(evidence.attachmentResurrection.mutantCommitStatus).toBe('deleted')
    expect(evidence.attachmentResurrection.mutantCommitAccepted).toBe(false)
    const resurrectionEquivalent =
      evidence.attachmentResurrection.mutantCommitAccepted === true

    const equivalenceByKind: Record<string, boolean> = {
      'dom-attributes': domAttributesEquivalent,
      'ai-alt': aiAltEquivalent,
      'unsafe-preview': unsafePreviewEquivalent,
      'whole-node-rewrite': wholeNodeRewriteEquivalent,
      'attachment-resurrection': resurrectionEquivalent,
    }
    for (const mutation of report.mutations) {
      // The reported equivalence must be derived from the executed mutant
      // evidence above, not hardcoded.
      expect(mutation.equivalent).toBe(equivalenceByKind[mutation.kind])
      expect(mutation.equivalent).toBe(false)
    }
  })

  it('opens safe external destinations and blocks dangerous schemes from open and preview', () => {
    const safe = validateMarkdownPropertyUrl('https://example.com/valid.png', {
      documentEpoch: 1,
      revision: 1,
      nodeId: 'node:1',
      value: 'https://example.com/valid.png',
      version: 1,
    })
    expect(safe.state).toBe('valid-external')
    expect(safe.open.allowed).toBe(true)

    const dangerous = validateMarkdownPropertyUrl('javascript:alert(1)', {
      documentEpoch: 1,
      revision: 1,
      nodeId: 'node:1',
      value: 'javascript:alert(1)',
      version: 1,
    })
    expect(dangerous.state).toBe('blocked-scheme')
    expect(dangerous.open.allowed).toBe(false)
  })

  it('rejects stale attachment commits for deleted image nodes', () => {
    const identity = { id: 'properties-acceptance', epoch: 2 }
    const source = '![old](https://cdn.example/old.png)'
    const intent = planMarkdownImageAttachmentReplace({
      source,
      imageRange: { start: 0, end: source.length },
      documentIdentity: identity,
      revision: 6,
      file: { name: 'late.png', mimeType: 'image/png', byteLength: 10 },
    })
    const rejected = commitMarkdownAttachmentResult({
      documentIdentity: identity,
      revision: 6,
      nodeStatus: 'deleted',
      result: {
        status: 'resolved',
        batchId: intent.batchId,
        itemId: intent.items[0]!.itemId,
        documentIdentity: identity,
        revision: 6,
        payload: {
          markdownKind: 'image',
          href: '/media/late.png',
          mimeType: 'image/png',
        },
      },
    })
    expect(rejected.accepted).toBe(false)
    expect(rejected.status).toBe('deleted')
  })
})
