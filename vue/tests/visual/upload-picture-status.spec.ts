import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import { buildVisualUrl } from '../../../scripts/visual-variant.mjs'
import { collectCssRules } from '../support/css-scan'
import { attachPageDiagnostics } from '../support/page-diagnostics'

const diagnostics = new WeakMap<Page, string[]>()

test.beforeEach(async ({ page }, testInfo) => {
  diagnostics.set(page, attachPageDiagnostics(page))
  await page.goto(buildVisualUrl('upload-visual', testInfo.project.name), {
    waitUntil: 'domcontentloaded',
  })
  await expect(page.getByTestId('upload-visual-fixtures')).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
})

test.afterEach(async ({ page }) => {
  expect(diagnostics.get(page) ?? []).toEqual([])
})

const assertPictureSuccess = async (row: Locator, disabled = false) => {
  const status = row.getByRole('status')
  await expect(status).toHaveCount(1)
  await Promise.all([
    expect(status).toBeVisible(),
    expect(status).toHaveAccessibleName(/Uploaded|已上传/),
    expect(status).toContainText(/Uploaded|已上传/),
    expect(status.locator('.el-icon--upload-success')).toBeVisible(),
  ])
  const [style, itemBox, thumbnailBox, infoBox, statusBox, actionsBox] =
    await Promise.all([
      status.evaluate((element) => {
        const computed = getComputedStyle(element)
        return {
          position: computed.position,
          transform: computed.transform,
          background: computed.backgroundColor,
        }
      }),
      row.boundingBox(),
      row.locator('img').boundingBox(),
      row.locator('.el-upload-list__item-info').boundingBox(),
      status.boundingBox(),
      disabled
        ? Promise.resolve(null)
        : row.locator('.el-upload-list__item-actions').boundingBox(),
    ])
  expect(style).toEqual({
    position: 'static',
    transform: 'none',
    background: 'rgba(0, 0, 0, 0)',
  })
  expect(itemBox).not.toBeNull()
  expect(thumbnailBox).not.toBeNull()
  expect(infoBox).not.toBeNull()
  expect(statusBox).not.toBeNull()
  if (!disabled) expect(actionsBox).not.toBeNull()
  if (
    !itemBox ||
    !thumbnailBox ||
    !infoBox ||
    !statusBox ||
    (!disabled && !actionsBox)
  )
    throw new Error('Missing picture geometry')
  expect(statusBox.x).toBeGreaterThanOrEqual(itemBox.x)
  expect(statusBox.x + statusBox.width).toBeLessThanOrEqual(
    itemBox.x + itemBox.width,
  )
  expect(statusBox.y).toBeGreaterThanOrEqual(itemBox.y)
  expect(statusBox.y + statusBox.height).toBeLessThanOrEqual(
    itemBox.y + itemBox.height,
  )
  const overlaps = (a: typeof statusBox, b: typeof statusBox) =>
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  for (const box of [thumbnailBox, infoBox, actionsBox]) {
    if (box) expect(overlaps(statusBox, box)).toBe(false)
  }
}

test('real picture success stays named and inline at rest, hover and keyboard focus', async ({
  page,
}, testInfo) => {
  const row = page.locator(
    '[data-upload-variant="picture-default"] .el-upload-list__item',
  )
  await testInfo.attach('picture-initial', {
    body: await row.screenshot(),
    contentType: 'image/png',
  })
  await assertPictureSuccess(row)
  await row.hover()
  await assertPictureSuccess(row)
  await row.focus()
  await page.keyboard.press('Tab')
  await expect(row.locator('.el-upload-list__item-name')).toBeFocused()
  await assertPictureSuccess(row)
  await page.keyboard.press('Tab')
  const remove = row.getByRole('button', { name: /Delete|删除/ })
  await expect(remove).toBeFocused()
  await assertPictureSuccess(row)
  await testInfo.attach('picture-success', {
    body: await row.screenshot(),
    contentType: 'image/png',
  })
  await page.keyboard.press('Enter')
  await expect(row).toHaveCount(0)
})

