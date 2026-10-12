import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import {
  createMarkdownAnchorMap,
  createMarkdownEditorProjection,
  stabilizeMarkdownEditorProjection,
  type MarkdownStableProjection,
} from '../../../wasm/markdown-runtime'
import MarkdownEditor from '../src/markdown-editor.vue'
import {
  bindMarkdownWebLanguageTools,
  resolveMarkdownWebLanguageCoordinates,
} from '../src/markdown-editor-language-web'

const projectionFixture = (
  source: string,
  documentIdentity: { readonly epoch: number; readonly id: string },
): MarkdownStableProjection =>
  stabilizeMarkdownEditorProjection(
    createMarkdownEditorProjection(source),
    documentIdentity,
  )

const anchorMapFixture = (
  source: string,
  documentIdentity: { readonly epoch: number; readonly id: string },
  projection: MarkdownStableProjection,
) =>
  createMarkdownAnchorMap({
    identity: documentIdentity,
    projection,
    source,
    syntax: projection.nodes.flatMap((node) => [
      {
        atomic: node.presentation === 'live-atomic',
        id: node.id,
        projectionId: node.id,
        range: node.rawRange,
      },
      ...node.rawMarkerRanges.map((range, index) => ({
        hidden: true,
        id: `${node.id}:marker:${index}`,
        parentId: node.id,
        projectionId: node.id,
        range,
      })),
    ]),
  })

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
    const projection = projectionFixture(source, documentIdentity)
    const controller = bindMarkdownWebLanguageTools(textarea, {
      anchorMap: anchorMapFixture(source, documentIdentity, projection),
      documentIdentity,
      projection,
      projectionRevision: 4,
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

  it('does not infer projection freshness from the current editor revision', () => {
    const source = 'Hello wrld'
    const documentIdentity = { epoch: 1, id: 'projection-revision' }
    const textarea = {
      selectionDirection: 'none' as const,
      selectionEnd: 10,
      selectionStart: 6,
      spellcheck: true,
      value: source,
    }
    const projection = projectionFixture(source, documentIdentity)
    const controller = bindMarkdownWebLanguageTools(textarea, {
      anchorMap: anchorMapFixture(source, documentIdentity, projection),
      documentIdentity,
      projection,
      revision: 4,
      source,
    })

    controller.createSession('spellcheck')
    expect(controller.applyReplacement(6, 10, 'world')).toMatchObject({
      accepted: false,
      reason: 'stale-projection',
    })
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
    const source = '```text\nwrld\n```\n[site](https://fsusui.dev)'
    const documentIdentity = { epoch: 1, id: 'local-policy' }
    const projection = projectionFixture(source, documentIdentity)
    const codeOffset = source.indexOf('wrld')
    const urlOffset = source.indexOf('https://')
    const textarea = {
      selectionEnd: codeOffset + 4,
      selectionStart: codeOffset,
      spellcheck: true,
      value: source,
    }
    const controller = bindMarkdownWebLanguageTools(textarea, {
      anchorMap: anchorMapFixture(source, documentIdentity, projection),
      documentIdentity,
      projection,
      projectionRevision: 0,
      source,
    })

    expect(controller.updateContext({ offset: codeOffset })).toMatchObject({
      reason: 'code-block',
      spellcheck: false,
      status: 'degraded',
    })
    expect(textarea.spellcheck).toBe(true)
    expect(controller.switchMode('live').spellcheck).toBe(false)
    expect(textarea.spellcheck).toBe(true)
    expect(controller.updateContext({ offset: urlOffset }).reason).toBe('url')
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
    const projection = projectionFixture(source, documentIdentity)
    const controller = bindMarkdownWebLanguageTools(textarea, {
      anchorMap: anchorMapFixture(source, documentIdentity, projection),
      documentIdentity,
      projection,
      projectionRevision: 1,
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
        rawTargetRange: { direction: 'none', end: 7, start: 3 },
      }),
    ).toMatchObject({ handled: true, reason: 'stale-selection' })
  })

  it('enforces context and per-tool capability on direct and event commits', () => {
    const source = 'Hello wrld'
    const documentIdentity = { epoch: 1, id: 'capability-gate' }
    const textarea = {
      selectionDirection: 'none' as const,
      selectionEnd: 10,
      selectionStart: 6,
      spellcheck: true,
      value: source,
    }
    const projection = projectionFixture(source, documentIdentity)
    const controller = bindMarkdownWebLanguageTools(textarea, {
      anchorMap: anchorMapFixture(source, documentIdentity, projection),
      config: { nativeWritingTools: 'disabled' },
      documentIdentity,
      projection,
      projectionRevision: 1,
      revision: 1,
      source,
    })

    controller.createSession('spellcheck')
    controller.updateContext({ readonly: true })
    expect(controller.applyReplacement(6, 10, 'world')).toMatchObject({
      accepted: false,
      reason: 'readonly',
    })

    controller.updateContext({ isComposing: true })
    controller.createSession('dictation')
    expect(controller.applyReplacement(6, 10, 'world')).toMatchObject({
      accepted: false,
      reason: 'composition-active',
    })

    controller.updateContext({})
    controller.createSession('writing-tools')
    expect(
      controller.handleBeforeInput({
        data: 'world',
        inputType: 'insertReplacementText',
      }),
    ).toMatchObject({ handled: true, reason: 'disabled' })
  })

  it('does not equate raw offsets with visual offsets without the #325 map', () => {
    const source = '# Heading'
    const identity = { epoch: 1, id: 'coordinates' }
    const projection = projectionFixture(source, identity)
    const anchorMap = anchorMapFixture(source, identity, projection)
    const coordinates = resolveMarkdownWebLanguageCoordinates({
      anchorMap,
      documentIdentity: identity,
      offset: 0,
      projection,
      source,
    })
    expect(coordinates).toMatchObject({
      inMarker: true,
      rawOffset: 0,
      reason: 'hidden-marker',
      visualPoint: {
        hidden: true,
        kind: 'hidden',
        sourceOffset: 0,
      },
    })
  })

  it('routes the component replacement and does not expose a private textarea ref', async () => {
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
    expect(wrapper.emitted('update:modelValue')).toEqual([['Hello world']])
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


describe('markdown web language/search resource custody', () => {
  const fixture = () => {
    const source = 'apple banana apple'
    const documentIdentity = { epoch: 1, id: 'resource-doc' }
    const textarea = document.createElement('textarea')
    textarea.value = source
    const controller = bindMarkdownWebLanguageTools(textarea, {
      documentIdentity, revision: 1, source,
    })
    const input = {
      documentEpoch: 1, documentId: documentIdentity.id,
      queryText: 'apple', revision: 1, source,
    }
    return { controller, documentIdentity, input, textarea }
  }

  it('requires custody transfer and reports retained search records, not a worker', () => {
    const { controller, input } = fixture()
    expect(() => controller.executeSearch(input)).toThrow('owner-unbound')
    const previous = { cancelled: false, id: 'previous', query: 'banana' }
    const participant = controller.adoptSearchTask(previous)
    expect(previous.cancelled).toBe(true)
    expect(() => controller.adoptSearchTask(null)).toThrow('already-bound')
    expect(participant.inspect().usage).toEqual({
      editorInstances: 0, renderers: 0, observers: 0, timers: 0,
      backgroundTasks: 0, networkRequests: 0, memoryUnits: 2,
    })
    const search = controller.executeSearch(input)
    expect(search.execution.matches).toHaveLength(2)
    expect(participant.inspect()).toMatchObject({
      ownerRef: 'language-search', paused: false, recoverable: false,
      retainedListeners: 0, usage: { memoryUnits: 7, backgroundTasks: 0 },
    })
    controller.cancelSearch()
    expect(search.task.cancelled).toBe(true)
    expect(participant.inspect().usage.memoryUnits).toBe(2)
  })

  it('cancels real tasks and sessions, gates recreation, and rejects late native input', () => {
    const { controller, input, textarea } = fixture()
    const participant = controller.adoptSearchTask(null)
    const search = controller.executeSearch(input)
    controller.createSession()
    expect(participant.inspect().usage.memoryUnits).toBe(8)
    expect(participant.pause()).toMatchObject({ paused: true, retainedListeners: 0 })
    expect(search.task.cancelled).toBe(true)
    expect(controller.session).toBeNull()
    expect(textarea.spellcheck).toBe(false)
    expect(textarea.getAttribute('autocorrect')).toBe('off')
    expect(textarea.getAttribute('writingsuggestions')).toBe('false')
    expect(() => controller.createSession()).toThrow('paused')
    expect(() => controller.executeSearch(input)).toThrow('paused')
    controller.switchMode('source')
    controller.updateContext({})
    controller.updateState({ revision: 1, source: input.source })
    expect(textarea.spellcheck).toBe(false)
    expect(controller.handleBeforeInput({ inputType: 'insertReplacementText' }))
      .toMatchObject({ handled: true, reason: 'disabled' })
    expect(participant.resume()).toMatchObject({ paused: false, recoverable: false })
    expect(textarea.spellcheck).toBe(true)
    expect(controller.handleBeforeInput({ inputType: 'insertReplacementText' }))
      .toMatchObject({ handled: true, reason: 'session-required' })
    controller.createSession()
    expect(controller.session).not.toBeNull()
    expect(controller.executeSearch(input).task).not.toBe(search.task)
  })

  it('refuses stale identities and revisions and cancels searches on state replacement', () => {
    const { controller, documentIdentity, input } = fixture()
    const participant = controller.adoptSearchTask(null)
    const first = controller.executeSearch(input)
    const second = controller.executeSearch(input)
    expect(first.task.cancelled).toBe(true)
    expect(first.execution.requestId).not.toBe(second.execution.requestId)
    controller.updateState({ revision: 2, source: input.source })
    expect(second.task.cancelled).toBe(true)
    expect(participant.inspect().usage.memoryUnits).toBe(2)
    expect(() => controller.executeSearch(input)).toThrow('stale-document')
    documentIdentity.epoch = 2
    expect(() => controller.executeSearch({ ...input, revision: 2 })).toThrow('stale-document')
    expect(controller.executeSearch({ ...input, documentEpoch: 2, revision: 2 })
      .execution.matches[0]?.documentEpoch).toBe(2)
  })

  it('refuses composition pause and unrecoverable disposal without releasing custody', () => {
    const { controller, input, textarea } = fixture()
    const participant = controller.adoptSearchTask(null)
    const search = controller.executeSearch(input)
    controller.createSession()
    const session = controller.session
    const before = participant.inspect()
    controller.updateContext({ isComposing: true })
    expect(() => participant.pause()).toThrow('running')
    expect(participant.inspect()).toEqual(before)
    expect(search.task.cancelled).toBe(false)
    expect(controller.session).toBe(session)
    expect(textarea.spellcheck).toBe(true)
    controller.updateContext({})
    participant.pause()
    const paused = participant.inspect()
    expect(() => participant.dispose('retained-snapshot')).toThrow('not-recoverable')
    expect(participant.inspect()).toEqual(paused)
    expect(participant.resume().paused).toBe(false)
  })

  it('counts the executing task and refuses pause within the existing synchronous runner', () => {
    const { controller, input } = fixture()
    const participant = controller.adoptSearchTask(null)
    const budget = {
      maxConcurrent: 1, maxMatches: 100, maxMs: 500, maxRegexLength: 256,
      get maxSourceBytes() {
        expect(participant.inspect().usage.backgroundTasks).toBe(1)
        expect(() => participant.pause()).toThrow('running')
        return 400_000
      },
    }
    expect(controller.executeSearch({ ...input, budget }).execution.status).toBe('complete')
    expect(participant.inspect().usage.backgroundTasks).toBe(0)
  })

  it('rejects results cancelled during execution instead of storing a successful result', () => {
    const { controller, input } = fixture()
    const participant = controller.adoptSearchTask(null)
    const budget = {
      maxConcurrent: 1, maxMatches: 100, maxMs: 500, maxRegexLength: 256,
      get maxSourceBytes() { controller.cancelSearch(); return 400_000 },
    }
    expect(() => controller.executeSearch({ ...input, budget })).toThrow('stale-request')
    expect(participant.inspect().usage).toMatchObject({ backgroundTasks: 0, memoryUnits: 2 })
    expect(controller.executeSearch(input).execution.matches).toHaveLength(2)
  })
})
