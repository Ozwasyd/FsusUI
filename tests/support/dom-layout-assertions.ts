import { expect } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import type { UiAuditState } from '../../packages/demo-app/src/ui-audit-manifest'

export type DomLayoutSeverity = 'hard' | 'soft'

export type DomLayoutIssue = {
  component?: string
  detail: string
  kind: string
  project: string
  severity: DomLayoutSeverity
  state: UiAuditState | 'route'
}

export type DomLayoutContext = {
  component?: string
  project: string
  state: UiAuditState | 'route'
}

const geometryTolerance = 2
const radiusTolerance = 0.5

const requiredTokens = [
  '--fsus-scholarly-blue',
  '--fsus-dot-gray',
  '--fsus-radius-control',
  '--fsus-radius-panel',
  '--fsus-floating-safe-width',
  '--fsus-mobile-page-padding',
  '--fsus-backdrop-blur',
  '--fsus-backdrop-blur-overlay',
  '--fsus-motion-control',
  '--fsus-motion-drag-blur',
  '--fsus-motion-drag-max-offset',
  '--fsus-motion-drag-scale',
  '--fsus-motion-drag-trail-opacity',
  '--fsus-motion-panel',
  '--fsus-motion-overlay',
  '--fsus-motion-scroll-blur',
  '--fsus-motion-scroll-idle',
  '--fsus-motion-scroll-max-offset',
  '--fsus-motion-scroll-settle',
  '--fsus-motion-scroll-trail-opacity',
  '--fsus-motion-slider-follow',
  '--fsus-motion-slider-trail',
  '--fsus-motion-spring-damping',
  '--fsus-motion-spring-mass',
  '--fsus-motion-spring-stiffness',
  '--fsus-motion-trail',
  '--el-a11y-focus-color',
] as const

export const getDomVisualVariant = (projectName: string) => {
  switch (projectName) {
    case 'desktop-dark':
      return { theme: 'dark', compact: false }
    case 'mobile-dark':
      return { theme: 'dark', compact: true }
    case 'mobile-light':
      return { theme: 'light', compact: true }
    default:
      return { theme: 'light', compact: false }
  }
}

export const buildDomBoundaryUrl = (
  state: UiAuditState,
  projectName: string,
) => {
  const variant = getDomVisualVariant(projectName)
  const params = new URLSearchParams({
    audit: 'ui-boundaries',
    state,
    theme: variant.theme,
  })

  if (variant.compact) params.set('compact', '1')

  return `/?${params.toString()}`
}

export const buildDomVisualUrl = (mode: string, projectName: string) => {
  const variant = getDomVisualVariant(projectName)
  const params = new URLSearchParams({
    visual: mode,
    theme: variant.theme,
  })

  if (variant.compact) params.set('compact', '1')

  return `/?${params.toString()}`
}

export const waitForStableLayout = async (page: Page) => {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      }),
  )
}

const blockingSoftIssues = (issues: DomLayoutIssue[]) => {
  const groups = new Map<string, DomLayoutIssue[]>()

  for (const issue of issues) {
    if (issue.severity !== 'soft') continue
    const key = [issue.project, issue.state, issue.component ?? 'page'].join(
      '::',
    )
    groups.set(key, [...(groups.get(key) ?? []), issue])
  }

  return [...groups.values()].filter((group) => group.length >= 2).flat()
}

export const expectNoBlockingLayoutIssues = (issues: DomLayoutIssue[]) => {
  const blocking = [
    ...issues.filter((issue) => issue.severity === 'hard'),
    ...blockingSoftIssues(issues),
  ]

  expect(blocking).toEqual([])
}

