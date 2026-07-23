import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { attachPageDiagnostics } from '../support/page-diagnostics'

const diagnostics = new WeakMap<Page, string[]>()

const demoRoutes = [
  { name: 'home', path: '/?theme=light' },
  {
    name: 'basic',
    path: '/?visual=basic&theme=light',
    testId: 'section-basic',
  },
  { name: 'form', path: '/?visual=form&theme=light', testId: 'section-form' },
  { name: 'data', path: '/?visual=data&theme=light', testId: 'section-data' },
  {
    name: 'navigation',
    path: '/?visual=navigation&theme=light',
    testId: 'section-navigation',
    openDropdown: true,
  },
  {
    name: 'feedback',
    path: '/?visual=feedback&theme=light',
    testId: 'section-feedback',
  },
  {
    name: 'others',
    path: '/?visual=others&theme=light',
    testId: 'section-others',
  },
  {
    name: 'icons',
    path: '/?visual=icons&theme=light',
    testId: 'section-icons',
  },
  {
    name: 'markdown-stress',
    path: '/?visual=markdown-stress&theme=light',
    testId: 'section-markdown-stress',
  },
] as const

test.beforeEach(async ({ page }) => {
  diagnostics.set(page, attachPageDiagnostics(page))
  await page.emulateMedia({ reducedMotion: 'reduce' })
})

test.afterEach(async ({ page }) => {
  expect(diagnostics.get(page) ?? []).toEqual([])
})

type MarkdownScrollSample = {
  scrollTop: number
  scrollHeight: number
  clientHeight: number
  section: number
}

const sampleMarkdownStressScroll = async (
  page: Page,
  options: { steps?: number; delta?: number; delayMs?: number } = {},
) => {
  const { steps = 80, delta = 900, delayMs = 8 } = options

  return page.evaluate(
    async ({ delta, delayMs, steps }) => {
      const wrap = document.querySelector<HTMLElement>(
        '.markdown-stress-scrollbar .el-scrollbar__wrap',
      )
      const renderer = document.querySelector<HTMLElement>(
        '.markdown-stress-renderer',
      )

      if (!wrap || !renderer) {
        throw new Error('Markdown stress scroll internals are missing')
      }

      const sectionNumber = (heading: HTMLElement | undefined) =>
        Number.parseInt(
          /Stress Section\s+(\d+)/.exec(heading?.textContent || '')?.[1] || '0',
          10,
        ) || 0
      const sectionFromViewport = () => {
        const headings = Array.from(
          renderer.querySelectorAll<HTMLElement>('h1,h2,h3'),
        )
        const wrapRect = wrap.getBoundingClientRect()
        const anchorTop = wrapRect.top + 32
        let bestHeading: HTMLElement | undefined
        let bestTop = Number.NEGATIVE_INFINITY

        for (const heading of headings) {
          const top = heading.getBoundingClientRect().top
          if (top <= anchorTop && top > bestTop) {
            bestTop = top
            bestHeading = heading
          }
        }

        return sectionNumber(bestHeading ?? headings[0])
      }

      const waitForFrames = () =>
        new Promise<void>((resolve) => {
          requestAnimationFrame(() => resolve())
        })
      const wait = (ms: number) =>
        new Promise<void>((resolve) => setTimeout(resolve, ms))
      const samples: MarkdownScrollSample[] = []

      for (let index = 0; index < steps; index += 1) {
        const maxScrollTop = Math.max(0, wrap.scrollHeight - wrap.clientHeight)
        wrap.scrollTop = Math.min(maxScrollTop, wrap.scrollTop + delta)
        wrap.dispatchEvent(new Event('scroll', { bubbles: true }))
        await waitForFrames()
        if (delayMs > 0) await wait(delayMs)

        samples.push({
          clientHeight: wrap.clientHeight,
          scrollHeight: wrap.scrollHeight,
          scrollTop: wrap.scrollTop,
          section: sectionFromViewport(),
        })
      }

      return samples
    },
    { delta, delayMs, steps },
  )
}

