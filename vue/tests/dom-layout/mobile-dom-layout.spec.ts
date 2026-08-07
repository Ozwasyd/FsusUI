import { expect, test } from '@playwright/test'
import type { Locator, Page, TestInfo } from '@playwright/test'
import {
  auditComponents,
  auditStateNames,
  type UiAuditState,
} from '../../packages/demo-app/src/ui-audit-manifest'
import {
  assertScrollMotionState,
  buildDomBoundaryUrl,
  buildDomVisualUrl,
  collectComponentDomLayoutIssues,
  collectPageDomLayoutIssues,
  collectTokenIssues,
  expectNoBlockingLayoutIssues,
  waitForStableLayout,
  type DomLayoutIssue,
} from '../support/dom-layout-assertions'
import { attachPageDiagnostics } from '../support/page-diagnostics'
import { resolveDomLayoutChunkSize } from '../../../scripts/test-parallelism'

const diagnostics = new WeakMap<Page, string[]>()
const transparentPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
  'base64',
)
const domLayoutChunkSize = resolveDomLayoutChunkSize()
const chunkItems = <T>(items: readonly T[], size: number) => {
  const chunks: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
}
const auditComponentChunks = chunkItems(auditComponents, domLayoutChunkSize)

type TouchSurfaceOptions = {
  maxBackgroundAlpha?: number
  name: string
  pseudo?: '::before'
  useHoverClass?: boolean
}

const readTouchSurfaceMetrics = async (
  locator: Locator,
  options: TouchSurfaceOptions,
) =>
  locator.evaluate((element, options) => {
    const alphaFromColor = (color: string) => {
      if (color === 'transparent') return 0
      const alphaMatch = /rgba?\(([^)]+)\)/.exec(color)
      const parts = alphaMatch?.[1]?.split(',').map((part) => part.trim()) ?? []
      if (!parts.length) return 1
      if (parts.length < 4) return 1
      const alpha = Number.parseFloat(parts[3])
      return Number.isFinite(alpha) ? alpha : 1
    }
    const resolvedColor = (value: string) => {
      const probe = document.createElement('span')
      probe.style.color = value
      document.body.appendChild(probe)
      const resolved = getComputedStyle(probe).color
      probe.remove()
      return resolved
    }
    const colorDistance = (left: string, right: string) => {
      const parse = (value: string) =>
        /rgba?\(([^)]+)\)/
          .exec(value)?.[1]
          ?.split(',')
          .slice(0, 3)
          .map((part) => Number.parseFloat(part.trim())) ?? []
      const leftRgb = parse(left)
      const rightRgb = parse(right)
      if (leftRgb.length !== 3 || rightRgb.length !== 3)
        return Number.POSITIVE_INFINITY
      return Math.max(
        Math.abs(leftRgb[0] - rightRgb[0]),
        Math.abs(leftRgb[1] - rightRgb[1]),
        Math.abs(leftRgb[2] - rightRgb[2]),
      )
    }

    const style = getComputedStyle(element, options.pseudo)
    const rootStyle = getComputedStyle(document.documentElement)
    const scholarlyBlue = resolvedColor(
      rootStyle.getPropertyValue('--fsus-scholarly-blue').trim(),
    )

    return {
      backgroundAlpha: alphaFromColor(style.backgroundColor),
      backgroundColor: style.backgroundColor,
      borderColor: style.borderColor,
      boxShadow: style.boxShadow,
      isScholarlyBackground:
        alphaFromColor(style.backgroundColor) > 0.01 &&
        colorDistance(style.backgroundColor, scholarlyBlue) <= 2,
      isScholarlyBorder: colorDistance(style.borderColor, scholarlyBlue) <= 2,
      name: options.name,
      outlineStyle: style.outlineStyle,
    }
  }, options)

const expectNoStickyTouchSurface = async (
  locator: Locator,
  options: TouchSurfaceOptions,
) => {
  await locator.scrollIntoViewIfNeeded()
  await locator.focus({ timeout: 1000 }).catch(() => undefined)
  await locator.hover({ force: true, timeout: 1000 }).catch(() => undefined)

  if (options.useHoverClass) {
    await locator.evaluate((element) => element.classList.add('hover'))
  }

  const metrics = await readTouchSurfaceMetrics(locator, options)
  const maxBackgroundAlpha = options.maxBackgroundAlpha ?? 0.01

  expect(
    metrics.backgroundAlpha,
    `${metrics.name} sticky background ${metrics.backgroundColor}`,
  ).toBeLessThanOrEqual(maxBackgroundAlpha)
  expect(
    metrics.isScholarlyBackground,
    `${metrics.name} retains scholarly-blue background ${metrics.backgroundColor}`,
  ).toBe(false)
  expect(
    metrics.isScholarlyBorder,
    `${metrics.name} retains scholarly-blue border ${metrics.borderColor}`,
  ).toBe(false)
  expect(metrics.boxShadow, `${metrics.name} retains sticky shadow`).toBe(
    'none',
  )
  expect(metrics.outlineStyle, `${metrics.name} retains sticky outline`).toBe(
    'none',
  )
}

