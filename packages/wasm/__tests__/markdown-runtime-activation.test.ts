import { describe, expect, it, vi } from 'vitest'
import { activateMarkdownFeatures } from '../markdown-runtime'

describe('markdown feature activation runtime', () => {
  it('normalizes headings, links, csp styles, placeholders, and code blocks', async () => {
    const root = document.createElement('article')
    root.innerHTML = [
      '<h2>Release Notes</h2>',
      '<a href="#release-notes">hash</a>',
      '<a href="https://example.com/docs">external</a>',
      '<style>.probe{color:red}</style>',
      '<figure class="markdown-renderer__mermaid" data-mermaid-placeholder="true"></figure>',
      '<span class="markdown-renderer__latex" data-latex-placeholder="true"></span>',
      '<pre><code class="language-ts">const ok = true</code></pre>',
    ].join('')
    const mermaidAdapter = vi.fn()

    const result = await activateMarkdownFeatures({
      baseUrl: 'https://fsus.local/docs',
      cspNonce: 'nonce-1',
      mermaidAdapter,
      root,
    })

    expect(root.querySelector('h2')?.id).toBe('release-notes')
    expect(
      root
        .querySelector('a[href^="#"]')
        ?.getAttribute('data-markdown-hash-link'),
    ).toBe('true')
    expect(
      root
        .querySelector('a[href^="https://example.com"]')
        ?.getAttribute('target'),
    ).toBe('_blank')
    expect(
      root.querySelector('a[href^="https://example.com"]')?.getAttribute('rel'),
    ).toContain('noopener')
    expect(root.querySelector('style')?.nonce).toBe('nonce-1')
    expect(
      root
        .querySelector('.markdown-renderer__mermaid')
        ?.getAttribute('data-markdown-feature-activated'),
    ).toBe('mermaid')
    expect(
      root
        .querySelector('.markdown-renderer__latex')
        ?.getAttribute('data-markdown-feature-activated'),
    ).toBe('latex')
    expect(
      root
        .querySelector('code')
        ?.getAttribute('data-markdown-feature-activated'),
    ).toBe('code-highlight')
    expect(mermaidAdapter).toHaveBeenCalledTimes(1)
    expect(result.errors).toEqual([])
    expect(result.activated.map((item) => item.kind)).toEqual([
      'heading',
      'external-link',
      'hash-link',
      'csp-style',
      'mermaid',
      'latex',
      'code-highlight',
    ])
  })
})
