import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { URL } from 'node:url'
import vm from 'node:vm'
import test from 'node:test'
import ts from 'typescript'

const createPhaseObserver = async () => {
  const source = await readFile(
    new URL(
      '../vue/packages/demo-app/src/PerformanceFixture.vue',
      import.meta.url,
    ),
    'utf8',
  )
  const script = source
    .split('<script setup lang="ts">')[1]
    .split('</script>')[0]
  const parsed = ts.createSourceFile(
    'fixture.ts',
    script,
    ts.ScriptTarget.Latest,
  )
  const names = new Set([
    'latestWasmRenderMs',
    'initialWasmProfile',
    'captureWasmProfile',
    'markdownPhaseProbe',
  ])
  const declarations = parsed.statements.filter(
    (node) =>
      ts.isVariableStatement(node) &&
      node.declarationList.declarations.some((item) =>
        names.has(item.name.getText(parsed)),
      ),
  )
  const code = ts.transpileModule(
    declarations.map((node) => node.getText(parsed)).join('\n'),
    { compilerOptions: { target: ts.ScriptTarget.ESNext } },
  ).outputText
  const context = {
    props: { scenario: 'markdown-feature-activation' },
    completedMarkdownActivationRevision: { value: 3 },
    getFsusRenderPipelineDiagnosticsSnapshot: () => [
      {
        adapterId: 'markdown-renderer',
        stage: 'worker-compute',
        durationMs: 7,
      },
    ],
    document: { querySelector: () => null },
  }
  return vm.runInNewContext(
    `${code}\n({ captureWasmProfile, markdownPhaseProbe, initial: () => initialWasmProfile })`,
    context,
  )
}

test('phase evidence follows later profiles while preserving the original startup profile', async () => {
  const observer = await createPhaseObserver()
  observer.captureWasmProfile({
    engine: 'wasm-simd',
    timings: { initMs: 12, totalMs: 17 },
  })
  assert.equal(observer.markdownPhaseProbe().parseMs, 17)
  observer.captureWasmProfile({
    engine: 'wasm-simd',
    timings: { initMs: 0, totalMs: 0.75 },
  })
  assert.equal(observer.markdownPhaseProbe().parseMs, 0.75)
  observer.captureWasmProfile({
    engine: 'wasm-simd',
    timings: { initMs: 0, totalMs: 2.5 },
  })
  assert.equal(observer.markdownPhaseProbe().parseMs, 2.5)
  assert.deepEqual(JSON.parse(JSON.stringify(observer.initial())), {
    startupMs: 12,
    computeMs: 5,
    endToEndMs: 17,
    engine: 'wasm-simd',
  })
})

test('phase evidence retains the diagnostic fallback and a measured zero', async () => {
  const observer = await createPhaseObserver()
  assert.equal(observer.markdownPhaseProbe().parseMs, 7)
  observer.captureWasmProfile({
    engine: 'wasm-simd',
    timings: { initMs: 0, totalMs: 0 },
  })
  assert.equal(observer.markdownPhaseProbe().parseMs, 0)
})
