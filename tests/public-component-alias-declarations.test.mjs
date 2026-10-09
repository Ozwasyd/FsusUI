// Run with the original repository tools after installing the real candidates:
// FSUS_ALIAS_BASELINE_CONSUMER=... FSUS_ALIAS_FINAL_CONSUMER=...
// node --test tests/public-component-alias-declarations.test.mjs
import assert from 'node:assert/strict'
import { spawnSync, execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import {
  readFileSync,
  writeFileSync,
  copyFileSync,
  rmSync,
  mkdtempSync,
} from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import ts from 'typescript'

const repository = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
)
const fixture = path.join(
  repository,
  'tests/fixtures/public-component-alias-declarations',
)
const load = (name) =>
  JSON.parse(readFileSync(path.join(fixture, name), 'utf8'))
const groups = load('components.json')
const selectors = load('source-tests.json')
const baseline = load('baseline-diagnostics.json')
const contracts = readFileSync(path.join(fixture, 'contracts.ts'), 'utf8')
const negatives = contracts.match(/@ts-expect-error/g) ?? []
const sourceConfig = load('tsconfig.source.json')
const installedConfig = load('tsconfig.installed.json')
const temporary = mkdtempSync(
  path.join(os.tmpdir(), 'fsusui-alias-regression-'),
)

// Parse/count failures stop before execution; no empty positive selectors.
assert.deepEqual(
  Object.values(groups).map((names) => names.length),
  [11, 11, 14],
)
assert.equal(new Set(Object.values(groups).flat()).size, 36)
assert.equal(selectors.length, 18)
assert.ok(selectors.every((selector) => selector.name && selector.file))
assert.equal(negatives.length, 9)
assert.equal(
  ts.createSourceFile('contracts.ts', contracts, ts.ScriptTarget.Latest, true)
    .parseDiagnostics.length,
  0,
)
assert.equal(installedConfig.compilerOptions.strict, true)
assert.equal(installedConfig.compilerOptions.skipLibCheck, false)

function run(args, cwd = repository) {
  const result = spawnSync(process.execPath, args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  })
  assert.ifError(result.error)
  assert.equal(result.signal, null)
  return result
}

function diagnostics(result) {
  assert.ok([0, 2].includes(result.status), result.stderr)
  const found = [
    ...result.stdout.matchAll(/^(.*?)\((\d+),(\d+)\): error (TS\d+): (.*)$/gm),
  ]
  const errors = found.map(([, file, line, column, code, message]) => ({
    file: file.includes('/node_modules/@ozwasyd/element-plus/')
      ? file.split('/node_modules/@ozwasyd/element-plus/').at(-1)
      : file,
    line,
    column,
    code,
    message: message.replace(
      /typeof import\("[^"\n]*\/node_modules\/@ozwasyd\/element-plus\//g,
      'typeof import("@ozwasyd/element-plus/',
    ),
  }))
  assert.equal(result.status === 0, errors.length === 0, result.stdout)
  assert.ok(!result.stderr.trim(), result.stderr)
  return errors
}

function counts(errors) {
  const byCode = {},
    byFile = {}
  for (const error of errors) {
    byCode[error.code] = (byCode[error.code] ?? 0) + 1
    byFile[error.file] = (byFile[error.file] ?? 0) + 1
  }
  return { total: errors.length, byCode, byFile }
}

function consumer(name) {
  const directory = process.env[name]
  assert.ok(
    directory,
    `${name} must point to a real installed candidate consumer`,
  )
  const require = createRequire(path.join(directory, 'package.json'))
  assert.equal(require('typescript/package.json').version, '6.0.2')
  assert.equal(require('vue/package.json').version, '3.5.32')
  const installedPackage = JSON.parse(
    readFileSync(
      path.join(directory, 'node_modules/@ozwasyd/element-plus/package.json'),
      'utf8',
    ),
  )
  assert.equal(installedPackage.name, '@ozwasyd/element-plus')
  assert.equal(installedPackage.version, '1.5.1')
  return { directory, compiler: require.resolve('typescript/bin/tsc') }
}

