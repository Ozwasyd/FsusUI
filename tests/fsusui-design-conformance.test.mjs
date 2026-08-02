import assert from 'node:assert/strict'
import test from 'node:test'
import {
  FsusUIContractError,
  applyNegativeControl,
  buildValidFsusUIContractBundle,
  digestValue,
  loadFsusUIDesignConformanceAssets,
  resolveUiImplementationRoute,
  runFsusUIDesignConformanceCheck,
  sealReceipt,
  validateFsusUIContractBundle,
} from '../scripts/check-fsusui-design-conformance.mjs'

const clone = (value) => JSON.parse(JSON.stringify(value))

test('validates all three versioned receipts and the coherent UI dispatch', async () => {
  const assets = await loadFsusUIDesignConformanceAssets()
  const bundle = await buildValidFsusUIContractBundle(assets)
  await assert.doesNotReject(validateFsusUIContractBundle(bundle, assets))
  assert.match(bundle.classificationReceipt.receiptDigest, /^[a-f0-9]{64}$/u)
  assert.match(bundle.adjudicationReceipt.adjudicationDigest, /^[a-f0-9]{64}$/u)
  assert.match(bundle.uxAcceptanceReceipt.receiptDigest, /^[a-f0-9]{64}$/u)
})

test('binds actual UI runtime, worktree, candidate, and independent UX run identities', async () => {
  const assets = await loadFsusUIDesignConformanceAssets()
  const bundle = await buildValidFsusUIContractBundle(assets)
  assert.equal(bundle.uiDispatch.actualModel, 'gpt-5.6-sol')
  assert.equal(bundle.uiDispatch.actualEffort, 'low')
  assert.equal(
    bundle.uiDispatch.candidateSha,
    bundle.classificationReceipt.candidateSha,
  )
  assert.notEqual(
    bundle.uxAcceptanceReceipt.implementationRunIdentityDigest,
    bundle.uxAcceptanceReceipt.verifierRunIdentityDigest,
  )

  const wrongRuntime = clone(bundle)
  wrongRuntime.uiDispatch.actualEffort = 'high'
  await assert.rejects(
    validateFsusUIContractBundle(wrongRuntime, assets),
    (error) =>
      error instanceof FsusUIContractError &&
      error.code === 'ui-runtime-identity',
  )

  for (const forbiddenProfile of [
    'luna-low',
    'terra-max',
    'sol-high',
    'sol-xhigh',
    'sol-max',
  ]) {
    const forbiddenRuntime = clone(bundle)
    forbiddenRuntime.uiDispatch.selectedProfile = forbiddenProfile
    await assert.rejects(
      validateFsusUIContractBundle(forbiddenRuntime, assets),
      (error) =>
        error instanceof FsusUIContractError &&
        error.code === 'ui-profile-forbidden',
      forbiddenProfile,
    )
  }

  const selfAccepted = clone(bundle)
  selfAccepted.uxAcceptanceReceipt.verifierRunIdentityDigest =
    selfAccepted.uxAcceptanceReceipt.implementationRunIdentityDigest
  selfAccepted.uxAcceptanceReceipt = sealReceipt(
    selfAccepted.uxAcceptanceReceipt,
    'receiptDigest',
  )
  await assert.rejects(
    validateFsusUIContractBundle(selfAccepted, assets),
    (error) =>
      error instanceof FsusUIContractError &&
      error.code === 'ux-acceptance-receipt-binding',
  )
})

test('rejects receipt tampering and role-lease policy drift', async () => {
  const assets = await loadFsusUIDesignConformanceAssets()
  const bundle = await buildValidFsusUIContractBundle(assets)
  const tampered = clone(bundle)
  tampered.classificationReceipt.candidateSha =
    '9999999999999999999999999999999999999999'
  await assert.rejects(
    validateFsusUIContractBundle(tampered, assets),
    (error) =>
      error instanceof FsusUIContractError &&
      error.code === 'classification-receipt-digest',
  )

  const driftedAssets = clone(assets)
  driftedAssets.policy.rolePermissions['test-owner'].writeScope =
    'implementation-only'
  await assert.rejects(
    validateFsusUIContractBundle(bundle, driftedAssets),
    (error) =>
      error instanceof FsusUIContractError &&
      error.code === 'ui-role-lease-policy',
  )
})

