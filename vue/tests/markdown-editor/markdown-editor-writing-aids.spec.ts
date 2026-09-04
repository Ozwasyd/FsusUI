import { writeFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'

import type { Page } from '@playwright/test'

const openFixture = async (page: Page, theme: 'light' | 'dark', query = '') => {
  await page.goto(
    `/?audit=ui-states&markdownWritingAids=1&theme=${theme}${query}`,
    {
      waitUntil: 'domcontentloaded',
    },
  )
  const fixture = page.getByTestId('markdown-writing-aids-fixture')
  await expect(fixture).toBeVisible()
  await expect(page.locator('vite-error-overlay')).toHaveCount(0)
  return fixture
}

const presentationFits = async (editor: ReturnType<Page['locator']>) => {
  const layer = editor.locator('.el-markdown-editor__focus-layer')
  const active = layer.locator('span:not(.is-dimmed)').filter({
    hasText: '::embed[target="details" mode="block"]',
  })
  const [layerBox, activeBox] = await Promise.all([
    layer.boundingBox(),
    active.boundingBox(),
  ])
  return Boolean(
    layerBox &&
    activeBox &&
    activeBox.x >= layerBox.x - 1 &&
    activeBox.x + activeBox.width <= layerBox.x + layerBox.width + 1 &&
    activeBox.y >= layerBox.y - 1 &&
    activeBox.y + activeBox.height <= layerBox.y + layerBox.height + 1,
  )
}

test('renders focus mode and reveals a source range on desktop and mobile', async ({
  page,
}, testInfo) => {
  const desktop = await openFixture(page, 'light')
  const desktopEditor = desktop.locator('.el-markdown-editor')
  const textarea = desktopEditor.locator('textarea')

  await expect(desktopEditor).toHaveAttribute(
    'data-markdown-focus-enabled',
    'true',
  )
  await expect(
    desktopEditor.locator('.el-markdown-editor__focus-layer'),
  ).toBeVisible()
  await desktop.getByTestId('markdown-reveal-details').click()
  await expect(desktop.getByTestId('markdown-reveal-status')).toHaveText(
    '1072:success',
  )
  await expect(textarea).toBeFocused()
  await expect
    .poll(() =>
      textarea.evaluate(
        (element) => window.getComputedStyle(element).backgroundColor,
      ),
    )
    .toBe('rgba(0, 0, 0, 0)')
  await expect(desktopEditor).toHaveAttribute(
    'data-markdown-writing-aids-state',
    'explicit-navigation',
  )
  expect(
    await textarea.evaluate((element) => {
      const target = element as HTMLTextAreaElement
      return target.value.slice(
        target.selectionStart,
        target.selectionStart + 38,
      )
    }),
  ).toBe('::embed[target="details" mode="block"]')
  await expect
    .poll(() => desktopEditor.locator('.is-dimmed').count())
    .toBeGreaterThan(0)
  await expect(
    desktopEditor
      .locator('.el-markdown-editor__focus-layer span:not(.is-dimmed)')
      .filter({ hasText: '::embed[target="details" mode="block"]' }),
  ).toBeVisible()
  await expect
    .poll(async () => {
      const layer = desktopEditor.locator('.el-markdown-editor__focus-layer')
      const [textareaScrollTop, layerScrollTop] = await Promise.all([
        textarea.evaluate((element) => element.scrollTop),
        layer.evaluate((element) => element.scrollTop),
      ])
      return Math.abs(textareaScrollTop - layerScrollTop)
    })
    .toBeLessThanOrEqual(1)
  await expect.poll(() => presentationFits(desktopEditor)).toBe(true)
  await desktop.screenshot({
    path: testInfo.outputPath('writing-aids-light-desktop.png'),
  })

  await page.setViewportSize({ width: 390, height: 844 })
  const mobile = await openFixture(page, 'dark', '&markdownDirection=rtl')
  const mobileEditor = mobile.locator('.el-markdown-editor')
  await expect(
    mobileEditor.locator('.el-markdown-editor__focus-layer'),
  ).toBeVisible()
  await mobile.getByTestId('markdown-reveal-details').click()
  await expect(mobile.getByTestId('markdown-reveal-status')).toHaveText(
    '1072:success',
  )
  await expect(mobileEditor.locator('textarea')).toBeFocused()
  await expect.poll(() => presentationFits(mobileEditor)).toBe(true)
  expect(
    await mobileEditor.evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    ),
  ).toBe(true)
  for (const zoom of ['1.5', '2']) {
    await page.evaluate((value) => {
      document.documentElement.style.zoom = value
    }, zoom)
    await expect.poll(() => presentationFits(mobileEditor)).toBe(true)
  }
  await mobile.screenshot({
    path: testInfo.outputPath('writing-aids-dark-mobile.png'),
  })
})

