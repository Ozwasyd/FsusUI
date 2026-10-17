/* global requestAnimationFrame */
import { chromium, expect } from '@playwright/test'
import assert from 'node:assert/strict'

const browser = await chromium.launch({
  executablePath:
    process.env.FSUS_PLAYWRIGHT_EXECUTABLE_PATH || '/usr/bin/chromium',
  headless: true,
  args: ['--no-sandbox'],
})

try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'reduce',
  })

  await page.addInitScript(() => {
    window.rawErrors = []
    window.addEventListener('error', (event) => {
      window.rawErrors.push({
        message: event.message,
        filename: event.filename,
        line: event.lineno,
        column: event.colno,
        stack: event.error?.stack ?? null,
      })
    })
  })

  await page.goto('http://127.0.0.1:4174/', { waitUntil: 'networkidle' })
  await expect(page.locator('tbody tr')).toHaveCount(50)

  for (let i = 0; i < 6; i++) {
    await page.setViewportSize(
      i % 2 ? { width: 1440, height: 900 } : { width: 390, height: 844 },
    )
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() =>
            requestAnimationFrame(() => requestAnimationFrame(resolve)),
          ),
        ),
    )
  }

  const errors = await page.evaluate(() => window.rawErrors)
  // eslint-disable-next-line no-console -- Preserve the original replay output.
  console.log(JSON.stringify(errors, null, 2))
  assert.equal(
    errors.length,
    0,
    'ordinary public Table viewport changes must emit no native window.error',
  )
} finally {
  await browser.close()
}
