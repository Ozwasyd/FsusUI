import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import MarkdownEditor from '../src/markdown-editor.vue'
import { resolveMarkdownEditorFittingCommandCount } from '../src/markdown-editor-toolbar-overflow'

describe('resolveMarkdownEditorFittingCommandCount (#1103)', () => {
  it('returns null when layout geometry is unavailable (SSR / jsdom zero-width)', () => {
    expect(
      resolveMarkdownEditorFittingCommandCount({
        availableWidth: 0,
        commandWidths: [48, 48],
        commandsGap: 4,
        groupGap: 4,
        hasBaseOverflow: false,
        overflowTriggerWidth: 64,
      }),
    ).toBeNull()

    expect(
      resolveMarkdownEditorFittingCommandCount({
        availableWidth: 320,
        commandWidths: [],
        commandsGap: 4,
        groupGap: 4,
        hasBaseOverflow: false,
        overflowTriggerWidth: 64,
      }),
    ).toBeNull()

    expect(
      resolveMarkdownEditorFittingCommandCount({
        availableWidth: 320,
        commandWidths: [48, 0, 48],
        commandsGap: 4,
        groupGap: 4,
        hasBaseOverflow: false,
        overflowTriggerWidth: 64,
      }),
    ).toBeNull()

    expect(
      resolveMarkdownEditorFittingCommandCount({
        availableWidth: 100,
        commandWidths: [48, 48, 48],
        commandsGap: 4,
        groupGap: 4,
        hasBaseOverflow: true,
        overflowTriggerWidth: 0,
      }),
    ).toBeNull()
  })

  it('fits all commands without reserving an overflow trigger when there is no base overflow', () => {
    // 50 + 4 + 60 + 4 + 50 = 168
    expect(
      resolveMarkdownEditorFittingCommandCount({
        availableWidth: 168,
        commandWidths: [50, 60, 50],
        commandsGap: 4,
        groupGap: 4,
        hasBaseOverflow: false,
        overflowTriggerWidth: 72,
      }),
    ).toBe(3)
  })

  it('reserves overflow trigger width when base overflow exists or commands do not all fit', () => {
    // With trigger(72) + groupGap(4) = 76 reserved, commandsBudget = 200 - 76 = 124
    // 50 + 4 + 60 = 114 <= 124; adding 50 -> 168 > 124 => 2 fit
    expect(
      resolveMarkdownEditorFittingCommandCount({
        availableWidth: 200,
        commandWidths: [50, 60, 50],
        commandsGap: 4,
        groupGap: 4,
        hasBaseOverflow: true,
        overflowTriggerWidth: 72,
      }),
    ).toBe(2)

    // Without base overflow, 168 > 160 forces trigger reservation:
    // commandsBudget = 160 - (72 + 4) = 84 => only first command (50) fits
    expect(
      resolveMarkdownEditorFittingCommandCount({
        availableWidth: 160,
        commandWidths: [50, 60, 50],
        commandsGap: 4,
        groupGap: 4,
        hasBaseOverflow: false,
        overflowTriggerWidth: 72,
      }),
    ).toBe(1)
  })

  it('returns 0 in ultra-narrow containers and accounts for reserved end commands', () => {
    expect(
      resolveMarkdownEditorFittingCommandCount({
        availableWidth: 90,
        commandWidths: [50, 50],
        commandsGap: 8,
        groupGap: 8,
        hasBaseOverflow: true,
        overflowTriggerWidth: 80,
      }),
    ).toBe(0)

    // commandsBudget = 260 - (72 + 4) = 184; reservedEndWidth = 90
    // 1st cmd: 90 + 4 + 50 = 144 <= 184; 2nd cmd: 144 + 4 + 50 = 198 > 184 => 1 fits
    expect(
      resolveMarkdownEditorFittingCommandCount({
        availableWidth: 260,
        commandWidths: [50, 50, 50],
        commandsGap: 4,
        groupGap: 4,
        hasBaseOverflow: true,
        overflowTriggerWidth: 72,
        reservedEndWidth: 90,
      }),
    ).toBe(1)
  })
})

