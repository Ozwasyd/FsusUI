import { expect, test } from '@playwright/test'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { Locator, Page } from '@playwright/test'

type Box = { height: number; width: number; x: number; y: number }
type MotionMode = 'no-preference' | 'reduce'
type ExplicitMotionMode = 'enabled' | 'reduced' | 'disabled'
type MotionTraceEntry = {
  className: string
  consumer: string
  delay: string
  duration: string
  mode: ExplicitMotionMode
  opacity: string
  placement: string | null
  reason: string
  scale: string
  timestamp: number
  transform: string
  translate: string
}
type CadenceSample = {
  duration: string
  opacity: string
  phase: 'enter' | 'leave'
  sampleAt: number
  scale: string
  simulatedCadenceHz: 60 | 120
  transform: string
  translate: string
}

const head = execFileSync('git', ['rev-parse', 'HEAD'], {
  encoding: 'utf8',
}).trim()
const diff = execFileSync('git', ['diff', '--binary', '--no-ext-diff'], {
  encoding: 'utf8',
})
const candidate = diff
  ? `${head}+dirty.${createHash('sha256').update(diff).digest('hex')}`
  : head
const evidenceRoot = process.env.FSUS_MOTION_EVIDENCE_ROOT
  ? resolve(process.cwd(), process.env.FSUS_MOTION_EVIDENCE_ROOT)
  : undefined

const retainEvidence = async (name: string, body: Buffer | string) => {
  if (!evidenceRoot) return
  await mkdir(evidenceRoot, { recursive: true })
  await writeFile(resolve(evidenceRoot, name), body)
}

const box = async (locator: Locator): Promise<Box> => {
  await expect(locator).toBeVisible()
  const value = await locator.boundingBox()
  expect(value).not.toBeNull()
  return value!
}

const expectReducedDuration = async (locator: Locator) => {
  const maximumDuration = await locator.evaluate((element) => {
    const style = getComputedStyle(element)
    const milliseconds = (value: string) =>
      value.split(',').map((part) => {
        const parsed = Number.parseFloat(part)
        return parsed * (part.trim().endsWith('ms') ? 1 : 1000)
      })
    return Math.max(
      0,
      ...milliseconds(style.animationDuration),
      ...milliseconds(style.transitionDuration),
    )
  })
  expect(maximumDuration).toBeLessThanOrEqual(1)
}

const expectBoxParity = (component: string, normal: Box, reduced: Box) => {
  const maximumDelta = Math.max(
    Math.abs(reduced.x - normal.x),
    Math.abs(reduced.y - normal.y),
    Math.abs(reduced.width - normal.width),
    Math.abs(reduced.height - normal.height),
  )
  expect(
    maximumDelta,
    `${component} terminal bbox differs: ${JSON.stringify({ normal, reduced })}`,
  ).toBeLessThanOrEqual(1)
}

const waitForEvent = async (page: Page, event: string) => {
  await expect(page.getByTestId('motion-events')).toContainText(event)
}

const buttonByTestId = (page: Page, testId: string) =>
  page.getByTestId(testId).locator('xpath=ancestor::button[1]')

const startMotionTrace = async (page: Page, mode: ExplicitMotionMode) => {
  await page.evaluate((resolvedMode) => {
    window.__FSUS_MOTION_TRACE__ = []
    const selectors = [
      ['tag', '.el-tag'],
      ['badge', '.el-badge__content'],
      ['list', '.el-upload-list__item'],
      ['menu', '.el-menu--popup-container, .el-menu--popup'],
      ['dropdown', '.el-dropdown__popper'],
      ['popover', '.el-popover'],
    ] as const
    const capture = (element: Element, reason: string) => {
      if (!(element instanceof HTMLElement)) return
      const match = selectors.find(([, selector]) => element.matches(selector))
      if (!match || (window.__FSUS_MOTION_TRACE__?.length ?? 0) >= 2000) return
      const style = getComputedStyle(element)
      window.__FSUS_MOTION_TRACE__?.push({
        className: element.className,
        consumer: match[0],
        delay: style.transitionDelay,
        duration: style.transitionDuration,
        mode: resolvedMode,
        opacity: style.opacity,
        placement: element.getAttribute('data-popper-placement'),
        reason,
        scale: style.scale,
        timestamp: performance.now(),
        transform: style.transform,
        translate: style.translate,
      })
    }
    const captureTree = (element: Element, reason: string) => {
      capture(element, reason)
      for (const descendant of element.querySelectorAll('*')) {
        capture(descendant, reason)
      }
    }
    for (const element of document.querySelectorAll('*'))
      capture(element, 'initial')
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        if (record.target instanceof Element)
          capture(record.target, record.type)
        for (const node of record.addedNodes) {
          if (node instanceof Element) captureTree(node, 'added')
        }
      }
    })
    observer.observe(document.documentElement, {
      attributeFilter: [
        'aria-hidden',
        'class',
        'data-popper-placement',
        'style',
      ],
      attributes: true,
      childList: true,
      subtree: true,
    })
    window.__FSUS_MOTION_TRACE_STOP__ = () => observer.disconnect()
  }, mode)
}

