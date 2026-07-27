import { expect, test } from '@playwright/test'
import * as fs from 'node:fs'
import * as path from 'node:path'
import type { Locator, Page } from '@playwright/test'
import {
  assertControlsInsideSafeRect,
  assertDirectionalDrawerSafeInsets,
  assertNoBodyOverflowLeak,
  assertOverlayActionsReachable,
  assertScrimCoversViewport,
  assertScrollLockAndFocusRestored,
  waitForStableLayout,
} from '../support/dom-layout-assertions'
import { attachPageDiagnostics } from '../support/page-diagnostics'
import {
  applySafeAreaProfile,
  getSafeAreaProfile,
  resolveSafeAreaMatrixMode,
  selectSafeAreaMatrix,
  type SafeAreaProfile,
  type SafeAreaProfileId,
} from '../support/safe-area-profile'

const diagnostics = new WeakMap<Page, string[]>()
const matrixMode = resolveSafeAreaMatrixMode()
const matrixEntries = selectSafeAreaMatrix(matrixMode)
const reportRoot = path.join(
  process.cwd(),
  'screenshots',
  'ui-boundary-audit',
  '_review',
)
const reportPath = path.join(reportRoot, 'safe-area-matrix-report.json')

type MatrixResult = {
  browser: string
  component: string
  ok: boolean
  profileId: SafeAreaProfileId
  project: string
}

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
      .el-overlay-dialog,
      .viewer-fade-enter-active,
      .viewer-fade-leave-active {
        animation: none !important;
        transition: none !important;
      }
    `,
  })
}

const buildSafeAreaAuditUrl = () => {
  const params = new URLSearchParams({
    audit: 'ui-boundaries',
    state: 'focus',
    theme: 'light',
  })
  return `/?${params.toString()}`
}

const openSurface = async (page: Page, component: string) => {
  const open = page.locator(`[data-safe-area-open="${component}"]`)
  await expect(open).toBeVisible()
  await open.click()
  await waitForStableLayout(page)
}

const closeSurface = async (page: Page, component: string) => {
  if (page.isClosed()) return

  if (component === 'message-box') {
    const cancel = page.locator('.el-message-box__btns button').first()
    if (await cancel.count()) {
      await cancel.click({ force: true }).catch(() => undefined)
    }
    await page.keyboard.press('Escape').catch(() => undefined)
  } else if (component === 'image-viewer') {
    const close = page.locator('.el-image-viewer__close')
    if (await close.count()) {
      await close.click({ force: true }).catch(() => undefined)
    }
    await page.keyboard.press('Escape').catch(() => undefined)
  } else if (component === 'overlay') {
    const close = page.locator('[data-safe-area-action="overlay-close"]')
    if (await close.count()) {
      await close.click({ force: true }).catch(() => undefined)
    } else {
      await page.keyboard.press('Escape').catch(() => undefined)
    }
  } else {
    await page.keyboard.press('Escape').catch(() => undefined)
  }

  await page
    .waitForFunction(
      () => {
        const nodes = Array.from(
          document.querySelectorAll<HTMLElement>(
            'body > .el-overlay, .el-image-viewer__wrapper, .el-overlay.is-message-box',
          ),
        )
        return nodes.every((element) => {
          const style = getComputedStyle(element)
          return (
            style.display === 'none' ||
            style.visibility === 'hidden' ||
            Number(style.opacity) === 0 ||
            element.getBoundingClientRect().width <= 0
          )
        })
      },
      undefined,
      { timeout: 3_000 },
    )
    .catch(() => undefined)

  if (!page.isClosed()) {
    await waitForStableLayout(page).catch(() => undefined)
  }
}

const visible = (locator: Locator) => locator.filter({ visible: true })

const surfaceRoot = (page: Page, component: string): Locator => {
  switch (component) {
    case 'overlay':
      return visible(
        page.locator('.el-overlay').filter({
          has: page.locator('[data-safe-area-action="overlay-close"]'),
        }),
      ).last()
    case 'dialog':
    case 'dialog-fullscreen':
      return visible(
        page.locator('.el-overlay').filter({ has: page.locator('.el-dialog') }),
      ).last()
    case 'message-box':
      return visible(page.locator('.el-overlay.is-message-box')).last()
    case 'drawer-ltr':
    case 'drawer-rtl':
    case 'drawer-ttb':
    case 'drawer-btt': {
      const direction = component.replace('drawer-', '')
      return visible(
        page.locator('.el-overlay').filter({
          has: page.locator(`.el-drawer.${direction}`),
        }),
      ).last()
    }
    case 'image-viewer':
      return visible(page.locator('.el-image-viewer__wrapper')).last()
    default:
      throw new Error(`Unknown safe-area surface: ${component}`)
  }
}

const surfaceScrim = (page: Page, component: string): Locator => {
  if (component === 'image-viewer') {
    return visible(page.locator('.el-image-viewer__wrapper')).last()
  }
  // Scrim is the visible overlay root for the open surface.
  return surfaceRoot(page, component)
}

const surfaceActions = (page: Page, component: string): Locator[] => {
  switch (component) {
    case 'overlay':
      return [visible(page.locator('[data-safe-area-action="overlay-close"]'))]
    case 'dialog':
    case 'dialog-fullscreen':
      return [
        visible(page.locator('.el-dialog__headerbtn')).last(),
        visible(page.locator('[data-safe-area-action="dialog-cancel"]')).last(),
        visible(page.locator('[data-safe-area-action="dialog-confirm"]')).last(),
      ]
    case 'message-box':
      return [
        visible(page.locator('.el-message-box__headerbtn')).last(),
        visible(page.locator('.el-message-box__btns button')).nth(0),
        visible(page.locator('.el-message-box__btns button')).nth(1),
      ]
    case 'drawer-ltr':
    case 'drawer-rtl':
    case 'drawer-ttb':
    case 'drawer-btt':
      return [
        visible(page.locator('.el-drawer__close-btn')).last(),
        visible(page.locator('[data-safe-area-action="drawer-cancel"]')).last(),
        visible(page.locator('[data-safe-area-action="drawer-confirm"]')).last(),
      ]
    case 'image-viewer':
      // Primary chrome: close + prev/next. Toolbar action glyphs can be
      // zero-box in some icon font loads; safe-area is still covered by
      // assertControlsInsideSafeRect on the wrapper/close/prev/next set.
      return [
        visible(page.locator('.el-image-viewer__close')),
        visible(page.locator('.el-image-viewer__prev')),
        visible(page.locator('.el-image-viewer__next')),
      ]
    default:
      return []
  }
}

const drawerDirection = (
  component: string,
): 'ltr' | 'rtl' | 'ttb' | 'btt' | null => {
  if (!component.startsWith('drawer-')) return null
  return component.replace('drawer-', '') as 'ltr' | 'rtl' | 'ttb' | 'btt'
}

const runCase = async (
  page: Page,
  component: string,
  profile: SafeAreaProfile,
) => {
  await applySafeAreaProfile(page, profile)
  await openSurface(page, component)
  await waitForStableLayout(page)

  const root = surfaceRoot(page, component)
  const scrim = surfaceScrim(page, component)
  await expect(root).toBeVisible()

  await assertScrimCoversViewport(page, scrim, `${component}/${profile.id} scrim`)
  await assertNoBodyOverflowLeak(page, `${component}/${profile.id}`)

  // Interactive controls live inside the visible surface root.
  const controlRoot =
    component === 'image-viewer'
      ? visible(page.locator('.el-image-viewer__wrapper')).last()
      : component.startsWith('drawer-')
        ? visible(
            page.locator(`.el-drawer.${drawerDirection(component)}`),
          ).last()
        : component === 'message-box'
          ? visible(page.locator('.el-message-box')).last()
          : component === 'overlay'
            ? surfaceRoot(page, component)
            : visible(page.locator('.el-dialog')).last()

  await assertControlsInsideSafeRect(
    page,
    controlRoot,
    profile,
    `${component}/${profile.id}`,
  )

  const direction = drawerDirection(component)
  if (direction) {
    await assertDirectionalDrawerSafeInsets(
      page,
      direction,
      profile,
      `${component}/${profile.id}`,
    )
  }

  const actions = surfaceActions(page, component)
  await assertOverlayActionsReachable(page, actions, {
    label: `${component}/${profile.id} actions`,
    shortVisual: profile.id === 'short-visual',
  })

  await closeSurface(page, component)
  if (!page.isClosed()) {
    await assertScrollLockAndFocusRestored(
      page,
      `${component}/${profile.id} restore`,
    )
  }
}

test.beforeEach(async ({ page }) => {
  diagnostics.set(page, attachPageDiagnostics(page))
  await page.emulateMedia({ reducedMotion: 'reduce' })
})

test.afterEach(async ({ page }) => {
  // WebKit occasionally emits this benign loop warning during overlay open/close.
  const filtered = (diagnostics.get(page) ?? []).filter(
    (entry) =>
      !entry.includes(
        'ResizeObserver loop completed with undelivered notifications',
      ),
  )
  expect(filtered).toEqual([])
})

test('safe-area matrix projects include Chromium and WebKit', async ({ browserName: _browserName }, testInfo) => {
  const projectNames = testInfo.config.projects.map((project) => project.name)
  expect(projectNames).toEqual(
    expect.arrayContaining(['safe-area-chromium', 'safe-area-webkit']),
  )
  expect(
    testInfo.project.name === 'safe-area-chromium' ||
      testInfo.project.name === 'safe-area-webkit',
  ).toBe(true)
})

test.describe(`safe-area overlay matrix (${matrixMode})`, () => {
  test(`runs ${matrixEntries.length} required cases with geometry assertions`, async ({
    page,
    browserName,
  }, testInfo) => {
    test.setTimeout(Math.max(180_000, matrixEntries.length * 12_000))

    await page.goto(buildSafeAreaAuditUrl(), { waitUntil: 'domcontentloaded' })
    await expect(page.locator('[data-audit-ready="true"]')).toBeVisible()
    await expect(page.locator('[data-safe-area-lab]')).toBeVisible()
    await stabilizePage(page)

    const results: MatrixResult[] = []

    for (const entry of matrixEntries) {
      const profile = getSafeAreaProfile(entry.profileId) as SafeAreaProfile
      let ok = false
      try {
        await runCase(page, entry.component, profile)
        ok = true
      } finally {
        results.push({
          browser: browserName,
          component: entry.component,
          ok,
          profileId: entry.profileId,
          project: testInfo.project.name,
        })
        // Always attempt cleanup so the next case starts closed.
        await closeSurface(page, entry.component).catch(() => undefined)
      }
      expect(
        ok,
        `${entry.component} @ ${entry.profileId} on ${testInfo.project.name}`,
      ).toBe(true)
    }

    fs.mkdirSync(reportRoot, { recursive: true })
    const existing = fs.existsSync(reportPath)
      ? (JSON.parse(fs.readFileSync(reportPath, 'utf8')) as {
          results?: MatrixResult[]
        })
      : { results: [] }
    const merged = [
      ...(existing.results ?? []).filter(
        (item) => item.project !== testInfo.project.name,
      ),
      ...results,
    ]
    fs.writeFileSync(
      reportPath,
      `${JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          mode: matrixMode,
          note:
            'Automatic geometry assertions over #260 CSS variable overrides. Real Safari browser chrome still requires device release evidence.',
          results: merged,
        },
        null,
        2,
      )}\n`,
    )

    expect(results.every((item) => item.ok)).toBe(true)
    expect(results).toHaveLength(matrixEntries.length)
  })
})
