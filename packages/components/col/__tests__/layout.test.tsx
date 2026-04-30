import { nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it, test } from 'vitest'
import Row from '@element-plus/components/row'
import Col from '../src/col.vue'

describe('Col', () => {
  it('create', () => {
    const wrapper = mount(() => <Col />)
    expect(wrapper.classes()).toContain('el-col')
  })

  it('span', () => {
    const wrapper = mount(() => <Col span={12} />)
    expect(wrapper.classes()).toContain('el-col-12')
  })

  it('pull', () => {
    const wrapper = mount(() => <Col span={12} pull={3} />)
    expect(wrapper.classes()).toContain('el-col-pull-3')
  })

  it('push', () => {
    const wrapper = mount(() => <Col span={12} push={3} />)
    expect(wrapper.classes()).toContain('el-col-push-3')
  })

  it('gutter', () => {
    const wrapper = mount({
      setup() {
        return () => (
          <Row gutter={20}>
            <Col span={12} ref="col"></Col>
          </Row>
        )
      },
    })

    const colElm = wrapper.findComponent({ ref: 'col' }).element as HTMLElement
    expect(colElm.style.paddingLeft === '10px').toBe(true)
    expect(colElm.style.paddingRight === '10px').toBe(true)
  })

  it('change gutter value', async () => {
    const outer = ref(20)

    const wrapper = mount({
      setup() {
        return () => (
          <Row gutter={outer.value} ref="row">
            <Col span={12} ref="col" />
          </Row>
        )
      },
    })

    const rowElm = wrapper.findComponent({ ref: 'row' }).element as HTMLElement
    const colElm = wrapper.findComponent({ ref: 'col' }).element as HTMLElement
    expect(rowElm.style.marginLeft === '-10px').toBe(true)
    expect(rowElm.style.marginRight === '-10px').toBe(true)
    expect(colElm.style.paddingLeft === '10px').toBe(true)
    expect(colElm.style.paddingRight === '10px').toBe(true)

    outer.value = 40 // change gutter value
    await nextTick()
    expect(rowElm.style.marginLeft === '-20px').toBe(true)
    expect(rowElm.style.marginRight === '-20px').toBe(true)
    expect(colElm.style.paddingLeft === '20px').toBe(true)
    expect(colElm.style.paddingRight === '20px').toBe(true)
  })

  it('responsive', () => {
    const wrapper = mount({
      setup() {
        return () => (
          <Row gutter={20}>
            <Col
              ref="col"
              sm={{ span: 4, offset: 2 }}
              md={8}
              lg={{ span: 6, offset: 3 }}
            />
          </Row>
        )
      },
    })

    const colElmClass = wrapper.findComponent({ ref: 'col' }).classes()
    expect(colElmClass.includes('el-col-sm-4')).toBe(true)
    expect(colElmClass.includes('el-col-sm-4')).toBe(true)
    expect(colElmClass.includes('el-col-sm-offset-2')).toBe(true)
    expect(colElmClass.includes('el-col-lg-6')).toBe(true)
    expect(colElmClass.includes('el-col-lg-offset-3')).toBe(true)
    expect(colElmClass.includes('el-col-md-8')).toBe(true)
  })

  it('span=0 renders without crash', () => {
    const wrapper = mount(() => <Col span={0} />)
    expect(wrapper.classes()).toContain('el-col-0')
  })

  it('span=24 fills full row', () => {
    const wrapper = mount(() => <Col span={24} />)
    expect(wrapper.classes()).toContain('el-col-24')
  })

  it('offset=0 produces no offset class', () => {
    const wrapper = mount(() => <Col span={12} offset={0} />)
    const classes = wrapper.classes()
    expect(classes.some((c) => c.startsWith('el-col-offset-'))).toBe(false)
  })

  it('offset=24 produces max offset class', () => {
    const wrapper = mount(() => <Col span={0} offset={24} />)
    expect(wrapper.classes()).toContain('el-col-offset-24')
  })

  it('custom tag renders correct element', () => {
    const wrapper = mount(() => <Col tag="article" />)
    expect(wrapper.element.tagName.toLowerCase()).toBe('article')
  })

  it('all five responsive breakpoints applied simultaneously', () => {
    const wrapper = mount({
      setup() {
        return () => (
          <Row>
            <Col ref="col" xs={4} sm={6} md={8} lg={10} xl={12} />
          </Row>
        )
      },
    })
    const classes = wrapper.findComponent({ ref: 'col' }).classes()
    expect(classes).toContain('el-col-xs-4')
    expect(classes).toContain('el-col-sm-6')
    expect(classes).toContain('el-col-md-8')
    expect(classes).toContain('el-col-lg-10')
    expect(classes).toContain('el-col-xl-12')
  })

  it('responsive ColSizeObject supports pull/push', () => {
    const wrapper = mount({
      setup() {
        return () => (
          <Row>
            <Col ref="col" sm={{ span: 8, pull: 2, push: 2 }} />
          </Row>
        )
      },
    })
    const classes = wrapper.findComponent({ ref: 'col' }).classes()
    expect(classes).toContain('el-col-sm-8')
    expect(classes).toContain('el-col-sm-pull-2')
    expect(classes).toContain('el-col-sm-push-2')
  })

  it('gutter=0 does not apply padding to col', () => {
    const wrapper = mount({
      setup() {
        return () => (
          <Row gutter={0}>
            <Col span={12} ref="col" />
          </Row>
        )
      },
    })
    const colElm = wrapper.findComponent({ ref: 'col' }).element as HTMLElement
    expect(colElm.style.paddingLeft).toBe('')
    expect(colElm.style.paddingRight).toBe('')
  })

  it('multiple cols in one row each get correct span class', () => {
    const wrapper = mount({
      setup() {
        return () => (
          <Row>
            <Col ref="a" span={8} />
            <Col ref="b" span={8} />
            <Col ref="c" span={8} />
          </Row>
        )
      },
    })
    expect(wrapper.findComponent({ ref: 'a' }).classes()).toContain('el-col-8')
    expect(wrapper.findComponent({ ref: 'b' }).classes()).toContain('el-col-8')
    expect(wrapper.findComponent({ ref: 'c' }).classes()).toContain('el-col-8')
  })
})

