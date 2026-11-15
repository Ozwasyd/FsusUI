import { expect, test } from '@playwright/test'
import type { Locator, Page, TestInfo } from '@playwright/test'

interface FocusAudit {
  mutations: number
  outsideFocusTargets: string[]
}

declare global {
  interface Window {
    __fsus999FinishAudit?: () => FocusAudit
  }
}

interface Appearance {
  theme: 'light' | 'dark'
  motion: 'reduce' | 'no-preference'
}

interface Scenario {
  name: string
  position: 'before' | 'between' | 'after'
  count: number
  reverse?: boolean
  desktop?: boolean
}

const appearances: Appearance[] = [
  { theme: 'light', motion: 'no-preference' },
  { theme: 'light', motion: 'reduce' },
  { theme: 'dark', motion: 'no-preference' },
  { theme: 'dark', motion: 'reduce' },
]
const scenarios: Scenario[] = [
  { name: 'stale negative before two', position: 'before', count: 2 },
  { name: 'negative between two', position: 'between', count: 2 },
  { name: 'stale negative after two', position: 'after', count: 2 },
  {
    name: 'initial reverse traversal',
    position: 'before',
    count: 2,
    reverse: true,
  },
  { name: 'zero sequential targets', position: 'before', count: 0 },
  { name: 'one sequential target', position: 'before', count: 1 },
  {
    name: 'desktop true boundaries',
    position: 'before',
    count: 2,
    desktop: true,
  },
]

async function startAudit(dialog: Locator) {
  await dialog.evaluate((container) => {
    let mutations = 0
    const outsideFocusTargets: string[] = []
    const observer = new MutationObserver((records) => {
      mutations += records.length
    })
    observer.observe(container, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['disabled', 'hidden', 'tabindex', 'style', 'class'],
    })
    const recordFocus = (event: FocusEvent) => {
      const target = event.target
      if (target instanceof Element && !container.contains(target)) {
        outsideFocusTargets.push(target.id || target.tagName)
      }
    }
    document.addEventListener('focusin', recordFocus, true)
    window.__fsus999FinishAudit = () => {
      mutations += observer.takeRecords().length
      observer.disconnect()
      document.removeEventListener('focusin', recordFocus, true)
      return { mutations, outsideFocusTargets }
    }
  })
}

async function takeAudit(page: Page, testInfo: TestInfo) {
  const audit = await page.evaluate(() => {
    const result = window.__fsus999FinishAudit?.()
    delete window.__fsus999FinishAudit
    return result
  })
  if (audit) {
    await testInfo.attach('focus-traversal-audit', {
      body: JSON.stringify(audit, null, 2),
      contentType: 'application/json',
    })
  }
  return audit
}

async function finishAudit(page: Page, testInfo: TestInfo) {
  const audit = await takeAudit(page, testInfo)
  if (!audit) throw new Error('Focus audit was not started')
  expect(
    audit.mutations,
    'focus traversal must not invalidate the cache through DOM mutation',
  ).toBe(0)
  expect(
    audit.outsideFocusTargets,
    'Tab must stay contained without a later focus rescue',
  ).toEqual([])
}

function observeErrors(page: Page) {
  const problems: string[] = []
  page.on('pageerror', (error) => problems.push(error.message))
  page.on('console', (message) => {
    if (
      (message.type() === 'error' || message.type() === 'warning') &&
      !message.location().url.endsWith('/favicon.ico')
    )
      problems.push(message.text())
  })
  return problems
}

async function openDrawer(
  page: Page,
  appearance: Appearance,
  scenario: Scenario,
  nested = false,
) {
  await page.emulateMedia({
    colorScheme: appearance.theme,
    reducedMotion: appearance.motion,
  })
  if (scenario.desktop) await page.setViewportSize({ width: 1280, height: 800 })
  const params = new URLSearchParams({
    case: 'focus-cache',
    theme: appearance.theme,
    position: scenario.position,
    count: String(scenario.count),
    nested: nested ? '1' : '0',
  })
  await page.goto(`/?${params}`)
  await expect(page).toHaveTitle('Dialog focus regression')
  await expect(page.locator('vite-error-overlay')).toHaveCount(0)
  const originalOverflow = await page.evaluate(
    () => getComputedStyle(document.body).overflow,
  )
  const opener = page.locator('#focus-opener')
  await expect(opener).toBeVisible()
  await opener.focus()
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog', {
    name: 'Focus containment',
    exact: true,
  })
  await expect(dialog).toBeVisible()
  await expect(page.getByLabel('Drawer readiness', { exact: true })).toHaveText(
    'Ready',
  )
  const negative = dialog.locator('#programmatic-target')
  await negative.focus()
  await expect(negative).toBeFocused()
  const reduced = await page.evaluate(
    () => matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  expect(reduced).toBe(appearance.motion === 'reduce')
  expect(
    await page
      .locator('html')
      .evaluate((element) => element.classList.contains('dark')),
  ).toBe(appearance.theme === 'dark')
  return { dialog, opener, negative, originalOverflow }
}