const expectStableForwardMarkdownScroll = (samples: MarkdownScrollSample[]) => {
  expect(samples.length).toBeGreaterThan(4)

  const regressions = samples
    .slice(1)
    .map((sample, index) => ({
      previous: samples[index],
      sample,
    }))
    .filter(({ previous, sample }) => {
      const scrollRegressed = sample.scrollTop < previous.scrollTop - 160
      const sectionRegressed =
        sample.section > 0 &&
        previous.section > 0 &&
        sample.section < previous.section - 3

      return scrollRegressed || sectionRegressed
    })

  expect(regressions).toEqual([])
  expect(samples[samples.length - 1].scrollTop).toBeGreaterThan(
    samples[0].scrollTop,
  )
}

for (const route of demoRoutes) {
  test(`dev server ${route.name} route has no browser diagnostics`, async ({
    page,
  }) => {
    await page.goto(route.path, { waitUntil: 'domcontentloaded' })
    await expect(page.locator('#app')).toBeVisible()

    if ('testId' in route) {
      await expect(
        page.locator(`[data-testid="${route.testId}"]`),
      ).toBeVisible()
    }

    if ('openDropdown' in route && route.openDropdown) {
      await page
        .locator('.dropdown-trigger-proxy button')
        .click({ force: true })
    }

    await page.waitForTimeout(250)
  })
}

test('dev server serves the current Select V2 option emphasis styles', async ({
  page,
}) => {
  await page.goto('/?audit=ui-boundaries&state=active&theme=light&compact=1', {
    waitUntil: 'domcontentloaded',
  })

  const card = page.locator('[data-audit-component="ElSelectV2"]')
  await expect(card).toBeVisible()

  await card.locator('.el-select-v2__wrapper').click({ force: true })

  const dropdown = card.locator('.el-select-dropdown')
  await expect(dropdown).toBeVisible()

  const items = dropdown.locator('.el-select-dropdown__option-item')
  await expect(items.nth(1)).toBeVisible()
  await items.nth(0).hover()

  const metrics = await dropdown.evaluate((dropdownElement) => {
    const rows = Array.from(
      dropdownElement.querySelectorAll<HTMLElement>(
        '.el-select-dropdown__option-item',
      ),
    )
    const [first, second] = rows

    if (!first || !second) {
      throw new Error('Select V2 option rows are missing')
    }

    const px = (value: string) => {
      const parsed = Number.parseFloat(value)
      return Number.isFinite(parsed) ? parsed : 0
    }

    const emphasisBox = (item: HTMLElement) => {
      const rect = item.getBoundingClientRect()
      const before = window.getComputedStyle(item, '::before')
      const itemStyle = window.getComputedStyle(item)

      return {
        top: rect.top + px(before.top),
        bottom: rect.bottom - px(before.bottom),
        beforeContent: before.content,
        beforeInsetTop: before.top,
        beforeInsetLeft: before.left,
        itemOutlineStyle: itemStyle.outlineStyle,
      }
    }

    const firstBox = emphasisBox(first)
    const secondBox = emphasisBox(second)

    return {
      emphasisGap: secondBox.top - firstBox.bottom,
      firstBeforeContent: firstBox.beforeContent,
      firstBeforeInsetTop: firstBox.beforeInsetTop,
      firstBeforeInsetLeft: firstBox.beforeInsetLeft,
      firstOutlineStyle: firstBox.itemOutlineStyle,
    }
  })

  expect(metrics.emphasisGap).toBeGreaterThanOrEqual(4)
  expect(metrics.firstBeforeContent).not.toBe('none')
  expect(metrics.firstBeforeInsetTop).toBe('2px')
  expect(metrics.firstBeforeInsetLeft).toBe('6px')
  expect(metrics.firstOutlineStyle).toBe('none')
})

test('default home mounts only the virtual window and navigates to sections', async ({
  page,
}) => {
  await page.setViewportSize({ width: 900, height: 700 })
  await page.goto('/?theme=light', { waitUntil: 'domcontentloaded' })

  await expect(page.locator('[data-testid="demo-virtual-home"]')).toBeVisible()

  const mountedSectionCount = await page
    .locator('.demo-virtual-section')
    .count()
  expect(mountedSectionCount).toBeGreaterThan(0)
  expect(mountedSectionCount).toBeLessThan(7)

  await page.getByRole('button', { exact: true, name: 'Data' }).click()
  await expect(page.locator('[data-testid="section-data"]')).toBeVisible()
})

