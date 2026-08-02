#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import Ajv from 'ajv'

const root = resolve(import.meta.dirname, '..')
const contractsRoot = resolve(
  root,
  '.agents/skills/fsusui-design-conformance/contracts',
)
const fixturesRoot = resolve(root, 'tests/fixtures/fsusui-design-conformance')
const skillPath = resolve(
  root,
  '.agents/skills/fsusui-design-conformance/SKILL.md',
)
const workflowPath = resolve(root, 'docs/workflows/visual-change.md')
const consumerPath = resolve(root, 'docs/consumers/design-integration.md')
const packagePath = resolve(root, 'package.json')

const paths = Object.freeze({
  policy: resolve(contractsRoot, 'ui-stage-policy.json'),
  classificationSchema: resolve(
    contractsRoot,
    'ui-ux-classification-receipt.schema.json',
  ),
  adjudicationSchema: resolve(
    contractsRoot,
    'ui-system-adjudication-receipt.schema.json',
  ),
  uxAcceptanceSchema: resolve(
    contractsRoot,
    'ux-acceptance-receipt.schema.json',
  ),
  validTemplates: resolve(fixturesRoot, 'valid-receipt-templates.json'),
  negativeControls: resolve(fixturesRoot, 'negative-controls.json'),
})

const HASH = /^[a-f0-9]{64}$/u
const SHA = /^[a-f0-9]{40}$/u
const clone = (value) => JSON.parse(JSON.stringify(value))

export class FsusUIContractError extends Error {
  constructor(code, message = code) {
    super(message)
    this.code = code
  }
}

const fail = (code, message) => {
  throw new FsusUIContractError(code, message)
}

const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'))

const canonical = (value) => {
  if (Array.isArray(value)) return value.map(canonical)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, canonical(value[key])]),
  )
}

export const digestValue = (value) =>
  createHash('sha256')
    .update(JSON.stringify(canonical(value)))
    .digest('hex')

export const sealReceipt = (receipt, digestField) => {
  const sealed = clone(receipt)
  delete sealed[digestField]
  sealed[digestField] = digestValue(sealed)
  return sealed
}

const sameValues = (left, right) =>
  JSON.stringify(left) === JSON.stringify(right)

export const loadFsusUIDesignConformanceAssets = async () => {
  const [
    policy,
    classificationSchema,
    adjudicationSchema,
    uxAcceptanceSchema,
    validTemplates,
    negativeControls,
  ] = await Promise.all(Object.values(paths).map(readJson))
  const [skill, workflow, consumer, packageManifest] = await Promise.all([
    readFile(skillPath, 'utf8'),
    readFile(workflowPath, 'utf8'),
    readFile(consumerPath, 'utf8'),
    readJson(packagePath),
  ])
  return {
    policy,
    policyDigest: digestValue(policy),
    schemas: {
      classification: classificationSchema,
      adjudication: adjudicationSchema,
      uxAcceptance: uxAcceptanceSchema,
    },
    validTemplates,
    negativeControls,
    sources: {
      skill,
      workflow,
      consumer,
      packageManifest,
    },
  }
}

const compileSchemas = (schemas) => {
  const ajv = new Ajv({
    allErrors: true,
  })
  return {
    ajv,
    validators: Object.fromEntries(
      Object.entries(schemas).map(([name, schema]) => [
        name,
        ajv.compile(schema),
      ]),
    ),
  }
}

const assertSchema = (kind, value, compiled) => {
  const validator = compiled.validators[kind]
  if (!validator(value)) {
    fail(
      `${
        kind === 'uxAcceptance' ? 'ux-acceptance-receipt' : `${kind}-receipt`
      }-schema`,
      compiled.ajv.errorsText(validator.errors, { separator: '; ' }),
    )
  }
}

const assertReceiptDigest = (receipt, digestField, code) => {
  const expected = receipt[digestField]
  const unsigned = clone(receipt)
  delete unsigned[digestField]
  if (!HASH.test(expected ?? '') || digestValue(unsigned) !== expected) {
    fail(code)
  }
}

const authorityDigests = (classification) =>
  classification.requiredAuthorities.map(({ digest }) => digest)

const baselineIdentityDigest = (classification) =>
  digestValue(classification.activeBaselineIdentity)

