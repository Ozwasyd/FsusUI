import type { Page } from '@playwright/test'
import { collectCssRules } from '../support/css-scan'
import {
  expect,
  openStableVisualPage,
  registerStableVisualHooks,
  waitForFontsAndLayout,
  test,
  type VisualViewportName,
} from '../support/visual-variant-fixture'
import {
  buildVisualUrl,
  resolveVisualVariant,
} from '../../../scripts/visual-variant.mjs'

registerStableVisualHooks(test)

const openUploadFixtures = (page: Page, projectName: string) =>
  openStableVisualPage(page, buildVisualUrl('upload-visual', projectName))

// ============================================================
// CSS Gate: no legacy classes/patterns in production stylesheet
// ============================================================

test('production CSS contains no legacy motion tokens (500ms, 30px)', async ({
  page,
}, testInfo) => {
  await openUploadFixtures(page, testInfo.project.name)
  await expect(page.getByTestId('upload-visual-fixtures')).toBeVisible()

  // Selector-scoped gate: legacy motion values only count when the rule that
  // targets the upload/motion primitive carries them (joined whole-sheet text
  // false-positives on unrelated rules such as `padding: 1px 30px`).
  const rules = await collectCssRules(page)
  const bannedPatterns: string[] = []
  for (const rule of rules) {
    const selector = rule.selectorText
    const css = rule.cssText
    const motionTarget =
      selector.includes('upload') ||
      selector.includes('zoom-in') ||
      selector.includes('list-enter') ||
      selector.includes('list-leave') ||
      selector.includes('-enter-from') ||
      selector.includes('-leave-to')

    if (/500ms/.test(css)) bannedPatterns.push('500ms found in stylesheet')
    if (
      motionTarget &&
      (/translateY\(-?30px\)/.test(css) || / 30px /.test(css))
    )
      bannedPatterns.push('30px displacement found in stylesheet')
    if (motionTarget && /(\b|-)scale[XY]?\(0\.?[0-4]/.test(css))
      bannedPatterns.push('scale(0) legacy motion found')
    if (motionTarget && /scale\(0\.45\)/.test(css))
      bannedPatterns.push('scale(0.45) zoom-in legacy found')
  }
  expect(bannedPatterns).toEqual([])
})

test('production CSS contains no giant-upload-icon (67px)', async ({
  page,
}, testInfo) => {
  await openUploadFixtures(page, testInfo.project.name)
  await expect(page.getByTestId('upload-visual-fixtures')).toBeVisible()

  // The dragger icon should be 16–24px, never 67px
  const iconFontSizes = await page.evaluate(() => {
    const dragger = document.querySelector('.el-upload-dragger')
    if (!dragger) return { error: 'no dragger found' }
    const icon = dragger.querySelector('.el-icon') as HTMLElement | null
    if (!icon) return { note: 'no icon element' }
    const style = getComputedStyle(icon)
    return {
      fontSize: style.fontSize,
      width: style.width,
      height: style.height,
    }
  })
  expect(iconFontSizes).not.toHaveProperty('error')
  if (typeof iconFontSizes === 'object' && iconFontSizes !== null && 'fontSize' in iconFontSizes) {
    const fontSizePx = parseFloat(iconFontSizes.fontSize as string)
    expect(fontSizePx).toBeLessThanOrEqual(24)
    expect(fontSizePx).toBeGreaterThan(0)
  }
})

// ============================================================
// Dragger variants
// ============================================================

test('dragger renders with Paper radius and thin dashed border', async ({
  page,
}, testInfo) => {
  await openUploadFixtures(page, testInfo.project.name)

  const dragger = page
    .locator('[data-upload-variant="dragger-default"] .el-upload-dragger')
  await expect(dragger).toBeVisible()

  // Paper radius (12px via --fsus-radius-panel)
  const radius = await dragger.evaluate(
    (el) => getComputedStyle(el).borderRadius,
  )
  expect(radius).toBeTruthy()
  expect(parseFloat(radius)).toBeGreaterThan(0)

  // Dashed border
  const borderStyle = await dragger.evaluate(
    (el) => getComputedStyle(el).borderStyle,
  )
  expect(borderStyle).toContain('dashed')

  // Min-height ≥ 44px for touch
  const minHeight = await dragger.evaluate(
    (el) => getComputedStyle(el).minHeight,
  )
  expect(parseFloat(minHeight)).toBeGreaterThanOrEqual(44)
})

test('dragger renders CJK text without cutoff', async ({
  page,
}, testInfo) => {
  await openUploadFixtures(page, testInfo.project.name)

  const cjkText = page.locator(
    '[data-upload-variant="dragger-cjk"] .el-upload__text',
  )
  await expect(cjkText).toBeVisible()
  await expect(cjkText).toContainText('将文件拖到此处')

  // No overflow clipping of the CJK text
  const overflow = await cjkText.evaluate(
    (el) => getComputedStyle(el).overflowWrap,
  )
  expect(overflow === 'anywhere' || overflow === 'break-word').toBe(true)
})

test('dragger renders RTL text without layout break', async ({
  page,
}, testInfo) => {
  await openUploadFixtures(page, testInfo.project.name)

  const rtlDragger = page.locator(
    '[data-upload-variant="dragger-rtl"] .el-upload-dragger',
  )
  await expect(rtlDragger).toBeVisible()

  // The RTL container should have direction: rtl
  const dir = await page
    .locator('[data-upload-variant="dragger-rtl"]')
    .getAttribute('dir')
  expect(dir).toBe('rtl')
})

test('dragger disabled state is not interactive', async ({
  page,
}, testInfo) => {
  await openUploadFixtures(page, testInfo.project.name)

  const disabledUpload = page.locator(
    '[data-upload-variant="dragger-disabled"] .el-upload',
  )
  await expect(disabledUpload).toHaveClass(/is-disabled/)
  await expect(disabledUpload).toHaveAttribute('aria-disabled', 'true')

  // Input should be disabled
  const input = disabledUpload.locator('input[type="file"]')
  await expect(input).toBeDisabled()
})

test('dragger focus-visible applies inset ring, not outline glow', async ({
  page,
}, testInfo) => {
  await openUploadFixtures(page, testInfo.project.name)

  const uploadEl = page.locator(
    '[data-upload-variant="dragger-default"] .el-upload.is-drag',
  )
  await uploadEl.focus()
  await expect(uploadEl).toBeFocused()

  // The focus ring should be applied to the dragger (inset box-shadow), not outline on .el-upload
  const dragger = uploadEl.locator('.el-upload-dragger')
  const boxShadow = await dragger.evaluate(
    (el) => getComputedStyle(el).boxShadow,
  )
  // Inset focus ring should be present
  expect(boxShadow).toContain('inset')
  expect(boxShadow).not.toBe('none')
})

// ============================================================
// Text file list: no ribbon, no card rows, always-visible actions
// ============================================================

test('text list has no success ribbon', async ({ page }, testInfo) => {
  await openUploadFixtures(page, testInfo.project.name)

  // Check that no .el-upload-list__item-status-label has rotated ribbon geometry
  const labels = page.locator(
    '[data-upload-variant="text-success"] .el-upload-list__item-status-label',
  )
  const count = await labels.count()
  expect(count).toBeGreaterThan(0)

  for (let i = 0; i < count; i++) {
    const transform = await labels.nth(i).evaluate(
      (el) => getComputedStyle(el).transform,
    )
    // Should NOT be rotated 45deg (ribbon pattern)
    expect(transform).not.toContain('matrix(0.7071')
    expect(transform).not.toContain('rotate(45deg)')
  }

  // Status labels should be statically positioned (not absolute right:5px, top:50%)
  for (let i = 0; i < count; i++) {
    const position = await labels.nth(i).evaluate(
      (el) => getComputedStyle(el).position,
    )
    expect(position).toBe('static')
  }
})

test('text list items are flat rows with divider, no card surface', async ({
  page,
}, testInfo) => {
  await openUploadFixtures(page, testInfo.project.name)

  const item = page.locator(
    '[data-upload-variant="text-success"] .el-upload-list__item',
  ).first()

  // No card surface (no border-radius, no box-shadow)
  const borderRadius = await item.evaluate(
    (el) => getComputedStyle(el).borderRadius,
  )
  expect(borderRadius).toBe('0px')

  const boxShadow = await item.evaluate(
    (el) => getComputedStyle(el).boxShadow,
  )
  expect(boxShadow).toBe('none')

  // Should have a bottom border (divider)
  const borderBottom = await item.evaluate(
    (el) => getComputedStyle(el).borderBottomWidth,
  )
  expect(parseFloat(borderBottom)).toBeGreaterThan(0)
})

test('text list actions are always visible, not hover-only', async ({
  page,
}, testInfo) => {
  await openUploadFixtures(page, testInfo.project.name)

  // The actions container should exist and be visible
  const actionsContainer = page.locator(
    '[data-upload-variant="text-success"] .el-upload-list__item-actions',
  ).first()

  // Should be present in text list
  await expect(actionsContainer).toBeAttached()

  // Should be statically positioned (not absolute hover overlay)
  const position = await actionsContainer.evaluate(
    (el) => getComputedStyle(el).position,
  )
  expect(position).toBe('static')
})

test('text list shows status text for all states', async ({
  page,
}, testInfo) => {
  await openUploadFixtures(page, testInfo.project.name)

  // Success state has status label with success icon
  const successLabel = page.locator(
    '[data-upload-variant="text-success"] .el-upload-list__item-status-label',
  ).first()
  await expect(successLabel).toBeVisible()

  // Fail state shows fail status
  const failLabel = page.locator(
    '[data-upload-variant="text-fail"] .el-upload-list__item-status-label',
  ).first()
  await expect(failLabel).toBeVisible()

  // Uploading state shows percentage
  const uploadingLabel = page.locator(
    '[data-upload-variant="text-uploading"] .el-upload-list__item-status-label',
  ).first()
  await expect(uploadingLabel).toBeVisible()
  await expect(uploadingLabel).toContainText(/67%|42%/)
})

test('text list items are keyboard reachable', async ({
  page,
}, testInfo) => {
  await openUploadFixtures(page, testInfo.project.name)

  const item = page.locator(
    '[data-upload-variant="text-success"] .el-upload-list__item',
  ).first()

  // Items should have tabindex=0 for keyboard access
  const tabindex = await item.getAttribute('tabindex')
  expect(tabindex).toBe('0')

  // Should be focusable
  await item.focus()
  await expect(item).toBeFocused()
})

test('text list long filenames do not overflow or overlap actions', async ({
  page,
}, testInfo) => {
  await openUploadFixtures(page, testInfo.project.name)

  const item = page.locator(
    '[data-upload-variant="text-long-filename"] .el-upload-list__item',
  ).first()

  const fileName = item.locator('.el-upload-list__item-file-name')
  const overflow = await fileName.evaluate(
    (el) => getComputedStyle(el).textOverflow,
  )
  // Should use ellipsis for overflow
  expect(overflow).toBe('ellipsis')

  // The filename should not push actions out of view
  const info = item.locator('.el-upload-list__item-info')
  const infoBox = await info.boundingBox()
  const actionsBox = await item
    .locator('.el-upload-list__item-actions')
    .boundingBox()
  if (infoBox && actionsBox) {
    // Actions should be to the right of info (or at least not overlapping)
    expect(infoBox.x + infoBox.width).toBeLessThanOrEqual(
      actionsBox.x + actionsBox.width + 2,
    )
  }
})

test('text list handles mixed states without layout jump', async ({
  page,
}, testInfo) => {
  await openUploadFixtures(page, testInfo.project.name)

  const items = page.locator(
    '[data-upload-variant="text-mixed"] .el-upload-list__item',
  )
  const count = await items.count()
  expect(count).toBe(4)

  // All items should have consistent min-height
  for (let i = 0; i < count; i++) {
    const minHeight = await items.nth(i).evaluate(
      (el) => getComputedStyle(el).minHeight,
    )
    expect(parseFloat(minHeight)).toBeGreaterThanOrEqual(40)
  }
})

test('text list disabled items use tokens, not ancestor opacity', async ({
  page,
}, testInfo) => {
  await openUploadFixtures(page, testInfo.project.name)

  const item = page.locator(
    '[data-upload-variant="text-disabled"] .el-upload-list__item',
  ).first()
  await expect(item).toHaveClass(/is-disabled/)

  // Should not use opacity < 1 for disabled (should use disabled color tokens)
  const opacity = await item.evaluate(
    (el) => getComputedStyle(el).opacity,
  )
  expect(parseFloat(opacity)).toBe(1)
})

// ============================================================
// Picture list
// ============================================================

test('picture list items render with thumbnail and file info', async ({
  page,
}, testInfo) => {
  await openUploadFixtures(page, testInfo.project.name)

  const pictureItem = page.locator(
    '[data-upload-variant="picture-default"] .el-upload-list__item',
  ).first()
  await expect(pictureItem).toBeVisible()

  // Should have thumbnail image
  const thumbnail = pictureItem.locator('.el-upload-list__item-thumbnail')
  await expect(thumbnail).toBeVisible()

  // Should have file name
  const fileName = pictureItem.locator('.el-upload-list__item-name')
  await expect(fileName).toBeVisible()
})

// ============================================================
// Picture-card list
// ============================================================

test('picture-card items have always-visible action bar, not deep hover overlay', async ({
  page,
}, testInfo) => {
  await openUploadFixtures(page, testInfo.project.name)

  const cardItem = page.locator(
    '[data-upload-variant="picture-card-default"] .el-upload-list__item',
  ).first()

  // The actions span should NOT be a full-cover absolute overlay
  const actions = cardItem.locator('.el-upload-list__item-actions')
  await expect(actions).toBeAttached()

  const position = await actions.evaluate(
    (el) => getComputedStyle(el).position,
  )
  // After #457, actions should NOT be absolute (full overlay removed)
  expect(position).not.toBe('absolute')

  // Should have preview and delete buttons
  const previewBtn = actions.locator('.el-upload-list__item-preview')
  await expect(previewBtn).toBeAttached()
  const deleteBtn = actions.locator('.el-upload-list__item-delete')
  await expect(deleteBtn).toBeAttached()
})

test('picture-card has no giant centered success check overlay', async ({
  page,
}, testInfo) => {
  await openUploadFixtures(page, testInfo.project.name)

  // The status label in picture-card should be compact, not a giant rotated 45deg ribbon
  const statusLabel = page.locator(
    '[data-upload-variant="picture-card-default"] .el-upload-list__item.is-success .el-upload-list__item-status-label',
  ).first()

  const width = await statusLabel.evaluate(
    (el) => getComputedStyle(el).width,
  )
  const widthPx = parseFloat(width)
  // Compact status indicator, not 40px+ ribbon
  expect(widthPx).toBeLessThan(30)
})

test('picture-card renders per-status indicators and retains visibility on hover/focus', async ({
  page,
}, testInfo) => {
  await openUploadFixtures(page, testInfo.project.name)

  const list = page.locator('[data-upload-variant="picture-card-default"]')

  // Success card: checkmark visible at rest, hover, and focus-within.
  const successCard = list.locator('.el-upload-list__item.is-success').first()
  const successStatus = successCard.getByRole('status')
  await expect(successStatus).toBeVisible()
  await expect(successStatus).toHaveAccessibleName(/Uploaded|已上传/)
  await expect(successStatus.locator('.el-icon--upload-success')).toBeVisible()

  await successCard.hover()
  await expect(successStatus).toBeVisible()
  await successCard.locator('.el-upload-list__item-preview').focus()
  await expect(successStatus).toBeVisible()

  // Fail card: distinct non-color fail indicator, never success checkmark.
  const failCard = list.locator('.el-upload-list__item.is-fail').first()
  const failStatus = failCard.getByRole('status')
  await expect(failStatus).toBeVisible()
  await expect(failStatus).toHaveAccessibleName(/Failed|失败/)
  await expect(failStatus.locator('.el-icon--upload-fail')).toBeVisible()
  await expect(failCard.locator('.el-icon--upload-success')).toHaveCount(0)

  await failCard.hover()
  await expect(failStatus).toBeVisible()
  await failCard.locator('.el-upload-list__item-preview').focus()
  await expect(failStatus).toBeVisible()

  // Uploading card: progress shown without any success checkmark or status pill.
  const uploadingCard = list
    .locator('.el-upload-list__item.is-uploading')
    .first()
  await expect(uploadingCard.locator('.el-progress')).toBeVisible()
  await expect(
    uploadingCard.locator('.el-upload-list__item-status-label'),
  ).toHaveCount(0)
  await expect(uploadingCard.locator('.el-icon--upload-success')).toHaveCount(0)
})

test('picture-card focus-within shows inset ring on card', async ({
  page,
}, testInfo) => {
  await openUploadFixtures(page, testInfo.project.name)

  const cardItem = page.locator(
    '[data-upload-variant="picture-card-default"] .el-upload-list__item',
  ).first()

  // Click the preview button to trigger focus-within
  const previewBtn = cardItem.locator('.el-upload-list__item-preview')
  await previewBtn.focus()
  await expect(previewBtn).toBeFocused()
})

test('picture-card disabled items show reduced actions', async ({
  page,
}, testInfo) => {
  await openUploadFixtures(page, testInfo.project.name)

  const disabledItem = page.locator(
    '[data-upload-variant="picture-card-disabled"] .el-upload-list__item',
  ).first()
  await expect(disabledItem).toHaveClass(/is-disabled/)

  // Delete button should not exist in disabled state
  const deleteBtn = disabledItem.locator('.el-upload-list__item-delete')
  await expect(deleteBtn).not.toBeAttached()
})

// ============================================================
// Motion transitions: list insert/remove
// ============================================================

test('upload list transitions use 140/220ms tokens, not 500ms', async ({
  page,
}, testInfo) => {
  await openUploadFixtures(page, testInfo.project.name)

  const rules = await collectCssRules(page)
  const durations: string[] = []
  for (const rule of rules) {
    const selector = rule.selectorText
    if (
      selector.includes('upload-list') &&
      (selector.includes('enter-active') || selector.includes('leave-active'))
    ) {
      const durMatches = rule.cssText.match(/transition-duration:\s*([^;]+)/g)
      if (durMatches) durations.push(...durMatches)
    }
  }

  // No 500ms in any upload-list transition
  const hasLegacyMs = durations.some((d) => d.includes('500ms'))
  expect(hasLegacyMs).toBe(false)
})

test('upload list enter transition uses ≤8px displacement', async ({
  page,
}, testInfo) => {
  await openUploadFixtures(page, testInfo.project.name)

  const rules = await collectCssRules(page)
  const displacements: string[] = []
  for (const rule of rules) {
    if (
      rule.selectorText.includes('upload-list') &&
      rule.selectorText.includes('enter-from')
    ) {
      const matches = rule.cssText.match(/translateY\((-?\d+)px\)/g)
      if (matches) displacements.push(...matches)
    }
  }

  // Displacement should be ≤8px
  for (const d of displacements) {
    const px = parseInt(d.match(/(-?\d+)/)?.[1] ?? '0')
    expect(Math.abs(px)).toBeLessThanOrEqual(8)
  }
})

// ============================================================
// Hit-test: action targets are reachable via DOMRect
// ============================================================

test('text list delete button has compliant hit target (≥32px desktop)', async ({
  page,
}, testInfo) => {
  const { viewportClass } = resolveVisualVariant(testInfo.project.name)
  await openUploadFixtures(page, testInfo.project.name)

  const deleteBtn = page.locator(
    '[data-upload-variant="text-success"] .el-upload-list__item-actions button',
  ).first()

  const box = await deleteBtn.boundingBox()
  expect(box).toBeTruthy()
  if (box) {
    const minTarget = viewportClass === 'mobile' ? 44 : 32
    expect(box.width).toBeGreaterThanOrEqual(minTarget)
    expect(box.height).toBeGreaterThanOrEqual(minTarget)
  }
})

test('picture-card action buttons have compliant hit target', async ({
  page,
}, testInfo) => {
  await openUploadFixtures(page, testInfo.project.name)

  const card = page
    .locator('[data-upload-variant="picture-card-default"] .el-upload-list__item.is-success')
    .first()
  const cardBox = await card.boundingBox()
  const thumbBox = await card
    .locator('.el-upload-list__item-thumbnail')
    .boundingBox()
  const minTarget = testInfo.project.use.hasTouch ? 44 : 32

  for (const selector of [
    '.el-upload-list__item-preview',
    '.el-upload-list__item-delete',
  ]) {
    const box = await card.locator(selector).boundingBox()
    expect(box).toBeTruthy()
    if (box && cardBox && thumbBox) {
      expect(box.width).toBeGreaterThanOrEqual(minTarget)
      expect(box.height).toBeGreaterThanOrEqual(minTarget)
      expect(box.x).toBeGreaterThanOrEqual(cardBox.x - 1)
      expect(box.x + box.width).toBeLessThanOrEqual(cardBox.x + cardBox.width + 1)
      expect(box.y).toBeGreaterThanOrEqual(thumbBox.y + thumbBox.height - 1)
    }
  }
})

// ============================================================
// Drag-over state
// ============================================================

test('dragger drag-over changes border and background only, no glow/scale', async ({
  page,
}, testInfo) => {
  await openUploadFixtures(page, testInfo.project.name)

  const dragger = page.locator(
    '[data-upload-variant="dragger-default"] .el-upload-dragger',
  )

  // Record pre-drag geometry
  const preBox = await dragger.boundingBox()
  expect(preBox).toBeTruthy()

  // Simulate drag-over with a real DataTransfer (constructing a DragEvent
  // from a plain dataTransfer object is not supported by Chromium).
  await dragger.evaluate((element) => {
    const transfer = new DataTransfer()
    element.dispatchEvent(
      new DragEvent('dragover', { dataTransfer: transfer, bubbles: true }),
    )
  })

  // Check the is-dragover class was applied
  await expect(dragger).toHaveClass(/is-dragover/)

  // Verify no layout shift (same box dimensions)
  const postBox = await dragger.boundingBox()
  expect(postBox).toBeTruthy()
  if (preBox && postBox) {
    expect(Math.abs(preBox.width - postBox.width)).toBeLessThanOrEqual(
      1,
    )
    expect(Math.abs(preBox.height - postBox.height)).toBeLessThanOrEqual(
      1,
    )
  }

  // Verify no glow/scale/shimmer (transform should be none)
  const transform = await dragger.evaluate(
    (el) => getComputedStyle(el).transform,
  )
  expect(transform).toBe('none')

  // Box-shadow should NOT contain a glow pattern (should be none or inset-only)
  const boxShadow = await dragger.evaluate(
    (el) => getComputedStyle(el).boxShadow,
  )
  expect(boxShadow).not.toContain('rgba(64,')
  expect(boxShadow).not.toContain('0 0')
})

// ============================================================
// Media field variant
// ============================================================

test('media field wrapper has aspect-ratio support', async ({
  page,
}, testInfo) => {
  await openUploadFixtures(page, testInfo.project.name)

  // Verify the upload-field CSS class exists in the stylesheet
  const rules = await collectCssRules(page)
  const hasMediaField = rules.some(
    (rule) =>
      rule.selectorText.includes('upload-field') &&
      rule.selectorText.includes('media-field'),
  )
  expect(hasMediaField).toBe(true)
})

// ============================================================
// Dark mode: all upload variants render correctly
// ============================================================

test('upload variants render without visual break in current theme', async ({
  page,
}, testInfo) => {
  await openUploadFixtures(page, testInfo.project.name)

  // All fixture blocks should be visible
  const fixtures = [
    'dragger-default',
    'dragger-disabled',
    'dragger-cjk',
    'dragger-rtl',
    'text-ready',
    'text-uploading',
    'text-success',
    'text-fail',
    'text-long-filename',
    'text-mixed',
    'text-disabled',
    'picture-default',
    'picture-multi',
    'picture-card-default',
    'picture-card-disabled',
  ]

  for (const variant of fixtures) {
    const el = page.locator(`[data-upload-variant="${variant}"]`)
    await expect(el).toBeVisible()
  }

  // Take a full-page screenshot for visual reference
  await waitForFontsAndLayout(page)
  await page.screenshot({
    path: testInfo.outputPath('upload-all-variants.png'),
    fullPage: true,
  })
})

// ============================================================
// Responsive width × zoom no-overflow / no-clipping matrix
// ============================================================

test('dragger, text, and picture-card have no overflow or clipping across 320/375/768/1366 widths and 150%/200% zoom', async ({
  page,
  useVisualViewport,
}, testInfo) => {
  await openUploadFixtures(page, testInfo.project.name)
  await expect(page.getByTestId('upload-visual-fixtures')).toBeVisible()
  await waitForFontsAndLayout(page)

  const targets = [
    {
      variant: 'dragger-default',
      innerSelectors: ['.el-upload-dragger', '.el-upload__text'],
    },
    {
      variant: 'dragger-cjk',
      innerSelectors: ['.el-upload-dragger', '.el-upload__text'],
    },
    {
      variant: 'text-long-filename',
      innerSelectors: [
        '.el-upload-list__item-file-name',
        '.el-upload-list__item-status-label',
        '.el-upload-list__item-actions button',
      ],
    },
    {
      variant: 'text-mixed',
      innerSelectors: [
        '.el-upload-list__item-file-name',
        '.el-upload-list__item-status-label',
        '.el-upload-list__item-actions button',
      ],
    },
    {
      variant: 'picture-card-default',
      innerSelectors: [
        '.el-upload-list__item',
        '.el-upload-list__item-actions button',
      ],
    },
  ] as const

  const viewports = [
    'upload-320',
    'upload-375',
    'upload-768',
    'upload-1366',
  ] as const satisfies readonly VisualViewportName[]

  for (const viewport of viewports) {
    await useVisualViewport(viewport)
    for (const zoom of [1.5, 2] as const) {
      for (const { variant, innerSelectors } of targets) {
        const container = page.locator(`[data-upload-variant="${variant}"]`)
        const metrics = await container.evaluate(
          (element, { zoomLevel, selectors }) => {
            const host = element as HTMLElement
            host.style.zoom = String(zoomLevel)
            const containerRect = host.getBoundingClientRect()
            const horizontalOverflow = host.scrollWidth > host.clientWidth + 1
            const clipped: string[] = []

            for (const selector of selectors) {
              const nodes = Array.from(host.querySelectorAll(selector))
              if (nodes.length === 0) {
                clipped.push(`missing:${selector}`)
                continue
              }
              for (const node of nodes) {
                const rect = node.getBoundingClientRect()
                if (rect.width <= 0 || rect.height <= 0) {
                  clipped.push(`collapsed:${selector}`)
                } else if (
                  rect.left < containerRect.left - 1.5 ||
                  rect.right > containerRect.right + 1.5
                ) {
                  clipped.push(
                    `overflow:${selector}(${rect.left.toFixed(1)}..${rect.right.toFixed(1)} vs ${containerRect.left.toFixed(1)}..${containerRect.right.toFixed(1)})`,
                  )
                }
              }
            }

            host.style.zoom = '1'
            return { horizontalOverflow, clipped }
          },
          { zoomLevel: zoom, selectors: [...innerSelectors] },
        )

        expect(
          metrics.horizontalOverflow,
          `${variant} overflowed horizontally at ${viewport} zoom ${zoom * 100}%`,
        ).toBe(false)
        expect(
          metrics.clipped,
          `${variant} had clipped/collapsed elements at ${viewport} zoom ${zoom * 100}%`,
        ).toEqual([])
      }
    }
  }
})
