import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { expect, test } from '@playwright/test'

import type { Locator, Page } from '@playwright/test'

const initialValue = 'A😀éאב\n- 列表'

const installClipboardSnapshot = async (
  page: Page,
  snapshot: { html: string; plain: string },
) => {
  await page.addInitScript((value) => {
    const state = { reads: 0 }
    Object.defineProperty(window, '__fsusPasteClipboardState', {
      configurable: true,
      value: state,
    })
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        async read() {
          state.reads += 1
          return [
            {
              types: ['text/html', 'text/plain'],
              async getType(type: string) {
                if (type === 'text/html') {
                  return new Blob([value.html], { type })
                }
                if (type === 'text/plain') {
                  return new Blob([value.plain], { type })
                }
                throw new DOMException('Unsupported clipboard type')
              },
            },
          ]
        },
      },
    })
  }, snapshot)
}

const openFixture = async (
  page: Page,
  gate?: 'disabled' | 'preview-only' | 'readonly',
) => {
  const suffix = gate ? `&markdownPasteGate=${gate}` : ''
  await page.goto(`/?audit=ui-states&markdownEditorTransaction=1${suffix}`, {
    waitUntil: 'domcontentloaded',
  })
  const fixture = page.getByTestId('markdown-editor-transaction-fixture')
  await expect(fixture).toBeVisible()
  await expect(page.locator('vite-error-overlay')).toHaveCount(0)
  return {
    fixture,
    textarea: fixture.locator('.el-markdown-editor textarea'),
  }
}

const pasteAsMarkdownEntry = async (page: Page, fixture: Locator) => {
  const entry = fixture.getByRole('button', { name: 'Paste as Markdown' })
  if (!(await entry.isVisible().catch(() => false))) {
    const overflow = fixture.locator('.el-markdown-editor__command-more')
    if (await overflow.isVisible().catch(() => false)) await overflow.click()
  }
  await expect(entry).toBeVisible()
  return entry
}

const visiblePasteAsMarkdownDialog = (page: Page) =>
  page
    .locator('.el-markdown-editor__paste-backdrop:visible')
    .getByRole('dialog', { name: 'Paste as Markdown' })

const openPasteAsMarkdown = async (page: Page, fixture: Locator) => {
  const entry = await pasteAsMarkdownEntry(page, fixture)
  await entry.click()
  const surface = visiblePasteAsMarkdownDialog(page)
  await expect(surface).toBeVisible()
  return surface
}

const expectPasteModalLayering = async (page: Page, surface: Locator) => {
  const underlyingControl = page
    .locator('.audit-safe-area-lab__controls')
    .getByRole('button', { name: 'Open Overlay', exact: true })
  await underlyingControl.evaluate((element) => {
    element.scrollIntoView({ block: 'center', inline: 'start' })
  })
  await expect(underlyingControl).toBeVisible()

  const layering = await underlyingControl.evaluate((element) => {
    const control = element as HTMLElement
    const backdrop = document.querySelector<HTMLElement>(
      '.el-markdown-editor__paste-backdrop',
    )
    const dialog = backdrop?.querySelector<HTMLElement>('[role="dialog"]')
    if (!backdrop || !dialog) throw new Error('Paste modal is not mounted')

    control.dataset.modalPointerProbe = '0'
    control.addEventListener(
      'pointerdown',
      () => {
        control.dataset.modalPointerProbe = '1'
      },
      { once: true },
    )

    const controlRect = control.getBoundingClientRect()
    const dialogRect = dialog.getBoundingClientRect()
    const x = controlRect.left + controlRect.width / 2
    const y = controlRect.top + controlRect.height / 2
    const top = document.elementFromPoint(x, y)
    const stack = document.elementsFromPoint(x, y)
    const modalIndex = stack.findIndex(
      (candidate) => candidate === backdrop || backdrop.contains(candidate),
    )
    const controlIndex = stack.findIndex(
      (candidate) => candidate === control || control.contains(candidate),
    )
    const rawZIndex = getComputedStyle(backdrop).zIndex
    const zIndex = Number(rawZIndex)

    return {
      controlIndex,
      modalBeforeControl:
        modalIndex >= 0 && (controlIndex < 0 || modalIndex < controlIndex),
      pointOutsideDialog:
        x < dialogRect.left ||
        x > dialogRect.right ||
        y < dialogRect.top ||
        y > dialogRect.bottom,
      rawZIndex,
      topOwnedByModal: top !== null && backdrop.contains(top),
      topOwnedByUnderlying:
        top === control || (top !== null && control.contains(top)),
      x,
      y,
      zIndex,
      zIndexIsFinitePositive: Number.isFinite(zIndex) && zIndex > 0,
    }
  })

  await page.mouse.click(layering.x, layering.y)
  const underlyingPointerCount = Number(
    await underlyingControl.getAttribute('data-modal-pointer-probe'),
  )

  expect(layering.pointOutsideDialog).toBe(true)
  expect(layering.rawZIndex).toBe('2000')
  expect(layering.zIndexIsFinitePositive).toBe(true)
  expect(layering.modalBeforeControl).toBe(true)
  expect(layering.topOwnedByModal).toBe(true)
  expect(layering.topOwnedByUnderlying).toBe(false)
  expect(underlyingPointerCount).toBe(0)
  await expect(surface).toBeVisible()
}

