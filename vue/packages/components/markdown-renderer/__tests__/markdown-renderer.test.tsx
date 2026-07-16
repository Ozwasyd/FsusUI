import { flushPromises, mount } from '@vue/test-utils'
import { computed } from 'vue'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { configProviderContextKey } from '@element-plus/components/config-provider'
import MarkdownRenderer from '../src/markdown-renderer.vue'
import { resolveMarkdownWorkerScriptUrl } from '../src/markdown-renderer'
import {
  buildMarkdownRenderResult,
  renderMarkdownChunksWithRuntime,
  renderMarkdownHtmlWithRuntime,
  renderMarkdownResultWithRuntime,
} from '@element-plus/wasm'
import { createFsusError, fsusErr, fsusOk } from '@element-plus/utils'
import {
  clearMarkdownRendererRuntimeCache,
  getMarkdownRendererRuntimeCache,
  setMarkdownRendererRuntimeCache,
} from '../src/markdown-renderer-cache'

import type {
  MarkdownRuntimeHtmlResult,
  MarkdownRuntimeChunkResult,
  MarkdownRuntimeRenderResult,
} from '@element-plus/wasm'
import type { FsusResult } from '@element-plus/utils'

const markdownFeatureAdapterMocks = vi.hoisted(() => ({
  defaultCodeHighlightAdapter: vi.fn(async (element: HTMLElement) => {
    element.dataset.defaultCodeHighlightAdapter = 'true'
  }),
  defaultLatexAdapter: vi.fn(async (element: HTMLElement) => {
    element.dataset.defaultLatexAdapter = 'true'
  }),
  defaultMermaidAdapter: vi.fn(async (element: HTMLElement) => {
    element.dataset.defaultMermaidAdapter = 'true'
  }),
}))

vi.mock('@element-plus/wasm', async () => {
  const actual =
    await vi.importActual<typeof import('@element-plus/wasm')>(
      '@element-plus/wasm',
    )
  const runtime = await vi.importActual<
    typeof import('../../../wasm/markdown-runtime')
  >('../../../wasm/markdown-runtime')

  return {
    ...actual,
    activateMarkdownFeatures: runtime.activateMarkdownFeatures,
    defaultCodeHighlightAdapter:
      markdownFeatureAdapterMocks.defaultCodeHighlightAdapter,
    defaultLatexAdapter: markdownFeatureAdapterMocks.defaultLatexAdapter,
    defaultMermaidAdapter: markdownFeatureAdapterMocks.defaultMermaidAdapter,
    renderMarkdownChunksWithRuntime: vi.fn(),
    renderMarkdownHtmlWithRuntime: vi.fn(),
    renderMarkdownResultWithRuntime: vi.fn(),
  }
})

const renderMarkdownChunks = vi.mocked(renderMarkdownChunksWithRuntime)
const renderMarkdownHtml = vi.mocked(renderMarkdownHtmlWithRuntime)
const renderMarkdownResult = vi.mocked(renderMarkdownResultWithRuntime)

const makeTimings = () => ({
  initMs: 0,
  encodeMs: 1,
  wasmRenderMs: 2,
  readHtmlMs: 1,
  readFeaturesMs: 0,
  readPlaceholdersMs: 0,
  readMetadataMs: 0,
  totalMs: 4,
})

const makeResult = (
  source: string,
  html: string,
  overrides: Partial<MarkdownRuntimeRenderResult> = {},
): MarkdownRuntimeRenderResult => ({
  ...buildMarkdownRenderResult({
    html,
    source,
    placeholders: overrides.placeholders,
    features: overrides.features,
    metadata: overrides.metadata,
  }),
  engine: 'SCALAR-BASIC',
  timings: makeTimings(),
  ...overrides,
})

const makeHtmlResult = (
  html: string,
  overrides: Partial<MarkdownRuntimeHtmlResult> = {},
): MarkdownRuntimeHtmlResult => ({
  html,
  engine: 'SCALAR-BASIC',
  rendererVersion: 'markdown-wasm-contract@test',
  timings: makeTimings(),
  ...overrides,
})

