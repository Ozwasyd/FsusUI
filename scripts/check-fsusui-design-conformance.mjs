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
  const ajv = new Ajv({ allErrors: true })
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

const forbiddenPolicyKeys = new Set([
  'roleProfiles',
  'rolePermissions',
  'writeLeaseOrder',
  'readOnlyStages',
  'stageOrder',
  'uiDecisionRoutes',
  'verificationRoutes',
  'uiImplementationRuntime',
  'implementationForbiddenProfiles',
  'resliceWorkShapes',
  'requiredDispatchDigestFields',
  'requiredDispatchIdentityFields',
  'allowedWriterOutcomes',
  'outputMissingClasses',
  'retryBases',
  'routeCells',
  'selectedProfile',
  'routingProfile',
  'actualModel',
  'actualEffort',
])

const assertNoOrchestrationKeys = (value, path = 'policy') => {
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      assertNoOrchestrationKeys(item, `${path}[${index}]`),
    )
    return
  }
  if (!value || typeof value !== 'object') return
  for (const [key, child] of Object.entries(value)) {
    if (forbiddenPolicyKeys.has(key)) {
      fail('ui-orchestration-authority-leak', `${path}.${key}`)
    }
    assertNoOrchestrationKeys(child, `${path}.${key}`)
  }
}

const assertPolicyContract = (policy) => {
  if (
    policy.schema !== 'fsusui-design-conformance.ui-stage-policy.v2' ||
    policy.policyVersion !== 'fsusui-ui-domain.v2' ||
    policy.authorityScope !== 'repository-domain-and-acceptance-only' ||
    policy.sharedOrchestrationAuthority !== 'external' ||
    !sameValues(policy.uiDecisionClasses, [
      'prescribed',
      'bounded-composition',
      'layout-judgment',
      'interaction-judgment',
      'system-design-dispute',
    ]) ||
    !sameValues(policy.verificationClasses, [
      'ux-local',
      'ux-path',
      'ux-system',
    ]) ||
    policy.systemDesignDisputeClass !== 'system-design-dispute'
  ) {
    fail('ui-policy-contract')
  }

  if (
    !sameValues(policy.implementationOwnership, {
      allowedPathClass: 'implementation',
      forbiddenPathClasses: [
        'tests',
        'fixtures',
        'snapshots',
        'acceptance-mapping',
        'design-authorities',
        'skill-contracts',
      ],
      acceptanceMayModifyImplementation: false,
      adjudicationMayModifyImplementation: false,
    }) ||
    !sameValues(policy.acceptanceRequirements, {
      requiresRenderedEvidence: true,
      requiresProductionFixture: true,
      acceptedReceiptRequiresZeroBlockers: true,
      independentAcceptanceRequired: true,
    })
  ) {
    fail('ui-domain-ownership-policy')
  }

  assertNoOrchestrationKeys(policy)
}