const selectionOf = (textarea: Locator) =>
  textarea.evaluate((element) => {
    const target = element as HTMLTextAreaElement
    return {
      direction: target.selectionDirection,
      end: target.selectionEnd,
      start: target.selectionStart,
    }
  })

const dispatchOrdinaryPaste = async (textarea: Locator) => {
  return textarea.evaluate((element) => {
    const target = element as HTMLTextAreaElement
    target.focus()
    target.setSelectionRange(target.value.length, target.value.length)
    const transfer = new DataTransfer()
    transfer.setData('text/html', '<strong>Rich paste</strong>')
    transfer.setData('text/plain', 'Plain paste')
    const paste = new ClipboardEvent('paste', {
      bubbles: true,
      cancelable: true,
      clipboardData: transfer,
    })
    const supported =
      paste.clipboardData?.getData('text/html') ===
        '<strong>Rich paste</strong>' &&
      paste.clipboardData.getData('text/plain') === 'Plain paste'
    target.dispatchEvent(paste)
    if (supported) return 'clipboard-transfer' as const

    target.dispatchEvent(
      new InputEvent('beforeinput', {
        bubbles: true,
        data: 'Plain paste',
        inputType: 'insertFromPaste',
      }),
    )
    target.value += 'Plain paste'
    target.setSelectionRange(target.value.length, target.value.length)
    target.dispatchEvent(
      new InputEvent('input', {
        bubbles: true,
        data: 'Plain paste',
        inputType: 'insertFromPaste',
      }),
    )
    return 'beforeinput-input' as const
  })
}

