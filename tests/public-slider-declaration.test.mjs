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

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const fixtures = path.join(root, 'tests/fixtures/public-slider-declaration')
const evidence = process.env.SLIDER_EVIDENCE_DIR
assert.ok(
  evidence,
  'Set SLIDER_EVIDENCE_DIR to retain actual diagnostics and logs',
)
mkdirSync(evidence, { recursive: true })

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
        path.join(fixtures, 'observe-producer.cjs'),
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
  const req = createRequire(path.join(consumer, 'package.json'))
  const ts = req('typescript')
  assert.equal(ts.version, '6.0.2')
  assert.equal(req('vue/package.json').version, '3.5.32')
  assert.equal(req('vue-tsc/package.json').version, '3.2.6')
  const packageRoot = path.dirname(
    req.resolve('@ozwasyd/element-plus/package.json'),
  )
  const manifest = req('@ozwasyd/element-plus/package.json')
  assert.equal(manifest.name, '@ozwasyd/element-plus')
  assert.equal(manifest.version, '1.5.1')
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
      JSON.stringify(report, null, 2) + '\n',
    )
    const local = rows.filter((d) => d.file === `slider-${phase}.ts`)
    const external = rows.filter((d) => d.file !== `slider-${phase}.ts`)
    // Other component owners remain open on the exact published baseline.
    assert.equal(external.length, 8, JSON.stringify(external, null, 2))
    assert.ok(
      external.every(
        (d) =>
          [2307, 2339].includes(d.code) &&
          (d.code === 2307
            ? /'\.\/(cascader|select|time-select)'/.test(d.message)
            : /Property '(ElCascader|ElOption|ElOptionGroup|ElSelect|ElTimeSelect)'/.test(d.message)) &&
          !/slider/i.test(d.message),
      ),
      'only original unrelated installed-package failures remain',
    )
    if (phase === 'positive')
      assert.deepEqual(local, [], JSON.stringify(local, null, 2))
    else {
      assert.deepEqual(
        local.map((d) => d.line).sort((a, b) => a - b),
        [7, 9, 10, 12, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 27],
        JSON.stringify(local, null, 2),
      )
      assert.ok(
        local.every((d) => [2322, 2345, 2769].includes(d.code)),
        JSON.stringify(local, null, 2),
      )
    }
  }
  console.log(
    'PASS: strict packed slider controls; full-library strict check remains FAIL with 8 unrelated diagnostics',
  )
  assert.equal(options.skipLibCheck, false)
  assert.equal(options.strict, true)
})
