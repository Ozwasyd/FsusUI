import { expect, test } from '@playwright/test'
import * as fs from 'fs'
import type { Page, TestInfo } from '@playwright/test'
import {
  auditComponents,
  auditStateNames,
} from '../../packages/demo-app/src/ui-audit-manifest'
import {
  createVisualAuditPathNamespace,
  fitVisualAuditBucketCount,
  partitionVisualAuditComponents,
} from '../../../scripts/visual-audit-buckets.mjs'
import { attachPageDiagnostics } from '../support/page-diagnostics'
import { buildVisualUrl } from '../../../scripts/visual-variant.mjs'

const diagnostics = new WeakMap<Page, string[]>()
const requestedComponentNames = new Set(
  (process.env.FSUS_UI_AUDIT_COMPONENTS ?? '')
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean),
)
const selectedAuditComponents =
  requestedComponentNames.size === 0
    ? auditComponents
    : auditComponents.filter((component) =>
        requestedComponentNames.has(component.name),
      )
if (
  requestedComponentNames.size > 0 &&
  selectedAuditComponents.length !== requestedComponentNames.size
) {
  const selectedNames = new Set<string>(
    selectedAuditComponents.map((component) => component.name),
  )
  const unknownNames = [...requestedComponentNames].filter(
    (name) => !selectedNames.has(name),
  )
  throw new Error(`Unknown UI audit components: ${unknownNames.join(', ')}`)
}
const positiveIntegerEnv = (name: string, fallback: number) => {
  const value = process.env[name]
  if (value === undefined || value.trim() === '') return fallback
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive integer`)
  }
  return parsed
}

// Capacity is resolved once by the shared #229 plan. Optional audit overrides
// can narrow the retry unit, but never probe or derive host resources here.
const serializedCapacityPlan = process.env.FSUS_VISUAL_CAPACITY_PLAN
if (!serializedCapacityPlan) {
  throw new Error('FSUS_VISUAL_CAPACITY_PLAN must be prepared before UI audit')
}
const capacityPlan = JSON.parse(serializedCapacityPlan) as {
  auditBucketCount?: unknown
}
const serializedBucketCount = Number(capacityPlan.auditBucketCount)
if (!Number.isSafeInteger(serializedBucketCount) || serializedBucketCount < 1) {
  throw new Error(
    'FSUS_VISUAL_CAPACITY_PLAN.auditBucketCount must be a positive integer',
  )
}
const capacityBucketCount = serializedBucketCount
const desiredBucketCount = positiveIntegerEnv(
  'FSUS_VISUAL_AUDIT_BUCKETS',
  capacityBucketCount,
)
const minComponentsPerBucket = positiveIntegerEnv(
  'FSUS_VISUAL_AUDIT_MIN_BUCKET_SIZE',
  8,
)
const maxComponentsPerBucket = positiveIntegerEnv(
  'FSUS_VISUAL_AUDIT_MAX_BUCKET_SIZE',
  40,
)
const visualAuditBucketCount = fitVisualAuditBucketCount({
  componentCount: selectedAuditComponents.length,
  desiredBucketCount,
  maxComponentsPerBucket,
  minComponentsPerBucket,
})
const visualAuditBuckets = partitionVisualAuditComponents(
  selectedAuditComponents.map((component) => component.name),
  visualAuditBucketCount,
)
const auditComponentByName = new Map(
  selectedAuditComponents.map((component) => [component.name, component]),
)
const visualAuditBaseBudgetMs = 45_000
const visualAuditComponentActionBudgetMs = 10_000

const stabilizePage = async (page: Page) => {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        transition-duration: 0s !important;
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        scroll-behavior: auto !important;
      }
      .el-overlay,
      .el-overlay-dialog {
        animation: none !important;
      }
    `,
  })
}

const buildAuditUrl = (state: string, projectName: string) => {
  return buildVisualUrl('ui-states', projectName, {
    audit: 'ui-states',
    state,
  })
}

const screenshotPath = (
  testInfo: TestInfo,
  componentName: string,
  stateName: string,
) =>
  testInfo.outputPath(
    'screenshots',
    'ui-audit',
    testInfo.project.name,
    componentName,
    `${createVisualAuditPathNamespace({
      componentName,
      projectName: testInfo.project.name,
      stateName,
      suiteName: 'ui-audit',
    })}.png`,
  )

const countBucketScreenshots = (
  testInfo: TestInfo,
  componentNames: readonly string[],
  stateName: string,
) => {
  let count = 0

  for (const componentName of componentNames) {
    if (fs.existsSync(screenshotPath(testInfo, componentName, stateName))) {
      count += 1
    }
  }

  return count
}

test.beforeEach(async ({ page }) => {
  diagnostics.set(page, attachPageDiagnostics(page))
  await page.emulateMedia({ reducedMotion: 'reduce' })
})

test.afterEach(async ({ page }) => {
  expect(diagnostics.get(page) ?? []).toEqual([])
})

test.describe('ui audit buckets', () => {
  for (const state of auditStateNames) {
    for (const bucket of visualAuditBuckets) {
      test(`ui audit / ${state} / ${bucket.label}`, async ({
        page,
      }, testInfo) => {
        test.setTimeout(
          visualAuditBaseBudgetMs +
            bucket.components.length * visualAuditComponentActionBudgetMs,
        )
        testInfo.annotations.push(
          {
            type: 'visual-audit-bucket-count',
            description: String(visualAuditBucketCount),
          },
          {
            type: 'visual-audit-bucket',
            description: `${bucket.label}: ${bucket.components.join(',')}`,
          },
        )

        await page.goto(buildAuditUrl(state, testInfo.project.name), {
          waitUntil: 'domcontentloaded',
        })
        const ready = page.locator('[data-audit-ready="true"]')
        await expect(ready).toHaveAttribute('data-audit-state', state)
        await expect(page.locator('[data-audit-component]')).toHaveCount(
          auditComponents.length,
        )
        await stabilizePage(page)

        for (const componentName of bucket.components) {
          const component = auditComponentByName.get(componentName)
          expect(
            component,
            `${componentName} must exist in audit manifest`,
          ).toBeDefined()
          if (!component) continue
          const componentCard = page.locator(component.locator)
          await expect(componentCard).toBeVisible()

          if (state === 'focus') {
            const focusTarget = page.locator(component.focusLocator).first()
            if (await focusTarget.count()) {
              await focusTarget.focus().catch(() => undefined)
            } else {
              await componentCard.focus().catch(() => undefined)
            }
          }

          if (state === 'interaction') {
            const interactionTarget = page
              .locator(component.interactionLocator)
              .filter({ visible: true })
              .first()
            if (await interactionTarget.count()) {
              await expect(interactionTarget).toBeVisible()
              await interactionTarget.hover({ force: true })
            } else {
              await componentCard.hover({ force: true })
            }
          }

          if (state === 'active') {
            const activeTarget = page.locator(component.activeLocator).first()
            if (await activeTarget.count()) {
              await activeTarget.click({ force: true }).catch(() => undefined)
              await page.waitForTimeout(80)
            }
          }

          const targetPath = screenshotPath(testInfo, component.name, state)
          await componentCard.screenshot({ path: targetPath })
          await page.keyboard.press('Escape').catch(() => undefined)
        }

        expect(countBucketScreenshots(testInfo, bucket.components, state)).toBe(
          bucket.components.length,
        )
      })
    }
  }
})