describe('MarkdownEditor toolbar overflow geometry (#825 & #1103)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('keeps the overflow trigger outside primary-command scrolling with the same registry and focus return', async () => {
    const wrapper = mount(MarkdownEditor, {
      attachTo: document.body,
      props: {
        modelValue: 'draft',
        primaryCommandKeys: ['heading', 'link'],
        actionOverflowKeys: ['image'],
        showSaveAction: false,
        showSubmitAction: false,
      },
    })
    try {
      const commands = wrapper.find('.el-markdown-editor__commands')
      const more = wrapper.find('.el-markdown-editor__command-more')
      const probe = wrapper.find('.el-markdown-editor__command-measure')
      expect(probe.exists()).toBe(true)
      expect(probe.attributes('aria-hidden')).toBe('true')
      expect(probe.findAll('button')).toHaveLength(0)

      expect(commands.element.contains(more.element)).toBe(false)
      expect(commands.element.parentElement).toBe(more.element.parentElement)
      expect(commands.findAll('button').map((button) => button.text())).toEqual(
        ['标题', '链接'],
      )
      expect(more.text()).toContain('7')
      expect(more.attributes('aria-expanded')).toBe('false')
      await more.trigger('click')
      const tray = wrapper.find('.el-markdown-editor__command-tray')
      expect(tray.findAll('button')).toHaveLength(7)
      expect(more.attributes('aria-controls')).toBe(tray.attributes('id'))
      expect(more.attributes('aria-expanded')).toBe('true')
      await tray.trigger('keydown', { key: 'Escape' })
      expect(wrapper.find('.el-markdown-editor__command-tray').exists()).toBe(
        false,
      )
      expect(document.activeElement).toBe(more.element)
      expect(wrapper.emitted('update:modelValue')).toBeUndefined()
      expect(wrapper.emitted('command')).toBeUndefined()
    } finally {
      wrapper.unmount()
    }
  })

  it('dynamically moves overflowing primary commands into the tray on narrow widths and restores focus when overflow collapses to zero', async () => {
    let resizeCallback: ResizeObserverCallback | undefined
    class MockResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        resizeCallback = callback
      }
      observe = vi.fn()
      unobserve = vi.fn()
      disconnect = vi.fn()
    }
    vi.stubGlobal('ResizeObserver', MockResizeObserver)

    const scheduledFrames: FrameRequestCallback[] = []
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      scheduledFrames.push(callback)
      return scheduledFrames.length
    })
    const flushFrames = async () => {
      while (scheduledFrames.length > 0) {
        const next = scheduledFrames.shift()
        next?.(performance.now())
        await nextTick()
      }
    }

    const customCommands = [
      {
        group: 'format',
        key: 'alpha',
        label: 'Alpha',
        priority: 30,
        run: () => ({ transaction: null }),
      },
      {
        group: 'format',
        key: 'beta',
        label: 'Beta',
        priority: 20,
        run: () => ({ transaction: null }),
      },
      {
        group: 'format',
        key: 'gamma',
        label: 'Gamma',
        priority: 10,
        run: () => ({ transaction: null }),
      },
    ]

    const wrapper = mount(MarkdownEditor, {
      attachTo: document.body,
      props: {
        commands: customCommands,
        modelValue: 'draft',
        showActions: false,
        showModeSwitcher: false,
      },
    })

    try {
      const group = wrapper.find('.el-markdown-editor__command-group')
        .element as HTMLElement
      const probe = wrapper.find('.el-markdown-editor__command-measure')
        .element as HTMLElement

      let currentGroupWidth = 150
      Object.defineProperty(group, 'clientWidth', {
        configurable: true,
        get: () => currentGroupWidth,
      })
      for (const node of probe.querySelectorAll<HTMLElement>(
        '[data-measure-role="command"]',
      )) {
        vi.spyOn(node, 'getBoundingClientRect').mockReturnValue({
          bottom: 32,
          height: 32,
          left: 0,
          right: 60,
          toJSON: () => ({}),
          top: 0,
          width: 60,
          x: 0,
          y: 0,
        })
      }
      const moreProbe = probe.querySelector<HTMLElement>(
        '[data-measure-role="more"]',
      )!
      vi.spyOn(moreProbe, 'getBoundingClientRect').mockReturnValue({
        bottom: 32,
        height: 32,
        left: 0,
        right: 76,
        toJSON: () => ({}),
        top: 0,
        width: 76,
        x: 0,
        y: 0,
      })

      await flushFrames()
      // availableWidth=150, trigger=76 => commandsBudget=74 => only 1 command (60px) fits
      expect(
        wrapper.findAll('.el-markdown-editor__commands button').map((b) => b.text()),
      ).toEqual(['Alpha'])
      const more = wrapper.find('.el-markdown-editor__command-more')
      expect(more.exists()).toBe(true)
      expect(more.find('.el-markdown-editor__command-more-count').text()).toBe(
        '2',
      )

      await more.trigger('click')
      await nextTick()
      const tray = wrapper.find('.el-markdown-editor__command-tray')
      expect(tray.exists()).toBe(true)
      const trayButtons = tray.findAll('button')
      expect(trayButtons.map((b) => b.text())).toEqual(['Beta', 'Gamma'])
      expect(document.activeElement).toBe(trayButtons[0]!.element)

      // Widen container so all 3 commands (3*60 = 180) fit with no overflow trigger needed
      currentGroupWidth = 260
      resizeCallback?.(
        [
          {
            contentRect: { width: currentGroupWidth } as DOMRectReadOnly,
          } as ResizeObserverEntry,
        ],
        {} as ResizeObserver,
      )
      await flushFrames()

      expect(
        wrapper.findAll('.el-markdown-editor__commands button').map((b) => b.text()),
      ).toEqual(['Alpha', 'Beta', 'Gamma'])
      expect(wrapper.find('.el-markdown-editor__command-more').exists()).toBe(
        false,
      )
      expect(wrapper.find('.el-markdown-editor__command-tray').exists()).toBe(
        false,
      )
      expect(document.activeElement).toBe(
        wrapper.find('.el-markdown-editor__commands button').element,
      )
    } finally {
      wrapper.unmount()
    }
  })
})
