// @vitest-environment happy-dom
import { webcrypto } from 'node:crypto'
import { flushPromises, mount } from '@vue/test-utils'
import { nextTick, reactive } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ElMarkdownEditor } from '../../../element-plus'
import {
  prepareMarkdownEmbedResult,
  type MarkdownEmbedRequest,
} from '../../../element-plus/markdown-runtime'
import fixture from '../../../../tests/consumer-install/markdown-embed-projection-blog-coordinate.json'

const target = fixture.coordinate.target.portableArticleIdentity
const source = `::embed[target="${target}" mode="article"]`
const identity = { id: 'workspace:文章:😀:host', epoch: 17 }
const coordinate = {
  targetIdentity: target,
  resolvedRevision: String(fixture.coordinate.resolvedRevision),
  targetVersionIdentity: fixture.coordinate.targetVersionIdentity,
  projectionIdentity: fixture.projection.projectionIdentity,
  projectionDigest: fixture.projection.contentDigest,
}
const wrappers: ReturnType<typeof mount>[] = []
const editor = (props: Record<string, unknown> = {}) => {
  const wrapper = mount(ElMarkdownEditor, {
    props: { modelValue: source, documentIdentity: identity, ...props },
  })
  wrappers.push(wrapper)
  return wrapper
}
const prepared = (request: MarkdownEmbedRequest) =>
  prepareMarkdownEmbedResult(
    request,
    {
      ...request,
      status: 'resolved',
      targetVersion: coordinate,
      projection: {
        kind: 'markdown-reference',
        projectionIdentity: coordinate.projectionIdentity,
        contentDigest: coordinate.projectionDigest,
      },
    },
    {
      readTargetVersion: () => coordinate,
      resolveMarkdown: () => fixture.source,
    },
  )
const deferredProvider = () => {
  const pending: {
    request: MarkdownEmbedRequest
    finish: () => Promise<void>
  }[] = []
  const provider = (request: MarkdownEmbedRequest) =>
    new Promise<Awaited<ReturnType<typeof prepared>>>((resolve) => {
      pending.push({
        request,
        finish: async () => resolve(await prepared(request)),
      })
    })
  return { pending, provider }
}

beforeEach(() => {
  vi.stubGlobal('crypto', webcrypto)
  ;(
    window as unknown as { happyDOM: { setURL: (url: string) => void } }
  ).happyDOM.setURL('http://localhost:3000/')
})
afterEach(() => {
  for (const wrapper of wrappers.splice(0)) wrapper.unmount()
  vi.unstubAllGlobals()
})

