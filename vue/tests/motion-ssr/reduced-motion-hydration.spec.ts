import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

type Box = { height: number; width: number; x: number; y: number }
type MotionMode = 'no-preference' | 'reduce'

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

const openHydratedFixture = async (page: Page, reducedMotion: MotionMode) => {
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
  })
  await page.emulateMedia({ reducedMotion })
  await page.goto('/ssr-motion', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('#app[data-server-rendered="true"]')).toHaveCount(1)
  await expect(page.getByTestId('ssr-marker')).toContainText(
    'server-rendered-before-hydration',
  )
  await expect
    .poll(() => page.evaluate(() => window.__FSUS_SSR_HYDRATED__))
    .toBe(true)
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
  await expect(dropdown).toBeHidden()
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

declare global {
  interface Window {
    __FSUS_SSR_CONSOLE_ERRORS__?: string[]
    __FSUS_SSR_HYDRATED__?: boolean
  }
}
