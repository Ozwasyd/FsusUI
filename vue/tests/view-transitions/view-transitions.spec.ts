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
  await button.press('Enter')

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

test('dark mode resolves all 36 --el-color-* scale vars and color-scheme in Chromium', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'Chromium dark scale verification')
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto(route, { waitUntil: 'domcontentloaded' })
  await expectHealthyPage(page)

  const report = await page.evaluate(() => {
    const root = document.documentElement
    const types = ['primary', 'success', 'warning', 'danger', 'error', 'info']
    const levels = [
      'light-3',
      'light-5',
      'light-7',
      'light-8',
      'light-9',
      'dark-2',
    ]
    const tokens = types.flatMap((type) =>
      levels.map((level) => `--el-color-${type}-${level}`),
    )

    const readState = () => {
      const style = getComputedStyle(root)
      return {
        colorScheme: style.colorScheme,
        values: Object.fromEntries(
          tokens.map((token) => [token, style.getPropertyValue(token).trim()]),
        ),
      }
    }

    root.classList.remove('dark')
    root.classList.add('light')
    delete root.dataset.themeResolved
    const light = readState()

    root.classList.remove('light')
    root.classList.add('dark')
    const explicitDark = readState()

    root.classList.remove('dark', 'light')
    root.dataset.themeResolved = 'dark'
    const resolvedDark = readState()

    delete root.dataset.themeResolved
    return { tokens, light, explicitDark, resolvedDark }
  })

  expect(report.tokens).toHaveLength(36)
  expect(report.light.colorScheme).toBe('light')
  expect(report.explicitDark.colorScheme).toBe('dark')
  expect(report.resolvedDark.colorScheme).toBe('dark')

  for (const token of report.tokens) {
    expect(report.light.values[token], `${token} in light`).toMatch(
      /^#[0-9a-f]{6}$/iu,
    )
    expect(report.explicitDark.values[token], `${token} in html.dark`).toMatch(
      /^#[0-9a-f]{6}$/iu,
    )
    expect(
      report.resolvedDark.values[token],
      `${token} in [data-theme-resolved='dark']`,
    ).toBe(report.explicitDark.values[token])
    expect(
      report.explicitDark.values[token],
      `${token} dark must differ from light`,
    ).not.toBe(report.light.values[token])
  }
})

