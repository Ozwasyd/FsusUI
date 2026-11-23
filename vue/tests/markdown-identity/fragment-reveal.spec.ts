import { expect, test } from '@playwright/test'
import type {} from './main'

test.use({
  launchOptions: { chromiumSandbox: true },
  viewport: { width: 1000, height: 700 },
})

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

test('reveals an initially unmounted chunk on the first request', async ({
  page,
}) => {
  const observed = await page.evaluate(async () => {
    const { renderer, scroller, unmount } = await window.mountFragmentFixture()
    const waitFrame = () =>
      new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    try {
      while (!renderer.locateFragment('#last').found) await waitFrame()
      const before = renderer.locateFragment('#harbor')
      const initialScroll = scroller.scrollTop
      const revealed = await renderer.revealFragment('#harbor')
      await waitFrame()
      await waitFrame()
      const after = renderer.locateFragment('#harbor')
      const top = after.element?.getBoundingClientRect().top
      const viewport = scroller.getBoundingClientRect()
      return {
        before: { found: before.found, mounted: before.mounted },
        initialScroll,
        revealed: {
          ok: revealed.ok,
          id: revealed.id,
          sameChunk: revealed.chunkKey === before.chunkKey,
        },
        mountedAfterFrames: after.mounted,
        visibleAfterFrames:
          top !== undefined && top >= viewport.top - 1 && top < viewport.bottom,
      }
    } finally {
      unmount()
    }
  })
  expect(observed).toEqual({
    before: { found: true, mounted: false },
    initialScroll: 0,
    revealed: { ok: true, id: 'harbor', sameChunk: true },
    mountedAfterFrames: true,
    visibleAfterFrames: true,
  })
})

test('a newer reveal cancels the older request and unmount settles a pending reveal', async ({
  page,
}) => {
  const observed = await page.evaluate(async () => {
    const first = await window.mountFragmentFixture(true)
    while (!first.renderer.locateFragment('#last').found)
      await new Promise(requestAnimationFrame)
    const cancelled = first.renderer.revealFragment('#harbor')
    const current = first.renderer.revealFragment('#detail', {
      behavior: 'instant',
      block: 'nearest',
    })
    const [old, latest] = await Promise.all([cancelled, current])
    first.unmount()

    const second = await window.mountFragmentFixture()
    while (!second.renderer.locateFragment('#last').found)
      await new Promise(requestAnimationFrame)
    const pending = second.renderer.revealFragment('#harbor')
    second.unmount()
    return { old: old.ok, latest: latest.ok, unmounted: (await pending).ok }
  })
  expect(observed).toEqual({ old: false, latest: true, unmounted: false })
})

test('preserves explicit fenced-code fragment IDs after Shiki code highlighting activates', async ({
  page,
}) => {
  const observed = await page.evaluate(async () => {
    const inspect = async (codeHighlight: boolean) => {
      const fixture =
        await window.mountHighlightedCodeFragmentFixture(codeHighlight)
      try {
        await fixture.renderComplete
        const pre = fixture.host.querySelector('pre')
        const sampleMatches = fixture.host.querySelectorAll('#sample').length
        const located = fixture.renderer.locateFragment('#sample')
        const revealed = await fixture.renderer.revealFragment('#sample')
        return {
          highlighted: pre?.getAttribute('data-code-highlighted') ?? '',
          codeId: pre?.id ?? '',
          sampleMatches,
          found: located.found,
          mounted: located.mounted,
          revealedOk: revealed.ok,
          headingFound: fixture.renderer.locateFragment('#harbor').found,
          paragraphFound: fixture.renderer.locateFragment('#detail').found,
        }
      } finally {
        fixture.unmount()
      }
    }

    return {
      withoutHighlight: await inspect(false),
      withHighlight: await inspect(true),
    }
  })

  expect(observed.withoutHighlight).toEqual({
    highlighted: '',
    codeId: 'sample',
    sampleMatches: 1,
    found: true,
    mounted: true,
    revealedOk: true,
    headingFound: true,
    paragraphFound: true,
  })
  expect(observed.withHighlight).toEqual({
    highlighted: 'shiki',
    codeId: 'sample',
    sampleMatches: 1,
    found: true,
    mounted: true,
    revealedOk: true,
    headingFound: true,
    paragraphFound: true,
  })
})
