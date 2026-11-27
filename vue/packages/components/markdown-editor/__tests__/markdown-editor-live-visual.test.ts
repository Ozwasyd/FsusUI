import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { describe, expect, it } from 'vitest'

import {
  createMarkdownEditorProjection,
  stabilizeMarkdownEditorProjection,
} from '../../../wasm/markdown-runtime'
import { resolveMarkdownLiveSyntaxReveal } from '../src/markdown-editor-live-reveal'
import {
  MARKDOWN_LIVE_VISUAL_WINDOW_THRESHOLD,
  createMarkdownLiveVisualSegments,
} from '../src/markdown-editor-live-visual'
import { resolveFocusState } from '../src/markdown-editor-writing-aids'
import MarkdownEditor from '../src/markdown-editor.vue'
import { getMarkdownXssSourceAttackFragment } from '../../../../tests/support/markdown-xss-corpus'

const identity = Object.freeze({ epoch: 1, id: 'live-visual-doc' })

const project = (source: string) =>
  stabilizeMarkdownEditorProjection(
    createMarkdownEditorProjection(source),
    identity,
  )

describe('createMarkdownLiveVisualSegments (#1104)', () => {
  it('preserves exact character fidelity across all Markdown constructs, CJK, emoji, RTL, and malformed syntax', () => {
    const source = [
      '# 标题 **粗体**',
      '',
      'Body *em*, **strong**, ***both***, **bold *inner* end**, `code`, `*not-em*`, [label](https://x.test "tip"), ![alt](pic.png), 👨‍👩‍👧‍👦 🚀 שלום.',
      '',
      '- item one',
      '- item two',
      '',
      '- [x] done task',
      '- [ ] open task',
      '',
      '> quote line 1',
      '> quote line 2',
      '',
      '```ts',
      'const value = 42',
      '```',
      '',
      '| H1 | H2 |',
      '| --- | :---: |',
      '| c1 | **c2** |',
      '',
      '[broken](http://x',
      '',
      '```unclosed',
      'still raw',
    ].join('\n')

    const projection = project(source)
    const segments = createMarkdownLiveVisualSegments({
      projection,
      reveal: null,
      source,
    })

    expect(segments.map((segment) => segment.text).join('')).toBe(source)
    for (let index = 1; index < segments.length; index += 1) {
      expect(segments[index]!.start).toBe(segments[index - 1]!.end)
      expect(segments[index]!.end).toBeGreaterThan(segments[index]!.start)
    }

    expect(
      segments.some(
        (segment) =>
          segment.kind === 'heading' &&
          segment.marker &&
          segment.text === '# ',
      ),
    ).toBe(true)
    expect(
      segments.some(
        (segment) =>
          segment.kind === 'heading' &&
          !segment.marker &&
          segment.text.includes('标题'),
      ),
    ).toBe(true)
    expect(
      segments.some(
        (segment) =>
          segment.kind === 'emphasis' &&
          !segment.marker &&
          segment.text === 'em',
      ),
    ).toBe(true)
    expect(
      segments.some(
        (segment) =>
          segment.kind === 'strong' &&
          !segment.marker &&
          segment.text === 'strong',
      ),
    ).toBe(true)
    expect(
      segments.some(
        (segment) =>
          segment.kind === 'strong-emphasis' &&
          !segment.marker &&
          segment.text === 'both',
      ),
    ).toBe(true)
    expect(
      segments.some(
        (segment) =>
          segment.kind === 'strong-emphasis' &&
          !segment.marker &&
          segment.text === 'inner',
      ),
    ).toBe(true)
    expect(
      segments.some(
        (segment) =>
          segment.kind === 'inline-code' &&
          !segment.marker &&
          segment.text === '*not-em*',
      ),
    ).toBe(true)
    expect(
      segments.some(
        (segment) =>
          segment.kind === 'link-label' &&
          !segment.marker &&
          segment.text === 'label',
      ),
    ).toBe(true)
    expect(
      segments.some(
        (segment) =>
          segment.kind === 'link-destination' &&
          segment.text.includes('https://x.test'),
      ),
    ).toBe(true)
    expect(
      segments.some(
        (segment) =>
          segment.kind === 'image-alt' &&
          !segment.marker &&
          segment.text === 'alt',
      ),
    ).toBe(true)
    expect(
      segments.some(
        (segment) =>
          segment.kind === 'list-marker' &&
          segment.marker &&
          segment.text === '- ',
      ),
    ).toBe(true)
    expect(
      segments.some(
        (segment) =>
          segment.kind === 'task-marker' &&
          segment.marker &&
          segment.text === '- [x] ',
      ),
    ).toBe(true)
    expect(
      segments.some(
        (segment) =>
          segment.kind === 'task-checked' &&
          !segment.marker &&
          segment.text === 'done task',
      ),
    ).toBe(true)
    expect(
      segments.some(
        (segment) =>
          segment.kind === 'quote' &&
          segment.marker &&
          segment.text === '> ',
      ),
    ).toBe(true)
    expect(
      segments.some(
        (segment) =>
          segment.kind === 'code-language' && segment.text === 'ts',
      ),
    ).toBe(true)
    expect(
      segments.some(
        (segment) =>
          segment.kind === 'code-block' &&
          !segment.marker &&
          segment.text.includes('const value = 42'),
      ),
    ).toBe(true)
    expect(
      segments.some(
        (segment) =>
          segment.kind === 'table-header' &&
          !segment.marker &&
          segment.text === 'H1',
      ),
    ).toBe(true)
    expect(
      segments.some(
        (segment) =>
          segment.kind === 'table-marker' &&
          segment.marker &&
          segment.text.includes('---'),
      ),
    ).toBe(true)
    expect(
      segments.some(
        (segment) =>
          segment.kind === 'malformed' && segment.text.includes('unclosed'),
      ),
    ).toBe(true)
    expect(segments.every((segment) => segment.revealed === false)).toBe(true)
  })

  it('toggles revealed markers from the shared reveal plan and clears them on Escape', () => {
    const source = '# Title\n\nSee **bold** and [docs](https://x.test)\n'
    const projection = project(source)
    const boldOffset = source.indexOf('bold') + 1

    const revealedPlan = resolveMarkdownLiveSyntaxReveal({
      documentIdentity: identity,
      mode: 'live',
      projection,
      selection: { direction: 'none', end: boldOffset, start: boldOffset },
      source,
    })
    const activeSegments = createMarkdownLiveVisualSegments({
      projection,
      reveal: revealedPlan,
      source,
    })

    expect(activeSegments.map((segment) => segment.text).join('')).toBe(source)
    expect(
      activeSegments.filter(
        (segment) =>
          segment.kind === 'strong' && segment.marker && segment.revealed,
      ),
    ).toHaveLength(2)
    expect(
      activeSegments.find(
        (segment) => segment.kind === 'heading' && segment.marker,
      )?.revealed,
    ).toBe(false)

    const escapedPlan = resolveMarkdownLiveSyntaxReveal({
      documentIdentity: identity,
      intent: 'escape',
      mode: 'live',
      previous: revealedPlan,
      projection,
      selection: { direction: 'none', end: boldOffset, start: boldOffset },
      source,
    })
    const escapedSegments = createMarkdownLiveVisualSegments({
      projection,
      reveal: escapedPlan,
      source,
    })
    expect(escapedSegments.every((segment) => segment.revealed === false)).toBe(
      true,
    )
    expect(escapedSegments.map((segment) => segment.text).join('')).toBe(source)
  })

  it('guards large documents (> 50k chars) by decorating only activeNodeIds while preserving exact source', () => {
    const chunk = '# Heading **bold** `code`\n\nParagraph with *emphasis* text.\n\n'
    const repeats =
      Math.ceil((MARKDOWN_LIVE_VISUAL_WINDOW_THRESHOLD + 5_000) / chunk.length)
    const source = Array.from({ length: repeats }, () => chunk).join('')
    expect(source.length).toBeGreaterThan(MARKDOWN_LIVE_VISUAL_WINDOW_THRESHOLD)

    const projection = project(source)
    const activeNodeIds = projection.nodes.slice(0, 2).map((node) => node.id)
    const segments = createMarkdownLiveVisualSegments({
      activeNodeIds,
      projection,
      reveal: null,
      source,
    })

    expect(segments.map((segment) => segment.text).join('')).toBe(source)
    expect(segments.length).toBeLessThan(30)
    expect(segments.some((segment) => segment.kind === 'heading')).toBe(true)
    const tail = segments[segments.length - 1]!
    expect(tail.kind).toBe('plain')
    expect(tail.text.length).toBeGreaterThan(
      MARKDOWN_LIVE_VISUAL_WINDOW_THRESHOLD - 1_000,
    )
  })

  it('falls back cleanly to plain segments when projection is unavailable or source is empty', () => {
    expect(
      createMarkdownLiveVisualSegments({
        projection: undefined,
        reveal: null,
        source: '',
      }),
    ).toEqual([])

    const source = '# Fallback **plain**'
    const segments = createMarkdownLiveVisualSegments({
      projection: undefined,
      reveal: null,
      source,
    })
    expect(segments).toHaveLength(1)
    expect(segments[0]).toMatchObject({
      kind: 'plain',
      marker: false,
      revealed: false,
      text: source,
    })
  })

  it('composes focus-mode dimming and exemptions with live visual tokens', () => {
    const source = '# Heading\n\n**Second** paragraph.\n\n*Third* paragraph.\n'
    const projection = project(source)
    const focusState = resolveFocusState({
      caret: 2,
      editorProfile: 'prose',
      exemptions: {
        searchMatches: [projection.nodes[2]!.id],
      },
      focus: true,
      mode: 'live',
      projection,
      source,
    })

    const segments = createMarkdownLiveVisualSegments({
      focusState,
      projection,
      reveal: null,
      source,
    })

    expect(segments.map((segment) => segment.text).join('')).toBe(source)
    expect(
      segments.some(
        (segment) =>
          segment.kind === 'heading' &&
          !segment.dimmed &&
          segment.nodeId === projection.nodes[0]!.id,
      ),
    ).toBe(true)
    expect(
      segments.some(
        (segment) =>
          segment.kind === 'strong' &&
          segment.dimmed &&
          segment.nodeId === projection.nodes[1]!.id,
      ),
    ).toBe(true)
    expect(
      segments.some(
        (segment) =>
          segment.kind === 'emphasis' &&
          !segment.dimmed &&
          segment.exempt &&
          segment.nodeId === projection.nodes[2]!.id,
      ),
    ).toBe(true)
  })
})