test('default home TreeSelect dropdown does not bleed into the next section', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/?theme=light', { waitUntil: 'domcontentloaded' })

  await page.locator('[data-testid="section-form"]').scrollIntoViewIfNeeded()
  await page.locator('[data-testid="unique-tree-select"] input').click({
    force: true,
  })

  const metrics = await page.evaluate(() => {
    const visiblePopper = Array.from(
      document.querySelectorAll<HTMLElement>(
        '.el-tree-select__popper.el-popper',
      ),
    ).find((element) => {
      const rect = element.getBoundingClientRect()
      const style = getComputedStyle(element)
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        style.display !== 'none' &&
        style.visibility !== 'hidden'
      )
    })
    const dataHeading = document.querySelector<HTMLElement>(
      '[data-testid="section-data"] h2',
    )

    if (!visiblePopper || !dataHeading) {
      throw new Error('TreeSelect dropdown or Data heading is missing')
    }

    const popperRect = visiblePopper.getBoundingClientRect()
    const dataRect = dataHeading.getBoundingClientRect()
    const backgroundColor = getComputedStyle(visiblePopper).backgroundColor
    const alphaParts = /rgba?\(([^)]+)\)/
      .exec(backgroundColor)?.[1]
      ?.split(',')
      .map((part) => part.trim())

    return {
      alpha: alphaParts && alphaParts.length > 3 ? Number(alphaParts[3]) : 1,
      backgroundColor,
      gap: dataRect.top - popperRect.bottom,
    }
  })

  expect(metrics.gap).toBeGreaterThanOrEqual(16)
  expect(metrics.alpha).toBeCloseTo(250 / 255, 2)
  expect(metrics.backgroundColor).toBe('rgba(255, 255, 255, 0.98)')
})

test('Others card header keeps title and action separated on narrow screens', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 700 })
  await page.goto('/?visual=others&theme=light', {
    waitUntil: 'domcontentloaded',
  })

  const card = page.locator('.box-card').first()
  await expect(card).toBeVisible()

  const metrics = await card.evaluate((cardElement) => {
    const header = cardElement.querySelector<HTMLElement>('.card-header')
    const title = header?.querySelector<HTMLElement>('span')
    const button = header?.querySelector<HTMLElement>('.el-button')

    if (!header || !title || !button) {
      throw new Error('Card header internals are missing')
    }

    const cardRect = cardElement.getBoundingClientRect()
    const titleRect = title.getBoundingClientRect()
    const buttonRect = button.getBoundingClientRect()
    const sameRow =
      Math.abs(
        titleRect.top +
          titleRect.height / 2 -
          (buttonRect.top + buttonRect.height / 2),
      ) <
      Math.max(titleRect.height, buttonRect.height) / 2

    return {
      buttonRightOverflow: buttonRect.right - cardRect.right,
      horizontalGap: buttonRect.left - titleRect.right,
      sameRow,
      titleLeftOverflow: cardRect.left - titleRect.left,
      verticalGap: buttonRect.top - titleRect.bottom,
    }
  })

  expect(metrics.titleLeftOverflow).toBeLessThanOrEqual(1)
  expect(metrics.buttonRightOverflow).toBeLessThanOrEqual(1)
  if (metrics.sameRow) {
    expect(metrics.horizontalGap).toBeGreaterThanOrEqual(8)
  } else {
    expect(metrics.verticalGap).toBeGreaterThanOrEqual(8)
  }
})

test('Calendar header controls use soft segmented styling', async ({
  page,
}) => {
  await page.goto('/?visual=data&theme=light', {
    waitUntil: 'domcontentloaded',
  })

  const buttonGroup = page.locator('.el-calendar__button-group').first()
  await expect(buttonGroup).toBeVisible()

  const metrics = await buttonGroup.evaluate((group) => {
    const shell = group.querySelector<HTMLElement>('.el-button-group')
    const buttons = Array.from(
      group.querySelectorAll<HTMLElement>('.el-button'),
    )

    if (!shell || buttons.length !== 3) {
      throw new Error('Calendar header button group is missing')
    }

    const shellStyle = getComputedStyle(shell)

    return {
      buttonBorders: buttons.map(
        (button) => getComputedStyle(button).borderLeftWidth,
      ),
      buttonMargins: buttons.map(
        (button) => getComputedStyle(button).marginLeft,
      ),
      buttonRadii: buttons.map(
        (button) => getComputedStyle(button).borderRadius,
      ),
      shellDisplay: shellStyle.display,
      shellGap: shellStyle.gap,
      shellRadius: shellStyle.borderRadius,
    }
  })

  expect(metrics.shellDisplay).toBe('inline-flex')
  expect(metrics.shellGap).toBe('8px')
  expect(metrics.shellRadius).toBe('6px')
  expect(metrics.buttonBorders).toEqual(['0px', '0px', '0px'])
  expect(metrics.buttonMargins).toEqual(['0px', '0px', '0px'])
  expect(metrics.buttonRadii).toEqual(['4px', '4px', '4px'])
})