const assertPolicyContract = (policy) => {
  if (
    !sameValues(policy.uiDecisionRoutes, {
      prescribed: 'sol-low',
      'bounded-composition': 'sol-low',
      'layout-judgment': 'sol-medium',
      'interaction-judgment': 'sol-medium',
      'system-design-dispute': 'stop-and-adjudicate',
    }) ||
    !sameValues(policy.verificationRoutes, {
      'ux-local': 'sol-medium',
      'ux-path': 'sol-high',
      'ux-system': 'sol-xhigh',
    }) ||
    !sameValues(policy.uiImplementationRuntime, {
      actualModel: 'gpt-5.6-sol',
      profileEfforts: {
        'sol-low': 'low',
        'sol-medium': 'medium',
      },
    }) ||
    !sameValues(policy.writeLeaseOrder, [
      'test-owner',
      'ui-ux-implementer',
      'documentation-writer',
    ]) ||
    !sameValues(policy.readOnlyStages, [
      'behavior-verifier',
      'ui-system-adjudicator',
      'ux-acceptance-verifier',
    ]) ||
    !sameValues(policy.resliceWorkShapes, [
      'context-heavy',
      'high-tool-depth',
      'long-horizon-cross-module',
    ]) ||
    !sameValues(policy.requiredDispatchIdentityFields, [
      'actualModel',
      'actualEffort',
      'targetWorktree',
      'candidateSha',
    ]) ||
    !sameValues(policy.requiredDispatchDigestFields, [
      'classificationReceiptDigest',
      'workPlanDigest',
      'sliceDigest',
      'compiledPromptDigest',
      'checkpointPolicyDigest',
      'executionRouteDigest',
      'skillDigest',
      'authorityDigest',
      'baselineDigest',
      'targetWorktreeDigest',
      'implementationRunIdentityDigest',
      'candidateDigest',
    ])
  ) {
    fail('ui-policy-contract')
  }
  const requiredProfiles = {
    'root-scheduler': ['luna-low'],
    'test-owner': ['sol-high', 'terra-max', 'sol-xhigh'],
    'behavior-verifier': ['sol-high', 'terra-max', 'sol-xhigh'],
    'ui-ux-implementer': ['sol-low', 'sol-medium'],
    'ui-system-adjudicator': ['sol-high', 'sol-xhigh'],
    'ux-acceptance-verifier': ['sol-medium', 'sol-high', 'sol-xhigh'],
    'documentation-writer': ['luna-high', 'luna-max'],
  }
  const requiredPermissions = {
    'test-owner': {
      freshContext: false,
      sandbox: 'workspace-write',
      writeScope: 'tests-fixtures-probes-only',
    },
    'ui-ux-implementer': {
      freshContext: false,
      sandbox: 'workspace-write',
      writeScope: 'implementation-only',
    },
    'behavior-verifier': {
      freshContext: true,
      sandbox: 'read-only',
      writeScope: 'none',
    },
    'ui-system-adjudicator': {
      freshContext: true,
      sandbox: 'read-only',
      writeScope: 'none',
    },
    'ux-acceptance-verifier': {
      freshContext: true,
      sandbox: 'read-only',
      writeScope: 'none',
    },
    'documentation-writer': {
      freshContext: false,
      sandbox: 'workspace-write',
      writeScope: 'documentation-only',
    },
  }
  if (
    !sameValues(policy.roleProfiles, requiredProfiles) ||
    !sameValues(policy.rolePermissions, requiredPermissions)
  ) {
    fail('ui-role-lease-policy')
  }
}

