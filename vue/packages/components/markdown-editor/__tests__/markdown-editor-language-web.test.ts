import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import type { MarkdownStableProjection } from '../../../wasm/markdown-runtime'
import MarkdownEditor from '../src/markdown-editor.vue'
import {
  bindMarkdownWebLanguageTools,
  resolveMarkdownWebLanguageCoordinates,
} from '../src/markdown-editor-language-web'

const projectionFixture = (
  source: string,
  documentIdentity: { readonly epoch: number; readonly id: string },
  nodes: readonly {
    readonly id: string
    readonly kind: string
    readonly presentation:
      | 'live-decorated'
      | 'live-atomic'
      | 'source-only-with-reason'
      | 'unsupported-error'
    readonly rawContentRanges?: readonly {
      readonly end: number
      readonly start: number
    }[]
    readonly rawMarkerRanges?: readonly {
      readonly end: number
      readonly start: number
    }[]
    readonly rawRange: { readonly end: number; readonly start: number }
  }[] = [],
): MarkdownStableProjection => {
  const stableNodes = nodes.map((node) =>
    Object.freeze({
      childNormalizedRanges: Object.freeze([]),
      childRawRanges: Object.freeze([]),
      id: node.id,
      kind: node.kind,
      normalizedContentRanges: node.rawContentRanges,
      normalizedMarkerRanges: node.rawMarkerRanges,
      normalizedRange: node.rawRange,
      parentNormalizedRange: null,
      parentRawRange: null,
      presentation: node.presentation,
      rawContentRanges: node.rawContentRanges,
      rawMarkerRanges: node.rawMarkerRanges,
      rawRange: node.rawRange,
    }),
  )
  return Object.freeze({
    documentIdentity: Object.freeze(documentIdentity),
    nodes: Object.freeze(stableNodes),
    normalizedSource: source,
    resolve(id: string) {
      const node = stableNodes.find((candidate) => candidate.id === id)
      return node
        ? Object.freeze({ node, status: 'current' as const })
        : Object.freeze({ status: 'invalid' as const })
    },
  }) as MarkdownStableProjection
}

