import type { DOMWrapper, VueWrapper } from '@vue/test-utils'

type ElementWrapper<T extends Element = Element> = DOMWrapper<T, T>
type ClickTarget = Element | ElementWrapper | VueWrapper<any>

export const getCssVariable = (el: HTMLElement, property: string) => {
  return getComputedStyle(el).getPropertyValue(property)
}

export const setInputValue = async (
  wrapper: ElementWrapper | VueWrapper<any>,
  value: string | number | boolean = true,
  selector = 'input'
) => {
  const inputWrapper =
    selector === 'input' && wrapper.element instanceof HTMLInputElement
      ? (wrapper as ElementWrapper<HTMLInputElement>)
      : wrapper.find<HTMLInputElement>(selector)

  await inputWrapper.setValue(value)
}

export const setCheckboxValue = async (
  wrapper: ElementWrapper | VueWrapper<any>,
  checked = true,
  selector = 'input'
) => {
  await setInputValue(wrapper, checked, selector)
}

export const setRadioValue = async (
  wrapper: ElementWrapper | VueWrapper<any>,
  selector = 'input'
) => {
  await setInputValue(wrapper, true, selector)
}

export const setTextInputValue = async (
  wrapper: ElementWrapper | VueWrapper<any>,
  value: string | number,
  selector = 'input'
) => {
  await setInputValue(wrapper, value, selector)
}

const clickButton = async (
  wrapper: ClickTarget,
  selector?: string,
  index = 0
) => {
  const button =
    wrapper instanceof Element
      ? selector
        ? wrapper.querySelectorAll(selector)[index] ?? wrapper.querySelector(selector)
        : wrapper
      : selector
        ? wrapper.findAll(selector)[index] ?? wrapper.find(selector)
        : wrapper

  if (button instanceof Element) {
    if ('click' in button && typeof button.click === 'function') {
      button.click()
      return
    }

    button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    return
  }

  await button.trigger('click')
}

export const clickCloseButton = async (
  wrapper: ClickTarget,
  selector?: string
) => {
  await clickButton(wrapper, selector)
}

export const clickClearButton = async (
  wrapper: ClickTarget,
  selector?: string
) => {
  await clickButton(wrapper, selector)
}

export const clickActionButton = async (
  wrapper: ClickTarget,
  selector?: string
) => {
  await clickButton(wrapper, selector)
}

export const clickPickerCell = async (
  wrapper: ClickTarget,
  selector?: string,
  index = 0
) => {
  await clickButton(wrapper, selector, index)
}

export const clickOptionItem = async (
  wrapper: ClickTarget,
  selector?: string,
  index = 0
) => {
  await clickButton(wrapper, selector, index)
}

export const clickTagCloseButton = async (
  wrapper: ClickTarget,
  index = 0,
  selector = '.el-tag__close'
) => {
  await clickButton(wrapper, selector, index)
}
