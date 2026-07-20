import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { URL } from 'node:url'

import {
  createVisualAuditBucketPlan,
  createVisualAuditPathNamespace,
  fitVisualAuditBucketCount,
  partitionVisualAuditComponents,
  resolveVisualAuditBucketCount,
} from '../scripts/visual-audit-buckets.ts'

const fixture = JSON.parse(
  readFileSync(
    new URL('./fixtures/visual-audit-buckets/plans.json', import.meta.url),
    'utf8',
  ),
)

const optionsFor = (workerBudget, overrides = {}) => ({
  ...fixture.policy,
  workerBudget,
  ...overrides,
})

test('changes the 120-component plan with the available worker budget', () => {
  for (const scenario of fixture.resources) {
    const plan = createVisualAuditBucketPlan(optionsFor(scenario.workerBudget))
    assert.equal(plan.bucketCount, scenario.expectedBucketCount, scenario.name)
    assert.equal(plan.minimumBucketSize, scenario.expectedBucketSize)
    assert.equal(plan.maximumBucketSize, scenario.expectedBucketSize)
  }
})

test('accounts for selected project count without exceeding size bounds', () => {
  const oneProject = createVisualAuditBucketPlan(
    optionsFor(8, { selectedProjectCount: 1 }),
  )
  const fourProjects = createVisualAuditBucketPlan(optionsFor(8))

  assert.equal(oneProject.bucketCount, 15)
  assert.equal(fourProjects.bucketCount, 4)
  assert.equal(oneProject.totalProjectBuckets, 15)
  assert.equal(fourProjects.totalProjectBuckets, 16)
})

test('fits the shared capacity bucket target to selected component bounds', () => {
  assert.equal(
    fitVisualAuditBucketCount({
      componentCount: 120,
      desiredBucketCount: 8,
      maxComponentsPerBucket: 40,
      minComponentsPerBucket: 8,
    }),
    8,
  )
  assert.equal(
    fitVisualAuditBucketCount({
      componentCount: 5,
      desiredBucketCount: 32,
      maxComponentsPerBucket: 40,
      minComponentsPerBucket: 8,
    }),
    1,
  )
})

test('assigns every component exactly once with no empty bucket', () => {
  const componentIds = Array.from({ length: 120 }, (_, index) => `El${index}`)
  const plan = createVisualAuditBucketPlan({
    ...optionsFor(16),
    componentIds,
  })
  const assigned = plan.buckets.flatMap((bucket) => bucket.components)

  assert.equal(
    plan.buckets.every((bucket) => bucket.components.length > 0),
    true,
  )
  assert.equal(new Set(assigned).size, componentIds.length)
  assert.deepEqual(assigned, componentIds)
})

test('keeps selected components stable and avoids empty buckets', () => {
  const options = {
    componentCount: fixture.selectedComponents.length,
    componentIds: fixture.selectedComponents,
    maxComponentsPerBucket: 40,
    minComponentsPerBucket: 8,
    selectedProjectCount: 1,
    targetWaves: 3,
    workerBudget: 8,
  }

  const first = createVisualAuditBucketPlan(options)
  const second = createVisualAuditBucketPlan(options)

  assert.deepEqual(first, second)
  assert.equal(first.bucketCount, 1)
  assert.deepEqual(first.buckets[0].components, fixture.selectedComponents)
})

test('uses a balanced deterministic partition for uneven component counts', () => {
  const components = ['a', 'b', 'c', 'd', 'e', 'f', 'g']
  const buckets = partitionVisualAuditComponents(components, 3)

  assert.deepEqual(
    buckets.map((bucket) => bucket.components),
    [
      ['a', 'b', 'c'],
      ['d', 'e'],
      ['f', 'g'],
    ],
  )
  assert.deepEqual(
    buckets.map((bucket) => bucket.label),
    ['bucket 1 of 3', 'bucket 2 of 3', 'bucket 3 of 3'],
  )
})

test('returns no buckets for an empty selected component set', () => {
  const plan = createVisualAuditBucketPlan({
    ...optionsFor(4),
    componentCount: 0,
    componentIds: [],
  })

  assert.equal(plan.bucketCount, 0)
  assert.deepEqual(plan.buckets, [])
  assert.equal(plan.totalProjectBuckets, 0)
})

test('creates collision-free path namespaces across projects and states', () => {
  const namespaces = fixture.projects.flatMap((projectName) =>
    ['focus', 'interaction', 'active'].map((stateName) =>
      createVisualAuditPathNamespace({
        componentName: 'ElButton',
        projectName,
        stateName,
        suiteName: 'ui-audit',
      }),
    ),
  )

  assert.equal(new Set(namespaces).size, namespaces.length)
  for (const [index, namespace] of namespaces.entries()) {
    assert.match(namespace, /^suite-ui-audit\/project-/u)
    assert.match(namespace, /\/state-(?:focus|interaction|active)\//u)
    assert.match(namespace, /\/component-ElButton$/u)
    assert.match(
      namespace,
      new RegExp(`project-${fixture.projects[Math.floor(index / 3)]}`),
    )
  }
})

test('encodes unsafe path input without creating extra path segments', () => {
  const namespace = createVisualAuditPathNamespace({
    componentName: '../El Button',
    projectName: 'desktop/light',
    stateName: 'focus',
    suiteName: 'ui audit',
  })

  assert.equal(namespace.split('/').length, 4)
  assert.doesNotMatch(namespace, /\.\.|desktop\/light/u)
})

test('rejects invalid bounds, mismatched counts, and duplicate components', () => {
  assert.throws(
    () =>
      resolveVisualAuditBucketCount(
        optionsFor(2, {
          maxComponentsPerBucket: 8,
          minComponentsPerBucket: 9,
        }),
      ),
    /must not exceed/u,
  )
  assert.throws(
    () =>
      resolveVisualAuditBucketCount({
        componentCount: 11,
        maxComponentsPerBucket: 10,
        minComponentsPerBucket: 6,
        selectedProjectCount: 1,
        targetWaves: 2,
        workerBudget: 1,
      }),
    /cannot satisfy/u,
  )
  assert.throws(
    () =>
      createVisualAuditBucketPlan({
        ...optionsFor(2),
        componentIds: ['ElButton'],
      }),
    /must match/u,
  )
  assert.throws(
    () => partitionVisualAuditComponents(['ElButton', 'ElButton'], 1),
    /duplicates/u,
  )
})

test('stays independent from host capacity, browsers, network, and environment state', () => {
  const source = readFileSync(
    new URL('../scripts/visual-audit-buckets.ts', import.meta.url),
    'utf8',
  )

  assert.doesNotMatch(
    source,
    /visual-capacity|playwright|puppeteer|node:os|process\.env|fetch\(|node:https|node:http/u,
  )
})
