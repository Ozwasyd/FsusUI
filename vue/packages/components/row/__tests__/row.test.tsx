import { nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import Row from '../src/row.vue'
import Col from '@element-plus/components/col'

describe('Row.vue', () => {
  it('renders custom tag, alignment classes, and gutter styles', () => {
    const wrapper = mount(() => (
      <Row tag="section" gutter={20} justify="center" align="middle">
        <Col span={12}>content</Col>
      </Row>
    ))

    expect(wrapper.element.tagName).toBe('SECTION')
    expect(wrapper.classes()).toContain('el-row')
    expect(wrapper.classes()).toContain('is-justify-center')
    expect(wrapper.classes()).toContain('is-align-middle')
    expect((wrapper.element as HTMLElement).style.marginLeft).toBe('-10px')
    expect((wrapper.element as HTMLElement).style.marginRight).toBe('-10px')
  })

  it('updates provided gutter for child columns', async () => {
    const gutter = ref(12)
    const wrapper = mount({
      setup() {
        return () => (
          <Row gutter={gutter.value} ref="row">
            <Col span={12} ref="col" />
          </Row>
        )
      },
    })

    const row = wrapper.findComponent({ ref: 'row' }).element as HTMLElement
    const col = wrapper.findComponent({ ref: 'col' }).element as HTMLElement

    expect(row.style.marginLeft).toBe('-6px')
    expect(col.style.paddingLeft).toBe('6px')

    gutter.value = 24
    await nextTick()

    expect(row.style.marginLeft).toBe('-12px')
    expect(col.style.paddingLeft).toBe('12px')
  })
})