export const collectTokenIssues = async (
  page: Page,
  context: DomLayoutContext,
): Promise<DomLayoutIssue[]> =>
  page.evaluate(
    ({ context, requiredTokens }) => {
      const resolvedColor = (token: string) => {
        const probe = document.createElement('span')
        probe.style.color = `var(${token})`
        document.body.appendChild(probe)
        const value = getComputedStyle(probe).color
        probe.remove()
        return value
      }
      const resolvedLength = (token: string) => {
        const probe = document.createElement('span')
        probe.style.position = 'absolute'
        probe.style.visibility = 'hidden'
        probe.style.width = `var(${token})`
        document.body.appendChild(probe)
        const value = Number.parseFloat(getComputedStyle(probe).width)
        probe.remove()
        return Number.isFinite(value) ? value : 0
      }
      const rootStyle = getComputedStyle(document.documentElement)
      const issues = requiredTokens.flatMap((token) => {
        const value = rootStyle.getPropertyValue(token).trim()
        return value
          ? []
          : [
              {
                ...context,
                detail: `${token} is not resolved`,
                kind: 'token-unresolved',
                severity: 'hard' as const,
              },
            ]
      })

      if (
        resolvedColor('--fsus-scholarly-blue') !==
        resolvedColor('--el-a11y-focus-color')
      ) {
        issues.push({
          ...context,
          detail: '--el-a11y-focus-color does not resolve to scholarly blue',
          kind: 'focus-token-drift',
          severity: 'hard',
        })
      }

      for (const token of ['--fsus-radius-control', '--fsus-radius-panel']) {
        if (resolvedLength(token) <= 0) {
          issues.push({
            ...context,
            detail: `${token} does not resolve to a positive length`,
            kind: 'length-token-invalid',
            severity: 'hard',
          })
        }
      }

      return issues
    },
    { context, requiredTokens },
  )

export const collectPageDomLayoutIssues = async (
  page: Page,
  context: DomLayoutContext,
): Promise<DomLayoutIssue[]> =>
  page.evaluate(
    ({ context, geometryTolerance }) => {
      const issues: DomLayoutIssue[] = []
      const { clientWidth, scrollWidth } = document.documentElement

      if (scrollWidth > clientWidth + geometryTolerance) {
        issues.push({
          ...context,
          detail: `document scrollWidth ${scrollWidth} > clientWidth ${clientWidth}`,
          kind: 'page-horizontal-overflow',
          severity: 'hard',
        })
      }

      return issues
    },
    { context, geometryTolerance },
  )

export const collectFloatingViewportIssues = async (
  page: Page,
  context: DomLayoutContext,
): Promise<DomLayoutIssue[]> =>
  page.evaluate(
    ({ context, geometryTolerance }) => {
      const floatingSelector = [
        '.el-popper',
        '.el-select__popper',
        '.el-dropdown__popper',
        '.el-cascader__dropdown',
        '.el-picker__popper',
        '.el-tooltip__popper',
        '.el-tooltip-v2__content',
        '.el-popover',
        '.el-overlay',
        '.el-dialog',
        '.el-drawer',
        '.el-image-viewer__wrapper',
      ].join(',')
      const issues: DomLayoutIssue[] = []

      for (const floating of Array.from(
        document.querySelectorAll<HTMLElement>(floatingSelector),
      )) {
        const style = getComputedStyle(floating)
        const rect = floating.getBoundingClientRect()
        if (
          style.display === 'none' ||
          style.visibility === 'hidden' ||
          Number(style.opacity) === 0 ||
          rect.width <= 0 ||
          rect.height <= 0
        ) {
          continue
        }

        if (
          rect.left < -geometryTolerance ||
          rect.top < -geometryTolerance ||
          rect.right > window.innerWidth + geometryTolerance ||
          rect.bottom > window.innerHeight + geometryTolerance
        ) {
          issues.push({
            ...context,
            detail: `${floating.className} ${rect.left},${rect.top},${rect.right},${rect.bottom} outside ${window.innerWidth}x${window.innerHeight}`,
            kind: 'floating-viewport-clipping',
            severity: 'hard',
          })
        }
      }

      return issues
    },
    { context, geometryTolerance },
  )