const readMotionTrace = async (page: Page) =>
  page.evaluate(() => {
    window.__FSUS_MOTION_TRACE_STOP__?.()
    return window.__FSUS_MOTION_TRACE__ ?? []
  }) as Promise<MotionTraceEntry[]>

const maximumMilliseconds = (values: string) =>
  Math.max(
    ...values.split(',').map((part) => {
      const trimmed = part.trim()
      const value = Number.parseFloat(trimmed)
      return value * (trimmed.endsWith('ms') ? 1 : 1000)
    }),
  )

const openHydratedFixture = async (
  page: Page,
  reducedMotion: MotionMode,
  explicitMode?: ExplicitMotionMode,
) => {
  await page.addInitScript(() => {
    window.__FSUS_SSR_CONSOLE_ERRORS__ = []
    const original = console.error
    const originalWarn = console.warn
    console.error = (...arguments_) => {
      window.__FSUS_SSR_CONSOLE_ERRORS__?.push(arguments_.map(String).join(' '))
      original(...arguments_)
    }
    console.warn = (...arguments_) => {
      window.__FSUS_SSR_CONSOLE_ERRORS__?.push(arguments_.map(String).join(' '))
      originalWarn(...arguments_)
    }
    window.addEventListener('error', (event) => {
      window.__FSUS_SSR_CONSOLE_ERRORS__?.push(
        `window.error: ${event.error?.stack ?? event.message}`,
      )
    })
    window.addEventListener('unhandledrejection', (event) => {
      window.__FSUS_SSR_CONSOLE_ERRORS__?.push(
        `unhandledrejection: ${event.reason?.stack ?? String(event.reason)}`,
      )
    })
  })
  await page.emulateMedia({ reducedMotion })
  await page.goto(`/ssr-motion${explicitMode ? `?mode=${explicitMode}` : ''}`, {
    waitUntil: 'domcontentloaded',
  })
  await expect(page.locator('#app[data-server-rendered="true"]')).toHaveCount(1)
  if (explicitMode) {
    await expect(page.locator(':root')).toHaveAttribute(
      'data-fsus-motion',
      explicitMode,
    )
  }
  await expect(page.getByTestId('ssr-marker')).toContainText(
    'server-rendered-before-hydration',
  )
  await page.waitForTimeout(250)
  const startupErrors = await page.evaluate(
    () => window.__FSUS_SSR_CONSOLE_ERRORS__ ?? [],
  )
  expect(
    await page.evaluate(() => window.__FSUS_SSR_HYDRATED__),
    startupErrors.join('\n'),
  ).toBe(true)
  await page.evaluate(() => document.fonts.ready)
  await expect(page.locator('vite-error-overlay')).toHaveCount(0)
  expect(await page.evaluate(() => window.__FSUS_SSR_CONSOLE_ERRORS__)).toEqual(
    [],
  )
}