describe('MarkdownEditor live visual projection integration (#1104)', () => {
  it('renders live visual mirror layer in live mode, escapes HTML strictly as text, handles reveal + Escape, IME suspend, and scroll sync', async () => {
    const image = getMarkdownXssSourceAttackFragment('mxss-raw-img-onerror')
    const source = `# Title\n\nSee **bold** and ${image} here.\n`
    const wrapper = mount(MarkdownEditor, {
      attachTo: document.body,
      props: {
        defaultMode: 'source',
        modelValue: source,
      },
    })
    try {
      expect(wrapper.find('.el-markdown-editor__live-layer').exists()).toBe(
        false,
      )
      expect(wrapper.classes()).not.toContain('is-live-visual')

      await wrapper.find('.el-markdown-editor__mode--live').trigger('click')
      await nextTick()

      const liveLayer = wrapper.find('.el-markdown-editor__live-layer')
      expect(liveLayer.exists()).toBe(true)
      expect(liveLayer.attributes('aria-hidden')).toBe('true')
      expect(liveLayer.attributes('data-markdown-live-visual')).toBe('')
      expect(wrapper.classes()).toContain('is-live-visual')
      expect(liveLayer.element.textContent).toBe(source)
      expect(liveLayer.findAll('img')).toHaveLength(0)
      expect(wrapper.find('[data-markdown-live-decorations]').exists()).toBe(
        true,
      )
      expect(
        liveLayer.find('.el-markdown-editor__live-token--heading').exists(),
      ).toBe(true)
      expect(
        liveLayer.find('.el-markdown-editor__live-token--strong').exists(),
      ).toBe(true)

      const textarea = wrapper.find('textarea')
      const textareaEl = textarea.element as HTMLTextAreaElement
      const boldPos = source.indexOf('bold') + 1
      textareaEl.setSelectionRange(boldPos, boldPos)
      await textarea.trigger('click')
      await nextTick()

      expect(
        liveLayer.findAll('.el-markdown-editor__live-token.is-marker.is-revealed')
          .length,
      ).toBe(2)

      await textarea.trigger('keydown', { key: 'Escape' })
      await nextTick()
      expect(
        liveLayer.findAll('.el-markdown-editor__live-token.is-revealed'),
      ).toHaveLength(0)
      expect(wrapper.emitted('update:modelValue')).toBeUndefined()

      // ScrollTop + ScrollLeft synchronization
      textareaEl.scrollTop = 120
      textareaEl.scrollLeft = 24
      await textarea.trigger('scroll')
      expect(liveLayer.element.scrollTop).toBe(120)
      expect(liveLayer.element.scrollLeft).toBe(24)

      // IME composition suspends live visual layer cleanly
      await textarea.trigger('compositionstart')
      await nextTick()
      expect(wrapper.classes()).toContain('is-composing')
      expect(wrapper.classes()).not.toContain('is-live-visual')
      expect(wrapper.find('.el-markdown-editor__live-layer').exists()).toBe(
        false,
      )

      await textarea.trigger('compositionend', { data: '' })
      await nextTick()
      expect(wrapper.classes()).not.toContain('is-composing')
      expect(wrapper.classes()).toContain('is-live-visual')
      expect(wrapper.find('.el-markdown-editor__live-layer').exists()).toBe(
        true,
      )
    } finally {
      wrapper.unmount()
    }
  })

  it('composes live visual tokens inside the single focus-layer when focus mode and live mode are both active', async () => {
    const source = '# Heading\n\nSecond **paragraph**.\n'
    const wrapper = mount(MarkdownEditor, {
      props: {
        defaultMode: 'live',
        editorProfile: 'prose',
        modelValue: source,
        writingAids: { focus: true },
      },
    })
    await nextTick()

    expect(wrapper.findAll('.el-markdown-editor__focus-layer')).toHaveLength(1)
    expect(wrapper.findAll('.el-markdown-editor__live-layer')).toHaveLength(0)
    const focusLayer = wrapper.find('.el-markdown-editor__focus-layer')
    expect(focusLayer.attributes('data-markdown-live-visual')).toBe('')
    expect(focusLayer.element.textContent).toBe(source)
    expect(focusLayer.findAll('.el-markdown-editor__live-token').length).toBeGreaterThan(
      0,
    )
    expect(focusLayer.findAll('.is-dimmed').length).toBeGreaterThan(0)
  })
})