test('Light↔Dark switches via syncThemeMode and runViewTransition resolve control colors atomically and restore transitions', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'Chromium theme transition check')
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'no-preference' })
  await page.goto(route, { waitUntil: 'domcontentloaded' })
  await expectHealthyPage(page)

  const results = await page.evaluate(async () => {
    const harness = (
      window as Window & {
        __fsusViewTransitionHarness?: {
          clearThemeMode: (root?: HTMLElement) => void
          runViewTransition: (
            update: () => void | Promise<void>,
          ) => { finished: Promise<void> }
          syncThemeMode: (
            mode: 'light' | 'dark' | 'system',
            root?: HTMLElement,
          ) => void
        }
      }
    ).__fsusViewTransitionHarness
    if (!harness) {
      throw new Error('Missing __fsusViewTransitionHarness on view-transitions demo')
    }
    const { clearThemeMode, syncThemeMode, runViewTransition } = harness

      const root = document.documentElement
      root.dataset.fsusMotion = 'enabled'

      const container = document.createElement('div')
      container.dataset.testid = 'theme-switch-probes'
      container.innerHTML = `
        <button class="el-button" type="button">Action</button>
        <div class="el-input__wrapper"><input class="el-input__inner" value="probe" /></div>
        <textarea class="el-textarea__inner">probe</textarea>
      `
      document.body.appendChild(container)

      const probes = {
        button: container.querySelector('.el-button') as HTMLElement,
        input: container.querySelector('.el-input__wrapper') as HTMLElement,
        textarea: container.querySelector('.el-textarea__inner') as HTMLElement,
      }

      const maxDurationMs = (el: HTMLElement) => {
        const durations = getComputedStyle(el)
          .transitionDuration.split(',')
          .map((part) => {
            const trimmed = part.trim()
            if (trimmed.endsWith('ms')) return Number.parseFloat(trimmed)
            if (trimmed.endsWith('s')) return Number.parseFloat(trimmed) * 1000
            return 0
          })
        return Math.max(0, ...durations)
      }

      const snapshotColors = () =>
        Object.fromEntries(
          Object.entries(probes).map(([name, el]) => {
            const style = getComputedStyle(el)
            return [
              name,
              {
                backgroundColor: style.backgroundColor,
                color: style.color,
                borderColor: style.borderColor,
                runningAnimations: el.getAnimations().length,
                transitionMs: maxDurationMs(el),
              },
            ]
          }),
        )

      const settleProbes = () => {
        for (const el of Object.values(probes)) {
          for (const animation of el.getAnimations()) animation.finish()
        }
      }

      try {
        // Measure true settled light and dark target colors
        syncThemeMode('light', root)
        settleProbes()
        const lightTargets = snapshotColors()

        syncThemeMode('dark', root)
        settleProbes()
        const darkTargets = snapshotColors()

        // Switch Dark -> Light synchronously via syncThemeMode
        syncThemeMode('light', root)
        const afterSyncToLight = {
          switchingAttr: root.dataset.fsusThemeSwitching,
          probes: snapshotColors(),
        }

        // Switch Light -> Dark synchronously via syncThemeMode
        syncThemeMode('dark', root)
        const afterSyncToDark = {
          switchingAttr: root.dataset.fsusThemeSwitching,
          probes: snapshotColors(),
        }

        // Switch Dark -> Light via runViewTransition wrapping syncThemeMode
        let vtSyncSnapshotAttr: string | undefined
        let vtSyncInCallback: ReturnType<typeof snapshotColors> | undefined
        const vtToLight = runViewTransition(() => {
          syncThemeMode('light', root)
          vtSyncSnapshotAttr = root.dataset.fsusViewTransitionSnapshotting
          vtSyncInCallback = snapshotColors()
        })
        await vtToLight.finished
        const afterVtToLight = {
          snapshotAttr: root.dataset.fsusViewTransitionSnapshotting,
          probes: snapshotColors(),
        }

        // Switch Light -> Dark via runViewTransition with direct root class toggle
        // (proves data-fsus-view-transition-snapshotting prevents lag independently)
        let vtDirectSnapshotAttr: string | undefined
        let vtDirectInCallback: ReturnType<typeof snapshotColors> | undefined
        const vtToDark = runViewTransition(() => {
          root.classList.remove('light')
          root.classList.add('dark')
          root.dataset.themeMode = 'dark'
          root.dataset.themeResolved = 'dark'
          vtDirectSnapshotAttr = root.dataset.fsusViewTransitionSnapshotting
          vtDirectInCallback = snapshotColors()
        })
        await vtToDark.finished
        const afterVtToDark = {
          snapshotAttr: root.dataset.fsusViewTransitionSnapshotting,
          probes: snapshotColors(),
        }

        return {
          lightTargets,
          darkTargets,
          afterSyncToLight,
          afterSyncToDark,
          vtSyncSnapshotAttr,
          vtSyncInCallback,
          afterVtToLight,
          vtDirectSnapshotAttr,
          vtDirectInCallback,
          afterVtToDark,
        }
      } finally {
        clearThemeMode(root)
        delete root.dataset.fsusMotion
        container.remove()
      }
    })

  for (const name of ['button', 'input', 'textarea'] as const) {
    // Sanity check: light and dark targets actually differ and controls have transitions
    expect(results.lightTargets[name].color).not.toBe(
      results.darkTargets[name].color,
    )
    expect(results.lightTargets[name].transitionMs).toBeGreaterThan(0)

    // syncThemeMode Dark -> Light: atomic colors, zero running CSS transitions, transitions restored
    expect(results.afterSyncToLight.switchingAttr).toBeUndefined()
    expect(results.afterSyncToLight.probes[name].backgroundColor).toBe(
      results.lightTargets[name].backgroundColor,
    )
    expect(results.afterSyncToLight.probes[name].color).toBe(
      results.lightTargets[name].color,
    )
    expect(results.afterSyncToLight.probes[name].borderColor).toBe(
      results.lightTargets[name].borderColor,
    )
    expect(results.afterSyncToLight.probes[name].runningAnimations).toBe(0)
    expect(results.afterSyncToLight.probes[name].transitionMs).toBeGreaterThan(0)

    // syncThemeMode Light -> Dark: atomic colors, zero running CSS transitions, transitions restored
    expect(results.afterSyncToDark.switchingAttr).toBeUndefined()
    expect(results.afterSyncToDark.probes[name].backgroundColor).toBe(
      results.darkTargets[name].backgroundColor,
    )
    expect(results.afterSyncToDark.probes[name].color).toBe(
      results.darkTargets[name].color,
    )
    expect(results.afterSyncToDark.probes[name].borderColor).toBe(
      results.darkTargets[name].borderColor,
    )
    expect(results.afterSyncToDark.probes[name].runningAnimations).toBe(0)
    expect(results.afterSyncToDark.probes[name].transitionMs).toBeGreaterThan(0)

    // runViewTransition(() => syncThemeMode('light')): snapshotted atomically, restored after finished
    expect(results.vtSyncSnapshotAttr).toBe('true')
    expect(results.vtSyncInCallback?.[name].backgroundColor).toBe(
      results.lightTargets[name].backgroundColor,
    )
    expect(results.vtSyncInCallback?.[name].color).toBe(
      results.lightTargets[name].color,
    )
    expect(results.vtSyncInCallback?.[name].borderColor).toBe(
      results.lightTargets[name].borderColor,
    )
    expect(results.vtSyncInCallback?.[name].runningAnimations).toBe(0)
    expect(results.afterVtToLight.snapshotAttr).toBeUndefined()
    expect(results.afterVtToLight.probes[name].backgroundColor).toBe(
      results.lightTargets[name].backgroundColor,
    )
    expect(results.afterVtToLight.probes[name].color).toBe(
      results.lightTargets[name].color,
    )
    expect(results.afterVtToLight.probes[name].transitionMs).toBeGreaterThan(0)

    // runViewTransition direct dark switch: snapshotting attr alone suppresses lag & restores after finished
    expect(results.vtDirectSnapshotAttr).toBe('true')
    expect(results.vtDirectInCallback?.[name].backgroundColor).toBe(
      results.darkTargets[name].backgroundColor,
    )
    expect(results.vtDirectInCallback?.[name].color).toBe(
      results.darkTargets[name].color,
    )
    expect(results.vtDirectInCallback?.[name].borderColor).toBe(
      results.darkTargets[name].borderColor,
    )
    expect(results.vtDirectInCallback?.[name].runningAnimations).toBe(0)
    expect(results.afterVtToDark.snapshotAttr).toBeUndefined()
    expect(results.afterVtToDark.probes[name].backgroundColor).toBe(
      results.darkTargets[name].backgroundColor,
    )
    expect(results.afterVtToDark.probes[name].color).toBe(
      results.darkTargets[name].color,
    )
    expect(results.afterVtToDark.probes[name].transitionMs).toBeGreaterThan(0)
  }
})
