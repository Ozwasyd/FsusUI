import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, test } from 'vitest'
import ThemeModeToggle from '../src/theme-mode-toggle.vue'
import { clearThemeMode } from '@element-plus/components/config-provider'

describe('ThemeModeToggle.vue', () => {
  afterEach(() => {
    clearThemeMode()
  })

  test('renders compact visibility classes', () => {
    const wrapper = mount(() => (
      <ThemeModeToggle compact visibility="mobile" modelValue="system" />
    ))

    expect(wrapper.classes()).toContain('el-theme-mode-toggle--mobile')
    expect(wrapper.classes()).toContain('is-compact')
    expect(wrapper.attributes('data-theme-mode-visibility')).toBe('mobile')
    expect(
      wrapper.element.matches('.el-radio-group.el-theme-mode-toggle'),
    ).toBe(true)
  })

  test('emits and syncs selected theme mode', async () => {
    const wrapper = mount(ThemeModeToggle, {
      props: {
        modelValue: 'light',
      },
    })

    await wrapper.find('input[value="dark"]').setValue()

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['dark'])
    expect(wrapper.emitted('change')?.[0]).toEqual(['dark'])
    expect(document.documentElement.dataset.themeMode).toBe('light')

    await wrapper.setProps({ modelValue: 'dark' })
    expect(document.documentElement.dataset.themeMode).toBe('dark')
  })
})
