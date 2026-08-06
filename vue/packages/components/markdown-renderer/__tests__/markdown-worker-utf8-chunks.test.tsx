import { computed, nextTick } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { configProviderContextKey } from '@element-plus/components/config-provider'
import {
  initMarkdownRuntime,
  isMarkdownRuntimeAuthorizedResult,
  renderMarkdownChunksWithRuntime,
  type MarkdownRuntimeChunkResult,
} from '@element-plus/wasm'
import { isFsusErr } from '@element-plus/utils'
import { buildMarkdownStressCorpus } from '../../../demo-app/src/markdown-stress-corpus'
import MarkdownRenderer from '../src/markdown-renderer.vue'

type MarkdownWorkerPost = {
  generation?: number
  id: number
  type?: 'cancel' | 'run'
}

class MarkdownWorkerHarness {
  static instances: MarkdownWorkerHarness[] = []

  onmessage: ((event: MessageEvent) => void) | null = null
  posts: MarkdownWorkerPost[] = []

  constructor() {
    MarkdownWorkerHarness.instances.push(this)
  }

  postMessage(message: MarkdownWorkerPost) {
    this.posts.push(message)
  }

  terminate() {}

  respond(payload: Record<string, unknown>) {
    this.onmessage?.({ data: payload } as MessageEvent)
  }
}

const workerChunkedPipeline = {
  global: {
    provide: {
      [configProviderContextKey as symbol]: computed(() => ({
        renderPipeline: {
          budget: { measureBatch: 4 },
          mode: 'enabled',
          worker: 'enabled',
        },
      })),
    },
  },
}

describe('markdown stress worker materialization', () => {
  afterEach(() => {
    MarkdownWorkerHarness.instances = []
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  test('re-authorizes worker chunks whose offsets are UTF-8 bytes (multi-byte HTML)', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('Worker', MarkdownWorkerHarness)

    const source = buildMarkdownStressCorpus(24_000)
    const engine = await initMarkdownRuntime()
    expect(isFsusErr(engine)).toBe(false)

    const rendered = await renderMarkdownChunksWithRuntime({
      source,
      allowLatex: true,
      allowMermaid: true,
      mode: 'article',
    })
    expect(isFsusErr(rendered)).toBe(false)
    if (isFsusErr(rendered)) return

    // Runtime result is WeakSet-authorized; the worker boundary must survive a
    // structured clone that drops that brand — the same path Playwright hits.
    expect(isMarkdownRuntimeAuthorizedResult(rendered.value)).toBe(true)
    const cloned = structuredClone(
      rendered.value,
    ) as MarkdownRuntimeChunkResult
    expect(isMarkdownRuntimeAuthorizedResult(cloned)).toBe(false)
    expect(
      cloned.chunks.some(
        (chunk) =>
          chunk.htmlEndOffset - chunk.htmlStartOffset !== chunk.html.length,
      ),
    ).toBe(true)

    const wrapper = mount(MarkdownRenderer, {
      ...workerChunkedPipeline,
      props: {
        content: source,
        allowLatex: true,
        allowMermaid: true,
        mode: 'article',
      },
      attachTo: document.body,
    })

    await vi.advanceTimersByTimeAsync(250)
    await flushPromises()

    const worker = MarkdownWorkerHarness.instances[0]
    expect(worker).toBeTruthy()
    const post = worker!.posts.find((message) => message.type === 'run')
    expect(post).toBeTruthy()

    worker!.respond({
      generation: post!.generation,
      id: post!.id,
      result: { metadata: cloned, units: cloned.chunks },
      status: 'complete',
    })

    for (let frame = 0; frame < 40; frame += 1) {
      await vi.advanceTimersByTimeAsync(16)
      await flushPromises()
      await nextTick()
      if (wrapper.emitted('render-complete') || wrapper.emitted('render-error')) {
        break
      }
    }

    expect(wrapper.emitted('render-error')).toBeUndefined()
    expect(wrapper.html()).not.toContain('Markdown 渲染失败')
    expect(wrapper.html()).toContain('markdown-renderer__text--inline-code')
    wrapper.unmount()
  }, 60_000)
})
