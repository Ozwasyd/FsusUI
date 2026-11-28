import { expect, test } from '@playwright/test'
import { attachPageErrorCollector } from './helpers'

test.describe('FsusUI 2.0 packaged WASM loaders & Markdown worker contract (#1143, #1148)', () => {
  test('WASM runtime initializes and renders Markdown with zero 404s, and FsusMarkdownRenderer uses packaged workers without fallback', async ({
    page,
  }) => {
    const { errors } = attachPageErrorCollector(page)
    const failedResponses: Array<{ status: number; url: string }> = []
    const loadedWorkerUrls: string[] = []
    const loadedWasmUrls: string[] = []

    page.on('response', (response) => {
      const url = response.url()
      const status = response.status()
      if (status >= 400) {
        failedResponses.push({ status, url })
      }
      if (url.includes('markdown-renderer.worker') || url.includes('markdown-parser.worker')) {
        loadedWorkerUrls.push(`${status}:${url}`)
      }
      if (url.includes('ep_wasm') || url.includes('markdown_simd') || url.includes('markdown_basic')) {
        loadedWasmUrls.push(`${status}:${url}`)
      }
    })

    await page.goto('/markdown?theme=light')
    await expect(page.getByTestId('markdown-contract')).toBeVisible()

    // #1143: Core + Markdown WASM loaders initialize & render cleanly from unmodified Vite build
    await expect(page.getByTestId('wasm-probe-status')).toHaveText('ok', {
      timeout: 15_000,
    })
    const engine = await page.getByTestId('wasm-probe-engine').textContent()
    expect(['SIMD-128', 'SCALAR-BASIC']).toContain((engine ?? '').trim())
    await expect(page.getByTestId('wasm-probe-html')).toContainText('Preview baseline')
    await expect(page.getByTestId('wasm-probe-html')).toContainText('<h1')

    // #1148: FsusMarkdownRenderer renders native heading via packaged worker with zero worker-fallback
    const renderer = page.getByTestId('markdown-renderer')
    await expect(renderer.getByRole('heading', { name: 'Draft milestone' })).toBeVisible({
      timeout: 15_000,
    })
    await expect(renderer).not.toContainText('# Draft milestone')

    expect(failedResponses).toEqual([])
    expect(loadedWasmUrls.length).toBeGreaterThanOrEqual(2)
    expect(
      loadedWorkerUrls.some((entry) => entry.startsWith('200:') && entry.includes('markdown-renderer.worker')),
    ).toBe(true)
    expect(
      loadedWorkerUrls.some((entry) => entry.startsWith('200:') && entry.includes('markdown-parser.worker')),
    ).toBe(true)
    expect(errors).toEqual([])
  })
})
