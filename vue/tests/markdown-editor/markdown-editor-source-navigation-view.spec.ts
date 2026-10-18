import { resolve } from 'node:path'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

const fixture = `/@fs${resolve('vue/tests/markdown-editor/source-navigation-view.fixture.html')}`
const ready = async (page: Page, query = '') => {
  await page.goto(`${fixture}${query}`)
  await page.evaluate(() => document.fonts.ready)
  await page.waitForFunction(() => !!window.sourceViewFixture)
  await page.evaluate(() => window.sourceViewFixture.reveal('backward'))
  await page.waitForFunction(() => window.sourceViewFixture.read() !== null)
}
for (const direction of ['backward', 'forward'] as const) {
  test(`measures original ${direction} focus endpoint, native viewport and progress`, async ({
    page,
  }, testInfo) => {
    await ready(page)
    if (direction === 'forward')
      await page.evaluate(() => window.sourceViewFixture.reveal('forward'))
    const value = await page.evaluate(() => {
      const api = window.sourceViewFixture
      const view = api.hold()!
      const input = document.querySelector('textarea')!
      const native = input.getBoundingClientRect()
      const layer = document.querySelector('.el-markdown-editor__focus-layer')!
      if (layer.textContent !== api.source)
        throw new Error('independent-layout-source-mismatch')
      const offset =
        input.selectionDirection === 'backward'
          ? input.selectionStart
          : input.selectionEnd
      const walker = document.createTreeWalker(layer, NodeFilter.SHOW_TEXT)
      const range = document.createRange()
      let passed = 0
      while (walker.nextNode()) {
        const length = walker.currentNode.textContent!.length
        if (
          offset < passed + length ||
          (offset === passed + length &&
            input.selectionDirection !== 'backward')
        ) {
          range.setStart(walker.currentNode, offset - passed)
          range.collapse(true)
          break
        }
        passed += length
      }
      const endpoint = range.getBoundingClientRect()
      return {
        view,
        current: api.current(),
        selection: {
          start: input.selectionStart,
          end: input.selectionEnd,
          direction: input.selectionDirection,
        },
        expectedOffset: endpoint.top - native.top - input.clientTop,
        progress: input.scrollTop / (input.scrollHeight - input.clientHeight),
        viewportStart: native.top + input.clientTop,
        viewportHeight:
          Math.min(
            native.top + input.clientTop + input.clientHeight,
            innerHeight,
          ) -
          native.top -
          input.clientTop,
      }
    })
    await testInfo.attach('native-source-view', {
      body: JSON.stringify(value, null, 2),
      contentType: 'application/json',
    })
    await page.screenshot({
      path: testInfo.outputPath(`source-view-${direction}.png`),
    })
    expect(value.current).toBe(true)
    expect(value.view.selection).toEqual(value.selection)
    expect(value.view.affinity).toBe(
      direction === 'backward' ? 'before' : 'after',
    )
    expect(value.view.focusOffset).toBe(
      direction === 'backward' ? value.selection.start : value.selection.end,
    )
    expect(
      Math.abs(value.view.viewportOffset - value.expectedOffset),
    ).toBeLessThanOrEqual(1)
    expect(value.view.viewportOffset).toBeGreaterThan(0)
    expect(value.view.percentage).toBeCloseTo(value.progress, 12)
    expect(value.view.viewport.blockStart).toBe(value.viewportStart)
    expect(value.view.viewport.height).toBe(value.viewportHeight)
  })
}
test('both readers are synchronous and leave native state, DOM and resource custody unchanged', async ({
  page,
}) => {
  await ready(page)
  await page.waitForTimeout(100)
  const result = await page.evaluate(() =>
    window.sourceViewFixture.readonlyWitness(),
  )
  expect(result.view).not.toBeNull()
  expect(result.current).toBe(true)
  expect(result.synchronous).toBe(true)
  expect(result.mutations).toBe(0)
  expect(result.after).toEqual(result.before)
})
test('rejects copies, another issuer, cloned and genuinely foreign sessions and wrong expected state', async ({
  page,
}) => {
  await ready(page)
  const result = await page.evaluate(() => {
    const api = window.sourceViewFixture
    api.hold()
    return {
      current: api.current(),
      copy: api.copyCurrent(),
      foreign: api.foreignCurrent(),
      foreignSession: api.foreignSession(),
      cloned: api.clonedSession(),
      wrong: api.wrongExpected(),
      stillCurrent: api.current(),
    }
  })
  expect(result).toEqual({
    current: true,
    copy: false,
    foreign: false,
    foreignSession: null,
    cloned: null,
    wrong: null,
    stillCurrent: true,
  })
})
test('preserves original abort reasons and admission exceptions from both readers', async ({
  page,
}) => {
  await ready(page)
  expect(await page.evaluate(() => window.sourceViewFixture.errors())).toEqual({
    readAdmission: true,
    currentAdmission: true,
    readAbort: true,
    currentAbort: true,
  })
})
test('observes actual programmatic scroll without classifying it as manual intent', async ({
  page,
}) => {
  await ready(page)
  await page.evaluate(() => {
    window.sourceViewFixture.hold()
    document.querySelector('textarea')!.scrollTop += 40
  })
  expect(await page.evaluate(() => window.sourceViewFixture.current())).toBe(
    false,
  )
  await page.waitForFunction(() => window.sourceViewFixture.read() !== null)
  const result = await page.evaluate(() => {
    const input = document.querySelector('textarea')!
    return {
      view: window.sourceViewFixture.read(),
      expected: input.scrollTop / (input.scrollHeight - input.clientHeight),
      events: window.sourceViewFixture.events,
    }
  })
  expect(result.view!.percentage).toBeCloseTo(result.expected, 12)
  expect(result.events).toEqual([])
})
test('fences CSSOM geometry drift and does not revive an old generation after restoration', async ({
  page,
}) => {
  await ready(page)
  const result = await page.evaluate(() => {
    const api = window.sourceViewFixture
    api.hold()
    const sheet = new CSSStyleSheet()
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet]
    sheet.insertRule('main { position: relative; top: 31px; }')
    const changed = api.current()
    sheet.deleteRule(0)
    return { changed, restored: api.current(), fresh: api.read() !== null }
  })
  expect(result).toEqual({ changed: false, restored: false, fresh: true })
})
test('refuses stale text styles instead of returning cached geometry', async ({
  page,
}) => {
  await ready(page)
  const result = await page.evaluate(() => {
    const api = window.sourceViewFixture
    api.hold()
    const sheet = new CSSStyleSheet()
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet]
    sheet.insertRule('textarea { line-height: 41px !important; }')
    const current = api.current()
    const value = api.read()
    sheet.deleteRule(0)
    return { current, value, oldRestored: api.current() }
  })
  expect(result).toEqual({ current: false, value: null, oldRestored: false })
})
test('uses actual reduced-motion changes and clipped viewport height', async ({
  page,
}) => {
  await ready(page)
  await page.evaluate(() => window.sourceViewFixture.hold())
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.waitForFunction(
    () => window.sourceViewFixture.read()?.viewport.reducedMotion === true,
  )
  expect(await page.evaluate(() => window.sourceViewFixture.current())).toBe(
    false,
  )
  await page.setViewportSize({ width: 1280, height: 500 })
  await page.waitForFunction(() => window.sourceViewFixture.read() !== null)
  const result = await page.evaluate(() => {
    const view = window.sourceViewFixture.read()!
    return { view, expected: innerHeight - view.viewport.blockStart }
  })
  expect(result.view.viewport.height).toBe(result.expected)
})
test('preserves zero progress only for the actual native no-scroll range', async ({
  page,
}) => {
  await ready(page, '?short=1')
  const result = await page.evaluate(() => ({
    view: window.sourceViewFixture.read(),
    range:
      document.querySelector('textarea')!.scrollHeight -
      document.querySelector('textarea')!.clientHeight,
  }))
  expect(result.range).toBe(0)
  expect(result.view!.percentage).toBe(0)
})
test('trusted manual input notifies, while timer clearance never announces resume', async ({
  page,
}) => {
  await ready(page)
  await page.evaluate(() => window.sourceViewFixture.hold())
  await page.locator('textarea').first().hover()
  await page.mouse.wheel(0, 100)
  await page.waitForFunction(() => window.sourceViewFixture.events.length > 0)
  expect(await page.evaluate(() => window.sourceViewFixture.current())).toBe(
    false,
  )
  const before = await page.evaluate(() => window.sourceViewFixture.events)
  expect(before.some((event) => event.gesture === 'wheel')).toBe(true)
  await page.waitForTimeout(300)
  expect(await page.evaluate(() => window.sourceViewFixture.events)).toEqual(
    before,
  )
})
for (const action of [
  'mode',
  'epoch',
  'unmount',
  'pause',
  'transaction',
] as const) {
  test(`retires the observation on ${action}`, async ({ page }) => {
    await ready(page)
    await page.evaluate((action) => {
      const api = window.sourceViewFixture
      api.hold()
      if (action === 'pause') api.pause()
      else api.change(action)
    }, action)
    await page.waitForFunction(
      () => window.sourceViewFixture.current() === false,
    )
    expect(
      await page.evaluate(() => window.sourceViewFixture.read()),
    ).toBeNull()
  })
}
test('admission-time physical drift cannot issue an observation', async ({
  page,
}) => {
  await ready(page)
  expect(await page.evaluate(() => window.sourceViewFixture.race())).toBeNull()
})

