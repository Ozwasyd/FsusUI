import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import test from 'node:test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  compareEvidence,
  deriveAlignment,
  validateCoverage,
  validateEvidence,
  validateCurrentComparison,
  validateOverride,
  validateReadiness,
} from '../scripts/conformance-v2-evidence.mjs'

import {
  alignmentHash as stableReadinessAlignmentHash,
  createPackageAlignmentBinding,
  currentIdentity as stableReadinessCurrentIdentity,
  deriveReleaseScopeFamilies,
  deriveStableConsumers,
  evaluateStableRelease,
  readAlignment as stableReadinessReadAlignment,
  readStableConsumerAuthority,
  requireNugetStableRelease,
  validatePackageAlignmentBinding,
  validateNugetPackageAlignment,
} from '../scripts/avalonia-stable-readiness-lib.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

test('stable readiness hashes the exact Contract V2 bytes', () => {
  const contractPath = path.join(
    root,
    'spec/components/contracts/v2/contract-v2.json',
  )
  const expected = crypto
    .createHash('sha256')
    .update(fs.readFileSync(contractPath))
    .digest('hex')

  assert.equal(stableReadinessCurrentIdentity().contractHash, expected)
})

test('stable consumers derive scope from exact contract bindings and fail closed on stale projections', () => {
  const registry = {
    schemaVersion: 2,
    contracts: [{ id: 'component-v2.a' }, { id: 'component-v2.b' }],
    consumerBindings: {
      byContract: {
        'component-v2.a': { releaseFamily: 'alpha', galleryRoute: 'alpha' },
        'component-v2.b': { releaseFamily: 'beta', galleryRoute: 'beta' },
      },
      releaseScopeFamilies: ['alpha', 'beta'],
    },
  }
  assert.deepEqual(deriveReleaseScopeFamilies(registry), ['alpha', 'beta'])
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'fsusui-authority-'))
  const registryPath = path.join(temporary, 'registry.json')
  const alignmentPath = path.join(temporary, 'alignment.json')
  const expected = { candidate: 'a'.repeat(40), contractHash: 'b'.repeat(64) }
  const alignment = {
    schema: 'fsusui.alignment.v2',
    identity: expected,
    statuses: registry.contracts.map(({ id }) => ({
      id,
      status: 'aligned',
      source: 'derived',
    })),
    stable: registry.contracts.map(({ id }) => id),
    webOnly: [],
    gaps: [],
  }
  alignment.consumers = deriveStableConsumers(registry, alignment)
  alignment.identity.alignmentHash = stableReadinessAlignmentHash(alignment)
  fs.writeFileSync(registryPath, `${JSON.stringify(registry, null, 2)}\n`)
  fs.writeFileSync(alignmentPath, `${JSON.stringify(alignment, null, 2)}\n`)
  assert.deepEqual(
    readStableConsumerAuthority({ registryPath, alignmentPath, expected })
      .releaseScopeFamilies,
    ['alpha', 'beta'],
  )
  const staleAlignment = structuredClone(alignment)
  staleAlignment.consumers.releaseScopeFamilies = ['alpha']
  fs.writeFileSync(alignmentPath, `${JSON.stringify(staleAlignment, null, 2)}\n`)
  assert.throws(
    () => readStableConsumerAuthority({ registryPath, alignmentPath, expected }),
    /integrity hash is invalid/u,
  )
  staleAlignment.identity.alignmentHash =
    stableReadinessAlignmentHash(staleAlignment)
  fs.writeFileSync(alignmentPath, `${JSON.stringify(staleAlignment, null, 2)}\n`)
  assert.throws(
    () => readStableConsumerAuthority({ registryPath, alignmentPath, expected }),
    /consumers do not match exact derived authority/u,
  )
  const staleRegistry = structuredClone(registry)
  staleRegistry.consumerBindings.releaseScopeFamilies = ['alpha']
  fs.writeFileSync(registryPath, `${JSON.stringify(staleRegistry, null, 2)}\n`)
  assert.throws(
    () => readStableConsumerAuthority({ registryPath, alignmentPath, expected }),
    /generated release scope projection is stale/u,
  )
  fs.rmSync(temporary, { recursive: true, force: true })
})

