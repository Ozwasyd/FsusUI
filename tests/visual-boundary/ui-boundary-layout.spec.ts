import { expect, test } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'
import type { Locator, Page } from '@playwright/test'
import {
  auditComponents,
  auditStateNames,
} from '../../packages/demo-app/src/ui-audit-manifest'
import { attachPageDiagnostics } from '../support/page-diagnostics'

type VisualVariant = {
  compact: boolean
  theme: 'dark' | 'light'
}

type BoundaryIssue = {
  component?: string
  detail: string
  kind: string
  project: string
  state: string
}

type BoundaryProjectReport = {
  actualScreenshots: number
  clippingIssues: BoundaryIssue[]
  diagnostics: string[]
  expectedScreenshots: number
  invisibleIssues: BoundaryIssue[]
  missing: string[]
  overflowIssues: BoundaryIssue[]
  project: string
  zeroSizeIssues: BoundaryIssue[]
}

type BoundaryReport = {
  actualScreenshots: number
  clippingIssues: BoundaryIssue[]
  diagnostics: string[]
  expectedScreenshots: number
  generatedAt: string
  invisibleIssues: BoundaryIssue[]
  missing: string[]
  overflowIssues: BoundaryIssue[]
  projects: Record<string, BoundaryProjectReport>
  zeroSizeIssues: BoundaryIssue[]
}

const diagnostics = new WeakMap<Page, string[]>()
const expectedScreenshotsPerProject =
  auditComponents.length * auditStateNames.length
const expectedBoundaryProjectNames = [
  'desktop-light',
  'mobile-light',
  'tiny-light',
  'desktop-dark',
  'mobile-dark',
  'tiny-dark',
] as const
const screenshotRoot = path.join(
  process.cwd(),
  'screenshots',
  'ui-boundary-audit'
)
const reportPath = path.join(screenshotRoot, '_review', 'layout-report.json')

const getVisualVariant = (projectName: string): VisualVariant => {
  switch (projectName) {
    case 'desktop-dark':
      return { theme: 'dark', compact: false }
    case 'mobile-dark':
      return { theme: 'dark', compact: true }
    case 'tiny-dark':
      return { theme: 'dark', compact: true }
    case 'mobile-light':
    case 'tiny-light':
      return { theme: 'light', compact: true }
    default:
      return { theme: 'light', compact: false }
  }
}

const buildBoundaryUrl = (state: string, projectName: string) => {
  const variant = getVisualVariant(projectName)
  const params = new URLSearchParams({
    audit: 'ui-boundaries',
    state,
    theme: variant.theme,
  })

  if (variant.compact) params.set('compact', '1')

  return `/?${params.toString()}`
}

const screenshotPath = (
  componentName: string,
  projectName: string,
  stateName: string
) =>
  path.join(
    screenshotRoot,
    componentName,
    projectName,
    `${stateName}.png`
  )

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

const emptyProjectReport = (project: string): BoundaryProjectReport => ({
  actualScreenshots: 0,
  clippingIssues: [],
  diagnostics: [],
  expectedScreenshots: expectedScreenshotsPerProject,
  invisibleIssues: [],
  missing: [],
  overflowIssues: [],
  project,
  zeroSizeIssues: [],
})

const emptyReport = (): BoundaryReport => ({
  actualScreenshots: 0,
  clippingIssues: [],
  diagnostics: [],
  expectedScreenshots:
    expectedScreenshotsPerProject * expectedBoundaryProjectNames.length,
  generatedAt: new Date().toISOString(),
  invisibleIssues: [],
  missing: [],
  overflowIssues: [],
  projects: {},
  zeroSizeIssues: [],
})