export const collectComponentDomLayoutIssues = async (
  componentCard: Locator,
  context: DomLayoutContext,
): Promise<DomLayoutIssue[]> =>
  componentCard.evaluate(
    (element, { context, geometryTolerance, radiusTolerance }) => {
      const issues: DomLayoutIssue[] = []
      const card = element as HTMLElement
      const cardStyle = getComputedStyle(card)
      const cardRect = card.getBoundingClientRect()
      const px = (value: string) => {
        const parsed = Number.parseFloat(value)
        return Number.isFinite(parsed) ? parsed : 0
      }
      const resolvedLength = (token: string) => {
        const probe = document.createElement('span')
        probe.style.position = 'absolute'
        probe.style.visibility = 'hidden'
        probe.style.width = `var(${token})`
        document.body.appendChild(probe)
        const value = px(getComputedStyle(probe).width)
        probe.remove()
        return value
      }
      const add = (
        severity: DomLayoutSeverity,
        kind: string,
        detail: string,
      ) => {
        issues.push({ ...context, detail, kind, severity })
      }
      const isElementVisible = (node: HTMLElement) => {
        const style = getComputedStyle(node)
        const rect = node.getBoundingClientRect()
        return (
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          Number(style.opacity) !== 0 &&
          rect.width > 0 &&
          rect.height > 0
        )
      }
      const isIntentionalHorizontalScroll = (node: HTMLElement) => {
        const style = getComputedStyle(node)
        if (/(auto|scroll|overlay)/.test(style.overflowX)) return true
        return Boolean(
          node.closest(
            [
              '.el-carousel',
              '.el-carousel__container',
              '.el-carousel__item',
              '.el-scrollbar__wrap',
              '.el-table__body-wrapper',
              '.el-table-v2__main',
              '.el-vl__window',
              '.el-vg__window',
              '.el-tree-virtual-list',
              '.el-transfer-panel__list',
              '.el-cascader-panel',
              '.el-picker-panel',
              '.el-tooltip-v2__content',
            ].join(','),
          ),
        )
      }

      if (cardRect.width <= 0 || cardRect.height <= 0) {
        add(
          'hard',
          'component-zero-size',
          `${cardRect.width}x${cardRect.height}`,
        )
      }

      if (cardStyle.visibility === 'hidden' || cardStyle.display === 'none') {
        add('hard', 'component-invisible', cardStyle.display)
      }

      const centerX = Math.min(
        Math.max(cardRect.left + cardRect.width / 2, 1),
        window.innerWidth - 1,
      )
      const centerY = Math.min(
        Math.max(cardRect.top + cardRect.height / 2, 1),
        window.innerHeight - 1,
      )
      const hit = document.elementFromPoint(centerX, centerY)
      if (
        hit &&
        !card.contains(hit) &&
        !(hit as HTMLElement).closest('.el-overlay,.el-popper,.el-popover')
      ) {
        add(
          'hard',
          'component-hit-test-blocked',
          `center hit ${(hit as HTMLElement).className || hit.nodeName}`,
        )
      }

      const cardRadius = px(cardStyle.borderTopLeftRadius)
      const tokenCardRadius = resolvedLength('--el-card-border-radius')
      if (
        tokenCardRadius > 0 &&
        Math.abs(cardRadius - tokenCardRadius) > radiusTolerance
      ) {
        add(
          'soft',
          'component-radius-token-drift',
          `card radius ${cardRadius} != token ${tokenCardRadius}`,
        )
      }

      const controlSelector = [
        '.el-button:not(.is-round)',
        '.el-input__wrapper',
        '.el-select__wrapper',
        '.el-select-v2__wrapper',
        '.el-textarea__inner',
        '.el-color-picker__trigger',
        '.el-tag',
        '.el-check-tag',
      ].join(',')
      const tokenControlRadius = resolvedLength('--fsus-radius-control')

      for (const control of Array.from(
        card.querySelectorAll<HTMLElement>(controlSelector),
      ).slice(0, 12)) {
        if (!isElementVisible(control)) continue
        if (control.closest('.el-button-group')) continue
        const radius = px(getComputedStyle(control).borderTopLeftRadius)
        if (
          tokenControlRadius > 0 &&
          radius < tokenControlRadius - radiusTolerance
        ) {
          add(
            'soft',
            'control-radius-token-drift',
            `${control.className} radius ${radius} < token ${tokenControlRadius}`,
          )
        }
      }

      for (const node of Array.from(
        card.querySelectorAll<HTMLElement>('*'),
      ).slice(0, 220)) {
        if (!isElementVisible(node)) continue
        if (node.scrollWidth > node.clientWidth + geometryTolerance) {
          if (!isIntentionalHorizontalScroll(node)) {
            add(
              'soft',
              'descendant-horizontal-overflow',
              `${node.className || node.nodeName} scrollWidth ${node.scrollWidth} > clientWidth ${node.clientWidth}`,
            )
          }
        }
      }

      const floatingSelector = [
        '.el-popper',
        '.el-select__popper',
        '.el-dropdown__popper',
        '.el-cascader__dropdown',
        '.el-picker__popper',
        '.el-tooltip__popper',
        '.el-tooltip-v2__content',
        '.el-popover',
        '.el-overlay',
        '.el-dialog',
        '.el-drawer',
        '.el-image-viewer__wrapper',
      ].join(',')

      for (const floating of Array.from(
        card.querySelectorAll<HTMLElement>(floatingSelector),
      )) {
        if (!isElementVisible(floating)) continue
        const rect = floating.getBoundingClientRect()
        if (
          rect.left < -geometryTolerance ||
          rect.top < -geometryTolerance ||
          rect.right > window.innerWidth + geometryTolerance ||
          rect.bottom > window.innerHeight + geometryTolerance
        ) {
          add(
            'hard',
            'floating-viewport-clipping',
            `${floating.className} ${rect.left},${rect.top},${rect.right},${rect.bottom} outside ${window.innerWidth}x${window.innerHeight}`,
          )
        }
      }

      return issues
    },
    { context, geometryTolerance, radiusTolerance },
  )