describe('markdown web language tools integration', () => {
  it('binds global native attributes without creating another text authority', () => {
    const attributes = new Map<string, string>()
    const textarea = {
      setAttribute: (name: string, value: string) =>
        attributes.set(name, value),
      spellcheck: false,
      value: 'Some prose text',
    }
    const controller = bindMarkdownWebLanguageTools(textarea, {
      config: {
        autocorrect: true,
        lang: 'zh-CN',
        nativeWritingTools: 'disabled',
        spellcheck: true,
      },
    })

    expect(textarea).toMatchObject({
      autocapitalize: 'sentences',
      autocomplete: 'off',
      lang: 'zh-CN',
      spellcheck: true,
    })
    expect(attributes.get('autocorrect')).toBe('on')
    expect(attributes.get('writingsuggestions')).toBe('false')
    expect(controller).toMatchObject({
      lang: 'zh-CN',
      nativeWritingTools: 'disabled',
      spellcheck: true,
    })
  })

  it('routes an explicit browser replacement through the strict transaction adapter', () => {
    const source = 'Hello wrld'
    const documentIdentity = { epoch: 1, id: 'web-doc' }
    const textarea = {
      selectionDirection: 'none' as const,
      selectionEnd: 10,
      selectionStart: 6,
      spellcheck: true,
      value: source,
    }
    const controller = bindMarkdownWebLanguageTools(textarea, {
      documentIdentity,
      projection: projectionFixture(source, documentIdentity),
      revision: 4,
      source,
    })
    controller.createSession('context-menu')
    const result = controller.applyReplacement(6, 10, 'world')

    expect(result).toMatchObject({
      accepted: true,
      transaction: {
        changes: [{ from: 6, insert: 'world', to: 10 }],
        expectedRevision: 4,
        history: 'separate',
        metadata: {
          kind: 'context-menu',
          languageTool: true,
          sessionKind: 'context-menu',
        },
        origin: 'input',
      },
    })
    expect(controller.session).toBeNull()
  })

  it('consumes rejected browser replacement events instead of retaining DOM mutation', () => {
    let prevented = 0
    const textarea = {
      selectionDirection: 'none' as const,
      selectionEnd: 10,
      selectionStart: 6,
      spellcheck: true,
      value: 'Hello wrld',
    }
    const controller = bindMarkdownWebLanguageTools(textarea, {
      revision: 1,
      source: textarea.value,
    })
    const result = controller.handleBeforeInput({
      data: 'world',
      inputType: 'insertReplacementText',
      preventDefault: () => {
        prevented += 1
      },
    })

    expect(prevented).toBe(1)
    expect(result).toEqual({
      handled: true,
      reason: 'projection-unavailable',
      transaction: undefined,
    })
    expect(textarea.value).toBe('Hello wrld')
  })

  it('keeps code and URL suppression local while global spellcheck stays enabled', () => {
    const source = '`wrld` [site](https://fsusui.dev)'
    const documentIdentity = { epoch: 1, id: 'local-policy' }
    const projection = projectionFixture(source, documentIdentity, [
      {
        id: 'code',
        kind: 'code',
        presentation: 'source-only-with-reason',
        rawContentRanges: [{ end: 5, start: 1 }],
        rawMarkerRanges: [
          { end: 1, start: 0 },
          { end: 6, start: 5 },
        ],
        rawRange: { end: 6, start: 0 },
      },
      {
        id: 'link',
        kind: 'link',
        presentation: 'live-decorated',
        rawContentRanges: [
          { end: 12, start: 8 },
          { end: 33, start: 14 },
        ],
        rawRange: { end: 34, start: 7 },
      },
    ])
    const textarea = {
      selectionEnd: 5,
      selectionStart: 1,
      spellcheck: true,
      value: source,
    }
    const controller = bindMarkdownWebLanguageTools(textarea, {
      documentIdentity,
      projection,
      source,
    })

    expect(controller.updateContext({ offset: 2 })).toMatchObject({
      reason: 'code-block',
      spellcheck: false,
      status: 'degraded',
    })
    expect(textarea.spellcheck).toBe(true)
    expect(controller.switchMode('live').spellcheck).toBe(false)
    expect(textarea.spellcheck).toBe(true)
    expect(controller.updateContext({ offset: 20 }).reason).toBe('url')
    expect(textarea.spellcheck).toBe(true)
  })

  it('fails closed for composition and for stale selection sessions', () => {
    const source = '中文 wrld'
    const documentIdentity = { epoch: 1, id: 'ime-doc' }
    const textarea = {
      selectionDirection: 'none' as const,
      selectionEnd: 7,
      selectionStart: 3,
      spellcheck: true,
      value: source,
    }
    const controller = bindMarkdownWebLanguageTools(textarea, {
      documentIdentity,
      projection: projectionFixture(source, documentIdentity),
      revision: 1,
      source,
    })

    expect(
      controller.handleBeforeInput({
        data: 'world',
        inputType: 'insertReplacementText',
        isComposing: true,
      }),
    ).toMatchObject({ handled: true, reason: 'composition-active' })

    controller.createSession('spellcheck')
    textarea.selectionStart = 0
    textarea.selectionEnd = 2
    expect(
      controller.handleBeforeInput({
        data: 'world',
        inputType: 'insertReplacementText',
      }),
    ).toMatchObject({ handled: true, reason: 'stale-selection' })
  })

  it('does not equate raw offsets with visual offsets without the #325 map', () => {
    const source = '# Heading'
    const identity = { epoch: 1, id: 'coordinates' }
    const coordinates = resolveMarkdownWebLanguageCoordinates({
      documentIdentity: identity,
      offset: 0,
      projection: projectionFixture(source, identity, [
        {
          id: 'heading',
          kind: 'heading',
          presentation: 'live-decorated',
          rawMarkerRanges: [{ end: 2, start: 0 }],
          rawRange: { end: source.length, start: 0 },
        },
      ]),
      source,
    })
    expect(coordinates).toMatchObject({
      inMarker: true,
      rawOffset: 0,
      reason: 'hidden-marker',
    })
    expect(coordinates.visualOffset).toBeUndefined()
  })

  it('keeps the component fail-closed and does not expose a private textarea ref', async () => {
    const wrapper = mount(MarkdownEditor, {
      props: { modelValue: 'Hello wrld', showActions: false },
    })
    const textarea = wrapper.get('textarea').element
    textarea.setSelectionRange(6, 10)
    const replacement = new InputEvent('beforeinput', {
      bubbles: true,
      cancelable: true,
      data: 'world',
      inputType: 'insertReplacementText',
    })
    textarea.dispatchEvent(replacement)
    await wrapper.vm.$nextTick()

    expect(replacement.defaultPrevented).toBe(true)
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(wrapper.props('modelValue')).toBe('Hello wrld')
    const publicSurface = (
      wrapper.vm as unknown as {
        readonly $: { readonly exposed?: Record<string, unknown> }
      }
    ).$.exposed
    expect(publicSurface).toMatchObject({
      dispatchTransaction: expect.any(Function),
      insertMarkdownAtCursor: expect.any(Function),
      redo: expect.any(Function),
      undo: expect.any(Function),
    })
    expect(publicSurface).not.toHaveProperty('textareaRef')
  })
})