test('stable readiness accepts governed product gaps but rejects leakage and forged eligibility', () => {
  const blocked = {
    statuses: [
      { id: 'component-v2.aligned', status: 'aligned', source: 'derived' },
      { id: 'component-v2.partial', status: 'partial', source: 'derived' },
    ],
    stable: ['component-v2.aligned'],
    gaps: [
      {
        contract: 'component-v2.partial',
        reason: 'A required member is not implemented.',
        owner: 'FsusUI Core',
        requiredScenarios: ['scenario.partial'],
        requiredEvidence: ['same-identity-comparison'],
        evidencePolicy: {
          realExecution: true,
          allowSkip: false,
          allowOverrideWithoutGovernance: false,
        },
      },
    ],
    consumers: {
      alignmentGapCount: 1,
      releaseFamilyGaps: [{ family: 'alpha', blockingContracts: ['component-v2.partial'] }],
      conformanceIntegrityReady: true,
      stableSubsetEligible: true,
      fullSurfaceReleaseReady: false,
      nugetStableEligible: false,
      releaseReady: false,
    },
  }
  assert.deepEqual(evaluateStableRelease(blocked), {
    alignmentGapCount: 1,
    missingReleaseFamilies: blocked.consumers.releaseFamilyGaps,
    releaseReady: false,
  })
  assert.deepEqual(validateNugetPackageAlignment(blocked), {
    alignmentGapCount: 1,
    missingReleaseFamilies: blocked.consumers.releaseFamilyGaps,
    releaseReady: false,
  })
  assert.throws(
    () => requireNugetStableRelease(blocked),
    /NuGet stable candidate blocked/u,
  )
  assert.throws(
    () => validateNugetPackageAlignment(blocked, { stablePublication: true }),
    /NuGet stable candidate blocked/u,
  )
  assert.throws(
    () =>
      evaluateStableRelease({
        ...blocked,
        stable: ['component-v2.aligned', 'component-v2.partial'],
      }),
    /leaks non-aligned/u,
  )
  assert.throws(
    () =>
      evaluateStableRelease({
        ...blocked,
        gaps: [{ ...blocked.gaps[0], owner: '' }],
      }),
    /is ungoverned/u,
  )
  assert.throws(
    () => evaluateStableRelease({ ...blocked, gaps: [] }),
    /gap diagnostic|gap structure/u,
  )
  assert.throws(
    () =>
      evaluateStableRelease({
        ...blocked,
        consumers: {
          ...blocked.consumers,
          nugetStableEligible: true,
          releaseReady: true,
          fullSurfaceReleaseReady: true,
        },
      }),
    /do not match derived alignment/u,
  )

  const ready = {
    statuses: [
      { id: 'component-v2.aligned', status: 'aligned', source: 'derived' },
    ],
    stable: ['component-v2.aligned'],
    gaps: [],
    consumers: {
      alignmentGapCount: 0,
      releaseFamilyGaps: [],
      conformanceIntegrityReady: true,
      stableSubsetEligible: true,
      fullSurfaceReleaseReady: true,
      nugetStableEligible: true,
      releaseReady: true,
    },
  }
  assert.deepEqual(
    validateNugetPackageAlignment(ready, { stablePublication: true }),
    { alignmentGapCount: 0, missingReleaseFamilies: [], releaseReady: true },
  )
  ready.schema = 'fsusui.alignment.v2'
  ready.identity = {
    candidate: 'a'.repeat(40),
    contractHash: 'b'.repeat(64),
  }
  ready.identity.alignmentHash = stableReadinessAlignmentHash(ready)
  const sealedArtifact = Buffer.from(`${JSON.stringify(ready)}\n`)
  const binding = createPackageAlignmentBinding(ready, sealedArtifact)
  assert.deepEqual(
    validatePackageAlignmentBinding(binding, sealedArtifact, {
      candidate: ready.identity.candidate,
    }),
    ready,
  )
  assert.throws(
    () =>
      validatePackageAlignmentBinding(
        binding,
        Buffer.concat([sealedArtifact, Buffer.from(' ')]),
        { candidate: ready.identity.candidate },
      ),
    /stale or tampered/u,
  )
})

