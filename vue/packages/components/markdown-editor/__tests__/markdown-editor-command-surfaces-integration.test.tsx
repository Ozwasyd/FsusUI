import { flushPromises, mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { describe, expect, it } from 'vitest'
import MarkdownEditor from '../src/markdown-editor.vue'
import { getMarkdownXssSourceUrl } from '../../../../tests/support/markdown-xss-corpus'

import type {
  MarkdownEditorCommand,
  MarkdownEditorMode,
} from '../src/markdown-editor'

const insertCommand: MarkdownEditorCommand = {
  group: 'insert',
  key: 'insert-token',
  keywords: ['token-alias'],
  label: 'Insert token',
  presentation: ['palette', 'selection', 'slash'],
  run: (context) => ({
    transaction: {
      changes: [
        {
          from: context.selection.start,
          insert: 'TOKEN',
          to: context.selection.end,
        },
      ],
      history: 'separate',
      origin: 'command',
    },
  }),
}

describe('Markdown editor command surface integration', () => {
  const selectRange = async (
    wrapper: ReturnType<typeof mount>,
    start: number,
    end: number,
  ) => {
    const textarea = wrapper.find('textarea')
    ;(textarea.element as HTMLTextAreaElement).setSelectionRange(start, end)
    await textarea.trigger('select')
    await nextTick()
  }

  it('commits a slash command and removes its trigger in one revision', async () => {
    const wrapper = mount(MarkdownEditor, {
      props: {
        commands: [insertCommand],
        modelValue: '/insert',
        surfaces: { slashMenu: true },
      },
    })

    await wrapper
      .find('.el-markdown-editor__slash-menu button')
      .trigger('click')
    await flushPromises()

    expect(
      wrapper.emitted('update:modelValue')?.map(([value]) => value),
    ).toEqual(['TOKEN'])
    expect(wrapper.emitted('command')).toHaveLength(1)
  })

  it('rebases an async command result through intervening editor transactions', async () => {
    let resolveCommand: (
      result: Awaited<ReturnType<NonNullable<MarkdownEditorCommand['run']>>>,
    ) => void = () => undefined
    const asyncCommand: MarkdownEditorCommand = {
      group: 'format',
      key: 'async-replace',
      label: 'Async replace',
      presentation: ['selection'],
      run: (context) =>
        new Promise((resolve) => {
          resolveCommand = resolve
        }).then(() => ({
          transaction: {
            changes: [
              {
                from: context.selection.start,
                insert: 'DONE',
                to: context.selection.end,
              },
            ],
            history: 'separate',
            origin: 'command',
          },
        })),
    }
    const wrapper = mount(MarkdownEditor, {
      props: {
        commands: [asyncCommand],
        documentIdentity: { epoch: 1, id: 'async-document' },
        modelValue: '[Docs](https://safe.test)',
        surfaces: { selectionToolbar: true },
      },
    })
    await selectRange(wrapper, 1, 5)
    await wrapper
      .get('.el-markdown-editor__selection-toolbar button')
      .trigger('click')
    const dispatch = (
      wrapper.vm as unknown as {
        dispatchTransaction: (transaction: {
          changes: { from: number; insert: string; to: number }[]
          history: 'separate'
          origin: 'input'
        }) => { accepted: boolean }
      }
    ).dispatchTransaction
    expect(
      dispatch({
        changes: [{ from: 0, insert: ' ', to: 0 }],
        history: 'separate',
        origin: 'input',
      }).accepted,
    ).toBe(true)

    resolveCommand(undefined)
    await flushPromises()
    expect(
      wrapper.emitted('update:modelValue')?.map(([value]) => value),
    ).toEqual([' [Docs](https://safe.test)', ' [DONE](https://safe.test)'])
    expect(wrapper.emitted('command')).toHaveLength(1)
  })

  it('dismisses slash and selection surfaces on Escape without changing source', async () => {
    const wrapper = mount(MarkdownEditor, {
      props: {
        commands: [insertCommand],
        modelValue: '/insert',
        surfaces: { selectionToolbar: true, slashMenu: true },
      },
    })

    const slash = wrapper.find('.el-markdown-editor__slash-menu')
    expect(slash.exists()).toBe(true)
    await slash.trigger('keydown', { key: 'Escape' })
    expect(wrapper.find('.el-markdown-editor__slash-menu').exists()).toBe(false)

    const textarea = wrapper.find('textarea')
    const element = textarea.element as HTMLTextAreaElement
    element.setSelectionRange(0, 2)
    await textarea.trigger('select')
    await nextTick()
    const selection = wrapper.find('.el-markdown-editor__selection-toolbar')
    expect(selection.exists()).toBe(true)
    await selection.trigger('keydown', { key: 'Escape' })
    expect(
      wrapper.find('.el-markdown-editor__selection-toolbar').exists(),
    ).toBe(false)
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('uses locale copy and keyword search for the command palette', async () => {
    const directionOwner = document.createElement('div')
    directionOwner.dir = 'rtl'
    document.body.append(directionOwner)
    const wrapper = mount(MarkdownEditor, {
      attachTo: directionOwner,
      props: {
        commands: [insertCommand],
        localeText: {
          commandPalette: {
            searchPlaceholder: '查找命令',
            title: '命令面板',
          },
        },
        modelValue: '',
        surfaces: { commandPalette: true },
      },
    })

    ;(
      wrapper.vm as unknown as { openCommandPalette: () => void }
    ).openCommandPalette()
    await nextTick()
    const dialog = document.body.querySelector(
      '.el-markdown-editor__palette-dialog',
    ) as HTMLElement
    expect(dialog.getAttribute('aria-label')).toBe('命令面板')
    const backdrop = document.body.querySelector(
      '.el-markdown-editor__palette-backdrop',
    ) as HTMLElement
    expect(backdrop.dir).toBe('rtl')
    const input = document.body.querySelector(
      '.el-markdown-editor__palette-input',
    ) as HTMLInputElement
    const searchLabel = document.body.querySelector(
      '.el-markdown-editor__palette-search-label',
    ) as HTMLLabelElement
    expect(input.placeholder).toBe('查找命令')
    expect(input.getAttribute('aria-label')).toBe('查找命令')
    expect(searchLabel.textContent?.trim()).toBe('查找命令')
    expect(searchLabel.htmlFor).toBe(input.id)
    input.value = 'token-alias'
    input.dispatchEvent(new Event('input'))
    await nextTick()
    expect(
      document.body.querySelectorAll('.el-markdown-editor__palette-item'),
    ).toHaveLength(1)
    wrapper.unmount()
    directionOwner.remove()
  })

  it('passes editor locale loading copy to the renderer layer', () => {
    const wrapper = mount(MarkdownEditor, {
      props: {
        defaultMode: 'preview',
        localeText: {
          states: { loading: 'Chargement du Markdown' },
        },
        modelValue: '# Localized',
      },
      global: {
        stubs: {
          ElMarkdownRenderer: {
            props: ['loadingText'],
            template: '<div data-renderer-loading-copy>{{ loadingText }}</div>',
          },
        },
      },
    })

    expect(wrapper.get('[data-renderer-loading-copy]').text()).toBe(
      'Chargement du Markdown',
    )
  })

  it('edits projection-owned link subranges from the contextual surface', async () => {
    const wrapper = mount(MarkdownEditor, {
      props: {
        documentIdentity: { epoch: 3, id: 'link-document' },
        modelValue: '[Docs](https://old.test)',
        surfaces: { selectionToolbar: true },
      },
    })
    await selectRange(wrapper, 1, 5)
    const edit = wrapper
      .findAll('.el-markdown-editor__selection-toolbar button')
      .find((button) => button.text() === '编辑链接')
    expect(edit).toBeDefined()
    await edit!.trigger('click')
    await flushPromises()

    const surface = wrapper.get('.el-markdown-editor__property-surface')
    expect(surface.attributes('data-markdown-anchor-id')).toMatch(
      /^syn:link-document:3:link:/,
    )
    const inputs = surface.findAll('input')
    await inputs[0]!.setValue('Guide')
    await inputs[1]!.setValue('https://next.test')
    await surface.trigger('submit')
    await flushPromises()
    expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toBe(
      '[Guide](https://next.test)',
    )
  })

  it('edits a stable projected block anchor without sidecar state', async () => {
    const wrapper = mount(MarkdownEditor, {
      props: {
        documentIdentity: { epoch: 2, id: 'anchor-document' },
        modelValue: 'Paragraph ^intro',
        surfaces: { selectionToolbar: true },
      },
    })
    await selectRange(wrapper, 12, 14)
    const edit = wrapper
      .findAll('.el-markdown-editor__selection-toolbar button')
      .find((button) => button.text() === '编辑块锚点')
    expect(edit).toBeDefined()
    await edit!.trigger('click')
    await flushPromises()

    const surface = wrapper.get('.el-markdown-editor__property-surface')
    expect(surface.attributes('data-markdown-anchor-id')).toMatch(
      /^syn:anchor-document:2:anchor:/,
    )
    await surface.get('input').setValue('updated')
    await surface.trigger('submit')
    await flushPromises()
    expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toBe(
      'Paragraph ^updated',
    )
  })

  it('rejects unsafe link edits with localized copy and no transaction', async () => {
    const wrapper = mount(MarkdownEditor, {
      props: {
        documentIdentity: { epoch: 1, id: 'unsafe-link-document' },
        localeText: {
          contextual: { unsafeUrl: 'URL-BLOCKED-L10N' },
        },
        modelValue: '[Docs](https://safe.test)',
        surfaces: { selectionToolbar: true },
      },
    })
    await selectRange(wrapper, 1, 5)
    const edit = wrapper
      .findAll('.el-markdown-editor__selection-toolbar button')
      .find((button) => button.text() === '编辑链接')
    await edit!.trigger('click')
    await flushPromises()

    const surface = wrapper.get('.el-markdown-editor__property-surface')
    await surface
      .findAll('input')[1]!
      .setValue(getMarkdownXssSourceUrl('mxss-url-javascript-link'))
    await surface.trigger('submit')
    await flushPromises()

    expect(surface.get('[role="alert"]').text()).toBe('URL-BLOCKED-L10N')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('closes a contextual surface for a same-source document switch', async () => {
    const wrapper = mount(MarkdownEditor, {
      props: {
        documentIdentity: { epoch: 1, id: 'document-a' },
        modelValue: '[Docs](https://safe.test)',
        surfaces: { selectionToolbar: true },
      },
    })
    await selectRange(wrapper, 1, 5)
    const edit = wrapper
      .findAll('.el-markdown-editor__selection-toolbar button')
      .find((button) => button.text() === '编辑链接')
    await edit!.trigger('click')
    await flushPromises()
    expect(wrapper.find('.el-markdown-editor__property-surface').exists()).toBe(
      true,
    )

    await wrapper.setProps({
      documentIdentity: { epoch: 1, id: 'document-b' },
    })
    await nextTick()
    expect(wrapper.find('.el-markdown-editor__property-surface').exists()).toBe(
      false,
    )
  })

  it('uses distinct localized insert and edit anchor commands', async () => {
    const wrapper = mount(MarkdownEditor, {
      attachTo: document.body,
      props: {
        documentIdentity: { epoch: 1, id: 'anchor-insert-document' },
        localeText: {
          contextual: {
            editAnchor: 'EDIT-ANCHOR-L10N',
            insertAnchor: 'INSERT-ANCHOR-L10N',
          },
        },
        modelValue: 'Paragraph',
        surfaces: { commandPalette: true },
      },
    })
    ;(
      wrapper.vm as unknown as { openCommandPalette: () => void }
    ).openCommandPalette()
    await nextTick()

    const labels = Array.from(
      document.body.querySelectorAll<HTMLButtonElement>(
        '.el-markdown-editor__palette-item',
      ),
      (button) => button.textContent?.trim(),
    )
    expect(labels).toContain('INSERT-ANCHOR-L10N')
    expect(labels).not.toContain('EDIT-ANCHOR-L10N')
    wrapper.unmount()
  })

  it('rejects a duplicate inserted anchor without sidecar or source mutation', async () => {
    const wrapper = mount(MarkdownEditor, {
      attachTo: document.body,
      props: {
        documentIdentity: { epoch: 1, id: 'anchor-duplicate-document' },
        localeText: {
          contextual: {
            insertAnchor: 'INSERT-ANCHOR-L10N',
            invalidAnchor: 'ANCHOR-INVALID-L10N',
          },
        },
        modelValue: 'First ^duplicate\nSecond',
        surfaces: { commandPalette: true },
      },
    })
    await selectRange(wrapper, 23, 23)
    ;(
      wrapper.vm as unknown as { openCommandPalette: () => void }
    ).openCommandPalette()
    await nextTick()
    const insert = Array.from(
      document.body.querySelectorAll<HTMLButtonElement>(
        '.el-markdown-editor__palette-item',
      ),
    ).find((button) => button.textContent?.trim() === 'INSERT-ANCHOR-L10N')
    expect(insert).toBeDefined()
    insert!.click()
    await flushPromises()

    const surface = wrapper.get('.el-markdown-editor__property-surface')
    await surface.get('input').setValue('duplicate')
    await surface.trigger('submit')
    await flushPromises()

    expect(surface.get('[role="alert"]').text()).toBe('ANCHOR-INVALID-L10N')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    wrapper.unmount()
  })

  it('traps palette focus, exposes disabled reason, and closes on document switch', async () => {
    const disabledCommand: MarkdownEditorCommand = {
      ...insertCommand,
      disabledReason: () => 'Provider unavailable',
      enabled: () => false,
      key: 'disabled-token',
      label: 'Disabled token',
    }
    const wrapper = mount(MarkdownEditor, {
      attachTo: document.body,
      props: {
        commands: [disabledCommand, insertCommand],
        documentIdentity: { epoch: 1, id: 'document-a' },
        localeText: {
          commandGroups: { insert: 'Insertions' },
        },
        modelValue: '',
        surfaces: { commandPalette: true },
      },
    })

    ;(
      wrapper.vm as unknown as { openCommandPalette: () => void }
    ).openCommandPalette()
    await nextTick()
    const input = document.body.querySelector(
      '.el-markdown-editor__palette-input',
    ) as HTMLInputElement
    const enabled = document.body.querySelector(
      '.el-markdown-editor__palette-item:not(:disabled)',
    ) as HTMLButtonElement
    const disabled = document.body.querySelector(
      '.el-markdown-editor__palette-item:disabled',
    ) as HTMLButtonElement
    const group = document.body.querySelector(
      '.el-markdown-editor__palette-group',
    ) as HTMLElement
    expect(document.activeElement).toBe(input)
    expect(group.getAttribute('aria-label')).toBe('Insertions')
    expect(disabled.disabled).toBe(true)
    expect(enabled.getAttribute('aria-selected')).toBe('true')
    const description = disabled.getAttribute('aria-describedby')
    expect(description).toBeTruthy()
    expect(document.getElementById(description!)?.textContent).toContain(
      'Provider unavailable',
    )

    input.dispatchEvent(
      new KeyboardEvent('keydown', {
        bubbles: true,
        key: 'Tab',
        shiftKey: true,
      }),
    )
    expect(document.activeElement).toBe(enabled)
    enabled.dispatchEvent(
      new KeyboardEvent('keydown', { bubbles: true, key: 'Tab' }),
    )
    expect(document.activeElement).toBe(input)

    await wrapper.setProps({
      documentIdentity: { epoch: 1, id: 'document-b' },
    })
    await nextTick()
    expect(
      document.body.querySelector('.el-markdown-editor__palette-dialog'),
    ).toBeNull()
    expect(document.activeElement).toBe(wrapper.find('textarea').element)
    wrapper.unmount()
  })

  const paletteFacts = async (mode: MarkdownEditorMode) => {
    const wrapper = mount(MarkdownEditor, {
      attachTo: document.body,
      props: {
        defaultMode: mode,
        modelValue: '# Title',
        surfaces: { commandPalette: true },
      },
    })
    ;(wrapper.vm as unknown as { openCommandPalette: () => void }).openCommandPalette()
    await nextTick()
    const facts = Array.from(
      document.body.querySelectorAll<HTMLButtonElement>(
        '.el-markdown-editor__palette-item',
      ),
      (button) => ({ disabled: button.disabled, label: button.textContent?.trim() }),
    )
    wrapper.unmount()
    await nextTick()
    return facts
  }

  it('lists one command set in every mode and blocks execution in preview', async () => {
    const authority = await paletteFacts('source')
    expect(authority.length).toBeGreaterThan(1)
    for (const mode of ['live', 'split'] as const) {
      expect(await paletteFacts(mode), mode).toEqual(authority)
    }
    const preview = await paletteFacts('preview')
    expect(preview.map((item) => item.label)).toEqual(
      authority.map((item) => item.label),
    )
    expect(preview.every((item) => item.disabled)).toBe(true)

    // The shortcut path carries no disabled attribute, so preview must still
    // fail closed instead of mutating source.
    const wrapper = mount(MarkdownEditor, {
      props: { defaultMode: 'preview', modelValue: '# Title' },
    })
    const buttons = wrapper.findAll('.el-markdown-editor__command')
    expect(buttons.length).toBeGreaterThan(0)
    expect(
      buttons.every((button) => (button.element as HTMLButtonElement).disabled),
    ).toBe(true)
    await wrapper.find('textarea').trigger('keydown', { ctrlKey: true, key: 'b' })
    await flushPromises()
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(wrapper.emitted('command')).toBeUndefined()
    wrapper.unmount()
  })

  it('renders no command surface content for an empty registry', async () => {
    const wrapper = mount(MarkdownEditor, {
      attachTo: document.body,
      props: {
        commands: [],
        modelValue: '# Title',
        surfaces: { commandPalette: true },
      },
    })
    expect(wrapper.findAll('.el-markdown-editor__command')).toHaveLength(0)
    ;(wrapper.vm as unknown as { openCommandPalette: () => void }).openCommandPalette()
    await nextTick()
    expect(
      document.body.querySelector('.el-markdown-editor__palette-dialog'),
    ).not.toBeNull()
    expect(
      document.body.querySelectorAll('.el-markdown-editor__palette-item'),
    ).toHaveLength(0)
    wrapper.unmount()
  })
})