const expectTouchActiveFeedback = async (
  page: Page,
  locator: Locator,
  options: { name: string },
) => {
  await locator.scrollIntoViewIfNeeded()
  const box = await locator.boundingBox()
  expect(box, `${options.name} active feedback target box`).not.toBeNull()
  if (!box) return

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  try {
    await page.waitForTimeout(32)

    const metrics = await locator.evaluate((element, name) => {
      const style = getComputedStyle(element)
      return {
        boxShadow: style.boxShadow,
        name,
        transform: style.transform,
      }
    }, options.name)

    expect(
      metrics.transform !== 'none' || metrics.boxShadow !== 'none',
      `${metrics.name} active touch feedback`,
    ).toBe(true)
  } finally {
    await page.mouse.up()
  }
}

const skipUnlessTouchViewport = async (page: Page) => {
  const isTouchViewport = await page.evaluate(
    () => window.matchMedia('(hover: none) and (pointer: coarse)').matches,
  )

  test.skip(
    !isTouchViewport,
    'sticky touch hover only applies to coarse pointers',
  )
}

const isNetworkChangedDiagnostic = (event: string) =>
  event.includes('net::ERR_NETWORK_CHANGED')

const resetPageDiagnostics = (page: Page) => {
  const pageDiagnostics = diagnostics.get(page)
  if (pageDiagnostics) pageDiagnostics.length = 0
}

const readPageDiagnostics = (page: Page) => [...(diagnostics.get(page) ?? [])]

const isOnlyNetworkChangedDiagnostics = (events: readonly string[]) =>
  events.length > 0 && events.every(isNetworkChangedDiagnostic)

const gotoDomRoute = async (
  page: Page,
  url: string,
  readySelector: string,
) => {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    resetPageDiagnostics(page)

    let navigationError: unknown
    try {
      await page.goto(url, { waitUntil: 'networkidle' })
    } catch (error) {
      navigationError = error
    }

    await waitForStableLayout(page).catch((error: unknown) => {
      navigationError ??= error
    })

    const readyCount = await page
      .locator(readySelector)
      .first()
      .count()
      .catch(() => 0)
    const currentDiagnostics = readPageDiagnostics(page)

    if (readyCount > 0 && currentDiagnostics.length === 0) return

    const retriable =
      isOnlyNetworkChangedDiagnostics(currentDiagnostics) ||
      String(navigationError ?? '').includes('net::ERR_NETWORK_CHANGED')

    if (!retriable || attempt === 2) {
      if (navigationError && currentDiagnostics.length === 0) {
        throw navigationError
      }
      return
    }
  }
}

const readStableElementBox = async (locator: Locator) => {
  await expect(locator).toBeVisible()

  return locator.evaluate(
    async (element): Promise<{
      height: number
      width: number
      x: number
      y: number
    }> => {
      const readBox = () => {
        const rect = element.getBoundingClientRect()
        return {
          height: rect.height,
          width: rect.width,
          x: rect.left,
          y: rect.top,
        }
      }
      const distance = (
        left: ReturnType<typeof readBox>,
        right: ReturnType<typeof readBox>,
      ) =>
        Math.max(
          Math.abs(left.x - right.x),
          Math.abs(left.y - right.y),
          Math.abs(left.width - right.width),
          Math.abs(left.height - right.height),
        )

      let previous = readBox()
      for (let attempt = 0; attempt < 8; attempt += 1) {
        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
        })
        const next = readBox()
        if (distance(previous, next) <= 0.5) return next
        previous = next
      }
      return previous
    },
  )
}

const exerciseAuditState = async (
  page: Page,
  component: (typeof auditComponents)[number],
  state: UiAuditState,
) => {
  const componentCard = page.locator(component.locator)
  await componentCard.scrollIntoViewIfNeeded()

  if (state === 'focus') {
    const focusTarget = page.locator(component.focusLocator).first()
    if (await focusTarget.count()) {
      await focusTarget.focus({ timeout: 1000 }).catch(() => undefined)
    } else {
      await componentCard.focus({ timeout: 1000 }).catch(() => undefined)
    }
  }

  if (state === 'interaction') {
    const interactionTarget = page.locator(component.interactionLocator).first()
    if (await interactionTarget.count()) {
      await interactionTarget.hover({ force: true, timeout: 1000 })
    } else {
      await componentCard.hover({ force: true, timeout: 1000 })
    }
  }

  if (state === 'active') {
    const activeTarget = page.locator(component.activeLocator).first()
    if (await activeTarget.count()) {
      await activeTarget
        .click({ force: true, timeout: 1500 })
        .catch(() => undefined)
    }
  }

  await waitForStableLayout(page)
}

test.beforeEach(async ({ page }) => {
  diagnostics.set(page, attachPageDiagnostics(page))
  await page.route('https://cube.elemecdn.com/**', (route) =>
    route.fulfill({
      body: transparentPng,
      contentType: 'image/png',
      status: 200,
    }),
  )
  await page.emulateMedia({ reducedMotion: 'reduce' })
})

