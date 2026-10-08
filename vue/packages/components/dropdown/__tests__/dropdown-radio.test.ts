import { defineComponent, nextTick } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, test, vi } from 'vitest'
import {
  ElButton,
  ElDropdown,
  ElDropdownItem,
  ElDropdownMenu,
} from '@element-plus/components'

const host = defineComponent({
  components: { ElButton, ElDropdown, ElDropdownItem, ElDropdownMenu },
  props: {
    committed: { type: String, default: 'en' },
    disabled: Boolean,
    role: { type: String, default: 'menu' },
  },
  template: `
    <el-dropdown trigger="click" :role="role" :hide-on-click="false" :teleported="false">
      <el-button>Language</el-button>
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item command="en" :checked="committed === 'en'" data-item="en">English</el-dropdown-item>
          <el-dropdown-item command="ja" :checked="committed === 'ja'" :disabled="disabled" data-item="ja">日本語</el-dropdown-item>
          <el-dropdown-item command="retry" data-item="retry">Retry</el-dropdown-item>
          <el-dropdown-item role="menuitemradio" aria-checked="true" data-item="uncontrolled">Ordinary</el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
  `,
})

async function mountMenu(props: Record<string, unknown> = {}) {
  const wrapper = mount(host, { props, attachTo: document.body })
  wrapper.getComponent(ElDropdown).vm.handleOpen()
  await flushPromises()
  await nextTick()
  return wrapper
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('Dropdown public checked state', () => {
  test('renders one consumer-committed radio and updates through props only', async () => {
    const wrapper = await mountMenu()
    expect(wrapper.findAll('[role="menuitemradio"]')).toHaveLength(2)
    expect(
      wrapper.findAll('[role="menuitemradio"][aria-checked="true"]'),
    ).toHaveLength(1)
    expect(wrapper.get('[data-item="en"]').attributes('aria-checked')).toBe(
      'true',
    )
    await wrapper.setProps({ committed: 'ja' })
    expect(wrapper.get('[data-item="en"]').attributes('aria-checked')).toBe(
      'false',
    )
    expect(wrapper.get('[data-item="ja"]').attributes('aria-checked')).toBe(
      'true',
    )
    wrapper.unmount()
  })

  test('keeps ordinary command items and removes unsupported checked attrs', async () => {
    const wrapper = await mountMenu()
    for (const item of ['retry', 'uncontrolled']) {
      expect(wrapper.get(`[data-item="${item}"]`).attributes('role')).toBe(
        'menuitem',
      )
      expect(
        wrapper.get(`[data-item="${item}"]`).attributes('aria-checked'),
      ).toBeUndefined()
    }
    wrapper.unmount()
  })

  test('activation never half-commits controlled selection or hides pending content', async () => {
    const wrapper = await mountMenu()
    const dropdown = wrapper.getComponent(ElDropdown)
    await wrapper
      .get('[data-item="ja"]')
      .trigger('keydown', { key: 'Enter', code: 'Enter' })
    expect(dropdown.emitted('command')?.[0]?.[0]).toBe('ja')
    expect(wrapper.get('[data-item="en"]').attributes('aria-checked')).toBe(
      'true',
    )
    expect(wrapper.get('[data-item="ja"]').attributes('aria-checked')).toBe(
      'false',
    )
    expect(dropdown.emitted('visible-change')?.at(-1)).toEqual([true])
    await wrapper
      .get('[data-item="retry"]')
      .trigger('keydown', { key: ' ', code: 'Space' })
    expect(dropdown.emitted('command')?.at(-1)?.[0]).toBe('retry')
    expect(wrapper.get('[data-item="en"]').attributes('aria-checked')).toBe(
      'true',
    )
    wrapper.unmount()
  })

  test('disabled radio rejects click, Enter and Space without changing the value', async () => {
    const wrapper = await mountMenu({ disabled: true })
    const item = wrapper.get('[data-item="ja"]')
    expect(item.attributes('aria-disabled')).toBe('true')
    await item.trigger('click')
    await item.trigger('keydown', { key: 'Enter', code: 'Enter' })
    await item.trigger('keydown', { key: ' ', code: 'Space' })
    expect(wrapper.getComponent(ElDropdown).emitted('command')).toBeUndefined()
    expect(wrapper.get('[data-item="en"]').attributes('aria-checked')).toBe(
      'true',
    )
    wrapper.unmount()
  })

  test('ArrowUp keyboard entry focuses the committed checked item', async () => {
    const wrapper = mount(host, {
      props: { committed: 'ja' },
      attachTo: document.body,
    })
    ;(wrapper.get('button').element as HTMLButtonElement).focus()
    await wrapper
      .get('button')
      .trigger('keydown', { key: 'ArrowUp', code: 'ArrowUp' })
    await flushPromises()
    await vi.waitFor(() => {
      expect(document.activeElement).toBe(
        wrapper.get('[data-item="ja"]').element,
      )
    })
    wrapper.unmount()
  })

  test('Escape restores the trigger after checked-item keyboard entry', async () => {
    const wrapper = mount(host, { attachTo: document.body })
    const trigger = wrapper.get('button')
    ;(trigger.element as HTMLButtonElement).focus()
    await trigger.trigger('keydown', { key: 'Enter', code: 'Enter' })
    await vi.waitFor(() => {
      expect(document.activeElement).toBe(
        wrapper.get('[data-item="en"]').element,
      )
    })
    await wrapper
      .get('[data-item="en"]')
      .trigger('keydown', { key: 'Escape', code: 'Escape' })
    await vi.waitFor(() => {
      expect(document.activeElement).toBe(trigger.element)
      expect(
        wrapper.getComponent(ElDropdown).emitted('visible-change')?.at(-1),
      ).toEqual([false])
    })
    wrapper.unmount()
  })

  test('cancelled item Escape does not restore the trigger on later outside dismissal', async () => {
    const wrapper = mount(
      defineComponent({
        components: { ElButton, ElDropdown, ElDropdownItem, ElDropdownMenu },
        template: `
          <div>
            <el-dropdown trigger="click" :hide-on-click="false" :teleported="false">
              <el-button>Language</el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item :checked="true" @keydown.esc.stop.prevent>English</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
            <button data-outside>Outside</button>
          </div>
        `,
      }),
      { attachTo: document.body },
    )
    const trigger = wrapper.get('button')
    const dropdown = wrapper.getComponent(ElDropdown)
    ;(trigger.element as HTMLButtonElement).focus()
    await trigger.trigger('keydown', { key: 'Enter', code: 'Enter' })
    await vi.waitFor(() => {
      expect(document.activeElement).toBe(
        wrapper.get('[role="menuitemradio"]').element,
      )
    })
    await wrapper
      .get('[role="menuitemradio"]')
      .trigger('keydown', { key: 'Escape', code: 'Escape' })
    await flushPromises()
    expect(dropdown.emitted('visible-change')?.at(-1)).toEqual([true])
    expect(document.activeElement).toBe(
      wrapper.get('[role="menuitemradio"]').element,
    )
    const outside = wrapper.get('[data-outside]')
    await outside.trigger('pointerdown')
    await outside.trigger('mousedown')
    ;(outside.element as HTMLButtonElement).focus()
    await outside.trigger('click')
    await vi.waitFor(() => {
      expect(dropdown.emitted('visible-change')?.at(-1)).toEqual([false])
      expect(document.activeElement).toBe(outside.element)
    })
    wrapper.unmount()
  })

  test.each([false, true])(
    'nested Escape (cancelled=%s) preserves parent state and subsequent outside focus',
    async (cancelled) => {
      const wrapper = mount(
        defineComponent({
          components: { ElButton, ElDropdown, ElDropdownItem, ElDropdownMenu },
          template: `
            <div>
              <el-dropdown trigger="click" :hide-on-click="false" :teleported="false">
                <el-button data-parent-trigger>Parent</el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item :checked="true">
                      <el-dropdown trigger="click" :hide-on-click="false" :teleported="false">
                        <el-button data-child-trigger>Child</el-button>
                        <template #dropdown>
                          <el-dropdown-menu>
                            <el-dropdown-item :checked="true" data-child-item ${cancelled ? '@keydown.esc.stop.prevent' : ''}>English</el-dropdown-item>
                          </el-dropdown-menu>
                        </template>
                      </el-dropdown>
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
              <button data-outside>Outside</button>
            </div>
          `,
        }),
        { attachTo: document.body },
      )
      const [parent, child] = wrapper.findAllComponents(ElDropdown)
      const parentTrigger = wrapper.get('[data-parent-trigger]')
      ;(parentTrigger.element as HTMLButtonElement).focus()
      await parentTrigger.trigger('keydown', { key: 'Enter', code: 'Enter' })
      await vi.waitFor(() =>
        expect(parent.emitted('visible-change')?.at(-1)).toEqual([true]),
      )
      const childTrigger = wrapper.get('[data-child-trigger]')
      ;(childTrigger.element as HTMLButtonElement).focus()
      await childTrigger.trigger('keydown', { key: 'Enter', code: 'Enter' })
      await vi.waitFor(() =>
        expect(document.activeElement).toBe(
          wrapper.get('[data-child-item]').element,
        ),
      )
      await wrapper
        .get('[data-child-item]')
        .trigger('keydown', { key: 'Escape', code: 'Escape' })
      await flushPromises()
      if (cancelled) {
        expect(child.emitted('visible-change')?.at(-1)).toEqual([true])
        expect(document.activeElement).toBe(
          wrapper.get('[data-child-item]').element,
        )
      } else {
        await vi.waitFor(() => {
          expect(child.emitted('visible-change')?.at(-1)).toEqual([false])
          expect(document.activeElement).toBe(childTrigger.element)
        })
      }
      expect(parent.emitted('visible-change')?.at(-1)).toEqual([true])
      expect(wrapper.get('[data-child-item]').attributes('aria-checked')).toBe(
        'true',
      )
      const outside = wrapper.get('[data-outside]')
      await outside.trigger('pointerdown')
      await outside.trigger('mousedown')
      ;(outside.element as HTMLButtonElement).focus()
      await outside.trigger('click')
      await vi.waitFor(() => {
        expect(parent.emitted('visible-change')?.at(-1)).toEqual([false])
        expect(child.emitted('visible-change')?.at(-1)).toEqual([false])
        expect(document.activeElement).toBe(outside.element)
      })
      wrapper.unmount()
    },
  )

  test.each(['navigation', 'group'])(
    'keeps checked state out of the %s role',
    async (role) => {
      const wrapper = await mountMenu({ role })
      const item = wrapper.get('[data-item="en"]')
      expect(item.attributes('role')).toBe(
        role === 'navigation' ? 'link' : 'button',
      )
      expect(item.attributes('aria-checked')).toBeUndefined()
      wrapper.unmount()
    },
  )

  test('Escape closes a pointer-opened popup while focus remains on its trigger', async () => {
    const wrapper = mount(host, { attachTo: document.body })
    const trigger = wrapper.get('button')
    ;(trigger.element as HTMLButtonElement).focus()
    await trigger.trigger('click')
    const dropdown = wrapper.getComponent(ElDropdown)
    await vi.waitFor(() =>
      expect(dropdown.emitted('visible-change')?.at(-1)).toEqual([true]),
    )
    await trigger.trigger('keydown', { key: 'Escape', code: 'Escape' })
    await vi.waitFor(() =>
      expect(dropdown.emitted('visible-change')?.at(-1)).toEqual([false]),
    )
    expect(document.activeElement).toBe(trigger.element)
    wrapper.unmount()
  })
})