test('keeps ordinary Ctrl+V unchanged and opens only the explicit command', async ({
  browserName,
  page,
}) => {
  await installClipboardSnapshot(page, {
    html: [
      '<div><u>flattened</u>',
      '<custom-element>unsupported</custom-element>',
      '<script>removed()</script></div>',
    ].join(''),
    plain: 'Plain clipboard authority',
  })
  const { fixture, textarea } = await openFixture(page)

  const pasteHarness = await dispatchOrdinaryPaste(textarea)
  expect(pasteHarness).toBe(
    browserName === 'firefox' ? 'beforeinput-input' : 'clipboard-transfer',
  )
  await expect(textarea).toHaveValue(`${initialValue}Plain paste`)
  const ordinaryTransaction = JSON.parse(
    (
      await fixture
        .getByTestId('markdown-editor-last-transaction')
        .textContent()
    )?.trim() || 'null',
  ) as {
    accepted: boolean
    transaction: { history: string; origin: string }
    value: string
  }
  expect(ordinaryTransaction).toMatchObject({
    accepted: true,
    transaction: {
      history: 'separate',
      origin: 'paste',
    },
    value: `${initialValue}Plain paste`,
  })
  await expect(visiblePasteAsMarkdownDialog(page)).toHaveCount(0)
  await page.getByTestId('markdown-undo').click()
  await expect(textarea).toHaveValue(initialValue)

  await textarea.evaluate((element) => {
    const target = element as HTMLTextAreaElement
    target.focus()
    target.setSelectionRange(1, 5, 'backward')
  })
  const surface = await openPasteAsMarkdown(page, fixture)
  await expectPasteModalLayering(page, surface)
  expect(
    await page.evaluate(
      () =>
        (
          window as unknown as {
            __fsusPasteClipboardState: { reads: number }
          }
        ).__fsusPasteClipboardState.reads,
    ),
  ).toBe(1)
  await expect(textarea).toHaveValue(initialValue)
  await expect(
    surface.getByRole('region', { name: /Markdown preview/i }),
  ).toContainText('flattened')
  await expect(
    surface.getByRole('region', { name: /source diff/i }),
  ).toBeVisible()
  const warnings = surface.getByRole('list', {
    name: /conversion warnings/i,
  })
  await expect(warnings).toContainText(/removed/i)
  await expect(warnings).toContainText(/flattened/i)
  await expect(warnings).toContainText(/unsupported/i)
  await expect(
    surface.getByRole('button', { name: /paste plain text/i }),
  ).toBeVisible()
  await expect(
    surface.getByRole('button', { name: /import markdown/i }),
  ).toBeVisible()

  const cancel = surface.getByRole('button', { name: /cancel/i })
  await cancel.focus()
  await cancel.press('Enter')
  await expect(surface).toHaveCount(0)
  await expect(textarea).toBeFocused()
  expect(await selectionOf(textarea)).toEqual({
    direction: 'backward',
    end: 5,
    start: 1,
  })
  await expect(textarea).toHaveValue(initialValue)
})

test('confirms one separate-history transaction and returns selection for one undo', async ({
  page,
}) => {
  await installClipboardSnapshot(page, {
    html: '<p><strong>Imported</strong></p>',
    plain: 'Imported plain',
  })
  const { fixture, textarea } = await openFixture(page)
  await textarea.evaluate((element) => {
    const target = element as HTMLTextAreaElement
    target.focus()
    target.setSelectionRange(target.value.length, target.value.length)
  })
  const surface = await openPasteAsMarkdown(page, fixture)
  await surface.getByRole('button', { name: /import markdown/i }).click()

  await expect(textarea).toHaveValue(`${initialValue}**Imported**`)
  await expect(textarea).toBeFocused()
  const transaction = JSON.parse(
    (
      await page.getByTestId('markdown-editor-last-transaction').textContent()
    )?.trim() || 'null',
  ) as {
    accepted: boolean
    history: { undoDepth: number }
    transaction: {
      changes: unknown[]
      history: string
      metadata: Record<string, unknown>
      origin: string
    }
  }
  expect(transaction).toMatchObject({
    accepted: true,
    history: { undoDepth: 1 },
    transaction: {
      changes: [{}],
      history: 'separate',
      metadata: {
        choice: 'markdown-import',
        command: 'paste-as-markdown',
      },
      origin: 'command',
    },
  })
  await page.getByTestId('markdown-undo').click()
  await expect(textarea).toHaveValue(initialValue)
})

test('rejects a stale preview instead of inserting at the new caret', async ({
  page,
}) => {
  await installClipboardSnapshot(page, {
    html: '<p><strong>Stale import</strong></p>',
    plain: 'Stale import',
  })
  const { fixture, textarea } = await openFixture(page)
  await textarea.evaluate((element) => {
    const target = element as HTMLTextAreaElement
    target.focus()
    target.setSelectionRange(target.value.length, target.value.length)
  })
  const surface = await openPasteAsMarkdown(page, fixture)

  await page.evaluate(() => {
    const control = document.querySelector<HTMLElement>(
      '[data-testid="markdown-programmatic"]',
    )
    control?.click()
  })
  await expect(textarea).toHaveValue(`${initialValue}【程序插入】`)
  await surface.getByRole('button', { name: /import markdown/i }).click()
  await expect(textarea).toHaveValue(`${initialValue}【程序插入】`)
  await expect(surface.getByRole('alert')).toContainText(/stale|changed/i)
})

