import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { auditComponents } from '../../packages/demo-app/src/ui-audit-manifest'
import {
  fitVisualAuditBucketCount,
  partitionVisualAuditComponents,
} from '../../../scripts/visual-audit-buckets.mjs'
import { buildVisualUrl } from '../../../scripts/visual-variant.mjs'
import { attachPageDiagnostics } from '../support/page-diagnostics'

const fixtureComponentNames = ['ElButton', 'ElInput', 'ElLink', 'ElSectionNav']
const fixtureComponents = auditComponents.filter((component) =>
  fixtureComponentNames.includes(component.name),
)
if (fixtureComponents.length !== fixtureComponentNames.length) {
  throw new Error(
    'UI audit retry fixture components must exist in the manifest',
  )
}

const serializedCapacityPlan = process.env.FSUS_VISUAL_CAPACITY_PLAN
if (!serializedCapacityPlan) {
  throw new Error(
    'FSUS_VISUAL_CAPACITY_PLAN must be prepared for the retry contract',
  )
}
const capacityPlan = JSON.parse(serializedCapacityPlan) as {
  auditBucketCount?: unknown
}
const desiredBucketCount = Number(capacityPlan.auditBucketCount)
if (!Number.isSafeInteger(desiredBucketCount) || desiredBucketCount < 1) {
  throw new Error('retry contract requires a valid capacity auditBucketCount')
}

const bucketCount = fitVisualAuditBucketCount({
  componentCount: fixtureComponents.length,
  desiredBucketCount,
  minComponentsPerBucket: 2,
  maxComponentsPerBucket: 2,
})
const buckets = partitionVisualAuditComponents(
  fixtureComponents.map((component) => component.name),
  bucketCount,
)
const componentByName = new Map(
  fixtureComponents.map((component) => [component.name, component]),
)
const diagnostics = new WeakMap<Page, string[]>()

test.beforeEach(async ({ page }) => {
  diagnostics.set(page, attachPageDiagnostics(page))
  await page.emulateMedia({ reducedMotion: 'reduce' })
})

test.afterEach(async ({ page }) => {
  expect(diagnostics.get(page) ?? []).toEqual([])
})

for (const bucket of buckets) {
  test(`ui audit retry contract / ${bucket.label}`, async ({
    page,
  }, testInfo) => {
    await page.goto(
      buildVisualUrl('ui-states', 'desktop-light', {
        audit: 'ui-states',
        state: 'focus',
      }),
      { waitUntil: 'domcontentloaded' },
    )
    await expect(page.locator('[data-audit-ready="true"]')).toHaveAttribute(
      'data-audit-state',
      'focus',
    )

    for (const componentName of bucket.components) {
      const component = componentByName.get(componentName)
      expect(component).toBeDefined()
      if (!component) continue
      const card = page.locator(component.locator)
      const focusTarget = page.locator(component.focusLocator).first()
      await expect(card).toBeVisible()
      await expect(focusTarget).toBeVisible()
      await focusTarget.focus()
      await expect(focusTarget).toBeFocused()
    }

    // Deliberately keep both first attempts alive long enough for the reporter
    // to prove that the adaptive bucket tests occupied separate workers.
    await page.waitForTimeout(500)

    if (bucket.number === 1 && testInfo.retry === 0) {
      expect(testInfo.retry, 'intentional first-attempt bucket failure').toBe(1)
    }
  })
}
