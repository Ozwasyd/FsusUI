import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

const openFixture = async (
  page: Page,
  options: { interactionProfile?: 'keyboard'; showModes?: boolean } = {},
) => {
  const parameters = new URLSearchParams({
    audit: 'ui-states',
    markdownEditorTransaction: '1',
  })
  if (options.interactionProfile) {
    parameters.set(
      'markdownEditorInteractionProfile',
      options.interactionProfile,
    )
  }
  if (options.showModes) parameters.set('markdownLanguageTools', '1')
  await page.goto(`/?${parameters.toString()}`, {
    waitUntil: 'domcontentloaded',
  })
  const fixture = page.getByTestId('markdown-editor-transaction-fixture')
  await expect(fixture).toBeVisible()
  await expect(page.locator('vite-error-overlay')).toHaveCount(0)
  return fixture
}

const readBatch = async (
  fixture: Locator,
): Promise<{
  anchor: { range: { start: number; end: number } }
  items: { itemId: string; name: string; order: number }[]
  sourceKind: 'pick' | 'paste' | 'drop'
}> => {
  const value = await fixture
    .getByTestId('markdown-attachment-batch')
    .textContent()
  return JSON.parse(value?.trim() || 'null')
}

test('renders and operates the attachment lifecycle with local pointer, touch, and screen-reader simulations', async ({
  page,
}, testInfo) => {
  testInfo.annotations.push(
    {
      type: 'input-evidence',
      description:
        'Touch is a deterministic PointerEvent/tap simulation, not physical hardware.',
    },
    {
      type: 'accessibility-evidence',
      description:
        'Screen-reader evidence is the production DOM role/name/live-region snapshot, not an external AT session.',
    },
  )
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const fixture = await openFixture(page)
  const editor = fixture.locator('.el-markdown-editor')
  const picker = editor.locator('input[type="file"]')

  await picker.setInputFiles([
    {
      name: 'diagram-long-accessible-name.png',
      mimeType: 'image/png',
      buffer: Buffer.from('image-one'),
    },
    {
      name: 'notes-文档.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('attachment-two'),
    },
  ])

  const batch = await readBatch(fixture)
  expect(batch.sourceKind).toBe('pick')
  expect(batch.items.map(({ name, order }) => ({ name, order }))).toEqual([
    { name: 'diagram-long-accessible-name.png', order: 0 },
    { name: 'notes-文档.txt', order: 1 },
  ])

  const list = editor.getByRole('list', { name: '附件' })
  await expect(list.getByRole('listitem')).toHaveCount(2)
  await expect(
    list.getByText('diagram-long-accessible-name.png', { exact: true }),
  ).toBeVisible()
  await expect(list.getByText('notes-文档.txt', { exact: true })).toBeVisible()
  const liveStatuses = list.locator('[aria-live="polite"]')
  await expect(liveStatuses).toHaveCount(2)

  await fixture.getByTestId('markdown-attachment-progress').click()
  await expect(liveStatuses.first()).toContainText('已上传 50%')

  const cancelSecond = list
    .getByRole('listitem')
    .nth(1)
    .getByRole('button', { name: '取消' })
  const target = await cancelSecond.boundingBox()
  expect(target?.width).toBeGreaterThanOrEqual(44)
  expect(target?.height).toBeGreaterThanOrEqual(44)
  await cancelSecond.dispatchEvent('pointerdown', {
    pointerId: 7,
    pointerType: 'touch',
    isPrimary: true,
  })
  await cancelSecond.dispatchEvent('pointerup', {
    pointerId: 7,
    pointerType: 'touch',
    isPrimary: true,
  })
  await cancelSecond.click()
  await expect(liveStatuses.nth(1)).toContainText('上传已取消')
  await expect(
    list.getByRole('listitem').nth(1).getByRole('button', { name: '重试' }),
  ).toBeVisible()
  await expect(
    list.getByRole('listitem').nth(1).getByRole('button', { name: '移除' }),
  ).toBeVisible()

  await fixture.getByTestId('markdown-attachment-resolve').click()
  await expect(liveStatuses.first()).toContainText('上传完成')
  await expect(editor.locator('textarea')).toHaveValue(
    /!\[Resolved attachment\]\(\/fixtures\/resolved-attachment\.png\)/,
  )

  const accessibilitySnapshot = await editor.evaluate((element) => ({
    attachmentNames: [...element.querySelectorAll('li')].map(
      (item) => item.textContent?.replace(/\s+/g, ' ').trim() ?? '',
    ),
    listLabel: element.querySelector('ul')?.getAttribute('aria-label') ?? null,
    liveRegions: [...element.querySelectorAll('[aria-live]')].map((region) => ({
      live: region.getAttribute('aria-live'),
      text: region.textContent?.trim() ?? '',
    })),
    reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
  }))
  expect(accessibilitySnapshot).toMatchObject({
    listLabel: '附件',
    reducedMotion: true,
  })
  expect(accessibilitySnapshot.liveRegions).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ text: expect.stringContaining('上传完成') }),
      expect.objectContaining({ text: expect.stringContaining('上传已取消') }),
    ]),
  )
  await testInfo.attach('attachment-accessibility-simulation.json', {
    body: Buffer.from(JSON.stringify(accessibilitySnapshot, null, 2)),
    contentType: 'application/json',
  })
  await testInfo.attach('attachment-lifecycle-rendered.png', {
    body: await editor.screenshot({ animations: 'disabled' }),
    contentType: 'image/png',
  })
})