async function screenshot(page: Page, testInfo: TestInfo, state: string) {
  const path = testInfo.outputPath(`${state}.png`)
  await page.screenshot({ path, fullPage: true })
  await testInfo.attach(state, { path, contentType: 'image/png' })
}

test.afterEach(async ({ page }, testInfo) => {
  if (!page.isClosed()) await takeAudit(page, testInfo)
})

for (const appearance of appearances) {
  for (const scenario of scenarios) {
    test(`${appearance.theme}-${appearance.motion}: ${scenario.name}`, async ({
      page,
    }, testInfo) => {
      const problems = observeErrors(page)
      const { dialog, opener, negative } = await openDrawer(
        page,
        appearance,
        scenario,
      )
      await screenshot(page, testInfo, 'programmatic-focus')
      await startAudit(dialog)
      const first = dialog.locator('#control-0')
      const last = dialog.locator(`#control-${scenario.count - 1}`)
      if (scenario.count === 0) {
        await page.keyboard.press('Tab')
        await expect(negative).toBeFocused()
        await page.keyboard.press('Shift+Tab')
        await expect(negative).toBeFocused()
      } else if (scenario.reverse) {
        await page.keyboard.press('Shift+Tab')
        await expect(last).toBeFocused()
        await page.keyboard.press('Tab')
        await expect(first).toBeFocused()
      } else {
        await page.keyboard.press('Tab')
        await expect(
          scenario.position === 'between' ? last : first,
        ).toBeFocused()
        await screenshot(page, testInfo, 'cache-primed')
        if (scenario.position === 'between') {
          await page.keyboard.press('Tab')
          await expect(first).toBeFocused()
        }
        await page.keyboard.press('Shift+Tab')
        await expect(last).toBeFocused()
        await page.keyboard.press('Tab')
        await expect(first).toBeFocused()
      }
      await finishAudit(page, testInfo)
      await screenshot(page, testInfo, 'contained-boundary')
      await page.keyboard.press('Escape')
      await expect(dialog).toBeHidden()
      await expect(opener).toBeFocused()
      await screenshot(page, testInfo, 'opener-restored')
      expect(problems).toEqual([])
    })
  }

  test(`${appearance.theme}-${appearance.motion}: nested pause and restoration`, async ({
    page,
  }, testInfo) => {
    const problems = observeErrors(page)
    const { dialog, opener, originalOverflow } = await openDrawer(
      page,
      appearance,
      { name: 'nested', position: 'before', count: 2 },
      true,
    )
    const innerOpener = dialog.getByRole('button', {
      name: 'Open nested drawer',
      exact: true,
    })
    const last = dialog.locator('#control-1')
    await page.keyboard.press('Tab')
    await expect(innerOpener).toBeFocused()
    await page.keyboard.press('Enter')
    const inner = page.getByRole('dialog', {
      name: 'Nested containment',
      exact: true,
    })
    await expect(inner).toBeVisible()
    await expect(
      page.getByLabel('Nested drawer readiness', { exact: true }),
    ).toHaveText('Ready')
    await expect
      .poll(() => page.evaluate(() => getComputedStyle(document.body).overflow))
      .toBe('hidden')
    await inner.locator('#nested-programmatic-target').focus()
    await startAudit(inner)
    await page.keyboard.press('Tab')
    await expect(inner.locator('#nested-control-0')).toBeFocused()
    await page.keyboard.press('Shift+Tab')
    await expect(inner.locator('#nested-control-1')).toBeFocused()
    await finishAudit(page, testInfo)
    await screenshot(page, testInfo, 'nested-contained-boundary')
    await page.keyboard.press('Escape')
    await expect(inner).toBeHidden()
    await expect(dialog).toBeVisible()
    await expect(innerOpener).toBeFocused()
    await expect
      .poll(() => page.evaluate(() => getComputedStyle(document.body).overflow))
      .toBe('hidden')
    await startAudit(dialog)
    await page.keyboard.press('Shift+Tab')
    await expect(last).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(innerOpener).toBeFocused()
    await finishAudit(page, testInfo)
    await screenshot(page, testInfo, 'parent-resumed')
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(opener).toBeFocused()
    await expect
      .poll(() => page.evaluate(() => getComputedStyle(document.body).overflow))
      .toBe(originalOverflow)
    expect(problems).toEqual([])
  })
}