test.afterEach(async ({ page }) => {
  expect(diagnostics.get(page) ?? []).toEqual([])
})

const assertComponentChunkDomLayout = async (
  page: Page,
  testInfo: TestInfo,
  state: UiAuditState,
  components: typeof auditComponents,
) => {
  const issues: DomLayoutIssue[] = []

  await gotoDomRoute(
    page,
    buildDomBoundaryUrl(state, testInfo.project.name),
    '[data-audit-component]',
  )

  await expect(page.locator('[data-audit-component]')).toHaveCount(
    auditComponents.length,
  )

  issues.push(
    ...(await collectTokenIssues(page, {
      project: testInfo.project.name,
      state,
    })),
    ...(await collectPageDomLayoutIssues(page, {
      project: testInfo.project.name,
      state,
    })),
  )

  for (const component of components) {
    const componentCard = page.locator(component.locator)
    await expect(componentCard).toBeVisible()

    await exerciseAuditState(page, component, state)

    const context = {
      component: component.name,
      project: testInfo.project.name,
      state,
    } as const

    issues.push(
      ...(await collectComponentDomLayoutIssues(componentCard, context)),
    )

    await page.keyboard.press('Escape').catch(() => undefined)
    await waitForStableLayout(page)
  }

  issues.push(
    ...(await collectPageDomLayoutIssues(page, {
      project: testInfo.project.name,
      state,
    })),
  )

  expectNoBlockingLayoutIssues(issues)
}

for (const state of auditStateNames) {
  for (const [chunkIndex, components] of auditComponentChunks.entries()) {
    const start = chunkIndex * domLayoutChunkSize + 1
    const end = start + components.length - 1
    test(`registered audit components satisfy DOM-only layout oracles (${state}, ${start}-${end})`, async ({
      page,
    }, testInfo) => {
      await assertComponentChunkDomLayout(page, testInfo, state, components)
    })
  }
}

test('tree-v2 exposes tokenized scroll motion state and recovers', async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await gotoDomRoute(
    page,
    buildDomVisualUrl('data', testInfo.project.name),
    '[data-testid="tree-v2-container"]',
  )

  await assertScrollMotionState(
    page.locator('[data-testid="tree-v2-container"] .el-vl__wrapper').first(),
    page
      .locator('[data-testid="tree-v2-container"] .el-tree-virtual-list')
      .first(),
    {
      component: 'ElTreeV2',
      project: testInfo.project.name,
      state: 'route',
    },
  )
})

test('tree-v2 virtual scrollbar drag keeps motion and avoids clipped thumb caps', async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await gotoDomRoute(
    page,
    buildDomVisualUrl('data', testInfo.project.name),
    '[data-testid="tree-v2-container"]',
  )

  const wrapper = page
    .locator('[data-testid="tree-v2-container"] .el-vl__wrapper')
    .first()
  await expect(wrapper).toBeVisible()
  await wrapper.scrollIntoViewIfNeeded()

  const thumb = wrapper
    .locator('.el-virtual-scrollbar .el-scrollbar__thumb')
    .first()
  await expect(thumb).toBeVisible()

  const initialGeometry = await wrapper.evaluate((element) => {
    const thumb = element.querySelector<HTMLElement>(
      '.el-virtual-scrollbar .el-scrollbar__thumb',
    )
    if (!thumb) throw new Error('TreeV2 virtual scrollbar thumb is missing')

    const wrapperRect = element.getBoundingClientRect()
    const thumbRect = thumb.getBoundingClientRect()

    return {
      thumbRightGap: wrapperRect.right - thumbRect.right,
      thumbTopGap: thumbRect.top - wrapperRect.top,
    }
  })

  expect(initialGeometry.thumbTopGap).toBeGreaterThanOrEqual(6)
  expect(initialGeometry.thumbRightGap).toBeGreaterThanOrEqual(2)

  const thumbBox = await thumb.boundingBox()
  expect(thumbBox).not.toBeNull()
  if (!thumbBox) return

  await page.mouse.move(
    thumbBox.x + thumbBox.width / 2,
    thumbBox.y + Math.min(8, thumbBox.height / 2),
  )
  await page.mouse.down()
  await page.mouse.move(thumbBox.x + thumbBox.width / 2, thumbBox.y + 82, {
    steps: 8,
  })
  await expect(wrapper).toHaveClass(/is-scrolling/)
  await page.waitForTimeout(32)

  const dragMetrics = await wrapper.evaluate((element) => {
    const content = element.querySelector<HTMLElement>('.el-vl__inner > *')
    const thumb = element.querySelector<HTMLElement>(
      '.el-virtual-scrollbar .el-scrollbar__thumb',
    )
    const windowElement = element.querySelector<HTMLElement>('.el-vl__window')
    if (!content || !thumb || !windowElement) {
      throw new Error('TreeV2 virtual scrollbar drag internals are missing')
    }

    const blurRadius = (filter: string) => {
      const match = /blur\(([\d.]+)px\)/.exec(filter)
      return match ? Number.parseFloat(match[1]) : 0
    }
    const contentStyle = getComputedStyle(content)
    const thumbStyle = getComputedStyle(thumb)

    return {
      contentBlur: blurRadius(contentStyle.filter),
      contentTransform: contentStyle.transform,
      hardware: element.getAttribute('data-fsus-render-hardware'),
      scrollTop: windowElement.scrollTop,
      thumbShadow: thumbStyle.boxShadow,
    }
  })

  expect(dragMetrics.scrollTop).toBeGreaterThan(0)
  if (dragMetrics.hardware === 'cpu-threaded') {
    expect(dragMetrics.contentTransform).toBe('none')
  } else {
    expect(dragMetrics.contentTransform).not.toBe('none')
  }
  expect(dragMetrics.contentBlur).toBeLessThanOrEqual(0.05)
  expect(dragMetrics.thumbShadow).not.toBe('none')

  await page.mouse.up()
  await expect(wrapper).not.toHaveClass(/is-scrolling/, { timeout: 900 })
})

