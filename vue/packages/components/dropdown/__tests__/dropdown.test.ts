import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { rAF } from '@element-plus/test-utils/tick'
import { EVENT_CODE } from '@element-plus/constants'
import { ElTooltip } from '@element-plus/components/tooltip'
import Button from '@element-plus/components/button'
import { usePopperContainerId } from '@element-plus/hooks'
import Dropdown from '../src/dropdown.vue'
import DropdownItem from '../src/dropdown-item.vue'
import DropdownMenu from '../src/dropdown-menu.vue'

const MOUSE_ENTER_EVENT = 'mouseenter'
const MOUSE_LEAVE_EVENT = 'mouseleave'
const CONTEXTMENU = 'contextmenu'
const buttonName = Button.name || 'ElButton'
const dropdownName = Dropdown.name || 'ElDropdown'
const dropdownItemName = DropdownItem.name || 'ElDropdownItem'
const dropdownMenuName = DropdownMenu.name || 'ElDropdownMenu'

type MountDataFactory = () => Record<string, unknown>
type MountExtraOptions = Record<string, unknown>
type DropdownRefExposed = {
  handleOpen: () => void
  handleClose: () => void
}

const _mount = (
  template: string,
  data: MountDataFactory,
  otherObj?: MountExtraOptions,
) =>
  mount({
    components: {
      [buttonName]: Button,
      [dropdownName]: Dropdown,
      [dropdownItemName]: DropdownItem,
      [dropdownMenuName]: DropdownMenu,
    },
    template,
    data,
    ...otherObj,
  })

