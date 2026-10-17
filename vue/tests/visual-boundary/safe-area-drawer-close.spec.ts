import { expect, test } from '@playwright/test'
import {
  assertControlsInsideSafeRect,
  assertDirectionalDrawerSafeInsets,
  assertOverlayActionsReachable,
  waitForStableLayout,
} from '../support/dom-layout-assertions'
import {
  applySafeAreaProfile,
  getSafeAreaProfile,
  SAFE_AREA_PROFILE_IDS,
  type SafeAreaProfile,
} from '../support/safe-area-profile'

test('Drawer controls have positive safe-area boxes and unobstructed hit targets', async ({
  page,
}) => {
  test.setTimeout(180_000)
  await page.emulateMedia({ reducedMotion: 'reduce' })

  for (const theme of ['light', 'dark']) {
    await page.goto(`/?audit=ui-boundaries&state=focus&theme=${theme}`)
    await expect(page.locator('[data-audit-ready="true"]')).toBeVisible()

    for (const profileId of SAFE_AREA_PROFILE_IDS) {
      const profile = getSafeAreaProfile(profileId) as SafeAreaProfile
      await applySafeAreaProfile(page, profile)

      for (const direction of ['ltr', 'rtl', 'ttb', 'btt'] as const) {
        const label = `${direction}/${profileId}/${theme}`
        const opener = page.locator(
          `[data-safe-area-open="drawer-${direction}"]`,
        )
        await opener.click()
        const panel = page.getByRole('dialog', {
          name: `Safe-area Drawer ${direction.toUpperCase()}`,
          exact: true,
        })
        await expect(panel).toBeVisible()
        await waitForStableLayout(page)
        await assertControlsInsideSafeRect(page, panel, profile, label)
        await assertDirectionalDrawerSafeInsets(page, direction, profile, label)

        const controls = panel.getByRole('button')
        await expect(controls).toHaveCount(3)
        const actions = await controls.all()
        await assertOverlayActionsReachable(page, actions, { label })
        for (const action of actions) {
          const hit = await action.evaluate((element) => {
            const box = element.getBoundingClientRect()
            const target = document.elementFromPoint(
              box.left + box.width / 2,
              box.top + box.height / 2,
            )
            return {
              positive: box.width > 0 && box.height > 0,
              containsTarget: target !== null && element.contains(target),
            }
          })
          expect(hit, label).toEqual({ positive: true, containsTarget: true })
        }

        await actions[0].focus()
        await expect(actions[0]).toBeFocused()
        await page.keyboard.press('Escape')
        await expect(panel).toBeHidden()
        await expect(opener).toBeFocused()
      }
    }
  }
})