test('evidence rejects headless and fixture-only paths', () => {
  assert.throws(
    () =>
      validateEvidence(
        { schema: 'fsusui.conformance-evidence.v2', identity: {} },
        'avalonia',
      ),
    /identity\.executionId/,
  )
})

test('coverage rejects metadata-only generated tests', () => {
  assert.throws(
    () =>
      validateCoverage({
        requiredMembers: ['document'],
        memberScenarios: { document: ['metadata'] },
        executions: { metadata: { real: false } },
      }),
    /metadata-only/,
  )
})

test('platform overrides require exact governed fields', () => {
  assert.throws(
    () =>
      validateOverride({
        field: 'state.*',
        reason: 'x',
        owner: 'x',
        testPolicy: 'x',
        reviewPolicy: 'x',
      }),
    /broad override/,
  )
})

test('derive comparison validation rejects stale identity and tampered evidence', () => {
  const web = JSON.parse(
    fs.readFileSync(
      path.join(root, '.tmp/conformance-v2/web-a11y/manifest.json'),
      'utf8',
    ),
  )
  const avalonia = JSON.parse(
    fs.readFileSync(
      path.join(root, '.tmp/conformance-v2/avalonia.json'),
      'utf8',
    ),
  )
  const comparison = compareEvidence(web, avalonia)
  const expected = { ...comparison.identity }

  const failedMarkdownStep = structuredClone(web)
  failedMarkdownStep.contractExecutions[
    'component-v2.el-markdown-editor'
  ].steps[0].observation.passed = false
  assert.throws(
    () => compareEvidence(failedMarkdownStep, avalonia),
    /component-v2\.el-markdown-editor\.steps\[0\] failed/u,
  )

  const spoofedMarkdownIdentity = structuredClone(web)
  const spoofedExecution =
    spoofedMarkdownIdentity.contractExecutions[
      'component-v2.el-markdown-editor'
    ]
  spoofedExecution.identity.documentId = 'runner-authored-document'
  for (const step of spoofedExecution.steps) {
    step.binding.documentId = 'runner-authored-document'
  }
  assert.throws(
    () => compareEvidence(spoofedMarkdownIdentity, avalonia),
    /identity\.documentId mismatch/u,
  )

  assert.throws(
    () => compareEvidence(web, avalonia, {}),
    /visual-review was not current-validated/,
  )

  validateCurrentComparison(comparison, web, avalonia, expected)

  const registry = JSON.parse(
    fs.readFileSync(
      path.join(root, 'spec/components/contracts/v2/contract-v2.json'),
      'utf8',
    ),
  )
  const alignment = deriveAlignment(registry, comparison)
  assert.notEqual(
    alignment.statuses.find(
      (entry) => entry.id === 'component-v2.el-markdown-editor',
    )?.status,
    'aligned',
  )
  assert.ok(
    alignment.gaps.some(
      (gap) => gap.contract === 'component-v2.el-markdown-editor',
    ),
  )

  assert.throws(
    () =>
      validateCurrentComparison(
        {
          ...comparison,
          identity: { ...comparison.identity, candidate: 'stale-candidate' },
        },
        web,
        avalonia,
        expected,
      ),
    /comparison\.identity\.candidate mismatch/,
  )

  const tamperedWeb = structuredClone(web)
  tamperedWeb.publicState.markdown.value = 'tampered after comparison'
  assert.throws(
    () =>
      validateCurrentComparison(
        comparison,
        tamperedWeb,
        avalonia,
        expected,
      ),
    /comparison\.evidenceDigests\.web mismatch/,
  )

  assert.throws(
    () =>
      validateCurrentComparison(
        { ...comparison, compared: ['public-state'] },
        web,
        avalonia,
        expected,
      ),
    /comparison\.requiredArtifact\.transition-order missing/,
  )
})

