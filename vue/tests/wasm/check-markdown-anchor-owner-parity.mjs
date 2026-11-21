import assert from 'node:assert/strict'
import { URL, pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
const url = process.argv[2]
  ? pathToFileURL(resolve(process.argv[2]))
  : new URL('../../packages/wasm/dist/index.mjs', import.meta.url)
const wasm = globalThis.WebAssembly
let r
try {
  globalThis.WebAssembly = undefined
  r = await import(url.href)
} finally {
  globalThis.WebAssembly = wasm
}
const quoted = '> ```\n> quote code ^inside'
const records = [
  // Original owner/duplicate cases.
  [
    'valid conflicts with independent owner',
    'alpha ^collision\n\nbeta ^collision\n\nIndependent ^unique',
    ['unique'],
    ['anchor-duplicate', 'anchor-duplicate'],
    ['alpha ^collision', 'beta ^collision'],
    ['<p id="unique"'],
  ],
  [
    'heading and fenced owners conflict',
    '## Heading ^collision\n\n```\nbody\n```\n^collision',
    [],
    ['anchor-duplicate', 'anchor-duplicate'],
    ['Heading ^collision', '>^collision</p>'],
  ],
  [
    'nonfinal marker does not compete',
    'alpha ^collision\ncloses this paragraph\n\nbeta ^collision',
    ['collision'],
    [],
    ['alpha ^collision'],
    ['<p id="collision" class="markdown-renderer__text">beta</p>'],
  ],
  [
    'indented code does not compete',
    '    literal ^collision\n\nbeta ^collision',
    ['collision'],
    [],
    ['literal ^collision'],
    ['<p id="collision" class="markdown-renderer__text">beta</p>'],
  ],
  [
    'fenced code does not compete',
    '```\nbody ^collision\n```\n\nbeta ^collision',
    ['collision'],
    [],
    ['body ^collision'],
    ['<p id="collision" class="markdown-renderer__text">beta</p>'],
  ],
  [
    'one owner only admits its final marker',
    'alpha ^collision\nbeta ^collision',
    ['collision'],
    [],
    ['alpha ^collision beta'],
    ['<p id="collision"'],
  ],
  [
    'pipe prose is not an owner; unique target survives',
    'Heading ^kept\n\n| ordinary prose\n^kept',
    ['kept'],
    ['anchor-placement'],
    ['| ordinary prose', '^kept'],
    ['<p id="kept"'],
  ],
  [
    'ordinary pipe line cannot own the exclusive marker',
    '| ordinary prose\n^loose',
    [],
    ['anchor-placement'],
    ['^loose'],
  ],
  [
    'real table closing line',
    '| alpha | beta |\n| --- | --- |\n| left | right |\n^table',
    ['table'],
    [],
    [],
    ['<table id="table"'],
    ['^table'],
  ],
  [
    'real table without outer pipes',
    'alpha | beta\n--- | ---\nleft | right\n^table',
    ['table'],
    [],
    [],
    ['<table id="table"'],
    ['^table'],
  ],
  [
    'loose rendered table has one final row',
    '| alpha | beta |\n| --- | --- |\n| left | right |\n\n| low | last |\n^table',
    ['table'],
    [],
    [],
    ['<table id="table"'],
    ['^table'],
  ],
  [
    'no cross-gap claim across blank line',
    '| alpha | beta |\n| --- | --- |\n| left | right |\n\n^gap',
    [],
    ['anchor-cross-gap'],
    ['^gap'],
  ],
  [
    'two spaces are not a separator',
    'Text  ^twin',
    [],
    ['anchor-placement'],
    ['^twin'],
  ],
  [
    'tab plus one space is not a separator',
    'Text\t ^mixed',
    [],
    ['anchor-placement'],
    ['^mixed'],
  ],
  [
    'prefix must include owning content',
    ' ^bare',
    [],
    ['anchor-placement'],
    ['^bare'],
  ],
  [
    'one ASCII space works at raw Unicode/CRLF offsets',
    '\uFEFF甲 😀 ^valid\r\n',
    ['valid'],
    [],
    [],
    ['<p id="valid"'],
    ['^valid'],
  ],
  [
    'quote only accepts final line',
    '> first ^early\n> last ^final',
    ['final'],
    [],
    ['first ^early last'],
    ['<blockquote id="final">'],
    ['^final'],
  ],
  [
    'early quote text does not hide independent owner',
    '> first ^kept\n> last ^quote\n\nControl ^kept',
    ['quote', 'kept'],
    [],
    ['first ^kept last'],
    ['<blockquote id="quote">', '<p id="kept"'],
  ],
  [
    'two neighboring quote blocks stay independent',
    '> First ^one\n\n> Second ^two',
    ['one', 'two'],
    [],
    [],
    ['<blockquote id="one">', '<blockquote id="two">'],
    ['^one', '^two'],
  ],
  [
    'nested list binds direct child item',
    '- parent\n  - child ^nested',
    ['nested'],
    [],
    [],
    ['<li id="nested" class="markdown-renderer__list-item">child</li>'],
    ['^nested'],
  ],
  [
    'nested list binds correct loose child and parent',
    '- parent ^root\n\n  - child ^nested',
    ['root', 'nested'],
    [],
    [],
    ['<li id="root"', '<li id="nested"'],
    ['^root', '^nested'],
  ],
  [
    'inherited ordered anchors stay with child and next sibling',
    '- [x] parent ^parent\n  1. child ^nested\n- next ^next',
    ['parent', 'nested', 'next'],
    [],
    [],
    ['<li id="parent"', '<li id="nested"', '<li id="next"'],
    ['^parent', '^nested', '^next'],
  ],
  [
    'global duplicate child and paragraph stay literal',
    '- parent\n  - child ^dupe\n\nPlain ^dupe',
    [],
    ['anchor-duplicate', 'anchor-duplicate'],
    ['child ^dupe', 'Plain ^dupe'],
  ],
  [
    'unbound code-like continuation keeps its marker',
    '- parent\n      - literal ^ignored',
    [],
    ['anchor-placement'],
    ['literal ^ignored'],
  ],
  [
    'unclosed quoted fence is code through quote end',
    quoted,
    [],
    [],
    ['<blockquote><pre', 'quote code ^inside'],
  ],
  [
    'unclosed quote code does not shadow a separate real owner',
    `${quoted}\n\nOther ^inside`,
    ['inside'],
    [],
    ['<blockquote><pre', 'quote code ^inside'],
    ['<p id="inside"'],
  ],
  [
    'closed quoted fence keeps literal while final prose still binds',
    `${quoted}\n> \`\`\`\n> Prose ^outside`,
    ['outside'],
    [],
    ['quote code ^inside'],
    ['<blockquote id="outside"'],
    ['^outside'],
  ],
  [
    'unclosed tilde fence is also literal',
    '> ~~~text\n> source ^tilde',
    [],
    [],
    ['source ^tilde'],
  ],
  // Copied child source retains its owner after another recursive list copy.
  [
    'bound grandchild and great-grandchild',
    '- parent\n  - child ^child\n    - grandchild ^grand\n      - great-grandchild ^deep',
    ['child', 'grand', 'deep'],
    [],
    [],
    ['<li id="child"', '<li id="grand"', '<li id="deep"'],
    ['^child', '^grand', '^deep'],
  ],
  [
    'nested sibling resets inherited owner path',
    '- parent\n  - first\n    - grand ^grand\n  - second ^second\n    - sibling ^sibling\n- flat ^flat',
    ['grand', 'second', 'sibling', 'flat'],
    [],
    [],
    ['<li id="grand"', '<li id="second"', '<li id="sibling"', '<li id="flat"'],
  ],
  [
    'loose list preserves owner positions',
    '- root ^root\n\n  - child ^child\n\n    1. number ^number',
    ['root', 'child', 'number'],
    [],
    [],
    ['<li id="root"', '<li id="child"', '<li id="number"'],
  ],
  [
    'deep duplicate competes once with another real owner',
    '- parent\n  - child\n    - grand ^collision\n\nOther ^collision\n\nIndependent ^unique',
    ['unique'],
    ['anchor-duplicate', 'anchor-duplicate'],
    ['grand ^collision', 'Other ^collision'],
    ['<p id="unique"'],
  ],
  [
    'jump without active ancestor remains literal and cannot poison outside owner',
    '- parent\n      - literal ^kept\n\nOther ^kept',
    ['kept'],
    ['anchor-placement'],
    ['literal ^kept'],
    ['<pre', '<p id="kept"'],
  ],
]
const listIds = (html) => [...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1])
const failures = []
for (const [
  name,
  source,
  ids,
  diagnostics,
  lit,
  markup = [],
  absent = [],
] of records) {
  try {
    const previous = globalThis.WebAssembly
    let nodes
    try {
      globalThis.WebAssembly = undefined
      nodes = r.collectMarkdownAnchorNodes(source)
    } finally {
      globalThis.WebAssembly = previous
    }
    assert.equal('then' in nodes, false)
    const projection = r.createMarkdownEditorProjection(source)
    const opts = { source, mode: 'article', contentVersion: name }
    const full = await r.renderMarkdownResultWithRuntime(opts)
    const chunked = await r.renderMarkdownChunksWithRuntime(opts)
    assert(full.ok && chunked.ok)
    assert(['SIMD-128', 'SCALAR-BASIC'].includes(full.value.engine))
    assert.equal(chunked.value.engine, full.value.engine)
    assert.equal(full.value.rawSource, source)
    assert.equal(chunked.value.rawSource, source)
    const renderedChunks = chunked.value.chunks.map((c) => c.html).join('')
    const actual = {
      name,
      ids: nodes.filter((n) => n.ok).map((n) => n.id),
      diagnostics: nodes.filter((n) => !n.ok).map((n) => n.code),
      rendered: listIds(full.value.html),
      chunked: listIds(renderedChunks),
      html: full.value.html,
    }
    process.stdout.write(`${JSON.stringify(actual)}\n`)
    assert.deepEqual(actual.ids, ids, 'collector ids')
    assert.deepEqual(actual.diagnostics, diagnostics, 'collector diagnostics')
    assert.equal(
      projection.nodes.filter(
        (n) => n.kind === 'anchor' && n.status === 'valid',
      ).length,
      ids.length,
    )
    assert.deepEqual(
      projection.diagnostics
        .filter((n) => n.code.startsWith('anchor-'))
        .map((n) => n.code),
      diagnostics,
      'projection diagnostics',
    )
    assert.deepEqual(actual.rendered, ids, 'full ids')
    assert.deepEqual(actual.chunked, ids, 'chunked ids')
    for (const node of nodes) {
      const range = node.ok ? node.ranges.marker : node.range
      assert.match(source.slice(range.start, range.end), /^\^[a-z][a-z0-9-]*$/)
    }
    for (const [html] of [[full.value.html], [renderedChunks]]) {
      for (const test of [...lit, ...markup])
        assert.ok(html.includes(test), `preserve/emit ${test}`)
      for (const test of absent)
        assert.ok(!html.includes(test), `strip accepted marker ${test}`)
    }
  } catch (error) {
    failures.push({ name, error: String(error) })
  }
}
assert.deepEqual(failures, [])
process.stdout.write(
  `Markdown anchor ownership parity: ${records.length} functional cases passed\n`,
)
