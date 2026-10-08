import { describe, expect, it, vi } from 'vitest'

import { currentMarkdownAnchors } from '../../components/markdown-editor/src/markdown-editor-anchor-commands'

import {
  getMarkdownXssSourceAttackFragment,
  getMarkdownXssSourceUrl,
} from '../../../tests/support/markdown-xss-corpus'

import {
  MARKDOWN_ANCHOR_DIAGNOSTIC_CODES,
  MARKDOWN_ANCHOR_ID,
  classifyMarkdownUrl,
  collectMarkdownAnchorNodes,
  createMarkdownEditorProjection,
  createMarkdownTechnicalEntries,
  evaluateMarkdownBlockAnchorMutations,
  markdownProjectionHasCompleteCoverage,
  parseMarkdownAnchorMarker,
  stabilizeMarkdownEditorProjection,
  validateMarkdownUrl,
  type MarkdownAnchorInvalidNode,
  type MarkdownAnchorNode,
  type MarkdownAnchorValidNode,
} from '../markdown-runtime'

const validNodes = (source: string) =>
  collectMarkdownAnchorNodes(source).filter(
    (node): node is MarkdownAnchorValidNode => node.ok,
  )

const invalidNodes = (source: string) =>
  collectMarkdownAnchorNodes(source).filter(
    (node): node is MarkdownAnchorInvalidNode => !node.ok,
  )

const expectRejectedAnchorCandidate = (
  source: string,
  range: { readonly start: number; readonly end: number } | null,
  nodes: readonly MarkdownAnchorNode[] = collectMarkdownAnchorNodes(source),
  parsed = parseMarkdownAnchorMarker(source.slice(0, -1), 0),
) => {
  if (range === null) {
    expect(nodes, JSON.stringify(source)).toEqual([])
    expect(parsed, JSON.stringify(source)).toBeNull()
  } else {
    const diagnostic = {
      ok: false,
      kind: 'anchor',
      code: 'anchor-invalid-id',
      message: 'anchor id must match [a-z][a-z0-9-]{0,63}',
      range,
    }
    expect(nodes, JSON.stringify(source)).toEqual([diagnostic])
    expect(parsed, JSON.stringify(source)).toEqual(diagnostic)
    expect(source.slice(range.start, range.end)).toBe(source.slice(5, -1))
  }
  expect(nodes.filter((node) => node.ok)).toEqual([])
  for (const node of nodes) {
    expect(node).not.toHaveProperty('id')
    expect(node).not.toHaveProperty('fragment')
  }
  const projection = createMarkdownEditorProjection(source)
  expect(
    projection.nodes.filter(
      (node) => node.kind === 'anchor' && node.status === 'valid',
    ),
  ).toEqual([])
  if (range !== null) {
    expect(
      projection.diagnostics.some(
        (diagnostic) =>
          diagnostic.code === 'anchor-invalid-id' &&
          diagnostic.rawRange.start === range.start &&
          diagnostic.rawRange.end === range.end,
      ),
    ).toBe(true)
  }
  // The public command query supplies navigable anchors and fragments. Invalid
  // marker diagnostics must never enter that output, even as normalized IDs.
  expect(currentMarkdownAnchors(source)).toEqual([])
}

/**
 * Issue #448 block anchor acceptance: grammar coverage, diagnostics, source-only
 * reconstruction, security corpus, and mutation kills. #446 owns the grammar and
 * #447 owns the commands; this suite only verifies the aggregate contract.
 */
