import { expect, test } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'
import type { Page } from '@playwright/test'
import {
  auditComponents,
  auditStateNames,
} from '../../packages/demo-app/src/ui-audit-manifest'
import { resolveVisualAuditBucketCount } from '../../../scripts/test-parallelism'
import { attachPageDiagnostics } from '../support/page-diagnostics'

type VisualVariant = {
  compact: boolean
  theme: 'dark' | 'light'
}

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
  const selectedNames = new Set(
    selectedAuditComponents.map((component) => component.name),
  )
  const unknownNames = [...requestedComponentNames].filter(
    (name) => !selectedNames.has(name),
  )
  throw new Error(`Unknown UI audit components: ${unknownNames.join(', ')}`)
}
const expectedScreenshotsPerProject =
  selectedAuditComponents.length * auditStateNames.length
// #230 owns bucket partitioning. This is the single plan-backed read entry it
// will consume instead of deriving capacity again inside the audit suite.
const visualAuditBucketCount = resolveVisualAuditBucketCount()

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

const getVisualVariant = (projectName: string): VisualVariant => {
  switch (projectName) {
    case 'desktop-dark':
      return { theme: 'dark', compact: false }
    case 'mobile-dark':
      return { theme: 'dark', compact: true }
    case 'mobile-light':
      return { theme: 'light', compact: true }
    default:
      return { theme: 'light', compact: false }
  }
}

const buildAuditUrl = (state: string, projectName: string) => {
  const variant = getVisualVariant(projectName)
  const params = new URLSearchParams({
    audit: 'ui-states',
    state,
    theme: variant.theme,
  })

  if (variant.compact) params.set('compact', '1')

  return `/?${params.toString()}`
}

const screenshotPath = (
  componentName: string,
  projectName: string,
  stateName: string,
) =>
  path.join(
    process.cwd(),
    'screenshots',
    'ui-audit',
    componentName,
    projectName,
    `${stateName}.png`,
  )

const countProjectScreenshots = (projectName: string) => {
  let count = 0

  for (const component of selectedAuditComponents) {
    for (const state of auditStateNames) {
      if (fs.existsSync(screenshotPath(component.name, projectName, state))) {
        count += 1
      }
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

test('captures the registered component state matrix', async ({
  page,
}, testInfo) => {
  test.setTimeout(360_000)
  testInfo.annotations.push({
    type: 'visual-audit-bucket-count',
    description: String(visualAuditBucketCount),
  })

  for (const state of auditStateNames) {
    await page.goto(buildAuditUrl(state, testInfo.project.name), {
      waitUntil: 'networkidle',
    })
    await stabilizePage(page)

    await expect(page.locator('[data-audit-component]')).toHaveCount(
      auditComponents.length,
    )

    for (const component of selectedAuditComponents) {
      const componentCard = page.locator(component.locator)
      await expect(componentCard).toBeVisible()

      if (state === 'focus') {
        const focusTarget = page.locator(component.focusLocator).first()
        if (await focusTarget.count()) {
          await focusTarget.focus({ timeout: 1000 }).catch(() => undefined)
        } else {
          await componentCard.focus({ timeout: 1000 }).catch(() => undefined)
        }
      }

      if (state === 'interaction') {
        const interactionTarget = page
          .locator(component.interactionLocator)
          .filter({ visible: true })
          .first()
        if (await interactionTarget.count()) {
          await interactionTarget.hover({ force: true, timeout: 1000 })
        } else {
          await componentCard.hover({ force: true, timeout: 1000 })
        }
      }

      if (state === 'active') {
        const activeTarget = page.locator(component.activeLocator).first()
        if (await activeTarget.count()) {
          await activeTarget
            .click({ force: true, timeout: 1500 })
            .catch(() => undefined)
          await page.waitForTimeout(80)
        }
      }

      const targetPath = screenshotPath(
        component.name,
        testInfo.project.name,
        state,
      )
      fs.mkdirSync(path.dirname(targetPath), { recursive: true })
      await componentCard.screenshot({ path: targetPath })
      await page.keyboard.press('Escape').catch(() => undefined)
    }
  }

  expect(countProjectScreenshots(testInfo.project.name)).toBe(
    expectedScreenshotsPerProject,
  )
})
