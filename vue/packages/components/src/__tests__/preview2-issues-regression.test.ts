import { createSSRApp, defineComponent, h, nextTick, ref } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { en, zhCN } from '@fsusui/core'
import {
  createFsusRenderPipelineComponentPolicy,
  resolveFsusInstallComponentName,
} from '../../../core/src/render-pipeline'
import {
  FsusCascader,
  FsusConfigProvider,
  FsusCopyableDetail,
  FsusDropdown,
  FsusDropdownItem,
  FsusDropdownMenu,
  FsusForm,
  FsusFormItem,
  FsusInput,
  FsusSelect,
  FsusTabPane,
  FsusTabs,
} from '../index'

const originalClipboardDescriptor = Object.getOwnPropertyDescriptor(
  navigator,
  'clipboard',
)

afterEach(() => {
  vi.useRealTimers()
  if (originalClipboardDescriptor) {
    Object.defineProperty(navigator, 'clipboard', originalClipboardDescriptor)
  } else {
    delete (navigator as unknown as { clipboard?: unknown }).clipboard
  }
})

describe('preview.2 issue regressions (#1144–#1150)', () => {
  it('#1144: closed FsusSelect, FsusCascader, and FsusDropdown render cleanly during Vue SSR', async () => {
    const app = createSSRApp(
      defineComponent({
        render() {
          return h('div', [
            h(FsusSelect, {
              modelValue: 'zh',
              options: [
                { value: 'zh', label: '中文' },
                { value: 'en', label: 'English' },
              ],
            }),
            h(FsusSelect, {
              modelValue: null,
              teleported: false,
              options: [{ value: 'a', label: 'A' }],
            }),
            h(FsusCascader, {
              modelValue: [],
              options: [{ value: 'cn', label: 'China' }],
            }),
            h(
              FsusDropdown,
              {},
              {
                default: () => h('button', { type: 'button' }, 'Actions'),
                dropdown: () =>
                  h(FsusDropdownMenu, {}, () => [
                    h(FsusDropdownItem, { command: 'open' }, () => 'Open'),
                  ]),
              },
            ),
          ])
        },
      }),
    )

    const ctx: { teleports?: Record<string, string> } = {}
    const html = await renderToString(app, ctx)
    expect(html).toContain('role="combobox"')
    expect(html).toContain('中文')
    expect(html).toContain('fsus-cascader')
    expect(html).toContain('fsus-dropdown__trigger')
    expect(ctx.teleports ?? {}).toEqual({})
  })

  it('#1145: FsusFormItem label names FsusSelect combobox, supports explicit override, error description, label click focus, and Space open', async () => {
    const selected = ref<string | null>(null)
    const wrapper = mount(
      defineComponent({
        setup() {
          return () =>
            h(FsusForm, {}, () => [
              h(
                FsusFormItem,
                { label: 'Language', error: 'Language is required' },
                () =>
                  h(FsusSelect, {
                    modelValue: selected.value,
                    'onUpdate:modelValue': (v: string | null) => {
                      selected.value = v
                    },
                    options: [
                      { value: 'zh', label: 'Chinese' },
                      { value: 'en', label: 'English' },
                    ],
                    teleported: false,
                  }),
              ),
              h(FsusFormItem, { label: 'Fallback label' }, () =>
                h(FsusSelect, {
                  'aria-label': 'Explicit combobox label',
                  options: [{ value: '1', label: 'One' }],
                  teleported: false,
                }),
              ),
            ])
        },
      }),
      { attachTo: document.body },
    )

    const labels = wrapper.findAll('label.fsus-form-item__label')
    const comboboxes = wrapper.findAll('[role="combobox"]')
    expect(labels.length).toBe(2)
    expect(comboboxes.length).toBe(2)

    const firstLabel = labels[0]!
    const firstCombo = comboboxes[0]!
    const labelId = firstLabel.attributes('id')
    const fieldFor = firstLabel.attributes('for')
    expect(labelId).toBeTruthy()
    expect(fieldFor).toBeTruthy()
    expect(firstCombo.attributes('id')).toBe(fieldFor)
    expect(firstCombo.attributes('aria-labelledby')).toBe(labelId)
    expect(firstCombo.attributes('aria-invalid')).toBe('true')
    const errorEl = wrapper.find('.fsus-form-item__error')
    expect(firstCombo.attributes('aria-describedby')).toBe(
      errorEl.attributes('id'),
    )

    // Explicit aria-label is preserved and not overridden by FormItem aria-labelledby
    const secondCombo = comboboxes[1]!
    expect(secondCombo.attributes('aria-label')).toBe('Explicit combobox label')
    expect(secondCombo.attributes('aria-labelledby')).toBeUndefined()

    // Clicking the <label> focuses the non-native combobox
    await firstLabel.trigger('click')
    expect(document.activeElement).toBe(firstCombo.element)

    // Pressing Space opens the closed combobox
    expect(firstCombo.attributes('aria-expanded')).toBe('false')
    await firstCombo.trigger('keydown', { key: ' ' })
    await nextTick()
    expect(firstCombo.attributes('aria-expanded')).toBe('true')

    wrapper.unmount()
  })

  it('#1146: FsusInput forwards id, aria-*, required, and inputmode to native input and textarea while keeping class/style on wrapper', () => {
    const inputWrapper = mount(FsusInput, {
      attrs: {
        id: 'email',
        class: 'custom-field',
        style: 'width: 240px',
        'aria-label': 'Email address',
        'aria-describedby': 'email-help',
        required: '',
        inputmode: 'email',
        enterkeyhint: 'next',
      },
    })

    const root = inputWrapper.find('.fsus-input')
    const nativeInput = inputWrapper.find('input.fsus-input__native')
    expect(root.classes()).toContain('custom-field')
    expect(root.attributes('style')).toContain('240px')
    expect(root.attributes('id')).toBeUndefined()
    expect(root.attributes('aria-label')).toBeUndefined()
    expect(root.attributes('aria-describedby')).toBeUndefined()
    expect(root.attributes('required')).toBeUndefined()
    expect(root.attributes('inputmode')).toBeUndefined()

    expect(nativeInput.attributes('id')).toBe('email')
    expect(nativeInput.attributes('aria-label')).toBe('Email address')
    expect(nativeInput.attributes('aria-describedby')).toBe('email-help')
    expect(nativeInput.attributes('required')).toBeDefined()
    expect(nativeInput.attributes('inputmode')).toBe('email')
    expect(nativeInput.attributes('enterkeyhint')).toBe('next')

    const textareaWrapper = mount(FsusInput, {
      props: { type: 'textarea' },
      attrs: {
        id: 'bio',
        'aria-label': 'Biography',
        'aria-describedby': 'bio-hint',
        required: '',
      },
    })
    const textareaRoot = textareaWrapper.find('.fsus-input')
    const nativeTextarea = textareaWrapper.find('textarea.fsus-input__native')
    expect(textareaRoot.attributes('id')).toBeUndefined()
    expect(nativeTextarea.attributes('id')).toBe('bio')
    expect(nativeTextarea.attributes('aria-label')).toBe('Biography')
    expect(nativeTextarea.attributes('aria-describedby')).toBe('bio-hint')
    expect(nativeTextarea.attributes('required')).toBeDefined()

    // Inside FsusFormItem without explicit id, native input inherits formItem id & error description
    const formWrapper = mount(
      defineComponent({
        render() {
          return h(FsusFormItem, { label: 'Account', error: 'Invalid' }, () =>
            h(FsusInput, { 'aria-describedby': 'custom-hint' }),
          )
        },
      }),
    )
    const labelFor = formWrapper.find('label').attributes('for')
    const errorId = formWrapper.find('.fsus-form-item__error').attributes('id')
    const formInput = formWrapper.find('input.fsus-input__native')
    expect(formInput.attributes('id')).toBe(labelFor)
    expect(formInput.attributes('aria-invalid')).toBe('true')
    expect(formInput.attributes('aria-describedby')).toBe(
      `custom-hint ${errorId}`,
    )
  })

  it('#1149: FsusTabs associates each tab with its tabpanel via unique id, aria-controls, and aria-labelledby', async () => {
    const activeA = ref('overview')
    const activeB = ref('overview')
    const wrapper = mount(
      defineComponent({
        setup() {
          return () =>
            h('div', [
              h(
                FsusTabs,
                {
                  modelValue: activeA.value,
                  'onUpdate:modelValue': (v: string) => {
                    activeA.value = v
                  },
                },
                () => [
                  h(FsusTabPane, { name: 'overview', label: 'Overview' }, () =>
                    h('p', 'Overview A'),
                  ),
                  h(FsusTabPane, { name: 'api', label: 'API' }, () =>
                    h('p', 'API A'),
                  ),
                ],
              ),
              h(
                FsusTabs,
                {
                  modelValue: activeB.value,
                  'onUpdate:modelValue': (v: string) => {
                    activeB.value = v
                  },
                },
                () => [
                  h(FsusTabPane, { name: 'overview', label: 'Overview' }, () =>
                    h('p', 'Overview B'),
                  ),
                ],
              ),
            ])
        },
      }),
    )

    const allTabs = wrapper.findAll('[role="tab"]')
    const allPanels = wrapper.findAll('[role="tabpanel"]')
    expect(allTabs.length).toBe(3)
    expect(allPanels.length).toBe(2)

    const tab0 = allTabs[0]!
    const tab1 = allTabs[1]!
    const tab2 = allTabs[2]!
    const panel0 = allPanels[0]!
    const panel1 = allPanels[1]!

    // Unique IDs across multiple FsusTabs instances with identical pane names
    expect(tab0.attributes('id')).toBeTruthy()
    expect(tab2.attributes('id')).toBeTruthy()
    expect(tab0.attributes('id')).not.toBe(tab2.attributes('id'))
    expect(panel0.attributes('id')).not.toBe(panel1.attributes('id'))

    // Active tab <-> panel ARIA linkage
    expect(tab0.attributes('aria-controls')).toBe(panel0.attributes('id'))
    expect(panel0.attributes('aria-labelledby')).toBe(tab0.attributes('id'))
    expect(tab0.attributes('tabindex')).toBe('0')
    expect(tab1.attributes('tabindex')).toBe('-1')

    // Switching tabs updates active panel linkage
    await tab1.trigger('click')
    await nextTick()
    const updatedPanel0 = wrapper.findAll('[role="tabpanel"]')[0]!
    expect(tab1.attributes('aria-selected')).toBe('true')
    expect(tab1.attributes('aria-controls')).toBe(updatedPanel0.attributes('id'))
    expect(updatedPanel0.attributes('aria-labelledby')).toBe(tab1.attributes('id'))
    expect(updatedPanel0.text()).toContain('API A')
  })

  it('#1150: FsusCopyableDetail fails explicitly when Clipboard API is missing or rejects, and announces localized status outside button', async () => {
    vi.useFakeTimers()

    // 1. Missing navigator.clipboard -> error state, never check icon
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: undefined,
    })

    const onCopy = vi.fn()
    const onCopyError = vi.fn()
    const missingWrapper = mount(
      defineComponent({
        render() {
          return h(FsusConfigProvider, { locale: en }, () =>
            h(FsusCopyableDetail, {
              label: 'Token',
              value: 'fsus-secret-123',
              onCopy,
              onCopyError,
            }),
          )
        },
      }),
    )

    const btn = missingWrapper.find('button.fsus-copyable-detail__btn')
    const statusRegion = missingWrapper.find('[role="status"]')
    expect(btn.attributes('aria-label')).toBe('Copy Token')
    // Live region MUST be outside the button
    expect(btn.find('[role="status"]').exists()).toBe(false)
    expect(statusRegion.exists()).toBe(true)

    await btn.trigger('click')
    await Promise.resolve()
    await nextTick()

    expect(onCopy).not.toHaveBeenCalled()
    expect(onCopyError).toHaveBeenCalledTimes(1)
    expect(missingWrapper.find('.fsus-copyable-detail').attributes('data-status')).toBe('error')
    expect(btn.attributes('data-copied')).toBeUndefined()
    expect(btn.attributes('data-failed')).toBe('')
    expect(btn.attributes('disabled')).toBeUndefined()
    expect(statusRegion.text().trim()).toBe('Copy failed')

    // 2. Rejected writeText() -> error state
    const writeTextReject = vi.fn().mockRejectedValue(new Error('Permission denied'))
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: writeTextReject },
    })

    await btn.trigger('click')
    await Promise.resolve()
    await nextTick()
    expect(writeTextReject).toHaveBeenCalledWith('fsus-secret-123')
    expect(onCopy).not.toHaveBeenCalled()
    expect(onCopyError).toHaveBeenCalledTimes(2)
    expect(missingWrapper.find('.fsus-copyable-detail').attributes('data-status')).toBe('error')
    expect(btn.attributes('data-copied')).toBeUndefined()

    // 3. Resolved writeText() -> copied state + localized Chinese support + timer reset
    const writeTextOk = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: writeTextOk },
    })

    const zhWrapper = mount(
      defineComponent({
        render() {
          return h(FsusConfigProvider, { locale: zhCN }, () =>
            h(FsusCopyableDetail, {
              value: 'abc-789',
              onCopy,
            }),
          )
        },
      }),
    )

    const zhBtn = zhWrapper.find('button.fsus-copyable-detail__btn')
    const zhStatus = zhWrapper.find('[role="status"]')
    expect(zhBtn.attributes('aria-label')).toBe('复制')

    await zhBtn.trigger('click')
    await Promise.resolve()
    await nextTick()

    expect(writeTextOk).toHaveBeenCalledWith('abc-789')
    expect(onCopy).toHaveBeenCalledWith('abc-789')
    expect(zhWrapper.find('.fsus-copyable-detail').attributes('data-status')).toBe('copied')
    expect(zhBtn.attributes('data-copied')).toBe('')
    expect(zhBtn.attributes('aria-label')).toBe('已复制')
    expect(zhStatus.text().trim()).toBe('已复制')

    vi.advanceTimersByTime(1600)
    await nextTick()
    expect(zhWrapper.find('.fsus-copyable-detail').attributes('data-status')).toBe('idle')
    expect(zhStatus.text()).toBe('')
  })

  it('#1148: render-pipeline default component policies use canonical Fsus* names', () => {
    const mdPolicy = createFsusRenderPipelineComponentPolicy('FsusMarkdownRenderer')
    expect(mdPolicy).toMatchObject({
      componentName: 'FsusMarkdownRenderer',
      role: 'chunk-adapter',
      adapterId: 'markdown-renderer',
      budgeted: true,
    })
    expect(createFsusRenderPipelineComponentPolicy('FsusSelect').role).toBe('inherited')
    expect(createFsusRenderPipelineComponentPolicy('FsusTable').role).toBe('inherited')
    expect(createFsusRenderPipelineComponentPolicy('FsusTree').role).toBe('inherited')
    expect(createFsusRenderPipelineComponentPolicy('FsusScrollbar').role).toBe('viewport-provider')
    expect(createFsusRenderPipelineComponentPolicy('FsusMessage').role).toBe('service')
    expect(resolveFsusInstallComponentName('$message')).toBe('FsusMessage')
    expect(resolveFsusInstallComponentName('markdown-renderer')).toBe('FsusMarkdownRenderer')
  })
})