describe('Row', () => {
  test('create', () => {
    const wrapper = mount(() => <Row />)
    expect(wrapper.classes()).toContain('el-row')
  })

  test('gutter', () => {
    const wrapper = mount(() => <Row gutter={20} />)
    const rowElm = wrapper.element as HTMLElement
    expect(rowElm.style.marginLeft).toEqual('-10px')
    expect(rowElm.style.marginRight).toEqual('-10px')
  })

  test('justify', () => {
    const wrapper = mount(() => <Row justify="end" />)
    expect(wrapper.classes()).toContain('is-justify-end')
  })

  test('align', () => {
    const wrapper = mount(() => <Row align="bottom" />)
    expect(wrapper.classes()).toContain('is-align-bottom')
  })

  test('justify all values', () => {
    const justifyValues = [
      'center',
      'space-around',
      'space-between',
      'space-evenly',
    ] as const
    for (const justify of justifyValues) {
      const wrapper = mount(() => <Row justify={justify} />)
      expect(wrapper.classes()).toContain(`is-justify-${justify}`)
    }
  })

  test('align top and middle', () => {
    const wrapper1 = mount(() => <Row align="top" />)
    expect(wrapper1.classes()).toContain('is-align-top')
    const wrapper2 = mount(() => <Row align="middle" />)
    expect(wrapper2.classes()).toContain('is-align-middle')
  })

  test('custom tag renders correct element', () => {
    const wrapper = mount(() => <Row tag="section" />)
    expect(wrapper.element.tagName.toLowerCase()).toBe('section')
  })

  test('gutter=0 does not apply margin', () => {
    const wrapper = mount(() => <Row gutter={0} />)
    const rowElm = wrapper.element as HTMLElement
    expect(rowElm.style.marginLeft).toBe('')
    expect(rowElm.style.marginRight).toBe('')
  })

  test('no align/justify props produce no modifier classes', () => {
    const wrapper = mount(() => <Row />)
    const classes = wrapper.classes()
    expect(classes.some((c) => c.startsWith('is-justify-'))).toBe(false)
    expect(classes.some((c) => c.startsWith('is-align-'))).toBe(false)
  })
})