test('Calendar title follows the browser locale in demo app', async ({
  page,
}) => {
  await page.goto('/?visual=data&theme=light', {
    waitUntil: 'domcontentloaded',
  })

  const title = await page.locator('.el-calendar__title').first().textContent()
  expect(title?.trim()).toMatch(/^\d{4}年\d{1,2}月$/)
})

test('markdown stress route renders long raw HTML without browser diagnostics', async ({
  page,
}) => {
  test.setTimeout(60_000)

  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/?visual=markdown-stress&theme=light', {
    waitUntil: 'domcontentloaded',
  })

  await expect(
    page.locator('[data-testid="section-markdown-stress"]'),
  ).toBeVisible()
  await expect(
    page.locator('[data-testid="markdown-stress-renderer"]'),
  ).toBeVisible()
  await expect(
    page.locator('[data-testid="markdown-stress-status"]'),
  ).toHaveText('complete', { timeout: 30_000 })

  const metrics = await page
    .locator('[data-testid="markdown-stress-metrics"]')
    .textContent()
  expect(metrics).toContain('source: 500')
  expect(metrics).toContain('placeholders:')

  const timings = await page
    .locator('[data-testid="markdown-stress-timings"]')
    .textContent()
  expect(timings).toContain('html-only')
  expect(timings).toContain('summary')
  expect(timings).toContain('full-result')

  const renderer = page.locator('.markdown-stress-renderer')
  const stressScrollbar = page.locator('.markdown-stress-scrollbar')
  const stressScrollWrap = stressScrollbar
    .locator('.el-scrollbar__wrap')
    .first()
  const findRenderedMarkdownNode = async (selector: string) => {
    const maxScrollTop = await stressScrollWrap.evaluate((element) =>
      Math.max(0, element.scrollHeight - element.clientHeight),
    )
    const scrollPositions = [
      0,
      640,
      1_600,
      3_200,
      6_400,
      12_000,
      maxScrollTop * 0.25,
      maxScrollTop * 0.5,
      maxScrollTop * 0.75,
      maxScrollTop,
    ]

    for (const position of scrollPositions) {
      await stressScrollWrap.evaluate((element, top) => {
        element.scrollTop = Math.max(0, Math.min(element.scrollHeight, top))
        element.dispatchEvent(new Event('scroll'))
      }, position)
      await page.waitForTimeout(25)
      const locator = renderer.locator(selector)
      if ((await locator.count()) > 0) {
        return locator.first()
      }
    }

    throw new Error(`markdown_stress_selector_not_rendered:${selector}`)
  }

  await expect(renderer).toContainText('Escaped html probe 1:')
  await expect(renderer.locator('iframe')).toHaveCount(0)
  await expect(
    await findRenderedMarkdownNode('.markdown-renderer__text--inline-code'),
  ).toBeVisible()
  const liveRenderUnits = await renderer
    .locator('[data-fsus-render-unit]')
    .count()
  expect(liveRenderUnits).toBeGreaterThan(0)
  expect(liveRenderUnits).toBeLessThan(96)
  const hasWorkerRuntime = await page.evaluate(
    () => typeof Worker !== 'undefined',
  )
  const renderStrategy = await page
    .locator(
      '[data-testid="markdown-stress-renderer"] [data-markdown-renderer]',
    )
    .getAttribute('data-fsus-render-strategy')
  expect(renderStrategy).toBe(
    hasWorkerRuntime ? 'chunked-worker' : 'chunked-main',
  )

  await expect(stressScrollbar).toBeVisible()
  await stressScrollWrap.evaluate((element) => {
    element.scrollTop = 640
    element.dispatchEvent(new Event('scroll'))
  })
  await expect(stressScrollbar).toHaveClass(/is-scrolling/)
  await page.waitForTimeout(25)

  const stressScrollMotion = await stressScrollbar.evaluate((element) => {
    const content = element.querySelector<HTMLElement>(
      '.el-scrollbar__view > *',
    )
    const thumb = element.querySelector<HTMLElement>('.el-scrollbar__thumb')

    if (!content || !thumb) {
      return null
    }

    const contentStyle = window.getComputedStyle(content)
    const thumbStyle = window.getComputedStyle(thumb)

    return {
      contentFilter: contentStyle.filter,
      contentTransform: contentStyle.transform,
      thumbFilter: thumbStyle.filter,
      thumbShadow: thumbStyle.boxShadow,
    }
  })

  expect(stressScrollMotion).not.toBeNull()
  expect(stressScrollMotion?.contentTransform).not.toBe('none')
  const readBlur = (filter = '') => {
    const match = /blur\(([\d.]+)px\)/.exec(filter)
    return match ? Number.parseFloat(match[1]) : 0
  }
  expect(readBlur(stressScrollMotion?.contentFilter)).toBeLessThanOrEqual(0.05)
  expect(readBlur(stressScrollMotion?.thumbFilter)).toBeLessThanOrEqual(0.05)
  await expect(stressScrollbar).not.toHaveClass(/is-scrolling/, {
    timeout: 900,
  })

  await stressScrollWrap.evaluate((element) => {
    element.scrollTop = 0
    element.dispatchEvent(new Event('scroll'))
  })
  await page.waitForTimeout(50)

  const escapedProbeLayout = await renderer
    .locator('.markdown-renderer__text', { hasText: 'Escaped html probe 1:' })
    .first()
    .evaluate((element) => {
      const style = window.getComputedStyle(element)

      return {
        clientWidth: element.clientWidth,
        hasIframeText: element.textContent?.includes('<iframe') ?? false,
        overflowX: element.scrollWidth - element.clientWidth,
        wordBreak: style.wordBreak,
        overflowWrap: style.overflowWrap,
      }
    })

  expect(escapedProbeLayout.hasIframeText).toBe(true)
  expect(escapedProbeLayout.overflowX).toBeLessThanOrEqual(2)
  expect(escapedProbeLayout.clientWidth).toBeGreaterThan(0)
  expect(['anywhere', 'break-word']).toContain(escapedProbeLayout.overflowWrap)
  expect(['break-word', 'normal']).toContain(escapedProbeLayout.wordBreak)

  const mermaidFigure = await findRenderedMarkdownNode(
    '.markdown-renderer__mermaid[data-mermaid-rendered="true"]',
  )
  const diagramLayout = await mermaidFigure.evaluate((figure) => {
    const svg = figure.querySelector('svg')
    const root = figure.closest('.markdown-renderer')

    if (!svg || !root) {
      return null
    }

    const figureRect = figure.getBoundingClientRect()
    const svgRect = svg.getBoundingClientRect()
    const rootRect = root.getBoundingClientRect()

    return {
      figureWidth: figureRect.width,
      rootWidth: rootRect.width,
      svgHeight: svgRect.height,
      svgWidth: svgRect.width,
      heightAttr: svg.getAttribute('height'),
      widthAttr: svg.getAttribute('width'),
    }
  })

  expect(diagramLayout?.widthAttr).toMatch(/^\d+$/)
  expect(diagramLayout?.heightAttr).toMatch(/^\d+$/)
  expect(
    diagramLayout?.svgWidth ?? Number.POSITIVE_INFINITY,
  ).toBeLessThanOrEqual(520)
  expect(
    diagramLayout?.svgHeight ?? Number.POSITIVE_INFINITY,
  ).toBeLessThanOrEqual(180)
  expect(diagramLayout?.figureWidth ?? Number.POSITIVE_INFINITY).toBeLessThan(
    (diagramLayout?.rootWidth ?? 0) * 0.6,
  )

  await page.addStyleTag({
    content: [
      '.markdown-renderer p,',
      '.markdown-renderer li {',
      '  text-align: justify;',
      '  text-align-last: justify;',
      '  word-spacing: 12px;',
      '}',
    ].join('\n'),
  })

  const protectedTechnicalText = await (
    await findRenderedMarkdownNode('.markdown-renderer__text--inline-code')
  ).evaluate((element) => {
    const style = window.getComputedStyle(element)
    return {
      textAlign: style.textAlign,
      textAlignLast: style.textAlignLast,
      wordSpacing: style.wordSpacing,
    }
  })
  expect(protectedTechnicalText.textAlign).not.toBe('justify')
  expect(protectedTechnicalText.textAlignLast).not.toBe('justify')
  expect(protectedTechnicalText.wordSpacing).not.toBe('12px')

  const layout = await renderer.evaluate((element) => ({
    viewportOverflow:
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
    rendererOverflow: element.scrollWidth - element.clientWidth,
  }))
  expect(layout.viewportOverflow).toBeLessThanOrEqual(2)
  expect(layout.rendererOverflow).toBeLessThanOrEqual(2)
})

