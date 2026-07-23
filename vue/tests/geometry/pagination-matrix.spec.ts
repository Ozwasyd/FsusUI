import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

const pageCounts = [1, 5, 20, 1000] as const
const widths = [320, 360, 375, 560, 768, 1440] as const
const zooms = [1, 1.5, 2] as const
const locales = ['zh-CN', 'en-US'] as const
const themes = ['light', 'dark'] as const

type MatrixResult = {
  failures: Array<{
    actual: unknown
    expected: string
    id: string
    kind: string
  }>
  cases: number
}

const settle = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      }),
  )

const assertTabOrderMatchesDom = async (page: Page, roots: Locator) => {
  const count = await roots.count()
  for (let caseIndex = 0; caseIndex < count; caseIndex += 1) {
    const root = roots.nth(caseIndex)
    const expected = await root.evaluate((node, index) => {
      const values: string[] = []
      const targets = [
        ...node.querySelectorAll<HTMLElement>(
          'button:not(:disabled),[tabindex="0"],input:not(:disabled)',
        ),
      ].filter((target) => {
        const style = getComputedStyle(target)
        const rect = target.getBoundingClientRect()
        return (
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          rect.width > 0 &&
          rect.height > 0
        )
      })
      targets.forEach((target, targetIndex) => {
        const id = `${index}:${targetIndex}`
        target.dataset.paginationFocusId = id
        values.push(id)
      })
      return values
    }, caseIndex)
    if (expected.length === 0) continue

    await root.evaluate((node) => {
      const start = document.createElement('button')
      start.dataset.paginationTabStart = 'true'
      start.style.cssText =
        'position:fixed;inline-size:1px;block-size:1px;inset:0;opacity:0'
      node.before(start)
      start.focus()
    })
    const actual: Array<string | undefined> = []
    for (let index = 0; index < expected.length; index += 1) {
      await page.keyboard.press('Tab')
      actual.push(
        await page.evaluate(
          () =>
            (document.activeElement as HTMLElement | null)?.dataset
              .paginationFocusId,
        ),
      )
    }
    expect(actual).toEqual(expected)
  }
}