test('production CSS contains no success ribbon in any Upload variant or cover', async ({
  page,
}) => {
  const rules = await collectCssRules(page, ['upload'])
  const statuses = rules.filter(({ selectorText }) =>
    /item-status-label|upload-cover__label|upload-success/.test(selectorText),
  )
  expect(statuses.length).toBeGreaterThan(0)
  for (const { cssText } of statuses) {
    expect(cssText).not.toMatch(/(?:rotate|skew|matrix)\(/)
    expect(cssText).not.toMatch(
      /(?:right|left|top|bottom|inset(?:-\w+)*):\s*-\d/,
    )
  }
})

test('uploading and failed pictures never expose success', async ({ page }) => {
  const rows = page.locator(
    '[data-upload-variant="picture-multi"] .el-upload-list__item',
  )
  await expect(rows).toHaveCount(3)
  await assertPictureSuccess(rows.nth(0))
  for (const state of ['uploading', 'fail']) {
    // Bind the actual list-state class; a missing row must fail the test.
    const stateRow = page.locator(
      `[data-upload-variant="picture-multi"] .el-upload-list__item.is-${state}`,
    )
    await expect(stateRow).toHaveCount(1)
    await expect(stateRow.getByRole('status')).toBeVisible()
    await expect(stateRow.getByRole('status')).not.toContainText(
      /Uploaded|已上传/,
    )
    await expect(stateRow.locator('.el-icon--upload-success')).toHaveCount(0)
    await expect(stateRow.getByRole('status')).toContainText(
      state === 'uploading' ? '55%' : /Failed|失败/,
    )
  }
})

test('the rendered contract rejects reintroduced rotated ribbon geometry', async ({
  page,
}) => {
  const row = page.locator(
    '[data-upload-variant="picture-default"] .el-upload-list__item',
  )
  await assertPictureSuccess(row)
  const style = await page.addStyleTag({
    content:
      '.el-upload-list--picture .el-upload-list__item-status-label { position: absolute; right: -17px; top: -7px; width: 46px; height: 26px; background: green; transform: rotate(45deg); }',
  })
  await expect(assertPictureSuccess(row)).rejects.toThrow()
  await style.evaluate((element) => element.remove())
  await assertPictureSuccess(row)
})

test('picture states remain readable at narrow widths, zoom, RTL and reduced motion', async ({
  page,
}, testInfo) => {
  const fixture = page.locator('[data-upload-variant="picture-status"]')
  const success = fixture.locator('.el-upload-list__item.is-success')
  const disabled = page.locator(
    '[data-upload-variant="picture-status-disabled"] .el-upload-list__item',
  )
  await expect(fixture.locator('.el-upload-list__item')).toHaveCount(4)
  for (const width of [320, 375, 768, 1366]) {
    await page.setViewportSize({ width, height: 1000 })
    for (const zoom of [1, 1.5, 2]) {
      await fixture.evaluate((element, value) => {
        element.style.zoom = String(value)
      }, zoom)
      for (const direction of ['ltr', 'rtl']) {
        await fixture.evaluate(
          (element, value) => element.setAttribute('dir', value),
          direction,
        )
        await assertPictureSuccess(success)
        expect(
          await fixture.evaluate(
            (element) => element.scrollWidth > element.clientWidth + 1,
          ),
        ).toBe(false)
      }
    }
  }
  await fixture.evaluate((element) => {
    element.style.zoom = '1'
    element.setAttribute('dir', 'ltr')
  })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await assertPictureSuccess(success)
  await assertPictureSuccess(disabled, true)
  await expect(
    disabled.getByRole('button', { name: /Delete|删除/ }),
  ).toHaveCount(0)
  for (const [state, label] of [
    ['ready', /Pending|待上传/],
    ['uploading', /62%/],
    ['fail', /Failed|失败/],
  ] as const) {
    const row = fixture.locator(`.el-upload-list__item.is-${state}`)
    await expect(row.getByRole('status')).toBeVisible()
    await expect(row.getByRole('status')).toContainText(label)
    await expect(row.locator('.el-icon--upload-success')).toHaveCount(0)
  }
  const name = await success
    .locator('.el-upload-list__item-file-name')
    .innerText()
  const preview = success.getByRole('button', { name: /Preview|查看图片/ })
  await preview.press('Enter')
  await expect(page.getByTestId('picture-preview')).toHaveText(name)
  const remove = success.getByRole('button', { name: /Delete|删除/ })
  const target = await remove.boundingBox()
  expect(target).not.toBeNull()
  if (!target) throw new Error('Missing remove target')
  const touch = Boolean(testInfo.project.use.hasTouch)
  expect(target.width).toBeGreaterThanOrEqual(touch ? 44 : 32)
  expect(target.height).toBeGreaterThanOrEqual(touch ? 44 : 32)
  if (touch) await remove.tap()
  else await remove.click()
  await expect(success).toHaveCount(0)
  await expect(fixture.locator('.el-upload-list__item')).toHaveCount(3)
  await testInfo.attach('picture-status-matrix', {
    body: await fixture.screenshot(),
    contentType: 'image/png',
  })
})
