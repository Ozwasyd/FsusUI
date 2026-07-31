import { expect, test } from '@playwright/test'

import type { Locator, Page } from '@playwright/test'

type TransactionOutput = {
  accepted: boolean
  history: {
    canRedo: boolean
    canUndo: boolean
    redoDepth: number
    retainedUnits: number
    undoDepth: number
  }
  reason?: string
  revision: number
  transaction: {
    history: string
    metadata?: Record<string, unknown>
    origin: string
  }
  value: string
}

const openFixture = async (page: Page) => {
  await page.goto('/?audit=ui-states&markdownEditorTransaction=1', {
    waitUntil: 'domcontentloaded',
  })
  await expect(
    page.getByTestId('markdown-editor-transaction-fixture'),
  ).toBeVisible()
  await expect(page.locator('vite-error-overlay')).toHaveCount(0)
  return page
    .getByTestId('markdown-editor-transaction-fixture')
    .locator('.el-markdown-editor textarea')
}

const readLastTransaction = async (page: Page): Promise<TransactionOutput> => {
  const text = await page
    .getByTestId('markdown-editor-last-transaction')
    .textContent()
  return JSON.parse(text?.trim() || 'null') as TransactionOutput
}

const dispatchNativeInput = async (
  textarea: Locator,
  value: string,
  inputType: 'insertFromDrop' | 'insertFromPaste',
) => {
  await textarea.evaluate(
    (element, { inputType, value }) => {
      const target = element as HTMLTextAreaElement
      target.setSelectionRange(target.value.length, target.value.length)
      target.dispatchEvent(
        new InputEvent('beforeinput', {
          bubbles: true,
          data: value,
          inputType,
        }),
      )
      target.value += value
      target.setSelectionRange(target.value.length, target.value.length)
      target.dispatchEvent(
        new InputEvent('input', {
          bubbles: true,
          data: value,
          inputType,
        }),
      )
    },
    { inputType, value },
  )
}

test('preserves UTF-16 backward selection through toolbar, keyboard, paste, and drop', async ({
  page,
}) => {
  const textarea = await openFixture(page)
  await textarea.evaluate((element) => {
    ;(element as HTMLTextAreaElement).setSelectionRange(1, 5, 'backward')
  })
  await page
    .getByTestId('markdown-editor-transaction-fixture')
    .locator('.el-markdown-editor__command')
    .first()
    .click()

  await expect(textarea).toHaveValue('A**😀é**אב\n- 列表')
  expect(
    await textarea.evaluate((element) => {
      const target = element as HTMLTextAreaElement
      return {
        direction: target.selectionDirection,
        end: target.selectionEnd,
        start: target.selectionStart,
      }
    }),
  ).toEqual({ direction: 'backward', end: 7, start: 3 })

  await textarea.fill('- 项目')
  await textarea.press('End')
  await textarea.press('Enter')
  await expect(textarea).toHaveValue('- 项目\n- ')
  await textarea.press('ControlOrMeta+z')
  await expect(textarea).toHaveValue('- 项目')

  await dispatchNativeInput(textarea, '粘贴', 'insertFromPaste')
  expect((await readLastTransaction(page)).transaction).toMatchObject({
    history: 'separate',
    origin: 'paste',
  })
  await dispatchNativeInput(textarea, '拖放', 'insertFromDrop')
  expect((await readLastTransaction(page)).transaction).toMatchObject({
    history: 'separate',
    origin: 'drop',
  })
})

