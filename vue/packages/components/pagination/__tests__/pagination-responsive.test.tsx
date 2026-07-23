import { mount } from '@vue/test-utils'
import { describe, expect, test } from 'vitest'
import Pagination from '../src/pagination'

describe('Pagination responsive priority', () => {
  for (const pages of [1, 5, 20, 1000]) {
    test(`keeps a stable compact page expression for ${pages} pages`, () => {
      const wrapper = mount(() => (
        <Pagination
          responsive="auto"
          ariaLabel="文章分页"
          layout="total, sizes, prev, pager, next, jumper"
          total={pages * 10}
          defaultCurrentPage={Math.min(3, pages)}
        />
      ))

      expect(wrapper.classes()).toContain('el-pagination--responsive-auto')
      expect(wrapper.find('.el-pagination__compact-indicator').text()).toBe(
        `${Math.min(3, pages)} / ${pages}`,
      )
      expect(
        wrapper.find('.el-pagination__navigation').attributes('aria-label'),
      ).toBe('文章分页')
      expect(
        wrapper.findAll('.el-pagination__navigation > .btn-prev'),
      ).toHaveLength(1)
      expect(
        wrapper.findAll('.el-pagination__navigation > .btn-next'),
      ).toHaveLength(1)
      expect(wrapper.find('.el-pagination__compact-pager').exists()).toBe(true)
      expect(wrapper.find('.el-pagination__full-pager').exists()).toBe(true)
      expect(wrapper.find('.el-pagination__information').exists()).toBe(true)
    })
  }

  test('keeps navigation before information in DOM and keyboard order', () => {
    const wrapper = mount(() => (
      <Pagination
        responsive="auto"
        layout="total, sizes, prev, pager, next, jumper"
        total={1000}
        defaultCurrentPage={5}
      />
    ))
    const root = wrapper.find('.el-pagination')

    expect(
      Array.from(root.element.children).map((child) => child.className),
    ).toEqual([
      'el-pagination__navigation',
      'el-pagination__information is-has-total',
    ])
    expect(
      Array.from(
        wrapper.find('.el-pagination__navigation').element.children,
      ).map((child) => child.className),
    ).toEqual([
      'btn-prev',
      'el-pagination__compact-indicator',
      'el-pagination__compact-pager',
      'el-pagination__full-pager',
      'btn-next',
    ])
  })
})
