import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { expect, test } from '@playwright/test'
import { buildVisualUrl } from '../../../scripts/visual-variant.mjs'

const modes = [
  { name: 'default menu', navMode: undefined, mode: 'menu', padding: '12px' },
  {
    name: 'explicit inline',
    navMode: 'inline',
    mode: 'inline',
    padding: '8px',
  },
] as const

for (const mode of modes) {
  for (const style of ['full', 'critical-only'] as const) {
    for (const zoom of [1, 1.5, 2]) {
      test(`${mode.name} retains search padding in ${style} landscape at ${zoom} zoom`, async ({
        page,
      }, testInfo) => {
        await page.setViewportSize({ width: 667, height: 375 })
        await page.emulateMedia({ reducedMotion: 'reduce' })
        await page.goto(
          buildVisualUrl('public-shell-nav-mode', testInfo.project.name, {
            contract: 1,
            session: 'anonymous',
            navMode: mode.navMode,
          }),
        )
        await expect(page.getByTestId('public-shell-nav-fixture')).toBeVisible()
        await page.evaluate(() => document.fonts.ready)
        if (style === 'critical-only') {
          const css = await readFile(
            resolve(
              testInfo.project.testDir,
              '../../packages/theme-chalk/dist/el-public-shell-critical.css',
            ),
            'utf8',
          )
          await page.evaluate((css) => {
            for (const sheet of document.styleSheets) sheet.disabled = true
            const criticalStyle = document.createElement('style')
            criticalStyle.textContent = css
            document.head.append(criticalStyle)
          }, css)
        }
        await page.evaluate((zoom) => {
          document.documentElement.style.zoom = String(zoom)
        }, zoom)
        await expect(page.locator('.el-public-shell')).toHaveAttribute(
          'data-mobile-nav-mode',
          mode.mode,
        )

        const trigger = page.locator('.el-public-shell__mobile-search-trigger')
        for (const state of ['collapsed', 'expanded'] as const) {
          if (state === 'expanded') {
            await trigger.focus()
            await page.keyboard.press('Enter')
            await expect(
              page.locator(
                '.el-public-shell__mobile-search-row input[type=text]',
              ),
            ).toBeFocused()
          }
          const geometry = await trigger.evaluate((element) => {
            const css = getComputedStyle(element)
            const rect = element.getBoundingClientRect()
            return {
              paddingStart: css.paddingInlineStart,
              paddingEnd: css.paddingInlineEnd,
              width: rect.width,
              height: rect.height,
            }
          })
          await testInfo.attach(`${state}-geometry`, {
            body: JSON.stringify(geometry),
            contentType: 'application/json',
          })
          expect(geometry.paddingStart).toBe(mode.padding)
          expect(geometry.paddingEnd).toBe(mode.padding)
          expect(geometry.width / zoom).toBeGreaterThanOrEqual(44)
          expect(geometry.height / zoom).toBeGreaterThanOrEqual(44)
        }
        await page.keyboard.press('Escape')
        await expect(trigger).toBeFocused()
      })
    }
  }
}