test('all three source indexes emit identical JavaScript to the producer prerequisite', () => {
  for (const group of Object.keys(groups)) {
    const name = `vue/packages/components/${group}/index.ts`
    const before = execFileSync(
      'git',
      ['show', `48ac5c2029a231e574a77a4aa537907f5bd447da:${name}`],
      { cwd: repository, encoding: 'utf8' },
    )
    const compile = (text) =>
      ts.transpileModule(text, {
        compilerOptions: {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.ESNext,
        },
      }).outputText
    assert.equal(
      compile(readFileSync(path.join(repository, name), 'utf8')),
      compile(before),
    )
  }
})

test('original Vue compiler accepts every source contract and rejects nine negative controls', () => {
  const require = createRequire(path.join(repository, 'package.json'))
  const compiler = require.resolve('vue-tsc/bin/vue-tsc.js')
  const positive = run([
    compiler,
    '--noEmit',
    '--pretty',
    'false',
    '-p',
    path.join(fixture, 'tsconfig.source.json'),
  ])
  assert.deepEqual(diagnostics(positive), [])
  const name = `.negative-${process.pid}`
  const file = path.join(fixture, name + '.ts')
  const config = path.join(fixture, name + '.json')
  try {
    writeFileSync(file, contracts.replace(/^.*@ts-expect-error.*$/gm, ''))
    writeFileSync(
      config,
      JSON.stringify({
        extends: './tsconfig.source.json',
        include: [name + '.ts', ...sourceConfig.include.slice(1)],
      }),
    )
    const negative = diagnostics(
      run([compiler, '--noEmit', '--pretty', 'false', '-p', config]),
    )
    assert.equal(negative.length, 9)
    assert.ok(negative.every((error) => error.file.endsWith(name + '.ts')))
  } finally {
    rmSync(file, { force: true })
    rmSync(config, { force: true })
  }
})

