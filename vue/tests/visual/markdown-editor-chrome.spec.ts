import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { attachPageDiagnostics } from '../support/page-diagnostics'
import { test as visualTest } from '../support/visual-variant-fixture'
import { buildVisualUrl } from '../../../scripts/visual-variant.mjs'

// #429 acceptance: framed/embedded/minimal × source/live/split/preview with
// real rendered geometry, focus, slot, error/fallback, device, and
// accessibility evidence on one candidate. No chrome feature work happens
// here; every assertion binds the public chrome/mode contract.

const CHROME_VARIANTS = ['framed', 'embedded', 'minimal'] as const
const MODES = ['source', 'live', 'split', 'preview'] as const
const VISUAL_SECTION = 'markdown-editor-chrome-visual'
const EDITOR_SELECTOR = '.el-markdown-editor'

const nsModeClass = (mode: string) => `el-markdown-editor__mode--${mode}`

const diagnostics = new WeakMap<Page, string[]>()

const stabilizePage = async (page: Page) => {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        transition-duration: 0s !important;
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        scroll-behavior: auto !important;
        caret-color: transparent !important;
      }
    `,
  })
}

const waitForFontsAndLayout = async (page: Page) => {
  await page.evaluate(async () => {
    await document.fonts.ready
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    })
  })
}

const openChromeCell = async (
  page: Page,
  projectName: string,
  query: Record<string, string> = {},
) => {
  await page.goto(buildVisualUrl(VISUAL_SECTION, projectName, query), {
    waitUntil: 'domcontentloaded',
  })
  await expect(page.locator('vite-error-overlay')).toHaveCount(0)
  const editor = page.locator(EDITOR_SELECTOR)
  await expect(editor).toBeVisible()
  await stabilizePage(page)
  await waitForFontsAndLayout(page)
  // The frame scheduler samples per-frame metrics; an empty pending queue
  // means every scheduled layout commit has settled for this cell.
  await expect
    .poll(async () => editor.getAttribute('data-markdown-frame-metrics'))
    .not.toBeNull()
  return editor
}

const expectSurfacePlan = async (
  editor: ReturnType<Page['locator']>,
  mode: string,
) => {
  const textarea = editor.locator('textarea')
  const renderer = editor.locator('[data-markdown-renderer]')
  // Mode class contract: the root carries the active mode modifier.
  await expect(editor).toHaveClass(new RegExp(`el-markdown-editor--${mode}`))
  // Single logical input/selection owner: the source textarea stays the
  // owner in source/live/split and only preview hides it. The renderer
  // element belongs to split/preview only; live composes decorations over
  // the input owner instead of a second surface.
  await expect(textarea).toHaveCount(1)
  if (mode === 'preview') {
    await expect(textarea).toBeHidden()
  } else {
    await expect(textarea).toBeVisible()
  }
  await expect(renderer).toHaveCount(
    mode === 'split' || mode === 'preview' ? 1 : 0,
  )
  if (mode === 'split' || mode === 'preview') {
    await expect(renderer).toBeVisible()
    await expect
      .poll(async () => (await renderer.textContent())?.length ?? 0, {
        timeout: 30_000,
      })
      .toBeGreaterThan(0)
  }
  if (mode === 'live') {
    // Live projection decorations exist over the single input owner; they
    // are aria-hidden presentation, never a second editable surface.
    await expect(
      editor.locator('[data-markdown-live-decorations]'),
    ).toHaveCount(1)
  }
}

const expectChromeRegions = async (
  page: Page,
  editor: ReturnType<Page['locator']>,
  chrome: string,
) => {
  // No empty shells: each region renders only when its chrome keeps it.
  await expect(editor.locator('.el-markdown-editor__toolbar')).toHaveCount(
    chrome === 'minimal' ? 0 : 1,
  )
  await expect(editor.locator('.el-markdown-editor__status')).toHaveCount(
    chrome === 'framed' ? 1 : 0,
  )
  // One editor instance, one scroll container pair, no second surface.
  await expect(editor).toHaveCount(1)
  await expect(page.locator('[data-markdown-scroll-container]')).toHaveCount(2)
}

const expectModeSwitcher = async (
  editor: ReturnType<Page['locator']>,
  chrome: string,
) => {
  // The minimal chrome leaves mode composition to the caller.
  await expect(editor.locator('[role="tablist"]')).toHaveCount(
    chrome === 'minimal' ? 0 : 1,
  )
}

test.beforeEach(async ({ page }) => {
  diagnostics.set(page, attachPageDiagnostics(page))
})

test.afterEach(async ({ page }) => {
  expect(diagnostics.get(page) ?? []).toEqual([])
})

test.describe('markdown editor chrome variants matrix (#429)', () => {
  for (const chrome of CHROME_VARIANTS) {
    for (const mode of MODES) {
      visualTest(
        `renders ${chrome} chrome in ${mode} mode with correct geometry and semantics`,
        async ({ page }, testInfo) => {
          const editor = await openChromeCell(page, testInfo.project.name, {
            chrome,
            mode,
          })

          await expectChromeRegions(page, editor, chrome)
          await expectModeSwitcher(editor, chrome)
          await expectSurfacePlan(editor, mode)

          // Focus ring stays on the control contract for every chrome, and
          // the textarea keeps its accessible label while it is the visible
          // input owner (preview hides it from the accessibility tree).
          await expect(editor).toHaveAttribute('data-markdown-instance', /.+/)
          if (mode !== 'preview') {
            await expect(editor.locator('textarea')).toHaveAccessibleName(/.+/)
          }

          // Chrome must not add decoration: no card/badge/glass artifacts on
          // the preview surface, and embedded/minimal drop the outer material.
          const rootBorder = await editor.evaluate((element) => {
            const style = getComputedStyle(element)
            return {
              borderColor: style.borderTopColor,
              borderStyle: style.borderTopStyle,
              borderRadius: style.borderTopLeftRadius,
            }
          })
          if (chrome === 'framed') {
            expect(rootBorder.borderStyle).not.toBe('none')
          } else {
            expect(rootBorder.borderStyle).toBe('none')
          }

          await expect(page).toHaveScreenshot([
            'chrome-matrix',
            `${chrome}-${mode}.png`,
          ])
        },
      )
    }
  }

  visualTest(
    'keeps one editor instance through rapid mode switches',
    async ({ page }, testInfo) => {
      const editor = await openChromeCell(page, testInfo.project.name, {
        chrome: 'framed',
        mode: 'source',
        state: 'long',
      })
      const textarea = editor.locator('textarea')
      const instanceId = await editor.getAttribute('data-markdown-instance')
      const valueBefore = await textarea.inputValue()
      await textarea.click()
      await textarea.evaluate((element) => {
        ;(element as HTMLTextAreaElement).setSelectionRange(2, 10, 'forward')
      })

      for (let round = 0; round < 2; round += 1) {
        for (const label of ['live', 'split', 'preview', 'source']) {
          // Locale labels are translated; switch by the stable mode class.
          // Compact mobile layouts keep only source and preview switchable;
          // hidden tabs stay in the DOM but must not be clicked.
          const tab = editor.locator(
            `[role="tablist"] button.${nsModeClass(label)}`,
          )
          if (!(await tab.isVisible())) continue
          await tab.click()
          await expect(editor).toHaveClass(
            new RegExp(`el-markdown-editor--${label}`),
          )
          if (label === 'preview') {
            await expect(
              editor.locator('[data-markdown-renderer]'),
            ).toBeVisible()
          }
        }
      }

      await expect(textarea).toBeVisible()
      await expect(editor).toHaveAttribute(
        'data-markdown-instance',
        instanceId ?? '',
      )
      expect(await textarea.inputValue()).toBe(valueBefore)
      expect(
        await textarea.evaluate(
          (element) =>
            `${(element as HTMLTextAreaElement).selectionStart}:${
              (element as HTMLTextAreaElement).selectionEnd
            }`,
        ),
      ).toBe('2:10')
    },
  )

  visualTest(
    'reaches editor controls by keyboard in every chrome',
    async ({ page }, testInfo) => {
      for (const chrome of CHROME_VARIANTS) {
        const editor = await openChromeCell(page, testInfo.project.name, {
          chrome,
          mode: 'source',
        })
        const textarea = editor.locator('textarea')
        let reached = false
        for (let step = 0; step < 24; step += 1) {
          if (
            await textarea.evaluate(
              (element) => element === element.ownerDocument.activeElement,
            )
          ) {
            reached = true
            break
          }
          await page.keyboard.press('Tab')
        }
        expect(reached, `${chrome}: keyboard reaches the input owner`).toBe(
          true,
        )

        const liveTab = editor.locator(
          `[role="tablist"] button.${nsModeClass('live')}`,
        )
        if (await liveTab.count()) {
          await liveTab.focus()
          await page.keyboard.press('Enter')
          await expect(editor).toHaveClass(/el-markdown-editor--live/)
        }
      }
    },
  )

  visualTest(
    'exposes an accessible tree without decorative chrome',
    async ({ page }, testInfo) => {
      for (const chrome of CHROME_VARIANTS) {
        const editor = await openChromeCell(page, testInfo.project.name, {
          chrome,
          mode: 'split',
        })
        await expect(editor).toHaveAttribute('data-markdown-instance', /.+/)
        // Screen-reader simulation evidence (local): the aria snapshot tree
        // must expose the labelled input owner and the rendered preview, plus
        // the mode tablist whenever the chrome keeps a mode switcher (minimal
        // leaves mode composition to the caller). No real screen reader
        // hardware is required; the aria tree is the a11y authority here.
        const snapshot = await editor.ariaSnapshot()
        expect(snapshot).toContain('textbox')
        if (chrome !== 'minimal') {
          expect(snapshot).toContain('tablist')
        }
        await testInfo.attach(`aria-tree-${chrome}.yml`, {
          body: snapshot,
          contentType: 'text/yaml',
        })
      }
    },
  )

  visualTest(
    'keeps geometry intact across 375/768/1366/1440 viewports',
    async ({ page, useVisualViewport }, testInfo) => {
      for (const [viewport, width] of [
        ['markdown-editor-375', 375],
        ['markdown-editor-768', 768],
        ['markdown-editor-1366', 1366],
        ['markdown-editor-1440', 1440],
      ] as const) {
        await useVisualViewport(viewport)
        const editor = await openChromeCell(page, testInfo.project.name, {
          chrome: 'framed',
          mode: 'live',
        })
        const overflow = await editor.evaluate((element) => {
          const root = element.ownerDocument.documentElement
          return root.scrollWidth - root.clientWidth
        })
        expect(
          overflow,
          `${width}px viewport must not introduce horizontal overflow`,
        ).toBeLessThanOrEqual(1)

        // Mutation gate for the mobile toolbar overlap: the mode switcher and
        // the action row must not intersect, so every switchable tab stays
        // reachable to pointer and touch input at narrow viewports.
        const modesRect = await editor
          .locator('.el-markdown-editor__modes')
          .boundingBox()
        const actionsRect = await editor
          .locator('.el-markdown-editor__actions')
          .boundingBox()
        if (modesRect && actionsRect) {
          const intersects =
            modesRect.x < actionsRect.x + actionsRect.width &&
            actionsRect.x < modesRect.x + modesRect.width &&
            modesRect.y < actionsRect.y + actionsRect.height &&
            actionsRect.y < modesRect.y + modesRect.height
          expect(
            intersects,
            `${width}px viewport must not overlay actions on the mode switcher`,
          ).toBe(false)
        }
        await expect(
          editor.locator('.el-markdown-editor__status'),
        ).toBeVisible()
      }
    },
  )

  visualTest(
    'stays usable at 150% and 200% zoom',
    async ({ page }, testInfo) => {
      for (const zoom of [1.5, 2]) {
        const editor = await openChromeCell(page, testInfo.project.name, {
          chrome: 'embedded',
          mode: 'split',
        })
        await editor.evaluate((element, zoomValue) => {
          ;(element as HTMLElement).style.zoom = String(zoomValue)
        }, zoom)
        await waitForFontsAndLayout(page)
        const overflow = await editor.evaluate((element) => {
          const root = element.ownerDocument.documentElement
          return root.scrollWidth - root.clientWidth
        })
        expect(overflow).toBeLessThanOrEqual(1)
        await expect(page).toHaveScreenshot([
          'chrome-evidence',
          `zoom-${Math.round(zoom * 100)}.png`,
        ])
      }
    },
  )

  visualTest(
    'responds to touch activation on the mode switcher',
    async ({ browser }, testInfo) => {
      const context = await browser.newContext({
        hasTouch: true,
        viewport: { width: 768, height: 1024 },
      })
      const page = await context.newPage()
      const editor = await openChromeCell(page, testInfo.project.name, {
        chrome: 'framed',
        mode: 'source',
      })
      const liveTab = editor.locator(
        `[role="tablist"] button.${nsModeClass('live')}`,
      )
      await liveTab.tap()
      await expect(editor).toHaveClass(/el-markdown-editor--live/)
      await context.close()
    },
  )

  visualTest(
    'renders toolbar, status, and slot visibility contract',
    async ({ page }, testInfo) => {
      const editor = await openChromeCell(page, testInfo.project.name, {
        chrome: 'framed',
        mode: 'source',
        status: 'hidden',
      })
      await expect(editor.locator('.el-markdown-editor__status')).toHaveCount(0)

      const withoutToolbar = await openChromeCell(page, testInfo.project.name, {
        chrome: 'framed',
        mode: 'source',
        toolbar: 'off',
      })
      await expect(
        withoutToolbar.locator('.el-markdown-editor__toolbar'),
      ).toHaveCount(0)

      const slotted = await openChromeCell(page, testInfo.project.name, {
        chrome: 'framed',
        mode: 'source',
        slot: 'status',
      })
      await expect(
        slotted.getByTestId('chrome-visual-status-slot'),
      ).toContainText('已同步到草稿箱')
    },
  )

  visualTest(
    'covers empty, disabled, loading, and readonly states',
    async ({ page }, testInfo) => {
      const empty = await openChromeCell(page, testInfo.project.name, {
        chrome: 'framed',
        mode: 'source',
        state: 'empty',
      })
      await expect(empty.locator('textarea')).toHaveAttribute(
        'placeholder',
        /.+/,
      )

      const disabled = await openChromeCell(page, testInfo.project.name, {
        chrome: 'framed',
        mode: 'source',
        state: 'disabled',
      })
      await expect(disabled.locator('textarea')).toBeDisabled()

      const loading = await openChromeCell(page, testInfo.project.name, {
        chrome: 'framed',
        mode: 'source',
        state: 'loading',
      })
      await expect(loading.locator('textarea')).toHaveAttribute(
        'aria-busy',
        'true',
      )

      const readonly = await openChromeCell(page, testInfo.project.name, {
        chrome: 'framed',
        mode: 'source',
        state: 'readonly',
      })
      await expect(readonly.locator('textarea')).toHaveAttribute('readonly', '')

      const long = await openChromeCell(page, testInfo.project.name, {
        chrome: 'minimal',
        mode: 'preview',
        state: 'long',
      })
      await expect(long.locator('[data-markdown-renderer]')).toBeVisible()
    },
  )

  visualTest(
    'falls back without WebAssembly and stays operable',
    async ({ browser }, testInfo) => {
      // Capability fallback simulation (local): the .wasm asset is unavailable,
      // so the markdown runtime must degrade per its JavaScript fallback and
      // the editor must never expose a second input pipeline or crash.
      const context = await browser.newContext({
        viewport: { width: 1280, height: 900 },
      })
      const fallbackPage = await context.newPage()
      await fallbackPage.route('**/*.wasm', (route) => route.abort())
      await fallbackPage.goto(
        buildVisualUrl(VISUAL_SECTION, testInfo.project.name, {
          chrome: 'framed',
          mode: 'preview',
        }),
        { waitUntil: 'domcontentloaded' },
      )
      await expect(fallbackPage.locator('vite-error-overlay')).toHaveCount(0)
      const editor = fallbackPage.locator(EDITOR_SELECTOR)
      await expect(editor).toBeVisible()
      await expect(editor.locator('textarea')).toHaveCount(1)
      const renderer = editor.locator('[data-markdown-renderer]')
      await expect(renderer).toBeVisible()
      await expect
        .poll(async () => (await renderer.textContent())?.length ?? 0, {
          timeout: 30_000,
        })
        .toBeGreaterThan(0)
      const evidence = {
        candidate: process.env.GITHUB_SHA ?? 'local',
        fixture:
          'markdown-editor-chrome-visual preview with .wasm requests aborted',
        textareaCount: await editor.locator('textarea').count(),
        rendererCount: await renderer.count(),
      }
      await testInfo.attach('projection-fallback.json', {
        body: JSON.stringify(evidence, null, 2),
        contentType: 'application/json',
      })
      await context.close()
    },
  )

  visualTest(
    'keeps framed geometry under forced colors',
    async ({ page }, testInfo) => {
      await page.emulateMedia({ forcedColors: 'active' })
      const editor = await openChromeCell(page, testInfo.project.name, {
        chrome: 'framed',
        mode: 'source',
      })
      const border = await editor.evaluate((element) => {
        const style = getComputedStyle(element)
        return { color: style.borderTopColor, style: style.borderTopStyle }
      })
      expect(border.style).not.toBe('none')
      await expect(page).toHaveScreenshot([
        'chrome-evidence',
        'forced-colors.png',
      ])
    },
  )
})
