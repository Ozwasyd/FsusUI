import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { readFileSync, mkdtempSync, copyFileSync } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath, pathToFileURL } from 'node:url'
import test from 'node:test'
import { JSDOM } from 'jsdom'
import { register } from 'tsx/cjs/api'
import ts from 'typescript'
import {
  diagnosticBag,
  filesBelow,
  parse,
  regions,
  snapshot,
  strictProgram,
  walk,
} from './fixtures/public-emitted-payload-declarations/helpers.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const fixtures = path.join(
  root,
  'tests/fixtures/public-emitted-payload-declarations',
)
const baseline = JSON.parse(
  readFileSync(path.join(fixtures, 'baseline.json'), 'utf8'),
)
assert.ok(
  process.env.FSUSUI_PAYLOAD_CONSUMER_ROOT,
  'Set FSUSUI_PAYLOAD_CONSUMER_ROOT to the real local-tarball consumer',
)
assert.ok(
  process.env.FSUSUI_PAYLOAD_TARBALL,
  'Set FSUSUI_PAYLOAD_TARBALL to the canonical candidate tarball',
)
const consumer = path.resolve(process.env.FSUSUI_PAYLOAD_CONSUMER_ROOT)
const packageRoot = path.join(consumer, 'node_modules/@ozwasyd/element-plus')
const tarball = path.resolve(process.env.FSUSUI_PAYLOAD_TARBALL)
const scratch = mkdtempSync(
  path.join(os.tmpdir(), 'fsusui-payload-regression-'),
)
const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'))
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex')
const require = createRequire(import.meta.url)

test('preflight binds the original toolchain, installed tarball and four source validators', () => {
  assert.equal(process.version, baseline.toolchain.node)
  assert.equal(
    execFileSync('pnpm', ['--version'], { encoding: 'utf8' }).trim(),
    baseline.toolchain.pnpm,
  )
  assert.equal(ts.version, baseline.toolchain.typescript)
  for (const [name, version] of [
    ['vue', baseline.toolchain.vue],
    ['vue-tsc', baseline.toolchain.vueTsc],
    ['typescript', baseline.toolchain.typescript],
  ]) {
    assert.equal(
      readJson(path.join(root, 'node_modules', name, 'package.json')).version,
      version,
    )
    assert.equal(
      readJson(path.join(consumer, 'node_modules', name, 'package.json'))
        .version,
      version,
    )
  }
  assert.equal(
    hash(readFileSync(path.join(root, 'pnpm-lock.yaml'))),
    baseline.sourceLockSha256,
  )
  const manifest = readJson(
    path.join(path.dirname(tarball), 'fsusui-npm-candidate.manifest.json'),
  )
  assert.equal(hash(readFileSync(tarball)), manifest.artifact.sha256)
  assert.deepEqual(manifest.toolchain, {
    node: baseline.toolchain.node,
    npm: baseline.toolchain.npm,
    pnpm: baseline.toolchain.pnpm,
  })
  assert.equal(manifest.build.lockfileSha256, baseline.sourceLockSha256)
  let validators = 0
  for (const region of regions) {
    const file = `vue/packages/components/${region.component}/src/${region.file}.ts`
    const source = parse(readFileSync(path.join(root, file), 'utf8'), file)
    walk(source, (node) => {
      if (
        !ts.isVariableDeclaration(node) ||
        node.name.getText(source) !== region.owner
      )
        return
      assert.ok(ts.isObjectLiteralExpression(node.initializer))
      for (const property of node.initializer.properties) {
        if (
          !region.events.includes(
            property.name.getText(source).replace(/^\[|\]$/g, ''),
          )
        )
          continue
        assert.ok(ts.isArrowFunction(property.initializer))
        assert.equal(
          property.initializer.parameters[0].name.getText(source),
          'payload',
        )
        validators++
      }
    })
  }
  assert.equal(validators, 4)
})

test('source and actual installed ESM/CJS/declarations preserve the baseline beyond payload binding names', () => {
  const actual = snapshot(root, packageRoot)
  assert.ok(Object.keys(actual).length > 9)
  assert.deepEqual(actual, baseline.canonicalHashes)
  const packedFiles = Object.keys(actual).filter(
    (file) => !file.startsWith('vue/'),
  )
  assert.ok(packedFiles.length > 0)
  execFileSync('tar', [
    '-xzf',
    tarball,
    '-C',
    scratch,
    ...packedFiles.map((relative) => `package/${relative}`),
  ])
  for (const relative of packedFiles) {
    const packed = readFileSync(path.join(scratch, 'package', relative))
    assert.equal(
      hash(packed),
      hash(readFileSync(path.join(packageRoot, relative))),
      relative,
    )
  }
})

