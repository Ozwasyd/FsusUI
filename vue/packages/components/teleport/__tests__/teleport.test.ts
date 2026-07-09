import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import Teleport from '../src/teleport.vue'
import type { VueWrapper } from '@vue/test-utils'
import type { TeleportInstance } from '../src/teleport'

const AXIOM = 'rem is the best girl'

const normalizeComputedStyleValue = (property: string, value: string) => {
  const element = document.createElement('div')

  element.style.setProperty(property, value)
  document.body.appendChild(element)

  const normalizedValue = getComputedStyle(element).getPropertyValue(property)

  element.remove()
  return normalizedValue
}

describe('ElTeleport', () => {
  let wrapper: VueWrapper<TeleportInstance>

  beforeEach(() => {
    wrapper = mount(Teleport, {
      slots: { default: () => AXIOM },
    })
  })

  afterEach(() => {
    wrapper.unmount()
  })

  it('should render slot correctly', () => {
    expect(wrapper.text()).toBe('')
    expect(document.body.textContent).toBe(AXIOM)
    expect(wrapper.vm.containerRef).toBeDefined()
  })

  describe('props', () => {
    it('should be able to set customized style', async () => {
      const style = {
        color: 'red',
      }

      await wrapper.setProps({ style })
      const expectedColor = normalizeComputedStyleValue('color', style.color)
      const container = wrapper.vm?.containerRef

      expect(container).toBeTruthy()

      expect(getComputedStyle(container as HTMLElement).color).toBe(expectedColor)
    })

    it('should be able to set z-index', async () => {
      const zIndex = '10000'
      await wrapper.setProps({ zIndex })
      const container = wrapper.vm?.containerRef

      expect(container).toBeTruthy()
      expect(getComputedStyle(container as HTMLElement).zIndex).toBe(zIndex)
    })
  })
})