test('fails closed, mounts an exact virtual target, and preserves keyboard and SR semantics', async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const fixture = await openFixture(page, 'light')
  const editor = fixture.locator('.el-markdown-editor')
  const textarea = editor.locator('textarea')
  const missingButton = fixture.getByTestId('markdown-reveal-missing')
  const initialSelection = await textarea.evaluate((element) => {
    const target = element as HTMLTextAreaElement
    return [target.selectionStart, target.selectionEnd]
  })

  await missingButton.click()
  await expect(fixture.getByTestId('markdown-reveal-status')).toHaveText(
    'missing:not-found',
  )
  await expect(missingButton).toBeFocused()
  expect(
    await textarea.evaluate((element) => {
      const target = element as HTMLTextAreaElement
      return [target.selectionStart, target.selectionEnd]
    }),
  ).toEqual(initialSelection)

  await page.evaluate(() => {
    const textarea = document.querySelector<HTMLTextAreaElement>(
      '[data-testid="markdown-writing-aids-fixture"] textarea',
    )
    if (!textarea) throw new Error('writing-aids textarea missing')
    const calls: ScrollToOptions[] = []
    Object.defineProperty(window, '__markdownScrollCalls', {
      configurable: true,
      value: calls,
    })
    textarea.scrollTo = (options?: ScrollToOptions | number) => {
      if (typeof options === 'object') calls.push(options)
    }
  })
  const nestedScroll = fixture.getByTestId(
    'markdown-writing-aids-nested-scroll',
  )
  await nestedScroll.evaluate((element) => {
    element.scrollTop = 20
  })
  const nestedScrollBefore = await nestedScroll.evaluate(
    (element) => element.scrollTop,
  )
  await fixture.getByTestId('markdown-reveal-virtual').click()
  await expect(fixture.getByTestId('markdown-reveal-status')).toHaveText(
    'virtual:success',
  )
  await expect(textarea).toBeFocused()
  expect(
    await nestedScroll.evaluate((element) => element.scrollTop),
  ).toBe(nestedScrollBefore)
  expect(
    await page.evaluate(
      () =>
        (
          window as Window & {
            __markdownScrollCalls?: ScrollToOptions[]
          }
        ).__markdownScrollCalls?.every((call) => call.behavior !== 'smooth') ??
        false,
    ),
  ).toBe(true)

  const layer = editor.locator('.el-markdown-editor__focus-layer')
  await expect(layer).toHaveAttribute('aria-hidden', 'true')
  await expect(fixture.getByRole('textbox')).toHaveCount(1)
  await writeFile(
    testInfo.outputPath('writing-aids-accessibility-tree-simulation.txt'),
    await fixture.ariaSnapshot(),
    'utf8',
  )

  await textarea.dispatchEvent('wheel')
  await expect(editor).toHaveAttribute(
    'data-markdown-writing-aids-state',
    'user-scroll-suspended',
  )
  await fixture.getByTestId('markdown-reveal-virtual').click()
  await textarea.dispatchEvent('touchmove')
  await expect(editor).toHaveAttribute(
    'data-markdown-writing-aids-state',
    'user-scroll-suspended',
  )
  await textarea.dispatchEvent('pointerdown')
  await expect(editor).toHaveAttribute(
    'data-markdown-writing-aids-state',
    'selection-drag-suspended',
  )
  await textarea.dispatchEvent('pointerup')
  await expect(editor).toHaveAttribute(
    'data-markdown-writing-aids-state',
    'idle',
  )
  await textarea.dispatchEvent('compositionstart')
  await expect(editor).toHaveAttribute(
    'data-markdown-writing-aids-state',
    'composition-suspended',
  )
  await textarea.dispatchEvent('compositionend', { data: '' })
  await expect(editor).toHaveAttribute(
    'data-markdown-writing-aids-state',
    'idle',
  )
  await textarea.press('PageDown')
  await expect(editor).toHaveAttribute(
    'data-markdown-writing-aids-state',
    'user-scroll-suspended',
  )

  await fixture.getByTestId('markdown-mode-preview').click()
  await expect(editor).toHaveAttribute('data-markdown-focus-enabled', 'false')
  await expect(layer).toHaveCount(0)
  await fixture.getByTestId('markdown-mode-live').click()
  await expect(editor).toHaveAttribute('data-markdown-focus-enabled', 'true')
})