test('maps a simulated pointer drop through the source anchor and prevents browser navigation at 200% zoom', async ({
  page,
}, testInfo) => {
  testInfo.annotations.push({
    type: 'device-evidence',
    description:
      'Pointer drop, visualViewport, nested scroll, and 200% zoom are deterministic browser simulations.',
  })
  const fixture = await openFixture(page)
  const editor = fixture.locator('.el-markdown-editor')
  const textarea = editor.locator('textarea')
  await textarea.fill('Anchor target')

  const prevented = await textarea.evaluate((element) => {
    const target = element as HTMLTextAreaElement
    const owner = target.ownerDocument as Document & {
      caretPositionFromPoint?: (
        x: number,
        y: number,
      ) => { offset: number; offsetNode: Node }
    }
    Object.defineProperty(owner, 'caretPositionFromPoint', {
      configurable: true,
      value: () => ({ offset: 3, offsetNode: target }),
    })
    document.documentElement.style.zoom = '2'
    const parent = target.parentElement
    if (parent) {
      parent.style.maxHeight = '180px'
      parent.style.overflow = 'auto'
      parent.scrollTop = 24
    }
    const transfer = new DataTransfer()
    transfer.items.add(
      new File(['drop'], 'drop-image.png', { type: 'image/png' }),
    )
    const event = new DragEvent('drop', {
      bubbles: true,
      cancelable: true,
      clientX: 80,
      clientY: 64,
      dataTransfer: transfer,
    })
    target.dispatchEvent(event)
    Reflect.deleteProperty(owner, 'caretPositionFromPoint')
    return event.defaultPrevented
  })

  expect(prevented).toBe(true)
  const batch = await readBatch(fixture)
  expect(batch.sourceKind).toBe('drop')
  expect(batch.anchor.range).toEqual({
    direction: 'none',
    start: 3,
    end: 3,
  })
  await expect(editor.locator('textarea')).toHaveValue(
    /^Anc!\[正在上传 drop-image\.png…\]\(\)/,
  )
  await testInfo.attach('attachment-drop-zoom-simulation.png', {
    body: await editor.screenshot({ animations: 'disabled' }),
    contentType: 'image/png',
  })
})

test('applies image property and caption figure commands through the production editor across modes', async ({
  page,
}, testInfo) => {
  test.setTimeout(360_000)
  testInfo.annotations.push({
    type: 'ime-evidence',
    description:
      'Unicode/RTL source and synthetic composition coverage are local simulations, not a native OS IME session.',
  }, {
    type: 'interaction-evidence',
    description:
      'All four modes use the public keyboard interaction profile; touch/coarse-pointer behavior is covered separately.',
  })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const fixture = await openFixture(page, {
    interactionProfile: 'keyboard',
    showModes: true,
  })
  const editor = fixture.locator('.el-markdown-editor')
  const textarea = editor.locator('textarea')

  await fixture.getByTestId('markdown-load-figure').click()
  await expect(textarea).toHaveValue(
    '![初始 alt](/old.png "old title")\n::caption[说明 😀 RTL אב]',
  )
  await textarea.evaluate((element: HTMLTextAreaElement) => {
    element.focus()
    element.setSelectionRange(5, 5)
    element.dispatchEvent(new Event('select', { bubbles: true }))
  })
  const properties = editor.getByRole('form', { name: '图像属性' })
  await expect(properties).toBeVisible()
  await properties.getByLabel('目标地址').fill('javascript:alert(1)')
  await properties.getByRole('button', { name: '应用' }).click()
  await expect(properties.getByRole('alert')).toContainText('blocked-scheme')
  await expect(textarea).toHaveValue(
    '![初始 alt](/old.png "old title")\n::caption[说明 😀 RTL אב]',
  )

  await properties.getByLabel('替代文本').fill('可访问 alt 😀')
  await properties.getByLabel('目标地址').fill('/safe/new.png')
  await properties.getByLabel('标题').fill('updated title')
  await properties.getByLabel('题注').fill('更新说明 😀 RTL אב')
  await properties.getByRole('button', { name: '应用' }).click()
  const edited =
    '![可访问 alt 😀](/safe/new.png "updated title")\n::caption[更新说明 😀 RTL אב]'
  await expect(textarea).toHaveValue(edited)

  for (const mode of ['live', 'split', 'preview', 'source']) {
    await editor.locator(`.el-markdown-editor__mode--${mode}`).click()
    await expect
      .poll(async () => {
        const output = await fixture
          .getByTestId('markdown-editor-last-transaction')
          .textContent()
        return output ? JSON.parse(output).value : edited
      })
      .toBe(edited)
    if (mode === 'preview') {
      await expect(
        editor.locator('.el-markdown-editor__preview'),
      ).toContainText('更新说明 😀 RTL אב')
      await testInfo.attach('image-caption-preview-rendered.png', {
        body: await editor.screenshot({ animations: 'disabled' }),
        contentType: 'image/png',
      })
    }
  }

  await expect(properties).toBeVisible()
  await properties.getByRole('button', { name: '移除图像' }).click()
  await expect(textarea).toHaveValue('')
  await fixture.getByTestId('markdown-undo').click()
  await expect(textarea).toHaveValue(edited)
  await fixture.getByTestId('markdown-redo').click()
  await expect(textarea).toHaveValue('')
})