for (const gate of ['disabled', 'preview-only', 'readonly'] as const) {
  test(`makes the ${gate} gate explicit to assistive technology`, async ({
    page,
  }) => {
    await installClipboardSnapshot(page, {
      html: '<p>blocked</p>',
      plain: 'blocked',
    })
    const { fixture } = await openFixture(page, gate)
    const entry = await pasteAsMarkdownEntry(page, fixture)
    await expect(entry).toBeDisabled()
    await expect(entry).toHaveAccessibleDescription(
      new RegExp(gate.replace('-', ' '), 'i'),
    )
  })
}

test('makes composition-active an explicit gate', async ({ page }) => {
  await installClipboardSnapshot(page, {
    html: '<p>blocked</p>',
    plain: 'blocked',
  })
  const { fixture, textarea } = await openFixture(page)
  await textarea.focus()
  await textarea.dispatchEvent('compositionstart')
  const entry = await pasteAsMarkdownEntry(page, fixture)
  await expect(entry).toBeDisabled()
  await expect(entry).toHaveAccessibleDescription(/composition/i)
})

test.describe('touch path', () => {
  test.use({ hasTouch: true })

  test('chooses Markdown import by touch and returns focus to the editor', async ({
    page,
  }) => {
    await installClipboardSnapshot(page, {
      html: '<strong>Touch import</strong>',
      plain: 'Touch plain',
    })
    const viewports = [
      { height: 844, width: 390 },
      { height: 640, width: 320 },
    ]
    const triggerGeometry = []

    for (const viewport of viewports) {
      await page.setViewportSize(viewport)
      const { fixture } = await openFixture(page)
      const commands = fixture.locator('.el-markdown-editor__commands')
      const trigger = fixture.locator('.el-markdown-editor__command-more')
      await expect(commands).toBeVisible()
      await commands.evaluate((element) => {
        const container = element as HTMLElement
        container.scrollIntoView({ block: 'center', inline: 'nearest' })
        container.scrollLeft = 0
      })
      await expect(trigger).toBeAttached()
      triggerGeometry.push(
        await trigger.evaluate((element) => {
          const target = element as HTMLElement
          const container = target.closest<HTMLElement>(
            '.el-markdown-editor__commands',
          )
          if (!container) throw new Error('Command strip is not mounted')
          const targetRect = target.getBoundingClientRect()
          const containerRect = container.getBoundingClientRect()
          const left = Math.max(targetRect.left, containerRect.left, 0)
          const right = Math.min(
            targetRect.right,
            containerRect.right,
            window.innerWidth,
          )
          const top = Math.max(targetRect.top, containerRect.top, 0)
          const bottom = Math.min(
            targetRect.bottom,
            containerRect.bottom,
            window.innerHeight,
          )
          const x = left + Math.max(0, right - left) / 2
          const y = top + Math.max(0, bottom - top) / 2
          const hit =
            right > left && bottom > top
              ? document.elementFromPoint(x, y)
              : null

          return {
            clientWidth: container.clientWidth,
            directlyTappable:
              hit === target || (hit !== null && target.contains(hit)),
            scrollLeft: container.scrollLeft,
            scrollWidth: container.scrollWidth,
            targetHeight: targetRect.height,
            targetWidth: targetRect.width,
            viewport: {
              height: window.innerHeight,
              width: window.innerWidth,
            },
            visibleHeight: Math.max(0, bottom - top),
            visibleWidth: Math.max(0, right - left),
          }
        }),
      )
    }

    expect(
      triggerGeometry.every(
        (geometry) =>
          geometry.scrollLeft === 0 &&
          geometry.scrollWidth > geometry.clientWidth &&
          geometry.targetHeight >= 44 &&
          geometry.targetWidth >= 44 &&
          geometry.visibleHeight >= 44 &&
          geometry.visibleWidth >= 44 &&
          geometry.directlyTappable,
      ),
      `Pre-scroll overflow geometry: ${JSON.stringify(triggerGeometry)}`,
    ).toBe(true)

    for (const viewport of viewports) {
      await page.setViewportSize(viewport)
      const { fixture, textarea } = await openFixture(page)
      await textarea.tap()
      const trigger = fixture.locator('.el-markdown-editor__command-more')
      await trigger.tap()
      await expect(trigger).toHaveAttribute('aria-expanded', 'true')
      const expandedTriggerReadability = await trigger.evaluate((element) => {
        const target = element as HTMLElement
        const container = target.closest<HTMLElement>(
          '.el-markdown-editor__commands',
        )
        if (!container) throw new Error('Command strip is not mounted')

        const background = getComputedStyle(target).backgroundColor
        const canvas = document.createElement('canvas')
        canvas.width = 1
        canvas.height = 1
        const context = canvas.getContext('2d')
        if (!context) throw new Error('Canvas color probe is unavailable')
        context.clearRect(0, 0, 1, 1)
        context.fillStyle = background
        context.fillRect(0, 0, 1, 1)
        const backgroundAlpha = context.getImageData(0, 0, 1, 1).data[3] / 255

        const targetRect = target.getBoundingClientRect()
        const containerRect = container.getBoundingClientRect()
        const left = Math.max(targetRect.left, containerRect.left, 0)
        const right = Math.min(
          targetRect.right,
          containerRect.right,
          window.innerWidth,
        )
        const top = Math.max(targetRect.top, containerRect.top, 0)
        const bottom = Math.min(
          targetRect.bottom,
          containerRect.bottom,
          window.innerHeight,
        )
        const y = top + (bottom - top) / 2
        const hitSamples = [0.25, 0.5, 0.75].map((ratio) => {
          const x = left + (right - left) * ratio
          const stack = document.elementsFromPoint(x, y)
          const triggerIndex = stack.findIndex(
            (candidate) => candidate === target || target.contains(candidate),
          )
          const underlyingPrimaryIndex = stack.findIndex((candidate) => {
            const command = candidate.closest?.('.el-markdown-editor__command')
            return command !== null && command !== target
          })
          return {
            triggerBeforePrimary:
              triggerIndex >= 0 &&
              (underlyingPrimaryIndex < 0 ||
                triggerIndex < underlyingPrimaryIndex),
            triggerOwnsTop:
              stack[0] === target ||
              (stack[0] !== undefined && target.contains(stack[0])),
            x,
            y,
          }
        })

        return {
          background,
          backgroundAlpha,
          hitSamples,
          viewport: {
            height: window.innerHeight,
            width: window.innerWidth,
          },
        }
      })
      expect(
        expandedTriggerReadability.backgroundAlpha,
        `Expanded overflow background at ${JSON.stringify(
          expandedTriggerReadability.viewport,
        )}: ${expandedTriggerReadability.background}`,
      ).toBe(1)
      expect(
        expandedTriggerReadability.hitSamples.every(
          (sample) => sample.triggerOwnsTop && sample.triggerBeforePrimary,
        ),
        `Expanded overflow hit stack: ${JSON.stringify(
          expandedTriggerReadability,
        )}`,
      ).toBe(true)

      const tray = fixture.locator('.el-markdown-editor__command-tray')
      await expect(tray).toBeVisible()
      const entry = tray.getByRole('button', {
        name: 'Paste as Markdown',
      })
      await expect(entry).toBeVisible()
      const entryTarget = await entry.boundingBox()
      expect(entryTarget?.width).toBeGreaterThanOrEqual(44)
      expect(Math.round(entryTarget?.height ?? 0)).toBeGreaterThanOrEqual(44)

      await entry.tap()
      const surface = visiblePasteAsMarkdownDialog(page)
      await expect(surface).toBeVisible()
      await surface.getByRole('button', { name: /import markdown/i }).tap()
      await expect(textarea).toHaveValue(`${initialValue}**Touch import**`)
      await expect(textarea).toBeFocused()
    }
  })
})