const exerciseStateMachines = async (page: Page, reducedMotion: MotionMode) => {
  await openHydratedFixture(page, reducedMotion)
  const boxes: Record<string, Box> = {}

  const dialogTrigger = buttonByTestId(page, 'dialog-trigger')
  await dialogTrigger.click()
  await waitForEvent(page, 'dialog:opened')
  const dialog = page.locator('.el-dialog')
  boxes.dialog = await box(dialog)
  if (reducedMotion === 'reduce') await expectReducedDuration(dialog)
  await page.keyboard.press('Escape')
  await waitForEvent(page, 'dialog:closed')
  await expect(page.locator('.el-dialog')).toHaveCount(0)
  await expect(dialogTrigger).toBeFocused()

  const drawerTrigger = buttonByTestId(page, 'drawer-trigger')
  await drawerTrigger.click()
  await waitForEvent(page, 'drawer:opened')
  const drawer = page.locator('.el-drawer')
  boxes.drawer = await box(drawer)
  if (reducedMotion === 'reduce') await expectReducedDuration(drawer)
  await page.keyboard.press('Escape')
  await waitForEvent(page, 'drawer:closed')
  await expect(page.locator('.el-drawer')).toBeHidden()
  await expect(page.locator('.el-drawer__body')).toHaveCount(0)
  await expect(drawerTrigger).toBeFocused()

  const popoverTrigger = buttonByTestId(page, 'popover-trigger')
  await popoverTrigger.click()
  await waitForEvent(page, 'popover:after-enter')
  const popover = page.locator('.el-popover')
  boxes.popover = await box(popover)
  if (reducedMotion === 'reduce') await expectReducedDuration(popover)
  await popoverTrigger.click()
  await waitForEvent(page, 'popover:after-leave')
  await expect(page.locator('.el-popover')).toHaveCount(0)
  await expect(popoverTrigger).toBeFocused()

  const collapseTrigger = page.getByTestId('collapse-trigger')
  await collapseTrigger.click()
  const collapse = page.getByTestId('collapse-content')
  await expect(collapse).toBeVisible()
  boxes.collapse = await box(collapse)
  if (reducedMotion === 'reduce') await expectReducedDuration(collapse)
  await collapseTrigger.click()
  await expect(collapse).toBeHidden()
  await page.waitForTimeout(reducedMotion === 'reduce' ? 20 : 300)

  const dropdownTrigger = buttonByTestId(page, 'dropdown-trigger')
  await dropdownTrigger.click()
  await waitForEvent(page, 'dropdown:visible')
  const dropdown = page.locator('.el-dropdown__popper')
  await expect(dropdown).toBeVisible()
  await page.waitForTimeout(reducedMotion === 'reduce' ? 20 : 400)
  boxes.dropdown = await box(dropdown)
  if (reducedMotion === 'reduce') await expectReducedDuration(dropdown)
  await dropdownTrigger.click()
  await waitForEvent(page, 'dropdown:hidden')
  await expect(dropdown).toHaveCount(0)
  await expect(dropdownTrigger).toBeFocused()

  await page.getByTestId('notification-trigger').click()
  await waitForEvent(page, 'notification:opened')
  const notification = page.locator('.el-notification')
  await expect(notification).toBeVisible()
  await page.waitForTimeout(reducedMotion === 'reduce' ? 20 : 400)
  boxes.notification = await box(notification)
  if (reducedMotion === 'reduce') await expectReducedDuration(notification)
  await notification.locator('.el-notification__closeBtn').click()
  await waitForEvent(page, 'notification:closed')
  await expect(page.locator('.el-notification')).toHaveCount(0)

  await page.getByRole('tab', { name: '第二页' }).click()
  const tabPanel = page.getByTestId('tab-panel-two')
  await expect(tabPanel).toBeVisible()
  await page.waitForTimeout(reducedMotion === 'reduce' ? 20 : 300)
  boxes.tabs = await box(tabPanel)
  if (reducedMotion === 'reduce') await expectReducedDuration(tabPanel)

  const loading = page.locator('.el-loading-mask')
  await expect(loading).toBeVisible()
  boxes.loading = await box(loading)
  if (reducedMotion === 'reduce') await expectReducedDuration(loading)
  await page.getByTestId('loading-toggle').click()
  await expect(loading).toHaveCount(0)

  return boxes
}

test('hydrates real SSR markup and preserves terminal state-machine geometry', async ({
  page,
}) => {
  const normal = await exerciseStateMachines(page, 'no-preference')
  const reduced = await exerciseStateMachines(page, 'reduce')

  for (const component of [
    'dialog',
    'drawer',
    'popover',
    'collapse',
    'dropdown',
    'notification',
    'tabs',
    'loading',
  ]) {
    expectBoxParity(component, normal[component], reduced[component])
  }
})