test('scrollbar exposes tokenized scroll motion state and recovers', async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })

  await gotoDomRoute(
    page,
    buildDomVisualUrl('basic', testInfo.project.name),
    '.demo-block',
  )

  const scrollbarBlock = page.locator('.demo-block', { hasText: 'Scrollbar' })
  const scrollbar = scrollbarBlock.locator('.el-scrollbar').first()
  const scrollWrap = scrollbarBlock.locator('.el-scrollbar__wrap').first()
  await assertScrollMotionState(scrollbar, scrollWrap, {
    component: 'ElScrollbar',
    project: testInfo.project.name,
    state: 'route',
  })

  const thumb = scrollbar
    .locator('.el-scrollbar__bar.is-vertical .el-scrollbar__thumb')
    .first()
  await scrollbar.hover()
  await expect(thumb).toBeVisible()
  await scrollWrap.evaluate((element) => {
    element.scrollTop = 0
    element.dispatchEvent(new Event('scroll'))
  })
  await expect(scrollbar).not.toHaveClass(/is-scrolling/, { timeout: 900 })

  const thumbBox = await thumb.boundingBox()
  expect(thumbBox).not.toBeNull()
  if (!thumbBox) return

  await page.mouse.move(
    thumbBox.x + thumbBox.width / 2,
    thumbBox.y + Math.min(8, thumbBox.height / 2),
  )
  await page.mouse.down()
  await page.mouse.move(thumbBox.x + thumbBox.width / 2, thumbBox.y + 48, {
    steps: 8,
  })
  await expect(scrollbar).toHaveClass(/is-scrolling/)
  await expect(scrollbar).toHaveClass(/is-thumb-dragging/)
  await page.waitForTimeout(32)

  const dragMetrics = await scrollbar.evaluate((element) => {
    const wrap = element.querySelector<HTMLElement>('.el-scrollbar__wrap')
    const content = element.querySelector<HTMLElement>(
      '.el-scrollbar__view > *',
    )
    const thumb = element.querySelector<HTMLElement>(
      '.el-scrollbar__bar.is-vertical .el-scrollbar__thumb',
    )
    if (!wrap || !content || !thumb) {
      throw new Error('ElScrollbar thumb drag internals are missing')
    }

    const blurRadius = (filter: string) => {
      const match = /blur\(([\d.]+)px\)/.exec(filter)
      return match ? Number.parseFloat(match[1]) : 0
    }
    const contentStyle = getComputedStyle(content)
    const thumbStyle = getComputedStyle(thumb)
    const thumbAfterStyle = getComputedStyle(thumb, '::after')

    return {
      contentBlur: blurRadius(contentStyle.filter),
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
  await expect(scrollbar).not.toHaveClass(/is-scrolling/, { timeout: 900 })
})

test('slider drag exposes smooth tokenized follow motion', async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await gotoDomRoute(
    page,
    buildDomVisualUrl('form', testInfo.project.name),
    '.demo-block',
  )

  const sliderBlock = page.locator('.demo-block').filter({
    has: page.getByRole('heading', { exact: true, name: 'Slider' }),
  })
  const runway = sliderBlock.locator('.el-slider__runway').first()
  const buttonWrapper = runway.locator('.el-slider__button-wrapper').first()

  await expect(runway).toBeVisible()
  const runwayBox = await runway.boundingBox()
  expect(runwayBox).not.toBeNull()
  if (!runwayBox) return

  const startPoint = {
    x: runwayBox.x + runwayBox.width * 0.25,
    y: runwayBox.y + runwayBox.height / 2,
  }
  const endPoint = {
    x: runwayBox.x + runwayBox.width * 0.75,
    y: runwayBox.y + runwayBox.height / 2,
  }

  await buttonWrapper.dispatchEvent('pointerdown', {
    bubbles: true,
    button: 0,
    cancelable: true,
    clientX: startPoint.x,
    clientY: startPoint.y,
    pointerId: 1,
    pointerType: 'mouse',
  })
  await page.evaluate(({ x, y }) => {
    window.dispatchEvent(
      new PointerEvent('pointermove', {
        bubbles: true,
        button: 0,
        cancelable: true,
        clientX: x,
        clientY: y,
        pointerId: 1,
        pointerType: 'mouse',
      }),
    )
  }, endPoint)
  await expect(runway).toHaveClass(/is-dragging/)
  await waitForStableLayout(page)

  const motion = await runway.evaluate((element) => {
    const root = element.closest<HTMLElement>('.el-slider')!
    const bar = element.querySelector<HTMLElement>('.el-slider__bar')!
    const button = element.querySelector<HTMLElement>('.el-slider__button')!
    const wrapper = element.querySelector<HTMLElement>(
      '.el-slider__button-wrapper',
    )!
    const durations = (value: string) =>
      value
        .split(',')
        .map(
          (part) => Number.parseFloat(part) * (part.includes('ms') ? 1 : 1000),
        )
        .filter((value) => Number.isFinite(value))

    return {
      barBoxShadow: getComputedStyle(bar).boxShadow,
      barFilter: getComputedStyle(bar).filter,
      barTransitionDurations: durations(
        getComputedStyle(bar).transitionDuration,
      ),
      barTransform: getComputedStyle(bar).transform,
      buttonBoxShadow: getComputedStyle(button).boxShadow,
      buttonFilter: getComputedStyle(button).filter,
      interactiveBlur: getComputedStyle(root).getPropertyValue(
        '--fsus-interactive-motion-blur',
      ),
      interactiveGlow: getComputedStyle(root).getPropertyValue(
        '--fsus-interactive-motion-glow',
      ),
      interactiveStrength: Number.parseFloat(
        getComputedStyle(root).getPropertyValue(
          '--fsus-interactive-motion-strength',
        ),
      ),
      wrapperTransform: getComputedStyle(wrapper).transform,
      wrapperTransitionDurations: durations(
        getComputedStyle(wrapper).transitionDuration,
      ),
    }
  })

  expect(Math.max(...motion.barTransitionDurations)).toBeGreaterThan(0)
  expect(Math.max(...motion.wrapperTransitionDurations)).toBe(0)
  expect(motion.barTransform).not.toBe('none')
  expect(motion.wrapperTransform).not.toBe('none')
  expect(motion.barFilter).not.toBe('none')
  expect(motion.buttonFilter).not.toBe('none')
  expect(motion.interactiveBlur).toContain('px')
  expect(motion.interactiveGlow).toContain('px')
  expect(motion.interactiveStrength).toBeGreaterThan(0)
  expect(motion.barBoxShadow).not.toBe('none')
  expect(motion.buttonBoxShadow).not.toBe('none')

  await page.evaluate(({ x, y }) => {
    window.dispatchEvent(
      new PointerEvent('pointerup', {
        bubbles: true,
        button: 0,
        cancelable: true,
        clientX: x,
        clientY: y,
        pointerId: 1,
        pointerType: 'mouse',
      }),
    )
  }, endPoint)
  await expect(runway).not.toHaveClass(/is-dragging/)
})