export const assertScrollMotionState = async (
  host: Locator,
  scrollTarget: Locator,
  context: DomLayoutContext,
) => {
  await expect(host).toBeVisible()
  await scrollTarget.evaluate((element) => {
    element.scrollTop = Math.max(element.scrollTop + 88, 88)
    element.dispatchEvent(new Event('scroll'))
  })
  await expect(host).toHaveClass(/is-scrolling/)

  await scrollTarget.evaluate((element) => {
    const maxScrollTop = Math.max(0, element.scrollHeight - element.clientHeight)
    const current = element.scrollTop
    const next =
      current + 32 <= maxScrollTop ? current + 32 : Math.max(0, current - 32)

    if (next !== current) {
      element.scrollTop = next
    }
    element.dispatchEvent(new Event('scroll'))
  })
  await expect(host).toHaveClass(/is-scrolling/)

  const readMetrics = () =>
    host.evaluate((element) => {
      const content =
        element.querySelector<HTMLElement>('.el-vl__inner > *') ??
        element.querySelector<HTMLElement>('.el-scrollbar__view > *')
      const verticalThumb = element.querySelector<HTMLElement>(
        '.el-scrollbar__bar.is-vertical .el-scrollbar__thumb',
      )
      const thumbs = Array.from(
        element.querySelectorAll<HTMLElement>('.el-scrollbar__thumb'),
      )
      const thumb =
        verticalThumb ??
        thumbs.find((candidate) => {
          const style = getComputedStyle(candidate)
          return style.boxShadow !== 'none'
        }) ?? thumbs[0]

      if (!content || !thumb) {
        throw new Error('scroll motion internals are missing')
      }

      const contentStyle = getComputedStyle(content)
      const thumbStyle = getComputedStyle(thumb)
      const hostBeforeStyle = getComputedStyle(element, '::before')
      const hostAfterStyle = getComputedStyle(element, '::after')

      return {
        contentFilter: contentStyle.filter,
        contentTransform: contentStyle.transform,
        edgeTrail:
          Number.parseFloat(hostBeforeStyle.opacity) > 0 ||
          Number.parseFloat(hostAfterStyle.opacity) > 0,
        interactiveGlow: Number.parseFloat(
          element.style.getPropertyValue('--fsus-interactive-motion-glow'),
        ),
        interactiveOffsetY: element.style.getPropertyValue(
          '--fsus-interactive-motion-offset-y',
        ),
        interactiveStrength: Number.parseFloat(
          element.style.getPropertyValue('--fsus-interactive-motion-strength'),
        ),
        thumbShadow: thumbStyle.boxShadow,
      }
    })

  await expect
    .poll(
      async () => {
        const metrics = await readMetrics()
        return {
          contentMotion: metrics.contentTransform !== 'none',
          interactiveVars: metrics.interactiveStrength > 0,
          trail: metrics.thumbShadow !== 'none' || metrics.edgeTrail,
        }
      },
      {
        message: `${context.component} scroll motion computed style`,
        timeout: 1200,
      },
    )
    .toEqual({ contentMotion: true, interactiveVars: true, trail: true })

  const metrics = await readMetrics()

  const blurRadius = (filter: string) => {
    const match = /blur\(([\d.]+)px\)/.exec(filter)
    return match ? Number.parseFloat(match[1]) : 0
  }

  expect(
    blurRadius(metrics.contentFilter),
    `${context.component} content should not blur text while scrolling`,
  ).toBeLessThanOrEqual(0.05)

  await expect(host).not.toHaveClass(/is-scrolling/, { timeout: 900 })
}
