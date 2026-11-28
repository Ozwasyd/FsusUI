import { expect, test } from '@playwright/test'
import { attachPageErrorCollector } from './helpers'

test.describe('FsusUI 2.0 dialog & image viewer consumer contract', () => {
  test('FsusDialog opens, renders modal semantics, and closes via button and Escape', async ({
    page,
  }) => {
    const { errors } = attachPageErrorCollector(page)
    await page.goto('/overlays?theme=light')
    await expect(page.locator('[data-contract-ready="true"]')).toBeVisible()

    await page.getByTestId('open-dialog-btn').click()
    const dialog = page.locator('.fsus-dialog[role="dialog"]:visible')
    await expect(dialog).toBeVisible()
    await expect(dialog).toHaveAttribute('aria-modal', 'true')
    await expect(page.getByTestId('dialog-body')).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(page.getByTestId('dialog-open-state')).toHaveText('false')

    await page.getByTestId('open-dialog-btn').click()
    await expect(dialog).toBeVisible()
    await page.getByTestId('dialog-confirm-btn').click()
    await expect(dialog).toHaveCount(0)
    expect(errors).toEqual([])
  })

  test('FsusImageViewer switches images, zooms, and closes cleanly via Escape', async ({
    page,
  }) => {
    const { errors } = attachPageErrorCollector(page)
    await page.goto('/overlays?theme=dark')
    await expect(page.locator('[data-contract-ready="true"]')).toBeVisible()

    await page.getByTestId('open-viewer-btn').click()
    const viewer = page.locator('.fsus-image-viewer[role="dialog"]:visible')
    await expect(viewer).toBeVisible()
    await expect(viewer).toHaveAttribute('data-fsus-material', 'glass')

    const img = viewer.locator('.fsus-image-viewer__img')
    await expect(img).toHaveAttribute('src', '/images/fig-1.svg')

    await viewer.locator('.fsus-image-viewer__nav[data-dir="next"]').click()
    await expect(img).toHaveAttribute('src', '/images/fig-2.svg')
    await expect(page.getByTestId('viewer-index-state')).toHaveText('1')

    await page.keyboard.press('Escape')
    await expect(viewer).toHaveCount(0)
    await expect(page.getByTestId('viewer-close-count')).toHaveText('1')
    expect(errors).toEqual([])
  })
})
