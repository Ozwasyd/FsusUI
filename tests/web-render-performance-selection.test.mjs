import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, URL } from 'node:url'
import { Script } from 'node:vm'
import ts from 'typescript'

const root = fileURLToPath(new URL('..', import.meta.url))
const source = readFileSync(
  new URL('../scripts/web-render-performance.mjs', import.meta.url),
  'utf8',
)
const ast = ts.createSourceFile(
  'web-render-performance.mjs',
  source,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.JS,
)
assert.equal(ast.parseDiagnostics.length, 0)

const declaration = (name) =>
  ast.statements.find(
    (statement) =>
      ts.isVariableStatement(statement) &&
      statement.declarationList.declarations.some(
        (entry) => ts.isIdentifier(entry.name) && entry.name.text === name,
      ),
  )
const start = declaration('argv')
const end = declaration('percentile')
assert.ok(start && end && start.pos < end.pos)

// Execute the actual argument parser and complete matrix selection, before the
// measurement helpers. No browser, server or measurement implementation runs.
const preflight = new Script(
  `${source.slice(start.pos, end.pos)}\nJSON.stringify(matrix)`,
)
const select = (...args) =>
  JSON.parse(
    preflight.runInNewContext(
      {
        path,
        root,
        process: { argv: ['node', 'web-render-performance.mjs', ...args] },
      },
      { timeout: 1000 },
    ),
  )
const idOf = ([scenario, size, refreshHz, dpr, motion]) =>
  `${scenario}-${size}-${refreshHz}hz-dpr${dpr}-${motion}`

test('argument rejection precedes server launch, browser launch and output writes', () => {
  const effects = []
  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      ['spawn', 'mkdir', 'writeFile', 'chromium.launch'].includes(
        node.expression.getText(ast),
      )
    ) {
      effects.push(node)
    }
    ts.forEachChild(node, visit)
  }
  visit(ast)
  assert.ok(effects.length >= 4)
  assert.ok(effects.every((node) => node.pos >= end.pos))
})

test('default quick selection preserves all thirteen existing case identities', () => {
  assert.deepEqual(select().map(idOf), [
    'virtual-list-fixed-100000-60hz-dpr1-enabled',
    'virtual-list-variable-100000-120hz-dpr2-reduced',
    'virtual-grid-100000-60hz-dpr2-disabled',
    'markdown-cold-24576-60hz-dpr1-enabled',
    'markdown-hot-1048576-120hz-dpr2-reduced',
    'select-v2-100000-60hz-dpr2-disabled',
    'table-1000-60hz-dpr1-enabled',
    'data-pipeline-table-100000-120hz-dpr2-reduced',
    'render-pipeline-monolithic-2000000-60hz-dpr2-disabled',
    'render-pipeline-cooperative-2000000-60hz-dpr1-enabled',
    'virtual-window-index-legacy-100000-120hz-dpr2-reduced',
    'virtual-window-index-incremental-100000-60hz-dpr2-disabled',
    'markdown-feature-activation-4096-60hz-dpr1-enabled',
  ])
})

test('full selection preserves every scenario, size and dimension combination', () => {
  const matrix = select('--profile', 'full')
  assert.equal(matrix.length, 276)
  assert.equal(new Set(matrix.map(idOf)).size, 276)
  const cases = new Map()
  for (const [scenario, size, ...dimensions] of matrix) {
    const key = `${scenario}-${size}`
    if (!cases.has(key)) cases.set(key, [])
    cases.get(key).push(dimensions)
  }
  assert.deepEqual(
    [...cases.keys()],
    [
      'virtual-list-fixed-1000',
      'virtual-list-fixed-10000',
      'virtual-list-fixed-100000',
      'virtual-list-variable-1000',
      'virtual-list-variable-10000',
      'virtual-list-variable-100000',
      'virtual-grid-10000',
      'virtual-grid-100000',
      'markdown-cold-24576',
      'markdown-hot-262144',
      'markdown-hot-1048576',
      'select-v2-2000',
      'select-v2-10000',
      'select-v2-100000',
      'table-1000',
      'data-pipeline-table-5000',
      'data-pipeline-table-10000',
      'data-pipeline-table-100000',
      'render-pipeline-monolithic-2000000',
      'render-pipeline-cooperative-2000000',
      'virtual-window-index-legacy-100000',
      'virtual-window-index-incremental-100000',
      'markdown-feature-activation-4096',
    ],
  )
  const expected = [60, 120].flatMap((hz) =>
    [1, 2].flatMap((dpr) =>
      ['enabled', 'reduced', 'disabled'].map((motion) => [hz, dpr, motion]),
    ),
  )
  for (const dimensions of cases.values())
    assert.deepEqual(dimensions, expected)
  for (const cell of select())
    assert.ok(matrix.some((item) => idOf(item) === idOf(cell)))
})

for (const profile of ['quick', 'full']) {
  test(`every exact ${profile} case retains its complete original tuple`, () => {
    const matrix = select('--profile', profile)
    for (const cell of matrix) {
      assert.deepEqual(select('--profile', profile, '--case', idOf(cell)), [
        cell,
      ])
    }
  })
}

test('existing scenario-prefix selection retains its original dimension', () => {
  for (const profile of ['quick', 'full']) {
    const cases = select('--profile', profile, '--scenario', 'render-pipeline-')
    assert.deepEqual(cases, [
      ['render-pipeline-monolithic', 2_000_000, 60, 1, 'enabled'],
      ['render-pipeline-cooperative', 2_000_000, 60, 1, 'enabled'],
    ])
  }
})

for (const [name, args, reason] of [
  ['missing ID', ['--case'], /requires a full case ID/],
  ['empty ID', ['--case', ''], /requires a full case ID/],
  ['unknown ID', ['--case', 'unknown'], /contains no cases/],
  ['partial ID', ['--case', 'virtual-grid'], /contains no cases/],
  [
    'ID outside the selected quick profile',
    ['--case', 'virtual-grid-100000-120hz-dpr2-reduced'],
    /contains no cases/,
  ],
  ['unknown scenario', ['--scenario', 'unknown'], /contains no cases/],
]) {
  test(`rejects ${name} before measurement`, () => {
    assert.throws(() => select(...args), reason)
  })
}

for (const scenario of ['virtual-grid', '']) {
  test(`rejects simultaneous --case and --scenario ${JSON.stringify(scenario)}`, () => {
    assert.throws(
      () =>
        select(
          '--case',
          'virtual-grid-100000-60hz-dpr2-disabled',
          '--scenario',
          scenario,
        ),
      /cannot be combined/,
    )
  })
}
