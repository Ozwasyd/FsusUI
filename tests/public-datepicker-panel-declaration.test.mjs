import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import {
  mkdtempSync,
  readFileSync,
  realpathSync,
  copyFileSync,
  writeFileSync,
} from 'node:fs'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import {
  authority,
  readArtifactAuthority,
  readSourceAuthority,
} from './fixtures/public-datepicker-panel-declaration/authority.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const fixture = path.join(
  root,
  'tests/fixtures/public-datepicker-panel-declaration',
)
const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'))

test('canonical producer preserves the inferred panel contract and emits named types', () => {
  const sourceAuthority = readSourceAuthority(root)
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
  assert.deepEqual(result.sourceAuthority, sourceAuthority)
  assert.equal(result.canonicalProducerError, null)
  assert.equal(result.originalDiagnosticReturnUnchanged, true)
  assert.equal(result.inferredParameterAndReturnParity, 'PASS')
  assert.equal(result.intentionalContractMutationsRejected, 2)
  assert.deepEqual(result.diagnostics, sourceAuthority.producerDiagnostics)
})

test('actual installed tarball accepts the exact panel contract and rejects invalid calls', () => {
  const sourceAuthority = readSourceAuthority(root)
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
  const requireRoot = createRequire(path.join(root, 'package.json'))
  const producerTs = requireRoot('ts-morph').ts
  const original = execFileSync(
    'git',
    [
      'show',
      '2d05f240e5fb04ac0cd602b4ed638ffe00b1859b:vue/packages/components/date-picker/src/panel-utils.ts',
    ],
    { cwd: root, encoding: 'utf8' },
  )
  const originalJs = producerTs.transpileModule(original, {
    compilerOptions: {
      target: producerTs.ScriptTarget.ES2022,
      module: producerTs.ModuleKind.ESNext,
    },
  }).outputText
  const packageRoot = path.join(consumer, 'node_modules/@ozwasyd/element-plus')
  const artifactAuthority = readArtifactAuthority(root, consumer, packageRoot)
  const installedRoot = realpathSync(packageRoot)
  const packedJs = readFileSync(
    path.join(packageRoot, 'es/components/date-picker/src/panel-utils.mjs'),
    'utf8',
  )
  const printSelector = (text) => {
    const file = producerTs.createSourceFile(
      'panel-utils.js',
      text,
      producerTs.ScriptTarget.Latest,
      true,
      producerTs.ScriptKind.JS,
    )
    const roles = new Map()
    const panels = {
      'panel-date-pick': 'DatePickPanel',
      'panel-date-range': 'DateRangePickPanel',
      'panel-month-range': 'MonthRangePickPanel',
    }
    for (const node of file.statements) {
      if (!producerTs.isImportDeclaration(node) || !node.importClause?.name)
        continue
      const match = node.moduleSpecifier.text.match(
        /\/(panel-date-pick|panel-date-range|panel-month-range)\.vue(?:2?\.mjs)?$/,
      )
      if (match) roles.set(node.importClause.name.text, panels[match[1]])
    }
    assert.equal(roles.size, 3, 'retain the three original panel imports')
    assert.equal(
      new Set(roles.values()).size,
      3,
      'retain each distinct panel owner',
    )
    const statement = file.statements.find(
      (node) =>
        producerTs.isVariableStatement(node) &&
        node.declarationList.declarations.some(
          (declaration) => declaration.name.getText(file) === 'getPanel',
        ),
    )
    assert.ok(statement, 'actual runtime selector must be present')
    const selector = statement.declarationList.declarations.find(
      (declaration) => declaration.name.getText(file) === 'getPanel',
    ).initializer
    const normalized = producerTs.transform(selector, [
      (context) => {
        const visit = (node) => {
          if (producerTs.isStringLiteral(node))
            return producerTs.factory.createStringLiteral(node.text)
          if (producerTs.isIdentifier(node) && roles.has(node.text)) {
            return producerTs.factory.createIdentifier(roles.get(node.text))
          }
          return producerTs.visitEachChild(node, visit, context)
        }
        return (node) => producerTs.visitNode(node, visit)
      },
    ])
    try {
      return producerTs
        .createPrinter({ removeComments: true })
        .printNode(
          producerTs.EmitHint.Expression,
          normalized.transformed[0],
          file,
        )
    } finally {
      normalized.dispose()
    }
  }
  assert.equal(
    printSelector(packedJs),
    printSelector(originalJs),
    'actual packed runtime selector must match the original emitted JS',
  )
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
      .map((diagnostic) => {
        const packageFile =
          diagnostic.file &&
          path.relative(installedRoot, diagnostic.file.fileName)
        return {
          code: diagnostic.code,
          file:
            diagnostic.file &&
            (packageFile.startsWith('..')
              ? path.relative(consumer, diagnostic.file.fileName)
              : `package/${packageFile}`),
          line:
            diagnostic.file && diagnostic.start !== undefined
              ? diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start)
                  .line + 1
              : undefined,
          message: ts.flattenDiagnosticMessageText(
            diagnostic.messageText,
            '\n',
          ),
        }
      })
  const positive = diagnostics('positive.ts')
  const negative = diagnostics('negative.ts')
  const libraryRow = ({ code, file, message }) => ({ code, file, message })
  assert.deepEqual(
    positive.map(libraryRow),
    artifactAuthority.libraryDiagnostics,
  )
  assert.deepEqual(
    negative.map((diagnostic) =>
      diagnostic.file === 'datepicker-panel-negative.ts'
        ? {
            code: diagnostic.code,
            file: diagnostic.file,
            line: diagnostic.line,
          }
        : libraryRow(diagnostic),
    ),
    [
      ...authority.negativeTargets.map((target) => ({
        code: target.code,
        file: 'datepicker-panel-negative.ts',
        line: target.line,
      })),
      ...artifactAuthority.libraryDiagnostics,
    ],
  )
  const result = {
    sourceAuthority,
    artifactAuthority,
    strict: true,
    skipLibCheck: false,
    diagnosticExpectationControl: 'PASS',
    strictPositiveResult: positive.length === 0 ? 'PASS' : 'FAIL',
    actualPackedRuntimeSelectorParity: 'PASS',
    positive,
    negative,
  }
  writeFileSync(
    path.join(consumer, 'datepicker-panel-controls.json'),
    `${JSON.stringify(result, null, 2)}\n`,
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