test('carousel drag exposes threshold motion without screenshots', async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await gotoDomRoute(
    page,
    buildDomBoundaryUrl('active', testInfo.project.name),
    '[data-audit-component="ElCarousel"] .el-carousel',
  )

  const carousel = page
    .locator('[data-audit-component="ElCarousel"] .el-carousel')
    .first()
  const firstItem = carousel.locator('.el-carousel__item').first()

  await expect(carousel).toBeVisible()
  const box = await carousel.boundingBox()
  expect(box).not.toBeNull()
  if (!box) return

  await carousel.dispatchEvent('pointerdown', {
    bubbles: true,
    button: 0,
    cancelable: true,
    clientX: box.x + box.width * 0.72,
    clientY: box.y + box.height / 2,
    pointerId: 4,
    pointerType: 'mouse',
  })
  await carousel.dispatchEvent('pointermove', {
    bubbles: true,
    button: 0,
    cancelable: true,
    clientX: box.x + box.width * 0.28,
    clientY: box.y + box.height / 2,
    pointerId: 4,
    pointerType: 'mouse',
  })

  await expect(carousel).toHaveClass(/is-dragging/)
  await waitForStableLayout(page)

  const dragMetrics = await firstItem.evaluate((element) => {
    const carousel = element.closest<HTMLElement>('.el-carousel')!
    const style = getComputedStyle(element)
    const carouselStyle = getComputedStyle(carousel)
    return {
      filter: style.filter,
      interactiveBlur: carouselStyle.getPropertyValue(
        '--fsus-interactive-motion-blur',
      ),
      interactiveStrength: Number.parseFloat(
        carouselStyle.getPropertyValue('--fsus-interactive-motion-strength'),
      ),
      transform: style.transform,
    }
  })

  expect(dragMetrics.filter).toContain('blur')
  expect(dragMetrics.interactiveBlur).toContain('px')
  expect(dragMetrics.interactiveStrength).toBeGreaterThan(0)
  expect(dragMetrics.transform).not.toBe('none')

  await carousel.dispatchEvent('pointerup', {
    bubbles: true,
    button: 0,
    cancelable: true,
    clientX: box.x + box.width * 0.28,
    clientY: box.y + box.height / 2,
    pointerId: 4,
    pointerType: 'mouse',
  })
  await expect(carousel).not.toHaveClass(/is-dragging/)
})