const dom = new JSDOM('')
for (const name of ['FocusEvent', 'MouseEvent', 'Event'])
  globalThis[name] = dom.window[name]
const unregister = register({
  tsconfig: path.join(root, 'vue/tsconfig.web.json'),
})
const modules = await Promise.all(
  regions.map(async (region) => ({
    region,
    source: require(
      path.join(
        root,
        `vue/packages/components/${region.component}/src/${region.file}.ts`,
      ),
    )[region.owner],
    esm: (
      await import(
        pathToFileURL(
          path.join(
            packageRoot,
            `es/components/${region.component}/src/${region.file}.mjs`,
          ),
        )
      )
    )[region.owner],
    cjs: require(
      path.join(
        packageRoot,
        `lib/components/${region.component}/src/${region.file}.js`,
      ),
    )[region.owner],
  })),
)
unregister()

for (const eventName of ['focus', 'blur', 'select']) {
  test(`${eventName} accepts original DOM payloads and rejects invalid payloads in source, ESM and CJS`, () => {
    const owner = eventName === 'select' ? modules[1] : modules[0]
    const valid =
      eventName === 'select'
        ? new MouseEvent('click')
        : new FocusEvent(eventName)
    const invalid = [
      null,
      undefined,
      {},
      'event',
      false,
      0,
      new Event(eventName),
      eventName === 'select'
        ? new FocusEvent('focus')
        : new MouseEvent('click'),
    ]
    for (const emits of [owner.source, owner.esm, owner.cjs]) {
      assert.equal(emits[eventName].length, 1)
      assert.equal(emits[eventName](valid), true)
      for (const payload of invalid)
        assert.equal(emits[eventName](payload), false)
    }
  })
}

test('node-contextmenu preserves argument order, short-circuit return identity and original permissive validation', () => {
  const data = { id: 'alpha', event: 'consumer-owned field' }
  const node = { key: 'alpha', level: 1, data }
  const event = new Event('contextmenu')
  const cases = [
    [[event, data, node], node],
    [[new MouseEvent('contextmenu'), data, node], node],
    [[{ event: 'original truthy payload' }, data, node], node],
    [[null, data, node], null],
    [[undefined, data, node], undefined],
    [[false, data, node], false],
    [[0, data, node], 0],
    [['', data, node], ''],
    [[event, null, node], null],
    [[event, undefined, node], undefined],
    [[event, data, null], null],
    [[event, data, undefined], undefined],
    [[event, data, false], false],
  ]
  for (const emits of [modules[2].source, modules[2].esm, modules[2].cjs]) {
    assert.equal(emits['node-contextmenu'].length, 3)
    for (const [args, expected] of cases)
      assert.equal(emits['node-contextmenu'](...args), expected)
    assert.equal(data.event, 'consumer-owned field')
  }
})

test('actual installed generated overloads have unique names and retain the event literals and payload types', () => {
  const counts = { focus: 0, blur: 0, select: 0, 'node-contextmenu': 0 }
  for (const region of regions) {
    for (const mode of ['es', 'lib']) {
      for (const file of filesBelow(
        path.join(packageRoot, mode, 'components', region.component),
      ).filter((file) => file.endsWith('.d.ts'))) {
        const source = parse(readFileSync(file, 'utf8'), file)
        walk(source, (node) => {
          if (!node.parameters) return
          const first = node.parameters[0]
          if (
            !first?.type ||
            !ts.isLiteralTypeNode(first.type) ||
            !ts.isStringLiteral(first.type.literal)
          )
            return
          const event = first.type.literal.text
          if (!(event in counts)) return
          const names = node.parameters.map((parameter) =>
            parameter.name.getText(source),
          )
          assert.equal(new Set(names).size, names.length, `${file}: ${event}`)
          assert.equal(names[0], 'event')
          // Other embedded components also emit focus/blur with no payload or
          // an existing evt binding. Their full declarations are frozen above.
          if (!node.parameters[1] || names[1] === 'evt') return
          assert.equal(names[1], 'payload')
          assert.equal(
            node.parameters[1].type.getText(source),
            event === 'select'
              ? 'MouseEvent'
              : event === 'node-contextmenu'
                ? 'Event'
                : 'FocusEvent',
          )
          assert.equal(
            node.parameters.length,
            event === 'node-contextmenu' ? 4 : 2,
          )
          counts[event]++
        })
      }
    }
  }
  assert.deepEqual(counts, baseline.overloadCounts)
  assert.ok(Object.values(counts).every((count) => count > 0))
})

