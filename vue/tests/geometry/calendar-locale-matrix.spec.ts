import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { openGeometryFixture, runGeometryContract } from './geometry-contract'

const viewports = [320, 375, 390, 560, 768, 1440] as const
const zooms = [1, 2] as const
const themes = ['light', 'dark'] as const

const localeProfiles = [
  {
    firstWeekday: 'Sun',
    language: 'en-US',
    title:
      /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\b/,
  },
  {
    firstWeekday: '一',
    language: 'zh-CN',
    title: /\d{4}年\d{1,2}月/,
  },
  {
    firstWeekday: 'Mo',
    language: 'de-DE',
    title:
      /\b(?:Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\b/,
  },
  {
    firstWeekday: 'شنبه',
    language: 'fa-IR',
    title: /[\u0600-\u06ff]/,
  },
] as const

const assertCalendarTextFits = async (page: Page) => {
  const calendar = page.locator('.el-calendar').first()
  return calendar.evaluate((root) => {
    const visible = (node: HTMLElement) => {
      const style = getComputedStyle(node)
      const box = node.getBoundingClientRect()
      return (
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        box.width > 0 &&
        box.height > 0
      )
    }
    const measured = [
      root.querySelector<HTMLElement>('.el-calendar__title'),
      ...root.querySelectorAll<HTMLElement>(
        '.el-calendar-table thead th,.el-calendar__button-group button',
      ),
    ].filter((node): node is HTMLElement => Boolean(node && visible(node)))

    return measured
      .filter(
        (node) =>
          node.scrollWidth > node.clientWidth + 1 ||
          node.scrollHeight > node.clientHeight + 1,
      )
      .map((node) => ({
        className: node.className,
        clientHeight: node.clientHeight,
        clientWidth: node.clientWidth,
        scrollHeight: node.scrollHeight,
        scrollWidth: node.scrollWidth,
        tagName: node.tagName,
        text: node.textContent?.trim(),
      }))
  })
}

for (const profile of localeProfiles) {
  for (const theme of themes) {
    test(`Calendar locale geometry matrix: ${profile.language} / ${theme}`, async ({
      page,
    }, testInfo) => {
      await page.addInitScript((language) => {
        Object.defineProperty(navigator, 'language', {
          configurable: true,
          get: () => language,
        })
        Object.defineProperty(navigator, 'languages', {
          configurable: true,
          get: () => [language],
        })
      }, profile.language)
      await openGeometryFixture(
        page,
        `/?visual=data&theme=${theme}`,
        '[data-testid="section-data"]',
      )

      const calendar = page.locator('.el-calendar').first()
      const title = calendar.locator('.el-calendar__title')
      const firstWeekday = calendar
        .locator('.el-calendar-table thead th')
        .first()

      await expect(title).toHaveText(profile.title)
      await expect(firstWeekday).toHaveText(profile.firstWeekday)
      await expect(page.locator('html')).toHaveAttribute(
        'data-theme-resolved',
        theme,
      )

      for (const zoom of zooms) {
        for (const viewport of viewports) {
          await runGeometryContract(page, testInfo, {
            component: `Calendar-${profile.language}-${theme}`,
            focusSelector: '.el-calendar__button-group button:not(:disabled)',
            hitSelector: '.el-calendar__button-group button:not(:disabled)',
            peerSelector: '.el-calendar__title,.el-calendar__button-group',
            root: calendar,
            viewport,
            zoom,
          })

          await expect(title).toHaveText(profile.title)
          await expect(firstWeekday).toHaveText(profile.firstWeekday)
          expect(
            await assertCalendarTextFits(page),
            `${profile.language}/${theme} text clipping at ${viewport}px / ${zoom * 100}%`,
          ).toEqual([])

          const dayHeights = await calendar
            .locator('.el-calendar-day')
            .evaluateAll(
              (days, factor) =>
                days.map(
                  (day) => day.getBoundingClientRect().height / Number(factor),
                ),
              zoom,
            )
          expect(
            Math.min(...dayHeights),
            `${profile.language}/${theme} date-cell height at ${viewport}px / ${zoom * 100}%`,
          ).toBeGreaterThanOrEqual(40)

          const focusTarget = calendar
            .locator('.el-calendar__button-group button')
            .first()
          await focusTarget.focus()
          await page.keyboard.press('Tab')
          await page.keyboard.press('Shift+Tab')
          await expect(focusTarget).toBeFocused()
          const focusPresentation = await focusTarget.evaluate((node) => {
            const style = getComputedStyle(node)
            return {
              boxShadow: style.boxShadow,
              outlineStyle: style.outlineStyle,
            }
          })
          expect(
            focusPresentation.outlineStyle !== 'none' ||
              focusPresentation.boxShadow !== 'none',
          ).toBe(true)

          const geometry = await calendar.evaluate((root) => {
            const titleBox = root
              .querySelector<HTMLElement>('.el-calendar__title')!
              .getBoundingClientRect()
            const actionsBox = root
              .querySelector<HTMLElement>('.el-calendar__button-group')!
              .getBoundingClientRect()
            const header = root.querySelector<HTMLElement>(
              '.el-calendar__header',
            )!
            const body = root.querySelector<HTMLElement>('.el-calendar__body')!
            const headerStyle = getComputedStyle(header)
            const bodyStyle = getComputedStyle(body)
            return {
              actionsTop: actionsBox.top,
              bodyLeft: body.getBoundingClientRect().left,
              bodyPaddingLeft: Number.parseFloat(bodyStyle.paddingLeft),
              headerLeft: header.getBoundingClientRect().left,
              headerPaddingLeft: Number.parseFloat(headerStyle.paddingLeft),
              titleBottom: titleBox.bottom,
            }
          })
          expect(
            Math.abs(
              geometry.headerLeft +
                geometry.headerPaddingLeft -
                (geometry.bodyLeft + geometry.bodyPaddingLeft),
            ),
          ).toBeLessThanOrEqual(1)

          if (viewport < 560) {
            expect(geometry.actionsTop).toBeGreaterThanOrEqual(
              geometry.titleBottom + 7,
            )
          }
        }
      }
    })
  }
}
