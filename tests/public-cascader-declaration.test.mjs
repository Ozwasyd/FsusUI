import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { parse, compileScript, compileTemplate } from 'vue/compiler-sfc'
import { transform } from 'esbuild'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const fixture = path.join(root, 'tests/fixtures/public-cascader-declaration')
const base = '2d05f240e5fb04ac0cd602b4ed638ffe00b1859b'
const evidence =
  process.env.FSUS_CASCADER_EVIDENCE ||
  mkdtempSync(path.join(tmpdir(), 'cascader-declaration-'))
mkdirSync(evidence, { recursive: true })
const original = (file) =>
  execFileSync('git', ['show', `${base}:${file}`], {
    cwd: root,
    encoding: 'utf8',
  })
const run = (command, args, label, cwd = root) => {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  })
  writeFileSync(
    path.join(evidence, `${label}.log`),
    (result.stdout || '') + (result.stderr || ''),
  )
  assert.equal(result.error, undefined)
  assert.equal(
    result.status,
    0,
    `${label} failed; see ${evidence}/${label}.log`,
  )
  return result.stdout
}

test('type-only repair preserves compiled script, template, barrel and pinned inputs', async () => {
  const sfcPath = 'vue/packages/components/cascader/src/cascader.vue'
  const before = parse(original(sfcPath)).descriptor
  const after = parse(readFileSync(path.join(root, sfcPath), 'utf8')).descriptor
  const scripts = [before, after].map((descriptor) =>
    compileScript(descriptor, { id: 'xxx' }),
  )
  const javascript = await Promise.all(
    scripts.map((script) =>
      transform(script.content, { loader: 'ts', target: 'es2022' }),
    ),
  )
  assert.equal(javascript[0].code, javascript[1].code)
  assert.deepEqual(scripts[0].bindings, scripts[1].bindings)
  const templates = [before, after].map((descriptor, index) =>
    compileTemplate({
      source: descriptor.template.content,
      filename: 'cascader.vue',
      id: 'xxx',
      compilerOptions: { bindingMetadata: scripts[index].bindings },
    }),
  )
  assert.deepEqual(templates[0].errors, [])
  assert.deepEqual(templates[1].errors, [])
  assert.equal(templates[0].code, templates[1].code)
  const barrel = 'vue/packages/components/cascader/index.ts'
  const outputs = await Promise.all(
    [original(barrel), readFileSync(path.join(root, barrel), 'utf8')].map(
      (source) => transform(source, { loader: 'ts', target: 'es2022' }),
    ),
  )
  assert.equal(outputs[0].code, outputs[1].code)
  for (const file of [
    'package.json',
    'pnpm-lock.yaml',
    'vue/internal/build/src/tasks/types-definitions.ts',
  ]) {
    assert.equal(
      readFileSync(path.join(root, file), 'utf8'),
      original(file),
      `${file} identity changed`,
    )
  }
  writeFileSync(
    path.join(evidence, 'runtime-parity.json'),
    `${JSON.stringify(
      {
        script: 'PASS',
        template: 'PASS',
        barrel: 'PASS',
        pinnedInputs: 'PASS',
        scriptSha256: createHash('sha256')
          .update(javascript[1].code)
          .digest('hex'),
      },
      null,
      2,
    )}\n`,
  )
})

test('real canonical producer emits cascader and retains the complete original inferred contract', () => {
  run(
    process.execPath,
    [
      '--require',
      'tsx/cjs',
      path.join(fixture, 'producer.mjs'),
      path.join(evidence, 'producer.json'),
    ],
    'producer',
  )
  const result = JSON.parse(
    readFileSync(path.join(evidence, 'producer.json'), 'utf8'),
  )
  assert.equal(result.producerTypeScript, '5.9.2')
  assert.deepEqual(result.parityErrors, [])
  const independentSources = new Set(
    [
      'date-picker/src/panel-utils.ts',
      'pagination/src/components/sizes.vue',
      'select/index.ts',
      'select/src/select.vue',
      'select/src/useSelect.ts',
      'slider/index.ts',
      'slider/src/composables/use-slide.ts',
      'slider/src/slider.vue',
      'time-select/index.ts',
      'time-select/src/time-select.vue',
    ].map((file) => `vue/packages/components/${file}`),
  )
  assert.ok(
    result.diagnostics.every(
      (d) => d.code === 7056 && independentSources.has(d.source),
    ),
  )
})

