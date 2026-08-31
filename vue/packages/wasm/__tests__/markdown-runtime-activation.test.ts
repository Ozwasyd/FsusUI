import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { activateMarkdownFeatures } from '../markdown-runtime'
import { activateMarkdownHeavyFeatures } from '../markdown-heavy-feature-activation'
import {
  createMarkdownHeavyFeatureLifecycle,
  type MarkdownHeavyFeatureKind,
} from '../../hooks/use-markdown-heavy-feature-lifecycle'
import { getMarkdownXssFeatureOutput } from '../../../tests/support/markdown-xss-corpus'

const featureModuleMocks = vi.hoisted(() => ({
  katexLoad: vi.fn(async () => undefined),
  katexRenderToString: vi.fn(),
  mermaidInitialize: vi.fn(),
  mermaidRender: vi.fn(),
  shikiCodeToHtml: vi.fn(),
  shikiLoadLanguage: vi.fn(async () => undefined),
  shikiLoadTheme: vi.fn(async () => undefined),
}))

vi.mock('katex', async () => {
  await featureModuleMocks.katexLoad()
  return {
    default: {
      renderToString: featureModuleMocks.katexRenderToString,
    },
    renderToString: featureModuleMocks.katexRenderToString,
  }
})

vi.mock('shiki/core', () => ({
  createHighlighterCore: vi.fn(async () => ({
    codeToHtml: featureModuleMocks.shikiCodeToHtml,
    loadLanguage: featureModuleMocks.shikiLoadLanguage,
    loadTheme: featureModuleMocks.shikiLoadTheme,
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

const createDeferred = () => {
  let release = () => undefined
  const promise = new Promise<void>((resolve) => {
    release = resolve
  })
  return { promise, release }
}

describe('markdown feature activation runtime', () => {
  const globalWithMermaid = globalThis as typeof globalThis & {
    mermaid?: unknown
  }

  beforeEach(() => {
    globalWithMermaid.mermaid = {
      initialize: featureModuleMocks.mermaidInitialize,
      render: featureModuleMocks.mermaidRender,
    }

    featureModuleMocks.katexLoad.mockReset()
    featureModuleMocks.katexRenderToString.mockReset()
    featureModuleMocks.mermaidInitialize.mockReset()
    featureModuleMocks.mermaidRender.mockReset()
    featureModuleMocks.shikiCodeToHtml.mockReset()
    featureModuleMocks.shikiLoadLanguage.mockClear()
    featureModuleMocks.shikiLoadTheme.mockClear()

    featureModuleMocks.katexLoad.mockResolvedValue(undefined)
    featureModuleMocks.mermaidRender.mockImplementation((id: string) => {
      const output = getMarkdownXssFeatureOutput('mxss-feature-mermaid-script')
      return {
        svg: output.payload.replaceAll(output.rootId!, id),
      }
    })
    featureModuleMocks.katexRenderToString.mockReturnValue(
      getMarkdownXssFeatureOutput('mxss-feature-latex-event').payload,
    )
    featureModuleMocks.shikiCodeToHtml.mockImplementation(
      async (_source, options) =>
        `<pre class="shiki ${options.theme}" style="background:#fff"><code><span class="line"><span style="color:#24292e">const ok = true</span></span></code></pre>`,
    )
  })

  afterEach(() => {
    delete globalWithMermaid.mermaid
  })

  it('normalizes headings, links, and csp styles independently of feature rendering', async () => {
    const root = document.createElement('article')
    const getComputedStyle = vi.spyOn(window, 'getComputedStyle')
    root.innerHTML = [
      '<h2>Release Notes</h2>',
      '<a href="#release-notes">hash</a>',
      '<a href="https://example.com/docs">external</a>',
      '<style>.probe{color:red}</style>',
      '<figure class="markdown-renderer__mermaid" data-mermaid-placeholder="true"></figure>',
      '<span class="markdown-renderer__latex" data-latex-placeholder="true"></span>',
      '<pre><code class="language-ts">const ok = true</code></pre>',
    ].join('')
    const result = await activateMarkdownFeatures({
      baseUrl: 'https://fsus.local/docs',
      cspNonce: 'nonce-1',
      features: {
        codeHighlight: false,
        latex: false,
        mermaid: false,
      },
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
    expect(result.errors).toEqual([])
    expect(result.activated.map((item) => item.kind)).toEqual([
      'heading',
      'external-link',
      'hash-link',
      'csp-style',
    ])
    expect(getComputedStyle).not.toHaveBeenCalled()
    getComputedStyle.mockRestore()
  })

  it('starts Mermaid, KaTeX, and Shiki together with the default global concurrency', async () => {
    const root = document.createElement('article')
    root.innerHTML = [
      '<figure class="markdown-renderer__mermaid" data-mermaid-placeholder="true"><code>flowchart LR; A --> B;</code></figure>',
      '<span class="markdown-renderer__latex" data-latex-placeholder="true"><code>x^2</code></span>',
      '<pre><code class="language-typescript">const ok = true</code></pre>',
    ].join('')
    const mermaid = createDeferred()
    const latex = createDeferred()
    const shiki = createDeferred()
    const started: string[] = []

    featureModuleMocks.mermaidRender.mockImplementation(async (id: string) => {
      started.push('mermaid')
      await mermaid.promise
      const output = getMarkdownXssFeatureOutput('mxss-feature-mermaid-script')
      return {
        svg: output.payload.replaceAll(output.rootId!, id),
      }
    })
    featureModuleMocks.katexLoad.mockImplementation(async () => {
      started.push('latex')
      await latex.promise
    })
    featureModuleMocks.shikiCodeToHtml.mockImplementation(async () => {
      started.push('code-highlight')
      await shiki.promise
      return '<pre class="shiki github-light"><code><span class="line">const ok = true</span></code></pre>'
    })

    const activation = activateMarkdownFeatures({ root })

    await vi.waitFor(() =>
      expect(new Set(started)).toEqual(
        new Set(['mermaid', 'latex', 'code-highlight']),
      ),
    )
    expect(root.querySelector('[data-markdown-feature-activated]')).toBeNull()
    mermaid.release()
    latex.release()
    shiki.release()
    const result = await activation

    expect(featureModuleMocks.mermaidRender).toHaveBeenCalledTimes(1)
    expect(featureModuleMocks.katexRenderToString).toHaveBeenCalledTimes(1)
    expect(featureModuleMocks.shikiCodeToHtml).toHaveBeenCalledTimes(1)
    expect(featureModuleMocks.shikiLoadLanguage).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'typescript' }),
    )
    expect(featureModuleMocks.shikiLoadTheme).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'github-light' }),
    )
    expect(
      root.querySelectorAll('[data-markdown-feature-activated]'),
    ).toHaveLength(3)
    expect(root.querySelector('script')).toBeNull()
    expect(root.querySelector('svg')?.getAttribute('onload')).toBeNull()
    expect(result).toEqual({
      activated: [
        { count: 1, kind: 'mermaid' },
        { count: 1, kind: 'latex' },
        { count: 1, kind: 'code-highlight' },
      ],
      errors: [],
    })
  })

  it('renders Mermaid, KaTeX, and Shiki through the built-in output gateway', async () => {
    const root = document.createElement('article')
    const createElement = vi.spyOn(document, 'createElement')
    const getComputedStyle = vi.spyOn(window, 'getComputedStyle')
    root.setAttribute('data-theme-resolved', 'dark')
    root.style.setProperty('--el-color-primary', 'red;} body{display:none')
    root.style.setProperty(
      '--el-color-danger',
      'url(https://evil.example/color)',
    )
    root.innerHTML = [
      '<figure class="markdown-renderer__mermaid" data-mermaid-placeholder="true"><code>flowchart LR; A --> B;</code></figure>',
      '<span class="markdown-renderer__latex" data-latex-placeholder="true"><code>x^2</code></span>',
      '<pre><code class="language-typescript">const ok = true</code></pre>',
    ].join('')

    const result = await activateMarkdownFeatures({
      cspNonce: 'nonce-2',
      root,
    })

    expect(featureModuleMocks.mermaidInitialize).toHaveBeenCalledWith(
      expect.objectContaining({
        htmlLabels: false,
        securityLevel: 'strict',
        startOnLoad: false,
        theme: 'dark',
        themeVariables: expect.objectContaining({
          nodeBorder: '#409eff',
          primaryBorderColor: '#409eff',
        }),
      }),
    )
    expect(featureModuleMocks.mermaidRender).toHaveBeenCalledWith(
      expect.stringMatching(/^fsus-markdown-mermaid-/),
      'flowchart LR; A --> B;',
    )
    expect(featureModuleMocks.mermaidRender).toHaveBeenCalledTimes(1)
    expect(featureModuleMocks.katexRenderToString).toHaveBeenCalledWith(
      'x^2',
      expect.objectContaining({
        displayMode: false,
        errorColor: '#f56c6c',
        output: 'mathml',
        throwOnError: false,
        trust: false,
      }),
    )
    expect(featureModuleMocks.katexRenderToString).toHaveBeenCalledTimes(1)
    expect(featureModuleMocks.shikiCodeToHtml).toHaveBeenCalledWith(
      'const ok = true',
      expect.objectContaining({
        lang: 'ts',
        theme: 'github-dark',
      }),
    )
    expect(featureModuleMocks.shikiCodeToHtml).toHaveBeenCalledTimes(1)
    expect(getComputedStyle).toHaveBeenCalledTimes(1)
    expect(
      createElement.mock.calls.filter(([tagName]) => tagName === 'template'),
    ).toHaveLength(3)

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
    expect(result.errors).toEqual([])
    expect(result.activated.map((item) => item.kind)).toEqual([
      'mermaid',
      'latex',
      'code-highlight',
    ])
    createElement.mockRestore()
    getComputedStyle.mockRestore()
  })

  it('commits every built-in feature exactly once for five distinct revisions', async () => {
    const root = document.createElement('article')
    const createElement = vi.spyOn(document, 'createElement')
    const getComputedStyle = vi.spyOn(window, 'getComputedStyle')
    document.body.append(root)

    for (let revision = 1; revision <= 5; revision += 1) {
      const dark = revision % 2 === 0
      const primaryColor = dark ? '#123456' : '#abcdef'
      const dangerColor = dark ? '#654321' : '#fedcba'
      root.setAttribute('data-theme-resolved', dark ? 'dark' : 'light')
      root.style.setProperty('--el-color-primary', primaryColor)
      root.style.setProperty('--el-color-danger', dangerColor)
      root.innerHTML = [
        `<figure class="markdown-renderer__mermaid" data-mermaid-placeholder="true"><code>sequenceDiagram\nAlice-->>Bob: revision ${revision}</code></figure>`,
        `<span class="markdown-renderer__latex" data-latex-placeholder="true"><code>x_${revision}</code></span>`,
        `<pre><code class="language-typescript">const revision = ${revision}</code></pre>`,
      ].join('')

      const result = await activateMarkdownFeatures({ root })

      expect(result.errors).toEqual([])
      expect(result.activated).toEqual([
        { count: 1, kind: 'mermaid' },
        { count: 1, kind: 'latex' },
        { count: 1, kind: 'code-highlight' },
      ])
      expect(
        root.querySelectorAll('[data-markdown-feature-activated]'),
      ).toHaveLength(3)
      expect(featureModuleMocks.mermaidInitialize).toHaveBeenLastCalledWith(
        expect.objectContaining({
          theme: dark ? 'dark' : 'default',
          themeVariables: expect.objectContaining({
            nodeBorder: primaryColor,
            primaryBorderColor: primaryColor,
          }),
        }),
      )
      expect(featureModuleMocks.katexRenderToString).toHaveBeenLastCalledWith(
        `x_${revision}`,
        expect.objectContaining({ errorColor: dangerColor }),
      )
      expect(featureModuleMocks.shikiCodeToHtml).toHaveBeenLastCalledWith(
        `const revision = ${revision}`,
        expect.objectContaining({
          theme: dark ? 'github-dark' : 'github-light',
        }),
      )
      expect(getComputedStyle).toHaveBeenCalledTimes(revision)
    }

    expect(featureModuleMocks.mermaidRender).toHaveBeenCalledTimes(5)
    expect(featureModuleMocks.katexRenderToString).toHaveBeenCalledTimes(5)
    expect(featureModuleMocks.shikiCodeToHtml).toHaveBeenCalledTimes(5)
    expect(
      createElement.mock.calls.filter(([tagName]) => tagName === 'template'),
    ).toHaveLength(15)
    root.remove()
    createElement.mockRestore()
    getComputedStyle.mockRestore()
  })

  it('does not count empty or already committed feature elements', async () => {
    const root = document.createElement('article')
    root.innerHTML = [
      '<figure class="markdown-renderer__mermaid" data-mermaid-placeholder="true"></figure>',
      '<span class="markdown-renderer__latex" data-latex-rendered="katex"><span class="katex"></span></span>',
      '<pre data-code-highlighted="shiki"><code class="language-ts">already highlighted</code></pre>',
    ].join('')

    const result = await activateMarkdownFeatures({ root })

    expect(result.errors).toEqual([])
    expect(result.activated).toEqual([])
    expect(featureModuleMocks.mermaidRender).not.toHaveBeenCalled()
    expect(featureModuleMocks.katexRenderToString).not.toHaveBeenCalled()
    expect(featureModuleMocks.shikiCodeToHtml).not.toHaveBeenCalled()
  })

  it('records default adapter failures as activation errors', async () => {
    featureModuleMocks.mermaidRender.mockRejectedValueOnce(
      new Error('bad diagram'),
    )
    const root = document.createElement('article')
    root.innerHTML =
      '<figure class="markdown-renderer__mermaid" data-mermaid-placeholder="true"><code>&lt;img src=x onerror=alert(1)&gt;</code></figure>'

    const result = await activateMarkdownFeatures({
      features: {
        codeHighlight: false,
        latex: false,
      },
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
    expect(
      root.querySelector('.el-markdown-renderer__feature-error code')
        ?.textContent,
    ).toBe('<img src=x onerror=alert(1)>')
    expect(
      root.querySelector('.el-markdown-renderer__feature-error img'),
    ).toBeNull()
  })

  it('shares an explicit concurrency limit across mixed feature kinds', async () => {
    const root = document.createElement('article')
    root.innerHTML = [
      '<figure class="markdown-renderer__mermaid" data-mermaid-placeholder="true"><code>diagram-1</code></figure>',
      '<figure class="markdown-renderer__mermaid" data-mermaid-placeholder="true"><code>diagram-2</code></figure>',
      '<span class="markdown-renderer__latex" data-latex-placeholder="true"><code>x^2</code></span>',
      '<pre><code class="language-typescript">code-1</code></pre>',
      '<pre><code class="language-typescript">code-2</code></pre>',
    ].join('')
    const releases = new Map<string, () => void>()
    const started: string[] = []
    let active = 0
    let maxActive = 0
    const waitForRelease = async (label: string) => {
      const deferred = createDeferred()
      releases.set(label, deferred.release)
      started.push(label)
      active += 1
      maxActive = Math.max(maxActive, active)
      await deferred.promise
      active -= 1
    }

    featureModuleMocks.mermaidRender.mockImplementation(
      async (id: string, source: string) => {
        await waitForRelease(`mermaid:${source}`)
        return {
          svg: `<svg id="${id}" xmlns="http://www.w3.org/2000/svg"><g /></svg>`,
        }
      },
    )
    featureModuleMocks.katexRenderToString.mockImplementation((source) => {
      const label = `latex:${source}`
      started.push(label)
      active += 1
      maxActive = Math.max(maxActive, active)
      active -= 1
      return '<span class="katex"><math xmlns="http://www.w3.org/1998/Math/MathML"><mi>x</mi></math></span>'
    })
    featureModuleMocks.shikiCodeToHtml.mockImplementation(async (source) => {
      await waitForRelease(`code-highlight:${source}`)
      return `<pre class="shiki github-light"><code><span class="line">${source}</span></code></pre>`
    })

    const activation = activateMarkdownFeatures({
      concurrency: 2,
      root,
    })

    await vi.waitFor(() => expect(started).toHaveLength(2))
    expect(started).toEqual(['mermaid:diagram-1', 'mermaid:diagram-2'])
    releases.get('mermaid:diagram-1')?.()
    await vi.waitFor(() => expect(started).toHaveLength(4))
    expect(started.slice(2)).toEqual(['latex:x^2', 'code-highlight:code-1'])
    releases.get('mermaid:diagram-2')?.()
    await vi.waitFor(() => expect(started).toHaveLength(5))
    releases.get('code-highlight:code-1')?.()
    releases.get('code-highlight:code-2')?.()
    const result = await activation

    expect(maxActive).toBe(2)
    expect(result).toEqual({
      activated: [
        { count: 2, kind: 'mermaid' },
        { count: 1, kind: 'latex' },
        { count: 2, kind: 'code-highlight' },
      ],
      errors: [],
    })
    expect(
      root.querySelectorAll('[data-markdown-feature-activated]'),
    ).toHaveLength(5)
  })

  it('reuses immutable mixed feature output through the gateway after remount', async () => {
    const lifecycle = createMarkdownHeavyFeatureLifecycle()
    const markup = [
      '<figure class="markdown-renderer__mermaid" data-mermaid-placeholder="true"><code>graph TD\nA--&gt;B</code></figure>',
      '<span class="markdown-renderer__latex" data-latex-placeholder="true"><code>x^2</code></span>',
      '<pre><code class="language-typescript">const ok = true</code></pre>',
    ].join('')
    const activate = async (root: HTMLElement) => {
      const occurrence: Record<MarkdownHeavyFeatureKind, number> = {
        'code-highlight': 0,
        latex: 0,
        mermaid: 0,
      }
      return activateMarkdownHeavyFeatures({
        heavyLifecycle: lifecycle,
        resolveHeavyFeatureIdentity: ({ kind }) => {
          const node = occurrence[kind]++
          return {
            config: 'default',
            documentEpoch: 1,
            documentKey: 'doc-a',
            featureKind: kind,
            gatewayVersion: 'gateway@1',
            locale: 'en',
            nodeId: `${kind}-${node}`,
            rendererVersion: 'renderer@1',
            revision: 1,
            sourceIdentity: 'source-a',
            theme: 'light',
          }
        },
        root,
      })
    }

    const first = document.createElement('article')
    first.innerHTML = markup
    await activate(first)
    expect(lifecycle.metrics()).toMatchObject({
      activations: 3,
      cacheEntries: 3,
      staticNodes: 3,
    })
    lifecycle.unmountRoot(first)

    const second = document.createElement('article')
    second.innerHTML = markup
    const result = await activate(second)

    expect(result.errors).toEqual([])
    expect(lifecycle.metrics()).toMatchObject({
      activations: 3,
      activeNodes: 0,
      reuses: 3,
      staticNodes: 3,
      teardowns: 3,
    })
    expect(featureModuleMocks.mermaidRender).toHaveBeenCalledTimes(1)
    expect(featureModuleMocks.katexRenderToString).toHaveBeenCalledTimes(1)
    expect(featureModuleMocks.shikiCodeToHtml).toHaveBeenCalledTimes(1)
    expect(second.querySelector('[data-mermaid-rendered="true"]')).toBeTruthy()
    expect(second.querySelector('[data-latex-rendered="katex"]')).toBeTruthy()
    expect(second.querySelector('[data-code-highlighted="shiki"]')).toBeTruthy()
    expect(second.querySelector('script')).toBeNull()
    expect(second.querySelector('[onload],[onclick],[onerror]')).toBeNull()
  })

  it('registers and tears down the real adapter task and abort listener offscreen', async () => {
    const lifecycle = createMarkdownHeavyFeatureLifecycle()
    const deferred = createDeferred()
    featureModuleMocks.mermaidRender.mockImplementation(async (id: string) => {
      await deferred.promise
      const output = getMarkdownXssFeatureOutput('mxss-feature-mermaid-script')
      return { svg: output.payload.replaceAll(output.rootId!, id) }
    })
    const root = document.createElement('article')
    root.innerHTML =
      '<figure class="markdown-renderer__mermaid" data-mermaid-placeholder="true"><code>graph TD\nA--&gt;B</code></figure>'
    const activation = activateMarkdownHeavyFeatures({
      heavyLifecycle: lifecycle,
      resolveHeavyFeatureIdentity: ({ kind }) => ({
        config: 'mermaid-default',
        documentEpoch: 1,
        documentKey: 'doc-a',
        featureKind: kind,
        gatewayVersion: 'gateway@2',
        locale: 'locale-independent',
        nodeId: 'mermaid-0',
        rendererVersion: 'renderer@1',
        revision: 1,
        sourceIdentity: 'source-a',
        theme: 'light',
      }),
      root,
    })

    await vi.waitFor(() =>
      expect(featureModuleMocks.mermaidRender).toHaveBeenCalledTimes(1),
    )
    expect(lifecycle.metrics()).toMatchObject({
      activeNodes: 1,
      retainedListeners: 2,
      retainedResources: 3,
      retainedTasks: 1,
    })

    lifecycle.unmountRoot(root)
    expect(lifecycle.metrics()).toMatchObject({
      activeNodes: 0,
      retainedListeners: 0,
      retainedResources: 0,
      retainedTasks: 0,
    })
    expect(await activation).toEqual({ activated: [], errors: [] })
    expect(root.querySelector('[data-markdown-feature-activated]')).toBeNull()
    deferred.release()
    await Promise.resolve()
  })

  it('keeps stable feature-kind order when concurrency is one', async () => {
    const root = document.createElement('article')
    root.innerHTML = [
      '<figure class="markdown-renderer__mermaid" data-mermaid-placeholder="true"><code>diagram</code></figure>',
      '<span class="markdown-renderer__latex" data-latex-placeholder="true"><code>x</code></span>',
      '<pre><code class="language-typescript">code</code></pre>',
    ].join('')
    const started: string[] = []

    featureModuleMocks.mermaidRender.mockImplementation((id: string) => {
      started.push('mermaid')
      return {
        svg: `<svg id="${id}" xmlns="http://www.w3.org/2000/svg"><g /></svg>`,
      }
    })
    featureModuleMocks.katexRenderToString.mockImplementation(() => {
      started.push('latex')
      return '<span class="katex"><math xmlns="http://www.w3.org/1998/Math/MathML"><mi>x</mi></math></span>'
    })
    featureModuleMocks.shikiCodeToHtml.mockImplementation(async () => {
      started.push('code-highlight')
      return '<pre class="shiki github-light"><code><span class="line">code</span></code></pre>'
    })

    const result = await activateMarkdownFeatures({
      concurrency: 1,
      root,
    })

    expect(started).toEqual(['mermaid', 'latex', 'code-highlight'])
    expect(result.activated.map((item) => item.kind)).toEqual([
      'mermaid',
      'latex',
      'code-highlight',
    ])
    expect(result.errors).toEqual([])
  })

  it('limits concurrent feature work and stops scheduling after cancellation', async () => {
    const root = document.createElement('article')
    root.innerHTML = Array.from(
      { length: 8 },
      (_, index) => `<pre><code class="language-ts">item-${index}</code></pre>`,
    ).join('')
    const controller = new AbortController()
    const releases: Array<() => void> = []
    let active = 0
    let maxActive = 0
    const started: string[] = []
    featureModuleMocks.shikiCodeToHtml.mockImplementation(async (source) => {
      started.push(source)
      active += 1
      maxActive = Math.max(maxActive, active)
      await new Promise<void>((resolve) => releases.push(resolve))
      active -= 1
      return `<pre class="shiki github-light"><code><span class="line"><span style="color:#24292e">${source}</span></span></code></pre>`
    })

    const activation = activateMarkdownFeatures({
      concurrency: 2,
      features: {
        cspNonce: false,
        externalLink: false,
        hashLink: false,
        headingSlug: false,
        latex: false,
        mermaid: false,
      },
      root,
      signal: controller.signal,
    })

    await vi.waitFor(() => expect(started).toHaveLength(2))
    controller.abort()
    releases.splice(0).forEach((release) => release())
    const result = await activation

    expect(maxActive).toBe(2)
    expect(started).toEqual(['item-0', 'item-1'])
    expect(result.activated).toEqual([])
    expect(result.errors).toEqual([
      { kind: 'code-highlight', message: 'shiki_render_aborted' },
      { kind: 'code-highlight', message: 'shiki_render_aborted' },
    ])
    expect(featureModuleMocks.shikiCodeToHtml).toHaveBeenCalledTimes(2)
    expect(root.querySelector('[data-markdown-feature-activated]')).toBeNull()
  })
})
