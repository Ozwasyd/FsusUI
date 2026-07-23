import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { Check } from '@element-plus/icons-vue'
import Breadcrumb from '../src/breadcrumb.vue'
import BreadcrumbItem from '../src/breadcrumb-item.vue'
import type { VNode } from 'vue'

const _mount = (render: () => VNode, $router = {}) =>
  mount(render, {
    global: {
      provide: {
        breadcrumb: {},
      },
      config: {
        globalProperties: {
          $router,
        } as any,
      },
    },
  })

describe('Breadcrumb.vue', () => {
  it('separator', () => {
    const wrapper = _mount(() => (
      <Breadcrumb separator="?">
        <BreadcrumbItem>A</BreadcrumbItem>
      </Breadcrumb>
    ))
    expect(wrapper.find('.el-breadcrumb__separator').text()).toBe('?')
  })

  it('separatorIcon', () => {
    const wrapper = _mount(() => (
      <Breadcrumb separatorIcon={Check}>
        <BreadcrumbItem>A</BreadcrumbItem>
      </Breadcrumb>
    ))
    expect(wrapper.find('.el-breadcrumb__separator').text()).toBe('')
    expect(wrapper.findComponent(Check).exists()).toBe(true)
  })

  it('uses native navigation and ordered-list semantics', async () => {
    const wrapper = _mount(() => (
      <Breadcrumb ariaLabel="Article location">
        <BreadcrumbItem>A</BreadcrumbItem>
        <BreadcrumbItem>B</BreadcrumbItem>
      </Breadcrumb>
    ))
    await nextTick()

    expect(wrapper.element.tagName).toBe('NAV')
    expect(wrapper.attributes('aria-label')).toBe('Article location')
    expect(wrapper.find(':scope > ol').exists()).toBe(true)
    expect(wrapper.findAll(':scope > ol > li')).toHaveLength(2)
    expect(
      wrapper.findAllComponents(BreadcrumbItem)[1].attributes(),
    ).toMatchObject({
      'aria-current': 'page',
    })
    expect(
      wrapper.findAll('.el-breadcrumb__separator')[0].attributes('aria-hidden'),
    ).toBe('true')
  })

  it('exposes a complete ordered path through the narrow-layout collapse', async () => {
    const wrapper = _mount(() => (
      <Breadcrumb>
        {['Root', 'One', 'Two', 'Parent', 'Current'].map((label, index) => (
          <BreadcrumbItem key={label} to={index < 4 ? `/${index}` : undefined}>
            {label}
          </BreadcrumbItem>
        ))}
      </Breadcrumb>
    ))
    await nextTick()

    const collapse = wrapper.find('.el-breadcrumb__collapse')
    expect(collapse.exists()).toBe(true)
    expect(
      collapse.element.parentElement?.previousElementSibling?.textContent,
    ).toContain('Root')
    expect(
      collapse
        .findAll('.el-breadcrumb__collapse-menu-item')
        .map((item) => item.text()),
    ).toEqual(['Root', 'One', 'Two', 'Parent', 'Current'])
    expect(
      wrapper
        .findAll('.el-breadcrumb__item')
        .map((item) => item.classes().includes('is-collapsed')),
    ).toEqual([false, true, true, false, false])
  })

  it('does not add a collapse affordance to a two-level path', async () => {
    const wrapper = _mount(() => (
      <Breadcrumb>
        <BreadcrumbItem>Root</BreadcrumbItem>
        <BreadcrumbItem>Current</BreadcrumbItem>
      </Breadcrumb>
    ))
    await nextTick()

    expect(wrapper.find('.el-breadcrumb__collapse').exists()).toBe(false)
  })

  it('to', () => {
    const wrapper = _mount(() => (
      <Breadcrumb separator="?" separatorIcon={Check}>
        <BreadcrumbItem to="/index">A</BreadcrumbItem>
      </Breadcrumb>
    ))
    expect(wrapper.find('.el-breadcrumb__inner').classes()).toContain('is-link')
  })

  it('single', () => {
    const wrapper = _mount(() => <BreadcrumbItem>A</BreadcrumbItem>)
    expect(wrapper.find('.el-breadcrumb__inner').text()).toBe('A')
    expect(wrapper.find('.el-breadcrumb__separator').text()).toBe('')
  })

  it('discloses the complete current label when responsive layout clamps it', async () => {
    const wrapper = _mount(() => (
      <Breadcrumb>
        <BreadcrumbItem>
          Current destination with a complete label
        </BreadcrumbItem>
      </Breadcrumb>
    ))
    await nextTick()

    expect(wrapper.find('.el-breadcrumb__inner').attributes('title')).toBe(
      'Current destination with a complete label',
    )
  })

  describe('BreadcrumbItem', () => {
    it('should set the last item as current page', () => {
      const wrapper = _mount(() => (
        <Breadcrumb>
          <BreadcrumbItem>A</BreadcrumbItem>
          <BreadcrumbItem>B</BreadcrumbItem>
        </Breadcrumb>
      ))

      const items = wrapper.findAllComponents(BreadcrumbItem)
      expect(items.at(1)!.element.getAttribute('aria-current')).toBe('page')
    })

    it('click event', async () => {
      const replace = vi.fn()
      const push = vi.fn()
      let wrapper = _mount(
        () => (
          <Breadcrumb>
            <BreadcrumbItem to="/path">A</BreadcrumbItem>
          </Breadcrumb>
        ),
        {
          replace,
          push,
        },
      )
      await wrapper.find('.el-breadcrumb__inner').trigger('click')
      expect(push).toHaveBeenCalled()
      await wrapper.find('.el-breadcrumb__inner').trigger('keydown', {
        key: 'Enter',
      })
      expect(push).toHaveBeenCalledTimes(2)
      wrapper.unmount()
      wrapper = _mount(
        () => (
          <Breadcrumb>
            <BreadcrumbItem to="/path" replace>
              A
            </BreadcrumbItem>
          </Breadcrumb>
        ),
        {
          replace,
          push,
        },
      )

      await wrapper.find('.el-breadcrumb__inner').trigger('click')
      expect(replace).toHaveBeenCalled()
    })
  })
})
