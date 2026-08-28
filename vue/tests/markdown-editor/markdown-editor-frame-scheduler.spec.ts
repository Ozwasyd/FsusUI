import { expect, test } from '@playwright/test'

import type { Locator, Page, TestInfo } from '@playwright/test'

type FrameMetrics = {
  coalesced: number
  executed: Record<'measure' | 'mutate' | 'post-paint', number>
  frame: number
  pending: number
  stale: number
  violations: number
}

const openTransactionFixture = async (page: Page) => {
  await page.goto('/?audit=ui-states&markdownEditorTransaction=1', {
    waitUntil: 'domcontentloaded',
  })
  const editor = page
    .getByTestId('markdown-editor-transaction-fixture')
    .locator('.el-markdown-editor')
  await expect(editor).toBeVisible()
  await expect(page.locator('vite-error-overlay')).toHaveCount(0)
  return { editor, textarea: editor.locator('textarea') }
}

const readFrameMetrics = async (editor: Locator) => {
  const raw = await editor.getAttribute('data-markdown-frame-metrics')
  expect(raw, 'scheduler must sample metrics on the editor root').not.toBeNull()
  return JSON.parse(raw as string) as FrameMetrics
}

const readLayoutCount = async (page: Page) => {
  const session = await page.context().newCDPSession(page)
  await session.send('Performance.enable')
  const { metrics } = await session.send('Performance.getMetrics')
  return metrics.find((metric) => metric.name === 'LayoutCount')?.value ?? 0
}

const largeDocument = Array.from(
  { length: 300 },
  (_, index) => `## Section ${index}\n\nParagraph ${index} with 中文 content.\n`,
).join('\n')

test.describe('markdown editor frame scheduler evidence (#640)', () => {
  // Chromium trace/metric evidence is required by #640; Firefox and WebKit
  // keep their cross-browser input and long-task contracts under #337 and do
  // not expose equivalent layout-count metrics, so they are not faked here.
  test.skip(({ browserName }) => browserName !== 'chromium', 'Chromium-only browser trace evidence')

  test('ordinary input keeps a single scheduling authority with bounded layout work', async ({
    page,
  }, testInfo: TestInfo) => {
    const { editor, textarea } = await openTransactionFixture(page)
    await textarea.click()
    await expect
      .poll(async () => editor.getAttribute('data-markdown-frame-metrics'))
      .not.toBeNull()

    const layoutBefore = await readLayoutCount(page)
    const metricsBefore = await readFrameMetrics(editor)
    const ORDINARY_INPUTS = 12
    for (let index = 0; index < ORDINARY_INPUTS; index += 1) {
      await textarea.pressSequentially('字')
    }
    await expect
      .poll(async () => (await readFrameMetrics(editor)).pending)
      .toBe(0)

    const layoutAfter = await readLayoutCount(page)
    const layoutGrowth = layoutAfter - layoutBefore
    const metrics = await readFrameMetrics(editor)
    const evidence = {
      candidate: process.env.GITHUB_SHA ?? 'local',
      fixture: 'markdownEditorTransaction=1',
      layoutGrowth,
      ordinaryInputs: ORDINARY_INPUTS,
      schedulerAfter: metrics,
      schedulerBefore: metricsBefore,
    }
    await testInfo.attach('frame-scheduler-ordinary-input.json', {
      body: JSON.stringify(evidence, null, 2),
      contentType: 'application/json',
    })

    // No editor-owned read-after-write loop: every layout-affecting read is
    // scheduled in the measure phase, so layout invalidations stay linear in
    // the number of inputs instead of looping per feature per keystroke.
    // The lifetime violation counter may already include the one mount-time
    // visual-viewport settle, so input must not add new violations.
    expect(metrics.violations).toBe(metricsBefore.violations)
    expect(layoutGrowth).toBeLessThanOrEqual(ORDINARY_INPUTS * 4 + 24)
  })

  test('rapid input coalesces into bounded frames without backlog growth', async ({
    page,
  }, testInfo: TestInfo) => {
    const { editor, textarea } = await openTransactionFixture(page)
    await textarea.click()
    await expect
      .poll(async () => editor.getAttribute('data-markdown-frame-metrics'))
      .not.toBeNull()

    const metricsBefore = await readFrameMetrics(editor)
    await textarea.fill(largeDocument)
    for (let index = 0; index < 24; index += 1) {
      await textarea.type('快', { delay: 0 })
    }
    await expect
      .poll(async () => (await readFrameMetrics(editor)).pending)
      .toBe(0)

    const metricsAfter = await readFrameMetrics(editor)
    const evidence = {
      candidate: process.env.GITHUB_SHA ?? 'local',
      fixture: 'markdownEditorTransaction=1 large-document rapid-input',
      schedulerAfter: metricsAfter,
      schedulerBefore: metricsBefore,
    }
    await testInfo.attach('frame-scheduler-rapid-input.json', {
      body: JSON.stringify(evidence, null, 2),
      contentType: 'application/json',
    })

    // Repeated same-key work inside a frame coalesces; the queue never grows
    // without bound and every scheduled frame eventually settles to idle.
    expect(metricsAfter.pending).toBe(0)
    expect(metricsAfter.executed.mutate).toBeGreaterThan(0)
  })

  test('external document reset leaves no pending stale frame task', async ({
    page,
  }, testInfo: TestInfo) => {
    const { editor, textarea } = await openTransactionFixture(page)
    await textarea.click()
    await expect
      .poll(async () => editor.getAttribute('data-markdown-frame-metrics'))
      .not.toBeNull()

    await textarea.fill(largeDocument)
    await textarea.type('切換', { delay: 0 })
    await textarea.fill('# fully replaced document\n')
    await expect
      .poll(async () => (await readFrameMetrics(editor)).pending)
      .toBe(0)

    const metrics = await readFrameMetrics(editor)
    await testInfo.attach('frame-scheduler-document-reset.json', {
      body: JSON.stringify({
        candidate: process.env.GITHUB_SHA ?? 'local',
        fixture: 'markdownEditorTransaction=1 document reset',
        scheduler: metrics,
      }),
      contentType: 'application/json',
    })
    expect(metrics.pending).toBe(0)
  })
})