describe('issue #448: block anchor coverage across every owning block kind', () => {
  const coverage: readonly [
    block: string,
    source: string,
    id: string,
    placement: 'following-line' | 'line-end',
  ][] = [
    ['paragraph', 'A paragraph ^para\n', 'para', 'line-end'],
    ['heading', '## Heading text ^head\n', 'head', 'line-end'],
    ['list item', '- first item ^item\n- second item\n', 'item', 'line-end'],
    ['quote', '> quoted line ^quote\n', 'quote', 'line-end'],
    ['table row', '| alpha | beta | ^row\n', 'row', 'line-end'],
    ['table block', '| alpha | beta |\n| --- | --- |\n| 1 | 2 |\n^table\n', 'table', 'following-line'],
    ['fenced code', '```ts\nconst value = 1\n```\n^snippet\n', 'snippet', 'following-line'],
    ['mermaid technical', '```mermaid\nflowchart LR\n```\n^diagram\n', 'diagram', 'following-line'],
    ['latex technical', '$$\nx^{2}\n$$\n^formula\n', 'formula', 'following-line'],
    ['registered embed atomic', '::embed[target="safe-doc" mode="block"]\n^embedded\n', 'embedded', 'following-line'],
    ['registered caption atomic', '::caption[figure one]\n^captioned\n', 'captioned', 'following-line'],
    ['container block', ':::note\nbody\n:::\n^noted\n', 'noted', 'following-line'],
  ]

  it.each(coverage)(
    'anchors a %s block with the unique ^anchor-id grammar',
    (_block, source, id, placement) => {
      const nodes = validNodes(source)
      expect(nodes).toHaveLength(1)
      const [node] = nodes
      expect(node.id).toBe(id)
      expect(node.fragment).toBe(`#${id}`)
      expect(node.placement).toBe(placement)
      expect(node.kind).toBe('anchor')
      expect(MARKDOWN_ANCHOR_ID.test(node.id)).toBe(true)
      // The marker and id ranges point at exact source bytes.
      expect(source.slice(node.ranges.marker.start, node.ranges.marker.end)).toBe(
        `^${id}`,
      )
      expect(source.slice(node.ranges.id.start, node.ranges.id.end)).toBe(id)
      expect(node.ranges.full).toEqual(node.ranges.marker)
    },
  )

  it('projects every owning block kind through one authority with complete coverage', () => {
    const source = [
      '# Heading ^head',
      '',
      'Paragraph ^para',
      '',
      '- item ^item',
      '',
      '> quote ^quote',
      '',
      '| a | b |',
      '| - | - |',
      '| 1 | 2 |',
      '^table',
      '',
      '```ts',
      'const value = 1',
      '```',
      '^snippet',
      '',
      '$$',
      'x^{2}',
      '$$',
      '^formula',
      '',
      '::embed[target="safe-doc" mode="block"]',
      '^embedded',
      '',
      '::caption[figure one]',
      '^captioned',
      '',
    ].join('\n')

    const nodes = validNodes(source)
    expect(nodes.map((node) => node.id)).toEqual([
      'head',
      'para',
      'item',
      'quote',
      'table',
      'snippet',
      'formula',
      'embedded',
      'captioned',
    ])
    expect(invalidNodes(source)).toHaveLength(0)

    const projection = createMarkdownEditorProjection(source)
    expect(markdownProjectionHasCompleteCoverage(projection)).toBe(true)
    const projected = projection.nodes.filter((node) => node.kind === 'anchor')
    expect(projected).toHaveLength(nodes.length)
    // Parser, projection, and fragment mapping stay one authority: the projected
    // raw range is the same marker bytes the grammar reported. A following-line
    // marker keeps its line terminator inside the projected raw range.
    for (const node of nodes) {
      const marker = source.slice(node.ranges.marker.start, node.ranges.marker.end)
      const match = projected.find(
        (candidate) =>
          candidate.status === 'valid' &&
          projection.identity.rawSource
            .slice(candidate.rawRange.start, candidate.rawRange.end)
            .replace(/\r?\n$/u, '') === marker,
      )
      expect(match, `projection anchor for ^${node.id}`).toBeTruthy()
      expect(match!.diagnosticCode).toBeNull()
      expect(match!.presentation).toBe('live-decorated')
    }

    // Technical consumers see the same anchored blocks, not a second authority.
    const stable = stabilizeMarkdownEditorProjection(projection, {
      epoch: 1,
      id: 'anchor-acceptance',
    })
    expect(createMarkdownTechnicalEntries(stable).map((entry) => entry.kind)).toEqual([
      'code',
      'latex',
    ])
  })

  it('keeps literal markers inside fenced, LaTeX, and container blocks out of the authority', () => {
    for (const source of [
      '```\nusage: tool ^notanchor\n```\n',
      '```ts ^notanchor\ncode\n```\n',
      '$$\na ^notanchor b\n$$\n',
      ':::note\nliteral ^notanchor\n:::\n',
    ]) {
      expect(collectMarkdownAnchorNodes(source)).toHaveLength(0)
      const projection = createMarkdownEditorProjection(source)
      expect(
        projection.nodes.filter((node) => node.kind === 'anchor'),
      ).toHaveLength(0)
    }
  })

  it('accepts two anchors in one document and only one marker per line', () => {
    const twoAnchors = validNodes('First ^one\n\nSecond ^two\n')
    expect(twoAnchors.map((node) => node.fragment)).toEqual(['#one', '#two'])
    expect(new Set(twoAnchors.map((node) => node.id)).size).toBe(2)

    // A line ends with at most one marker: `^one` is literal text, not an anchor.
    const sameLine = collectMarkdownAnchorNodes('Text ^one ^two\n')
    expect(sameLine).toHaveLength(1)
    expect(sameLine[0]?.ok).toBe(true)
    if (sameLine[0]?.ok) {
      expect(sameLine[0].id).toBe('two')
      expect(sameLine[0].placement).toBe('line-end')
    }
    expect(parseMarkdownAnchorMarker('Text ^one ^two', 0)?.ok).toBe(true)
  })
})