test('actual installed tarball retains strict cascader controls and isolates remaining package failures', () => {
  const candidate = process.env.FSUS_CASCADER_CANDIDATE
  assert.ok(
    candidate && existsSync(candidate),
    'Build the real candidate, then set FSUS_CASCADER_CANDIDATE to its tarball',
  )
  const baseline = process.env.FSUS_CASCADER_BASELINE_CANDIDATE
  assert.ok(
    baseline && existsSync(baseline),
    'Set FSUS_CASCADER_BASELINE_CANDIDATE to the real original-source tarball',
  )
  const runtimeFiles = (tarball) =>
    execFileSync('tar', ['-tzf', tarball], { encoding: 'utf8' })
      .split('\n')
      .filter((file) =>
        /^package\/(es|lib)\/components\/cascader\/.*\.(js|mjs)$/.test(file),
      )
      .sort()
  const beforeFiles = runtimeFiles(baseline)
  assert.ok(beforeFiles.length > 0)
  assert.deepEqual(runtimeFiles(candidate), beforeFiles)
  for (const file of beforeFiles) {
    assert.deepEqual(
      execFileSync('tar', ['-xOf', candidate, file]),
      execFileSync('tar', ['-xOf', baseline, file]),
      `${file} runtime changed`,
    )
  }
  const consumer = mkdtempSync(path.join(evidence, 'consumer-'))
  for (const name of ['positive', 'negative', 'aggregate', 'library'])
    cpSync(path.join(fixture, `${name}.ts`), path.join(consumer, `${name}.ts`))
  writeFileSync(
    path.join(consumer, 'package.json'),
    `${JSON.stringify(
      {
        private: true,
        type: 'module',
        packageManager: 'pnpm@10.33.0',
        dependencies: {
          vue: '3.5.32',
          typescript: '6.0.2',
          '@ozwasyd/element-plus': `file:${path.resolve(candidate)}`,
        },
        pnpm: {
          overrides: { '@vue/compiler-dom': '3.5.32', '@vue/shared': '3.5.32' },
        },
      },
      null,
      2,
    )}\n`,
  )
  assert.equal(run('pnpm', ['--version'], 'pnpm-version').trim(), '10.33.0')
  run(
    'pnpm',
    [
      'install',
      '--ignore-scripts',
      '--store-dir',
      process.env.FSUS_CASCADER_STORE || path.join(evidence, 'store'),
    ],
    'installed',
    consumer,
  )
  run(
    process.execPath,
    [path.join(fixture, 'installed.mjs'), consumer],
    'installed-diagnostics',
  )
  const results = JSON.parse(
    readFileSync(path.join(consumer, 'diagnostics.json'), 'utf8'),
  )
  assert.equal(results.typescript, '6.0.2')
  assert.equal(results.vue, '3.5.32')
  const remainingBarrels = (diagnostics) => {
    assert.ok(diagnostics.length <= 3)
    assert.ok(
      diagnostics.every(
        (d) => d.code === 2307 && d.file.endsWith('/es/components/index.d.ts'),
      ),
    )
    const allowed = ['select', 'slider', 'time-select'].map(
      (name) =>
        `Cannot find module './${name}' or its corresponding type declarations.`,
    )
    assert.ok(diagnostics.every((d) => allowed.includes(d.message)))
    assert.equal(
      new Set(diagnostics.map((d) => d.message)).size,
      diagnostics.length,
    )
  }
  remainingBarrels(results.positive)
  const requireConsumer = createRequire(path.join(consumer, 'package.json'))
  const ts = requireConsumer('typescript')
  const negative = readFileSync(path.join(consumer, 'negative.ts'), 'utf8')
  const source = ts.createSourceFile(
    'negative.ts',
    negative,
    ts.ScriptTarget.ES2022,
    true,
  )
  const cases = source.statements
    .filter((statement) => {
      const endOfLine = negative.indexOf('\n', statement.end)
      return negative
        .slice(statement.end, endOfLine < 0 ? undefined : endOfLine)
        .includes('// invalid')
    })
    .map((statement) => ({
      first:
        source.getLineAndCharacterOfPosition(statement.getStart(source)).line +
        1,
      last: source.getLineAndCharacterOfPosition(statement.end).line + 1,
    }))
  assert.equal(cases.length, 20)
  const rejected = results.negative.filter((d) => d.file === 'negative.ts')
  remainingBarrels(results.negative.filter((d) => d.file !== 'negative.ts'))
  assert.equal(rejected.length, cases.length)
  for (const invalid of cases) {
    assert.equal(
      rejected.filter((d) => d.line >= invalid.first && d.line <= invalid.last)
        .length,
      1,
    )
  }
  const packageRoot = path.dirname(
    path.dirname(requireConsumer.resolve('@ozwasyd/element-plus')),
  )
  for (const module of ['es', 'lib']) {
    for (const file of ['index.d.ts', 'src/cascader.vue.d.ts'])
      assert.ok(
        existsSync(path.join(packageRoot, module, 'components/cascader', file)),
      )
  }
  // Independent select/slider/time-select repairs belong to the final combination.
  const remainingPackageErrors = (diagnostics) => {
    assert.ok(diagnostics.length <= 8)
    for (const diagnostic of diagnostics) {
      const missingBarrel =
        diagnostic.code === 2307 &&
        diagnostic.file.endsWith('/es/components/index.d.ts') &&
        ['select', 'slider', 'time-select'].some(
          (name) =>
            diagnostic.message ===
            `Cannot find module './${name}' or its corresponding type declarations.`,
        )
      const missingGlobal =
        diagnostic.code === 2339 &&
        diagnostic.file.endsWith('/global.d.ts') &&
        [
          'ElOption',
          'ElOptionGroup',
          'ElSelect',
          'ElSlider',
          'ElTimeSelect',
        ].some((name) =>
          diagnostic.message.startsWith(
            `Property '${name}' does not exist on type`,
          ),
        )
      assert.ok(missingBarrel || missingGlobal, JSON.stringify(diagnostic))
    }
  }
  remainingPackageErrors(results.aggregate)
  remainingPackageErrors(results.library)
  writeFileSync(
    path.join(evidence, 'installed-summary.json'),
    `${JSON.stringify(
      {
        positiveStrict: results.positive.length ? 'FAIL' : 'PASS',
        positiveContract: 'PASS',
        positiveDiagnostics: results.positive,
        negativeContract: 'PASS',
        negativeControls: cases.length,
        packedRuntimeParity: 'PASS',
        runtimeFiles: beforeFiles,
        aggregateStrict: results.aggregate.length ? 'FAIL' : 'PASS',
        remainingDiagnostics: results.aggregate,
        consumer,
        tarball: path.resolve(candidate),
      },
      null,
      2,
    )}\n`,
  )
})
