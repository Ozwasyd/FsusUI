import assert from 'node:assert/strict'
import test from 'node:test'
import {
  FsusUIContractError,
  applyNegativeControl,
  buildValidFsusUIContractBundle,
  loadFsusUIDesignConformanceAssets,
  runFsusUIDesignConformanceCheck,
  sealReceipt,
  validateFsusUIContractBundle,
} from '../scripts/check-fsusui-design-conformance.mjs'

const clone = (value) => JSON.parse(JSON.stringify(value))

test('validates domain-only classification, adjudication, and UX receipts', async () => {
  const assets = await loadFsusUIDesignConformanceAssets()
  const bundle = await buildValidFsusUIContractBundle(assets)
  await assert.doesNotReject(validateFsusUIContractBundle(bundle, assets))
  assert.match(bundle.classificationReceipt.receiptDigest, /^[a-f0-9]{64}$/u)
  assert.match(bundle.adjudicationReceipt.adjudicationDigest, /^[a-f0-9]{64}$/u)
  assert.match(bundle.uxAcceptanceReceipt.receiptDigest, /^[a-f0-9]{64}$/u)
})

test('keeps FsusUI policy domain-only and externalizes shared orchestration authority', async () => {
  const { policy } = await loadFsusUIDesignConformanceAssets()
  assert.equal(policy.authorityScope, 'repository-domain-and-acceptance-only')
  assert.equal(policy.sharedOrchestrationAuthority, 'external')
  for (const forbiddenKey of [
    'roleProfiles',
    'rolePermissions',
    'writeLeaseOrder',
    'stageOrder',
    'uiDecisionRoutes',
    'verificationRoutes',
    'uiImplementationRuntime',
    'implementationForbiddenProfiles',
    'retryBases',
    'outputMissingClasses',
  ]) {
    assert.equal(Object.hasOwn(policy, forbiddenKey), false, forbiddenKey)
  }
})

test('rejects reintroduced shared orchestration policy fields', async () => {
  const assets = await loadFsusUIDesignConformanceAssets()
  const bundle = await buildValidFsusUIContractBundle(assets)
  const driftedAssets = clone(assets)
  driftedAssets.policy.roleProfiles = {
    'ui-ux-implementer': ['some-profile'],
  }
  await assert.rejects(
    validateFsusUIContractBundle(bundle, driftedAssets),
    (error) =>
      error instanceof FsusUIContractError &&
      error.code === 'ui-orchestration-authority-leak',
  )
})

test('binds classification to the active FsusUI Skill, authorities, candidate, and domain policy', async () => {
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

  const wrongPolicy = clone(bundle)
  wrongPolicy.classificationReceipt.domainPolicyDigest =
    '9999999999999999999999999999999999999999999999999999999999999999'
  wrongPolicy.classificationReceipt = sealReceipt(
    wrongPolicy.classificationReceipt,
    'receiptDigest',
  )
  await assert.rejects(
    validateFsusUIContractBundle(wrongPolicy, assets),
    (error) =>
      error instanceof FsusUIContractError &&
      error.code === 'classification-receipt-binding',
  )
})

test('adjudication resolves domain ownership without selecting execution machinery', async () => {
  const assets = await loadFsusUIDesignConformanceAssets()
  const bundle = await buildValidFsusUIContractBundle(assets)
  assert.equal(
    bundle.adjudicationClassificationReceipt.uiDecisionClass,
    'system-design-dispute',
  )
  assert.equal(bundle.adjudicationReceipt.disposition, 'fsusui-owned')
  assert.equal(
    bundle.adjudicationReceipt.allowedUiDecisionClass,
    'layout-judgment',
  )
  for (const forbiddenField of [
    'routingProfile',
    'actualModel',
    'actualEffort',
    'sandbox',
    'allowedImplementationClass',
    'requiredReslice',
  ]) {
    assert.equal(
      Object.hasOwn(bundle.adjudicationReceipt, forbiddenField),
      false,
      forbiddenField,
    )
  }
})

test('accepts a UX veto while keeping acceptance read-only and candidate-bound', async () => {
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
  await assert.doesNotReject(validateFsusUIContractBundle(bundle, assets))
  assert.deepEqual(bundle.uxAcceptanceReceipt.modifiedPaths, [])
})

test('UX acceptance does not prescribe actor, model, profile, route, or sandbox', async () => {
  const assets = await loadFsusUIDesignConformanceAssets()
  const bundle = await buildValidFsusUIContractBundle(assets)
  for (const forbiddenField of [
    'dispatchReceiptDigest',
    'routingProfile',
    'actualModel',
    'actualEffort',
    'verifierRole',
    'workPlanDigest',
    'slicePlanDigest',
    'compiledPromptDigest',
    'executionRouteDigest',
    'routingPolicyDigest',
    'slicePolicyDigest',
    'freshContext',
    'sandbox',
    'writeScope',
  ]) {
    assert.equal(
      Object.hasOwn(bundle.uxAcceptanceReceipt, forbiddenField),
      false,
      forbiddenField,
    )
  }
})

test('kills all 12 domain negative controls with stable reason codes', async () => {
  const assets = await loadFsusUIDesignConformanceAssets()
  const bundle = await buildValidFsusUIContractBundle(assets)
  assert.equal(assets.negativeControls.length, 12)
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
  const assets = await loadFsusUIDesignConformanceAssets()
  assert.deepEqual(await runFsusUIDesignConformanceCheck(), {
    negativeControls: 12,
    policyDigest: assets.policyDigest,
    receipts: 3,
  })
})