test('alignment is derived and readiness excludes partial contracts', () => {
  const registry = {
    contracts: [
      {
        id: 'partial',
        owner: 'FsusUI Core',
        scenarioIds: ['scenario.partial.input.value', 'scenario.partial.a11y'],
        bindings: { avalonia: { status: 'bound' } },
        coverage: { missing: 1, partial: 0 },
        inputs: [
          {
            kind: 'input',
            name: 'value',
            status: 'missing',
            scenarioIds: ['scenario.partial.input.value'],
            governance: {
              reason: 'No matching real Avalonia public member.',
              owner: 'FsusUI Core',
              testPolicy: 'contract',
              reviewPolicy: 'pr-review',
            },
          },
        ],
        requirements: {
          a11y: ['The control must expose an accessible name and role.'],
        },
      },
    ],
  }
  const alignment = deriveAlignment(registry)
  assert.equal(alignment.statuses[0].status, 'partial')
  assert.deepEqual(alignment.gaps[0], {
    contract: 'partial',
    status: 'partial',
    reason: 'No matching real Avalonia public member.',
    owner: 'FsusUI Core',
    requiredMembers: [
      {
        kind: 'input',
        name: 'value',
        status: 'missing',
        reason: 'No matching real Avalonia public member.',
        owner: 'FsusUI Core',
        testPolicy: 'contract',
        reviewPolicy: 'pr-review',
        scenarioIds: ['scenario.partial.input.value'],
      },
    ],
    requiredScenarios: [
      'scenario.partial.input.value',
      'scenario.partial.a11y',
    ],
    requiredEvidence: [
      'required-member-coverage',
      'same-identity-a11y-evidence',
      'same-identity-cross-platform-comparison',
    ],
    evidencePolicy: {
      realExecution: true,
      allowSkip: false,
      allowOverrideWithoutGovernance: false,
    },
    missingMembers: 1,
    partialMembers: 0,
    missingArtifacts: [
      'required-member-coverage',
      'same-identity-a11y-evidence',
      'same-identity-cross-platform-comparison',
    ],
  })
  assert.throws(
    () => validateReadiness({ ...alignment, stable: ['partial'] }),
    /is partial/,
  )

  assert.throws(
    () =>
      deriveAlignment(registry, {
        verdict: 'pass',
        identity: { contract: 'partial' },
      }),
    /was not current-validated/,
  )
})

test('web-only contracts remain explicit without becoming Avalonia gaps', () => {
  const registry = {
    contracts: [
      {
        id: 'web-only-bound',
        component: { exportStatus: 'web-only' },
        platformException: {
          reason: 'Browser-only primitive.',
          alternative: 'Use the native overlay primitive.',
          owner: 'FsusUI Core',
          testPolicy: 'Real browser regression test.',
          reviewPolicy: 'Review on each minor release.',
          reviewedAt: '2026-08-30',
        },
        bindings: { avalonia: { status: 'bound' } },
        coverage: { missing: 0, partial: 0, webOnly: 1 },
      },
      {
        id: 'web-only-unbound',
        component: { exportStatus: 'web-only' },
        platformException: {
          reason: 'Browser-only primitive.',
          alternative: 'Use the native overlay primitive.',
          owner: 'FsusUI Core',
          testPolicy: 'Real browser regression test.',
          reviewPolicy: 'Review on each minor release.',
          reviewedAt: '2026-08-30',
        },
        bindings: { avalonia: { status: 'unbound' } },
        coverage: { missing: 0, partial: 0, webOnly: 1 },
      },
    ],
  }
  const alignment = deriveAlignment(registry)
  assert.deepEqual(
    alignment.statuses.map(({ id, status }) => ({ id, status })),
    [
      { id: 'web-only-bound', status: 'web-only' },
      { id: 'web-only-unbound', status: 'web-only' },
    ],
  )
  assert.deepEqual(alignment.stable, [])
  assert.deepEqual(alignment.webOnly, [
    'web-only-bound',
    'web-only-unbound',
  ])
  assert.deepEqual(alignment.gaps, [])
  assert.equal(alignment.consumers.nugetStableEligible, true)
  assert.equal(alignment.consumers.releaseReady, true)
  validateReadiness(alignment)
})