describe('issue #448: duplicate, invalid, orphan, and cross-gap diagnostics fail clearly', () => {
  it('reports every frozen diagnostic code with an exact range and never renames', () => {
    expect([...MARKDOWN_ANCHOR_DIAGNOSTIC_CODES]).toEqual([
      'anchor-invalid-id',
      'anchor-duplicate',
      'anchor-orphan',
      'anchor-cross-gap',
      'anchor-placement',
    ])

    const cases: readonly [source: string, code: string][] = [
      ['text ^Upper\n', 'anchor-invalid-id'],
      ['text ^1digit\n', 'anchor-invalid-id'],
      ['text ^-leading\n', 'anchor-invalid-id'],
      [`text ^${'a'.repeat(63)}A\n`, 'anchor-invalid-id'],
      ['one ^same\n\ntwo ^same\n', 'anchor-duplicate'],
      ['^orphan\n', 'anchor-orphan'],
      ['```\ncode\n```\n\n^skipped\n', 'anchor-cross-gap'],
      ['Paragraph\n^inline-owner\n', 'anchor-placement'],
    ]

    for (const [source, code] of cases) {
      const failures = invalidNodes(source)
      expect(failures, `expected ${code} for ${JSON.stringify(source)}`).toHaveLength(1)
      const [failure] = failures
      if (!failure || failure.ok) throw new Error('unreachable')
      expect(failure.code).toBe(code)
      expect(failure.kind).toBe('anchor')
      expect(failure.message.length).toBeGreaterThan(0)
      expect(failure.range.end).toBeGreaterThan(failure.range.start)
      expect(source.slice(failure.range.start, failure.range.end)).toContain('^')
    }
  })

  it('diagnoses malformed marker tokens while retaining non-candidate refusal', () => {
    const ranges = [20, 71, null, 13, 18, null, 7, 7] as const
    for (const [index, source] of [
      'text ^has_underscore\n',
      `text ^${'a'.repeat(65)}\n`,
      'text ^with space\n',
      'text ^dot.ted\n',
      'text ^slash/escape\n',
      'text ^\n',
      'text ^\u200b\n',
      'text ^\u202e\n',
    ].entries()) {
      const end = ranges[index]!
      expectRejectedAnchorCandidate(
        source,
        end === null ? null : { start: 5, end },
      )
    }
  })

  it('kills dropped diagnostics, invalid admission, identity leakage, and range/code mutations', () => {
    const source = 'text ^has_underscore\n'
    const range = { start: 5, end: 20 }
    const nodes = collectMarkdownAnchorNodes(source)
    const diagnostic = nodes[0]!
    const admitted = {
      ok: true as const,
      kind: 'anchor' as const,
      id: 'has_underscore',
      fragment: '#has_underscore',
      placement: 'line-end' as const,
      ranges: { full: range, marker: range, id: { start: 6, end: 20 } },
    }
    const mutations = [
      [],
      [admitted],
      [...nodes, admitted],
      [{ ...diagnostic, id: 'normalized', fragment: '#normalized' }],
      [{ ...diagnostic, code: 'anchor-orphan' as const }],
      [{ ...diagnostic, range: { start: 5, end: 19 } }],
    ]
    for (const mutated of mutations) {
      expect(() =>
        expectRejectedAnchorCandidate(source, range, mutated),
      ).toThrow()
    }
    expect(() =>
      expectRejectedAnchorCandidate(source, range, nodes, null),
    ).toThrow()
    expect(() =>
      expectRejectedAnchorCandidate(source, range, nodes, admitted),
    ).toThrow()
    expect(() =>
      expectRejectedAnchorCandidate('text ^with space\n', null, nodes),
    ).toThrow()
  })

  it('keeps a duplicate unresolved instead of first-wins or silent rename', () => {
    const source = 'one ^same\n\ntwo ^same\n\nthree ^same\n'
    const nodes = collectMarkdownAnchorNodes(source)
    const valid = nodes.filter((node) => node.ok)
    const duplicates = invalidNodes(source).filter(
      (node) => node.code === 'anchor-duplicate',
    )
    // Every later occurrence is a hard diagnostic; nothing is renamed and no
    // second fragment target is minted.
    expect(valid).toHaveLength(1)
    expect(duplicates).toHaveLength(2)
    expect(validNodes(source).map((node) => node.id)).toEqual(['same'])
    expect(nodes.some((node) => node.ok && node.id !== 'same')).toBe(false)
    expect(duplicates.every((node) => !node.ok && node.message.length > 0)).toBe(true)
  })

  it('separates cross-gap ownership from a true orphan', () => {
    const crossGap = invalidNodes('Paragraph text\n\n^gap\n')
    expect(crossGap[0]?.ok).toBe(false)
    if (!crossGap[0] || crossGap[0].ok) throw new Error('unreachable')
    expect(crossGap[0].code).toBe('anchor-cross-gap')

    const orphan = invalidNodes('^orphan\n')
    if (!orphan[0] || orphan[0].ok) throw new Error('unreachable')
    expect(orphan[0].code).toBe('anchor-orphan')

    // Neither form ever claims the preceding block across the blank line.
    expect(validNodes('Paragraph text\n\n^gap\n')).toHaveLength(0)
    expect(validNodes('```\ncode\n```\n\n^gap\n')).toHaveLength(0)
  })

  it('projects diagnostics as malformed nodes with the same code', () => {
    const source =
      '^lead\n\none ^same\n\ntwo ^same\n\nParagraph\n\n^gap\n\ntext ^Upper\n'
    const projection = createMarkdownEditorProjection(source)
    const malformed = projection.nodes.filter((node) => node.status === 'malformed')
    expect(malformed.map((node) => node.diagnosticCode)).toEqual([
      'anchor-orphan',
      'anchor-duplicate',
      'anchor-cross-gap',
      'anchor-invalid-id',
    ])
    expect(
      malformed.every((node) => node.presentation === 'unsupported-error'),
    ).toBe(true)
    expect(markdownProjectionHasCompleteCoverage(projection)).toBe(true)
    // The grammar and the projection agree on which single anchor survived.
    expect(validNodes(source).map((node) => node.id)).toEqual(['same'])
  })
})

