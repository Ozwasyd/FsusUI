import { mount } from '@vue/test-utils'
import { describe, expect, test } from 'vitest'
import { ElTaskPageHeader, FsusTaskPageHeader, taskPageHeaderEmits } from '..'

describe('TaskPageHeader', () => {
  test('renders the canonical title and readable description roles', () => {
    const wrapper = mount(() => (
      <ElTaskPageHeader
        title="Account settings"
        description="Manage profile and security preferences."
      />
    ))

    expect(wrapper.element.tagName).toBe('HEADER')
    expect(wrapper.classes()).toContain('el-task-page-header--default')
    expect(wrapper.find('.el-task-page-header__title').element.tagName).toBe(
      'H1',
    )
    expect(wrapper.find('.el-task-page-header__title').text()).toBe(
      'Account settings',
    )
    expect(wrapper.find('.el-task-page-header__description').text()).toBe(
      'Manage profile and security preferences.',
    )
  })

  test('supports typed title, description, and actions slots in source order', () => {
    const wrapper = mount(() => (
      <ElTaskPageHeader
        titleTag="h3"
        v-slots={{
          title: () => <span>Collection</span>,
          description: () => <span>Review the current result set.</span>,
          actions: () => <button type="button">Create item</button>,
        }}
      />
    ))

    expect(wrapper.find('.el-task-page-header__title').element.tagName).toBe(
      'H3',
    )
    expect(wrapper.find('.el-task-page-header__actions button').text()).toBe(
      'Create item',
    )
    expect(
      Array.from((wrapper.element as HTMLElement).children).map(
        (element) => element.className,
      ),
    ).toEqual(['el-task-page-header__heading', 'el-task-page-header__actions'])
  })

  test('does not render an empty description or decorative API surface', () => {
    const wrapper = mount(() => (
      <ElTaskPageHeader title="Dashboard" density="compact" />
    ))

    expect(wrapper.classes()).toContain('el-task-page-header--compact')
    expect(wrapper.find('.el-task-page-header__description').exists()).toBe(
      false,
    )
    expect(wrapper.find('[class*="eyebrow"]').exists()).toBe(false)
    expect(wrapper.find('img, svg').exists()).toBe(false)
  })

  test('exports both public names and an explicit empty emits contract', () => {
    expect(ElTaskPageHeader.name).toBe('ElTaskPageHeader')
    expect(FsusTaskPageHeader.name).toBe('FsusTaskPageHeader')
    expect(taskPageHeaderEmits).toEqual({})
  })
})