test('unreviewed web-only labels remain release-blocking gaps', () => {
  const alignment = deriveAlignment({
    contracts: [
      {
        id: 'unreviewed-web-only',
        owner: 'FsusUI Core',
        component: { exportStatus: 'web-only' },
        bindings: { avalonia: { status: 'unbound' } },
        coverage: { missing: 0, partial: 0, webOnly: 1 },
        scenarioIds: ['scenario.unreviewed'],
        requirements: {},
      },
    ],
  })
  assert.equal(alignment.statuses[0].status, 'missing')
  assert.equal(alignment.gaps.length, 1)
  assert.equal(alignment.consumers.releaseReady, false)
})

test('public values remain release-blocking until mapped and evidenced', () => {
  const governance = {
    reason: 'Behavior evidence is still required.',
    owner: 'FsusUI Core',
    testPolicy: 'contract',
    reviewPolicy: 'pr-review',
  }
  const alignment = deriveAlignment({
    contracts: [],
    publicValueBindings: [
      {
        id: 'public-value.partial',
        name: 'PartialValue',
        status: 'partial',
        avalonia: { type: 'FsusValue' },
        scenarioIds: ['scenario.v2.public-value.partial'],
        governance,
      },
      {
        id: 'public-value.renderer-sentinel',
        name: 'RendererSentinel',
        status: 'web-only',
        avalonia: null,
        scenarioIds: ['scenario.v2.public-value.renderer-sentinel'],
        governance: {
          ...governance,
          alternative: 'Use the native renderer lifecycle.',
          reviewedAt: '2026-08-30',
        },
      },
    ],
  })
  assert.deepEqual(
    alignment.statuses.map(({ id, status }) => ({ id, status })),
    [
      { id: 'public-value.partial', status: 'partial' },
      { id: 'public-value.renderer-sentinel', status: 'web-only' },
    ],
  )
  assert.equal(alignment.gaps.length, 1)
  assert.equal(alignment.gaps[0].contract, 'public-value.partial')
  assert.equal(alignment.consumers.releaseReady, false)
  validateReadiness(alignment)
})

test('T762-01 stable readiness rejects missing, stale, and tampered alignment', () => {
  const expected = stableReadinessCurrentIdentity()
  const valid = JSON.parse(
    fs.readFileSync(
      path.join(root, '.tmp/conformance-v2/alignment.json'),
      'utf8',
    ),
  )
  const currentExpected = {
    ...stableReadinessCurrentIdentity(),
    candidate: valid.identity.candidate,
  }

  assert.throws(
    () =>
      stableReadinessReadAlignment('.tmp/conformance-v2/absent.json', expected),
    /is missing; run the governed producer/u,
  )

  assert.throws(
    () =>
      stableReadinessReadAlignment('.tmp/conformance-v2/alignment.json', {
        ...currentExpected,
        contractHash: '0'.repeat(64),
      }),
    /identity contractHash is stale/u,
  )

  assert.throws(
    () =>
      stableReadinessReadAlignment('.tmp/conformance-v2/alignment.json', {
        ...currentExpected,
        candidate: '0'.repeat(40),
      }),
    /identity candidate is stale/u,
  )

  const tampered = {
    ...valid,
    statuses: valid.statuses.slice(0, 1),
    identity: {
      ...valid.identity,
      alignmentHash: stableReadinessAlignmentHash({
        ...valid,
        statuses: valid.statuses.slice(1),
      }),
    },
  }
  const tamperedPath = path.join(os.tmpdir(), 'fsusui-t762-alignment.json')
  fs.writeFileSync(tamperedPath, `${JSON.stringify(tampered, null, 2)}\n`)
  try {
    assert.throws(
      () =>
        stableReadinessReadAlignment(tamperedPath, {
          candidate: valid.identity.candidate,
          contractHash: valid.identity.contractHash,
        }),
      /integrity hash is invalid/u,
    )
  } finally {
    fs.rmSync(tamperedPath, { force: true })
  }
})
