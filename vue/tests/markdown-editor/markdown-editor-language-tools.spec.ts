import { expect, test } from '@playwright/test'

const openFixture = async (page: import('@playwright/test').Page) => {
  await page.goto('/?audit=ui-states&markdownEditorTransaction=1', {
    waitUntil: 'domcontentloaded',
  })
  const fixture = page.getByTestId('markdown-editor-transaction-fixture')
  await expect(fixture).toBeVisible()
  await expect(page.locator('vite-error-overlay')).toHaveCount(0)
  return fixture.locator('.el-markdown-editor textarea')
}

test('routes language-tool replacements through the production transaction store', async ({
  page,
}, testInfo) => {
  const textarea = await openFixture(page)
  await expect(textarea).toHaveAttribute('spellcheck', 'true')

  await textarea.fill('Hello brave wrld')
  await textarea.evaluate((element) => {
    const target = element as HTMLTextAreaElement
    target.setSelectionRange(12, 16)
    target.dispatchEvent(
      new InputEvent('beforeinput', {
        bubbles: true,
        cancelable: true,
        data: 'world',
        inputType: 'insertReplacementText',
      }),
    )
  })

  await expect(textarea).toHaveValue('Hello brave world')
  const transaction = JSON.parse(
    (await page
      .getByTestId('markdown-editor-last-transaction')
      .textContent()) || 'null',
  )
  expect(transaction).toMatchObject({
    accepted: true,
    transaction: {
      history: 'separate',
      metadata: { languageTool: true },
      origin: 'input',
    },
  })
  expect(transaction.transaction.expectedRevision).toBe(
    transaction.revision - 1,
  )

  await testInfo.attach('language-tools-rendered', {
    body: await page
      .getByTestId('markdown-editor-transaction-fixture')
      .screenshot(),
    contentType: 'image/png',
  })
})

test('does not interleave a browser replacement with active composition', async ({
  page,
}) => {
  const textarea = await openFixture(page)
  await textarea.evaluate((element) => {
    const target = element as HTMLTextAreaElement
    target.setSelectionRange(1, 5)
    target.dispatchEvent(
      new CompositionEvent('compositionstart', { bubbles: true }),
    )
    target.dispatchEvent(
      new InputEvent('beforeinput', {
        bubbles: true,
        cancelable: true,
        data: '替換',
        inputType: 'insertReplacementText',
        isComposing: true,
      }),
    )
  })

  await expect(textarea).toHaveValue('A😀éאב\n- 列表')
})