test('rejects raw native selection drift before canonical selection catches up', async ({
  page,
}) => {
  await ready(page)
  const result = await page.evaluate(() => {
    const api = window.sourceViewFixture
    api.hold()
    document.querySelector('textarea')!.setSelectionRange(0, 1, 'forward')
    return { current: api.current(), value: api.read() }
  })
  expect(result).toEqual({ current: false, value: null })
})

test('measures the usable viewport from a real nested rectangular scroll clip', async ({
  page,
}) => {
  await page.goto(`${fixture}?clip=1`)
  await page.evaluate(() => document.fonts.ready)
  await page.locator('textarea').first().click()
  await page.waitForFunction(() => window.sourceViewFixture.read() !== null)
  const result = await page.evaluate(() => {
    const view = window.sourceViewFixture.read()!
    const input = document.querySelector('textarea')!
    const box = input.getBoundingClientRect()
    const clip = document.querySelector('.clip')!.getBoundingClientRect()
    const top = Math.max(box.top + input.clientTop, clip.top)
    const bottom = Math.min(
      box.top + input.clientTop + input.clientHeight,
      clip.bottom,
      innerHeight,
    )
    return { view, start: top, height: bottom - top }
  })
  expect(result.view.viewport.blockStart).toBe(result.start)
  expect(result.view.viewport.height).toBe(result.height)
  expect(result.view.viewport.height).toBeLessThan(250)
})

test('returns null for hidden native geometry and never revives the prior view', async ({
  page,
}) => {
  await ready(page)
  const result = await page.evaluate(() => {
    const api = window.sourceViewFixture
    api.hold()
    const main = document.querySelector('main')!
    main.style.display = 'none'
    const hidden = api.read()
    const current = api.current()
    main.style.display = ''
    return { hidden, current, restored: api.current() }
  })
  expect(result).toEqual({ hidden: null, current: false, restored: false })
})

test('retires a source view across actual native font loading', async ({
  page,
}) => {
  await ready(page)
  const result = await page.evaluate(async () => {
    const api = window.sourceViewFixture
    api.hold()
    const font = new FontFace(
      'SourceViewRealFont',
      'url(/@fs/workspace/reveal-candidate/dotnet/FsusUI.Avalonia.HeadlessTests/Assets/Fonts/GoogleSans-Regular.ttf)',
    )
    document.fonts.add(font)
    document.querySelector('textarea')!.style.fontFamily = 'SourceViewRealFont'
    await document.fonts.load('18px SourceViewRealFont')
    await document.fonts.ready
    return { status: font.status, oldCurrent: api.current() }
  })
  expect(result).toEqual({ status: 'loaded', oldCurrent: false })
})
