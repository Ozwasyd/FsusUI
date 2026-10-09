import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, copyFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const fixture = path.join(
  root,
  'tests/fixtures/public-datepicker-panel-declaration',
)
const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'))

test('canonical producer preserves the inferred panel contract and emits named types', () => {
  const evidence =
    process.env.PUBLIC_DATEPICKER_PANEL_EVIDENCE_DIR ??
    mkdtempSync(path.join(os.tmpdir(), 'datepicker-panel-producer-'))
  const output = path.join(evidence, 'producer.json')
  const run = spawnSync(
    process.execPath,
    [
      'scripts/with-node-heap.mjs',
      process.execPath,
      '--require',
      'tsx/cjs',
      path.join(fixture, 'observe-producer.cjs'),
      'verify',
      output,
    ],
    {
      cwd: root,
      encoding: 'utf8',
      timeout: 300_000,
      maxBuffer: 16 * 1024 * 1024,
      env: { ...process.env, FSUS_NODE_HEAP_PROFILE: 'build' },
    },
  )
  writeFileSync(path.join(evidence, 'producer.log'), run.stdout + run.stderr)
  assert.equal(run.status, 0, run.stderr || run.error?.message || run.stdout)
  const result = readJson(output)
  assert.equal(result.canonicalProducerError, null)
  assert.equal(result.originalDiagnosticReturnUnchanged, true)
  assert.equal(result.inferredParameterAndReturnParity, 'PASS')
  assert.equal(result.intentionalContractMutationsRejected, 2)
  assert.equal(result.diagnostics.filter((row) => row.code === 7056).length, 11)
})

test('actual installed tarball accepts the exact panel contract and rejects invalid calls', () => {
  const consumer = process.env.PUBLIC_DATEPICKER_PANEL_CONSUMER
  assert.ok(
    consumer,
    'set PUBLIC_DATEPICKER_PANEL_CONSUMER to a fresh frozen tarball installation',
  )
  const requireConsumer = createRequire(path.join(consumer, 'package.json'))
  const ts = requireConsumer('typescript')
  assert.equal(ts.version, '6.0.2')
  assert.equal(requireConsumer('vue/package.json').version, '3.5.32')
  const manifest = readJson(path.join(consumer, 'package.json'))
  assert.match(manifest.dependencies['@ozwasyd/element-plus'], /^file:.*\.tgz$/)
  for (const file of ['positive.ts', 'negative.ts', 'tsconfig.json']) {
    copyFileSync(
      path.join(fixture, file),
      path.join(consumer, `datepicker-panel-${file}`),
    )
  }
  const options = ts.convertCompilerOptionsFromJson(
    readJson(path.join(fixture, 'tsconfig.json')).compilerOptions,
    consumer,
  )
  assert.deepEqual(options.errors, [])
  const diagnostics = (file) =>
    ts
      .getPreEmitDiagnostics(
        ts.createProgram(
          [path.join(consumer, `datepicker-panel-${file}`)],
          options.options,
        ),
      )
      .map((diagnostic) => ({
        code: diagnostic.code,
        file:
          diagnostic.file && path.relative(consumer, diagnostic.file.fileName),
        message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
      }))
  const positive = diagnostics('positive.ts')
  const negative = diagnostics('negative.ts')
  const result = { strict: true, skipLibCheck: false, positive, negative }
  writeFileSync(
    path.join(consumer, 'datepicker-panel-controls.json'),
    JSON.stringify(result, null, 2) + '\n',
  )
  assert.deepEqual(positive, [])
  assert.equal(negative.length, 4)
  assert.ok(
    negative.every(
      (diagnostic) => diagnostic.file === 'datepicker-panel-negative.ts',
    ),
  )
  assert.deepEqual(
    negative.map((diagnostic) => diagnostic.code).sort(),
    [2322, 2345, 2345, 2554],
  )
})