const assertSourceBindings = (assets) => {
  const allWorkflowText = `${assets.sources.skill}\n${assets.sources.workflow}`
  const normalizedWorkflowText = allWorkflowText.replace(/[-\s]+/gu, ' ')
  for (const fragment of [
    'fsusui-design-conformance.ui-ux-classification-receipt.v1',
    'fsusui-design-conformance.ui-system-adjudication-receipt.v1',
    'fsusui-design-conformance.ux-acceptance-receipt.v1',
    'test owner -> UI/UX implementer -> documentation writer',
    'context-heavy',
    'high-tool-depth',
    'long-horizon-cross-module',
    'slice-continuation-required',
    'candidate-green',
    'production',
    'screen reader',
    'candidate SHA',
    'target worktree',
    'implementation run',
    'verifier run',
  ]) {
    if (!normalizedWorkflowText.includes(fragment.replace(/[-\s]+/gu, ' '))) {
      fail('ui-source-contract-drift', fragment)
    }
  }
  if (
    !assets.sources.consumer.includes(
      'canonical Skill is a required procedural contract',
    )
  ) {
    fail('ui-consumer-skill-load-ambiguity')
  }
  const scripts = assets.sources.packageManifest.scripts ?? {}
  if (
    scripts['check:fsusui-design-conformance'] !==
      'node ./scripts/with-node-heap.mjs node ./scripts/check-fsusui-design-conformance.mjs' ||
    !scripts['governance:check']?.includes('check:fsusui-design-conformance')
  ) {
    fail('ui-package-check-entry')
  }
}

export const buildValidFsusUIContractBundle = async (assetsInput) => {
  const assets = assetsInput ?? (await loadFsusUIDesignConformanceAssets())
  const templates = clone(assets.validTemplates)
  const bindPolicy = (receipt) => {
    receipt.routingPolicyDigest = assets.policyDigest
    receipt.slicePolicyDigest = assets.policyDigest
    receipt.activeBaselineIdentity.authorityDigest = digestValue(
      receipt.requiredAuthorities.map(({ digest }) => digest),
    )
    return sealReceipt(receipt, 'receiptDigest')
  }
  const classificationReceipt = bindPolicy(templates.classificationReceipt)
  const adjudicationClassificationReceipt = bindPolicy(
    templates.adjudicationClassificationReceipt,
  )
  const adjudicationReceipt = templates.adjudicationReceipt
  adjudicationReceipt.classificationReceiptDigest =
    adjudicationClassificationReceipt.receiptDigest
  adjudicationReceipt.ownerRepository =
    adjudicationClassificationReceipt.ownerRepository
  adjudicationReceipt.authoritativeSkillDigests =
    adjudicationClassificationReceipt.requiredSkillDigests
  adjudicationReceipt.authorityDigests = authorityDigests(
    adjudicationClassificationReceipt,
  )
  adjudicationReceipt.activeBaselineIdentityDigest = baselineIdentityDigest(
    adjudicationClassificationReceipt,
  )
  adjudicationReceipt.candidateSha =
    adjudicationClassificationReceipt.candidateSha
  adjudicationReceipt.candidateDigest =
    adjudicationClassificationReceipt.candidateDigest
  adjudicationReceipt.routingPolicyDigest = assets.policyDigest
  adjudicationReceipt.slicePolicyDigest = assets.policyDigest

  const uiDispatch = templates.uiDispatch
  uiDispatch.classificationReceiptDigest = classificationReceipt.receiptDigest
  uiDispatch.routingPolicyDigest = assets.policyDigest
  uiDispatch.slicePolicyDigest = assets.policyDigest
  uiDispatch.skillDigest =
    classificationReceipt.activeBaselineIdentity.skillDigest
  uiDispatch.authorityDigest =
    classificationReceipt.activeBaselineIdentity.authorityDigest
  uiDispatch.baselineDigest = baselineIdentityDigest(classificationReceipt)
  uiDispatch.candidateSha = classificationReceipt.candidateSha
  uiDispatch.candidateDigest = classificationReceipt.candidateDigest

  const uxAcceptanceReceipt = templates.uxAcceptanceReceipt
  uxAcceptanceReceipt.classificationReceiptDigest =
    classificationReceipt.receiptDigest
  uxAcceptanceReceipt.dispatchReceiptDigest = digestValue(uiDispatch)
  uxAcceptanceReceipt.requiredSkillDigests =
    classificationReceipt.requiredSkillDigests
  uxAcceptanceReceipt.authorityDigests = authorityDigests(classificationReceipt)
  uxAcceptanceReceipt.activeBaselineIdentityDigest = baselineIdentityDigest(
    classificationReceipt,
  )
  uxAcceptanceReceipt.workPlanDigest = uiDispatch.workPlanDigest
  uxAcceptanceReceipt.slicePlanDigest = uiDispatch.sliceDigest
  uxAcceptanceReceipt.compiledPromptDigest = uiDispatch.compiledPromptDigest
  uxAcceptanceReceipt.executionRouteDigest = uiDispatch.executionRouteDigest
  uxAcceptanceReceipt.implementationRunIdentityDigest =
    uiDispatch.implementationRunIdentityDigest
  uxAcceptanceReceipt.routingPolicyDigest = assets.policyDigest
  uxAcceptanceReceipt.slicePolicyDigest = assets.policyDigest
  uxAcceptanceReceipt.candidateSha = uiDispatch.candidateSha
  uxAcceptanceReceipt.candidateDigest = uiDispatch.candidateDigest

  return {
    classificationReceipt,
    adjudicationClassificationReceipt,
    adjudicationReceipt: sealReceipt(adjudicationReceipt, 'adjudicationDigest'),
    uiDispatch,
    uxAcceptanceReceipt: sealReceipt(uxAcceptanceReceipt, 'receiptDigest'),
    stageGates: templates.stageGates,
  }
}