test('Pagination satisfies the complete responsive priority matrix', async ({
  page,
}) => {
  const consoleDiagnostics: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      consoleDiagnostics.push(`${message.type()}: ${message.text()}`)
    }
  })
  page.on('pageerror', (error) =>
    consoleDiagnostics.push(`pageerror: ${error.message}`),
  )

  for (const locale of locales) {
    for (const theme of themes) {
      await page.goto(
        `/?visual=pagination-matrix&theme=${theme}&locale=${locale}`,
        { waitUntil: 'domcontentloaded' },
      )
      const fixture = page.getByTestId('pagination-matrix')
      await expect(fixture).toBeVisible()
      await expect(fixture).toHaveAttribute('data-locale', locale)
      await expect(fixture).toHaveAttribute('data-theme', theme)
      await expect(page.locator('html')).toHaveAttribute(
        'data-theme-resolved',
        theme,
      )
      await expect(fixture.locator('.el-pagination__goto').first()).toHaveText(
        locale === 'zh-CN' ? '前往' : 'Go to',
      )
      await expect(page.locator('vite-error-overlay')).toHaveCount(0)

      const roots = fixture.locator('[data-pagination-case]')
      await expect(roots).toHaveCount(pageCounts.length * 8)

      for (const zoom of zooms) {
        for (const width of widths) {
          await page.setViewportSize({
            width: Math.round(width * zoom),
            height: Math.round(2800 * zoom),
          })
          await page.evaluate((factor) => {
            document.documentElement.style.zoom = String(factor)
          }, zoom)
          await settle(page)

          const result = await roots.evaluateAll((nodes) => {
            const failures: MatrixResult['failures'] = []
            const visible = (node: HTMLElement) => {
              const style = getComputedStyle(node)
              const rect = node.getBoundingClientRect()
              return (
                style.display !== 'none' &&
                style.visibility !== 'hidden' &&
                rect.width > 0 &&
                rect.height > 0
              )
            }
            const add = (
              root: HTMLElement,
              kind: string,
              actual: unknown,
              expected: string,
            ) =>
              failures.push({
                actual,
                expected,
                id: root.dataset.paginationCase ?? 'unknown',
                kind,
              })

            for (const node of nodes) {
              const root = node as HTMLElement
              const hasTotal = root.dataset.hasTotal === 'true'
              const hasSizes = root.dataset.hasSizes === 'true'
              const hasJumper = root.dataset.hasJumper === 'true'
              const pageCount = Number(root.dataset.pageCount)
              const availableWidth = root.clientWidth
              const rect = root.getBoundingClientRect()
              if (root.scrollWidth > root.clientWidth + 1) {
                add(
                  root,
                  'horizontal-overflow',
                  {
                    clientWidth: root.clientWidth,
                    scrollWidth: root.scrollWidth,
                  },
                  'scrollWidth <= clientWidth + 1',
                )
              }
              if (rect.left < -1 || rect.right > window.innerWidth + 1) {
                add(
                  root,
                  'outside-viewport',
                  { left: rect.left, right: rect.right },
                  'root is inside viewport',
                )
              }

              for (const target of root.querySelectorAll<HTMLElement>(
                'button:not(:disabled),[role="button"],[tabindex="0"]:not(input),.el-pagination__editor',
              )) {
                if (!visible(target)) continue
                const targetRect = target.getBoundingClientRect()
                if (targetRect.width < 39 || targetRect.height < 39) {
                  add(
                    root,
                    'hit-target',
                    {
                      height: targetRect.height,
                      text: target.textContent?.trim(),
                      width: targetRect.width,
                    },
                    'visible action >= 40x40px',
                  )
                }
              }

              const isVisible = (selector: string) => {
                const target = root.querySelector<HTMLElement>(selector)
                return target ? visible(target) : false
              }
              const expectations = {
                compactIndicator: availableWidth < 360,
                compactPager: availableWidth >= 360 && availableWidth < 560,
                fullPager: availableWidth >= 560,
                total: hasTotal && availableWidth >= 360,
                sizes:
                  hasSizes &&
                  (availableWidth >= 768 ||
                    (availableWidth >= 560 && !hasTotal)),
                jumper: hasJumper && availableWidth >= 768,
              }
              const actual = {
                compactIndicator: isVisible(
                  '.el-pagination__compact-indicator',
                ),
                compactPager: isVisible('.el-pagination__compact-pager'),
                fullPager: isVisible('.el-pagination__full-pager'),
                total: isVisible('.el-pagination__total'),
                sizes: isVisible('.el-pagination__sizes'),
                jumper: isVisible('.el-pagination__jump'),
              }
              for (const key of Object.keys(expectations) as Array<
                keyof typeof expectations
              >) {
                if (actual[key] !== expectations[key]) {
                  add(
                    root,
                    `responsive-priority:${key}`,
                    actual[key],
                    String(expectations[key]),
                  )
                }
              }

              const current = root.querySelector<HTMLElement>(
                '[aria-current="true"]',
              )
              const compact = root.querySelector<HTMLElement>(
                '.el-pagination__compact-indicator',
              )
              if (
                availableWidth < 360
                  ? compact?.textContent?.trim() !==
                    `${Math.min(5, pageCount)} / ${pageCount}`
                  : !current
              ) {
                add(
                  root,
                  'current-page-expression',
                  availableWidth < 360
                    ? compact?.textContent?.trim()
                    : current?.textContent?.trim(),
                  'current page and total pages remain perceivable',
                )
              }

              const navigation = root.querySelector<HTMLElement>(
                '.el-pagination__navigation',
              )
              const information = root.querySelector<HTMLElement>(
                '.el-pagination__information',
              )
              if (
                information &&
                visible(information) &&
                availableWidth < 768 &&
                navigation
              ) {
                const navigationRect = navigation.getBoundingClientRect()
                const informationRect = information.getBoundingClientRect()
                if (informationRect.top < navigationRect.bottom + 7) {
                  add(
                    root,
                    'zone-order',
                    {
                      informationTop: informationRect.top,
                      navigationBottom: navigationRect.bottom,
                    },
                    'information zone starts at least 8px below navigation',
                  )
                }
              }
            }

            return { cases: nodes.length, failures } satisfies MatrixResult
          })

          expect(result.cases).toBe(32)
          expect(
            result.failures,
            `${locale}/${theme}/${width}px/${zoom * 100}%`,
          ).toEqual([])
          const pageOverflow = await page.evaluate(
            () =>
              Math.max(
                document.documentElement.scrollWidth,
                document.body.scrollWidth,
              ) - document.documentElement.clientWidth,
          )
          expect(
            pageOverflow,
            `page overflow at ${locale}/${theme}/${width}px/${zoom * 100}%`,
          ).toBeLessThanOrEqual(1)

          if (
            locale === 'zh-CN' &&
            theme === 'light' &&
            zoom === 1 &&
            (width === 320 || width === 560 || width === 768 || width === 1440)
          ) {
            await assertTabOrderMatchesDom(
              page,
              fixture.locator(
                '[data-has-total="true"][data-has-sizes="true"][data-has-jumper="true"]',
              ),
            )
          }
        }
      }
    }
  }

  expect(consoleDiagnostics).toEqual([])
})
