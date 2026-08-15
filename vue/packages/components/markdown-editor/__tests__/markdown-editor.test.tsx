import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest'
import MarkdownEditor from '../src/markdown-editor.vue'
import {
  defaultMarkdownEditorCommands,
  markdownLiveCapabilities,
  resolveMarkdownLiveCapability,
  runMarkdownEditorCommand,
} from '../src/markdown-editor'
import type {
  MarkdownEditorInstance,
  MarkdownEditorProps,
  MarkdownEditorSelection,
  MarkdownEditorTransactionEvent,
} from '../src/markdown-editor'

describe('MarkdownEditor', () => {
  // Synthetic composition events in this suite are not native-IME evidence.
  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not expose the removed raw HTML preview prop', () => {
    const removedCapability = `allow${'Html'}` as const
    expectTypeOf<MarkdownEditorProps>().not.toHaveProperty(removedCapability)
  })

  it('runs built-in selection commands through the public context contract', async () => {
    const bold = defaultMarkdownEditorCommands.find(
      (item) => item.key === 'bold',
    )
    if (!bold) throw new Error('missing bold command')

    await expect(runMarkdownEditorCommand(bold, {
      dispatch: { dispatch: () => { throw new Error('not expected in command construction') } },
      documentIdentity: { epoch: 1, id: 'test-document' },
      mode: 'source',
      readonly: false,
      revision: 1,
      selection: { direction: 'forward', start: 5, end: 13 },
      signal: new AbortController().signal,
      syntax: { range: { start: 5, end: 13 }, type: 'paragraph' },
      value: 'edit markdown',
    })).resolves.toEqual({
      transaction: expect.objectContaining({
        expectedRevision: undefined,
        selection: { direction: 'forward', start: 7, end: 15 },
      }),
    })
  })

  it('emits value, mode, and command events', async () => {
    const wrapper = mount(MarkdownEditor, {
      props: {
        modelValue: 'initial',
      },
    })
    const textarea = wrapper.find('textarea')

    await textarea.setValue('updated')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['updated'])
    expect(wrapper.emitted('change')?.[0]).toEqual(['updated'])

    await wrapper.find('[role="tab"][aria-selected="false"]').trigger('click')
    expect(wrapper.emitted('mode-change')).toBeTruthy()

    await wrapper.find('.el-markdown-editor__command').trigger('click')
    expect(wrapper.emitted('command')?.[0]?.[0]).toEqual(
      expect.objectContaining({ key: 'bold' }),
    )
  })

  it('keeps secondary commands inside an expandable overflow menu', async () => {
    const wrapper = mount(MarkdownEditor, {
      props: {
        modelValue: 'initial',
      },
    })

    const more = wrapper.find('.el-markdown-editor__command-more')
    expect(more.exists()).toBe(true)
    expect(more.attributes('aria-expanded')).toBe('false')
    expect(wrapper.find('.el-markdown-editor__command-tray').exists()).toBe(
      false,
    )

    await more.trigger('click')
    expect(more.attributes('aria-expanded')).toBe('true')
    expect(
      wrapper
        .find('.el-markdown-editor__command-tray')
        .findAll('.el-markdown-editor__command'),
    ).toHaveLength(1)

    await wrapper
      .find('.el-markdown-editor__command-tray .el-markdown-editor__command')
      .trigger('click')
    expect(wrapper.emitted('command')?.[0]?.[0]).toEqual(
      expect.objectContaining({ key: 'image' }),
    )
    expect(wrapper.find('.el-markdown-editor__command-tray').exists()).toBe(
      false,
    )
  })

  it('lets consumers choose primary commands and compact mobile behavior', async () => {
    const wrapper = mount(MarkdownEditor, {
      props: {
        commandOverflowLabel: '更多格式',
        defaultMode: 'split',
        mobileLayout: 'compact',
        modelValue: 'initial',
        primaryCommandKeys: ['heading', 'link'],
      },
    })

    expect(wrapper.classes()).toContain('el-markdown-editor--mobile-compact')
    expect(wrapper.classes()).toContain('el-markdown-editor--source')
    expect(
      wrapper
        .findAll('.el-markdown-editor__commands > .el-markdown-editor__command')
        .map((item) => item.text()),
    ).toEqual(['H', 'Link'])

    const more = wrapper.find('.el-markdown-editor__command-more')
    expect(more.text()).toContain('更多格式')
    expect(more.text()).toContain('5')
    expect(more.attributes('aria-label')).toContain('更多格式')
    expect(
      wrapper.findAll('.el-markdown-editor__mode').map((item) => item.text()),
    ).toEqual(['源码', '预览'])

    await more.trigger('click')
    const tray = wrapper.find('.el-markdown-editor__command-tray')
    expect(more.attributes('aria-controls')).toBe(tray.attributes('id'))
    expect(tray.findAll('.el-markdown-editor__command')).toHaveLength(5)
  })

  it('can move selected actions into the command overflow tray', async () => {
    const wrapper = mount(MarkdownEditor, {
      props: {
        actionOverflowKeys: ['image'],
        modelValue: 'draft',
        showSaveAction: false,
        showSubmitAction: false,
      },
    })

    expect(wrapper.find('.el-markdown-editor__actions').exists()).toBe(false)

    const more = wrapper.find('.el-markdown-editor__command-more')
    expect(more.exists()).toBe(true)
    expect(more.text()).toContain('2')

    await more.trigger('click')
    const trayButtons = wrapper
      .find('.el-markdown-editor__command-tray')
      .findAll('.el-markdown-editor__command')
    expect(trayButtons.map((button) => button.text())).toContain('上传图片')

    const uploadButton = trayButtons.find(
      (button) => button.text() === '上传图片',
    )
    if (!uploadButton) throw new Error('missing upload action in command tray')

    await uploadButton.trigger('click')
    expect(wrapper.emitted('upload-image')).toHaveLength(1)
    expect(wrapper.find('.el-markdown-editor__command-tray').exists()).toBe(
      false,
    )
  })

  it('exposes prose writing and interaction profiles without changing legacy defaults', () => {
    const defaultWrapper = mount(MarkdownEditor, {
      props: {
        modelValue: '',
      },
    })

    expect(defaultWrapper.classes()).toContain(
      'el-markdown-editor--profile-markdown',
    )
    expect(defaultWrapper.classes()).toContain(
      'el-markdown-editor--interaction-auto',
    )

    const proseWrapper = mount(MarkdownEditor, {
      props: {
        editorProfile: 'prose',
        interactionProfile: 'touch',
        modelValue: '',
        placeholder: 'fallback placeholder',
        writingPlaceholder: '写下正文，慢慢展开。',
      },
    })

    expect(proseWrapper.classes()).toContain(
      'el-markdown-editor--profile-prose',
    )
    expect(proseWrapper.classes()).toContain(
      'el-markdown-editor--interaction-touch',
    )
    expect(proseWrapper.find('textarea').attributes('placeholder')).toBe(
      '写下正文，慢慢展开。',
    )
  })

  it('continues and exits markdown structures from the keyboard', async () => {
    const wrapper = mount(MarkdownEditor, {
      props: {
        editorProfile: 'prose',
        modelValue: '- 第一段',
      },
    })
    const textarea = wrapper.find('textarea')

    const listLineEnd = '- 第一段'.length
    ;(textarea.element as HTMLTextAreaElement).setSelectionRange(
      listLineEnd,
      listLineEnd,
    )
    await textarea.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['- 第一段\n- '])

    await wrapper.setProps({ modelValue: '- ' })
    ;(textarea.element as HTMLTextAreaElement).setSelectionRange(2, 2)
    await textarea.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('update:modelValue')?.[1]).toEqual([''])
  })

  it('indents and outdents selected lines from the keyboard', async () => {
    const wrapper = mount(MarkdownEditor, {
      props: {
        editorProfile: 'prose',
        interactionProfile: 'keyboard',
        modelValue: '第一行\n第二行',
      },
    })
    const textarea = wrapper.find('textarea')

    ;(textarea.element as HTMLTextAreaElement).setSelectionRange(0, 7)
    await textarea.trigger('keydown', { key: 'Tab' })
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([
      '  第一行\n  第二行',
    ])

    await wrapper.setProps({ modelValue: '  第一行\n  第二行' })
    ;(textarea.element as HTMLTextAreaElement).setSelectionRange(0, 11)
    await textarea.trigger('keydown', { key: 'Tab', shiftKey: true })
    expect(wrapper.emitted('update:modelValue')?.[1]).toEqual([
      '第一行\n第二行',
    ])
  })

  it('exposes save, submit, upload, and preview shell events', async () => {
    const wrapper = mount(MarkdownEditor, {
      props: {
        defaultMode: 'preview',
        modelValue: '# Preview',
      },
      global: {
        stubs: {
          ElMarkdownRenderer: {
            emits: ['features-activated', 'render-complete', 'render-error'],
            template:
              '<div data-stub-markdown-renderer @click="$emit(\'render-complete\', { html: content })"></div>',
            props: ['content'],
          },
        },
      },
    })

    await wrapper.find('[data-stub-markdown-renderer]').trigger('click')
    expect(wrapper.find('[data-stub-markdown-renderer]').classes()).toContain(
      'el-markdown-editor__preview',
    )
    expect(
      wrapper.findAll('.el-markdown-editor__action').map((item) => item.text()),
    ).toEqual(['上传图片', '保存', '提交'])
    await wrapper.findAll('.el-markdown-editor__action')[0].trigger('click')
    await wrapper.findAll('.el-markdown-editor__action')[1].trigger('click')
    await wrapper.findAll('.el-markdown-editor__action')[2].trigger('click')

    expect(wrapper.emitted('render-complete')?.[0]?.[0]).toEqual({
      html: '# Preview',
    })
    expect(wrapper.emitted('upload-image')).toHaveLength(1)
    expect(wrapper.emitted('save')?.[0]).toEqual(['# Preview'])
    expect(wrapper.emitted('submit')?.[0]).toEqual(['# Preview'])
  })

  it('supports controlled mode, action visibility, disabled state, and cursor insertion', async () => {
    const wrapper = mount(MarkdownEditor, {
      props: {
        disabled: true,
        mode: 'preview',
        modelValue: 'initial',
        showActions: false,
        showModeSwitcher: false,
        textareaId: 'markdown-body',
        textareaName: 'body',
      },
      global: {
        stubs: {
          ElMarkdownRenderer: {
            template: '<div data-stub-markdown-renderer></div>',
            props: ['content'],
          },
        },
      },
    })

    expect(wrapper.find('.el-markdown-editor--preview').exists()).toBe(true)
    expect(wrapper.find('.el-markdown-editor__actions').exists()).toBe(false)
    expect(wrapper.find('.el-markdown-editor__modes').exists()).toBe(false)

    await wrapper.setProps({ mode: 'source' })
    const textarea = wrapper.find('textarea')
    expect(textarea.attributes('id')).toBe('markdown-body')
    expect(textarea.attributes('name')).toBe('body')
    expect(textarea.attributes('disabled')).toBeDefined()
    expect(wrapper.vm.insertMarkdownAtCursor(' ignored')).toBe(false)

    await wrapper.setProps({ disabled: false })
    ;(textarea.element as HTMLTextAreaElement).setSelectionRange(7, 7)
    expect(wrapper.vm.insertMarkdownAtCursor(' text') === true).toBe(true)
    expect(wrapper.emitted('transaction')?.at(-1)?.[0]).toMatchObject({
      accepted: true,
      revision: 1,
      value: 'initial text',
    })
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['initial text'])
  })

  it('exposes revision-checked programmatic transactions with independent undo units', async () => {
    const wrapper = mount(MarkdownEditor, {
      props: {
        modelValue: '',
      },
    })
    const textarea = wrapper.find('textarea')
    ;(textarea.element as HTMLTextAreaElement).setSelectionRange(0, 0)

    const placeholder = wrapper.vm.dispatchTransaction({
      changes: [{ from: 0, insert: '![uploading]', to: 0 }],
      expectedRevision: 0,
      history: 'separate',
      metadata: { operation: 'placeholder' },
      origin: 'programmatic',
      selection: { start: 12, end: 12 },
    })
    expect(placeholder).toMatchObject({
      accepted: true,
      revision: 1,
      value: '![uploading]',
    })

    const replacement = wrapper.vm.dispatchTransaction({
      changes: [{ from: 0, insert: '![image](asset.png)', to: 12 }],
      expectedRevision: placeholder.revision,
      history: 'separate',
      metadata: { operation: 'async-replacement' },
      origin: 'programmatic',
      selection: { direction: 'none', start: 19, end: 19 },
    })
    expect(replacement).toMatchObject({
      accepted: true,
      revision: 2,
      value: '![image](asset.png)',
    })

    const stale = wrapper.vm.dispatchTransaction({
      changes: [{ from: 0, insert: 'stale', to: 0 }],
      expectedRevision: placeholder.revision,
      history: 'separate',
      origin: 'programmatic',
      selection: { direction: 'none', start: 5, end: 5 },
    })
    expect(stale).toMatchObject({
      accepted: false,
      reason: 'stale-revision',
      revision: 2,
      value: '![image](asset.png)',
    })

    expect(wrapper.vm.undo()).toMatchObject({
      accepted: true,
      value: '![uploading]',
    })
    expect(wrapper.vm.undo()).toMatchObject({ accepted: true, value: '' })
    expect(wrapper.vm.redo()).toMatchObject({
      accepted: true,
      value: '![uploading]',
    })

    expect(
      wrapper.emitted('transaction')?.map(([rawEvent]) => {
        const event = rawEvent as MarkdownEditorTransactionEvent
        return {
          accepted: event.accepted,
          origin: event.transaction.origin,
          reason: event.reason,
        }
      }),
    ).toEqual(
      expect.arrayContaining([
        { accepted: true, origin: 'programmatic', reason: undefined },
        {
          accepted: false,
          origin: 'programmatic',
          reason: 'stale-revision',
        },
      ]),
    )
  })

  it('treats parent echo as confirmation and a different prop as a hard reset', async () => {
    const wrapper = mount(MarkdownEditor, {
      props: {
        modelValue: 'A',
      },
    })
    const textarea = wrapper.find('textarea')
    ;(textarea.element as HTMLTextAreaElement).setSelectionRange(1, 1)

    const inserted = wrapper.vm.insertMarkdownAtCursor('B')
    expect(inserted).toBe(true)
    expect(wrapper.emitted('transaction')?.at(-1)?.[0]).toMatchObject({
      revision: 1,
      value: 'AB',
    })
    const transactionCount = wrapper.emitted('transaction')?.length

    await wrapper.setProps({ modelValue: 'AB' })
    expect(wrapper.emitted('transaction')).toHaveLength(transactionCount ?? 0)

    await wrapper.setProps({ modelValue: '外部重置' })
    expect(wrapper.find('textarea').element.value).toBe('外部重置')
    expect(wrapper.emitted('transaction')?.at(-1)?.[0]).toMatchObject({
      accepted: true,
      history: { canRedo: false, canUndo: false },
      transaction: { origin: 'external' },
      value: '外部重置',
    })
    expect(wrapper.vm.undo()).toMatchObject({
      accepted: false,
      reason: 'no-history',
      value: '外部重置',
    })
  })

  it('keeps public external transactions synchronized through v-model', async () => {
    const wrapper = mount(MarkdownEditor, {
      props: {
        modelValue: 'server',
      },
    })

    expect(
      wrapper.vm.dispatchTransaction({
        changes: [{ from: 0, insert: 'client', to: 6 }],
        history: 'skip',
        origin: 'external',
        selection: { direction: 'none', start: 6, end: 6 },
      }),
    ).toMatchObject({
      accepted: true,
      value: 'client',
    })
    expect(wrapper.emitted('update:modelValue')).toEqual([['client']])
    await nextTick()
    expect(wrapper.find('textarea').element.value).toBe('client')
  })

  it('rejects public external transactions during composition', async () => {
    const wrapper = mount(MarkdownEditor, {
      props: {
        modelValue: 'server',
      },
    })
    const element = wrapper.find('textarea').element as HTMLTextAreaElement

    element.dispatchEvent(
      new CompositionEvent('compositionstart', { bubbles: true }),
    )

    expect(
      wrapper.vm.dispatchTransaction({
        changes: [{ from: 0, insert: 'client', to: 6 }],
        history: 'skip',
        origin: 'external',
        selection: { direction: 'none', start: 6, end: 6 },
      }),
    ).toMatchObject({
      accepted: false,
      reason: 'composition-active',
      value: 'server',
    })
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('does not revive invalidated IME text after a parent hard reset', async () => {
    const wrapper = mount(MarkdownEditor, {
      props: {
        modelValue: 'server-before',
      },
    })
    const element = wrapper.find('textarea').element as HTMLTextAreaElement

    element.dispatchEvent(
      new CompositionEvent('compositionstart', { bubbles: true }),
    )
    element.value = '作成中'
    element.dispatchEvent(
      new InputEvent('input', {
        bubbles: true,
        data: '作成中',
        inputType: 'insertCompositionText',
        isComposing: true,
      }),
    )

    await wrapper.setProps({ modelValue: 'server-after' })
    expect(element.value).toBe('server-after')
    const resetTransactionCount = wrapper.emitted('transaction')?.length

    element.value = '作成中'
    element.dispatchEvent(
      new CompositionEvent('compositionend', {
        bubbles: true,
        data: '作成中',
      }),
    )
    element.dispatchEvent(
      new InputEvent('beforeinput', {
        bubbles: true,
        data: '旧',
        inputType: 'insertText',
      }),
    )
    element.value = '作成中旧'
    element.dispatchEvent(
      new InputEvent('input', {
        bubbles: true,
        data: '旧',
        inputType: 'insertText',
      }),
    )
    await nextTick()

    expect(element.value).toBe('server-after')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(wrapper.emitted('transaction')).toHaveLength(
      resetTransactionCount ?? 0,
    )
  })

  it('recovers ordinary input when a hard reset receives no compositionend', async () => {
    vi.useFakeTimers()
    const wrapper = mount(MarkdownEditor, {
      props: {
        modelValue: 'server-before',
      },
    })
    const element = wrapper.find('textarea').element as HTMLTextAreaElement

    element.dispatchEvent(
      new CompositionEvent('compositionstart', { bubbles: true }),
    )
    element.value = '未確定'
    await wrapper.setProps({ modelValue: 'server-after' })

    await vi.runOnlyPendingTimersAsync()
    element.value = '未確定'
    element.dispatchEvent(
      new InputEvent('beforeinput', {
        bubbles: true,
        cancelable: true,
        data: '未確定',
        inputType: 'insertCompositionText',
        isComposing: true,
      }),
    )
    element.dispatchEvent(
      new InputEvent('input', {
        bubbles: true,
        data: '未確定',
        inputType: 'insertCompositionText',
        isComposing: true,
      }),
    )
    await nextTick()

    expect(element.value).toBe('server-after')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()

    element.dispatchEvent(
      new InputEvent('beforeinput', {
        bubbles: true,
        cancelable: true,
        data: '!',
        inputType: 'insertText',
      }),
    )
    element.value = 'server-after!'
    element.setSelectionRange(element.value.length, element.value.length)
    element.dispatchEvent(
      new InputEvent('input', {
        bubbles: true,
        data: '!',
        inputType: 'insertText',
      }),
    )
    await nextTick()

    expect(wrapper.emitted('update:modelValue')).toEqual([['server-after!']])
    expect(element.value).toBe('server-after!')
  })

  it.each(['简体中文', '繁體中文', '日本語', '한국어'])(
    'commits %s composition once and freezes commands during composition',
    async (composed) => {
      const wrapper = mount(MarkdownEditor, {
        props: {
          modelValue: '',
        },
      })
      const textarea = wrapper.find('textarea')
      const element = textarea.element as HTMLTextAreaElement

      element.dispatchEvent(
        new CompositionEvent('compositionstart', { bubbles: true }),
      )
      await nextTick()
      await wrapper.find('.el-markdown-editor__command').trigger('click')
      expect(wrapper.emitted('command')).toBeUndefined()

      element.value = composed
      element.setSelectionRange(composed.length, composed.length)
      element.dispatchEvent(
        new InputEvent('input', {
          bubbles: true,
          data: composed,
          inputType: 'insertCompositionText',
          isComposing: true,
        }),
      )
      await nextTick()
      expect(wrapper.emitted('update:modelValue')).toBeUndefined()

      element.dispatchEvent(
        new CompositionEvent('compositionend', {
          bubbles: true,
          data: composed,
        }),
      )
      await nextTick()
      expect(wrapper.emitted('update:modelValue')).toEqual([[composed]])
      expect(wrapper.emitted('history-change')?.at(-1)?.[0]).toMatchObject({
        undoDepth: 1,
      })
      expect(wrapper.emitted('transaction')?.at(-1)?.[0]).toMatchObject({
        accepted: true,
        transaction: {
          history: 'separate',
          metadata: { composition: true },
          origin: 'input',
        },
      })
    },
  )

  it('keeps native post-composition insertText commits separate from following input', async () => {
    const wrapper = mount(MarkdownEditor, {
      props: {
        modelValue: '',
      },
    })
    const element = wrapper.find('textarea').element as HTMLTextAreaElement

    const commitNativeComposition = (committed: string) => {
      element.dispatchEvent(
        new CompositionEvent('compositionstart', { bubbles: true }),
      )
      element.setSelectionRange(element.value.length, element.value.length)
      element.dispatchEvent(
        new CompositionEvent('compositionend', {
          bubbles: true,
          data: '',
        }),
      )
      element.dispatchEvent(
        new InputEvent('beforeinput', {
          bubbles: true,
          data: committed,
          inputType: 'insertText',
        }),
      )
      element.value += committed
      element.setSelectionRange(element.value.length, element.value.length)
      element.dispatchEvent(
        new InputEvent('input', {
          bubbles: true,
          data: committed,
          inputType: 'insertText',
        }),
      )
    }

    commitNativeComposition('한')
    commitNativeComposition('글')
    element.dispatchEvent(
      new InputEvent('beforeinput', {
        bubbles: true,
        inputType: 'insertLineBreak',
      }),
    )
    element.value += '\n'
    element.setSelectionRange(element.value.length, element.value.length)
    element.dispatchEvent(
      new InputEvent('input', {
        bubbles: true,
        inputType: 'insertLineBreak',
      }),
    )
    await nextTick()

    expect(wrapper.vm.undo()).toMatchObject({ value: '한글' })
    expect(wrapper.vm.undo()).toMatchObject({ value: '한' })
    expect(wrapper.vm.undo()).toMatchObject({ value: '' })
  })

  it('routes beforeinput/input paste and drop through separate dispatcher transactions', async () => {
    const wrapper = mount(MarkdownEditor, {
      props: {
        modelValue: '',
      },
    })
    const element = wrapper.find('textarea').element as HTMLTextAreaElement

    const nativeInput = async (
      value: string,
      inputType: 'insertFromDrop' | 'insertFromPaste',
    ) => {
      element.setSelectionRange(element.value.length, element.value.length)
      element.dispatchEvent(
        new InputEvent('beforeinput', {
          bubbles: true,
          data: value,
          inputType,
        }),
      )
      element.value += value
      element.setSelectionRange(element.value.length, element.value.length)
      element.dispatchEvent(
        new InputEvent('input', {
          bubbles: true,
          data: value,
          inputType,
        }),
      )
      await nextTick()
    }

    await nativeInput('粘贴', 'insertFromPaste')
    await nativeInput('拖放', 'insertFromDrop')

    expect(
      wrapper
        .emitted('transaction')
        ?.map(([event]) => event as MarkdownEditorTransactionEvent)
        .filter((event) => event.accepted)
        .map((event) => event.transaction.origin),
    ).toEqual(['paste', 'drop'])
    expect(wrapper.emitted('history-change')?.at(-1)?.[0]).toMatchObject({
      undoDepth: 2,
    })
    expect(wrapper.vm.undo()).toMatchObject({ value: '粘贴' })
  })

  it('pastes mixed MIME once as plain text and ignores the follow-up input event', async () => {
    const wrapper = mount(MarkdownEditor, {
      props: {
        modelValue: '',
      },
    })
    const element = wrapper.find('textarea').element as HTMLTextAreaElement
    const paste = new Event('paste', { bubbles: true, cancelable: true })
    Object.defineProperty(paste, 'clipboardData', {
      value: {
        files: [],
        getData: (type: string) =>
          type === 'text/html' ? '<b>HTML</b>' : 'plain',
        types: ['text/html', 'text/plain'],
      },
    })
    element.dispatchEvent(paste)
    await nextTick()

    element.value += 'plain'
    element.setSelectionRange(element.value.length, element.value.length)
    element.dispatchEvent(
      new InputEvent('input', {
        bubbles: true,
        data: 'plain',
        inputType: 'insertFromPaste',
      }),
    )
    await nextTick()

    const accepted = wrapper
      .emitted('transaction')
      ?.map(([event]) => event as MarkdownEditorTransactionEvent)
      .filter((event) => event.accepted)
    expect(accepted?.map((event) => event.value)).toEqual(['plain'])
    expect(accepted?.map((event) => event.transaction.origin)).toEqual(['paste'])
  })

  it('rejects public mutations while loading without changing the optimistic value', async () => {
    const wrapper = mount(MarkdownEditor, {
      props: {
        loading: true,
        modelValue: 'draft',
      },
    })
    expect(wrapper.find('textarea').attributes('aria-busy')).toBe('true')
    expect(
      wrapper.vm.dispatchTransaction({
        changes: [{ from: 5, insert: '!', to: 5 }],
        history: 'separate',
        origin: 'programmatic',
        selection: { direction: 'none', start: 6, end: 6 },
      }),
    ).toMatchObject({
      accepted: false,
      reason: 'disabled',
      value: 'draft',
    })
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()

    await wrapper.setProps({ loading: false })
    expect(wrapper.find('textarea').attributes('aria-busy')).toBeUndefined()
  })

  it.each(['framed', 'embedded', 'minimal'] as const)(
    'keeps a single semantic editor shell when chrome is %s',
    async (chrome) => {
      const wrapper = mount(MarkdownEditor, {
        props: {
          chrome,
          modelValue: '# Contract',
        },
        global: {
          stubs: {
            ElMarkdownRenderer: {
              props: ['content'],
              template: '<div data-stub-markdown-renderer />',
            },
          },
        },
      })

      expect(wrapper.classes()).toContain(`el-markdown-editor--chrome-${chrome}`)
      expect(wrapper.findAll('[role="region"]')).toHaveLength(1)
      expect(wrapper.find('[aria-label="Markdown editor"]').exists()).toBe(true)

      if (chrome === 'minimal') {
        expect(wrapper.find('.el-markdown-editor__toolbar').exists()).toBe(false)
        expect(wrapper.find('.el-markdown-editor__status').exists()).toBe(false)
      }

      if (chrome === 'embedded') {
        expect(wrapper.classes()).not.toContain('el-markdown-editor--surface-card')
      }
    },
  )

  it.each(['source', 'live', 'split', 'preview'] as const)(
    'preserves the root, accessible name, and active region across %s mode',
    async (mode) => {
      const wrapper = mount(MarkdownEditor, {
        props: {
          chrome: 'embedded',
          mode,
          modelValue: '# Contract',
        },
        global: {
          stubs: {
            ElMarkdownRenderer: {
              props: ['content'],
              template: '<div data-stub-markdown-renderer />',
            },
          },
        },
      })

      const root = wrapper.element
      expect(wrapper.classes()).toContain(`el-markdown-editor--${mode}`)
      expect(wrapper.find('[aria-label="Markdown editor"]').exists()).toBe(true)

      await wrapper.setProps({ chrome: 'minimal' })
      expect(wrapper.element).toBe(root)
      expect(wrapper.find('[aria-label="Markdown editor"]').exists()).toBe(true)

      const textarea = wrapper.find('textarea')
      expect(textarea.exists()).toBe(true)
      if (mode === 'preview') {
        expect(textarea.isVisible()).toBe(false)
        expect(wrapper.find('[data-stub-markdown-renderer]').exists()).toBe(true)
      } else {
        expect(textarea.isVisible()).toBe(true)
        expect(wrapper.find('[data-stub-markdown-renderer]').exists()).toBe(
          mode === 'split',
        )
      }
    },
  )

  it('keeps one textarea owner across source/live/split/preview without rebuilding history', async () => {
    const wrapper = mount(MarkdownEditor, {
      props: {
        mode: 'source',
        modelValue: '# Stable',
      },
      global: {
        stubs: {
          ElMarkdownRenderer: {
            template: '<div data-stub-markdown-renderer />',
          },
        },
      },
    })
    const textarea = wrapper.find('textarea').element as HTMLTextAreaElement
    textarea.setSelectionRange(2, 8)
    wrapper.vm.dispatchTransaction({
      changes: [{ from: 8, insert: '!', to: 8 }],
      history: 'separate',
      origin: 'input',
      selection: { direction: 'forward', end: 9, start: 2 },
    })
    const revision = wrapper.vm.undo().revision
    wrapper.vm.redo()

    for (const mode of ['live', 'split', 'preview', 'source'] as const) {
      await wrapper.setProps({ mode })
      expect(wrapper.find('textarea').element).toBe(textarea)
      expect(wrapper.find('[data-markdown-surface-owner]').attributes(
        'data-markdown-surface-owner',
      )).toBe('source-textarea')
    }

    expect(wrapper.vm.undo()).toMatchObject({
      accepted: true,
      value: '# Stable',
    })
    expect(revision).toBeGreaterThan(0)
    expect(wrapper.find('[data-markdown-live-decorations]').exists()).toBe(false)
    await wrapper.setProps({ mode: 'live' })
    expect(wrapper.find('[data-stub-markdown-renderer]').exists()).toBe(false)
    expect(wrapper.find('textarea').isVisible()).toBe(true)
  })

  it('reveals live markers from the caret and hides them on Escape without editing source', async () => {
    const wrapper = mount(MarkdownEditor, {
      props: {
        mode: 'live',
        modelValue: 'intro ***nested*** tail',
      },
    })
    const textarea = wrapper.find('textarea')
    const element = textarea.element as HTMLTextAreaElement
    const caret = 'intro ***nested*** tail'.indexOf('nested')
    element.setSelectionRange(caret, caret)
    await textarea.trigger('select')
    expect(wrapper.find('[data-markdown-reveal-state]').attributes(
      'data-markdown-reveal-state',
    )).toBe('caret-inside')
    const before = wrapper.emitted('update:modelValue')?.length ?? 0
    await textarea.trigger('keydown', { key: 'Escape' })
    expect(wrapper.find('[data-markdown-reveal-state]').attributes(
      'data-markdown-reveal-state',
    )).toBe('inactive')
    expect(wrapper.emitted('update:modelValue')?.length ?? 0).toBe(before)
    expect(element.value).toBe('intro ***nested*** tail')
  })

  it('snaps live caret around atomic images and deletes them through the shared primitive', async () => {
    const wrapper = mount(MarkdownEditor, {
      props: {
        mode: 'live',
        modelValue: 'go ![alt](img.png) on',
      },
    })
    const textarea = wrapper.find('textarea')
    const element = textarea.element as HTMLTextAreaElement
    const image = 'go ![alt](img.png) on'.indexOf('!')
    element.setSelectionRange(image, image)
    await textarea.trigger('keydown', { key: 'ArrowRight' })
    expect(element.selectionStart).toBe('go ![alt](img.png)'.length)
    expect(wrapper.find('[data-markdown-atomic-kind]').attributes(
      'data-markdown-atomic-kind',
    )).toBe('image')
    await textarea.trigger('keydown', { key: 'Backspace' })
    expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toBe('go  on')
  })

  it('keeps selection direction when switching live to source', async () => {
    const wrapper = mount(MarkdownEditor, {
      props: {
        mode: 'live',
        modelValue: 'keep this range',
      },
    })
    const textarea = wrapper.find('textarea')
    const element = textarea.element as HTMLTextAreaElement
    element.setSelectionRange(0, 4, 'forward')
    await textarea.trigger('select')
    const sourceTab = wrapper
      .findAll('[role="tab"]')
      .find((button) => button.text() === '源码')
    expect(sourceTab).toBeTruthy()
    await sourceTab!.trigger('click')
    await nextTick()
    expect(element.selectionStart).toBe(0)
    expect(element.selectionEnd).toBe(4)
    expect(element.selectionDirection).toBe('forward')
  })

  it('keeps the editable surface and its selection when chrome changes', async () => {
    const wrapper = mount(MarkdownEditor, {
      props: {
        chrome: 'framed',
        mode: 'source',
        modelValue: '# Stable document',
      },
    })
    const root = wrapper.element
    const textarea = wrapper.find('textarea').element as HTMLTextAreaElement
    textarea.setSelectionRange(2, 8)

    await wrapper.setProps({ chrome: 'embedded' })
    expect(wrapper.element).toBe(root)
    expect(wrapper.find('textarea').element).toBe(textarea)
    expect(textarea.selectionStart).toBe(2)
    expect(textarea.selectionEnd).toBe(8)

    await wrapper.setProps({ chrome: 'minimal' })
    expect(wrapper.element).toBe(root)
    expect(wrapper.find('textarea').element).toBe(textarea)
    expect(wrapper.find('.el-markdown-editor__toolbar').exists()).toBe(false)
    expect(wrapper.find('.el-markdown-editor__status').exists()).toBe(false)
  })

  it.each(['embedded', 'minimal'] as const)(
    'keeps focus semantics without a framed root when chrome is %s',
    (chrome) => {
      const wrapper = mount(MarkdownEditor, {
        props: { chrome, modelValue: 'focus contract' },
      })

      expect(wrapper.find('[aria-label="Markdown editor"]').exists()).toBe(true)
      expect(wrapper.find('textarea').attributes('aria-label')).toBeTruthy()
      expect(wrapper.classes()).not.toContain('el-markdown-editor--surface-card')
    },
  )
})

