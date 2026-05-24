import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import MarkdownRenderer from '../src/markdown-renderer.vue'
import {
  buildMarkdownRenderResult,
  renderMarkdownChunksWithRuntime,
  renderMarkdownHtmlWithRuntime,
  renderMarkdownResultWithRuntime,
} from '@element-plus/wasm'
import { createFsusError, fsusErr, fsusOk } from '@element-plus/utils'

import type {
  MarkdownRuntimeHtmlResult,
  MarkdownRuntimeChunkResult,
  MarkdownRuntimeRenderResult,
} from '@element-plus/wasm'
import type { FsusResult } from '@element-plus/utils'

vi.mock('@element-plus/wasm', async () => {
  const actual =
    await vi.importActual<typeof import('@element-plus/wasm')>(
      '@element-plus/wasm',
    )

  return {
    ...actual,
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
  await vi.advanceTimersByTimeAsync(20)
  await flushPromises()
}

describe('MarkdownRenderer.vue', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    renderMarkdownChunks.mockReset()
    renderMarkdownHtml.mockReset()
    renderMarkdownResult.mockReset()
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
    vi.useRealTimers()
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

    expect(wrapper.html()).toContain('<h1>Title</h1>')
    expect(wrapper.find('[data-markdown-renderer="wasm"]').exists()).toBe(true)
    expect(wrapper.emitted('render-profile')).toHaveLength(2)
    expect(wrapper.emitted('render-complete')).toHaveLength(1)
  })

  test('shows a loading state while the markdown runtime is rendering', async () => {
    let resolveHtml:
      | ((result: FsusResult<MarkdownRuntimeHtmlResult>) => void)
      | undefined

    renderMarkdownHtml.mockReturnValue(
      new Promise((resolve) => {
        resolveHtml = resolve
      }),
    )
    renderMarkdownResult.mockResolvedValue(
      fsusOk(makeResult('# Loading', '<h1>Loading</h1>')),
    )

    const wrapper = mount(MarkdownRenderer, {
      props: { content: '# Loading' },
    })

    await vi.advanceTimersByTimeAsync(20)
    await flushPromises()

    expect(wrapper.attributes('aria-busy')).toBe('true')
    expect(wrapper.find('[data-markdown-renderer-loading]').exists()).toBe(true)

    resolveHtml?.(fsusOk(makeHtmlResult('<h1>Loading</h1>')))
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

    expect(renderMarkdownHtml).toHaveBeenCalledWith(
      expect.objectContaining({
        source: '<script>alert(1)</script>',
        allowHtml: false,
        allowLatex: true,
        allowMermaid: true,
        mode: 'article',
        baseUrl: null,
      }),
    )
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
          const top = anchorReads <= 2 ? 24 : 84
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

    renderMarkdownHtml.mockResolvedValue(
      fsusOk(makeHtmlResult('<p data-anchor="stable">Anchor</p><p>Before</p>')),
    )
    renderMarkdownResult.mockReturnValue(
      new Promise((resolve) => {
        resolveFull = resolve
      }),
    )

    const wrapper = mount(MarkdownRenderer, {
      attachTo: scroller,
      props: { content: 'anchor' },
    })

    await vi.advanceTimersByTimeAsync(20)
    await flushPromises()
    expect(wrapper.html()).toContain('Before')

    resolveFull?.(
      fsusOk(
        makeResult(
          'anchor',
          '<p data-anchor="stable">Anchor</p><p>After full result</p>',
        ),
      ),
    )
    await flushPromises()
    await vi.advanceTimersByTimeAsync(100)
    await flushPromises()

    expect(wrapper.html()).toContain('After full result')
    expect(scroller.scrollTop).toBe(380)

    wrapper.unmount()
    rectSpy.mockRestore()
    scroller.remove()
  })

  test('uses chunked virtual rendering for large markdown content', async () => {
    const source = `${'# Large\n\n'}${'Paragraph\n\n'.repeat(700)}`
    const result = makeChunkResult(source, '<h1>Chunked</h1><p>Chunk body</p>')
    renderMarkdownChunks.mockResolvedValue(fsusOk(result))

    const wrapper = mount(MarkdownRenderer, {
      props: { content: source },
    })
    await flushRenderer()

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
    expect(wrapper.html()).toContain('<h1>Chunked</h1>')
    expect(wrapper.emitted('render-complete')?.[0]?.[0]).toEqual(result)
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