describe('public editor controlled embed lifecycle', () => {
  it.each(['live', 'split', 'preview'] as const)(
    'renders verified reference through the existing renderer in %s',
    async (defaultMode) => {
      const wrapper = editor({ defaultMode, embedProvider: prepared })
      await expect
        .poll(() => wrapper.find('.el-markdown-embed strong').text())
        .toBe('controlled')
      expect(wrapper.findAll('textarea')).toHaveLength(1)
      expect(wrapper.find('.el-markdown-embed textarea').exists()).toBe(false)
      expect(
        wrapper.find('.el-markdown-embed [contenteditable="true"]').exists(),
      ).toBe(false)
      expect(wrapper.props('modelValue')).toBe(source)
      expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    },
  )

  it('keeps source mode on the exact directive', async () => {
    const wrapper = editor({ embedProvider: prepared })
    await flushPromises()
    expect(wrapper.get<HTMLTextAreaElement>('textarea').element.value).toBe(
      source,
    )
    expect(wrapper.find('.el-markdown-embed').exists()).toBe(false)
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it.each([
    { id: 'other:文章:😀:host', epoch: 17 },
    { ...identity, epoch: 18 },
  ])(
    'rebinds identical source and rejects delayed old document $id/$epoch',
    async (nextIdentity) => {
      const { pending, provider } = deferredProvider()
      const wrapper = editor({
        defaultMode: 'preview',
        embedProvider: provider,
      })
      await expect.poll(() => pending.length).toBe(1)
      await wrapper.setProps({ documentIdentity: nextIdentity })
      expect(pending[0].request.signal?.aborted).toBe(true)
      await expect.poll(() => pending.length).toBe(2)
      expect(pending[0].request.documentIdentity).toEqual(identity)
      expect(pending[1].request.documentIdentity).toEqual(nextIdentity)
      expect(pending[1].request.revision).toBe(0)
      await pending[0].finish()
      await flushPromises()
      expect(wrapper.find('.el-markdown-embed strong').exists()).toBe(false)
      await pending[1].finish()
      await expect
        .poll(() => wrapper.find('.el-markdown-embed strong').text())
        .toBe('controlled')
    },
  )

  it('cancels provider work on replacement and disposal', async () => {
    const first = deferredProvider()
    const second = deferredProvider()
    const wrapper = editor({
      defaultMode: 'preview',
      embedProvider: first.provider,
    })
    await expect.poll(() => first.pending.length).toBe(1)
    await wrapper.setProps({ embedProvider: second.provider })
    expect(first.pending[0].request.signal?.aborted).toBe(true)
    await expect.poll(() => second.pending.length).toBe(1)
    wrapper.unmount()
    wrappers.splice(wrappers.indexOf(wrapper), 1)
    expect(second.pending[0].request.signal?.aborted).toBe(true)
    await first.pending[0].finish()
    await second.pending[0].finish()
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('rejects old revision after document replacement', async () => {
    const { pending, provider } = deferredProvider()
    const wrapper = editor({ defaultMode: 'preview', embedProvider: provider })
    await expect.poll(() => pending.length).toBe(1)
    await wrapper.setProps({ modelValue: `Prefix\n\n${source}` })
    expect(pending[0].request.signal?.aborted).toBe(true)
    await expect.poll(() => pending.length).toBe(2)
    expect(pending[1].request.revision).toBeGreaterThan(
      pending[0].request.revision,
    )
    await pending[0].finish()
    await flushPromises()
    expect(wrapper.find('.el-markdown-embed strong').exists()).toBe(false)
    await pending[1].finish()
    await expect
      .poll(() => wrapper.find('.el-markdown-embed strong').text())
      .toBe('controlled')
  })

  it('does not invoke a provider after disposal while the request digest is pending', async () => {
    let finish!: () => void
    vi.stubGlobal('crypto', {
      subtle: {
        digest: () =>
          new Promise<ArrayBuffer>((resolve) => {
            finish = () => resolve(new ArrayBuffer(32))
          }),
      },
    })
    const provider = vi.fn(prepared)
    const wrapper = editor({ embedProvider: provider })
    wrapper.unmount()
    wrappers.splice(wrappers.indexOf(wrapper), 1)
    finish()
    await flushPromises()
    expect(provider).not.toHaveBeenCalled()
  })

  it('keeps legacy metadata available when Web Crypto is unavailable', async () => {
    vi.stubGlobal('crypto', undefined)
    const wrapper = editor({
      defaultMode: 'preview',
      embedProvider: (request: MarkdownEmbedRequest) => ({
        ...request,
        status: 'resolved',
        title: 'Legacy title',
        excerpt: 'Legacy excerpt',
      }),
    })
    await flushPromises()
    expect(wrapper.get('.el-markdown-embed').text()).toContain('Legacy excerpt')
    expect(wrapper.find('.el-markdown-embed .markdown-renderer').exists()).toBe(
      false,
    )
  })

  it('does not replace the host selection or composition with derived content', async () => {
    const { pending, provider } = deferredProvider()
    const wrapper = editor({ defaultMode: 'live', embedProvider: provider })
    await expect.poll(() => pending.length).toBe(1)
    const textarea = wrapper.get<HTMLTextAreaElement>('textarea')
    textarea.element.setSelectionRange(2, 5, 'backward')
    await textarea.trigger('select')
    await textarea.trigger('compositionstart')
    const selectionEvents = wrapper.emitted('selection-change')?.length
    await pending[0].finish()
    await expect
      .poll(() => wrapper.find('.el-markdown-embed strong').text())
      .toBe('controlled')
    expect(textarea.element.value).toBe(source)
    expect([
      textarea.element.selectionStart,
      textarea.element.selectionEnd,
      textarea.element.selectionDirection,
    ]).toEqual([2, 5, 'backward'])
    expect(wrapper.emitted('selection-change')?.length).toBe(selectionEvents)
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    await textarea.trigger('compositionend')
  })

  it('rechecks the consumer target version before presenting prepared content', async () => {
    const current = reactive({ ...coordinate })
    const wrapper = editor({
      defaultMode: 'preview',
      embedProvider: (request: MarkdownEmbedRequest) =>
        prepareMarkdownEmbedResult(
          request,
          {
            ...request,
            status: 'resolved',
            targetVersion: { ...current },
            projection: {
              kind: 'markdown-reference',
              projectionIdentity: current.projectionIdentity,
              contentDigest: current.projectionDigest,
            },
          },
          {
            readTargetVersion: () => current,
            resolveMarkdown: () => fixture.source,
          },
        ),
    })
    await expect
      .poll(() => wrapper.find('.el-markdown-embed strong').text())
      .toBe('controlled')
    current.resolvedRevision = '18'
    await nextTick()
    expect(wrapper.find('.el-markdown-embed strong').exists()).toBe(false)
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })
})
