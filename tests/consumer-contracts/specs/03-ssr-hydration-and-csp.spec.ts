import { expect, test } from '@playwright/test'
import { attachPageErrorCollector } from './helpers'

test.describe('FsusUI 2.0 SSR hydration & strict CSP consumer contract', () => {
  test('SSR renders semantic .fsus-* markup and hydrates cleanly under strict CSP with zero violations', async ({
    page,
    request,
  }) => {
    const { errors } = attachPageErrorCollector(page)

    const response = await request.get('/ssr/closed?theme=light')
    expect(response.status()).toBe(200)
    const cspHeader = response.headers()['content-security-policy'] || ''
    expect(cspHeader).toContain("style-src-attr 'none'")
    const rawHtml = await response.text()
    expect(rawHtml).toContain('fsus-button')
    expect(rawHtml).toContain('fsus-card')
    expect(rawHtml).not.toContain('el-button')

    await page.goto('/ssr/closed?theme=light')
    await expect(page.getByTestId('ssr-main')).toHaveAttribute(
      'data-ssr-hydrated',
      'true',
    )

    // Interactive state works immediately after hydration
    await page.getByTestId('ssr-action-btn').click()
    await expect(page.getByTestId('ssr-click-count')).toHaveText('1')

    await page.getByTestId('ssr-check-tag').click()
    await expect(page.getByTestId('ssr-filter-checked')).toHaveText('true')

    await page
      .getByTestId('ssr-segmented')
      .getByRole('radio', { name: 'Changelog' })
      .click()
    await expect(page.getByTestId('ssr-active-segment')).toHaveText('changelog')

    const cspViolations = await page.evaluate(
      () =>
        (window as unknown as { __cspViolations?: unknown[] }).__cspViolations ??
        [],
    )
    expect(cspViolations).toEqual([])
    expect(errors).toEqual([])
  })

  test('strict CSP negative probe detects inline style attribute violation', async ({
    page,
  }) => {
    await page.goto('/ssr/csp-violation-probe')
    await expect(page.getByTestId('ssr-main')).toBeVisible()
    const violations = await page.evaluate(
      () =>
        (window as unknown as { __cspViolations?: Array<{ effectiveDirective?: string }> })
          .__cspViolations ?? [],
    )
    expect(violations.length).toBeGreaterThan(0)
  })
})