test('keeps programmatic placeholder replacement revision-safe and independently undoable', async ({
  page,
}) => {
  const textarea = await openFixture(page)
  await textarea.evaluate((element) => {
    const target = element as HTMLTextAreaElement
    target.setSelectionRange(target.value.length, target.value.length)
  })
  await page.getByTestId('markdown-programmatic').click()
  await expect(textarea).toHaveValue(/【程序插入】$/)
  await page.getByTestId('markdown-undo').click()
  await expect(textarea).not.toHaveValue(/【程序插入】$/)
  await page.getByTestId('markdown-redo').click()
  await expect(textarea).toHaveValue(/【程序插入】$/)

  await page.getByTestId('markdown-placeholder').click()
  await expect(textarea).toHaveValue(/!\[uploading\]$/)
  await page.getByTestId('markdown-replace-placeholder').click()
  await expect(textarea).toHaveValue(/!\[完成\]\(asset\.png\)$/)
  await page.getByTestId('markdown-stale-replacement').click()
  expect(await readLastTransaction(page)).toMatchObject({
    accepted: false,
    reason: 'stale-revision',
    transaction: {
      metadata: { fixture: 'stale-replacement' },
      origin: 'programmatic',
    },
  })

  await page.getByTestId('markdown-undo').click()
  await expect(textarea).toHaveValue(/!\[uploading\]$/)
  await page.getByTestId('markdown-undo').click()
  await expect(textarea).not.toHaveValue(/!\[uploading\]$/)

  await page.getByTestId('markdown-external-reset').click()
  await expect(textarea).toHaveValue('外部重置😀éאב')
  await page.getByTestId('markdown-undo').click()
  expect(await readLastTransaction(page)).toMatchObject({
    accepted: false,
    reason: 'no-history',
    value: '外部重置😀éאב',
  })
})

for (const composed of ['简体中文', '繁體中文', '日本語', '한국어']) {
  test(`commits one ${composed} synthetic composition transaction in the real engine`, async ({
    page,
  }) => {
    const textarea = await openFixture(page)
    await textarea.evaluate((element, value) => {
      const target = element as HTMLTextAreaElement
      target.value = ''
      target.setSelectionRange(0, 0)
      target.dispatchEvent(new Event('input', { bubbles: true }))
      target.dispatchEvent(
        new CompositionEvent('compositionstart', { bubbles: true }),
      )
      target.value = value
      target.setSelectionRange(value.length, value.length)
      target.dispatchEvent(
        new InputEvent('input', {
          bubbles: true,
          data: value,
          inputType: 'insertCompositionText',
          isComposing: true,
        }),
      )
      target.dispatchEvent(
        new CompositionEvent('compositionend', {
          bubbles: true,
          data: value,
        }),
      )
    }, composed)

    await expect(textarea).toHaveValue(composed)
    expect(await readLastTransaction(page)).toMatchObject({
      accepted: true,
      history: { undoDepth: 2 },
      transaction: {
        history: 'separate',
        metadata: {
          composition: true,
          inputType: 'insertCompositionText',
        },
        origin: 'input',
      },
    })
    await page.getByTestId('markdown-undo').click()
    await expect(textarea).toHaveValue('')
  })
}

test('keeps a 100k document input, undo, and redo bounded in the real component', async ({
  page,
}) => {
  const textarea = await openFixture(page)
  await page.getByTestId('markdown-large-document').click()
  await expect
    .poll(() => textarea.evaluate((element) => element.value.length))
    .toBe(100_000)

  await textarea.evaluate((element) => {
    const target = element as HTMLTextAreaElement
    target.setSelectionRange(target.value.length, target.value.length)
  })
  const started = Date.now()
  await page.getByTestId('markdown-programmatic').click()
  await expect
    .poll(() => textarea.evaluate((element) => element.value.length))
    .toBe(100_006)
  expect(Date.now() - started).toBeLessThan(10_000)

  const transaction = await readLastTransaction(page)
  expect(transaction.history).toMatchObject({
    retainedUnits: 6,
    undoDepth: 1,
  })
  await page.getByTestId('markdown-undo').click()
  await expect
    .poll(() => textarea.evaluate((element) => element.value.length))
    .toBe(100_000)
  await page.getByTestId('markdown-redo').click()
  await expect
    .poll(() => textarea.evaluate((element) => element.value.length))
    .toBe(100_006)
})
