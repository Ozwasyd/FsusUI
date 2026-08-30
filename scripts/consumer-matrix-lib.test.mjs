import assert from 'node:assert/strict'
import test from 'node:test'

import {
  classifyConsumerMatrixImpact,
  consumerProfileSchema,
  consumerProfiles,
  createMatrixSummary,
  digestJson,
  projectConsumerPackage,
  resolveConsumerProfile,
  validateConsumerBuildEvidence,
  validateMatrixReceiptDigests,
  validateProfileReceipt,
} from './consumer-matrix-lib.mjs'

const authority = {
  install: {
    '@vitejs/plugin-vue': '6.0.5',
    typescript: '6.0.2',
    vite: '7.3.1',
    'vue-tsc': '3.2.6',
  },
  consumerProfiles: {
    'npm-latest': { packages: { vue: '3.5.32' } },
    'pnpm-latest': { packages: { vue: '3.5.32' } },
    'npm-peer-floor': { packages: { vue: '3.5.0' } },
  },
}
const candidatePackage = {
  name: '@ozwasyd/element-plus',
  peerDependencies: { vue: '^3.5.0' },
  version: '1.5.1',
}
const digest = 'a'.repeat(64)

function receipt(profile) {
  return {
    schema: consumerProfileSchema,
    profile,
    candidate: {
      name: candidatePackage.name,
      version: candidatePackage.version,
      sha256: digest,
    },
    packageManager: {
      name: profile === 'pnpm-latest' ? 'pnpm' : 'npm',
      version: '10.33.0',
    },
    toolchain: {
      node: '22.14.0',
      vue: profile === 'npm-peer-floor' ? '3.5.0' : '3.5.32',
      vite: '7.3.1',
      typescript: '6.0.2',
      vueTsc: '3.2.6',
    },
    statuses: Object.fromEntries(
      [
        'install',
        'typecheck',
        'build',
        'ssr',
        'exports',
        'worker',
        'wasm',
        'bundle',
      ].map((stage) => [stage, 'passed']),
    ),
    durationsMs: Object.fromEntries(
      [
        'install',
        'typecheck',
        'build',
        'ssr',
        'exports',
        'worker',
        'wasm',
        'bundle',
      ].map((stage) => [stage, 1]),
    ),
    budgets: Object.fromEntries(
      ['startup', 'markdownHydration'].map((graph) => [
        graph,
        {
          actual: { raw: 1, gzip: 1, brotli: 1 },
          limit: { raw: 2, gzip: 2, brotli: 2 },
        },
      ]),
    ),
    artifacts: {
      workerFiles: ['assets/worker.mjs'],
      wasmFiles: ['assets/runtime.wasm'],
    },
    digests: { authority: digest, profile: digest, config: digest },
    fixturePath: null,
  }
}

test('derives manager and peer floor without widening', () => {
  assert.equal(
    resolveConsumerProfile({
      authority,
      candidatePackage,
      name: 'npm-peer-floor',
    }).peerFloor,
    '3.5.0',
  )
  assert.equal(
    resolveConsumerProfile({ authority, candidatePackage, name: 'pnpm-latest' })
      .manager,
    'pnpm',
  )
  assert.throws(
    () =>
      resolveConsumerProfile({
        authority: {
          ...authority,
          consumerProfiles: {
            ...authority.consumerProfiles,
            'npm-peer-floor': { packages: { vue: '3.4.0' } },
          },
        },
        candidatePackage,
        name: 'npm-peer-floor',
      }),
    /does not equal candidate peer floor/,
  )
})

test('projects versions only from authority and uses the real manager', () => {
  const profile = resolveConsumerProfile({
    authority,
    candidatePackage,
    name: 'npm-latest',
  })
  const projected = projectConsumerPackage({
    candidatePath: '/tmp/fsusui.tgz',
    candidatePackage,
    profile,
    templatePackage: { name: 'fixture', pnpm: { overrides: {} } },
  })
  assert.deepEqual(projected.devDependencies, {
    '@vitejs/plugin-vue': authority.install['@vitejs/plugin-vue'],
    typescript: authority.install.typescript,
    vite: authority.install.vite,
    'vue-tsc': authority.install['vue-tsc'],
  })
  assert.equal(projected.dependencies.vue, '3.5.32')
  assert.equal(projected.packageManager, undefined)
})

test('kills implicit default and npm to pnpm substitution', () => {
  assert.throws(
    () =>
      resolveConsumerProfile({ authority, candidatePackage, name: 'default' }),
    /implicit defaults are forbidden/,
  )
  const mutant = receipt('npm-latest')
  mutant.packageManager.name = 'pnpm'
  assert.throws(() => validateProfileReceipt(mutant), /must use npm/)
})