test('allows a read-only UX veto but keeps documentation gated', async () => {
  const assets = await loadFsusUIDesignConformanceAssets()
  const bundle = await buildValidFsusUIContractBundle(assets)
  bundle.uxAcceptanceReceipt.status = 'rejected'
  bundle.uxAcceptanceReceipt.blockers = [
    'Keyboard focus order diverges from the frozen path contract.',
  ]
  bundle.uxAcceptanceReceipt = sealReceipt(
    bundle.uxAcceptanceReceipt,
    'receiptDigest',
  )
  bundle.stageGates.uxAccepted = false
  bundle.stageGates.documentationStarted = false
  await assert.doesNotReject(validateFsusUIContractBundle(bundle, assets))
})

test('routes low and medium UI slices and stops long or disputed work', async () => {
  const { policy } = await loadFsusUIDesignConformanceAssets()
  assert.equal(
    resolveUiImplementationRoute(policy, 'prescribed', 'atomic-edit'),
    'sol-low',
  )
  assert.equal(
    resolveUiImplementationRoute(
      policy,
      'bounded-composition',
      'bounded-multifile',
    ),
    'sol-low',
  )
  assert.equal(
    resolveUiImplementationRoute(policy, 'layout-judgment', 'iterative-debug'),
    'sol-medium',
  )
  assert.equal(
    resolveUiImplementationRoute(
      policy,
      'interaction-judgment',
      'runtime-probe-heavy',
    ),
    'sol-medium',
  )
  assert.equal(
    resolveUiImplementationRoute(
      policy,
      'layout-judgment',
      'long-horizon-cross-module',
    ),
    'reslice-required',
  )
  assert.equal(
    resolveUiImplementationRoute(
      policy,
      'system-design-dispute',
      'read-only-adjudication',
    ),
    'stop-and-adjudicate',
  )
})

test('accepts a verified checkpoint continuation without candidate-green', async () => {
  const assets = await loadFsusUIDesignConformanceAssets()
  const bundle = await buildValidFsusUIContractBundle(assets)
  bundle.uiDispatch.sliceStatus = 'slice-continuation-required'
  bundle.uiDispatch.outcome = 'slice-continuation-required'
  bundle.uiDispatch.stageStatus = 'implementing-self-testing'
  bundle.uxAcceptanceReceipt.dispatchReceiptDigest = digestValue(
    bundle.uiDispatch,
  )
  bundle.uxAcceptanceReceipt = sealReceipt(
    bundle.uxAcceptanceReceipt,
    'receiptDigest',
  )
  await assert.doesNotReject(validateFsusUIContractBundle(bundle, assets))
})

test('requires material recovery evidence after output-missing', async () => {
  const assets = await loadFsusUIDesignConformanceAssets()
  const bundle = await buildValidFsusUIContractBundle(assets)
  bundle.uiDispatch.recovery = {
    failureClass: 'profile-capability-mismatch',
    retryBasis: 'verified-profile-capability-mismatch',
  }
  bundle.uxAcceptanceReceipt.dispatchReceiptDigest = digestValue(
    bundle.uiDispatch,
  )
  bundle.uxAcceptanceReceipt = sealReceipt(
    bundle.uxAcceptanceReceipt,
    'receiptDigest',
  )
  await assert.doesNotReject(validateFsusUIContractBundle(bundle, assets))
})

test('kills all 18 issue negative controls with stable reason codes', async () => {
  const assets = await loadFsusUIDesignConformanceAssets()
  const bundle = await buildValidFsusUIContractBundle(assets)
  assert.equal(assets.negativeControls.length, 18)
  for (const control of assets.negativeControls) {
    const mutated = applyNegativeControl(bundle, control.id)
    await assert.rejects(
      validateFsusUIContractBundle(mutated, assets),
      (error) =>
        error instanceof FsusUIContractError &&
        error.code === control.expectedCode,
      control.id,
    )
  }
})

test('runs the permanent checker entrypoint contract', async () => {
  assert.deepEqual(await runFsusUIDesignConformanceCheck(), {
    negativeControls: 18,
    policyDigest: (await loadFsusUIDesignConformanceAssets()).policyDigest,
    receipts: 3,
  })
})