export const resolveUiImplementationRoute = (
  policy,
  classification,
  workShape,
) => {
  if (classification === 'system-design-dispute') {
    return 'stop-and-adjudicate'
  }
  if (policy.resliceWorkShapes.includes(workShape)) return 'reslice-required'
  return policy.uiDecisionRoutes[classification]
}

export const validateUiDispatchContract = (
  dispatch,
  classification,
  policy,
) => {
  if (
    dispatch.stageRole !== 'ui-ux-implementer' ||
    dispatch.domain !== 'ui-ux'
  ) {
    fail('ui-owner-role')
  }
  if (
    !Array.isArray(dispatch.implementationOwners) ||
    dispatch.implementationOwners.length !== 1 ||
    dispatch.implementationOwners[0] !== 'ui-ux-implementer'
  ) {
    fail('ui-owner-count')
  }
  if (dispatch.scopeClass !== 'coherent-slice') fail('ui-slice-scope')
  for (const field of [
    'singleObjective',
    'firstRequiredAction',
    'firstWritablePath',
    'completionPredicate',
    'continuationPredicate',
  ]) {
    if (typeof dispatch[field] !== 'string' || !dispatch[field].trim()) {
      fail('ui-prompt-incomplete')
    }
  }
  for (const field of [
    'firstReadTargets',
    'stateViewportSubset',
    'requiredImplementationFiles',
    'requiredFocusedCommands',
    'requiredRenderEvidence',
    'explicitNonGoals',
  ]) {
    if (!Array.isArray(dispatch[field]) || dispatch[field].length === 0) {
      fail('ui-prompt-incomplete')
    }
  }
  if (dispatch.uiDecisionClass === 'system-design-dispute') {
    fail('ui-adjudication-required')
  }
  const expectedProfile = resolveUiImplementationRoute(
    policy,
    dispatch.uiDecisionClass,
    dispatch.workShape,
  )
  if (expectedProfile === 'reslice-required') fail('ui-reslice-required')
  if (
    policy.implementationForbiddenProfiles.includes(dispatch.selectedProfile)
  ) {
    fail('ui-profile-forbidden')
  }
  if (dispatch.selectedProfile !== expectedProfile) {
    fail('ui-profile-selection')
  }
  const expectedEffort =
    policy.uiImplementationRuntime.profileEfforts[dispatch.selectedProfile]
  if (
    dispatch.actualModel !== policy.uiImplementationRuntime.actualModel ||
    dispatch.actualEffort !== expectedEffort ||
    typeof dispatch.targetWorktree !== 'string' ||
    !dispatch.targetWorktree.trim() ||
    !SHA.test(dispatch.candidateSha ?? '')
  ) {
    fail('ui-runtime-identity')
  }
  if (dispatch.automaticPromotion !== false) fail('ui-automatic-promotion')
  if (
    dispatch.classificationReceiptDigest !== classification.receiptDigest ||
    dispatch.uiDecisionClass !== classification.uiDecisionClass ||
    dispatch.verificationClass !== classification.verificationClass ||
    dispatch.candidateSha !== classification.candidateSha ||
    dispatch.candidateDigest !== classification.candidateDigest
  ) {
    fail('ui-classification-binding')
  }
  for (const field of policy.requiredDispatchDigestFields) {
    if (!HASH.test(dispatch[field] ?? '')) fail('ui-digest-binding')
  }
  if (
    dispatch.routingPolicyDigest !== classification.routingPolicyDigest ||
    dispatch.slicePolicyDigest !== classification.slicePolicyDigest ||
    dispatch.skillDigest !==
      classification.activeBaselineIdentity.skillDigest ||
    dispatch.authorityDigest !==
      classification.activeBaselineIdentity.authorityDigest ||
    dispatch.baselineDigest !== baselineIdentityDigest(classification)
  ) {
    fail('ui-digest-binding')
  }
  const lease = dispatch.writeLease
  if (
    lease?.ownerRole !== 'ui-ux-implementer' ||
    lease.writeScope !== 'implementation-only' ||
    !sameValues(lease.modifiedPathClasses, ['implementation'])
  ) {
    fail('ui-write-scope')
  }
  const checkpoint = dispatch.checkpoint
  if (
    !checkpoint ||
    checkpoint.status !== 'verified' ||
    !Array.isArray(checkpoint.completedActions) ||
    checkpoint.completedActions.length === 0 ||
    !Array.isArray(checkpoint.commands) ||
    checkpoint.commands.length === 0 ||
    !HASH.test(checkpoint.diffDigest ?? '') ||
    !HASH.test(checkpoint.digest ?? '') ||
    typeof checkpoint.nextRequiredAction !== 'string' ||
    !checkpoint.nextRequiredAction.trim()
  ) {
    fail('ui-checkpoint-evidence')
  }
  if (
    dispatch.stageStatus === 'candidate-green' &&
    dispatch.sliceStatus !== 'slice-terminal'
  ) {
    fail('ui-partial-candidate-green')
  }
  if (!policy.allowedWriterOutcomes.includes(dispatch.outcome)) {
    fail('ui-writer-outcome')
  }
  if (dispatch.consumerWorkaround !== false) fail('ui-consumer-workaround')
  if (Object.values(dispatch.memberIsolation ?? {}).some(Boolean)) {
    fail('ui-member-isolation')
  }
  if (dispatch.recovery?.failureClass !== null) {
    if (
      !policy.outputMissingClasses.includes(dispatch.recovery.failureClass) ||
      !policy.retryBases.includes(dispatch.recovery.retryBasis)
    ) {
      fail('ui-retry-authorization')
    }
  } else if (dispatch.recovery?.retryBasis !== null) {
    fail('ui-retry-authorization')
  }
  return dispatch
}