const mergeProjectReport = (projectReport: BoundaryProjectReport) => {
  const report =
    fs.existsSync(reportPath) && projectReport.project !== 'desktop-light'
      ? (JSON.parse(fs.readFileSync(reportPath, 'utf8')) as BoundaryReport)
      : emptyReport()

  report.generatedAt = new Date().toISOString()
  report.projects[projectReport.project] = projectReport

  const projects = Object.values(report.projects)
  report.actualScreenshots = projects.reduce(
    (total, project) => total + project.actualScreenshots,
    0
  )
  report.missing = projects.flatMap((project) => project.missing)
  report.diagnostics = projects.flatMap((project) => project.diagnostics)
  report.overflowIssues = projects.flatMap((project) => project.overflowIssues)
  report.clippingIssues = projects.flatMap((project) => project.clippingIssues)
  report.zeroSizeIssues = projects.flatMap((project) => project.zeroSizeIssues)
  report.invisibleIssues = projects.flatMap((project) => project.invisibleIssues)

  fs.mkdirSync(path.dirname(reportPath), { recursive: true })
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`)
}

const collectPageOverflowIssue = async (
  page: Page,
  project: string,
  state: string
): Promise<BoundaryIssue[]> => {
  const overflow = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }))

  if (overflow.scrollWidth > overflow.clientWidth + 2) {
    return [
      {
        detail: `document scrollWidth ${overflow.scrollWidth} > clientWidth ${overflow.clientWidth}`,
        kind: 'page-horizontal-overflow',
        project,
        state,
      },
    ]
  }

  return []
}

const collectComponentLayoutIssues = async (
  componentCard: Locator,
  component: string,
  project: string,
  state: string
) =>
  componentCard.evaluate(
    (element, args) => {
      const issues: {
        clippingIssues: BoundaryIssue[]
        invisibleIssues: BoundaryIssue[]
        overflowIssues: BoundaryIssue[]
        zeroSizeIssues: BoundaryIssue[]
      } = {
        clippingIssues: [],
        invisibleIssues: [],
        overflowIssues: [],
        zeroSizeIssues: [],
      }
      const rect = element.getBoundingClientRect()
      const cardStyle = window.getComputedStyle(element)
      const component = args.component
      const project = args.project
      const state = args.state

      const add = (
        bucket: keyof typeof issues,
        kind: string,
        detail: string
      ) => {
        issues[bucket].push({ component, detail, kind, project, state })
      }

      if (rect.width <= 0 || rect.height <= 0) {
        add('zeroSizeIssues', 'component-zero-size', `${rect.width}x${rect.height}`)
      }

      if (cardStyle.visibility === 'hidden' || cardStyle.display === 'none') {
        add('invisibleIssues', 'component-invisible', cardStyle.display)
      }

      if (element.scrollWidth > element.clientWidth + 2) {
        add(
          'overflowIssues',
          'component-horizontal-overflow',
          `scrollWidth ${element.scrollWidth} > clientWidth ${element.clientWidth}`
        )
      }

      const floatingSelector = [
        '.el-popper',
        '.el-select__popper',
        '.el-dropdown__popper',
        '.el-cascader__dropdown',
        '.el-picker__popper',
        '.el-tooltip__popper',
        '.el-tooltip-v2__content',
        '.el-popover',
        '.el-overlay',
        '.el-dialog',
        '.el-drawer',
        '.el-image-viewer__wrapper',
      ].join(',')

      for (const floating of Array.from(element.querySelectorAll(floatingSelector))) {
        const floatingElement = floating as HTMLElement
        const style = window.getComputedStyle(floatingElement)
        const box = floatingElement.getBoundingClientRect()
        if (
          style.display === 'none' ||
          style.visibility === 'hidden' ||
          box.width <= 0 ||
          box.height <= 0
        ) {
          continue
        }

        if (
          box.left < -2 ||
          box.top < -2 ||
          box.right > window.innerWidth + 2 ||
          box.bottom > window.innerHeight + 2
        ) {
          add(
            'clippingIssues',
            'floating-viewport-clipping',
            `${box.left},${box.top},${box.right},${box.bottom} outside ${window.innerWidth}x${window.innerHeight}`
          )
        }
      }

      return issues
    },
    { component, project, state }
  )

test.beforeEach(async ({ page }) => {
  diagnostics.set(page, attachPageDiagnostics(page))
  await page.emulateMedia({ reducedMotion: 'reduce' })
})

test('boundary audit projects cover desktop, mobile, and tiny viewports', async (
  { browserName },
  testInfo
) => {
  expect(browserName).toBeTruthy()
  const projectNames = testInfo.config.projects.map((project) => project.name)

  expect(projectNames).toEqual(expect.arrayContaining(expectedBoundaryProjectNames))
})

test('captures manual boundary layout screenshots and report', async ({
  page,
}, testInfo) => {
  test.setTimeout(600_000)

  const projectReport = emptyProjectReport(testInfo.project.name)

  for (const state of auditStateNames) {
    await page.goto(buildBoundaryUrl(state, testInfo.project.name), {
      waitUntil: 'networkidle',
    })
    await stabilizePage(page)

    await expect(page.locator('[data-audit-component]')).toHaveCount(
      auditComponents.length
    )

    projectReport.overflowIssues.push(
      ...(await collectPageOverflowIssue(page, testInfo.project.name, state))
    )

    for (const component of auditComponents) {
      const componentCard = page.locator(component.locator)

      if (!(await componentCard.isVisible())) {
        projectReport.invisibleIssues.push({
          component: component.name,
          detail: 'audit card is not visible',
          kind: 'component-invisible',
          project: testInfo.project.name,
          state,
        })
        continue
      }

      await componentCard.scrollIntoViewIfNeeded()

      if (state === 'focus') {
        const focusTarget = page.locator(component.focusLocator).first()
        if (await focusTarget.count()) {
          await focusTarget.focus({ timeout: 1000 }).catch(() => undefined)
        } else {
          await componentCard.focus({ timeout: 1000 }).catch(() => undefined)
        }
      }

      if (state === 'interaction') {
        const interactionTarget = page.locator(component.interactionLocator).first()
        if (await interactionTarget.count()) {
          await interactionTarget.hover({ force: true, timeout: 1000 })
        } else {
          await componentCard.hover({ force: true, timeout: 1000 })
        }
      }

      if (state === 'active') {
        const activeTarget = page.locator(component.activeLocator).first()
        if (await activeTarget.count()) {
          await activeTarget.click({ force: true, timeout: 1500 }).catch(() => undefined)
          await page.waitForTimeout(80)
        }
      }

      const issues = await collectComponentLayoutIssues(
        componentCard,
        component.name,
        testInfo.project.name,
        state
      )
      projectReport.clippingIssues.push(...issues.clippingIssues)
      projectReport.invisibleIssues.push(...issues.invisibleIssues)
      projectReport.overflowIssues.push(...issues.overflowIssues)
      projectReport.zeroSizeIssues.push(...issues.zeroSizeIssues)

      const targetPath = screenshotPath(
        component.name,
        testInfo.project.name,
        state
      )
      fs.mkdirSync(path.dirname(targetPath), { recursive: true })
      await componentCard.screenshot({ path: targetPath })
      projectReport.actualScreenshots += 1

      await page.keyboard.press('Escape').catch(() => undefined)
    }
  }

  for (const component of auditComponents) {
    for (const state of auditStateNames) {
      const targetPath = screenshotPath(
        component.name,
        testInfo.project.name,
        state
      )
      if (!fs.existsSync(targetPath)) {
        projectReport.missing.push(
          path.relative(screenshotRoot, targetPath)
        )
      }
    }
  }

  projectReport.diagnostics.push(...(diagnostics.get(page) ?? []))
  mergeProjectReport(projectReport)

  expect(projectReport.missing).toEqual([])
  expect(projectReport.diagnostics).toEqual([])
  expect(projectReport.overflowIssues).toEqual([])
  expect(projectReport.clippingIssues).toEqual([])
  expect(projectReport.zeroSizeIssues).toEqual([])
  expect(projectReport.invisibleIssues).toEqual([])
  expect(projectReport.actualScreenshots).toBe(expectedScreenshotsPerProject)
})
