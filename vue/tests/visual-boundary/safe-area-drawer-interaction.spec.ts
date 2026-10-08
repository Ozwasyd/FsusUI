import { expect, test } from '@playwright/test'
import * as path from 'node:path'
import {
  applySafeAreaProfile,
  getSafeAreaProfile,
  safeRectFromProfile,
} from '../support/safe-area-profile'

const fixtureUrl =
  process.env.FSUS_DRAWER_FIXTURE_URL ??
  `/@fs/${path.resolve(process.cwd(), 'tests/fixtures/drawer-safe-area/index.html')}`

for (const theme of ['light', 'dark'] as const) {
  for (const direction of ['ltr', 'rtl', 'ttb', 'btt'] as const) {
    test(`Drawer ${direction} ${theme}: landscape controls have positive safe boxes and real hit targets`, async ({
      page,
    }, testInfo) => {
      const params = new URLSearchParams({ direction, theme })
      if (direction !== 'ltr') params.set('size', '70%')
      await page.goto(`${fixtureUrl}?${params}`)
      const profile = getSafeAreaProfile('landscape-notch')
      await applySafeAreaProfile(page, profile)
      const safe = safeRectFromProfile(profile)
      await page.locator('#open').click()
      await expect(page.locator('#events')).toHaveText('open,opened')

      await expect(page.getByRole('dialog', { name: 'Account' })).toBeVisible()
      const panel = page.locator('[role="dialog"]')
      await expect(panel).toBeVisible()
      await expect(panel).not.toHaveAttribute('inert')
      const geometry = await panel.evaluate((element) => {
        const controls = [
          element.querySelector('button')!,
          element.querySelector('a')!,
        ]
        return controls.map((node) => {
          const rect = node.getBoundingClientRect()
          const hit = document.elementFromPoint(
            rect.left + rect.width / 2,
            rect.top + rect.height / 2,
          )
          return { box: rect.toJSON(), hit: hit !== null && node.contains(hit) }
        })
      })
      for (const { box, hit } of geometry) {
        expect(box.width).toBeGreaterThan(0)
        expect(box.height).toBeGreaterThan(0)
        expect(box.left).toBeGreaterThanOrEqual(safe.left - 1)
        expect(box.top).toBeGreaterThanOrEqual(safe.top - 1)
        expect(box.right).toBeLessThanOrEqual(safe.right + 1)
        expect(box.bottom).toBeLessThanOrEqual(safe.bottom + 1)
        expect(hit).toBe(true)
      }
      await testInfo.attach('positive-control-boxes', {
        body: JSON.stringify(geometry),
        contentType: 'application/json',
      })
      await testInfo.attach('opened', {
        body: await page.screenshot(),
        contentType: 'image/png',
      })
      await page.locator('#account-link').click()
      await expect(page.locator('#navigations')).toHaveText('1')
      await page.keyboard.press('Tab')
      expect(
        await panel.evaluate((element) =>
          element.contains(document.activeElement),
        ),
      ).toBe(true)
      await page.keyboard.press('Escape')
      await expect(panel).toHaveAttribute('inert', '')
      await expect(panel).toHaveAttribute('aria-hidden', 'true')
      await expect(page.locator('#events')).toHaveText(
        'open,opened,close,closed',
      )
      await expect(panel).toBeHidden()
      expect(
        await page
          .locator('#account-link')
          .evaluate((node) => node.getClientRects().length),
      ).toBe(0)
      await page.locator('#open').click()
      await expect(page.locator('#events')).toHaveText(
        'open,opened,close,closed,open,opened',
      )
      await expect(panel).not.toHaveAttribute('inert')
      await expect(panel).not.toHaveAttribute('aria-hidden')
      await page.locator('#account-link').click()
      await expect(page.locator('#navigations')).toHaveText('2')
    })
  }
}

test('Drawer leave transition retains animation while blocking pointer hit testing and programmatic focus', async ({
  page,
}, testInfo) => {
  await page.goto(fixtureUrl)
  await applySafeAreaProfile(page, getSafeAreaProfile('landscape-notch'))
  await page.locator('#open').click()
  await expect(page.locator('#events')).toHaveText('open,opened')
  await page.locator('#account-link').click()

  // Observe the real CSS transition without replacing its duration or geometry.
  const leaving = await page.evaluate(async () => {
    const panel = document.querySelector<HTMLElement>('[role="dialog"]')!
    const overlay = panel.parentElement!
    const link = document.querySelector<HTMLElement>('#account-link')!
    return new Promise((resolve) => {
      const observer = new MutationObserver(() => {
        if (!overlay.classList.contains('el-drawer-fade-leave-active')) return
        observer.disconnect()
        requestAnimationFrame(() => {
          link.focus()
          const rect = link.getBoundingClientRect()
          const hit = document.elementFromPoint(
            rect.left + rect.width / 2,
            rect.top + rect.height / 2,
          )
          resolve({
            inert: panel.inert,
            ariaHidden: panel.getAttribute('aria-hidden'),
            stillRendered: getComputedStyle(overlay).display !== 'none',
            leaveClass: overlay.classList.contains(
              'el-drawer-fade-leave-active',
            ),
            focusBlocked: document.activeElement !== link,
            hitBlocked: hit === null || !link.contains(hit),
            box: rect.toJSON(),
          })
        })
      })
      observer.observe(overlay, {
        attributes: true,
        attributeFilter: ['class'],
      })
      panel.querySelector<HTMLButtonElement>('button')!.click()
    })
  })
  expect(leaving).toMatchObject({
    inert: true,
    ariaHidden: 'true',
    stillRendered: true,
    leaveClass: true,
    focusBlocked: true,
    hitBlocked: true,
  })
  await testInfo.attach('real-leave-interaction', {
    body: JSON.stringify(leaving),
    contentType: 'application/json',
  })
  await expect(page.locator('#events')).toHaveText('open,opened,close,closed')
  await expect(page.locator('#open')).toBeFocused()
  await expect(page.locator('#navigations')).toHaveText('1')
})

test('Drawer destroy-on-close still destroys lazy content after closed', async ({
  page,
}) => {
  await page.goto(`${fixtureUrl}?destroy=true`)
  await expect(page.locator('#account-link')).toHaveCount(0)
  await page.locator('#open').click()
  await expect(page.locator('#events')).toHaveText('open,opened')
  await page.keyboard.press('Escape')
  await expect(page.locator('#events')).toHaveText('open,opened,close,closed')
  await expect(page.locator('#account-link')).toHaveCount(0)
  await page.locator('#open').click()
  await expect(page.locator('#account-link')).toBeVisible()
})