const validateClassificationReceipt = (receipt, assets, compiled) => {
  assertSchema('classification', receipt, compiled)
  assertReceiptDigest(receipt, 'receiptDigest', 'classification-receipt-digest')
  if (
    !receipt.requiredSkillDigests.includes(
      receipt.activeBaselineIdentity.skillDigest,
    ) ||
    receipt.activeBaselineIdentity.authorityDigest !==
      digestValue(authorityDigests(receipt)) ||
    receipt.routingPolicyDigest !== assets.policyDigest ||
    receipt.slicePolicyDigest !== assets.policyDigest
  ) {
    fail('classification-receipt-binding')
  }
  return receipt
}

const validateAdjudicationReceipt = (
  receipt,
  classification,
  assets,
  compiled,
) => {
  assertSchema('adjudication', receipt, compiled)
  assertReceiptDigest(
    receipt,
    'adjudicationDigest',
    'adjudication-receipt-digest',
  )
  if (
    classification.uiDecisionClass !== 'system-design-dispute' ||
    receipt.classificationReceiptDigest !== classification.receiptDigest ||
    receipt.ownerRepository !== classification.ownerRepository ||
    !sameValues(
      receipt.authoritativeSkillDigests,
      classification.requiredSkillDigests,
    ) ||
    !sameValues(receipt.authorityDigests, authorityDigests(classification)) ||
    receipt.activeBaselineIdentityDigest !==
      baselineIdentityDigest(classification) ||
    receipt.candidateSha !== classification.candidateSha ||
    receipt.candidateDigest !== classification.candidateDigest ||
    receipt.routingPolicyDigest !== assets.policyDigest ||
    receipt.slicePolicyDigest !== assets.policyDigest
  ) {
    fail('adjudication-receipt-binding')
  }
  const expectedEffort = {
    'sol-high': 'high',
    'sol-xhigh': 'xhigh',
  }[receipt.routingProfile]
  if (receipt.actualEffort !== expectedEffort) {
    fail('adjudication-runtime-profile')
  }
  return receipt
}

