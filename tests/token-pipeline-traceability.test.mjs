import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { findStableAdapterLiteralViolations } from '../scripts/token-pipeline.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const readJson = (relativePath) =>
  JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'))

test('every generated token carries complete source-to-consumer traceability', () => {
  const generated = readJson(
    'vue/packages/theme-chalk/src/generated/tokens.json',
  )

  for (const [name, token] of Object.entries(generated.tokens)) {
    assert.equal(token.traceability.canonicalName, name)
    assert.ok(token.traceability.runtimeAliases.includes(token.css))
    assert.ok(token.traceability.values.light)
    assert.ok(token.traceability.values.dark)
    assert.ok(token.traceability.usageSurface)
    assert.ok(token.traceability.owner)
    assert.equal(typeof token.traceability.consumerUse, 'boolean')
    assert.ok(token.traceability.generatedOutputs.length > 0)
    assert.ok(token.traceability.documentation)
    assert.ok(token.traceability.fixture)
    assert.equal(token.traceability.status, 'active')
    assert.equal(token.traceability.migrationStatus, 'none')
  }
})

test('stable adapter tokens reject unregistered visual literals', () => {
  const unregistered = [
    '--fsus-color-rogue: #123456;',
    '--fsus-radius-rogue: 8px;',
    '--fsus-space-rogue: 28px;',
    '--fsus-backdrop-rogue: 12px;',
    '--fsus-shadow-rogue: 0 2px 4px #000;',
    '--fsus-motion-rogue: 180ms;',
  ].join('\n')
  assert.equal(findStableAdapterLiteralViolations(unregistered).length, 6)
  assert.deepEqual(
    findStableAdapterLiteralViolations(
      '--fsus-space-5: 20px;\n--fsus-state-hover-bg: #2A599C0E;',
      'fixture.scss',
    ),
    [
      'fixture.scss:1 --fsus-space-5 must reference a generated canonical token, got 20px',
      'fixture.scss:2 --fsus-state-hover-bg must reference a generated canonical token, got #2A599C0E',
    ],
  )
  assert.deepEqual(
    findStableAdapterLiteralViolations(
      '--fsus-space-5: #{generated.$fsus-space-5};\n--fsus-state-hover-bg: var(--fsus-component-state-surface-hover-background);',
    ),
    [],
  )
})
