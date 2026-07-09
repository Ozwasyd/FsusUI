import { afterEach, describe, expect, it, vi } from 'vitest'
import { sanitizeMarkdownHtml } from '../src/markdown-sanitize'

describe('markdown html sanitizer', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('removes active HTML while preserving inert markup', () => {
    const html = sanitizeMarkdownHtml(
      [
        '<h2>Title</h2>',
        '<script>alert(1)</script>',
        '<img src="x" onerror="alert(1)">',
        '<a href="javascript:alert(1)">bad</a>',
        '<p style="background:url(data:text/html;base64,PHNjcmlwdA==)">body</p>',
      ].join(''),
    )

    const container = document.createElement('div')
    container.innerHTML = html

    expect(container.querySelector('h2')?.textContent).toBe('Title')
    expect(container.querySelector('script')).toBeNull()
    expect(container.querySelector('img')?.getAttribute('onerror')).toBeNull()
    expect(container.querySelector('a')?.getAttribute('href')).toBeNull()
    expect(container.querySelector('p')?.getAttribute('style')).toBeNull()
  })

  it('uses the conservative string sanitizer when no DOM is available', () => {
    vi.stubGlobal('document', undefined)

    const html = sanitizeMarkdownHtml(
      '<script>alert(1)</script><img src=x onerror="alert(1)"><a href="javascript:alert(1)">bad</a>',
    )

    expect(html).not.toContain('<script')
    expect(html).not.toContain('onerror')
    expect(html).not.toContain('javascript:')
  })
})
