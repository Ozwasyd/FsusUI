import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

type Box = { height: number; width: number; x: number; y: number }

const open = async (page: Page, visual: string) => {
  await page.goto(`/?visual=${visual}&theme=light`, {
    waitUntil: 'domcontentloaded',
  })
  await expect(page.locator('#app > *').first()).toBeVisible()
}

const box = async (locator: Locator): Promise<Box> => {
  await expect(locator).toBeVisible()
  const value = await locator.boundingBox()
  expect(value).not.toBeNull()
  return value!
}

const expectBoxParity = (normal: Box, reduced: Box) => {
  expect(
    Math.max(
      Math.abs(normal.x - reduced.x),
      Math.abs(normal.y - reduced.y),
      Math.abs(normal.width - reduced.width),
      Math.abs(normal.height - reduced.height),
    ),
  ).toBeLessThanOrEqual(2)
}

const expectReducedStateMachine = async (locator: Locator) => {
  const motion = await locator.evaluate((element) => {
    const style = getComputedStyle(element)
    const milliseconds = (value: string) =>
      value.split(',').map((part) => {
        const parsed = Number.parseFloat(part)
        return parsed * (part.trim().endsWith('ms') ? 1 : 1000)
      })
    return {
      animation: milliseconds(style.animationDuration),
      transition: milliseconds(style.transitionDuration),
      transform: style.transform,
    }
  })
  expect(Math.max(0, ...motion.transition)).toBeLessThanOrEqual(1)
  expect(Math.max(0, ...motion.animation)).toBeLessThanOrEqual(1)
}

test('reduced-motion state machines finish, clean up, return focus and preserve final boxes', async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await open(page, 'feedback')

  const dialogTrigger = page.getByTestId('open-publish-dialog')
  await dialogTrigger.click()
  const dialog = page.locator('.el-dialog').last()
  await page.waitForTimeout(400)
  const normalDialog = await box(dialog)
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(dialogTrigger).toBeFocused()

  await page.emulateMedia({ reducedMotion: 'reduce' })
  await dialogTrigger.click()
  await page.waitForTimeout(20)
  const reducedDialog = await box(dialog)
  expectBoxParity(normalDialog, reducedDialog)
  await expectReducedStateMachine(dialog)
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(dialogTrigger).toBeFocused()

  const drawerTrigger = page.getByRole('button', { name: '查看审阅记录' })
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await drawerTrigger.click()
  const drawer = page.locator('.el-drawer').last()
  await page.waitForTimeout(400)
  const normalDrawer = await box(drawer)
  await page.keyboard.press('Escape')
  await expect(drawer).toBeHidden()
  await expect(drawerTrigger).toBeFocused()

  await page.emulateMedia({ reducedMotion: 'reduce' })
  await drawerTrigger.click()
  await page.waitForTimeout(20)
  const reducedDrawer = await box(drawer)
  expectBoxParity(normalDrawer, reducedDrawer)
  await expectReducedStateMachine(drawer)
  await page.keyboard.press('Escape')
  await expect(drawer).toBeHidden()
  await expect(drawerTrigger).toBeFocused()

  const popoverTrigger = page.getByRole('button', {
    exact: true,
    name: 'Popover',
  })
  await popoverTrigger.hover()
  const popover = page.locator('.el-popover').last()
  await expect(popover).toBeVisible()
  await expectReducedStateMachine(popover)
  await page.mouse.move(1, 1)
  await expect(popover).toBeHidden()

  const notificationTrigger = page.getByRole('button', {
    exact: true,
    name: 'Notification',
  })
  await notificationTrigger.click()
  const notification = page.locator('.el-notification').last()
  await expect(notification).toBeVisible()
  await expectReducedStateMachine(notification)
  await notification.locator('.el-notification__closeBtn').click()
  await expect(page.locator('.el-notification')).toHaveCount(0)

  const loading = page.locator('.el-loading-mask').first()
  const loadingBox = await box(loading)
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  const normalLoadingBox = await box(loading)
  expectBoxParity(normalLoadingBox, loadingBox)

  await open(page, 'others')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const collapseHeader = page.locator('.el-collapse-item__header').nth(1)
  await collapseHeader.click()
  const collapseBody = page.locator('.el-collapse-item__wrap').nth(1)
  await expect(collapseBody).toBeVisible()
  await expectReducedStateMachine(collapseBody)
  await collapseHeader.click()
  await expect(collapseBody).toBeHidden()

  await open(page, 'navigation')
  const dropdownTrigger = page.getByRole('button', {
    name: /Dropdown List/,
  })
  await dropdownTrigger.hover()
  const dropdown = page.locator('.el-dropdown__popper').last()
  await expect(dropdown).toBeVisible()
  await expectReducedStateMachine(dropdown)
  await page.mouse.move(1, 1)
  await page.keyboard.press('Escape')
  await expect(dropdown).toBeHidden()

  const secondTab = page.getByRole('tab', { name: '已发布' })
  await secondTab.click()
  await expect(page.getByRole('tabpanel')).toContainText('管理读者可见版本')
  await expectReducedStateMachine(page.getByRole('tabpanel'))

  await testInfo.attach('reduced-motion-final-state.png', {
    body: await page.screenshot({ animations: 'disabled' }),
    contentType: 'image/png',
  })
})
