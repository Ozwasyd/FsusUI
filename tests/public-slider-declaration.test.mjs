import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import {
  assertInstalled,
  assertProducer,
  authority,
  installedArtifact,
  sourceProfile,
} from './fixtures/public-slider-declaration/authority.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const fixtures = path.join(root, 'tests/fixtures/public-slider-declaration')
const evidence = process.env.SLIDER_EVIDENCE_DIR
assert.ok(
  evidence,
  'Set SLIDER_EVIDENCE_DIR to retain actual diagnostics and logs',
)
mkdirSync(evidence, { recursive: true })

test('pinned independent and composed inventories reject unknown diagnostics', () => {
  for (const profile of authority.profiles) {
    assertProducer(profile, profile.producerDiagnostics)
    assertInstalled(profile, 'positive', profile.externalDiagnostics)
    assertInstalled(profile, 'negative', [
      ...profile.externalDiagnostics,
      ...authority.negative,
    ])
    const unexpected = {
      file: 'unknown.ts',
      line: 1,
      code: 7056,
      message: 'unexpected',
    }
    assert.throws(() =>
      assertProducer(profile, [...profile.producerDiagnostics, unexpected]),
    )
    assert.throws(() =>
      assertInstalled(profile, 'positive', [
        ...profile.externalDiagnostics,
        unexpected,
      ]),
    )
    assert.throws(() =>
      assertInstalled(profile, 'negative', [
        ...profile.externalDiagnostics,
        ...authority.negative.slice(1),
      ]),
    )
    assert.throws(() =>
      assertInstalled(profile, 'negative', [
        ...profile.externalDiagnostics,
        ...authority.negative.map((row, i) =>
          i === 0 ? { ...row, code: 2345 } : row,
        ),
      ]),
    )
  }
})

test(
  'real canonical declaration producer retains original slider contracts',
  { timeout: 300_000 },
  () => {
    const result = spawnSync(
      process.execPath,
      [
        'scripts/with-node-heap.mjs',
        'node',
        '--require',
        'tsx/cjs',
        path.join(fixtures, 'observe-producer.mjs'),
      ],
      {
        cwd: root,
        env: { ...process.env, FSUS_NODE_HEAP_PROFILE: 'build' },
        encoding: 'utf8',
        maxBuffer: 20 * 1024 * 1024,
      },
    )
    writeFileSync(
      path.join(evidence, 'producer.log'),
      (result.stdout || '') + (result.stderr || ''),
    )
    assert.equal(result.status, 0, result.stderr?.slice(-4000))
  },
)

test('actual installed tarball checks strict slider positive and negative controls', () => {
  const consumer = process.env.SLIDER_CONSUMER_ROOT
  assert.ok(
    consumer,
    'Set SLIDER_CONSUMER_ROOT to a fresh frozen install of the real candidate tarball',
  )
  const installManifest = JSON.parse(
    readFileSync(path.join(consumer, 'package.json'), 'utf8'),
  )
  assert.match(
    installManifest.dependencies['@ozwasyd/element-plus'],
    /^file:.*\.tgz$/,
    'consumer must install an actual tarball',
  )
  const req = createRequire(path.join(consumer, 'package.json'))
  const ts = req('typescript')
  assert.equal(ts.version, '6.0.2')
  assert.equal(req('vue/package.json').version, '3.5.32')
  assert.equal(req('vue-tsc/package.json').version, '3.2.6')
  const packageRoot = path.dirname(
    path.dirname(req.resolve('@ozwasyd/element-plus')),
  )
  const manifest = JSON.parse(
    readFileSync(path.join(packageRoot, 'package.json'), 'utf8'),
  )
  assert.equal(manifest.name, '@ozwasyd/element-plus')
  assert.equal(manifest.version, '1.5.1')
  const profile = sourceProfile(root)
  const tarball = path.resolve(
    consumer,
    installManifest.dependencies['@ozwasyd/element-plus'].slice('file:'.length),
  )
  const artifact = installedArtifact(profile, tarball, packageRoot)
  writeFileSync(
    path.join(evidence, 'packed-identity.json'),
    `${JSON.stringify({ sourceProfile: profile.name, ...artifact }, null, 2)}\n`,
  )
  for (const module of ['es', 'lib'])
    assert.ok(
      existsSync(
        path.join(packageRoot, module, 'components/slider/index.d.ts'),
      ),
      `${module} actual slider barrel`,
    )
  const options = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    strict: true,
    skipLibCheck: false,
    noEmit: true,
    types: [],
    lib: ['lib.es2022.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts'],
  }
  const report = {}
  for (const phase of ['positive', 'negative']) {
    const filename = path.join(consumer, `slider-${phase}.ts`)
    copyFileSync(path.join(fixtures, `${phase}.ts`), filename)
    const program = ts.createProgram([filename], options)
    const diagnostics = ts.getPreEmitDiagnostics(program)
    const rows = diagnostics.map((d) => ({
      file: d.file && path.relative(consumer, d.file.fileName),
      line:
        d.file && d.start !== undefined
          ? d.file.getLineAndCharacterOfPosition(d.start).line + 1
          : null,
      code: d.code,
      message: ts.flattenDiagnosticMessageText(d.messageText, '\n'),
    }))
    report[phase] = rows
    writeFileSync(
      path.join(evidence, 'packed-strict.json'),
      `${JSON.stringify(report, null, 2)}\n`,
    )
    assertInstalled(profile, phase, rows)
  }
  writeFileSync(
    path.join(evidence, 'packed-status.json'),
    `${JSON.stringify(
      {
        sourceProfile: profile.name,
        fixtureControls: 'PASS',
        wholeLibraryStrict: report.positive.length === 0 ? 'PASS' : 'FAIL',
        positiveDiagnostics: report.positive.length,
        negativeLocalDiagnostics: report.negative.filter(
          (d) => d.file === 'slider-negative.ts',
        ).length,
        externalDiagnostics: profile.externalDiagnostics.length,
        wholeArtifactRuntimeParity: 'UNRUN (separate retained FAIL evidence)',
      },
      null,
      2,
    )}\n`,
  )
  process.stdout.write(
    `PASS: strict packed slider controls (${profile.name}); full-library strict ${report.positive.length === 0 ? 'PASS' : 'FAIL'} with ${report.positive.length} diagnostics\n`,
  )
  assert.equal(options.skipLibCheck, false)
  assert.equal(options.strict, true)
})