test('markdown stress scrollbar thumb drag stays smooth without text blur', async ({
  page,
}) => {
  test.setTimeout(60_000)
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/?visual=markdown-stress&theme=light', {
    waitUntil: 'domcontentloaded',
  })

  await expect(
    page.locator('[data-testid="markdown-stress-status"]'),
  ).toHaveText('complete', { timeout: 20_000 })

  const scrollbar = page.locator('.markdown-stress-scrollbar')
  const wrap = scrollbar.locator('.el-scrollbar__wrap').first()
  const thumb = scrollbar
    .locator('.el-scrollbar__bar.is-vertical .el-scrollbar__thumb')
    .first()

  await expect(scrollbar).toBeVisible()
  await expect(thumb).toBeVisible()
  await wrap.evaluate((element) => {
    element.scrollTop = 0
    element.dispatchEvent(new Event('scroll'))
  })
  await expect(scrollbar).not.toHaveClass(/is-scrolling/, { timeout: 2500 })

  const thumbBox = await thumb.boundingBox()
  expect(thumbBox).not.toBeNull()
  if (!thumbBox) return

  const readDragPosition = () =>
    scrollbar.evaluate((element) => {
      const wrap = element.querySelector<HTMLElement>('.el-scrollbar__wrap')
      const renderer = element.querySelector<HTMLElement>(
        '.markdown-stress-renderer',
      )
      if (!wrap || !renderer) {
        throw new Error('Markdown stress scrollbar drag internals are missing')
      }

      const wrapRect = wrap.getBoundingClientRect()
      let section = 0
      let bestTop = Number.NEGATIVE_INFINITY
      for (const heading of renderer.querySelectorAll<HTMLElement>('h2')) {
        const rect = heading.getBoundingClientRect()
        if (rect.top <= wrapRect.top + 40 && rect.top > bestTop) {
          bestTop = rect.top
          section =
            Number.parseInt(
              /Stress Section\s+(\d+)/.exec(heading.textContent || '')?.[1] ||
                '0',
              10,
            ) || 0
        }
      }

      return {
        clientHeight: wrap.clientHeight,
        scrollTop: wrap.scrollTop,
        section,
      }
    })

  await page.mouse.move(
    thumbBox.x + thumbBox.width / 2,
    thumbBox.y + Math.min(8, thumbBox.height / 2),
  )
  await page.mouse.down()
  await page.mouse.move(thumbBox.x + thumbBox.width / 2, thumbBox.y + 160, {
    steps: 16,
  })
  await expect(scrollbar).toHaveClass(/is-scrolling/)
  await expect(scrollbar).toHaveClass(/is-thumb-dragging/)
  await page.waitForTimeout(50)

  const forwardDragPosition = await readDragPosition()
  await page.mouse.move(thumbBox.x + thumbBox.width / 2, thumbBox.y + 120, {
    steps: 8,
  })
  await page.waitForTimeout(80)
  const reverseDragPosition = await readDragPosition()

  expect(reverseDragPosition.scrollTop).toBeGreaterThanOrEqual(
    forwardDragPosition.scrollTop - 18_000,
  )
  if (forwardDragPosition.section > 0 && reverseDragPosition.section > 0) {
    expect(reverseDragPosition.section).toBeGreaterThanOrEqual(
      forwardDragPosition.section - 64,
    )
  }

  const dragMetrics = await scrollbar.evaluate((element) => {
    const wrap = element.querySelector<HTMLElement>('.el-scrollbar__wrap')
    const content = element.querySelector<HTMLElement>(
      '.el-scrollbar__view > *',
    )
    const thumb = element.querySelector<HTMLElement>(
      '.el-scrollbar__bar.is-vertical .el-scrollbar__thumb',
    )

    if (!wrap || !content || !thumb) {
      throw new Error('Markdown stress scrollbar drag internals are missing')
    }

    const readBlur = (filter: string) => {
      const match = /blur\(([\d.]+)px\)/.exec(filter)
      return match ? Number.parseFloat(match[1]) : 0
    }
    const contentStyle = getComputedStyle(content)
    const thumbStyle = getComputedStyle(thumb)
    const thumbAfterStyle = getComputedStyle(thumb, '::after')

    return {
      contentBlur: readBlur(contentStyle.filter),
      contentTransform: contentStyle.transform,
      scrollTop: wrap.scrollTop,
      thumbAfterOpacity: Number.parseFloat(thumbAfterStyle.opacity),
      thumbShadow: thumbStyle.boxShadow,
    }
  })

  expect(dragMetrics.scrollTop).toBeGreaterThan(0)
  expect(dragMetrics.contentTransform).not.toBe('none')
  expect(dragMetrics.contentBlur).toBeLessThanOrEqual(0.05)
  expect(dragMetrics.thumbAfterOpacity).toBeGreaterThan(0)
  expect(dragMetrics.thumbShadow).not.toBe('none')

  await page.mouse.up()
  await expect(scrollbar).not.toHaveClass(/is-scrolling/, { timeout: 2500 })

  await wrap.evaluate((element) => {
    element.scrollTop = 0
    element.dispatchEvent(new Event('scroll'))
  })
  await expect(scrollbar).not.toHaveClass(/is-scrolling/, { timeout: 2500 })

  const bar = scrollbar.locator('.el-scrollbar__bar.is-vertical').first()
  const barBox = await bar.boundingBox()
  expect(barBox).not.toBeNull()
  if (!barBox) return

  await page.mouse.click(
    barBox.x + barBox.width / 2,
    barBox.y + barBox.height / 2,
  )
  await page.waitForTimeout(50)
  const trackClickPosition = await readDragPosition()
  expect(trackClickPosition.scrollTop).toBeLessThanOrEqual(
    trackClickPosition.clientHeight * 1.2,
  )
})