describe('MarkdownEditor command contract migration', () => {
  it('does not retain the legacy apply(value, selection) command execution path', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'vue/packages/components/markdown-editor/src/markdown-editor.ts'),
      'utf8',
    )

    expect(source).not.toMatch(/\bapply\s*\(\s*value\s*,\s*selection\s*\)/)
    expect(source).toMatch(/\brun\s*:/)
  })

  it('removes the write mode alias from the public component contract', () => {
    const component = readFileSync(
      resolve(process.cwd(), 'vue/packages/components/markdown-editor/src/markdown-editor.vue'),
      'utf8',
    )
    const model = readFileSync(
      resolve(process.cwd(), 'vue/packages/components/markdown-editor/src/markdown-editor.ts'),
      'utf8',
    )
    const liveContract = readFileSync(
      resolve(
        process.cwd(),
        'vue/packages/components/markdown-editor/src/markdown-editor-live-contract.ts',
      ),
      'utf8',
    )

    expect(component).not.toMatch(/mode-write|--write|is-write/)
    expect(model).not.toMatch(/['\"]write['\"]/)
    expect(liveContract).not.toMatch(/['\"]write['\"]/)
    expect(liveContract).toMatch(/['\"]source['\"]\s*\|\s*['\"]live['\"]\s*\|\s*['\"]split['\"]\s*\|\s*['\"]preview['\"]/)
  })

  it('resolves only the six frozen live capability tokens with document identity', () => {
    expect([...markdownLiveCapabilities]).toEqual([
      'supported',
      'unsupported-platform',
      'runtime-unavailable',
      'projection-failed',
      'feature-degraded',
      'fatal',
    ])

    const identity = { epoch: 2, id: 'doc-a' }
    const supported = resolveMarkdownLiveCapability('supported', {
      documentIdentity: identity,
      revision: 4,
    })
    expect(supported.capability).toBe('supported')
    expect(supported.documentIdentity).toEqual(identity)
    expect(supported.revision).toBe(4)

    expect(() =>
      resolveMarkdownLiveCapability('write', {
        documentIdentity: identity,
        revision: 4,
      }),
    ).toThrow(/unknown markdown live capability token/i)

    expect(() =>
      resolveMarkdownLiveCapability('supported', {
        documentIdentity: { epoch: 1, id: '' },
        revision: 4,
      }),
    ).toThrow(/missing identity/i)
  })
})
