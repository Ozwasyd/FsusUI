import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  activateMarkdownFeatures,
  defaultCodeHighlightAdapter,
  defaultLatexAdapter,
  defaultMermaidAdapter,
} from '../markdown-runtime'

const featureModuleMocks = vi.hoisted(() => ({
  katexRenderToString: vi.fn(),
  mermaidInitialize: vi.fn(),
  mermaidRender: vi.fn(),
  shikiCodeToHtml: vi.fn(),
}))

vi.mock('katex', () => ({
  default: {
    renderToString: featureModuleMocks.katexRenderToString,
  },
  renderToString: featureModuleMocks.katexRenderToString,
}))

vi.mock('shiki/core', () => ({
  createHighlighterCore: vi.fn(async () => ({
    codeToHtml: featureModuleMocks.shikiCodeToHtml,
  })),
}))

vi.mock('shiki/engine/javascript', () => ({
  createJavaScriptRegexEngine: vi.fn(() => ({})),
}))

vi.mock('shiki/dist/langs/bash.mjs', () => ({
  default: { name: 'bash' },
}))

vi.mock('shiki/dist/langs/csharp.mjs', () => ({
  default: { name: 'csharp' },
}))

vi.mock('shiki/dist/langs/javascript.mjs', () => ({
  default: { name: 'javascript' },
}))

vi.mock('shiki/dist/langs/typescript.mjs', () => ({
  default: { name: 'typescript' },
}))

vi.mock('shiki/dist/themes/github-dark.mjs', () => ({
  default: { name: 'github-dark' },
}))

vi.mock('shiki/dist/themes/github-light.mjs', () => ({
  default: { name: 'github-light' },
}))

describe('markdown feature activation runtime', () => {
  const globalWithMermaid = globalThis as typeof globalThis & {
    mermaid?: unknown
  }

  beforeEach(() => {
    globalWithMermaid.mermaid = {
      initialize: featureModuleMocks.mermaidInitialize,
      render: featureModuleMocks.mermaidRender,
    }

    featureModuleMocks.katexRenderToString.mockReset()
    featureModuleMocks.mermaidInitialize.mockReset()
    featureModuleMocks.mermaidRender.mockReset()
    featureModuleMocks.shikiCodeToHtml.mockReset()

    featureModuleMocks.mermaidRender.mockResolvedValue({
      svg: [
        '<style>.node{fill:var(--el-color-primary)}</style>',
        '<script>alert(1)</script>',
        '<svg onload="alert(1)" viewBox="0 0 10 10"><g /></svg>',
      ].join(''),
    })
    featureModuleMocks.katexRenderToString.mockReturnValue(
      '<span class="katex"><span>x^2</span><script>alert(1)</script></span>',
    )
    featureModuleMocks.shikiCodeToHtml.mockResolvedValue(
      '<pre class="shiki" style="background:#fff"><code><span style="color:#24292e">const ok = true</span></code></pre>',
    )
  })

  afterEach(() => {
    delete globalWithMermaid.mermaid
  })

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

  it('renders Mermaid, KaTeX, and Shiki with the default adapters', async () => {
    const root = document.createElement('article')
    root.setAttribute('data-theme-resolved', 'dark')
    root.innerHTML = [
      '<figure class="markdown-renderer__mermaid" data-mermaid-placeholder="true"><code>flowchart LR; A --> B;</code></figure>',
      '<span class="markdown-renderer__latex" data-latex-placeholder="true"><code>x^2</code></span>',
      '<pre><code class="language-typescript">const ok = true</code></pre>',
    ].join('')

    const result = await activateMarkdownFeatures({
      codeHighlightAdapter: defaultCodeHighlightAdapter,
      cspNonce: 'nonce-2',
      latexAdapter: defaultLatexAdapter,
      mermaidAdapter: defaultMermaidAdapter,
      root,
    })

    expect(featureModuleMocks.mermaidInitialize).toHaveBeenCalledWith(
      expect.objectContaining({
        securityLevel: 'strict',
        startOnLoad: false,
        theme: 'dark',
      }),
    )
    expect(featureModuleMocks.mermaidRender).toHaveBeenCalledWith(
      expect.stringMatching(/^fsus-markdown-mermaid-/),
      'flowchart LR; A --> B;',
    )
    expect(featureModuleMocks.katexRenderToString).toHaveBeenCalledWith(
      'x^2',
      expect.objectContaining({
        displayMode: false,
        throwOnError: false,
        trust: false,
      }),
    )
    expect(featureModuleMocks.shikiCodeToHtml).toHaveBeenCalledWith(
      'const ok = true',
      expect.objectContaining({
        lang: 'ts',
        theme: 'github-dark',
      }),
    )

    expect(
      root.querySelector('[data-mermaid-rendered="true"] svg'),
    ).toBeTruthy()
    expect(
      root.querySelector('[data-latex-rendered="katex"] .katex'),
    ).toBeTruthy()
    expect(
      root.querySelector('pre[data-code-highlighted="shiki"]'),
    ).toBeTruthy()
    expect(root.querySelector('script')).toBeNull()
    expect(root.querySelector('svg')?.getAttribute('onload')).toBeNull()
    expect(root.querySelector('style')?.nonce).toBe('nonce-2')
    expect(result.errors).toEqual([])
    expect(result.activated.map((item) => item.kind)).toEqual([
      'mermaid',
      'latex',
      'code-highlight',
    ])
  })

  it('records default adapter failures as activation errors', async () => {
    featureModuleMocks.mermaidRender.mockRejectedValueOnce(
      new Error('bad diagram'),
    )
    const root = document.createElement('article')
    root.innerHTML =
      '<figure class="markdown-renderer__mermaid" data-mermaid-placeholder="true"><code>broken</code></figure>'

    const result = await activateMarkdownFeatures({
      features: {
        codeHighlight: false,
        latex: false,
      },
      mermaidAdapter: defaultMermaidAdapter,
      root,
    })

    expect(result.activated).toEqual([])
    expect(result.errors).toEqual([
      {
        kind: 'mermaid',
        message: 'bad diagram',
      },
    ])
    expect(
      root.querySelector('.el-markdown-renderer__feature-error'),
    ).toBeTruthy()
  })
})