const assertSourceBindings = (assets) => {
  const normativeText = [
    assets.sources.skill,
    assets.sources.workflow,
    assets.sources.consumer,
  ].join('\n')

  for (const fragment of [
    'fsusui-design-conformance.ui-ux-classification-receipt.v2',
    'fsusui-design-conformance.ui-system-adjudication-receipt.v2',
    'fsusui-design-conformance.ux-acceptance-receipt.v2',
    'shared orchestration authority',
    'domainPolicyDigest',
    'screen reader',
  ]) {
    if (!normativeText.includes(fragment)) {
      fail('ui-source-contract-drift', fragment)
    }
  }

  const forbiddenProfileLiteral =
    /\b(?:luna|terra|sol)-(?:low|medium|high|xhigh|max)\b|gpt-5\.6-(?:sol|terra)/u
  const match = normativeText.match(forbiddenProfileLiteral)
  if (match) {
    fail('ui-source-orchestration-authority-leak', match[0])
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

  const bindClassification = (receipt) => {
    receipt.domainPolicyDigest = assets.policyDigest
    receipt.activeBaselineIdentity.authorityDigest = digestValue(
      receipt.requiredAuthorities.map(({ digest }) => digest),
    )
    return sealReceipt(receipt, 'receiptDigest')
  }

  const classificationReceipt = bindClassification(
    templates.classificationReceipt,
  )
  const adjudicationClassificationReceipt = bindClassification(
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
  adjudicationReceipt.domainPolicyDigest = assets.policyDigest

  const uxAcceptanceReceipt = templates.uxAcceptanceReceipt
  uxAcceptanceReceipt.classificationReceiptDigest =
    classificationReceipt.receiptDigest
  uxAcceptanceReceipt.candidateSha = classificationReceipt.candidateSha
  uxAcceptanceReceipt.candidateDigest = classificationReceipt.candidateDigest
  uxAcceptanceReceipt.verificationClass =
    classificationReceipt.verificationClass
  uxAcceptanceReceipt.requiredSkillDigests =
    classificationReceipt.requiredSkillDigests
  uxAcceptanceReceipt.authorityDigests = authorityDigests(classificationReceipt)
  uxAcceptanceReceipt.activeBaselineIdentityDigest =
    baselineIdentityDigest(classificationReceipt)
  uxAcceptanceReceipt.domainPolicyDigest = assets.policyDigest

  return {
    classificationReceipt,
    adjudicationClassificationReceipt,
    adjudicationReceipt: sealReceipt(
      adjudicationReceipt,
      'adjudicationDigest',
    ),
    uxAcceptanceReceipt: sealReceipt(
      uxAcceptanceReceipt,
      'receiptDigest',
    ),
  }
}

const validateClassificationReceipt = (receipt, assets, compiled) => {
  assertSchema('classification', receipt, compiled)
  assertReceiptDigest(
    receipt,
    'receiptDigest',
    'classification-receipt-digest',
  )
  if (
    !receipt.requiredSkillDigests.includes(
      receipt.activeBaselineIdentity.skillDigest,
    ) ||
    receipt.activeBaselineIdentity.authorityDigest !==
      digestValue(authorityDigests(receipt)) ||
    receipt.domainPolicyDigest !== assets.policyDigest
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
    classification.uiDecisionClass !==
      assets.policy.systemDesignDisputeClass ||
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
    receipt.domainPolicyDigest !== assets.policyDigest
  ) {
    fail('adjudication-receipt-binding')
  }
  return receipt
}

const validateUxAcceptanceReceipt = (
  receipt,
  classification,
  assets,
  compiled,
) => {
  assertSchema('uxAcceptance', receipt, compiled)
  assertReceiptDigest(
    receipt,
    'receiptDigest',
    'ux-acceptance-receipt-digest',
  )
  if (
    receipt.classificationReceiptDigest !== classification.receiptDigest ||
    receipt.verificationClass !== classification.verificationClass ||
    receipt.candidateSha !== classification.candidateSha ||
    receipt.candidateDigest !== classification.candidateDigest ||
    !sameValues(
      receipt.requiredSkillDigests,
      classification.requiredSkillDigests,
    ) ||
    !sameValues(receipt.authorityDigests, authorityDigests(classification)) ||
    receipt.activeBaselineIdentityDigest !==
      baselineIdentityDigest(classification) ||
    receipt.domainPolicyDigest !== assets.policyDigest
  ) {
    fail('ux-acceptance-receipt-binding')
  }
  return receipt
}

export const validateFsusUIContractBundle = async (bundle, assetsInput) => {
  const assets = assetsInput ?? (await loadFsusUIDesignConformanceAssets())
  assertSourceBindings(assets)
  assertPolicyContract(assets.policy)

  const compiled = compileSchemas(assets.schemas)
  validateClassificationReceipt(
    bundle.classificationReceipt,
    assets,
    compiled,
  )
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
  validateUxAcceptanceReceipt(
    bundle.uxAcceptanceReceipt,
    bundle.classificationReceipt,
    assets,
    compiled,
  )
  return bundle
}

const reseal = (bundle, key, digestField) => {
  bundle[key] = sealReceipt(bundle[key], digestField)
}

export const applyNegativeControl = (bundleInput, id) => {
  const bundle = clone(bundleInput)
  switch (id) {
    case 'N01-classification-skill-digest-missing':
      bundle.classificationReceipt.requiredSkillDigests = []
      break
    case 'N02-classification-candidate-drift':
      bundle.classificationReceipt.candidateSha =
        '9999999999999999999999999999999999999999'
      break
    case 'N03-classification-policy-drift':
      bundle.classificationReceipt.domainPolicyDigest =
        '9999999999999999999999999999999999999999999999999999999999999999'
      reseal(bundle, 'classificationReceipt', 'receiptDigest')
      break
    case 'N04-system-dispute-without-matching-adjudication':
      bundle.adjudicationReceipt.classificationReceiptDigest =
        '9999999999999999999999999999999999999999999999999999999999999999'
      reseal(bundle, 'adjudicationReceipt', 'adjudicationDigest')
      break
    case 'N05-adjudication-modifies-component':
      bundle.adjudicationReceipt.modifiedPaths = [
        'vue/packages/components/example/src/example.vue',
      ]
      reseal(bundle, 'adjudicationReceipt', 'adjudicationDigest')
      break
    case 'N06-adjudication-policy-drift':
      bundle.adjudicationReceipt.domainPolicyDigest =
        '9999999999999999999999999999999999999999999999999999999999999999'
      reseal(bundle, 'adjudicationReceipt', 'adjudicationDigest')
      break
    case 'N07-ux-accepted-with-blocker':
      bundle.uxAcceptanceReceipt.blockers = [
        'Focus order violates the frozen UX contract.',
      ]
      reseal(bundle, 'uxAcceptanceReceipt', 'receiptDigest')
      break
    case 'N08-ux-rejected-without-blocker':
      bundle.uxAcceptanceReceipt.status = 'rejected'
      bundle.uxAcceptanceReceipt.blockers = []
      reseal(bundle, 'uxAcceptanceReceipt', 'receiptDigest')
      break
    case 'N09-ux-verification-class-drift':
      bundle.uxAcceptanceReceipt.verificationClass = 'ux-system'
      reseal(bundle, 'uxAcceptanceReceipt', 'receiptDigest')
      break
    case 'N10-ux-candidate-drift':
      bundle.uxAcceptanceReceipt.candidateSha =
        '9999999999999999999999999999999999999999'
      reseal(bundle, 'uxAcceptanceReceipt', 'receiptDigest')
      break
    case 'N11-ux-verifier-writes-component':
      bundle.uxAcceptanceReceipt.modifiedPaths = [
        'vue/packages/components/example/src/example.vue',
      ]
      reseal(bundle, 'uxAcceptanceReceipt', 'receiptDigest')
      break
    case 'N12-ux-policy-drift':
      bundle.uxAcceptanceReceipt.domainPolicyDigest =
        '9999999999999999999999999999999999999999999999999999999999999999'
      reseal(bundle, 'uxAcceptanceReceipt', 'receiptDigest')
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
