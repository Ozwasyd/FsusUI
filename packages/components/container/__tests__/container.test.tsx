import { nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, test } from 'vitest'
import { getCssVariable } from '@element-plus/test-utils/dom'

import Container from '../src/container.vue'
import Header from '../src/header.vue'
import Main from '../src/main.vue'
import Aside from '../src/aside.vue'
import Footer from '../src/footer.vue'

const AXIOM = 'Rem is the best girl'

describe('Container.vue', () => {
  test('container render test', async () => {
    const wrapper = mount(() => <Container>{AXIOM}</Container>)
    expect(wrapper.text()).toEqual(AXIOM)
  })

  test('vertical', () => {
    const wrapper = mount(() => (
      <Container>
        <Header />
        <Main />
      </Container>
    ))
    expect(wrapper.classes('is-vertical')).toBe(true)
  })

  test('direction', () => {
    const wrapper = mount({
      data: () => ({ direction: 'horizontal' }),
      render() {
        return (
          <Container direction={(this as any).direction}>
            <Header />
            <Main />
          </Container>
        )
      },
    })

    expect(wrapper.vm.$el.classList.contains('is-vertical')).toBe(false)
    ;(wrapper.vm as any).direction = 'vertical'
    wrapper.vm.$nextTick(() => {
      expect((wrapper.vm as any).$el.classList.contains('is-vertical')).toBe(true)
    })
  })

  test('only Main child is not vertical', () => {
    const wrapper = mount(() => (
      <Container>
        <Main />
      </Container>
    ))
    expect(wrapper.classes('is-vertical')).toBe(false)
  })

  test('Aside + Main is not vertical', () => {
    const wrapper = mount(() => (
      <Container>
        <Aside />
        <Main />
      </Container>
    ))
    expect(wrapper.classes('is-vertical')).toBe(false)
  })

  test('Header + Main + Footer is vertical', () => {
    const wrapper = mount(() => (
      <Container>
        <Header />
        <Main />
        <Footer />
      </Container>
    ))
    expect(wrapper.classes('is-vertical')).toBe(true)
  })

  test('full four-zone layout renders without crash', () => {
    const wrapper = mount(() => (
      <Container>
        <Header />
        <Container>
          <Aside />
          <Main />
        </Container>
        <Footer />
      </Container>
    ))
    expect(wrapper.classes()).toContain('el-container')
    expect(wrapper.find('.el-header').exists()).toBe(true)
    expect(wrapper.find('.el-aside').exists()).toBe(true)
    expect(wrapper.find('.el-main').exists()).toBe(true)
    expect(wrapper.find('.el-footer').exists()).toBe(true)
  })

  test('empty Container renders without crash', () => {
    const wrapper = mount(() => <Container />)
    expect(wrapper.classes()).toContain('el-container')
  })

  test('direction=horizontal overrides auto-detection even with Header', () => {
    const wrapper = mount(() => (
      <Container direction="horizontal">
        <Header />
        <Main />
      </Container>
    ))
    expect(wrapper.classes('is-vertical')).toBe(false)
  })
})

describe('Header', () => {
  test('create header', () => {
    const wrapper = mount(() => <Header />)
    expect(wrapper.classes()).toContain('el-header')
  })

  test('header height', () => {
    const wrapper = mount(() => <Header height="100px" />)
    const vm = wrapper.vm
    expect(getCssVariable(vm.$el, '--el-header-height')).toEqual('100px')
  })

  test('header without height prop has no CSS variable set', () => {
    const wrapper = mount(() => <Header />)
    const vm = wrapper.vm
    expect(getCssVariable(vm.$el, '--el-header-height').trim()).toBe('')
  })
})

describe('Aside', () => {
  test('aside create', () => {
    const wrapper = mount(() => <Aside />)
    expect(wrapper.classes()).toContain('el-aside')
  })

  test('aside width', () => {
    const wrapper = mount(() => <Aside width="200px" />)
    const vm = wrapper.vm
    expect(getCssVariable(vm.$el, '--el-aside-width')).toEqual('200px')
  })

  test('aside without width prop has no CSS variable set', () => {
    const wrapper = mount(() => <Aside />)
    const vm = wrapper.vm
    expect(getCssVariable(vm.$el, '--el-aside-width').trim()).toBe('')
  })
})

describe('Main', () => {
  test('main create', () => {
    const wrapper = mount(() => <Main />)
    expect(wrapper.classes()).toContain('el-main')
  })
})

describe('Footer', () => {
  test('footer create', () => {
    const wrapper = mount(() => <Footer />)
    expect(wrapper.classes()).toContain('el-footer')
  })

  test('footer height', () => {
    const wrapper = mount(() => <Footer height="100px" />)
    const vm = wrapper.vm
    expect(getCssVariable(vm.$el, '--el-footer-height')).toEqual('100px')
  })

  test('footer height CSS variable updates reactively', async () => {
    const h = ref('60px')
    const wrapper = mount({
      setup() {
        return () => <Footer height={h.value} />
      },
    })
    // Use element.style.getPropertyValue for reliable CSS variable access in jsdom
    const el = wrapper.vm.$el as HTMLElement
    expect(el.style.getPropertyValue('--el-footer-height')).toEqual('60px')
    h.value = '120px'
    await nextTick()
    expect(el.style.getPropertyValue('--el-footer-height')).toEqual('120px')
  })
})
