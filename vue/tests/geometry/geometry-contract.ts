import { expect } from '@playwright/test'
import type { Locator, Page, TestInfo } from '@playwright/test'

export type GeometryCase = {
  component: string
  focusSelector: string
  hitSelector: string
  peerSelector?: string
  root: Locator
  viewport: number
  zoom: number
}

type Rect = {
  bottom: number
  height: number
  left: number
  right: number
  top: number
  width: number
}

type GeometryFailure = {
  actual: unknown
  component: string
  expected: string
  kind: string
  selector: string
  viewport: number
  zoom: number
}

const settle = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      }),
  )

export const openGeometryFixture = async (
  page: Page,
  route: string,
  ready: string,
) => {
  await page.goto(route, { waitUntil: 'domcontentloaded' })
  await expect(page.locator(ready)).toBeVisible()
  await expect(page.locator('vite-error-overlay')).toHaveCount(0)
}

export const runGeometryContract = async (
  page: Page,
  testInfo: TestInfo,
  geometryCase: GeometryCase,
) => {
  const {
    component,
    focusSelector,
    hitSelector,
    peerSelector,
    root,
    viewport,
    zoom,
  } = geometryCase

  // CSS zoom is the repository's deterministic browser-zoom surrogate. Give
  // it the corresponding physical viewport so the effective CSS viewport
  // remains the matrix width (for example 480px at 150% => 320 CSS px).
  await page.setViewportSize({
    width: Math.round(viewport * zoom),
    height: Math.round(1600 * zoom),
  })
  await page.evaluate((factor) => {
    document.documentElement.style.zoom = String(factor)
  }, zoom)
  await settle(page)
  await expect(root).toBeVisible()
  await root.scrollIntoViewIfNeeded()
  await settle(page)

  const failures = await root.evaluate(
    (rootNode, { component, hitSelector, peerSelector, viewport, zoom }) => {
      const root = rootNode as HTMLElement
      const failures: GeometryFailure[] = []
      const tolerance = 1
      const visible = (node: HTMLElement) => {
        const style = getComputedStyle(node)
        const box = node.getBoundingClientRect()
        return (
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          Number(style.opacity) > 0 &&
          box.width > 0 &&
          box.height > 0
        )
      }
      const visuallyHidden = (node: HTMLElement) => {
        const style = getComputedStyle(node)
        const box = node.getBoundingClientRect()
        return (
          (box.width <= 1 && box.height <= 1) ||
          style.clip !== 'auto' ||
          style.clipPath === 'inset(50%)'
        )
      }
      const rect = (node: HTMLElement): Rect => {
        const value = node.getBoundingClientRect()
        return {
          bottom: value.bottom,
          height: value.height,
          left: value.left,
          right: value.right,
          top: value.top,
          width: value.width,
        }
      }
      const selector = (node: HTMLElement) => {
        if (node.id) return `#${CSS.escape(node.id)}`
        const testId = node.getAttribute('data-testid')
        if (testId) return `[data-testid="${testId}"]`
        const path: string[] = []
        let current: HTMLElement | null = node
        while (current && current !== root && path.length < 4) {
          const part = current.classList.length
            ? `${current.tagName.toLowerCase()}.${[...current.classList]
                .slice(0, 2)
                .map((name) => CSS.escape(name))
                .join('.')}`
            : current.tagName.toLowerCase()
          path.unshift(part)
          current = current.parentElement
        }
        return `${component} ${path.join(' > ')}`
      }
      const add = (
        kind: string,
        node: HTMLElement,
        actual: unknown,
        expected: string,
      ) =>
        failures.push({
          actual,
          component,
          expected,
          kind,
          selector: selector(node),
          viewport,
          zoom,
        })

      const pageWidth = document.documentElement.clientWidth
      const pageScrollWidth = Math.max(
        document.documentElement.scrollWidth,
        document.body.scrollWidth,
      )
      if (pageScrollWidth > pageWidth + tolerance) {
        add(
          'page-horizontal-overflow',
          root,
          { clientWidth: pageWidth, scrollWidth: pageScrollWidth },
          'document scrollWidth <= clientWidth + 1px',
        )
      }

      const rootRect = rect(root)
      if (
        rootRect.left < -tolerance ||
        rootRect.right > window.innerWidth + tolerance
      ) {
        add(
          'component-outside-viewport',
          root,
          rootRect,
          'root left/right inside viewport',
        )
      }

      for (const node of [
        root,
        ...root.querySelectorAll<HTMLElement>('*'),
      ].slice(0, 600)) {
        if (!visible(node)) continue
        if (node.scrollWidth <= node.clientWidth + tolerance) continue
        const style = getComputedStyle(node)
        const scrollable = /(auto|scroll)/.test(style.overflowX)
        if (!scrollable) continue
        const scrollbarCompensation =
          node.classList.contains('el-scrollbar__wrap--hidden-default') &&
          node.scrollWidth - node.clientWidth <= 20
        if (scrollbarCompensation) continue
        const discoverable =
          node.tabIndex >= 0 ||
          node.getAttribute('role') === 'region' ||
          Boolean(
            node.querySelector(
              '.el-table__scroll-affordance,[data-scroll-affordance]',
            ),
          ) ||
          Boolean(
            node
              .closest('.el-table')
              ?.querySelector('.el-table__scroll-affordance'),
          )
        if (!discoverable) {
          add(
            'overflow-without-affordance',
            node,
            {
              clientWidth: node.clientWidth,
              overflowX: style.overflowX,
              scrollWidth: node.scrollWidth,
              tabIndex: node.tabIndex,
            },
            'no overflow, or explicit scroll container with keyboard/visual affordance',
          )
        }
      }

      for (const node of root.querySelectorAll<HTMLElement>('*')) {
        if (!visible(node)) continue
        if (visuallyHidden(node)) continue
        const style = getComputedStyle(node)
        if (!/(hidden|clip)/.test(`${style.overflowX} ${style.overflowY}`)) {
          continue
        }
        const ownText = [...node.childNodes]
          .filter((child) => child.nodeType === Node.TEXT_NODE)
          .map((child) => child.textContent?.trim() ?? '')
          .join(' ')
          .trim()
        if (!ownText) continue
        const clipped =
          node.scrollWidth > node.clientWidth + tolerance ||
          node.scrollHeight > node.clientHeight + tolerance
        const fullPathDisclosure = [...root.querySelectorAll<HTMLElement>('*')]
          .filter((candidate) => !visible(candidate))
          .some((candidate) => (candidate.textContent ?? '').includes(ownText))
        const named =
          Boolean(node.getAttribute('title')) ||
          Boolean(node.getAttribute('aria-label')) ||
          fullPathDisclosure
        if (clipped && !named) {
          add(
            'silently-clipped-text',
            node,
            {
              clientHeight: node.clientHeight,
              clientWidth: node.clientWidth,
              scrollHeight: node.scrollHeight,
              scrollWidth: node.scrollWidth,
              text: ownText.slice(0, 120),
            },
            'text fits, or clipping has title/aria-label disclosure',
          )
        }
      }

      for (const target of root.querySelectorAll<HTMLElement>(hitSelector)) {
        if (!visible(target)) continue
        const box = rect(target)
        if (box.width + tolerance < 40 || box.height + tolerance < 40) {
          add(
            'hit-target-too-small',
            target,
            box,
            'visible interactive rectangle >= 40x40px',
          )
        }
      }

      if (peerSelector) {
        const peers = [
          ...root.querySelectorAll<HTMLElement>(peerSelector),
        ].filter(visible)
        for (let index = 0; index < peers.length; index += 1) {
          const left = rect(peers[index])
          for (let next = index + 1; next < peers.length; next += 1) {
            const right = rect(peers[next])
            const width = Math.max(
              0,
              Math.min(left.right, right.right) -
                Math.max(left.left, right.left),
            )
            const height = Math.max(
              0,
              Math.min(left.bottom, right.bottom) -
                Math.max(left.top, right.top),
            )
            if (width * height > tolerance) {
              add(
                'unexpected-overlap',
                peers[next],
                {
                  area: width * height,
                  first: { rect: left, selector: selector(peers[index]) },
                  second: { rect: right, selector: selector(peers[next]) },
                },
                'peer bounding-box intersection area = 0',
              )
            }
          }
        }
      }

      return failures
    },
    { component, hitSelector, peerSelector, viewport, zoom },
  )

  const focusTargets = root.locator(focusSelector)
  const focusCount = Math.min(await focusTargets.count(), 6)
  for (let index = 0; index < focusCount; index += 1) {
    const target = focusTargets.nth(index)
    if (!(await target.isVisible())) continue
    const before = await target.boundingBox()
    await target.focus()
    const focusFailure = await target.evaluate(
      (node, { component, viewport, zoom }) => {
        const target = node as HTMLElement
        const rect = target.getBoundingClientRect()
        const style = getComputedStyle(target)
        const outlineWidth =
          style.outlineStyle === 'none'
            ? 0
            : Number.parseFloat(style.outlineWidth) || 0
        const outlineOffset = Number.parseFloat(style.outlineOffset) || 0
        const expansion = Math.max(0, outlineWidth + outlineOffset)
        const focusRect = {
          bottom: rect.bottom + expansion,
          left: rect.left - expansion,
          right: rect.right + expansion,
          top: rect.top - expansion,
        }
        let ancestor = target.parentElement
        while (ancestor) {
          const ancestorStyle = getComputedStyle(ancestor)
          if (
            /(hidden|clip)/.test(
              `${ancestorStyle.overflowX} ${ancestorStyle.overflowY}`,
            )
          ) {
            const boundary = ancestor.getBoundingClientRect()
            if (
              focusRect.left < boundary.left - 2 ||
              focusRect.right > boundary.right + 2 ||
              focusRect.top < boundary.top - 2 ||
              focusRect.bottom > boundary.bottom + 2
            ) {
              return {
                actual: { boundary, focusRect },
                component,
                expected: 'focus-visible rect is not overflow-clipped',
                kind: 'focus-ring-clipped',
                selector:
                  target.id ||
                  target.getAttribute('aria-label') ||
                  target.className,
                viewport,
                zoom,
              } satisfies GeometryFailure
            }
          }
          ancestor = ancestor.parentElement
        }
        return null
      },
      { component, viewport, zoom },
    )
    if (focusFailure) failures.push(focusFailure)
    const after = await target.boundingBox()
    if (before && after) {
      const delta = Math.max(
        Math.abs(before.x - after.x),
        Math.abs(before.y - after.y),
        Math.abs(before.width - after.width),
        Math.abs(before.height - after.height),
      )
      if (delta > 2) {
        failures.push({
          actual: { after, before, delta },
          component,
          expected: 'focused and visual control bounding boxes differ <= 2px',
          kind: 'focus-bbox-drift',
          selector: `${focusSelector}:nth(${index})`,
          viewport,
          zoom,
        })
      }
    }
  }

  const evidence = {
    component,
    failures,
    viewport,
    zoom,
  }
  await testInfo.attach(
    `geometry-${component}-${viewport}-${Math.round(zoom * 100)}.json`,
    {
      body: Buffer.from(`${JSON.stringify(evidence, null, 2)}\n`),
      contentType: 'application/json',
    },
  )

  if (failures.length > 0) {
    await testInfo.attach(
      `geometry-${component}-${viewport}-${Math.round(zoom * 100)}.png`,
      {
        body: await root.screenshot({ animations: 'disabled' }),
        contentType: 'image/png',
      },
    )
  }

  expect(
    failures,
    `${component} geometry failures at ${viewport}px / ${Math.round(zoom * 100)}%`,
  ).toEqual([])
}