const validateUxAcceptanceReceipt = (
  receipt,
  classification,
  dispatch,
  assets,
  compiled,
) => {
  assertSchema('uxAcceptance', receipt, compiled)
  assertReceiptDigest(receipt, 'receiptDigest', 'ux-acceptance-receipt-digest')
  const expectedProfile =
    assets.policy.verificationRoutes[receipt.verificationClass]
  const expectedEffort = expectedProfile.replace('sol-', '')
  if (
    receipt.classificationReceiptDigest !== classification.receiptDigest ||
    receipt.dispatchReceiptDigest !== digestValue(dispatch) ||
    receipt.verificationClass !== classification.verificationClass ||
    receipt.routingProfile !== expectedProfile ||
    receipt.actualEffort !== expectedEffort ||
    receipt.verifierRole !== 'ux-acceptance-verifier' ||
    receipt.implementationRunIdentityDigest !==
      dispatch.implementationRunIdentityDigest ||
    receipt.implementationRunIdentityDigest ===
      receipt.verifierRunIdentityDigest ||
    !sameValues(
      receipt.requiredSkillDigests,
      classification.requiredSkillDigests,
    ) ||
    !sameValues(receipt.authorityDigests, authorityDigests(classification)) ||
    receipt.activeBaselineIdentityDigest !==
      baselineIdentityDigest(classification) ||
    receipt.workPlanDigest !== dispatch.workPlanDigest ||
    receipt.slicePlanDigest !== dispatch.sliceDigest ||
    receipt.compiledPromptDigest !== dispatch.compiledPromptDigest ||
    receipt.executionRouteDigest !== dispatch.executionRouteDigest ||
    receipt.routingPolicyDigest !== assets.policyDigest ||
    receipt.slicePolicyDigest !== assets.policyDigest ||
    receipt.candidateSha !== dispatch.candidateSha ||
    receipt.candidateDigest !== dispatch.candidateDigest
  ) {
    fail('ux-acceptance-receipt-binding')
  }
  return receipt
}

export const validateFsusUIContractBundle = async (bundle, assetsInput) => {
  const assets = assetsInput ?? (await loadFsusUIDesignConformanceAssets())
  assertSourceBindings(assets)
  if (
    assets.policy.schema !== 'fsusui-design-conformance.ui-stage-policy.v1' ||
    assets.policy.policyVersion !== 'fsusui-ui-stage.v1'
  ) {
    fail('ui-policy-version')
  }
  assertPolicyContract(assets.policy)
  const compiled = compileSchemas(assets.schemas)
  validateClassificationReceipt(bundle.classificationReceipt, assets, compiled)
  validateClassificationReceipt(
    bundle.adjudicationClassificationReceipt,
    assets,
    compiled,
  )
  validateAdjudicationReceipt(
    bundle.adjudicationReceipt,
    bundle.adjudicationClassificationReceipt,
    assets,
    compiled,
  )
  validateUiDispatchContract(
    bundle.uiDispatch,
    bundle.classificationReceipt,
    assets.policy,
  )
  validateUxAcceptanceReceipt(
    bundle.uxAcceptanceReceipt,
    bundle.classificationReceipt,
    bundle.uiDispatch,
    assets,
    compiled,
  )
  if (
    bundle.stageGates.documentationStarted === true &&
    (bundle.stageGates.behaviorGreen !== true ||
      bundle.stageGates.uxAccepted !== true ||
      bundle.uxAcceptanceReceipt.status !== 'accepted')
  ) {
    fail('documentation-before-ux-accepted')
  }
  return bundle
}

const reseal = (bundle, key, digestField) => {
  bundle[key] = sealReceipt(bundle[key], digestField)
}

