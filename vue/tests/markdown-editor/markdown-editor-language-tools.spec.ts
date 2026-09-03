import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

const openFixture = async (page: Page) => {
  await page.goto(
    '/?audit=ui-states&markdownEditorTransaction=1&markdownLanguageTools=1',
    {
      waitUntil: 'domcontentloaded',
    },
  )
  const fixture = page.getByTestId('markdown-editor-transaction-fixture')
  await expect(fixture).toBeVisible()
  await expect(page.locator('vite-error-overlay')).toHaveCount(0)
  return fixture.locator('.el-markdown-editor textarea')
}

const dispatchReplacement = async (
  textarea: Locator,
  input: { data: string; from: number; to: number },
) =>
  textarea.evaluate((element, replacement) => {
    const target = element as HTMLTextAreaElement
    target.setSelectionRange(replacement.from, replacement.to)
    const event = new InputEvent('beforeinput', {
      bubbles: true,
      cancelable: true,
      data: replacement.data,
      inputType: 'insertReplacementText',
    })
    target.dispatchEvent(event)
    return {
      defaultPrevented: event.defaultPrevented,
      selectionEnd: target.selectionEnd,
      selectionStart: target.selectionStart,
      value: target.value,
    }
  }, input)

test('routes language-tool replacements through the production transaction store', async ({
  page,
}, testInfo) => {
  const textarea = await openFixture(page)
  await expect(textarea).toHaveAttribute('spellcheck', 'true')

  await textarea.fill('Hello brave wrld')
  expect(
    await dispatchReplacement(textarea, {
      data: 'world',
      from: 12,
      to: 16,
    }),
  ).toMatchObject({ defaultPrevented: true })

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

test('keeps marker, code, URL, nested, and atomic replacement rejection local', async ({
  page,
}) => {
  const textarea = await openFixture(page)
  const revision = page.getByTestId('markdown-editor-revision')
  const cases = [
    { from: 0, source: '# wrld', to: 1 },
    { from: 8, source: '```text\nwrld\n```', to: 12 },
    { from: 7, source: '[site](https://fsusui.dev)', to: 15 },
    { from: 2, source: 'abc\n\ndef', to: 6 },
    { from: 2, source: '$$x$$', to: 3 },
  ]

  for (const sample of cases) {
    await textarea.fill(sample.source)
    const beforeRevision = await revision.textContent()
    const result = await dispatchReplacement(textarea, {
      data: 'world',
      from: sample.from,
      to: sample.to,
    })
    expect(result).toMatchObject({
      defaultPrevented: true,
      value: sample.source,
    })
    await expect(revision).toHaveText(beforeRevision?.trim() || '')
    await expect(textarea).toHaveAttribute('spellcheck', 'true')
  }
})

test('preserves the shared input authority across Source and Live interaction simulations', async ({
  page,
}, testInfo) => {
  const textarea = await openFixture(page)
  const fixture = page.getByTestId('markdown-editor-transaction-fixture')

  // Accessible names follow the component locale authority
  // (defaultMarkdownEditorLocaleText.textarea), whose designed default is zh-CN.
  // The transaction fixture renders without a mode switcher, so the Live-mode
  // half of this test runs on the writing-aids fixture, whose mode buttons
  // drive the same editor surface through its controlled `mode` prop.
  await expect(textarea).toHaveAccessibleName('Markdown 源码编辑区')
  await textarea.fill('中文 wrld')
  expect(
    await dispatchReplacement(textarea, {
      data: 'world',
      from: 3,
      to: 7,
    }),
  ).toMatchObject({ defaultPrevented: true })
  await expect(textarea).toHaveValue('中文 world')
  await expect(fixture.locator('textarea')).toHaveCount(1)
  await testInfo.attach('language-tools-source-live-simulation', {
    body: await fixture.screenshot(),
    contentType: 'image/png',
  })

  await page.goto(
    '/?audit=ui-states&markdownWritingAids=1',
    { waitUntil: 'domcontentloaded' },
  )
  const liveFixture = page.getByTestId('markdown-writing-aids-fixture')
  await expect(liveFixture).toBeVisible()
  const liveTextarea = liveFixture.locator('textarea')
  await expect(liveTextarea).toHaveAccessibleName('Markdown 源码编辑区')
  await liveFixture.getByTestId('markdown-mode-live').click()
  await expect(liveTextarea).toHaveAccessibleName('Markdown 实时编辑区')
  await expect(liveTextarea).toHaveAttribute('spellcheck', 'true')

  await liveTextarea.fill('中文 wrld')
  await liveTextarea.focus()
  expect(
    await dispatchReplacement(liveTextarea, {
      data: 'world',
      from: 3,
      to: 7,
    }),
  ).toMatchObject({ defaultPrevented: true })
  await expect(liveTextarea).toHaveValue('中文 world')
  await expect(liveFixture.locator('textarea')).toHaveCount(1)
})