test('time picker spinner scroll stays frame-coalesced and recovers', async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await gotoDomRoute(
    page,
    buildDomVisualUrl('form', testInfo.project.name),
    '.demo-block',
  )

  await page.locator('input[placeholder="Pick time"]').first().click()

  const panel = page.locator('.el-time-panel').last()
  const spinner = panel.locator('.el-time-spinner__wrapper').first()
  const scrollWrap = spinner.locator('.el-scrollbar__wrap').first()
  await expect(spinner).toBeVisible()

  await scrollWrap.evaluate((element) => {
    element.scrollTop = 88
    element.dispatchEvent(new Event('scroll'))
  })
  await expect(spinner).toHaveClass(/is-scrolling/)
  await page.waitForTimeout(32)

  const metrics = await spinner.evaluate((element) => {
    const wrap = element.querySelector<HTMLElement>('.el-scrollbar__wrap')
    const active = element.querySelectorAll('.el-time-spinner__item.is-active')
    const list = element.querySelector<HTMLElement>('.el-time-spinner__list')
    if (!wrap || !list) {
      throw new Error('TimePicker spinner internals are missing')
    }

    return {
      activeItems: active.length,
      filter: getComputedStyle(list).filter,
      scrollTop: wrap.scrollTop,
    }
  })

  expect(metrics.scrollTop).toBeGreaterThanOrEqual(0)
  expect(metrics.activeItems).toBeGreaterThan(0)
  expect(metrics.filter === 'none' || metrics.filter === '').toBe(true)
  await expect(spinner).not.toHaveClass(/is-scrolling/, { timeout: 1000 })
})

test('table scroll bridge and column resize stay frame-coalesced', async ({
  page,
}, testInfo) => {
  await gotoDomRoute(
    page,
    buildDomVisualUrl('data', testInfo.project.name),
    '.demo-block',
  )

  const block = page.locator('.demo-block').filter({
    has: page.getByRole('heading', {
      exact: true,
      name: 'Table & TableColumn',
    }),
  })
  const table = block.locator('.el-table').first()
  const bodyWrap = table.locator('.el-scrollbar__wrap').first()
  const header = table.locator('.el-table__header-wrapper').first()
  const firstHeaderCell = header.locator('thead th').first()
  const resizeProxy = table.locator('.el-table__column-resize-proxy')

  await expect(table).toBeVisible()
  await bodyWrap.evaluate((element) => {
    element.scrollLeft = 80
    element.dispatchEvent(new Event('scroll'))
  })
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  )

  const scrollSync = await table.evaluate((element) => {
    const wrap = element.querySelector<HTMLElement>('.el-scrollbar__wrap')
    const header = element.querySelector<HTMLElement>(
      '.el-table__header-wrapper',
    )
    if (!wrap || !header) {
      throw new Error('Table scroll bridge internals are missing')
    }

    return {
      bodyScrollLeft: wrap.scrollLeft,
      headerScrollLeft: header.scrollLeft,
    }
  })
  expect(scrollSync.headerScrollLeft).toBe(scrollSync.bodyScrollLeft)

  const cellBox = await firstHeaderCell.boundingBox()
  expect(cellBox).not.toBeNull()
  if (!cellBox) return

  await page.mouse.move(
    cellBox.x + cellBox.width - 3,
    cellBox.y + cellBox.height / 2,
  )
  await page.mouse.down()
  await page.mouse.move(
    cellBox.x + cellBox.width + 40,
    cellBox.y + cellBox.height / 2,
    { steps: 8 },
  )
  await expect(resizeProxy).toBeVisible()
  await page.waitForTimeout(32)

  const resizeMetrics = await resizeProxy.evaluate((element) => ({
    inlineLeft: element.style.left,
    transform: element.style.transform,
  }))
  expect(resizeMetrics.inlineLeft).not.toBe('')
  expect(resizeMetrics.transform).toContain('translate3d')
  await page.mouse.up()
  await expect(resizeProxy).not.toBeVisible()
})

