import { nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, test } from 'vitest'
import { ElMessageBox } from '@element-plus/components/message-box'
import ConfigProvider from '@element-plus/components/config-provider'
import Overlay from '../src/overlay'

const AXIOM = 'Rem is the best girl'

describe('Overlay.vue', () => {
  test('render test', async () => {
    const wrapper = mount(() => <Overlay>{AXIOM}</Overlay>)
    expect(wrapper.text()).toEqual(AXIOM)
    const testClass = 'test-class'
    await wrapper.setProps({
      overlayClass: testClass,
    })

    expect(wrapper.find(`.${testClass}`)).toBeTruthy()
  })

  test('should emit click event', async () => {
    const wrapper = mount(() => <Overlay>{AXIOM}</Overlay>)
    await wrapper.find('.el-overlay').trigger('click')
    expect(wrapper.emitted()).toBeTruthy()
  })

  test('no mask', async () => {
    const mask = ref(true)
    const wrapper = mount(() => <Overlay mask={mask.value}>{AXIOM}</Overlay>)

    const selector = '.el-overlay'
    expect(wrapper.find(selector).exists()).toBe(true)

    mask.value = false

    await nextTick()

    expect(wrapper.find(selector).exists()).toBe(false)

    mask.value = true

    await nextTick()

    expect(wrapper.find(selector).exists()).toBe(true)
  })

  test('mask true/false share fixed full-viewport boundary (inset 0)', async () => {
    const wrapperMasked = mount(() => <Overlay mask>{AXIOM}</Overlay>)
    const maskedEl = wrapperMasked.find('.el-overlay').element as HTMLElement
    // Scrim class owns fixed + inset: 0 via theme; component only sets z-index.
    expect(maskedEl.style.position).toBe('')
    expect(maskedEl.getAttribute('style') ?? '').not.toMatch(/height:\s*100%/)

    const wrapperBare = mount(() => (
      <Overlay mask={false} overlayClass="bare-overlay">
        {AXIOM}
      </Overlay>
    ))
    const bareEl = wrapperBare.find('.bare-overlay').element as HTMLElement
    expect(bareEl.style.position).toBe('fixed')
    expect(bareEl.style.inset).toBe('0px')
    // No per-side safe-area shrink on the mask=false host.
    expect(bareEl.style.top).toBe('')
    expect(bareEl.style.right).toBe('')
    expect(bareEl.style.bottom).toBe('')
    expect(bareEl.style.left).toBe('')
    expect(bareEl.style.height).toBe('')
  })

  test('global', async () => {
    const testNamespace = 'test'
    const callout = () => {
      ElMessageBox.prompt('Title', 'Description')
    }
    const wrapper = mount(() => {
      return (
        <ConfigProvider namespace={testNamespace}>
          <button onClick={callout}>{AXIOM}</button>
        </ConfigProvider>
      )
    })

    expect(document.body.querySelector(`.${testNamespace}-overlay`)).toBeNull()
    await wrapper.find('button').trigger('click')
    await nextTick()

    expect(
      document.body.querySelector(`.${testNamespace}-overlay`)
    ).toBeDefined()
  })
})
