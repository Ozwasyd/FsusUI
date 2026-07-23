import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { attachPageDiagnostics } from '../support/page-diagnostics'
import {
  buildVisualUrl,
  resolveVisualVariant,
} from '../../../scripts/visual-variant.mjs'

const diagnostics = new WeakMap<Page, string[]>()

const stabilizePage = async (page: Page) => {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        transition-duration: 0s !important;
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        scroll-behavior: auto !important;
      }
    `,
  })
}

test.beforeEach(async ({ page }) => {
  diagnostics.set(page, attachPageDiagnostics(page))
  await page.emulateMedia({ reducedMotion: 'reduce' })
})

test.afterEach(async ({ page }) => {
  expect(diagnostics.get(page) ?? []).toEqual([])
})

test('issue primitives render in the demo route', async ({
  page,
}, testInfo) => {
  const {
    compact: isCompact,
    theme,
    viewportClass: viewport,
  } = resolveVisualVariant(testInfo.project.name)

  await page.goto(buildVisualUrl('issue-primitives', testInfo.project.name), {
    waitUntil: 'domcontentloaded',
  })
  await stabilizePage(page)

  await expect(page.locator('.el-public-shell')).toBeVisible()
  await expect(page.locator('.issue-primitives')).toBeVisible()
  await expect(
    page.locator('.issue-primitives__site-header-fixtures'),
  ).toBeVisible()
  await expect(
    page.locator('.issue-primitives__site-header-fixtures .el-site-header'),
  ).toHaveCount(3)
  const taskPageHeaderDemo = page.locator(
    '.issue-primitives__task-page-header-demo',
  )
  await expect(taskPageHeaderDemo).toBeVisible()
  await expect(
    taskPageHeaderDemo.locator(
      '.issue-primitives__task-page-header-comparison',
    ),
  ).toHaveCount(5)
  const taskPageHeaders = taskPageHeaderDemo.locator('.el-task-page-header')
  await expect(taskPageHeaders).toHaveCount(5)
  await expect(taskPageHeaders.first()).toHaveClass(
    new RegExp(`el-task-page-header--${isCompact ? 'compact' : 'default'}`),
  )
  await expect(
    taskPageHeaders.first().locator('.el-task-page-header__title'),
  ).toHaveCSS('font-size', '24px')
  await expect(
    taskPageHeaders.first().locator('.el-task-page-header__description'),
  ).toHaveCSS('font-size', '14px')
  await expect(
    taskPageHeaders.last().locator('.el-task-page-header__description'),
  ).toHaveCount(0)
  const firstTaskPageHeaderAction = taskPageHeaders
    .first()
    .locator('.el-task-page-header__actions button')
  await expect(firstTaskPageHeaderAction).toBeVisible()
  await firstTaskPageHeaderAction.focus()
  await expect(firstTaskPageHeaderAction).toBeFocused()
  const taskHeaderSourceOrder = await taskPageHeaders
    .first()
    .evaluate((node) =>
      Array.from(node.children).map((child) => child.className),
    )
  expect(taskHeaderSourceOrder).toEqual([
    'el-task-page-header__heading',
    'el-task-page-header__actions',
  ])
  if (isCompact) {
    const headingBox = await taskPageHeaders
      .first()
      .locator('.el-task-page-header__heading')
      .boundingBox()
    const actionsBox = await taskPageHeaders
      .first()
      .locator('.el-task-page-header__actions')
      .boundingBox()
    expect(actionsBox?.y ?? 0).toBeGreaterThan(
      (headingBox?.y ?? 0) + (headingBox?.height ?? 0) - 1,
    )
  }
  await testInfo.attach(`task-page-header-${theme}-${viewport}`, {
    body: await taskPageHeaderDemo.screenshot({ animations: 'disabled' }),
    contentType: 'image/png',
  })
  const inlineEmptyStates = page.locator('.el-empty-state--inline')
  await expect(inlineEmptyStates).toHaveCount(2)
  await expect(inlineEmptyStates.first()).toBeVisible()
  await expect(inlineEmptyStates.last()).toBeVisible()
  await expect(page.locator('.el-empty-state--compact')).toBeVisible()
  await expect(page.locator('.el-empty-state--page')).toBeVisible()
  await expect(page.locator('.el-empty-state__illustration')).toHaveCount(1)
  await expect(page.locator('.el-collection-toolbar')).toBeVisible()
  await expect(page.locator('.el-filter-group')).toBeVisible()
  await expect(page.locator('.el-segmented-control')).toBeVisible()
  await expect(page.locator('.el-collection-summary')).toBeVisible()
  await expect(page.locator('.el-pagination-bar')).toBeVisible()
  await expect(page.locator('.el-section-nav')).toBeVisible()
  await expect(page.locator('.el-settings-section')).toHaveCount(2)
  await expect(page.locator('.el-section-header')).toBeVisible()
  await expect(page.locator('.el-form-section')).toBeVisible()
  await expect(page.locator('.el-resource-list')).toBeVisible()
  await expect(page.locator('.el-resource-list-item')).toHaveCount(2)
  await expect(page.locator('.el-metadata-row')).toBeVisible()
  await expect(page.locator('.el-inline-actions')).toBeVisible()
  await expect(page.locator('.el-danger-zone')).toBeVisible()
  await expect(page.locator('.el-destructive-action-panel')).toBeVisible()
  await expect(page.locator('.el-risk-notice')).toBeVisible()
  await expect(page.locator('.el-typed-confirm-field')).toBeVisible()

  const settingsDemo = page.locator('.issue-primitives__settings-demo')
  const legacyTypography = await page.addStyleTag({
    content: `
      .el-section-nav__link,
      .el-settings-section__description,
      .el-form-section__description,
      .el-section-header__description,
      .el-danger-zone__description,
      .el-typed-confirm-field__label {
        font-size: 13px !important;
      }
      .el-danger-zone__title {
        font-size: 15px !important;
      }
    `,
  })
  await testInfo.attach(`settings-typography-before-${theme}-${viewport}`, {
    body: await settingsDemo.screenshot({ animations: 'disabled' }),
    contentType: 'image/png',
  })
  await legacyTypography.evaluate((style) => style.remove())

  await expect(page.locator('.el-section-nav__link').first()).toHaveCSS(
    'font-size',
    '14px',
  )
  await expect(
    page.locator('.el-settings-section__description').first(),
  ).toHaveCSS('font-size', '14px')
  await expect(page.locator('.el-section-header__description')).toHaveCSS(
    'font-size',
    '14px',
  )
  await expect(page.locator('.el-settings-section__title').first()).toHaveCSS(
    'font-size',
    '16px',
  )
  await expect(page.locator('.el-resource-list-item__title').first()).toHaveCSS(
    'font-size',
    '14px',
  )
  await expect(page.locator('.el-resource-list-item__meta').first()).toHaveCSS(
    'font-size',
    '12px',
  )
  await expect(page.locator('.el-danger-zone__title')).toHaveCSS(
    'font-size',
    '16px',
  )
  await expect(page.locator('.el-typed-confirm-field__label')).toHaveCSS(
    'font-size',
    '14px',
  )
  await expect(page.locator('.el-section-nav')).toHaveClass(
    new RegExp(`el-section-nav--${isCompact ? 'compact' : 'default'}`),
  )
  await testInfo.attach(`settings-typography-after-${theme}-${viewport}`, {
    body: await settingsDemo.screenshot({ animations: 'disabled' }),
    contentType: 'image/png',
  })

  await expect(page.locator('.el-metric-list')).toBeVisible()
  await expect(page.locator('.el-metric-item')).toHaveCount(2)
  await expect(page.locator('.el-kpi-group')).toBeVisible()
  await expect(page.locator('.el-key-value-grid')).toBeVisible()
  await expect(page.locator('.el-distribution-list')).toBeVisible()
  await expect(page.locator('.el-distribution-bar-row')).toHaveCount(3)
  await expect(page.locator('.el-status-summary')).toBeVisible()
  await expect(page.locator('.el-diagnostics-list')).toBeVisible()
  await expect(page.locator('.el-diagnostics-item')).toHaveCount(2)
  await expect(page.locator('.el-copyable-detail')).toBeVisible()
  const publicShellHeader = page.locator(
    '.el-site-header[data-public-shell-header]',
  )
  const siteHeaderFixture = page
    .locator('.issue-primitives__site-header-fixtures .el-site-header')
    .first()
  const visibilityClass = isCompact ? 'mobile' : 'desktop'
  const publicShellThemeModeToggle = publicShellHeader.locator(
    `.el-theme-mode-toggle--${visibilityClass}`,
  )
  const siteHeaderFixtureThemeModeToggle = siteHeaderFixture.locator(
    `.el-theme-mode-toggle--${visibilityClass}`,
  )
  await expect(publicShellThemeModeToggle).toHaveCount(1)
  await expect(siteHeaderFixtureThemeModeToggle).toHaveCount(1)
  await expect(siteHeaderFixtureThemeModeToggle).toBeVisible()
  if (isCompact) {
    const mobileNavMenu = publicShellHeader.locator(
      '.el-public-shell__mobile-nav-menu',
    )
    const mobileNavMenuTrigger = mobileNavMenu.locator(
      '.el-public-shell__mobile-nav-menu-trigger',
    )

    await expect(mobileNavMenuTrigger).toBeVisible()
    await expect(mobileNavMenuTrigger).toHaveAttribute('aria-expanded', 'false')
    await expect(publicShellThemeModeToggle).toBeHidden()

    await mobileNavMenuTrigger.click()
    await expect(mobileNavMenu).toHaveAttribute('open', '')
    await expect(mobileNavMenuTrigger).toHaveAttribute('aria-expanded', 'true')
    await expect(publicShellThemeModeToggle).toBeVisible()

    await mobileNavMenuTrigger.click()
    await expect(mobileNavMenu).not.toHaveAttribute('open', '')
    await expect(mobileNavMenuTrigger).toHaveAttribute('aria-expanded', 'false')
    await expect(publicShellThemeModeToggle).toBeHidden()
  } else {
    await expect(publicShellThemeModeToggle).toBeVisible()
  }

  const collection = page.locator('.el-responsive-collection')
  await expect(collection).toBeVisible()
  if (isCompact) {
    await expect(
      collection.locator('.el-responsive-collection__compact'),
    ).toBeVisible()
    await expect(collection.locator('.issue-primitives__card')).toHaveCount(2)
  } else {
    await expect(collection.locator('.issue-primitives__table')).toBeVisible()
    await expect(collection.locator('.issue-primitives__row')).toHaveCount(2)
  }

  const uploadSurface = page.locator('.issue-primitives__upload-surface')
  await expect(uploadSurface).toBeVisible()
  const uploadBox = await uploadSurface.boundingBox()
  expect(uploadBox?.width ?? 0).toBeGreaterThan(isCompact ? 250 : 600)
  expect(uploadBox?.height ?? 0).toBeGreaterThan(isCompact ? 120 : 260)

  const inboxLayout = page.locator('.el-inbox-layout')
  await expect(inboxLayout).toBeVisible()
  if (isCompact) {
    await expect(inboxLayout.locator('.el-conversation-list')).toBeHidden()
  } else {
    await expect(inboxLayout.locator('.el-conversation-list')).toBeVisible()
  }
  await expect(inboxLayout.locator('.el-conversation-list-item')).toHaveCount(2)
  await expect(inboxLayout.locator('.el-thread-panel')).toBeVisible()
  await expect(inboxLayout.locator('.el-message-timeline')).toBeVisible()
  await expect(inboxLayout.locator('.el-message-bubble')).toHaveCount(4)
  await expect(
    inboxLayout.locator('.el-conversation-context-bar'),
  ).toBeVisible()
  await expect(inboxLayout.locator('.el-reply-composer-shell')).toBeVisible()
  await expect(inboxLayout.locator('.el-empty-selection-state')).toBeVisible()
  if (isCompact) {
    await expect(inboxLayout.locator('.el-inbox-empty-state')).toBeHidden()
  } else {
    await expect(inboxLayout.locator('.el-inbox-empty-state')).toBeVisible()
  }

  const horizontalOverflow = await page.evaluate(() => {
    const root = document.documentElement
    return (
      Math.max(root.scrollWidth, document.body.scrollWidth) - root.clientWidth
    )
  })
  expect(horizontalOverflow).toBeLessThanOrEqual(1)
})