describe('issue #448: source reconstructs anchors without DOM, editor, or database', () => {
  const source = [
    '\uFEFF# Title ^head\r\n',
    'Paragraph ^para\r\n',
    '',
    '```ts\r\n',
    'const value = 1\r\n',
    '```\r\n',
    '^snippet\r\n',
  ].join('')

  it('rebuilds the identical anchor set with DOM, storage, and network globals removed', () => {
    const expected = collectMarkdownAnchorNodes(source)
    expect(expected.map((node) => node.ok && node.id)).toEqual([
      'head',
      'para',
      'snippet',
    ])

    const forbidden = () => {
      throw new Error('anchor authority must not read this global')
    }
    vi.stubGlobal('document', undefined)
    vi.stubGlobal('window', undefined)
    vi.stubGlobal('localStorage', { getItem: forbidden, setItem: forbidden })
    vi.stubGlobal('sessionStorage', { getItem: forbidden, setItem: forbidden })
    vi.stubGlobal('indexedDB', undefined)
    vi.stubGlobal('fetch', forbidden)
    try {
      expect(collectMarkdownAnchorNodes(source)).toEqual(expected)
      expect(parseMarkdownAnchorMarker('Paragraph ^para', 0)).toEqual(
        collectMarkdownAnchorNodes('Paragraph ^para')[0],
      )
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('is a pure frozen function of the source bytes alone', () => {
    const first = collectMarkdownAnchorNodes(source)
    const second = collectMarkdownAnchorNodes(source)
    expect(second).toEqual(first)
    expect(Object.isFrozen(first)).toBe(true)
    expect(
      first.every(
        (node) =>
          Object.isFrozen(node) &&
          Object.isFrozen('ranges' in node ? node.ranges : node.range),
      ),
    ).toBe(true)
    // Identity is the marker text itself, so the same id in a different block is
    // still the same id and a different block text never changes it.
    expect(validNodes('Completely different wording ^para')[0]?.id).toBe('para')
    expect(validNodes('Paragraph ^para')[0]?.id).toBe('para')
  })

  it('survives CRLF, BOM, CJK, emoji, RTL, and composition text with exact ranges', () => {
    const vectors: readonly [label: string, source: string, id: string][] = [
      ['crlf', 'Paragraph ^crlf\r\nSecond ^two\r\n', 'crlf'],
      ['bom', '\uFEFFParagraph ^bom\n', 'bom'],
      ['cjk', '中文段落 ^cjk\n', 'cjk'],
      ['emoji', 'Party 😀👩‍💻 ^emoji\n', 'emoji'],
      ['rtl', 'שלום עולם ^rtl\n', 'rtl'],
      ['mixed bidi', 'LTR שלום مرحبا 中文 😀 ^mixed\n', 'mixed'],
      ['composition residue', '拼写检查 ^ime\n', 'ime'],
      ['max length id', `text ^${'a'.repeat(64)}\n`, 'a'.repeat(64)],
    ]

    for (const [label, vector, id] of vectors) {
      const nodes = validNodes(vector)
      expect(nodes, label).toHaveLength(label === 'crlf' ? 2 : 1)
      expect(nodes[0]?.id, label).toBe(id)
      expect(nodes[0]?.fragment, label).toBe(`#${id}`)
      expect(
        vector.slice(nodes[0]!.ranges.marker.start, nodes[0]!.ranges.marker.end),
        label,
      ).toBe(`^${id}`)
      // A carriage return is a line terminator, never part of the marker.
      expect(
        vector.slice(nodes[0]!.ranges.id.start, nodes[0]!.ranges.id.end),
        label,
      ).toBe(id)
    }

    const crlf = validNodes('Paragraph ^crlf\r\nSecond ^two\r\n')
    expect(crlf.map((node) => node.id)).toEqual(['crlf', 'two'])
    // The same document with LF newlines yields the same identities.
    expect(
      validNodes('Paragraph ^crlf\nSecond ^two\n').map((node) => node.fragment),
    ).toEqual(crlf.map((node) => node.fragment))
  })
})

describe('issue #448: anchor security corpus', () => {
  it('refuses alias grammar, so the unique ^anchor-id stays the only public form', () => {
    for (const source of [
      'Paragraph {#custom}\n',
      'Paragraph #^custom\n',
      'Paragraph [[custom]]\n',
      '<p id="custom">Paragraph</p>\n',
      'Paragraph <!-- anchor:custom -->\n',
      'Paragraph ^custom ^alias\n',
      '{#alias}\n',
    ]) {
      const nodes = collectMarkdownAnchorNodes(source)
      expect(
        nodes.filter((node): node is MarkdownAnchorValidNode => node.ok).map((node) => node.id),
        `alias source ${JSON.stringify(source)}`,
      ).toEqual(source === 'Paragraph ^custom ^alias\n' ? ['alias'] : [])
    }
  })

  it('refuses control, bidi, HTML, and URL injection inside an id', () => {
    const ranges = [
      11,
      11,
      11,
      11,
      11,
      null,
      null,
      48,
      17,
      25,
      11,
      15,
      null,
    ] as const
    for (const [index, source] of [
      'text ^ab\u0000cd\n',
      'text ^ab\u0007cd\n',
      'text ^ab\u001bcd\n',
      'text ^ab\u200bcd\n',
      'text ^ab\u202ecd\n',
      'text ^ab\u2028cd\n',
      'text ^a">' +
        getMarkdownXssSourceAttackFragment('mxss-raw-img-onerror') +
        '\n',
      'text ^' +
        getMarkdownXssSourceAttackFragment('mxss-raw-script-basic') +
        '\n',
      'text ^a#b?c=1&d=2\n',
      'text ^' + getMarkdownXssSourceUrl('mxss-url-javascript-link') + '\n',
      'text ^a%20b\n',
      'text ^../escape\n',
      'text ^a b\n',
    ].entries()) {
      const end = ranges[index]!
      expectRejectedAnchorCandidate(
        source,
        end === null ? null : { start: 5, end },
      )
    }
  })

  it('keeps DOM clobbering names inside the string authority and off the DOM', () => {
    // The charset admits these words, so acceptance depends on the fragment
    // never becoming a DOM id/name and never leaving the hash scope.
    const clobbering = ['constructor', 'prototype', 'tostring', 'id', 'name', 'form', 'location']
    for (const id of clobbering) {
      const nodes = validNodes(`Paragraph ^${id}\n`)
      expect(nodes, id).toHaveLength(1)
      expect(nodes[0]?.id, id).toBe(id)
      expect(nodes[0]?.fragment, id).toBe(`#${id}`)
      expect(classifyMarkdownUrl(nodes[0]!.fragment), id).toBe('valid-hash')
      const validation = validateMarkdownUrl(nodes[0]!.fragment, {
        documentEpoch: 1,
        nodeId: `anchor-${id}`,
        revision: 1,
        value: nodes[0]!.fragment,
        version: 1,
      })
      expect(validation.state, id).toBe('valid-hash')
      expect(validation.open.allowed, id).toBe(true)
      if (!validation.open.allowed) throw new Error('unreachable')
      expect(validation.open.href, id).toBe(`#${id}`)
      // Underscore is outside the grammar, so prototype-pollution spellings die.
      expect(MARKDOWN_ANCHOR_ID.test(`__${id}__`)).toBe(false)
    }
    expectRejectedAnchorCandidate('text ^__proto__\n', { start: 5, end: 15 })
  })

  it('maps ids to fragments injectively with no ^ in renderer identity', () => {
    const source = [
      'a ^intro',
      'b ^intro-',
      'c ^intro1',
      'd ^intro2',
      '',
      '```ts',
      'code',
      '```',
      '^intro3',
      '',
    ].join('\n')
    const nodes = validNodes(source)
    const fragments = nodes.map((node) => node.fragment)
    expect(fragments).toEqual(['#intro', '#intro-', '#intro1', '#intro2', '#intro3'])
    // Injective: distinct ids never share a fragment, and the renderer identity
    // carries no `^`.
    expect(new Set(fragments).size).toBe(fragments.length)
    for (const node of nodes) {
      expect(node.fragment).toBe(`#${node.id}`)
      expect(node.fragment).not.toContain('^')
      expect(node.fragment.slice(1)).toMatch(MARKDOWN_ANCHOR_ID)
      expect(classifyMarkdownUrl(node.fragment)).toBe('valid-hash')
    }

    // Near-miss collision candidates can never be minted from source: either the
    // id is outside the grammar or the fragment would not round-trip.
    const collisions = [
      '#Intro',
      '#íntró',
      '#1intro',
      '#in tro',
      '#intro#x',
      '#%69ntro',
      '#intro\n',
      '#intro ',
      '#-intro',
    ]
    for (const candidate of collisions) {
      const id = candidate.slice(1)
      const legal = MARKDOWN_ANCHOR_ID.test(id)
      expect(legal && candidate === `#${id}`, candidate).toBe(false)
      expect(fragments, candidate).not.toContain(candidate)
      // And no source spelling of the candidate yields it as an anchor.
      const attempts = [
        `text ^${id}\n`,
        `text ^${id.trim()}\n`,
        `text ^${id.replace(/[^a-zA-Z0-9-]/gu, '')}\n`,
      ]
      for (const attempt of attempts) {
        for (const node of validNodes(attempt)) {
          expect(node.fragment, `${candidate} via ${JSON.stringify(attempt)}`).not.toBe(
            candidate,
          )
        }
      }
    }
  })

  it('never derives an anchor from a content hash, an offset, or a missing marker', () => {
    // No marker, no anchor: identity is never generated.
    for (const source of [
      'Paragraph without any marker\n',
      '# Heading\n\n- list\n',
      '```\ncode\n```\n',
      '::embed[target="safe-doc" mode="block"]\n',
      '',
      '\n\n\n',
    ]) {
      expect(
        collectMarkdownAnchorNodes(source),
        `auto identity for ${JSON.stringify(source)}`,
      ).toHaveLength(0)
    }
    // Editing the owning block never changes the id, and no id looks like a
    // digest of its content.
    const before = validNodes('Original wording ^stable\n')[0]!
    const after = validNodes('Totally different wording ^stable\n')[0]!
    expect(after.id).toBe(before.id)
    expect(after.fragment).toBe(before.fragment)
    expect(/^[0-9a-f]{8,}$/u.test(after.id)).toBe(false)
    expect(/^\d+$/u.test(after.id)).toBe(false)
    // A bare offset is not an identity either.
    expect(collectMarkdownAnchorNodes('text ^12345\n')[0]?.ok).toBe(false)
  })
})

describe('issue #448: mutation fixtures kill the forbidden anchor implementations', () => {
  const aliasSource = 'Paragraph {#alias}\n\n# Heading\n\n```\ncode\n```\n^snippet\n'
  const duplicateSource = 'one ^same\n\ntwo ^same\n\n{#alias}\n\n```\ncode\n```\n\n^skipped\n'

  it('rejects the shipped alias, auto-id, DOM post-process, first-wins, and cross-gap mutants', () => {
    for (const source of [aliasSource, duplicateSource]) {
      const report = evaluateMarkdownBlockAnchorMutations(source)
      expect(report.mutations.map((mutation) => mutation.kind)).toEqual([
        'alias',
        'auto-id',
        'dom-post-process',
        'first-wins',
        'cross-gap-ownership',
      ])
      for (const mutation of report.mutations) {
        expect(mutation.accepted, mutation.kind).toBe(false)
        expect(mutation.equivalent, mutation.kind).toBe(false)
      }
      expect(report.authority).toEqual(collectMarkdownAnchorNodes(source))
    }
  })

  it('kills an alias mutant that accepts {#id}, #^id, wikilink, or HTML id syntax', () => {
    const aliasMutant = (source: string) => [
      ...validNodes(source),
      ...[...source.matchAll(/\{#([a-z][a-z0-9-]{0,63})\}|#\^([a-z][a-z0-9-]{0,63})|\[\[([a-z][a-z0-9-]{0,63})\]\]|id="([a-z][a-z0-9-]{0,63})"/gu)].map(
        (match) => match[1] ?? match[2] ?? match[3] ?? match[4]!,
      ),
    ]
    const authority = validNodes(aliasSource).map((node) => node.id)
    const mutant = aliasMutant(aliasSource)
    expect(mutant).not.toEqual(authority)
    expect(mutant).toContain('alias')
    expect(authority).not.toContain('alias')
    expect(authority).toEqual(['snippet'])
  })

  it('kills a DOM post-process mutant that harvests ids from rendered markup', () => {
    const rendered = '<h2 id="harvested">Heading</h2><p name="also">Text</p>'
    const domMutant = [
      ...[...rendered.matchAll(/(?:id|name)="([a-z][a-z0-9-]+)"/gu)].map(
        (match) => match[1]!,
      ),
    ]
    expect(domMutant).toEqual(['harvested', 'also'])
    // The shipped authority reads source bytes only: rendered markup yields
    // nothing, and every projected anchor id equals its own source slice.
    expect(collectMarkdownAnchorNodes(rendered)).toHaveLength(0)
    const source = '# Heading ^head\n\nParagraph ^para\n'
    const projection = createMarkdownEditorProjection(source)
    for (const node of validNodes(source)) {
      const projected = projection.nodes.find(
        (candidate) =>
          candidate.kind === 'anchor' &&
          projection.identity.rawSource
            .slice(candidate.rawRange.start, candidate.rawRange.end)
            .endsWith(node.id),
      )
      expect(projected, node.id).toBeTruthy()
      // The projected identity is the source marker bytes themselves, never a
      // fragment and never an id harvested from rendered markup.
      const projectedRaw = projection.identity.rawSource
        .slice(projected!.rawRange.start, projected!.rawRange.end)
        .replace(/\r?\n$/u, '')
      expect(projectedRaw, node.id).toBe(`^${node.id}`)
      expect(projectedRaw, node.id).not.toBe(node.fragment)
      expect(node.id).toBe(
        source.slice(node.ranges.id.start, node.ranges.id.end),
      )
    }
  })

  it('kills an auto-hash mutant that mints identities from block content', () => {
    const digest = (value: string) => {
      let hash = 0x811c9dc5
      for (const char of value) {
        hash ^= char.codePointAt(0)!
        hash = Math.imul(hash, 0x01000193) >>> 0
      }
      return hash.toString(16).padStart(8, '0')
    }
    const source = 'Paragraph without marker\n\n# Heading without marker\n'
    const blocks = source.split('\n\n')
    const autoHashMutant = blocks.map((block) => digest(block))
    expect(new Set(autoHashMutant).size).toBe(blocks.length)
    expect(collectMarkdownAnchorNodes(source)).toHaveLength(0)
    // Content-derived identity is also unstable under an edit, which the shipped
    // grammar is not: the id belongs to the marker, never to the block text.
    expect(digest('Paragraph without marker')).not.toBe(
      digest('Paragraph without marker.'),
    )
    expect(validNodes('Paragraph without marker ^stable')[0]?.id).toBe('stable')
    expect(validNodes('Paragraph edited twice ^stable')[0]?.id).toBe('stable')
  })
})
