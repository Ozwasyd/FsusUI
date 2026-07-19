import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

const route = '/view-transitions.html'

const expectHealthyPage = async (page: Page) => {
  await expect(page).toHaveTitle(/FsusUI/u)
  await expect(page.locator('#app')).toBeVisible()
  await expect(page.getByTestId('section-view-transitions')).toBeVisible()
  await expect(page.locator('vite-error-overlay')).toHaveCount(0)
}

test('state, route, theme and shared-element updates reach the same terminal DOM', async ({
  page,
  browserName,
}, testInfo) => {
  const diagnostics: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      diagnostics.push(`${message.type()}: ${message.text()}`)
    }
  })
  page.on('pageerror', (error) =>
    diagnostics.push(`pageerror: ${error.message}`),
  )

  await page.goto(route, { waitUntil: 'domcontentloaded' })
  await expectHealthyPage(page)

  await page.getByTestId('vt-state').click()
  await expect(page.getByTestId('vt-surface')).toContainText('Settled result')
  await expect(page.getByTestId('vt-status')).toContainText(
    browserName === 'chromium' ? /native|fallback/u : /native|fallback/u,
  )

  await page.getByTestId('vt-route').click()
  await expect(page.getByTestId('vt-surface')).toContainText('Detail route')

  await page.getByTestId('vt-theme').click()
  await expect(page.getByTestId('vt-theme-surface')).toHaveClass(/is-dark/u)

  const shared = page.locator(
    '[data-fsus-shared-element-id="view-transition-demo-card"]',
  )
  await page.getByTestId('vt-shared').click()
  await expect(shared).toHaveClass(/is-end/u)
  await expect(shared).not.toHaveCSS('view-transition-name', /fsus-/u)

  await page.screenshot({
    path: testInfo.outputPath(`${browserName}-terminal.png`),
    fullPage: false,
  })
  expect(diagnostics).toEqual([])
})

test('reduced and globally disabled motion bypass snapshots without changing focus or scroll', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto(route, { waitUntil: 'domcontentloaded' })
  await expectHealthyPage(page)
  await page.evaluate(() => window.scrollTo(0, 120))
  const button = page.getByTestId('vt-state')
  await button.focus()
  const before = await page.evaluate(() => window.scrollY)
  await button.click()

  await expect(page.getByTestId('vt-status')).toContainText('fallback backend')
  await expect(button).toBeFocused()
  expect(await page.evaluate(() => window.scrollY)).toBe(before)

  await page.evaluate(() => {
    document.documentElement.dataset.fsusMotion = 'disabled'
  })
  await page.getByTestId('vt-route').click()
  await expect(page.getByTestId('vt-status')).toContainText('fallback backend')
  await expect(page.getByTestId('vt-surface')).toContainText('Detail route')
})

test('call-time capability loss and rapid replacement do not replay updates', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(document, 'startViewTransition', {
      configurable: true,
      value: undefined,
    })
  })
  await page.goto(route, { waitUntil: 'domcontentloaded' })
  await expectHealthyPage(page)

  await page.getByTestId('vt-fallback').click()
  await expect(page.getByTestId('vt-status')).toContainText('fallback backend')
  await page.getByTestId('vt-route').click({ clickCount: 2, delay: 10 })
  await expect(page.getByTestId('vt-surface')).toContainText('Overview route')
})

test('Chromium CPU profiles keep the update responsive and layout stable', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'CDP throttling is Chromium-only')
  await page.goto(route, { waitUntil: 'domcontentloaded' })
  await expectHealthyPage(page)
  const session = await page.context().newCDPSession(page)

  for (const rate of [1, 4, 6]) {
    await session.send('Emulation.setCPUThrottlingRate', { rate })
    const result = await page.evaluate(async () => {
      const shifts: number[] = []
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) shifts.push(entry.duration)
      })
      try {
        observer.observe({ type: 'layout-shift', buffered: true })
      } catch {
        // The browser may omit this optional performance entry type.
      }
      const start = performance.now()
      ;(
        document.querySelector('[data-testid="vt-state"]') as HTMLElement
      ).click()
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      )
      observer.disconnect()
      return { elapsed: performance.now() - start, shifts }
    })
    expect(result.elapsed).toBeLessThan(2_000)
    expect(result.shifts.reduce((sum, value) => sum + value, 0)).toBeLessThan(
      0.1,
    )
  }
  await session.send('Emulation.setCPUThrottlingRate', { rate: 1 })
})