test('color picker drag updates from cached geometry without sticky state', async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await gotoDomRoute(
    page,
    buildDomVisualUrl('form', testInfo.project.name),
    '.demo-block',
  )

  const block = page.locator('.demo-block').filter({
    has: page.getByRole('heading', { exact: true, name: 'ColorPicker' }),
  })
  await block.locator('.el-color-picker__trigger').click()

  const panel = page.locator('.el-color-svpanel').last()
  const cursor = panel.locator('.el-color-svpanel__cursor')
  await expect(panel).toBeVisible()
  await waitForStableLayout(page)
  await expect
    .poll(
      () =>
        cursor.evaluate(
          (element) =>
            Number.parseFloat((element as HTMLElement).style.top) || 0,
        ),
      {
        message: 'ColorPicker cursor initializes before cached drag geometry',
        timeout: 1200,
      },
    )
    .toBeGreaterThan(0)

  const box = await readStableElementBox(panel)
  expect(box.width).toBeGreaterThan(0)
  expect(box.height).toBeGreaterThan(0)

  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.8)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width * 0.75, box.y + box.height * 0.25, {
    steps: 8,
  })
  await expect(panel).toHaveClass(/is-dragging/)
  await expect
    .poll(
      () =>
        cursor.evaluate((element) => {
          const motionTarget =
            element.querySelector<HTMLElement>('div') ?? element
          return (
            Number.parseFloat(
              getComputedStyle(motionTarget).getPropertyValue(
                '--fsus-interactive-motion-strength',
              ),
            ) || 0
          )
        }),
      {
        message: 'ColorPicker exposes interactive motion vars while dragging',
        timeout: 1200,
      },
    )
    .toBeGreaterThan(0)

  const cursorMetrics = await cursor.evaluate((element) => {
    const motionTarget = element.querySelector<HTMLElement>('div') ?? element
    const motionStyle = getComputedStyle(motionTarget)
    return {
      interactiveBlur: motionStyle.getPropertyValue(
        '--fsus-interactive-motion-blur',
      ),
      interactiveStrength: Number.parseFloat(
        motionStyle.getPropertyValue('--fsus-interactive-motion-strength'),
      ),
      left: Number.parseFloat((element as HTMLElement).style.left),
      top: Number.parseFloat((element as HTMLElement).style.top),
    }
  })
  expect(cursorMetrics.interactiveBlur).toContain('px')
  expect(cursorMetrics.interactiveStrength).toBeGreaterThan(0)
  expect(cursorMetrics.left).toBeGreaterThan(0)
  expect(cursorMetrics.top).toBeGreaterThan(0)

  await page.mouse.up()
  await expect(panel).not.toHaveClass(/is-dragging/)
})

test('feedback dialog keeps a stable mobile footer layout', async ({
  page,
}, testInfo) => {
  await gotoDomRoute(
    page,
    buildDomVisualUrl('feedback', testInfo.project.name),
    '.demo-block',
  )

  await page
    .locator('.demo-block', { hasText: 'Dialog / Drawer' })
    .getByRole('button', { name: 'Open Dialog' })
    .click()

  const dialog = page.locator('.el-dialog').first()
  const footer = dialog.locator('.el-dialog__footer')
  const cancel = footer.getByRole('button', { name: 'Cancel' })
  const confirm = footer.getByRole('button', { name: 'Confirm' })

  await expect(dialog).toBeVisible()
  await expect(cancel).toBeVisible()
  await expect(confirm).toBeVisible()

  const metrics = await dialog.evaluate((dialogElement) => {
    const px = (value: string) => {
      const parsed = Number.parseFloat(value)
      return Number.isFinite(parsed) ? parsed : 0
    }
    const rootStyle = getComputedStyle(document.documentElement)
    const minDialogWidth = px(
      rootStyle.getPropertyValue('--fsus-dialog-mobile-min-width'),
    )
    const dialogRect = dialogElement.getBoundingClientRect()
    const buttons = Array.from(
      dialogElement.querySelectorAll<HTMLElement>(
        '.el-dialog__footer .el-button',
      ),
    ).map((button) => button.getBoundingClientRect())

    return {
      buttonGap: buttons[1] ? buttons[1].left - buttons[0].right : 0,
      buttonHeightDelta: buttons[1]
        ? Math.abs(buttons[1].height - buttons[0].height)
        : 0,
      buttonTopDelta: buttons[1]
        ? Math.abs(buttons[1].top - buttons[0].top)
        : Number.POSITIVE_INFINITY,
      dialogRight: dialogRect.right,
      dialogWidth: dialogRect.width,
      minDialogWidth,
      viewportWidth: window.innerWidth,
    }
  })

  const expectedMinWidth = Math.min(
    metrics.minDialogWidth,
    metrics.viewportWidth - 32,
  )

  expect(metrics.dialogWidth).toBeGreaterThanOrEqual(expectedMinWidth - 2)
  expect(metrics.dialogRight).toBeLessThanOrEqual(metrics.viewportWidth + 2)
  expect(metrics.buttonTopDelta).toBeLessThanOrEqual(1)
  expect(metrics.buttonGap).toBeGreaterThanOrEqual(7)
  expect(metrics.buttonHeightDelta).toBeLessThanOrEqual(1)
})

