import { flushPromises, mount } from '@vue/test-utils'
import { createSSRApp, computed, h } from 'vue'
import { renderToString } from '@vue/server-renderer'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  expectTypeOf,
  test,
  vi,
} from 'vitest'
import { configProviderContextKey } from '@element-plus/components/config-provider'
import MarkdownRenderer from '../src/markdown-renderer.vue'
import { resolveMarkdownWorkerScriptUrl } from '../src/markdown-renderer'
import {
  MARKDOWN_RENDERER_VERSION,
  renderMarkdownFallbackWithRuntime,
  renderMarkdownChunksWithRuntime,
  renderMarkdownHtmlWithRuntime,
  renderMarkdownResultWithRuntime,
  resolveMarkdownSourceIdentity,
} from '@element-plus/wasm'
import { activateMarkdownHeavyFeatures } from '../../../wasm/markdown-heavy-feature-activation'
import { createFsusError, fsusErr, fsusOk } from '@element-plus/utils'
import type {
  MarkdownRuntimeHtmlResult,
  MarkdownRuntimeChunkResult,
  MarkdownRuntimeRenderResult,
  MarkdownRenderRequest,
  MarkdownSafeHtml,
} from '@element-plus/wasm'
import type { FsusResult } from '@element-plus/utils'
import type { MarkdownRendererProps } from '../src/markdown-renderer'
import { getMarkdownXssSourceAttackFragment } from '../../../../tests/support/markdown-xss-corpus'

const rawScriptSource = getMarkdownXssSourceAttackFragment(
  'mxss-raw-script-basic',
)
const rawImageSource = getMarkdownXssSourceAttackFragment(
  'mxss-raw-img-onerror',
)

const markdownAuthorityMocks = vi.hoisted(() => ({
  results: new WeakSet<object>(),
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
    isMarkdownRuntimeAuthorizedResult: (value: unknown) =>
      runtime.isMarkdownRuntimeAuthorizedResult(value) ||
      (typeof value === 'object' &&
        value !== null &&
        Object.isFrozen(value) &&
        markdownAuthorityMocks.results.has(value)),
    renderMarkdownFallbackWithRuntime:
      runtime.renderMarkdownFallbackWithRuntime,
    renderMarkdownChunksWithRuntime: vi.fn(),
    renderMarkdownHtmlWithRuntime: vi.fn(),
    renderMarkdownResultWithRuntime: vi.fn(),
  }
})

vi.mock('../../../wasm/markdown-heavy-feature-activation', async () => {
  const runtime = await vi.importActual<
    typeof import('../../../wasm/markdown-runtime')
  >('../../../wasm/markdown-runtime')
  return {
    activateMarkdownHeavyFeatures: vi.fn(
      async (
        options: Parameters<
          typeof import('../../../wasm/markdown-heavy-feature-activation').activateMarkdownHeavyFeatures
        >[0],
      ) =>
        runtime.activateMarkdownFeatures({
          ...options,
          features: {
            ...options.features,
            codeHighlight: false,
            latex: false,
            mermaid: false,
          },
        }),
    ),
  }
})

const renderMarkdownChunks = vi.mocked(renderMarkdownChunksWithRuntime)
const renderMarkdownHtml = vi.mocked(renderMarkdownHtmlWithRuntime)
const renderMarkdownResult = vi.mocked(renderMarkdownResultWithRuntime)
const activateFeatures = vi.mocked(activateMarkdownHeavyFeatures)
const activateFeaturesDefault = activateFeatures.getMockImplementation()

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

const safeHtml = (html: string) => html as MarkdownSafeHtml

const authorizeTestResult = <T extends object>(result: T): T => {
  const seal = (value: unknown): void => {
    if (typeof value !== 'object' || value === null || Object.isFrozen(value)) {
      return
    }
    Object.values(value).forEach(seal)
    Object.freeze(value)
  }
  seal(result)
  markdownAuthorityMocks.results.add(result)
  return result
}