test('records the issue 395 viewport, zoom, theme, long-warning, and accessibility evidence', async ({
  browserName,
  page,
}) => {
  test.skip(
    process.env.FSUS_MARKDOWN_IMPORT_EVIDENCE !== '1' ||
      browserName !== 'chromium',
    'Issue 395 durable evidence is captured explicitly on the Chromium production fixture.',
  )

  const artifactRoot = resolve(
    'tests/conformance/visual/artifacts/screenshots/web/issue-395-markdown-import',
  )
  mkdirSync(artifactRoot, { recursive: true })
  const maliciousWarnings = Array.from({ length: 18 }, (_, index) =>
    [
      `<custom-${index} data-unsupported="${index}">unsupported ${index}</custom-${index}>`,
      `<a href="javascript:alert(${index})" onclick="alert(${index})">blocked ${index}</a>`,
      `<iframe src="https://evil.example/frame-${index}" srcdoc="<script>alert(${index})</script>"></iframe>`,
      `<p style="background:url(https://evil.example/pixel-${index})">network blocked ${index}</p>`,
    ].join(''),
  ).join('')

  const scenarios = [
    {
      id: 'desktop-light-100',
      width: 1440,
      height: 1000,
      theme: 'light',
      zoom: 1,
    },
    {
      id: 'desktop-dark-150',
      width: 1440,
      height: 1000,
      theme: 'dark',
      zoom: 1.5,
    },
    {
      id: 'mobile-light-100',
      width: 375,
      height: 812,
      theme: 'light',
      zoom: 1,
    },
    { id: 'mobile-dark-200', width: 375, height: 812, theme: 'dark', zoom: 2 },
  ] as const
  const accessibilityEvidence: Record<string, unknown> = {}
  const forbiddenRequests: string[] = []
  page.on('request', (request) => {
    if (request.url().includes('evil.example')) {
      forbiddenRequests.push(request.url())
    }
  })

  for (const scenario of scenarios) {
    await page.setViewportSize({
      width: scenario.width,
      height: scenario.height,
    })
    await page.emulateMedia({ colorScheme: scenario.theme })
    await installClipboardSnapshot(page, {
      html: `<h2>Imported review</h2><p>Long warning corpus</p>${maliciousWarnings}`,
      plain: 'Imported review\nLong warning corpus',
    })
    await page.goto(
      `/?audit=ui-states&markdownEditorTransaction=1&theme=${scenario.theme}`,
      { waitUntil: 'domcontentloaded' },
    )
    const fixture = page.getByTestId('markdown-editor-transaction-fixture')
    await expect(fixture).toBeVisible()
    const surface = await openPasteAsMarkdown(page, fixture)
    await page.evaluate((zoom) => {
      document.documentElement.style.zoom = String(zoom)
    }, scenario.zoom)
    await expect(
      surface.getByRole('list', { name: /conversion warnings/i }),
    ).toContainText('unsupported')
    await expect(
      surface.getByRole('list', { name: /conversion warnings/i }),
    ).toContainText('unsafe-url')
    expect(forbiddenRequests).toEqual([])

    const importAction = surface.getByRole('button', {
      name: /import markdown/i,
    })
    await importAction.scrollIntoViewIfNeeded()
    await importAction.focus()
    await expect(importAction).toBeFocused()
    const geometry = await surface.evaluate((dialog) => {
      const rect = dialog.getBoundingClientRect()
      const focused = document.activeElement as HTMLElement | null
      const actionRect = focused?.getBoundingClientRect()
      return {
        actionReachable:
          Boolean(actionRect) &&
          actionRect!.width >= 44 &&
          actionRect!.height >= 44 &&
          actionRect!.top >= 0 &&
          actionRect!.bottom <= window.innerHeight,
        dialogIntersectsViewport:
          rect.right > 0 &&
          rect.left < window.innerWidth &&
          rect.bottom > 0 &&
          rect.top < window.innerHeight,
        dialogScrollable: dialog.scrollHeight > dialog.clientHeight,
        dialogHorizontalOverflow: dialog.scrollWidth > dialog.clientWidth,
      }
    })
    expect(geometry).toEqual({
      actionReachable: true,
      dialogIntersectsViewport: true,
      dialogScrollable: true,
      dialogHorizontalOverflow: false,
    })

    accessibilityEvidence[scenario.id] = {
      aria: await surface.ariaSnapshot(),
      geometry,
      locale: await page.evaluate(() => document.documentElement.lang),
      theme: scenario.theme,
      viewport: { height: scenario.height, width: scenario.width },
      zoom: scenario.zoom,
    }
    await page.screenshot({
      animations: 'disabled',
      path: resolve(artifactRoot, `${scenario.id}.png`),
    })
  }

  writeFileSync(
    resolve(artifactRoot, 'accessibility-evidence.json'),
    `${JSON.stringify(accessibilityEvidence, null, 2)}\n`,
  )
})