test('matrix rejects skipped, failed, duplicate, mutated, and incomplete receipts', () => {
  const validResults = consumerProfiles.map((profile) => ({
    profile,
    status: 'passed',
    receipt: receipt(profile),
  }))
  const summary = createMatrixSummary({
    authorityDigest: digest,
    candidate: {
      name: candidatePackage.name,
      version: '1.5.1',
      sha256: digest,
    },
    configDigest: digest,
    results: validResults,
  })
  assert.equal(summary.profiles.length, 3)

  assert.throws(
    () =>
      createMatrixSummary({
        authorityDigest: digest,
        candidate: summary.candidate,
        configDigest: digest,
        results: validResults.slice(0, 2),
      }),
    /skipped profile/,
  )
  assert.throws(
    () =>
      createMatrixSummary({
        authorityDigest: digest,
        candidate: summary.candidate,
        configDigest: digest,
        results: validResults.map((result, index) =>
          index === 0 ? { ...result, status: 'failed' } : result,
        ),
      }),
    /profile npm-latest failed/,
  )
  const digestMutant = structuredClone(validResults)
  digestMutant[1].receipt.candidate.sha256 = 'b'.repeat(64)
  assert.throws(
    () =>
      createMatrixSummary({
        authorityDigest: digest,
        candidate: summary.candidate,
        configDigest: digest,
        results: digestMutant,
      }),
    /candidate digest mismatch/,
  )
  const schemaMutant = receipt('npm-latest')
  delete schemaMutant.toolchain.vueTsc
  assert.throws(
    () => validateProfileReceipt(schemaMutant),
    /toolchain.vueTsc is required/,
  )
})

test('receipt tampering changes its canonical digest', () => {
  const original = receipt('npm-latest')
  const mutant = structuredClone(original)
  mutant.statuses.worker = 'failed'
  assert.notEqual(digestJson(original), digestJson(mutant))
  assert.throws(
    () =>
      validateMatrixReceiptDigests(
        {
          profiles: consumerProfiles.map((profile) => ({
            profile,
            receiptDigest: digestJson(receipt(profile)),
          })),
        },
        Object.fromEntries(
          consumerProfiles.map((profile) => [
            profile,
            profile === 'npm-latest' ? mutant : receipt(profile),
          ]),
        ),
      ),
    /was tampered/,
  )
})

test('impact plan emits auditable docs skip and conservative runtime run', () => {
  const skip = classifyConsumerMatrixImpact(['docs/components/button.md'])
  assert.equal(skip.action, 'skip')
  assert.match(skip.reason, /no-package-impact/)
  assert.match(skip.digest, /^[a-f0-9]{64}$/u)

  assert.equal(
    classifyConsumerMatrixImpact([
      'vue/packages/components/button/src/button.ts',
    ]).action,
    'run',
  )
})

test('kills worker, Wasm, private export, SSR, duplicate Vue, lazy, and source-only mutants', () => {
  const valid = {
    dependencyVersions: {
      vue: ['3.5.32'],
      '@vue/compiler-dom': ['3.5.32'],
      '@vue/shared': ['3.5.32'],
    },
    emittedText: 'new Worker(new URL("worker.mjs", import.meta.url))',
    files: ['assets/index.js'],
    markdownLazy: true,
    privateExportAccessible: false,
    ssrBrowserGlobalAccess: false,
    wasmFiles: ['assets/runtime.wasm'],
    workerFiles: ['assets/worker.mjs'],
  }
  assert.equal(validateConsumerBuildEvidence(valid), valid)
  const mutants = [
    [{ ...valid, workerFiles: ['src/markdown.worker.ts'] }, /source-only/],
    [{ ...valid, wasmFiles: [] }, /no Wasm artifact/],
    [{ ...valid, privateExportAccessible: true }, /private export/],
    [{ ...valid, ssrBrowserGlobalAccess: true }, /browser global/],
    [
      {
        ...valid,
        dependencyVersions: {
          ...valid.dependencyVersions,
          vue: ['3.5.0', '3.5.32'],
        },
      },
      /duplicate vue/,
    ],
    [{ ...valid, markdownLazy: false }, /lazy chunk/],
    [{ ...valid, files: ['/workspace/src/internal.ts'] }, /source-only/],
  ]
  for (const [mutant, pattern] of mutants) {
    assert.throws(() => validateConsumerBuildEvidence(mutant), pattern)
  }
})