test('strict installed-package check removes exactly 26 reproduced diagnostics, preserves the historical failed baseline and checks positive/negative emit contracts', () => {
  assert.equal(
    baseline.historicalDiagnostics.reduce((sum, row) => sum + row.count, 0),
    191,
  )
  assert.equal(
    baseline.diagnostics.reduce((sum, row) => sum + row.count, 0),
    baseline.reproducedDiagnosticCount,
  )
  const removed = (row) =>
    row.code === 2300 &&
    /components\/(color-picker|inbox-primitives|tree-v2)\//.test(row.file)
  assert.equal(
    baseline.diagnostics
      .filter(removed)
      .reduce((sum, row) => sum + row.count, 0),
    26,
  )
  const expected = baseline.diagnostics.filter((row) => !removed(row))
  const missingDependency = (row) =>
    row.code === 2307 &&
    /Cannot find module '(vue-router|type-fest)'/.test(row.message)
  const dependencyProjectionIsFixed = ['vue-router', 'type-fest'].every(
    (name) =>
      name in readJson(path.join(packageRoot, 'package.json')).dependencies,
  )
  const expectedForArtifact = dependencyProjectionIsFixed
    ? expected.filter((row) => !missingDependency(row))
    : expected
  const expectedCount = dependencyProjectionIsFixed
    ? baseline.historicalDiagnosticCount - 26
    : baseline.reproducedDiagnosticCount - 26
  const probe = path.join(consumer, 'payload-controls.ts')
  copyFileSync(path.join(fixtures, 'payload-controls.ts'), probe)
  const diagnostics = strictProgram(
    path.join(consumer, 'tsconfig.all.json'),
    probe,
  )
  assert.deepEqual(diagnosticBag(diagnostics, packageRoot), expectedForArtifact)
  assert.equal(diagnostics.length, expectedCount)
  assert.equal(
    diagnostics.filter((diagnostic) => diagnostic.code === 2300).length,
    8,
  )
  assert.ok(
    diagnostics
      .filter((diagnostic) => diagnostic.code === 2300)
      .every((diagnostic) =>
        diagnostic.file.fileName.includes('/markdown-editor/'),
      ),
  )
})

test('original Vitest component emission controls select and pass exactly three existing tests', () => {
  const files = [
    'vue/packages/components/color-picker/__tests__/color-picker.test.tsx',
    'vue/packages/components/inbox-primitives/__tests__/inbox-primitives.test.tsx',
    'vue/packages/components/tree-v2/__tests__/tree.test.ts',
  ]
  const names = [
    'Color-picker > it will target the focus & blur',
    'inbox primitives > renders selectable conversation items with current state and unread label',
    'Virtual Tree > events > context-menu',
  ]
  const selector =
    '^(Color-picker it will target the focus & blur|inbox primitives renders selectable conversation items with current state and unread label|Virtual Tree events context-menu)$'
  assert.ok(selector.length > 0)
  const common = ['--config', 'vue/vitest.config.ts', ...files, '-t', selector]
  const preflight = path.join(scratch, 'preflight.json')
  execFileSync(
    'pnpm',
    ['exec', 'vitest', 'list', ...common, '--json', preflight],
    { cwd: root, stdio: 'pipe' },
  )
  const selected = readJson(preflight)
  assert.equal(selected.length, 3)
  assert.deepEqual(selected.map((item) => item.name).sort(), names.sort())
  assert.deepEqual(
    selected.map((item) => path.relative(root, item.file)).sort(),
    files.sort(),
  )
  const report = path.join(scratch, 'vitest.json')
  execFileSync(
    'pnpm',
    [
      'exec',
      'vitest',
      'run',
      ...common,
      '--reporter=json',
      '--outputFile',
      report,
    ],
    { cwd: root, stdio: 'pipe' },
  )
  const results = readJson(report)
  assert.equal(results.success, true)
  assert.equal(results.numPassedTests, 3)
  assert.equal(results.numFailedTests, 0)
})