test('markdown stress preview scroll remains monotonic while renderer settles', async ({
  page,
}) => {
  test.setTimeout(60_000)
  await page.setViewportSize({ width: 900, height: 760 })
  await page.goto('/?visual=markdown-stress&theme=light&debugScroll=1', {
    waitUntil: 'domcontentloaded',
  })

  const renderer = page.locator('.markdown-stress-renderer')
  await expect(renderer).toContainText('Stress Section 1', {
    timeout: 20_000,
  })

  const samples = await sampleMarkdownStressScroll(page, {
    delayMs: 8,
    steps: 80,
  })
  expectStableForwardMarkdownScroll(samples)

  await expect(
    page.locator('[data-testid="markdown-stress-status"]'),
  ).toHaveText('complete', { timeout: 20_000 })
})

test('markdown stress preview keeps position in narrow devtools-like viewport', async ({
  page,
}) => {
  test.setTimeout(60_000)
  await page.setViewportSize({ width: 520, height: 760 })
  await page.goto('/?visual=markdown-stress&theme=light', {
    waitUntil: 'domcontentloaded',
  })

  await expect(
    page.locator('[data-testid="markdown-stress-status"]'),
  ).toHaveText('complete', { timeout: 20_000 })

  const samples = await sampleMarkdownStressScroll(page, {
    delayMs: 8,
    steps: 80,
  })
  expectStableForwardMarkdownScroll(samples)

  const last = samples[samples.length - 1]
  expect(last.scrollHeight).toBeGreaterThan(last.clientHeight)
  expect(last.section).toBeGreaterThan(20)
})
