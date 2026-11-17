import { flushPromises, mount } from '@vue/test-utils'
import { computed, h } from 'vue'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { configProviderContextKey } from '@element-plus/components/config-provider'
import MarkdownRenderer from '../src/markdown-renderer.vue'
import {
  collectMarkdownAnchorNodes,
  renderMarkdownChunksWithRuntime,
  renderMarkdownResultWithRuntime,
} from '@element-plus/wasm'

describe('issue #1082: MarkdownRenderer canonical block anchors and fragment location', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('renders canonical fragment ids from parsed block anchors while keeping rawSource exact and rejecting invalid/duplicate/cross-gap markers', async () => {
    const fence = '`'.repeat(3)
    const source = [
      '## Heading witness ^harbor',
      '',
      'A *paragraph* ^detail',
      '',
      fence + 'text',
      'atomic value',
      '## Fake ^inside-fence',
      fence,
      '^sample',
      '',
      'Duplicate heading ^harbor',
      '',
      'Invalid marker ^Upper',
      '',
      fence + 'text',
      'after gap',
      fence,
      '',
      '^skipped',
    ].join('\n')

    const anchors = collectMarkdownAnchorNodes(source)
    expect(anchors.flatMap((node) => (node.ok ? [node.fragment] : []))).toEqual([
      '#harbor',
      '#detail',
      '#sample',
    ])

    const rendered = await renderMarkdownResultWithRuntime({
      source,
      mode: 'article',
      contentVersion: '7',
    })
    expect(rendered.ok).toBe(true)
    if (!rendered.ok) return
    expect(rendered.value.rawSource).toBe(source)
    expect(rendered.value.html).toContain('<h2 id="harbor">Heading witness</h2>')
    expect(rendered.value.html).toContain('id="detail"')
    expect(rendered.value.html).toContain('<pre id="sample"')
    expect(rendered.value.html).not.toContain('id="inside-fence"')
    expect(rendered.value.html).not.toContain('id="Upper"')
    expect(rendered.value.html).not.toContain('id="harbor-2"')
    expect(rendered.value.html).not.toContain('id="skipped"')
    expect(rendered.value.html).toContain('^skipped')

    const chunked = await renderMarkdownChunksWithRuntime({
      source,
      mode: 'article',
      contentVersion: '7',
    })
    expect(chunked.ok).toBe(true)
    if (!chunked.ok) return
    for (const id of ['harbor', 'detail', 'sample']) {
      expect(chunked.value.chunks.some((chunk) => chunk.html.includes(`id="${id}"`))).toBe(true)
    }
  })

  test('locateFragment and revealFragment reach regular mounted blocks cleanly', async () => {
    const fence = '`'.repeat(3)
    const source = [
      '## Heading witness ^harbor',
      '',
      'A *paragraph* ^detail',
      '',
      fence + 'text',
      'atomic value',
      fence,
      '^sample',
    ].join('\n')

    const wrapper = mount(MarkdownRenderer, {
      props: {
        content: source,
        contentVersion: 1,
        mode: 'article',
      },
    })

    await flushPromises()
    await new Promise((resolve) => setTimeout(resolve, 20))
    await flushPromises()

    const vm = wrapper.vm as unknown as {
      locateFragment: (target: string) => {
        found: boolean
        mounted: boolean
        id: string
        fragment: string
        element: HTMLElement | null
      }
      revealFragment: (target: string) => Promise<{
        ok: boolean
        id: string
        fragment: string
        element: HTMLElement | null
      }>
    }

    for (const id of ['harbor', 'detail', 'sample']) {
      const located = vm.locateFragment(`#${id}`)
      expect(located.found).toBe(true)
      expect(located.mounted).toBe(true)
      expect(located.id).toBe(id)
      expect(located.fragment).toBe(`#${id}`)
      expect(located.element?.id).toBe(id)

      const scrollSpy = vi.fn()
      if (located.element) {
        located.element.scrollIntoView = scrollSpy
      }
      const revealed = await vm.revealFragment(id)
      expect(revealed.ok).toBe(true)
      expect(revealed.element?.id).toBe(id)
      expect(scrollSpy).toHaveBeenCalledTimes(1)
    }

    expect((await vm.revealFragment('#missing')).ok).toBe(false)
    wrapper.unmount()
  })

  test('revealFragment mounts and locates targets inside unmounted chunked virtual units', async () => {
    const fence = '`'.repeat(3)
    const blocks = Array.from({ length: 45 }, (_, idx) =>
      `Paragraph block ${idx + 1} with extended prose so chunked rendering virtualizes offscreen blocks.`,
    )
    blocks.push(`${fence}ts\nconst anchoredSample = true\n${fence}\n^sample`)
    const source = blocks.join('\n\n')

    const scroller = document.createElement('div')
    scroller.style.overflowY = 'auto'
    scroller.style.height = '180px'
    Object.defineProperty(scroller, 'clientHeight', {
      value: 180,
      configurable: true,
    })
    document.body.appendChild(scroller)

    const Host = {
      render() {
        return h(MarkdownRenderer, {
          content: source,
          contentVersion: 'chunk-anchor-1',
          mode: 'article',
        })
      },
    }

    const wrapper = mount(Host, {
      attachTo: scroller,
      global: {
        provide: {
          [configProviderContextKey as symbol]: computed(() => ({
            renderPipeline: {
              budget: {
                overscanPx: 40,
              },
              thresholds: {
                estimatedNodes: 2,
                htmlBytes: 256,
                itemCount: 2,
              },
            },
          })),
        },
      },
    })

    for (let step = 0; step < 8; step += 1) {
      await flushPromises()
      await new Promise((resolve) => setTimeout(resolve, 15))
    }

    const renderer = wrapper.findComponent(MarkdownRenderer)
    expect(renderer.attributes('data-fsus-render-strategy')).toBe('chunked-main')
    const vm = renderer.vm as unknown as {
      locateFragment: (target: string) => {
        found: boolean
        mounted: boolean
        id: string
        fragment: string
        chunkIndex: number
        chunkKey: string | null
        element: HTMLElement | null
      }
      revealFragment: (target: string) => Promise<{
        ok: boolean
        id: string
        fragment: string
        chunkIndex: number
        chunkKey: string | null
        element: HTMLElement | null
      }>
    }

    const beforeReveal = vm.locateFragment('#sample')
    expect(beforeReveal.found).toBe(true)
    expect(beforeReveal.mounted).toBe(false)
    expect(beforeReveal.chunkIndex).toBeGreaterThan(20)
    expect(beforeReveal.chunkKey).toBeTruthy()
    expect(scroller.querySelector('#sample')).toBeNull()

    const revealed = await vm.revealFragment('#sample')
    expect(revealed.ok).toBe(true)
    expect(revealed.id).toBe('sample')
    expect(revealed.fragment).toBe('#sample')
    expect(revealed.chunkIndex).toBe(beforeReveal.chunkIndex)
    expect(revealed.element?.id).toBe('sample')
    expect(scroller.scrollTop).toBeGreaterThan(0)
    expect(scroller.querySelector('#sample')).toBe(revealed.element)

    wrapper.unmount()
    scroller.remove()
  })
})