test('covers aid combinations across the 375/768/1366/1440 viewport matrix', async ({
  page,
}, testInfo) => {
  const combos = [
    { combo: 'focus', focus: true, typewriter: false },
    { combo: 'typewriter', focus: false, typewriter: true },
    { combo: 'both', focus: true, typewriter: true },
    { combo: 'none', focus: false, typewriter: false },
  ] as const

  for (const width of [375, 768, 1366, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    for (const { combo, focus, typewriter } of combos) {
      const fixture = await openFixture(
        page,
        'light',
        `&markdownWritingAidsCombo=${combo}&markdownHeadingCount=200`,
      )
      const editor = fixture.locator('.el-markdown-editor')
      const textarea = editor.locator('textarea')

      await expect(editor).toHaveAttribute(
        'data-markdown-focus-enabled',
        String(focus),
      )
      await expect(
        editor.locator('.el-markdown-editor__focus-layer'),
      ).toHaveCount(focus ? 1 : 0)

      await textarea.click()
      if (typewriter) {
        // Jumping to the document end is manual navigation: it suspends the
        // typewriter immediately. ArrowUp then places the caret away from the
        // end while keeping a non-zero user-owned scroll position.
        await textarea.press('Control+End')
        await expect(editor).toHaveAttribute(
          'data-markdown-writing-aids-state',
          'user-scroll-suspended',
        )
        for (let press = 0; press < 30; press += 1) {
          await textarea.press('ArrowUp')
        }
        const userScrollTop = await textarea.evaluate(
          (element) => element.scrollTop,
        )
        expect(userScrollTop).toBeGreaterThan(0)

        // The first input after a suspend passes through `restoring` and
        // must not steal the scroll back instantly.
        await page.keyboard.type('x')
        await expect(editor).toHaveAttribute(
          'data-markdown-writing-aids-state',
          'restoring',
        )
        expect(
          await textarea.evaluate((element) => element.scrollTop),
        ).toBe(userScrollTop)

        // The second input resumes input-driven positioning. The exact anchor
        // ratio is pinned by the unit contract; browser-native caret scrolling
        // may already have placed this caret at the same target offset.
        await page.keyboard.type('x')
        await expect(editor).toHaveAttribute(
          'data-markdown-writing-aids-state',
          'input-driven',
        )
      } else {
        // Without the typewriter aid, typing never advances the state
        // machine, even though the click placed the caret.
        await page.keyboard.type('x')
        await expect(editor).toHaveAttribute(
          'data-markdown-writing-aids-state',
          'idle',
        )
      }
      if (focus) {
        await expect
          .poll(() => editor.locator('.is-dimmed').count())
          .toBeGreaterThan(0)
      }

      // Manual wheel input suspends the typewriter without fighting back.
      await textarea.dispatchEvent('wheel')
      await expect(editor).toHaveAttribute(
        'data-markdown-writing-aids-state',
        'user-scroll-suspended',
      )

      await fixture.screenshot({
        path: testInfo.outputPath(
          `writing-aids-combo-${combo}-${width}.png`,
        ),
      })
    }
  }
})
