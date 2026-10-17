import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath, URL } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const fixture = path.join(
  root,
  'tests/fixtures/motion-transition-prop-determinism/observe.mjs',
)
const sourcePath = 'vue/packages/motion/components/FsuTransition.vue'
const baselineSha = 'f4a094f300384185918fc6d4be86e88d9ab9f097'
const original = execFileSync('git', ['show', `${baselineSha}:${sourcePath}`], {
  cwd: root,
  encoding: 'utf8',
})
const originalHash = createHash('sha256').update(original).digest('hex')
const observe = (context) => {
  const result = JSON.parse(
    execFileSync(process.execPath, [fixture, root, context], {
      cwd: root,
      encoding: 'utf8',
      timeout: 30_000,
      maxBuffer: 4 * 1024 * 1024,
    }),
  )
  assert.equal(result.sourceSha256, originalHash)
  assert.equal(result.rows.length, 3)
  assert.deepEqual(
    result.rows.map((row) => row.production),
    [false, true, false],
  )
  return result
}

test('reproduction preserves the actual published component source', () => {
  assert.equal(readFileSync(path.join(root, sourcePath), 'utf8'), original)
})

test('matched repeated transforms remain equal inside each isolated context', () => {
  for (const context of [
    'cold',
    'serial-namespaces',
    'concurrent-namespaces',
  ]) {
    const first = observe(context)
    const second = observe(context)
    assert.deepEqual(first.rows, second.rows, context)
    assert.equal(first.rows[0].code, first.rows[2].code, context)
  }
})

test('production transforms match across loading contexts', () => {
  const cold = observe('cold')
  for (const context of [
    'serial-namespaces',
    'concurrent-namespaces',
    'concurrent-components',
  ]) {
    const warm = observe(context)
    assert.equal(warm.rows[1].code, cold.rows[1].code, context)
  }
  assert.notEqual(cold.rows[0].code, cold.rows[1].code)
})

test('development mode metadata is independent of declaration loading order', () => {
  const serial = observe('serial-namespaces')
  const concurrent = observe('concurrent-namespaces')
  assert.equal(serial.namespace.coreExportsBaseTransitionProps, true)
  assert.equal(concurrent.namespace.coreExportsBaseTransitionProps, true)
  // Do not select either historical metadata shape as the desired fix.
  assert.equal(concurrent.rows[0].modeLine, serial.rows[0].modeLine)
  assert.equal(concurrent.rows[0].code, serial.rows[0].code)
})

test('awaiting namespace resolution waits for exported TransitionProps', () => {
  const { namespace } = observe('namespace-readiness')
  assert.equal(namespace.completedHasTransitionProps, true)
  assert.equal(namespace.secondCallHasTransitionProps, true)
})
