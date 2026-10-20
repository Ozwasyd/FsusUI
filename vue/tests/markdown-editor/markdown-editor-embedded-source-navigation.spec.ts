import { resolve } from 'node:path'
import { expect, test } from '@playwright/test'

const fixture = `/@fs${resolve('vue/tests/markdown-editor/embedded-source-navigation.fixture.html')}`

for (const width of [390, 768, 1280]) {
  for (const mode of ['source', 'split']) {
    for (const theme of ['light', 'dark']) {
      test(`embedded prose preserves unrounded native source observation in ${mode} ${theme} at ${width}`, async ({
        page,
      }, testInfo) => {
        await page.setViewportSize({ width, height: 900 })
        await page.goto(`${fixture}?mode=${mode}&theme=${theme}`)
        await page.evaluate(() => document.fonts.ready)
        const root = page.locator('.el-markdown-editor')
        await expect(root).toHaveCSS('border-top-left-radius', '0px')
        await expect
          .poll(() => page.evaluate(() => window.embeddedSourceFixture.read()))
          .not.toBeNull()
        const geometry = await page.evaluate(() => {
          const input = document.querySelector('textarea')!
          const root = document.querySelector('.el-markdown-editor')!
          return {
            root: root.getBoundingClientRect().toJSON(),
            input: input.getBoundingClientRect().toJSON(),
            radius: getComputedStyle(root).borderRadius,
            view: window.embeddedSourceFixture.read(),
          }
        })
        await testInfo.attach('native-geometry', {
          body: JSON.stringify(geometry),
          contentType: 'application/json',
        })
        await page.screenshot({
          path: testInfo.outputPath('embedded-source.png'),
        })
      })
    }
  }
}

for (const chrome of ['framed', 'minimal']) {
  test(`prose retains ${chrome} root contract`, async ({ page }) => {
    await page.goto(`${fixture}?chrome=${chrome}`)
    const root = page.locator('.el-markdown-editor')
    if (chrome === 'framed') {
      await expect(root).not.toHaveCSS('border-top-left-radius', '0px')
    } else {
      await expect(root).toHaveCSS('border-top-left-radius', '0px')
    }
  })
}

test('visible selection toolbar remains a real obstruction to native reveal proof', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 768, height: 900 })
  await page.goto(fixture)
  await expect
    .poll(() => page.evaluate(() => window.embeddedSourceFixture.read()))
    .not.toBeNull()
  await page.evaluate(() => window.embeddedSourceFixture.select())
  const toolbar = page.locator('.el-markdown-editor__selection-toolbar')
  await expect(toolbar).toBeVisible()
  const proof = await page.evaluate(async () => {
    const input = document.querySelector('textarea')!
    const toolbar = document.querySelector(
      '.el-markdown-editor__selection-toolbar',
    )!
    const inputRect = input.getBoundingClientRect()
    const toolbarRect = toolbar.getBoundingClientRect()
    const native = await new Promise<{ visible: boolean; intersects: boolean }>(
      (resolve) => {
        const observer = new IntersectionObserver(
          ([entry]) => {
            observer.disconnect()
            resolve({
              visible: Reflect.get(
                IntersectionObserverEntry.prototype,
                'isVisible',
                entry,
              ),
              intersects: entry.isIntersecting,
            })
          },
          { trackVisibility: true, delay: 100 } as IntersectionObserverInit,
        )
        observer.observe(input)
      },
    )
    return {
      input: inputRect.toJSON(),
      toolbar: toolbarRect.toJSON(),
      overlap:
        Math.min(inputRect.right, toolbarRect.right) >
          Math.max(inputRect.left, toolbarRect.left) &&
        Math.min(inputRect.bottom, toolbarRect.bottom) >
          Math.max(inputRect.top, toolbarRect.top),
      native,
    }
  })
  expect(proof.overlap).toBe(true)
  expect(proof.native).toEqual({ visible: false, intersects: true })
  expect(
    await page.evaluate(() => window.embeddedSourceFixture.reveal()),
  ).toEqual({ error: 'markdown-editor-reveal-timeout' })
  await expect(toolbar).toBeVisible()
  await testInfo.attach('native-toolbar-obstruction', {
    body: JSON.stringify(proof),
    contentType: 'application/json',
  })
  await page.screenshot({
    path: testInfo.outputPath('selection-toolbar-obstruction.png'),
  })
})