const makeChunkResult = (
  source: string,
  html: string,
  overrides: Partial<MarkdownRuntimeChunkResult> = {},
): MarkdownRuntimeChunkResult => ({
  ...makeResult(source, html, overrides),
  chunks: [
    {
      key: 'md-0-0',
      kind: 'heading',
      html: '<h1>Chunked</h1>',
      estimatedSize: 48,
      htmlStartOffset: 0,
      htmlEndOffset: 16,
    },
    {
      key: 'md-1-16',
      kind: 'paragraph',
      html: '<p>Chunk body</p>',
      estimatedSize: 48,
      htmlStartOffset: 16,
      htmlEndOffset: html.length,
    },
  ],
  ...overrides,
})

const flushRenderer = async () => {
  await vi.advanceTimersByTimeAsync(250)
  await flushPromises()
  await vi.advanceTimersByTimeAsync(250)
  await flushPromises()
}

const forcedChunkedPipeline = {
  global: {
    provide: {
      [configProviderContextKey as symbol]: computed(() => ({
        renderPipeline: {
          budget: { measureBatch: 2 },
          mode: 'enabled',
          worker: 'disabled',
        },
      })),
    },
  },
}

describe('MarkdownRenderer.vue', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    clearMarkdownRendererRuntimeCache()
    renderMarkdownChunks.mockReset()
    renderMarkdownHtml.mockReset()
    renderMarkdownResult.mockReset()
    markdownFeatureAdapterMocks.defaultCodeHighlightAdapter.mockClear()
    markdownFeatureAdapterMocks.defaultLatexAdapter.mockClear()
    markdownFeatureAdapterMocks.defaultMermaidAdapter.mockClear()
    renderMarkdownHtml.mockImplementation(async (request) =>
      fsusOk(
        makeHtmlResult(
          typeof request === 'string' ? request : `<p>${request.source}</p>`,
        ),
      ),
    )
  })

  afterEach(() => {
    clearMarkdownRendererRuntimeCache()
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })

  test('uses the host TrustedScriptURL factory for the markdown worker URL', () => {
    const moduleUrl = new URL(
      'https://blog.example/assets/markdown-renderer.worker-Abc_123.js',
    )
    const trustedUrl = { kind: 'TrustedScriptURL', value: moduleUrl.href }
    const trustedScriptUrlFactory = vi.fn(() => trustedUrl)

    expect(
      resolveMarkdownWorkerScriptUrl(moduleUrl, trustedScriptUrlFactory),
    ).toBe(trustedUrl)
    expect(trustedScriptUrlFactory).toHaveBeenCalledOnce()
    expect(trustedScriptUrlFactory).toHaveBeenCalledWith(moduleUrl)
    expect(resolveMarkdownWorkerScriptUrl(moduleUrl)).toBe(moduleUrl)
  })

  test('renders raw html from the wasm markdown runtime', async () => {
    renderMarkdownHtml.mockResolvedValue(
      fsusOk(makeHtmlResult('<h1>Title</h1>')),
    )
    renderMarkdownResult.mockResolvedValue(
      fsusOk(makeResult('# Title', '<h1>Title</h1>')),
    )

    const wrapper = mount(MarkdownRenderer, {
      props: { content: '# Title' },
    })
    await flushRenderer()

    const heading = wrapper.find('h1')
    expect(heading.text()).toBe('Title')
    expect(heading.attributes('data-markdown-heading')).toBe('title')
    expect(wrapper.find('[data-markdown-renderer="wasm"]').exists()).toBe(true)
    expect(renderMarkdownHtml).not.toHaveBeenCalled()
    expect(wrapper.emitted('render-profile')).toHaveLength(1)
    expect(wrapper.emitted('render-complete')).toHaveLength(1)
  })

  test('shows a loading state while the markdown runtime is rendering', async () => {
    let resolveFull:
      | ((result: FsusResult<MarkdownRuntimeRenderResult>) => void)
      | undefined

    renderMarkdownResult.mockReturnValue(
      new Promise((resolve) => {
        resolveFull = resolve
      }),
    )

    const wrapper = mount(MarkdownRenderer, {
      props: { content: '# Loading' },
    })

    await vi.advanceTimersByTimeAsync(20)
    await flushPromises()

    expect(wrapper.attributes('aria-busy')).toBe('true')
    expect(wrapper.find('[data-markdown-renderer-loading]').exists()).toBe(true)

    resolveFull?.(fsusOk(makeResult('# Loading', '<h1>Loading</h1>')))
    await flushPromises()
    await vi.advanceTimersByTimeAsync(20)
    await flushPromises()

    expect(wrapper.attributes('aria-busy')).toBe('false')
    expect(wrapper.find('[data-markdown-renderer-loading]').exists()).toBe(
      false,
    )
  })

  test('defaults to escaped raw html and enabled latex/mermaid', async () => {
    renderMarkdownHtml.mockResolvedValue(
      fsusOk(makeHtmlResult('&lt;script&gt;alert(1)&lt;/script&gt;')),
    )
    renderMarkdownResult.mockResolvedValue(
      fsusOk(
        makeResult(
          '<script>alert(1)</script>',
          '&lt;script&gt;alert(1)&lt;/script&gt;',
        ),
      ),
    )

    mount(() => <MarkdownRenderer content="<script>alert(1)</script>" />)
    await flushRenderer()

    expect(renderMarkdownHtml).not.toHaveBeenCalled()
    expect(renderMarkdownResult).toHaveBeenCalledWith(
      expect.objectContaining({
        source: '<script>alert(1)</script>',
        allowHtml: false,
        allowLatex: true,
        allowMermaid: true,
        mode: 'article',
        baseUrl: null,
      }),
    )
  })

  test('sanitizes runtime html by default before committing to the DOM', async () => {
    const unsafeHtml = [
      '<h1>Safe heading</h1>',
      '<script>alert("xss")</script>',
      '<img src="x" onerror="alert(1)">',
      '<a href="javascript:alert(1)">bad link</a>',
      '<p style="background:url(javascript:alert(1))">styled</p>',
    ].join('')

    renderMarkdownHtml.mockResolvedValue(fsusOk(makeHtmlResult(unsafeHtml)))
    renderMarkdownResult.mockResolvedValue(
      fsusOk(makeResult('# Unsafe', unsafeHtml)),
    )

    const wrapper = mount(MarkdownRenderer, {
      props: { content: '# Unsafe', allowHtml: true },
    })
    await flushRenderer()

    const heading = wrapper.find('h1')
    expect(heading.text()).toBe('Safe heading')
    expect(heading.attributes('data-markdown-heading')).toBe('safe-heading')
    expect(wrapper.find('script').exists()).toBe(false)
    expect(wrapper.find('img').attributes('onerror')).toBeUndefined()
    expect(wrapper.find('a').attributes('href')).toBeUndefined()
    expect(wrapper.find('p').attributes('style')).toBeUndefined()
    expect(wrapper.html()).not.toContain('javascript:')
    expect(wrapper.html()).not.toContain('onerror')
    expect(wrapper.emitted('render-complete')?.[0]?.[0]).toEqual(
      expect.objectContaining({
        html: expect.not.stringContaining('javascript:'),
      }),
    )
  })

  test('sanitizes initial html before the async render path settles', () => {
    const wrapper = mount(MarkdownRenderer, {
      props: {
        initialHtml:
          '<p>prefill</p><img src="x" onerror="alert(1)"><script>alert(1)</script>',
      },
    })

    expect(wrapper.html()).toContain('<p>prefill</p>')
    expect(wrapper.find('script').exists()).toBe(false)
    expect(wrapper.find('img').attributes('onerror')).toBeUndefined()
  })

  test('allows trusted callers to opt out of markdown html sanitizing', async () => {
    const unsafeHtml =
      '<img src="x" onerror="alert(1)"><script>alert("trusted")</script>'

    renderMarkdownHtml.mockResolvedValue(fsusOk(makeHtmlResult(unsafeHtml)))
    renderMarkdownResult.mockResolvedValue(
      fsusOk(makeResult('trusted', unsafeHtml)),
    )

    const wrapper = mount(MarkdownRenderer, {
      props: {
        content: 'trusted',
        allowHtml: true,
        sanitizeHtml: false,
      },
    })
    await flushRenderer()

    expect(wrapper.find('img').attributes('onerror')).toBe('alert(1)')
    expect(wrapper.find('script').exists()).toBe(true)
    expect(wrapper.html()).toContain('trusted')
  })

  test('emits placeholders from the raw html contract', async () => {
    const result = makeResult('```mermaid\nflowchart LR\n```', '<svg />', {
      features: ['mermaid'],
      placeholders: [
        {
          kind: 'mermaid_block',
          token: 'mermaid',
          label: 'Mermaid 图表',
          line: 1,
          source: 'flowchart LR',
        },
      ],
    })
    renderMarkdownHtml.mockResolvedValue(fsusOk(makeHtmlResult('<svg />')))
    renderMarkdownResult.mockResolvedValue(fsusOk(result))

    const wrapper = mount(MarkdownRenderer, {
      props: {
        content: '```mermaid\nflowchart LR\n```',
        allowMermaid: true,
      },
    })
    await flushRenderer()

    const events = wrapper.emitted('placeholders-ready')
    expect(events).toHaveLength(1)
    expect(events?.[0]?.[0]).toEqual(result.placeholders)
  })

  test('activates common markdown features after committing the full result', async () => {
    const html = [
      '<h2>Activation Title</h2>',
      '<a href="#activation-title">hash</a>',
      '<a href="https://example.com/docs">external</a>',
      '<style>.markdown-probe{color:red}</style>',
      '<figure class="markdown-renderer__mermaid" data-mermaid-placeholder="true"></figure>',
      '<span class="markdown-renderer__latex" data-latex-placeholder="true"></span>',
      '<pre><code class="language-ts">const ok = true</code></pre>',
    ].join('')
    renderMarkdownHtml.mockResolvedValue(fsusOk(makeHtmlResult(html)))
    renderMarkdownResult.mockResolvedValue(
      fsusOk(makeResult('activation', html)),
    )

    const wrapper = mount(MarkdownRenderer, {
      props: {
        baseUrl: 'https://fsus.local/docs',
        content: 'activation',
        cspNonce: 'nonce-1',
        sanitizeHtml: false,
      },
    })
    await flushRenderer()

    expect(wrapper.find('h2').attributes('id')).toBe('activation-title')
    expect(
      wrapper.find('a[href^="#"]').attributes('data-markdown-hash-link'),
    ).toBe('true')
    expect(
      wrapper.find('a[href^="https://example.com"]').attributes('target'),
    ).toBe('_blank')
    expect(wrapper.find('style').element.nonce).toBe('nonce-1')
    expect(
      wrapper
        .find('.markdown-renderer__mermaid')
        .attributes('data-markdown-feature-activated'),
    ).toBe('mermaid')
    expect(
      wrapper
        .find('.markdown-renderer__mermaid')
        .attributes('data-default-mermaid-adapter'),
    ).toBe('true')
    expect(
      wrapper
        .find('.markdown-renderer__latex')
        .attributes('data-markdown-feature-activated'),
    ).toBe('latex')
    expect(
      wrapper
        .find('.markdown-renderer__latex')
        .attributes('data-default-latex-adapter'),
    ).toBe('true')
    expect(
      wrapper.find('code').attributes('data-markdown-feature-activated'),
    ).toBe('code-highlight')
    expect(
      wrapper.find('code').attributes('data-default-code-highlight-adapter'),
    ).toBe('true')
    expect(
      markdownFeatureAdapterMocks.defaultMermaidAdapter,
    ).toHaveBeenCalledTimes(1)
    expect(
      markdownFeatureAdapterMocks.defaultLatexAdapter,
    ).toHaveBeenCalledTimes(1)
    expect(
      markdownFeatureAdapterMocks.defaultCodeHighlightAdapter,
    ).toHaveBeenCalledTimes(1)
    expect(wrapper.emitted('features-activated')?.[0]?.[0]).toEqual(
      expect.objectContaining({
        errors: [],
      }),
    )
  })

  test('lets callers disable or override default markdown feature adapters', async () => {
    const html = [
      '<figure class="markdown-renderer__mermaid" data-mermaid-placeholder="true"></figure>',
      '<span class="markdown-renderer__latex" data-latex-placeholder="true"></span>',
      '<pre><code class="language-ts">const ok = true</code></pre>',
    ].join('')
    renderMarkdownHtml.mockResolvedValue(fsusOk(makeHtmlResult(html)))
    renderMarkdownResult.mockResolvedValue(fsusOk(makeResult('adapters', html)))

    const disabled = mount(MarkdownRenderer, {
      props: {
        codeHighlightAdapter: null,
        content: 'adapters',
        latexAdapter: null,
        mermaidAdapter: null,
        sanitizeHtml: false,
      },
    })
    await flushRenderer()

    expect(
      markdownFeatureAdapterMocks.defaultMermaidAdapter,
    ).not.toHaveBeenCalled()
    expect(
      markdownFeatureAdapterMocks.defaultLatexAdapter,
    ).not.toHaveBeenCalled()
    expect(
      markdownFeatureAdapterMocks.defaultCodeHighlightAdapter,
    ).not.toHaveBeenCalled()
    expect(
      disabled
        .find('.markdown-renderer__mermaid')
        .attributes('data-markdown-feature-activated'),
    ).toBe('mermaid')

    markdownFeatureAdapterMocks.defaultMermaidAdapter.mockClear()
    const customMermaidAdapter = vi.fn(async (element: HTMLElement) => {
      element.dataset.customMermaidAdapter = 'true'
    })

    const custom = mount(MarkdownRenderer, {
      props: {
        content: 'adapters',
        mermaidAdapter: customMermaidAdapter,
        sanitizeHtml: false,
      },
    })
    await flushRenderer()

    expect(customMermaidAdapter).toHaveBeenCalledTimes(1)
    expect(
      markdownFeatureAdapterMocks.defaultMermaidAdapter,
    ).not.toHaveBeenCalled()
    expect(
      custom
        .find('.markdown-renderer__mermaid')
        .attributes('data-custom-mermaid-adapter'),
    ).toBe('true')
  })

  test('skips markdown feature adapters when a feature is disabled', async () => {
    const html =
      '<figure class="markdown-renderer__mermaid" data-mermaid-placeholder="true"></figure>'
    renderMarkdownHtml.mockResolvedValue(fsusOk(makeHtmlResult(html)))
    renderMarkdownResult.mockResolvedValue(
      fsusOk(makeResult('disabled feature', html)),
    )

    const wrapper = mount(MarkdownRenderer, {
      props: {
        content: 'disabled feature',
        features: {
          mermaid: false,
        },
        sanitizeHtml: false,
      },
    })
    await flushRenderer()

    expect(
      markdownFeatureAdapterMocks.defaultMermaidAdapter,
    ).not.toHaveBeenCalled()
    expect(
      wrapper
        .find('.markdown-renderer__mermaid')
        .attributes('data-markdown-feature-activated'),
    ).toBeUndefined()
  })

  test('keeps the scroll anchor when the full result changes html', async () => {
    let resolveFull:
      | ((result: FsusResult<MarkdownRuntimeRenderResult>) => void)
      | undefined
    let anchorReads = 0
    const scroller = document.createElement('div')

    scroller.style.overflowY = 'auto'
    Object.defineProperties(scroller, {
      clientHeight: { configurable: true, value: 100 },
      scrollHeight: { configurable: true, value: 1000 },
    })
    scroller.scrollTop = 320
    document.body.appendChild(scroller)

    const rectSpy = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(function (this: HTMLElement) {
        if (this === scroller) {
          return {
            bottom: 100,
            height: 100,
            left: 0,
            right: 400,
            top: 0,
            width: 400,
            x: 0,
            y: 0,
            toJSON: () => ({}),
          } as DOMRect
        }

        if (this.getAttribute('data-anchor') === 'stable') {
          anchorReads += 1
          const top = anchorReads === 1 ? 24 : 84
          return {
            bottom: top + 20,
            height: 20,
            left: 0,
            right: 300,
            top,
            width: 300,
            x: 0,
            y: top,
            toJSON: () => ({}),
          } as DOMRect
        }

        return {
          bottom: 180,
          height: 20,
          left: 0,
          right: 300,
          top: 160,
          width: 300,
          x: 0,
          y: 160,
          toJSON: () => ({}),
        } as DOMRect
      })

    const source = 'anchor update'
    renderMarkdownResult.mockReturnValue(
      new Promise((resolve) => {
        resolveFull = resolve
      }),
    )

    const wrapper = mount(MarkdownRenderer, {
      attachTo: scroller,
      props: {
        content: source,
        initialHtml: '<p data-anchor="stable">Anchor</p><p>Before</p>',
      },
    })

    expect(wrapper.html()).toContain('Before')

    resolveFull?.(
      fsusOk(
        makeResult(
          source,
          '<p data-anchor="stable">Anchor</p><p>After full result</p>',
        ),
      ),
    )
    await flushPromises()
    await vi.advanceTimersByTimeAsync(100)
    await flushPromises()

    expect(wrapper.html()).toContain('After full result')
    expect(scroller.scrollTop).toBe(380)
    expect(anchorReads).toBe(2)
    expect(renderMarkdownHtml).not.toHaveBeenCalled()
    expect(renderMarkdownResult).toHaveBeenCalledTimes(1)

    wrapper.unmount()
    rectSpy.mockRestore()
    scroller.remove()
  })

  test('uses chunked virtual rendering for large markdown content', async () => {
    const source = `${'# Large\n\n'}${'Paragraph\n\n'.repeat(1_600)}`
    const result = makeChunkResult(source, '<h1>Chunked</h1><p>Chunk body</p>')
    renderMarkdownChunks.mockResolvedValue(fsusOk(result))

    const wrapper = mount(MarkdownRenderer, {
      ...forcedChunkedPipeline,
      props: { content: source },
    })
    await flushRenderer()

    expect(wrapper.emitted('render-error')).toBeUndefined()

    expect(renderMarkdownChunks).toHaveBeenCalledWith(
      expect.objectContaining({ source }),
    )
    expect(renderMarkdownHtml).not.toHaveBeenCalled()
    expect(wrapper.attributes('data-fsus-render-strategy')).toBe('chunked-main')
    expect(wrapper.attributes('data-fsus-render-hardware')).toMatch(
      /gpu-compositor|cpu-threaded/,
    )
    expect(wrapper.attributes('data-fsus-compositor')).toMatch(
      /enabled|disabled/,
    )
    expect(wrapper.findAll('[data-fsus-render-unit]')).toHaveLength(2)
    expect(
      wrapper
        .find('[data-fsus-render-unit]')
        .attributes('data-fsus-render-hardware'),
    ).toBe(wrapper.attributes('data-fsus-render-hardware'))
    const heading = wrapper.find('h1')
    expect(heading.text()).toBe('Chunked')
    expect(heading.attributes('data-markdown-heading')).toBe('chunked')
    expect(wrapper.emitted('render-complete')?.[0]?.[0]).toEqual(result)
  })

  test('sanitizes chunked markdown units and emitted chunk results', async () => {
    const source = `${'# Unsafe large\n\n'}${'Paragraph\n\n'.repeat(1_600)}`
    const result = makeChunkResult(source, '<h1>Chunked</h1>', {
      chunks: [
        {
          key: 'md-unsafe-0',
          kind: 'paragraph',
          html: '<img src="x" onerror="alert(1)"><a href="javascript:alert(1)">bad</a>',
          estimatedSize: 48,
          htmlStartOffset: 0,
          htmlEndOffset: 84,
        },
      ],
    })
    renderMarkdownChunks.mockResolvedValue(fsusOk(result))

    const wrapper = mount(MarkdownRenderer, {
      ...forcedChunkedPipeline,
      props: { content: source, allowHtml: true },
    })
    await flushRenderer()

    expect(wrapper.find('img').attributes('onerror')).toBeUndefined()
    expect(wrapper.find('a').attributes('href')).toBeUndefined()
    expect(wrapper.html()).not.toContain('javascript:')
    expect(wrapper.emitted('render-complete')?.[0]?.[0]).toEqual(
      expect.objectContaining({
        chunks: [
          expect.objectContaining({
            html: expect.not.stringContaining('javascript:'),
          }),
        ],
      }),
    )
  })

  test('commits the first readable chunks before staging the remaining document', async () => {
    const source = `${'# Staged large\n\n'}${'Paragraph\n\n'.repeat(1_600)}`
    const chunks = Array.from({ length: 70 }, (_, index) => ({
      estimatedSize: 48,
      html: index === 0 ? '<h1>Staged</h1>' : `<p>Chunk ${index}</p>`,
      htmlEndOffset: (index + 1) * 16,
      htmlStartOffset: index * 16,
      key: `md-${index}-${index * 16}`,
      kind: index === 0 ? ('heading' as const) : ('paragraph' as const),
    }))
    const result = makeChunkResult(
      source,
      chunks.map((item) => item.html).join(''),
      {
        chunks,
      },
    )
    renderMarkdownChunks.mockResolvedValue(fsusOk(result))

    const wrapper = mount(MarkdownRenderer, {
      ...forcedChunkedPipeline,
      props: { content: source },
    })
    for (
      let frame = 0;
      frame < 20 && !wrapper.find('h1').exists();
      frame += 1
    ) {
      await vi.advanceTimersByTimeAsync(16)
      await flushPromises()
    }

    expect(wrapper.find('h1').text()).toBe('Staged')
    expect(wrapper.emitted('render-complete')).toBeUndefined()

    await vi.advanceTimersByTimeAsync(1_000)
    await flushPromises()
    expect(wrapper.emitted('render-complete')?.[0]?.[0]).toEqual(result)
  })

  test('reuses cached chunk results for matching markdown fingerprints', async () => {
    const source = `${'# Cached large\n\n'}${'Cached paragraph\n\n'.repeat(1_600)}`
    const result = makeChunkResult(source, '<h1>Cached</h1><p>Chunk body</p>')
    renderMarkdownChunks.mockResolvedValue(fsusOk(result))

    const first = mount(MarkdownRenderer, {
      ...forcedChunkedPipeline,
      props: { content: source },
    })
    await flushRenderer()
    first.unmount()

    const second = mount(MarkdownRenderer, {
      ...forcedChunkedPipeline,
      props: { content: source },
    })
    await flushRenderer()

    expect(renderMarkdownChunks).toHaveBeenCalledTimes(1)
    expect(second.emitted('render-complete')?.[0]?.[0]).toEqual(result)
  })

  test('does not cache oversized markdown chunk results', () => {
    const hugeHtml = 'x'.repeat(3 * 1024 * 1024 + 1)
    const result = makeChunkResult('huge cached large', hugeHtml, {
      chunks: [
        {
          key: 'md-huge-0',
          kind: 'paragraph',
          html: '<p>Huge paragraph</p>',
          estimatedSize: 48,
          htmlStartOffset: 0,
          htmlEndOffset: 21,
        },
      ],
    })

    setMarkdownRendererRuntimeCache('chunks', 'oversized', result)

    expect(
      getMarkdownRendererRuntimeCache<MarkdownRuntimeChunkResult>(
        'chunks',
        'oversized',
      ),
    ).toBeNull()
  })

  test('keeps one canonical chunk payload when weaker cache views are written', () => {
    const html = `<h1>Canonical</h1>${'<p>Body</p>'.repeat(100)}`
    const result = makeChunkResult('canonical source', html)

    setMarkdownRendererRuntimeCache('chunks', 'canonical', result)
    setMarkdownRendererRuntimeCache(
      'html',
      'canonical',
      makeHtmlResult('<p>weaker duplicate</p>'.repeat(100)),
    )

    expect(
      getMarkdownRendererRuntimeCache<MarkdownRuntimeChunkResult>(
        'chunks',
        'canonical',
      ),
    ).toBe(result)
    expect(
      getMarkdownRendererRuntimeCache<MarkdownRuntimeHtmlResult>(
        'html',
        'canonical',
      )?.html,
    ).toBe(html)
  })

  test('uses a safe fallback and emits render-error when runtime fails', async () => {
    renderMarkdownHtml.mockResolvedValue(
      fsusErr(createFsusError('infra', 'boom')),
    )
    renderMarkdownResult.mockResolvedValue(
      fsusErr(createFsusError('infra', 'boom')),
    )

    const wrapper = mount(MarkdownRenderer, {
      props: { content: '<script>alert(1)</script>' },
    })
    await flushRenderer()

    expect(wrapper.html()).toContain('Markdown 渲染失败')
    expect(wrapper.html()).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(wrapper.emitted('render-error')).toHaveLength(1)
    expect(wrapper.emitted('render-complete')).toHaveLength(1)
  })

  test('does not commit stale results after rapid content changes', async () => {
    let resolveFirst:
      | ((result: FsusResult<MarkdownRuntimeRenderResult>) => void)
      | undefined
    let resolveSecond:
      | ((result: FsusResult<MarkdownRuntimeRenderResult>) => void)
      | undefined

    renderMarkdownHtml
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolve(fsusOk(makeHtmlResult('<p>first</p>')))
        }),
      )
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolve(fsusOk(makeHtmlResult('<p>second</p>')))
        }),
      )

    renderMarkdownResult
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveFirst = resolve
        }),
      )
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveSecond = resolve
        }),
      )

    const wrapper = mount(MarkdownRenderer, {
      props: { content: 'first' },
    })

    await vi.advanceTimersByTimeAsync(20)
    await wrapper.setProps({ content: 'second' })
    await vi.advanceTimersByTimeAsync(20)

    resolveSecond?.(fsusOk(makeResult('second', '<p>second</p>')))
    await flushPromises()
    resolveFirst?.(fsusOk(makeResult('first', '<p>first</p>')))
    await flushPromises()

    expect(wrapper.html()).toContain('<p>second</p>')
    expect(wrapper.html()).not.toContain('<p>first</p>')
  })
})