const makeResult = (
  source: string,
  html: string,
  overrides: Partial<MarkdownRuntimeRenderResult> = {},
): MarkdownRuntimeRenderResult =>
  authorizeTestResult({
    ...renderMarkdownFallbackWithRuntime(source),
    html: safeHtml(html),
    engine: 'SCALAR-BASIC' as const,
    timings: makeTimings(),
    ...overrides,
  })

const makeHtmlResult = (
  html: string,
  overrides: Partial<MarkdownRuntimeHtmlResult> = {},
): MarkdownRuntimeHtmlResult =>
  authorizeTestResult({
    ...renderMarkdownFallbackWithRuntime(''),
    html: safeHtml(html),
    normalizedSource: '',
    engine: 'SCALAR-BASIC' as const,
    rendererVersion: MARKDOWN_RENDERER_VERSION,
    timings: makeTimings(),
    ...overrides,
  })

const makeChunkResult = (
  source: string,
  html: string,
  overrides: Partial<MarkdownRuntimeChunkResult> = {},
): MarkdownRuntimeChunkResult =>
  authorizeTestResult({
    ...makeResult(source, html, overrides),
    chunks: [
      {
        key: 'md-0-0',
        kind: 'heading',
        html: safeHtml('<h1>Chunked</h1>'),
        estimatedSize: 48,
        htmlStartOffset: 0,
        htmlEndOffset: 16,
      },
      {
        key: 'md-1-16',
        kind: 'paragraph',
        html: safeHtml('<p>Chunk body</p>'),
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

const forcedSyncPipeline = {
  global: {
    provide: {
      [configProviderContextKey as symbol]: computed(() => ({
        renderPipeline: {
          mode: 'disabled',
          worker: 'disabled',
        },
      })),
    },
  },
}

type MarkdownWorkerPost = {
  generation?: number
  id: number
  request?: MarkdownRenderRequest
  type?: 'cancel' | 'run'
}

class MarkdownWorkerHarness {
  static instances: MarkdownWorkerHarness[] = []

  onerror: OnErrorEventHandler = null
  onmessage: ((event: MessageEvent) => void) | null = null
  posts: MarkdownWorkerPost[] = []
  terminated = false

  constructor() {
    MarkdownWorkerHarness.instances.push(this)
  }

  postMessage(message: MarkdownWorkerPost) {
    this.posts.push(message)
  }

  terminate() {
    this.terminated = true
  }

  respond(data: unknown) {
    this.onmessage?.({ data } as MessageEvent)
  }
}

const workerChunkedPipeline = {
  global: {
    provide: {
      [configProviderContextKey as symbol]: computed(() => ({
        renderPipeline: {
          budget: { measureBatch: 2 },
          mode: 'enabled',
          worker: 'enabled',
        },
      })),
    },
  },
}

const makeWorkerChunkResult = (
  source: string,
  html = '<h1>Chunked</h1><p>Chunk body</p>',
) => {
  const result = makeChunkResult(source, html)
  return authorizeTestResult({
    ...result,
    metadata: {
      mode: 'article' as const,
      baseUrl: null,
      allowLatex: true,
      allowMermaid: true,
      sourceLength: source.length,
      normalizedSourceLength: source.length,
      featureCount: result.features.length,
      placeholderCount: result.placeholders.length,
      rendererVersion: MARKDOWN_RENDERER_VERSION,
    },
  })
}

describe('MarkdownRenderer.vue', () => {
  test('does not expose the removed raw HTML prop', () => {
    const removedCapability = `allow${'Html'}` as const
    expectTypeOf<MarkdownRendererProps>().not.toHaveProperty(removedCapability)
    expectTypeOf<string>().not.toMatchTypeOf<MarkdownSafeHtml>()
    expectTypeOf<
      MarkdownRendererProps['initialRender']
    >().not.toMatchTypeOf<string>()
    expectTypeOf<MarkdownRendererProps>().not.toHaveProperty('mermaidAdapter')
    expectTypeOf<MarkdownRendererProps>().not.toHaveProperty('latexAdapter')
    expectTypeOf<MarkdownRendererProps>().not.toHaveProperty(
      'codeHighlightAdapter',
    )
  })

  beforeEach(() => {
    vi.useFakeTimers()
    MarkdownWorkerHarness.instances = []
    renderMarkdownChunks.mockReset()
    renderMarkdownHtml.mockReset()
    renderMarkdownResult.mockReset()
    activateFeatures.mockClear()
    if (activateFeaturesDefault) {
      activateFeatures.mockImplementation(activateFeaturesDefault)
    }
    renderMarkdownHtml.mockImplementation(async (request) =>
      fsusOk(
        makeHtmlResult(
          typeof request === 'string' ? request : `<p>${request.source}</p>`,
        ),
      ),
    )
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.unstubAllGlobals()
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
    expect(wrapper.attributes('data-fsus-surface')).toBe('reading')
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
      props: {
        content: '# Loading',
        loadingText: 'Chargement du Markdown',
      },
    })

    await vi.advanceTimersByTimeAsync(20)
    await flushPromises()

    expect(wrapper.attributes('aria-busy')).toBe('true')
    expect(wrapper.find('[data-markdown-renderer-loading]').exists()).toBe(true)
    expect(wrapper.find('.markdown-renderer__loading-text').text()).toBe(
      'Chargement du Markdown',
    )

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
      fsusOk(
        makeHtmlResult(
          '&lt;script&gt;globalThis.__FSUS_XSS__=1&lt;/script&gt;',
        ),
      ),
    )
    renderMarkdownResult.mockResolvedValue(
      fsusOk(
        makeResult(
          rawScriptSource,
          '&lt;script&gt;globalThis.__FSUS_XSS__=1&lt;/script&gt;',
        ),
      ),
    )

    mount(() => <MarkdownRenderer content={rawScriptSource} />)
    await flushRenderer()

    expect(renderMarkdownHtml).not.toHaveBeenCalled()
    expect(renderMarkdownResult).toHaveBeenCalledWith(
      expect.objectContaining({
        source: rawScriptSource,
        allowLatex: true,
        allowMermaid: true,
        mode: 'article',
        baseUrl: null,
      }),
    )
  })

  test('commits branded runtime html without a second transformation', async () => {
    const html = '<h1>Safe heading &amp; text</h1>'
    const trustedHtmlFactory = vi.fn((value: MarkdownSafeHtml) => ({
      toString: () => value,
    }))
    renderMarkdownResult.mockResolvedValue(fsusOk(makeResult('# Safe', html)))

    const wrapper = mount(MarkdownRenderer, {
      props: { content: '# Safe', trustedHtmlFactory },
    })
    await flushRenderer()

    expect(wrapper.find('h1').text()).toBe('Safe heading & text')
    expect(trustedHtmlFactory).toHaveBeenCalledWith(html)
    expect(wrapper.emitted('render-complete')?.[0]?.[0]).toEqual(
      expect.objectContaining({ html }),
    )
  })

  test('uses only an initial render with matching source identity and version', () => {
    const source = '# Prefill'
    const initialRender = makeResult(source, '<h1>Prefill</h1>')
    const wrapper = mount(MarkdownRenderer, {
      props: { content: source, initialRender },
    })

    expect(wrapper.html()).toContain('<h1>Prefill</h1>')
  })

  test('keeps canonical initial render fields unchanged during SSR', async () => {
    const source = '# Canonical SSR'
    const initialRender = makeResult(source, '<h1>Canonical SSR</h1>')
    const html = await renderToString(
      createSSRApp({
        render: () => h(MarkdownRenderer, { content: source, initialRender }),
      }),
    )

    expect(html).toContain('<h1>Canonical SSR</h1>')
    expect(initialRender.normalizedSource).toBe(source)
    expect(initialRender.sourceIdentity).toBe(
      resolveMarkdownSourceIdentity({ source }),
    )
    expect(initialRender.rendererVersion).toBe(MARKDOWN_RENDERER_VERSION)
  })

  test('discards stale or forged initial render authority', async () => {
    const stale = mount(MarkdownRenderer, {
      props: {
        content: '# Current',
        initialRender: makeResult('# Stale', rawImageSource),
      },
    })
    const source = '# Current'
    const forged = {
      ...makeResult(source, '<h1>Trusted source</h1>'),
      html: safeHtml(rawImageSource),
    }
    const forgedWrapper = mount(MarkdownRenderer, {
      props: { content: source, initialRender: forged },
    })
    const staleSsr = await renderToString(
      createSSRApp({
        render: () =>
          h(MarkdownRenderer, {
            content: '# Current',
            initialRender: makeResult('# Stale', rawImageSource),
          }),
      }),
    )

    expect(stale.find('img').exists()).toBe(false)
    expect(forgedWrapper.find('img').exists()).toBe(false)
    expect(staleSsr).not.toContain('<img')
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

  test('activates built-in markdown features after committing the full result', async () => {
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
      fsusOk(
        makeResult('activation', html, {
          sourceIdentity: resolveMarkdownSourceIdentity({
            source: 'activation',
            baseUrl: 'https://fsus.local/docs',
          }),
        }),
      ),
    )

    const wrapper = mount(MarkdownRenderer, {
      props: {
        baseUrl: 'https://fsus.local/docs',
        content: 'activation',
        cspNonce: 'nonce-1',
      },
    })
    await flushRenderer()

    expect(activateFeatures).toHaveBeenCalledTimes(1)
    expect(activateFeatures).toHaveBeenCalledWith(
      expect.objectContaining({
        baseUrl: 'https://fsus.local/docs',
        concurrency: 3,
        cspNonce: 'nonce-1',
        features: expect.objectContaining({
          codeHighlight: true,
          latex: true,
          mermaid: true,
        }),
      }),
    )
    const activationOptions = activateFeatures.mock.calls[0]?.[0]
    expect(activationOptions).not.toHaveProperty('mermaidAdapter')
    expect(activationOptions).not.toHaveProperty('latexAdapter')
    expect(activationOptions).not.toHaveProperty('codeHighlightAdapter')
    expect(wrapper.emitted('features-activated')?.[0]?.[0]).toEqual(
      expect.objectContaining({
        errors: [],
      }),
    )
  })

  test('passes disabled feature state to the built-in activation runtime', async () => {
    const html =
      '<figure class="markdown-renderer__mermaid" data-mermaid-placeholder="true"></figure>'
    renderMarkdownHtml.mockResolvedValue(fsusOk(makeHtmlResult(html)))
    renderMarkdownResult.mockResolvedValue(
      fsusOk(makeResult('disabled feature', html)),
    )

    mount(MarkdownRenderer, {
      props: {
        content: 'disabled feature',
        features: {
          mermaid: false,
        },
      },
    })
    await flushRenderer()

    expect(activateFeatures).toHaveBeenCalledWith(
      expect.objectContaining({
        features: expect.objectContaining({ mermaid: false }),
      }),
    )
  })

  test('invalidates feature output on shared theme change and removes the listener on unmount', async () => {
    const source = '```mermaid\ngraph LR\nA-->B\n```'
    const html =
      '<figure class="markdown-renderer__mermaid" data-mermaid-placeholder="true"><code>graph LR\nA--&gt;B</code></figure>'
    renderMarkdownResult.mockResolvedValue(fsusOk(makeResult(source, html)))
    activateFeatures.mockResolvedValue({
      activated: [{ count: 1, kind: 'mermaid' }],
      errors: [],
    })
    const wrapper = mount(MarkdownRenderer, { props: { content: source } })
    await flushRenderer()
    const initialCalls = renderMarkdownResult.mock.calls.length

    document.documentElement.dispatchEvent(
      new CustomEvent('fsus:theme-change', {
        detail: { mode: 'dark', resolved: 'dark' },
      }),
    )
    await flushRenderer()
    expect(renderMarkdownResult).toHaveBeenCalledTimes(initialCalls + 1)

    wrapper.unmount()
    document.documentElement.dispatchEvent(
      new CustomEvent('fsus:theme-change', {
        detail: { mode: 'light', resolved: 'light' },
      }),
    )
    await flushRenderer()
    expect(renderMarkdownResult).toHaveBeenCalledTimes(initialCalls + 1)
  })

  test('invalidates pending heavy activation when the shared theme changes', async () => {
    const source = '```mermaid\ngraph LR\nA-->B\n```'
    const html =
      '<figure class="markdown-renderer__mermaid" data-mermaid-placeholder="true"><code>graph LR\nA--&gt;B</code></figure>'
    renderMarkdownResult.mockResolvedValue(fsusOk(makeResult(source, html)))
    let settleActivation:
      | ((
          value: Awaited<ReturnType<typeof activateMarkdownHeavyFeatures>>,
        ) => void)
      | undefined
    activateFeatures.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          settleActivation = resolve
        }),
    )
    const wrapper = mount(MarkdownRenderer, { props: { content: source } })
    try {
      await flushRenderer()
      await vi.dynamicImportSettled()
      await flushRenderer()
      expect(settleActivation).toBeTypeOf('function')
      const pendingSignal = activateFeatures.mock.calls[0][0].signal
      expect(pendingSignal?.aborted).toBe(false)
      const initialCalls = renderMarkdownResult.mock.calls.length

      document.documentElement.dispatchEvent(
        new CustomEvent('fsus:theme-change', {
          detail: { mode: 'dark', resolved: 'dark' },
        }),
      )
      expect(pendingSignal?.aborted).toBe(true)
      await flushRenderer()
      expect(renderMarkdownResult).toHaveBeenCalledTimes(initialCalls + 1)
      expect(pendingSignal?.aborted).toBe(true)
    } finally {
      wrapper.unmount()
      settleActivation?.({ activated: [], errors: [] })
      await flushRenderer()
    }
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
        initialRender: makeResult(
          source,
          '<p data-anchor="stable">Anchor</p><p>Before</p>',
        ),
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

  test('commits only branded chunk html and preserves the runtime result', async () => {
    const source = `${'# Safe large\n\n'}${'Paragraph\n\n'.repeat(1_600)}`
    const html = '<h1>Chunked</h1><p>Safe body</p>'
    const result = makeChunkResult(source, html, {
      chunks: [
        {
          key: 'md-safe-0',
          kind: 'heading',
          html: safeHtml(html),
          estimatedSize: 48,
          htmlStartOffset: 0,
          htmlEndOffset: html.length,
        },
      ],
    })
    renderMarkdownChunks.mockResolvedValue(fsusOk(result))

    const wrapper = mount(MarkdownRenderer, {
      ...forcedChunkedPipeline,
      props: { content: source },
    })
    await flushRenderer()

    expect(wrapper.find('h1').text()).toBe('Chunked')
    expect(wrapper.find('p').text()).toBe('Safe body')
    expect(wrapper.emitted('render-complete')?.[0]?.[0]).toBe(result)
  })

  test('commits the first readable chunks before staging the remaining document', async () => {
    const source = `${'# Staged large\n\n'}${'Paragraph\n\n'.repeat(1_600)}`
    const chunks = Array.from({ length: 70 }, (_, index) => ({
      estimatedSize: 48,
      html: safeHtml(index === 0 ? '<h1>Staged</h1>' : `<p>Chunk ${index}</p>`),
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

  test('accepts one response only from the exact pending markdown worker', async () => {
    vi.stubGlobal('Worker', MarkdownWorkerHarness)
    const source = `${'# Worker\n\n'}${'Paragraph\n\n'.repeat(1_600)}`
    const wrapper = mount(MarkdownRenderer, {
      ...workerChunkedPipeline,
      props: { content: source },
    })
    await vi.advanceTimersByTimeAsync(250)
    await flushPromises()

    const worker = MarkdownWorkerHarness.instances[0]!
    const post = worker.posts.find((message) => message.type === 'run')!
    const result = structuredClone(
      makeWorkerChunkResult(source),
    ) as MarkdownRuntimeChunkResult
    const attacker = new MarkdownWorkerHarness()
    attacker.respond({
      generation: post.generation,
      id: post.id,
      result: { metadata: result, units: result.chunks },
      status: 'complete',
    })
    expect(wrapper.emitted('render-complete')).toBeUndefined()

    worker.respond({
      generation: post.generation,
      id: post.id,
      result: { metadata: result, units: result.chunks },
      status: 'complete',
    })
    await flushRenderer()
    expect(wrapper.find('h1').text()).toBe('Chunked')
    expect(wrapper.emitted('render-complete')).toHaveLength(1)

    const replay = structuredClone(result)
    const forgedHtml = safeHtml('<svg onload="alert(1)"></svg>')
    Reflect.set(replay, 'html', forgedHtml)
    Reflect.set(replay, 'chunks', [
      {
        key: 'forged',
        kind: 'generated',
        html: forgedHtml,
        estimatedSize: 48,
        htmlStartOffset: 0,
        htmlEndOffset: forgedHtml.length,
      },
    ])
    worker.respond({
      generation: post.generation,
      id: post.id,
      result: { metadata: replay, units: replay.chunks },
      status: 'complete',
    })
    await flushPromises()
    expect(wrapper.find('svg').exists()).toBe(false)
    expect(wrapper.emitted('render-complete')).toHaveLength(1)
  })

  test('keeps one canonical result aligned across sync, worker, and SSR paths', async () => {
    vi.stubGlobal('Worker', MarkdownWorkerHarness)
    const source = `${'# Canonical\n\n'}${'Paragraph\n\n'.repeat(1_600)}`
    const canonical = makeWorkerChunkResult(source)
    renderMarkdownResult.mockResolvedValue(fsusOk(canonical))

    const sync = mount(MarkdownRenderer, {
      ...forcedSyncPipeline,
      props: { content: source },
    })
    await flushRenderer()
    const worker = mount(MarkdownRenderer, {
      ...workerChunkedPipeline,
      props: { content: source },
    })
    await vi.advanceTimersByTimeAsync(250)
    await flushPromises()
    const workerInstance = MarkdownWorkerHarness.instances[0]!
    const post = workerInstance.posts.find((message) => message.type === 'run')!
    const cloned = structuredClone(canonical) as MarkdownRuntimeChunkResult
    workerInstance.respond({
      generation: post.generation,
      id: post.id,
      result: { metadata: cloned, units: cloned.chunks },
      status: 'complete',
    })
    await flushRenderer()
    const ssr = await renderToString(
      createSSRApp({
        render: () =>
          h(MarkdownRenderer, { content: source, initialRender: canonical }),
      }),
    )

    const syncResult = sync.emitted('render-complete')?.at(-1)?.[0]
    const workerResult = worker.emitted('render-complete')?.at(-1)?.[0]
    for (const field of [
      'html',
      'normalizedSource',
      'sourceIdentity',
      'rendererVersion',
    ] as const) {
      expect(syncResult?.[field]).toBe(canonical[field])
      expect(workerResult?.[field]).toBe(canonical[field])
    }
    expect(ssr).toContain(canonical.html)
  })

  test.each([
    ['missing generation', (post: MarkdownWorkerPost) => ({ id: post.id })],
    [
      'wrong generation',
      (post: MarkdownWorkerPost) => ({
        generation: (post.generation ?? 0) + 1,
        id: post.id,
      }),
    ],
    [
      'wrong id',
      (post: MarkdownWorkerPost) => ({
        generation: post.generation,
        id: post.id + 1,
      }),
    ],
  ])('does not commit a worker response with %s', async (_label, envelope) => {
    vi.stubGlobal('Worker', MarkdownWorkerHarness)
    const source = `${'# Invalid envelope\n\n'}${'Paragraph\n\n'.repeat(1_600)}`
    const wrapper = mount(MarkdownRenderer, {
      ...workerChunkedPipeline,
      props: { content: source },
    })
    await vi.advanceTimersByTimeAsync(250)
    await flushPromises()

    const worker = MarkdownWorkerHarness.instances[0]!
    const post = worker.posts.find((message) => message.type === 'run')!
    const result = structuredClone(
      makeWorkerChunkResult(source),
    ) as MarkdownRuntimeChunkResult
    worker.respond({
      ...envelope(post),
      result: { metadata: result, units: result.chunks },
      status: 'complete',
    })

    expect(wrapper.find('h1').exists()).toBe(false)
    expect(wrapper.emitted('render-complete')).toBeUndefined()
    wrapper.unmount()
  })

  test('routes a generation-bound Markdown worker error to render-error', async () => {
    vi.stubGlobal('Worker', MarkdownWorkerHarness)
    const source = `${'# Worker error\n\n'}${'Paragraph\n\n'.repeat(1_600)}`
    const wrapper = mount(MarkdownRenderer, {
      ...workerChunkedPipeline,
      props: { content: source },
    })
    await vi.advanceTimersByTimeAsync(250)
    await flushPromises()

    const worker = MarkdownWorkerHarness.instances[0]!
    const post = worker.posts.find((message) => message.type === 'run')!
    worker.respond({
      error: {
        code: 'markdown_parse_failed',
        message: 'invalid markdown',
        name: 'MarkdownRuntimeError',
      },
      generation: post.generation,
      id: post.id,
    })
    await flushRenderer()

    expect(wrapper.emitted('render-error')).toHaveLength(1)
    expect(wrapper.html()).toContain('Markdown 渲染失败')
    expect(wrapper.attributes('data-fsus-render-strategy')).not.toBe(
      'chunked-worker',
    )
  })

  test.each(['cancel', 'terminate'] as const)(
    'invalidates a pending worker before a late reply after %s',
    async (action) => {
      vi.stubGlobal('Worker', MarkdownWorkerHarness)
      const source = `${'# Late worker\n\n'}${'Paragraph\n\n'.repeat(1_600)}`
      const wrapper = mount(MarkdownRenderer, {
        ...workerChunkedPipeline,
        props: { content: source },
      })
      await vi.advanceTimersByTimeAsync(250)
      await flushPromises()

      const worker = MarkdownWorkerHarness.instances[0]!
      const post = worker.posts.find((message) => message.type === 'run')!
      if (action === 'cancel') {
        await wrapper.setProps({ content: `${source}\nReplacement` })
        await vi.advanceTimersByTimeAsync(250)
        await flushPromises()
        expect(worker.posts).toContainEqual(
          expect.objectContaining({ id: post.id, type: 'cancel' }),
        )
      } else {
        worker.onerror?.({
          error: new Error('worker terminated'),
          message: 'worker terminated',
          preventDefault: vi.fn(),
        } as unknown as ErrorEvent)
        expect(worker.terminated).toBe(true)
      }
      const result = structuredClone(
        makeWorkerChunkResult(source),
      ) as MarkdownRuntimeChunkResult
      worker.respond({
        generation: post.generation,
        id: post.id,
        result: { metadata: result, units: result.chunks },
        status: 'complete',
      })
      expect(wrapper.find('h1').exists()).toBe(false)
      expect(wrapper.emitted('render-complete')).toBeUndefined()
      wrapper.unmount()
    },
  )

  test.each([
    [
      'missing chunk',
      (result: MarkdownRuntimeChunkResult) => {
        Reflect.set(result, 'chunks', [])
      },
    ],
    [
      'reordered chunk',
      (result: MarkdownRuntimeChunkResult) => {
        Reflect.set(result, 'chunks', [...result.chunks].reverse())
      },
    ],
    [
      'duplicate chunk',
      (result: MarkdownRuntimeChunkResult) => {
        Reflect.set(result, 'chunks', [result.chunks[0]!, result.chunks[0]!])
      },
    ],
    [
      'gap offset',
      (result: MarkdownRuntimeChunkResult) => {
        Reflect.set(result.chunks[0]!, 'htmlStartOffset', 1)
      },
    ],
    [
      'wrong html',
      (result: MarkdownRuntimeChunkResult) => {
        Reflect.set(result, 'html', safeHtml('<svg onload="alert(1)"></svg>'))
      },
    ],
    [
      'wrong source',
      (result: MarkdownRuntimeChunkResult) => {
        Reflect.set(result, 'normalizedSource', '# Wrong')
      },
    ],
    [
      'wrong version',
      (result: MarkdownRuntimeChunkResult) => {
        Reflect.set(result, 'rendererVersion', 'markdown-wasm-contract@wrong')
      },
    ],
    [
      'wrong identity',
      (result: MarkdownRuntimeChunkResult) => {
        Reflect.set(result, 'sourceIdentity', 'markdown:forged')
      },
    ],
    [
      'wrong metadata',
      (result: MarkdownRuntimeChunkResult) => {
        Reflect.set(result.metadata!, 'sourceLength', 0)
      },
    ],
  ])('rejects worker response with %s', async (_label, mutate) => {
    vi.stubGlobal('Worker', MarkdownWorkerHarness)
    const source = `${'# Invalid worker\n\n'}${'Paragraph\n\n'.repeat(1_600)}`
    renderMarkdownChunks.mockResolvedValue(
      fsusOk(makeWorkerChunkResult(source)),
    )
    const wrapper = mount(MarkdownRenderer, {
      ...workerChunkedPipeline,
      props: { content: source },
    })
    await vi.advanceTimersByTimeAsync(250)
    await flushPromises()

    const worker = MarkdownWorkerHarness.instances[0]!
    const post = worker.posts.find((message) => message.type === 'run')!
    const forged = structuredClone(
      makeWorkerChunkResult(source),
    ) as MarkdownRuntimeChunkResult
    mutate(forged)
    worker.respond({
      generation: post.generation,
      id: post.id,
      result: { metadata: forged, units: forged.chunks },
      status: 'complete',
    })
    await flushRenderer()

    expect(wrapper.find('svg').exists()).toBe(false)
    expect(wrapper.html()).not.toContain('onload')
    expect(wrapper.attributes('data-fsus-render-strategy')).toBe('sync')
    expect(wrapper.emitted('render-error')).toHaveLength(1)
  })

  test('uses a safe fallback and emits render-error when runtime fails', async () => {
    renderMarkdownHtml.mockResolvedValue(
      fsusErr(createFsusError('infra', 'boom')),
    )
    renderMarkdownResult.mockResolvedValue(
      fsusErr(createFsusError('infra', 'boom')),
    )

    const wrapper = mount(MarkdownRenderer, {
      props: { content: rawScriptSource },
    })
    await flushRenderer()

    expect(wrapper.html()).toContain('Markdown 渲染失败')
    expect(wrapper.html()).toContain(
      '&lt;script&gt;globalThis.__FSUS_XSS__=1&lt;/script&gt;',
    )
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