test('normal mode exposes only the four public duration tokens', async ({
  page,
}) => {
  await openHydratedFixture(page, 'no-preference')
  const durations = await page.locator(':root').evaluate((root) => {
    const style = getComputedStyle(root)
    return [
      '--fsus-motion-control-fast',
      '--fsus-motion-control',
      '--fsus-motion-overlay',
      '--fsus-motion-panel',
    ].map((token) => style.getPropertyValue(token).trim())
  })

  expect(durations).toEqual(['140ms', '220ms', '300ms', '360ms'])
  expect(new Set(durations)).toEqual(
    new Set(['140ms', '220ms', '300ms', '360ms']),
  )
})

test('records real legacy consumer state machines in all explicit modes', async ({
  page,
}, testInfo) => {
  const traces: Record<ExplicitMotionMode, MotionTraceEntry[]> = {
    enabled: [],
    reduced: [],
    disabled: [],
  }

  for (const mode of ['enabled', 'reduced', 'disabled'] as const) {
    await openHydratedFixture(page, 'no-preference', mode)
    await startMotionTrace(page, mode)
    const settle = mode === 'enabled' ? 360 : 25

    await page.getByTestId('badge-toggle').click()
    await page.getByTestId('badge-toggle').click()
    await page.getByTestId('tag-rapid-toggle').click()
    await waitForEvent(page, 'tag:rapid-terminal-visible')
    await expect(page.getByTestId('motion-tag')).toHaveCount(1)

    for (let index = 0; index < 12; index += 1) {
      await page.getByTestId('list-add').click()
    }
    await expect(page.locator('.el-upload-list__item')).toHaveCount(12)
    await page.getByTestId('list-reorder').click()
    await waitForEvent(page, 'list:reordered')
    await page.waitForTimeout(settle)
    for (let index = 0; index < 12; index += 1) {
      await page.getByTestId('list-remove').click()
      await page.waitForTimeout(mode === 'enabled' ? 25 : 2)
    }
    await page.waitForTimeout(settle)
    await expect(page.locator('.el-upload-list__item')).toHaveCount(0)

    const popoverTrigger = buttonByTestId(page, 'popover-trigger')
    await popoverTrigger.click()
    await waitForEvent(page, 'popover:after-enter')
    const popover = page.locator('.el-popover')
    await expect(popover).toBeVisible()
    await expect(popover).toHaveAttribute(
      'data-popper-placement',
      /^(bottom|right|left)/,
    )
    const nestedDropdownTrigger = buttonByTestId(
      page,
      'nested-dropdown-trigger',
    )
    await nestedDropdownTrigger.click()
    await expect(page.locator('.el-dropdown__popper')).toBeVisible()
    await nestedDropdownTrigger.click()
    await expect(page.locator('.el-dropdown__popper')).toHaveCount(0)
    await popoverTrigger.click()
    await waitForEvent(page, 'popover:after-leave')
    await expect(popover).toHaveCount(0)
    await expect(popoverTrigger).toBeFocused()

    const menuTrigger = page.locator(
      '.ssr-motion-fixture__collapsed-menu > .el-sub-menu > .el-sub-menu__title',
    )
    await menuTrigger.hover()
    const menuPopup = page.locator('.el-menu--popup-container')
    await expect(menuPopup).toBeVisible()
    const nestedMenuTrigger = page.getByTestId('nested-menu-trigger')
    await nestedMenuTrigger.hover()
    await page.mouse.move(1000, 1000)
    await page.waitForTimeout(450)
    await expect(menuPopup).toHaveCount(0)

    const dropdownTrigger = buttonByTestId(page, 'dropdown-trigger')
    await dropdownTrigger.click()
    await dropdownTrigger.click()
    await dropdownTrigger.click()
    await dropdownTrigger.click()
    await waitForEvent(page, 'dropdown:hidden')
    await page.waitForTimeout(settle)
    await expect(page.locator('.el-dropdown__popper')).toHaveCount(0)
    await expect(dropdownTrigger).toBeFocused()
    await expect(page.locator('[inert]')).toHaveCount(0)

    traces[mode] = await readMotionTrace(page)
    for (const consumer of [
      'tag',
      'badge',
      'list',
      'menu',
      'dropdown',
      'popover',
    ]) {
      expect(
        traces[mode].some((entry) => entry.consumer === consumer),
        `${mode} trace missing ${consumer}`,
      ).toBe(true)
    }

    const active = traces[mode].filter(
      (entry) =>
        /-(?:enter|leave|move)(?:-active|-from|-to)?\b/u.test(
          entry.className,
        ) && entry.duration !== '',
    )
    expect(
      active.length,
      `${mode} trace contains no Vue phase state`,
    ).toBeGreaterThan(0)
    if (mode !== 'enabled') {
      for (const entry of active) {
        expect(
          maximumMilliseconds(entry.duration),
          JSON.stringify(entry),
        ).toBeLessThanOrEqual(1)
        expect(maximumMilliseconds(entry.delay), JSON.stringify(entry)).toBe(0)
        if (/(?:-from|-to)\b/u.test(entry.className)) {
          expect(entry.translate, JSON.stringify(entry)).toBe('none')
          expect(entry.scale, JSON.stringify(entry)).toBe('none')
          if (entry.consumer === 'list') {
            expect(entry.transform, JSON.stringify(entry)).toBe('none')
          }
        }
      }
    }
  }

  const traceEvidence = JSON.stringify(
    {
      candidate,
      recipes: [
        'legacy-inline-feedback',
        'upload-list',
        'legacy-collapsed-menu',
        'legacy-anchored-overlay',
      ],
      traces,
    },
    null,
    2,
  )
  await retainEvidence('legacy-motion-runtime-trace.json', traceEvidence)
  await testInfo.attach('legacy-motion-runtime-trace.json', {
    body: traceEvidence,
    contentType: 'application/json',
  })
  const terminalRender = await page.screenshot({ fullPage: true })
  await retainEvidence('legacy-motion-terminal-render.png', terminalRender)
  await testInfo.attach('legacy-motion-terminal-render.png', {
    body: terminalRender,
    contentType: 'image/png',
  })
})