describe('Dropdown', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  test('create', async () => {
    const wrapper = _mount(
      `
        <el-dropdown ref="b" placement="right">
          <span class="el-dropdown-link" ref="a">
            dropdown<i class="el-icon-arrow-down el-icon--right"></i>
          </span>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item>Apple</el-dropdown-item>
              <el-dropdown-item>Orange</el-dropdown-item>
              <el-dropdown-item>Cherry</el-dropdown-item>
              <el-dropdown-item disabled>Peach</el-dropdown-item>
              <el-dropdown-item divided>Pear</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      `,
      () => ({}),
    )
    await nextTick()
    const content = wrapper.findComponent(ElTooltip).vm as InstanceType<
      typeof ElTooltip
    >

    vi.useFakeTimers()
    const triggerElm = wrapper.find('.el-tooltip__trigger')
    expect(content.open).toBe(false)
    await triggerElm.trigger(MOUSE_ENTER_EVENT)
    vi.runAllTimers()
    expect(content.open).toBe(true)
    await triggerElm.trigger(MOUSE_LEAVE_EVENT)
    vi.runAllTimers()
    expect(content.open).toBe(false)
    vi.useRealTimers()
  })

  test('hover trigger should not steal focus from the active input', async () => {
    const wrapper = _mount(
      `
        <div>
          <input class="outside-input" />
          <el-dropdown trigger="hover">
            <span class="el-dropdown-link">dropdown</span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item>Apple</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      `,
      () => ({}),
      {
        attachTo: document.body,
      },
    )

    await nextTick()
    const trigger = wrapper.find('.el-dropdown-link').element as HTMLElement
    const focusSpy = vi.spyOn(trigger, 'focus')

    vi.useFakeTimers()
    await wrapper.find('.el-dropdown-link').trigger(MOUSE_ENTER_EVENT)
    vi.runAllTimers()
    await nextTick()
    expect(focusSpy).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  test('menu click', async () => {
    const commandHandler = vi.fn()
    const wrapper = _mount(
      `
      <el-dropdown ref="b" @command="commandHandler" placement="right">
        <span class="el-dropdown-link" ref="a">
          dropdown<i class="el-icon-arrow-down el-icon--right"></i>
        </span>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="a">Apple</el-dropdown-item>
            <el-dropdown-item command="b">Orange</el-dropdown-item>
            <el-dropdown-item ref="c" :command="myCommandObject">Cherry</el-dropdown-item>
            <el-dropdown-item command="d">Peach</el-dropdown-item>
            <el-dropdown-item command="e">Pear</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
      `,
      () => ({
        myCommandObject: { name: 'CommandC' },
        name: '',
      }),
      {
        methods: {
          commandHandler,
        },
      },
    )
    await nextTick()
    // const content = wrapper.findComponent({ ref: 'b' }).vm as any
    const triggerElm = wrapper.find('.el-tooltip__trigger')
    await triggerElm.trigger(MOUSE_ENTER_EVENT)
    await nextTick()
    await wrapper
      .findComponent({ ref: 'c' })
      .findComponent({
        name: 'DropdownItemImpl',
      })
      .find('.el-dropdown-menu__item')
      .trigger('click')
    await nextTick()
    expect(commandHandler).toHaveBeenCalled()
  })

  test('trigger', async () => {
    const wrapper = _mount(
      `
      <el-dropdown trigger="click" ref="b" placement="right">
        <span class="el-dropdown-link" ref="a">
          dropdown<i class="el-icon-arrow-down el-icon--right"></i>
        </span>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="a">Apple</el-dropdown-item>
            <el-dropdown-item command="b">Orange</el-dropdown-item>
            <el-dropdown-item ref="c" :command="myCommandObject">Cherry</el-dropdown-item>
            <el-dropdown-item command="d">Peach</el-dropdown-item>
            <el-dropdown-item command="e">Pear</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
      `,
      () => ({
        myCommandObject: { name: 'CommandC' },
        name: '',
      }),
    )
    await nextTick()
    const content = wrapper.findComponent(ElTooltip).vm as InstanceType<
      typeof ElTooltip
    >
    const triggerElm = wrapper.find('.el-dropdown-link')
    expect(content.open).toBe(false)
    await triggerElm.trigger(MOUSE_ENTER_EVENT)
    expect(content.open).toBe(false)
    await triggerElm.trigger('click', {
      button: 0,
    })
    await rAF()
    expect(content.open).toBe(true)
  })

  test('trigger contextmenu', async () => {
    const wrapper = _mount(
      `
      <el-dropdown trigger="contextmenu" ref="b" placement="right">
        <span class="el-dropdown-link" ref="a">
          dropdown<i class="el-icon-arrow-down el-icon--right"></i>
        </span>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="a">Apple</el-dropdown-item>
            <el-dropdown-item command="b">Orange</el-dropdown-item>
            <el-dropdown-item ref="c" :command="myCommandObject">Cherry</el-dropdown-item>
            <el-dropdown-item command="d">Peach</el-dropdown-item>
            <el-dropdown-item command="e">Pear</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
      `,
      () => ({
        myCommandObject: { name: 'CommandC' },
        name: '',
      }),
    )
    await nextTick()
    const content = wrapper.findComponent(ElTooltip).vm as InstanceType<
      typeof ElTooltip
    >
    const triggerElm = wrapper.find('.el-dropdown-link')
    expect(content.open).toBe(false)
    await triggerElm.trigger(CONTEXTMENU)
    await rAF()
    expect(content.open).toBe(true)
  })

  test('handleOpen and handleClose', async () => {
    const wrapper = _mount(
      `
      <el-dropdown trigger="click" ref="refDropdown" placement="right">
        <span class="el-dropdown-link" ref="a">
          dropdown<i class="el-icon-arrow-down el-icon--right"></i>
        </span>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="a">Apple</el-dropdown-item>
            <el-dropdown-item command="b">Orange</el-dropdown-item>
            <el-dropdown-item command="c">Cherry</el-dropdown-item>
            <el-dropdown-item command="d">Peach</el-dropdown-item>
            <el-dropdown-item command="e">Pear</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
      `,
      () => ({
        name: '',
      }),
    )
    await nextTick()
    const dropdown = wrapper.vm as typeof wrapper.vm & {
      $refs: {
        refDropdown: DropdownRefExposed
      }
    }
    const content = wrapper.findComponent(ElTooltip).vm as InstanceType<
      typeof ElTooltip
    >
    expect(content.open).toBe(false)
    await dropdown.$refs.refDropdown.handleOpen()
    await rAF()
    expect(content.open).toBe(true)
    await dropdown.$refs.refDropdown.handleClose()
    await rAF()
    expect(content.open).toBe(false)
  })

  test('split button', async () => {
    const handleClick = vi.fn()
    const wrapper = _mount(
      `
      <el-dropdown  @click="handleClick" split-button type="primary" ref="b" placement="right">
        dropdown
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="a">Apple</el-dropdown-item>
            <el-dropdown-item command="b">Orange</el-dropdown-item>
            <el-dropdown-item ref="c" :command="myCommandObject">Cherry</el-dropdown-item>
            <el-dropdown-item command="d">Peach</el-dropdown-item>
            <el-dropdown-item command="e">Pear</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
      `,
      () => ({
        myCommandObject: { name: 'CommandC' },
        name: '',
      }),
      {
        methods: {
          handleClick,
        },
      },
    )
    await nextTick()
    const content = wrapper.findComponent(ElTooltip).vm as InstanceType<
      typeof ElTooltip
    >
    const triggerElm = wrapper.find('.el-dropdown__caret-button')
    const button = wrapper.find('.el-button')
    expect(content.open).toBe(false)
    await button.trigger('click')
    expect(handleClick).toHaveBeenCalled()
    vi.useFakeTimers()
    await triggerElm.trigger(MOUSE_ENTER_EVENT)
    vi.runAllTimers()
    vi.useRealTimers()
    expect(content.open).toBe(true)
  })

  test('hide on click', async () => {
    const wrapper = _mount(
      `
      <el-dropdown ref="b" placement="right" :hide-on-click="false">
        <span class="el-dropdown-link" ref="a">
          dropdown<i class="el-icon-arrow-down el-icon--right"></i>
        </span>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item>Apple</el-dropdown-item>
            <el-dropdown-item>Orange</el-dropdown-item>
            <el-dropdown-item ref="c">Cherry</el-dropdown-item>
            <el-dropdown-item disabled>Peach</el-dropdown-item>
            <el-dropdown-item divided>Pear</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
      `,
      () => ({}),
    )
    await nextTick()
    const content = wrapper.findComponent(ElTooltip).vm as InstanceType<
      typeof ElTooltip
    >
    expect(content.open).toBe(false)
    const triggerElm = wrapper.find('.el-tooltip__trigger')
    vi.useFakeTimers()
    await triggerElm.trigger(MOUSE_ENTER_EVENT)
    vi.runAllTimers()
    expect(content.open).toBe(true)
    await wrapper
      .findComponent({ ref: 'c' })
      .findComponent({
        name: 'DropdownItemImpl',
      })
      .trigger('click')
    vi.runAllTimers()
    expect(content.open).toBe(true)
    vi.useRealTimers()
  })

  test('triggerElm keydown', async () => {
    const wrapper = _mount(
      `
      <el-dropdown ref="b" placement="right" :hide-on-click="false">
        <span class="el-dropdown-link" ref="a">
          dropdown<i class="el-icon-arrow-down el-icon--right"></i>
        </span>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item>Apple</el-dropdown-item>
            <el-dropdown-item>Orange</el-dropdown-item>
            <el-dropdown-item ref="c">Cherry</el-dropdown-item>
            <el-dropdown-item disabled>Peach</el-dropdown-item>
            <el-dropdown-item divided>Pear</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
      `,
      () => ({}),
    )
    await nextTick()
    const content = wrapper.findComponent(ElTooltip).vm as InstanceType<
      typeof ElTooltip
    >
    const triggerElm = wrapper.find('.el-tooltip__trigger')

    vi.useFakeTimers()
    await triggerElm.trigger(MOUSE_ENTER_EVENT)
    vi.runAllTimers()
    await triggerElm.trigger('keydown', {
      code: EVENT_CODE.enter,
    })
    vi.runAllTimers()
    expect(content.open).toBe(false)

    await triggerElm.trigger(MOUSE_ENTER_EVENT)
    vi.runAllTimers()
    await triggerElm.trigger('keydown', {
      code: EVENT_CODE.tab,
    })
    vi.runAllTimers()
    expect(content.open).toBe(true)
    vi.useRealTimers()
  })

  test('dropdown menu keydown', async () => {
    const wrapper = _mount(
      `
      <el-dropdown ref="b" placement="right" :hide-on-click="false">
        <span class="el-dropdown-link" ref="a">
          dropdown<i class="el-icon-arrow-down el-icon--right"></i>
        </span>
        <template #dropdown>
          <el-dropdown-menu ref="dropdown-menu">
            <el-dropdown-item ref="d">Apple</el-dropdown-item>
            <el-dropdown-item>Orange</el-dropdown-item>
            <el-dropdown-item ref="c">Cherry</el-dropdown-item>
            <el-dropdown-item disabled>Peach</el-dropdown-item>
            <el-dropdown-item divided>Pear</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
      `,
      () => ({}),
    )
    await nextTick()
    const content = wrapper.findComponent({ ref: 'dropdown-menu' })
    const triggerElm = wrapper.find('.el-tooltip__trigger')
    await triggerElm.trigger(MOUSE_ENTER_EVENT)
    await rAF()
    await content.trigger('keydown', {
      code: EVENT_CODE.down,
    })
    await rAF()
    expect(
      wrapper
        .findComponent({ ref: 'd' })
        .findComponent({
          name: 'DropdownItemImpl',
        })
        .find('.el-dropdown-menu__item')
        .element.getAttribute('tabindex'),
    ).toBe('0')
  })

  const mountControlledSelection = () =>
    _mount(
      `
      <el-dropdown trigger="click" :hide-on-click="false">
        <button type="button" class="selection-trigger">Choose</button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="a" :checked="selected === 'a'" :disabled="disabledA">Alpha</el-dropdown-item>
            <el-dropdown-item command="b" :checked="selected === 'b'">Beta</el-dropdown-item>
            <el-dropdown-item command="c" :checked="selected === 'c'">Gamma</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
      `,
      () => ({ selected: 'a', disabledA: false }),
      {
        attachTo: document.body,
        global: { stubs: { transition: false } },
      },
    )

  test('keyboard entry uses selection committed during the enter transition', async () => {
    vi.useFakeTimers()
    try {
      const wrapper = mountControlledSelection()
      await nextTick()
      await wrapper.find('.selection-trigger').trigger('keydown', {
        key: EVENT_CODE.down,
        code: EVENT_CODE.down,
      })
      await vi.advanceTimersByTimeAsync(0)
      await wrapper.setData({ selected: 'b' })
      await vi.advanceTimersByTimeAsync(100)

      const items = document.querySelectorAll('.el-dropdown-menu__item')
      expect(items[1].getAttribute('aria-checked')).toBe('true')
      expect(document.activeElement).toBe(items[1])
      expect(wrapper.findComponent(Dropdown).emitted('command')).toBeUndefined()
      document.activeElement?.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: EVENT_CODE.enter,
          code: EVENT_CODE.enter,
          bubbles: true,
          cancelable: true,
        }),
      )
      expect(wrapper.findComponent(Dropdown).emitted('command')?.[0][0]).toBe(
        'b',
      )
      await wrapper.unmount()
    } finally {
      vi.useRealTimers()
    }
  })

  test('keyboard entry and Home skip an item disabled during enter', async () => {
    vi.useFakeTimers()
    try {
      const wrapper = mountControlledSelection()
      await nextTick()
      await wrapper.find('.selection-trigger').trigger('keydown', {
        key: EVENT_CODE.down,
        code: EVENT_CODE.down,
      })
      await vi.advanceTimersByTimeAsync(0)
      await wrapper.setData({ disabledA: true })
      await vi.advanceTimersByTimeAsync(100)

      const items = document.querySelectorAll('.el-dropdown-menu__item')
      expect(document.activeElement).toBe(items[1])
      await wrapper.findComponent(DropdownMenu).trigger('keydown', {
        key: EVENT_CODE.home,
        code: EVENT_CODE.home,
      })
      expect(document.activeElement).toBe(items[1])
      await wrapper.unmount()
    } finally {
      vi.useRealTimers()
    }
  })

  test('a committed selection does not steal focus after keyboard entry', async () => {
    vi.useFakeTimers()
    try {
      const wrapper = mountControlledSelection()
      await nextTick()
      await wrapper.find('.selection-trigger').trigger('keydown', {
        key: EVENT_CODE.down,
        code: EVENT_CODE.down,
      })
      await vi.advanceTimersByTimeAsync(100)
      const items = document.querySelectorAll<HTMLElement>(
        '.el-dropdown-menu__item',
      )
      expect(document.activeElement).toBe(items[0])
      items[1].focus()
      await wrapper.setData({ selected: 'c' })
      await vi.advanceTimersByTimeAsync(100)

      expect(items[2].getAttribute('aria-checked')).toBe('true')
      expect(document.activeElement).toBe(items[1])
      await wrapper.unmount()
    } finally {
      vi.useRealTimers()
    }
  })

  test('dropdown menu typeahead search', async () => {
    const wrapper = _mount(
      `
      <el-dropdown ref="b" placement="right" :hide-on-click="false">
        <span class="el-dropdown-link" ref="a">
          dropdown<i class="el-icon-arrow-down el-icon--right"></i>
        </span>
        <template #dropdown>
          <el-dropdown-menu ref="dropdown-menu">
            <el-dropdown-item ref="apple">Apple</el-dropdown-item>
            <el-dropdown-item>Orange</el-dropdown-item>
            <el-dropdown-item ref="cherry">Cherry</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
      `,
      () => ({}),
    )
    await nextTick()
    const triggerElm = wrapper.find('.el-tooltip__trigger')
    await triggerElm.trigger(MOUSE_ENTER_EVENT)
    await rAF()

    const firstItem = wrapper
      .findComponent({ ref: 'apple' })
      .find('.el-dropdown-menu__item')
    await firstItem.trigger('focus')
    await firstItem.trigger('keydown', {
      key: 'c',
      code: 'KeyC',
    })
    await rAF()

    expect(
      wrapper
        .findComponent({ ref: 'cherry' })
        .find('.el-dropdown-menu__item')
        .element.getAttribute('tabindex'),
    ).toBe('0')
  })

  test('max height', async () => {
    const wrapper = _mount(
      `
      <el-dropdown ref="b" max-height="60px">
        <span class="el-dropdown-link" ref="a">
          dropdown<i class="el-icon-arrow-down el-icon--right"></i>
        </span>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item>Apple</el-dropdown-item>
            <el-dropdown-item>Orange</el-dropdown-item>
            <el-dropdown-item>Cherry</el-dropdown-item>
            <el-dropdown-item disabled>Peach</el-dropdown-item>
            <el-dropdown-item divided>Pear</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
      `,
      () => ({}),
    )
    await nextTick()
    const scrollbar = wrapper
      .findComponent({
        ref: 'b',
      })
      .findComponent({ ref: 'scrollbar' })
    expect(scrollbar.find('.el-scrollbar__wrap').attributes('style')).toContain(
      'max-height: 60px;',
    )
  })

  test('tooltip debounce', async () => {
    const wrapper = _mount(
      `
      <el-dropdown ref="b">
        <span class="el-dropdown-link">
          dropdown<i class="el-icon-arrow-down el-icon--right"></i>
        </span>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item>Apple</el-dropdown-item>
            <el-dropdown-item>Orange</el-dropdown-item>
            <el-dropdown-item>Cherry</el-dropdown-item>
            <el-dropdown-item>Peach</el-dropdown-item>
            <el-dropdown-item>Pear</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
      `,
      () => ({}),
    )
    const content = wrapper.findComponent(ElTooltip).vm as InstanceType<
      typeof ElTooltip
    >
    const triggerElm = wrapper.find('.el-tooltip__trigger')
    expect(content.open).toBe(false)

    vi.useFakeTimers()
    await triggerElm.trigger(MOUSE_ENTER_EVENT)
    await triggerElm.trigger(MOUSE_LEAVE_EVENT)
    await triggerElm.trigger(MOUSE_ENTER_EVENT)
    vi.runAllTimers()
    vi.useRealTimers()
    expect(content.open).toBe(true)
  })

  test('popperClass', async () => {
    const wrapper = await _mount(
      `
      <el-dropdown ref="b" max-height="60px" popper-class="custom-popper-class">
        <span class="el-dropdown-link" ref="a">
          dropdown<i class="el-icon-arrow-down el-icon--right"></i>
        </span>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item>Apple</el-dropdown-item>
            <el-dropdown-item>Orange</el-dropdown-item>
            <el-dropdown-item>Cherry</el-dropdown-item>
            <el-dropdown-item disabled>Peach</el-dropdown-item>
            <el-dropdown-item divided>Pear</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
      `,
      () => ({}),
    )

    const popperElement = wrapper.findComponent({
      name: 'ElPopperContent',
    }).element

    expect(popperElement.classList.contains('custom-popper-class')).toBe(true)
  })

  test('custom attributes for dropdown items', async () => {
    const wrapper = _mount(
      `
      <el-dropdown>
        <span class="el-dropdown-link">
          Custom Attributes
        </span>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item data-custom-attribute="hello">Item</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
      `,
      () => ({}),
    )
    await nextTick()
    expect(
      (
        wrapper
          .findComponent({
            name: 'DropdownItemImpl',
          })
          .find('.el-dropdown-menu__item').element as HTMLElement
      ).dataset.customAttribute,
    ).toBe('hello')
  })

  test('disable normal dropdown', async () => {
    const wrapper = _mount(
      `
      <el-dropdown disabled>
        <span class="el-dropdown-link">
          Dropdown List
        </span>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item data-custom-attribute="hello">Item</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
      `,
      () => ({}),
    )
    await nextTick()
    expect(
      wrapper
        .findComponent({
          name: 'ElDropdown',
        })
        .classes(),
    ).toContain('is-disabled')
  })
  test('disable dropdown with split button', async () => {
    const wrapper = _mount(
      `
      <el-dropdown disabled split-button>
        <span class="el-dropdown-link">
          Dropdown List
        </span>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item data-custom-attribute="hello">Item</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
      `,
      () => ({}),
    )
    await nextTick()
    expect(
      wrapper
        .findAllComponents({
          name: 'ElButton',
        })[0]
        .classes(),
    ).toContain('is-disabled')
    expect(
      wrapper
        .findAllComponents({
          name: 'ElButton',
        })[1]
        .classes(),
    ).toContain('is-disabled')
  })

  test('set show-timeout/hide-timeout when trigger is hover', async () => {
    const wrapper = _mount(
      `
      <el-dropdown trigger="hover" :show-timeout="200" :hide-timeout="300">
        <span class="el-dropdown-link">
          Dropdown List
        </span>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item>Item</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
      `,
      () => ({}),
    )
    const tooltipElement = wrapper.getComponent({
      name: 'ElTooltip',
    })
    expect(tooltipElement.vm.showAfter).toBe(200)
    expect(tooltipElement.vm.hideAfter).toBe(300)
  })

  test('ignore show-timeout/hide-timeout when trigger is not hover', async () => {
    const wrapper = _mount(
      `
      <el-dropdown trigger="click" :show-timeout="200" :hide-timeout="300">
        <span class="el-dropdown-link">
          Dropdown List
        </span>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item>Item</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
      `,
      () => ({}),
    )
    const tooltipElement = wrapper.getComponent({
      name: 'ElTooltip',
    })
    expect(tooltipElement.vm.showAfter).toBe(0)
    expect(tooltipElement.vm.hideAfter).toBe(0)
  })

  describe('accessibility', () => {
    test('Custom span trigger has proper attributes', async () => {
      const wrapper = _mount(
        `
        <el-dropdown>
          <span class="el-dropdown-link" data-test-ref="trigger">
            Dropdown List
          </span>
          <template #dropdown>
            <el-dropdown-menu ref="menu">
              <el-dropdown-item>Item</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        `,
        () => ({}),
      )
      await nextTick()
      const trigger = wrapper.find('[data-test-ref="trigger"]')
      const menu = wrapper.findComponent({ ref: 'menu' })
      expect(trigger.attributes()['role']).toBe('button')
      expect(trigger.attributes()['tabindex']).toBe('0')
      expect(trigger.attributes()['aria-haspopup']).toBe('menu')
      expect(trigger.attributes()['id']).toBe(
        menu.attributes()['aria-labelledby'],
      )
      expect(trigger.attributes()['aria-controls']).toBe(
        menu.attributes()['id'],
      )
    })

    test('ElButton trigger has proper attributes', async () => {
      const wrapper = _mount(
        `
        <el-dropdown>
          <el-button ref="trigger">
            Dropdown List
          </el-button>
          <template #dropdown>
            <el-dropdown-menu ref="menu">
              <el-dropdown-item>Item</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        `,
        () => ({}),
      )
      await nextTick()
      const trigger = wrapper.findComponent({ ref: 'trigger' })
      const menu = wrapper.findComponent({ ref: 'menu' })
      expect(trigger.attributes()['role']).toBe('button')
      expect(trigger.attributes()['tabindex']).toBe('0')
      expect(trigger.attributes()['aria-haspopup']).toBe('menu')
      expect(trigger.attributes()['id']).toBe(
        menu.attributes()['aria-labelledby'],
      )
      expect(trigger.attributes()['aria-controls']).toBe(
        menu.attributes()['id'],
      )
    })

    test('Split button trigger has proper attributes', async () => {
      const wrapper = _mount(
        `
        <el-dropdown split-button>
          <template #dropdown>
            <el-dropdown-menu ref="menu">
              <el-dropdown-item>Item</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        `,
        () => ({}),
      )
      await nextTick()
      const trigger = wrapper.find('.el-dropdown__caret-button')
      const menu = wrapper.findComponent({ ref: 'menu' })
      expect(trigger.attributes()['role']).toBe('button')
      expect(trigger.attributes()['tabindex']).toBe('0')
      expect(trigger.attributes()['aria-haspopup']).toBe('menu')
      expect(trigger.attributes()['id']).toBe(
        menu.attributes()['aria-labelledby'],
      )
      expect(trigger.attributes()['aria-controls']).toBe(
        menu.attributes()['id'],
      )
    })

    test('Menu items with "menu" role', async () => {
      const wrapper = _mount(
        `
        <el-dropdown split-button>
          <template #dropdown>
            <el-dropdown-menu ref="menu">
              <el-dropdown-item ref="menu-item">Item</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        `,
        () => ({}),
      )
      const menu = wrapper.findComponent({ ref: 'menu' })
      const menuItem = menu.find('.el-dropdown-menu__item')
      expect(menu.attributes()['role']).toBe('menu')
      expect(menuItem.attributes()['role']).toBe('menuitem')
    })

    test('Menu items with "navigation" role', async () => {
      const wrapper = _mount(
        `
        <el-dropdown split-button role="navigation">
          <template #dropdown>
            <el-dropdown-menu ref="menu">
              <el-dropdown-item ref="menu-item">Item</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        `,
        () => ({}),
      )
      const menu = wrapper.findComponent({ ref: 'menu' })
      const menuItem = menu.find('.el-dropdown-menu__item')
      expect(menu.attributes()['role']).toBe('navigation')
      expect(menuItem.attributes()['role']).toBe('link')
    })

    test('Menu items with "group" role', async () => {
      const wrapper = _mount(
        `
        <el-dropdown split-button role="group">
          <template #dropdown>
            <el-dropdown-menu ref="menu">
              <el-dropdown-item ref="menu-item">Item</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        `,
        () => ({}),
      )
      const menu = wrapper.findComponent({ ref: 'menu' })
      const menuItem = menu.find('.el-dropdown-menu__item')
      expect(menu.attributes()['role']).toBe('group')
      expect(menuItem.attributes()['role']).toBe('button')
    })
  })

  describe('teleported API', () => {
    test('should mount on popper container', async () => {
      expect(document.body.innerHTML).toBe('')
      _mount(
        `
        <el-dropdown ref="b" placement="right">
          <span class="el-dropdown-link" ref="a">
            dropdown<i class="el-icon-arrow-down el-icon--right"></i>
          </span>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item>Apple</el-dropdown-item>
              <el-dropdown-item>Orange</el-dropdown-item>
              <el-dropdown-item>Cherry</el-dropdown-item>
              <el-dropdown-item disabled>Peach</el-dropdown-item>
              <el-dropdown-item divided>Pear</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>`,
        () => ({}),
      )

      await nextTick()
      const { selector } = usePopperContainerId()
      expect(document.body.querySelector(selector.value)?.innerHTML).not.toBe(
        '',
      )
    })

    test('should not mount on the popper container', async () => {
      expect(document.body.innerHTML).toBe('')
      _mount(
        `
        <el-dropdown ref="b" placement="right" :teleported="false">
          <span class="el-dropdown-link" ref="a">
            dropdown<i class="el-icon-arrow-down el-icon--right"></i>
          </span>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item>Apple</el-dropdown-item>
              <el-dropdown-item>Orange</el-dropdown-item>
              <el-dropdown-item>Cherry</el-dropdown-item>
              <el-dropdown-item disabled>Peach</el-dropdown-item>
              <el-dropdown-item divided>Pear</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>`,
        () => ({}),
      )

      await nextTick()
      const { selector } = usePopperContainerId()
      expect(document.body.querySelector(selector.value)?.innerHTML).toBe('')
    })
  })
})