export const applyNegativeControl = (bundleInput, id) => {
  const bundle = clone(bundleInput)
  const dispatch = bundle.uiDispatch
  switch (id) {
    case 'N01-ordinary-code-owner-implements-ui':
      dispatch.stageRole = 'code-implementer'
      break
    case 'N02-overlapping-ui-ux-owners':
      dispatch.implementationOwners.push('ux-implementer')
      break
    case 'N03-full-component-system-unsliced':
      dispatch.scopeClass = 'full-component-system'
      break
    case 'N04-prompt-missing-first-action':
      dispatch.firstRequiredAction = ''
      dispatch.firstWritablePath = ''
      dispatch.explicitNonGoals = []
      break
    case 'N05-prescribed-promoted-to-medium':
      dispatch.selectedProfile = 'sol-medium'
      break
    case 'N06-ui-implementer-uses-high':
      dispatch.selectedProfile = 'sol-high'
      break
    case 'N07-output-missing-auto-promotes':
      dispatch.automaticPromotion = true
      dispatch.recovery = {
        failureClass: 'agent-first-action-not-executed',
        retryBasis: 'verified-profile-capability-mismatch',
      }
      break
    case 'N08-long-horizon-not-resliced':
      dispatch.workShape = 'long-horizon-cross-module'
      break
    case 'N09-system-dispute-directly-implemented':
      dispatch.uiDecisionClass = 'system-design-dispute'
      break
    case 'N10-one-writer-mixes-implementation-tests-docs':
      dispatch.writeLease.modifiedPathClasses = [
        'implementation',
        'tests',
        'documentation',
      ]
      break
    case 'N11-implementer-updates-snapshot-fixture':
      dispatch.writeLease.modifiedPathClasses = [
        'implementation',
        'fixture',
        'snapshot',
      ]
      break
    case 'N12-skill-claim-without-digest':
      dispatch.skillDigest = null
      break
    case 'N13-documentation-skips-ux-acceptance':
      bundle.stageGates.uxAccepted = false
      break
    case 'N14-ux-verifier-writes-component':
      bundle.uxAcceptanceReceipt.modifiedPaths = [
        'vue/packages/components/example/src/example.vue',
      ]
      reseal(bundle, 'uxAcceptanceReceipt', 'receiptDigest')
      break
    case 'N15-consumer-private-workaround':
      dispatch.consumerWorkaround = true
      break
    case 'N16-member-inherits-profile-baseline-slice':
      dispatch.memberIsolation.inheritedProfile = true
      dispatch.memberIsolation.inheritedBaseline = true
      dispatch.memberIsolation.inheritedSlice = true
      break
    case 'N17-natural-language-plan-as-checkpoint':
      dispatch.checkpoint.completedActions = []
      dispatch.checkpoint.commands = []
      break
    case 'N18-partial-slice-claims-candidate-green':
      dispatch.sliceStatus = 'slice-continuation-required'
      dispatch.stageStatus = 'candidate-green'
      dispatch.outcome = 'candidate-green'
      break
    default:
      fail('negative-control-unknown', id)
  }
  return bundle
}

export const runFsusUIDesignConformanceCheck = async () => {
  const assets = await loadFsusUIDesignConformanceAssets()
  const bundle = await buildValidFsusUIContractBundle(assets)
  await validateFsusUIContractBundle(bundle, assets)
  for (const control of assets.negativeControls) {
    const mutated = applyNegativeControl(bundle, control.id)
    try {
      await validateFsusUIContractBundle(mutated, assets)
      fail('negative-control-survived', control.id)
    } catch (error) {
      if (error?.code !== control.expectedCode) throw error
    }
  }
  return {
    negativeControls: assets.negativeControls.length,
    policyDigest: assets.policyDigest,
    receipts: 3,
  }
}

const isMain =
  process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url

if (isMain) {
  runFsusUIDesignConformanceCheck()
    .then((summary) => {
      console.log(
        `[fsusui-design-conformance] receipts=${summary.receipts} negative-controls=${summary.negativeControls} policy=${summary.policyDigest}`,
      )
    })
    .catch((error) => {
      console.error(
        `[fsusui-design-conformance] ${error?.code ?? 'error'}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
      process.exitCode = 1
    })
}