test('preserves terminal state under local 60/120Hz cadence simulation and CPU throttle', async ({
  page,
}, testInfo) => {
  await openHydratedFixture(page, 'no-preference', 'enabled')
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })

  const samples: CadenceSample[] = []
  try {
    for (const simulatedCadenceHz of [60, 120] as const) {
      const cadenceSamples = await page.evaluate(async (hz) => {
        const button = document.querySelector<HTMLElement>(
          '[data-testid="badge-toggle"]',
        )!
        const badge = document.querySelector<HTMLElement>('.el-badge__content')!
        const result: CadenceSample[] = []
        const samplePhase = async (phase: 'enter' | 'leave') => {
          const start = performance.now()
          button.click()
          while (performance.now() - start <= 280) {
            const style = getComputedStyle(badge)
            result.push({
              duration: style.transitionDuration,
              opacity: style.opacity,
              phase,
              sampleAt: performance.now() - start,
              scale: style.scale,
              simulatedCadenceHz: hz,
              transform: style.transform,
              translate: style.translate,
            })
            await new Promise((resolve) => setTimeout(resolve, 1000 / hz))
          }
        }
        await samplePhase('leave')
        await samplePhase('enter')
        return result
      }, simulatedCadenceHz)
      expect(cadenceSamples.length).toBeGreaterThanOrEqual(
        simulatedCadenceHz === 60 ? 8 : 16,
      )
      expect(
        cadenceSamples.some((sample) => Number(sample.opacity) < 1),
        `${simulatedCadenceHz}Hz sampler did not observe the running transition`,
      ).toBe(true)
      samples.push(...cadenceSamples)
      await expect(page.locator('.el-badge__content')).toBeVisible()
      await expect(page.locator('.el-badge__content')).toHaveCSS('opacity', '1')
    }
  } finally {
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 })
    await cdp.detach()
  }

  const cadenceEvidence = JSON.stringify(
    {
      candidate,
      cpuThrottleRate: 4,
      environment:
        'Chromium CDP CPU throttling with timer-based 60/120Hz sampling cadence; not physical 60/120Hz or low-end hardware.',
      samples,
    },
    null,
    2,
  )
  await retainEvidence('local-motion-cadence-simulation.json', cadenceEvidence)
  await testInfo.attach('local-motion-cadence-simulation.json', {
    body: cadenceEvidence,
    contentType: 'application/json',
  })
})

declare global {
  interface Window {
    __FSUS_SSR_CONSOLE_ERRORS__?: string[]
    __FSUS_SSR_HYDRATED__?: boolean
    __FSUS_MOTION_TRACE__?: MotionTraceEntry[]
    __FSUS_MOTION_TRACE_STOP__?: () => void
  }
}