test('exact 18 source runtime cases pass through the original Vitest configuration and setup', () => {
  const require = createRequire(path.join(repository, 'package.json'))
  const vitest = path.join(
    path.dirname(require.resolve('vitest/package.json')),
    'vitest.mjs',
  )
  const files = [...new Set(selectors.map((selector) => selector.file))]
  assert.equal(files.length, 3)
  const listed = path.join(temporary, 'listed.json')
  const preflight = run([
    vitest,
    'list',
    ...files,
    '--config',
    'vue/vitest.config.ts',
    '--json=' + listed,
  ])
  assert.equal(preflight.status, 0, preflight.stdout + preflight.stderr)
  const actual = JSON.parse(readFileSync(listed, 'utf8'))
  assert.deepEqual(
    actual.map((item) => item.name).sort(),
    selectors.map((item) => item.name).sort(),
  )
  const escape = (name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern =
    '^(?:' +
    selectors
      .map((item) => escape(item.name.replaceAll(' > ', ' ')))
      .join('|') +
    ')$'
  const output = path.join(temporary, 'source-results.json')
  const result = run([
    path.join(repository, 'scripts/with-node-heap.mjs'),
    process.execPath,
    vitest,
    'run',
    ...files,
    '--config',
    'vue/vitest.config.ts',
    '--testNamePattern',
    pattern,
    '--reporter=json',
    '--outputFile=' + output,
  ])
  assert.equal(result.status, 0, result.stdout + result.stderr)
  const report = JSON.parse(readFileSync(output, 'utf8'))
  assert.equal(report.numTotalTests, 18)
  assert.equal(report.numPassedTests, 18)
  assert.equal(report.numFailedTests, 0)
  assert.equal(report.numPendingTests, 0)
})

test('strict installed package removes all 144 owned constraints with no added diagnostics', () => {
  const before = consumer('FSUS_ALIAS_BASELINE_CONSUMER')
  const after = consumer('FSUS_ALIAS_FINAL_CONSUMER')
  const beforeErrors = diagnostics(
    run(
      [
        before.compiler,
        '--noEmit',
        '--pretty',
        'false',
        '-p',
        'tsconfig.all.json',
      ],
      before.directory,
    ),
  )
  const afterErrors = diagnostics(
    run(
      [
        after.compiler,
        '--noEmit',
        '--pretty',
        'false',
        '-p',
        'tsconfig.all.json',
      ],
      after.directory,
    ),
  )
  const owned = (error) =>
    error.code === 'TS2344' &&
    Object.keys(groups).some(
      (group) => error.file === `es/components/${group}/index.d.ts`,
    )
  assert.equal(
    Object.values(baseline.aliasConstraints).reduce(
      (sum, count) => sum + count,
      0,
    ),
    144,
  )
  assert.deepEqual(
    counts(beforeErrors),
    load('rebuilt-baseline-diagnostics.json').summary,
  )
  assert.equal(beforeErrors.filter(owned).length, 144)
  assert.equal(afterErrors.filter(owned).length, 0)
  const key = (error) => [error.file, error.code, error.message].join(':')
  const remaining = new Map()
  for (const error of beforeErrors)
    remaining.set(key(error), (remaining.get(key(error)) ?? 0) + 1)
  for (const error of afterErrors) {
    assert.ok(remaining.get(key(error)) > 0, 'Added diagnostic: ' + key(error))
    remaining.set(key(error), remaining.get(key(error)) - 1)
  }
  assert.deepEqual(
    counts(afterErrors),
    load('residual-diagnostics.json').summary,
  )
  assert.deepEqual(afterErrors, load('residual-diagnostics.json').diagnostics)
})

test('real installed alias contracts add no errors and reject every unsuppressed negative control', () => {
  const installed = consumer('FSUS_ALIAS_FINAL_CONSUMER')
  const compilerArgs = [
    installed.compiler,
    '--noEmit',
    '--pretty',
    'false',
    '-p',
  ]
  const baselineErrors = diagnostics(
    run([...compilerArgs, 'tsconfig.all.json'], installed.directory),
  )
  const file = path.join(installed.directory, 'contracts.ts')
  const config = path.join(installed.directory, 'tsconfig.alias-contracts.json')
  const negativeFile = path.join(installed.directory, 'negative-contracts.ts')
  const negativeConfig = path.join(
    installed.directory,
    'tsconfig.alias-negatives.json',
  )
  try {
    copyFileSync(path.join(fixture, 'contracts.ts'), file)
    writeFileSync(config, JSON.stringify(installedConfig))
    const positive = diagnostics(
      run([...compilerArgs, config], installed.directory),
    )
    assert.deepEqual(positive, baselineErrors)
    writeFileSync(
      negativeFile,
      contracts.replace(/^.*@ts-expect-error.*$/gm, ''),
    )
    writeFileSync(
      negativeConfig,
      JSON.stringify({
        ...installedConfig,
        include: ['negative-contracts.ts'],
      }),
    )
    const negative = diagnostics(
      run([...compilerArgs, negativeConfig], installed.directory),
    )
    const fixtureErrors = negative.filter(
      (error) => error.file === 'negative-contracts.ts',
    )
    assert.equal(fixtureErrors.length, 9)
    assert.deepEqual(
      negative.filter((error) => error.file !== 'negative-contracts.ts'),
      baselineErrors,
    )
  } finally {
    for (const item of [file, config, negativeFile, negativeConfig])
      rmSync(item, { force: true })
  }
})

test('packed ESM/CJS names, identity, installers, extras, props, events, slots and mounted instances survive', () => {
  const installed = consumer('FSUS_ALIAS_FINAL_CONSUMER')
  const file = path.join(installed.directory, 'runtime.mjs')
  const names = path.join(installed.directory, 'components.json')
  try {
    copyFileSync(path.join(fixture, 'runtime.mjs'), file)
    copyFileSync(path.join(fixture, 'components.json'), names)
    const result = spawnSync(process.execPath, [file], {
      cwd: installed.directory,
      encoding: 'utf8',
      env: { ...process.env, FSUS_ALIAS_REPOSITORY: repository },
    })
    assert.ifError(result.error)
    assert.equal(result.status, 0, result.stdout + result.stderr)
    assert.deepEqual(JSON.parse(result.stdout.trim()), {
      aliases: 72,
      mountedControls: 4,
      passed: true,
    })
  } finally {
    rmSync(file, { force: true })
    rmSync(names, { force: true })
  }
})

test.after(() => rmSync(temporary, { recursive: true, force: true }))
