import { defineComponent } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, test } from 'vitest'
import {
  ElButton,
  ElDropdown,
  ElDropdownItem,
  ElDropdownMenu,
} from '@element-plus/components'

const host = defineComponent({
  components: { ElButton, ElDropdown, ElDropdownItem, ElDropdownMenu },
  props: {
    multiline: Boolean,
    checked: Boolean,
    disabled: Boolean,
    viewportBounded: Boolean,
  },
  template: `<el-dropdown trigger="click" :teleported="false" :viewport-bounded="viewportBounded">
    <el-button>Language</el-button>
    <template #dropdown><el-dropdown-menu>
      <el-dropdown-item command="ja" :multiline="multiline" :checked="checked" :disabled="disabled" text-value="日本語">
        日本語<template #description>Japanese</template><template #suffix><span aria-hidden="true">Pending</span></template>
      </el-dropdown-item>
    </el-dropdown-menu></template>
  </el-dropdown>`,
})

async function open(props: Record<string, boolean>) {
  const wrapper = mount(host, { props, attachTo: document.body })
  wrapper.getComponent(ElDropdown).vm.handleOpen()
  await flushPromises()
  return wrapper
}

describe('Dropdown explicit rich content', () => {
  test('requires opt-in for description and preserves ordinary row structure', async () => {
    const wrapper = await open({})
    expect(wrapper.find('.el-dropdown-menu__item-description').exists()).toBe(
      false,
    )
    expect(wrapper.get('[role="menuitemradio"]').classes()).not.toContain(
      'is-multiline',
    )
    expect(wrapper.get('.el-dropdown-menu__item-suffix').text()).toBe('Pending')
    wrapper.unmount()
  })

  test('keeps description/status in one checked item and uses the existing selected state', async () => {
    const wrapper = await open({
      multiline: true,
      checked: true,
      viewportBounded: true,
    })
    const item = wrapper.get('[role="menuitemradio"]')
    expect(item.classes()).toContain('is-multiline')
    expect(item.classes()).toContain('selected')
    expect(item.attributes('aria-checked')).toBe('true')
    expect(wrapper.get('.el-dropdown-menu__item-description').text()).toBe(
      'Japanese',
    )
    expect(item.findAll('button, a, input')).toHaveLength(0)
    await item.trigger('keydown', { key: 'Enter', code: 'Enter' })
    expect(wrapper.getComponent(ElDropdown).emitted('command')?.[0]?.[0]).toBe(
      'ja',
    )
    wrapper.unmount()
  })

  test('disabled multiline content retains semantics and rejects command activation', async () => {
    const wrapper = await open({ multiline: true, disabled: true })
    const item = wrapper.get('[role="menuitemradio"]')
    expect(item.attributes('aria-disabled')).toBe('true')
    await item.trigger('keydown', { key: ' ', code: 'Space' })
    await item.trigger('click')
    expect(wrapper.getComponent(ElDropdown).emitted('command')).toBeUndefined()
    wrapper.unmount()
  })
})
