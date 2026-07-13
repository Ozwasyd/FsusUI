import { mount } from '@vue/test-utils'
import { describe, expect, test } from 'vitest'
import Empty from '../src/empty.vue'

const AXIOM = 'Rem is the best girl'

describe('Empty.vue', () => {
  test('render test', () => {
    const wrapper = mount(() => <Empty>{AXIOM}</Empty>)
    expect(wrapper.find('.el-empty__image').exists()).toBe(true)
    expect(wrapper.find('.el-empty__description').exists()).toBe(true)
    expect(wrapper.find('.el-empty__bottom').exists()).toBe(true)
  })

  test('should render image props', () => {
    const wrapper = mount(() => <Empty image={AXIOM} />)
    const image = wrapper.find('.el-empty__image img')

    expect(image.exists()).toBe(true)
    expect(image.attributes('src')).toBe(AXIOM)
    expect(image.attributes('alt')).toBe('')
    expect(image.attributes('aria-hidden')).toBe('true')
  })

  test('should render imageSize props', async () => {
    const wrapper = mount(() => <Empty imageSize={500} />)
    expect(wrapper.find('.el-empty__image').attributes('style')).toContain(
      'width: 500px'
    )
  })

  test('should render description props', () => {
    const wrapper = mount(() => <Empty description={AXIOM} />)
    expect(wrapper.find('.el-empty__description').text()).toEqual(AXIOM)
  })

  test('should render description layout and width props', () => {
    const wrapper = mount(() => (
      <Empty description={AXIOM} descriptionLayout="wide" descriptionWidth={360} />
    ))
    const description = wrapper.find('.el-empty__description')

    expect(description.classes()).toContain('el-empty__description--wide')
    expect(description.attributes('style')).toContain('max-width: 360px')
  })

  test('should render image slots', () => {
    const wrapper = mount(() => (
      <Empty
        v-slots={{
          image: () => AXIOM,
        }}
      />
    ))
    expect(wrapper.find('.el-empty__image').text()).toEqual(AXIOM)
  })

  test('should render description slots', () => {
    const wrapper = mount(() => (
      <Empty
        v-slots={{
          description: () => AXIOM,
        }}
      />
    ))
    expect(wrapper.find('.el-empty__description').text()).toEqual(AXIOM)
  })

  test('should render default slots', async () => {
    const wrapper = mount(() => (
      <Empty
        v-slots={{
          default: () => AXIOM,
        }}
      />
    ))
    expect(wrapper.find('.el-empty__bottom').text()).toEqual(AXIOM)
  })
})

describe('Empty.vue svg visual regressions', () => {
  test('default illustration is a quiet decorative document structure', () => {
    const wrapper = mount(() => <Empty />)
    const svg = wrapper.find('.el-empty__image svg')

    expect(svg.exists()).toBe(true)
    expect(svg.attributes('aria-hidden')).toBe('true')
    expect(svg.attributes('focusable')).toBe('false')
    expect(svg.attributes('fill')).toBe('none')
    expect(svg.attributes('stroke')).toBe('currentColor')
    expect(svg.attributes('stroke-linejoin')).toBe('round')
    expect(svg.attributes('stroke-linecap')).toBe('round')
    expect(svg.findAll('path')).toHaveLength(4)
    expect(svg.findAll('circle')).toHaveLength(0)
    expect(svg.findAll('linearGradient')).toHaveLength(0)
    expect(svg.html()).not.toMatch(/orbit|node|glow|animation|color-primary/i)
  })
})