test('basic touch controls do not leave sticky hover or focus surfaces', async ({
  page,
}, testInfo) => {
  await skipUnlessTouchViewport(page)
  await gotoDomRoute(
    page,
    buildDomVisualUrl('basic', testInfo.project.name),
    '.demo-block',
  )

  await expectNoStickyTouchSurface(
    page
      .locator('.demo-block', { hasText: 'Button & ButtonGroup' })
      .getByRole('button', { name: 'Default' })
      .first(),
    { name: 'Button' },
  )
  await expectTouchActiveFeedback(
    page,
    page
      .locator('.demo-block', { hasText: 'Button & ButtonGroup' })
      .getByRole('button', { name: 'Default' })
      .first(),
    { name: 'Button' },
  )
  await expectNoStickyTouchSurface(
    page
      .locator('.demo-block', { hasText: 'Link' })
      .locator('.el-link')
      .first(),
    { name: 'Link' },
  )
})

test('navigation touch controls do not leave sticky hover surfaces', async ({
  page,
}, testInfo) => {
  await skipUnlessTouchViewport(page)
  await gotoDomRoute(
    page,
    buildDomVisualUrl('navigation', testInfo.project.name),
    '.demo-block',
  )

  await expectNoStickyTouchSurface(
    page.locator('.el-sub-menu__title').first(),
    {
      name: 'SubMenu title',
    },
  )
  await expectNoStickyTouchSurface(page.locator('.el-tabs__item').nth(1), {
    name: 'Tab item',
  })
  await expectTouchActiveFeedback(page, page.locator('.el-tabs__item').nth(1), {
    name: 'Tab item',
  })

  await page.locator('.dropdown-trigger-proxy button').click({ force: true })

  const firstItem = page.locator('.el-dropdown-menu__item').first()
  await expect(firstItem).toBeVisible()
  await expectNoStickyTouchSurface(firstItem, { name: 'Dropdown item' })
  await page.keyboard.press('Escape').catch(() => undefined)
})

test('data touch controls do not leave sticky hover surfaces', async ({
  page,
}, testInfo) => {
  await skipUnlessTouchViewport(page)
  await gotoDomRoute(
    page,
    buildDomVisualUrl('data', testInfo.project.name),
    '.demo-block',
  )

  await expectNoStickyTouchSurface(page.locator('.el-pager li').nth(1), {
    maxBackgroundAlpha: 1,
    name: 'Pagination item',
  })
  await expectNoStickyTouchSurface(
    page.locator('.el-tree-node__content').first(),
    {
      name: 'Tree node',
    },
  )
  await expectNoStickyTouchSurface(
    page
      .locator('.demo-block', { hasText: 'Tag / CheckTag' })
      .locator('.el-tag')
      .first(),
    { maxBackgroundAlpha: 0.08, name: 'Tag' },
  )
  await expectTouchActiveFeedback(
    page,
    page
      .locator('.demo-block', { hasText: 'Tag / CheckTag' })
      .locator('.el-tag')
      .first(),
    { name: 'Tag' },
  )
})

test('select touch option does not leave sticky hover surfaces', async ({
  page,
}, testInfo) => {
  await skipUnlessTouchViewport(page)
  await gotoDomRoute(
    page,
    buildDomVisualUrl('form', testInfo.project.name),
    '.demo-block',
  )

  await page
    .locator('.demo-block')
    .filter({
      has: page.getByRole('heading', {
        exact: true,
        name: 'Select & Option & OptionGroup',
      }),
    })
    .locator('.el-select .el-input__wrapper, .el-select__wrapper, .el-select')
    .first()
    .click({ force: true })
  const selectItem = page.getByRole('option', { name: 'Option 1' }).first()
  await expect(selectItem).toBeVisible()
  await expectNoStickyTouchSurface(selectItem, {
    name: 'Select option',
    useHoverClass: true,
  })
  await page.keyboard.press('Escape').catch(() => undefined)
})

test('select-v2 touch option does not leave sticky hover surfaces', async ({
  page,
}, testInfo) => {
  await skipUnlessTouchViewport(page)
  await gotoDomRoute(
    page,
    buildDomVisualUrl('form', testInfo.project.name),
    '.demo-block',
  )

  await page
    .locator('.demo-block')
    .filter({
      has: page.getByRole('heading', {
        exact: true,
        name: 'SelectV2',
      }),
    })
    .locator('.el-select-v2__wrapper, .el-select-v2')
    .first()
    .click({ force: true })
  const selectV2Item = page
    .locator('.el-select-dropdown__option-item:visible')
    .first()
  await expect(selectV2Item).toBeVisible()
  await expectNoStickyTouchSurface(selectV2Item, {
    name: 'SelectV2 option',
    useHoverClass: true,
  })

  const selectV2PseudoMetrics = await readTouchSurfaceMetrics(selectV2Item, {
    name: 'SelectV2 option pseudo',
    pseudo: '::before',
  })
  expect(
    selectV2PseudoMetrics.backgroundAlpha,
    selectV2PseudoMetrics.backgroundColor,
  ).toBeLessThanOrEqual(0.01)
  expect(selectV2PseudoMetrics.boxShadow).toBe('none')
})
