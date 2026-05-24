import { computed, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clickActionButton, clickPickerCell } from '../../../test-utils/dom'
import dayjs from 'dayjs'
import triggerEvent from '@element-plus/test-utils/trigger-event'
import { rAF } from '@element-plus/test-utils/tick'
import defineGetter from '@element-plus/test-utils/define-getter'
import { ElFormItem } from '@element-plus/components/form'
import sleep from '@element-plus/test-utils/sleep'
import TimePicker from '../src/time-picker'
import Picker from '../src/common/picker.vue'

const makeRange = (start: number, end: number) => {
  const result: number[] = []
  for (let i = start; i <= end; i++) {
    result.push(i)
  }
  return result
}

const getSpinnerTextAsArray = (dom: ParentNode, selector: string) => {
  const values = Array.prototype.slice
    .call(dom.querySelectorAll(selector))
    .map((node: Node) => Number(node.textContent))

  return Array.from(new Set(values))
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('TimePicker', () => {
  it('create & custom class & style', async () => {
    const placeholder = ref('test_')
    const readonly = ref(true)
    const wrapper = mount(() => (
      <TimePicker
        placeholder={placeholder.value}
        readonly={readonly.value}
        style="color:red"
        class="customClass"
      />
    ))

    const input = wrapper.find('input')
    expect(input.attributes('placeholder')).toBe('test_')
    expect(input.attributes('readonly')).not.toBeUndefined()
    const outterInput = wrapper.find('.el-input')
    expect(outterInput.classes()).toContain('customClass')
    expect(outterInput.attributes().style).toBeDefined()
  })

  it('set format && default value && set AM/PM spinner && no $attr to panel', async () => {
    const format = ref('hh-mm:ss A')
    const value = ref(new Date(2016, 9, 10, 18, 40))
    const wrapper = mount(() => (
      <TimePicker format={format.value} v-model={value.value} />
    ))

    await nextTick()
    const input = wrapper.find('input')
    expect(input.element.value).toBe('06-40:00 PM') // format
    input.trigger('blur')
    input.trigger('focus')
    await nextTick()
    const list = document.querySelectorAll('.el-time-spinner__list')
    const hoursEl = list[0]
    const items = hoursEl.querySelectorAll('.el-time-spinner__item')
    expect(items[0].textContent).toBe('12 AM') // am pm
    expect(items[1].textContent).toBe('01 AM')
    expect(items[12].textContent).toBe('12 PM')
    expect(items[15].textContent).toBe('03 PM')
    const times = document.querySelectorAll('.el-time-spinner__list .is-active')
    expect(times[0].textContent).toBe('06 PM')
    expect(times[1].textContent).toBe('40') // default value
    expect(times[2].textContent).toBe('00')
    const panel = document.querySelector('.el-time-panel') as any
    expect(panel.classList.contains('customClass')).toBeFalsy()
  })

  it('select time', async () => {
    const value = ref<Date | string>('')
    const wrapper = mount(() => <TimePicker v-model={value.value} />)

    const input = wrapper.find('input')
    input.trigger('blur')
    input.trigger('focus')
    await nextTick()
    const list = document.querySelectorAll('.el-time-spinner__list')
    const hoursEl = list[0]
    const minutesEl = list[1]
    const secondsEl = list[2]
    const hourEl = hoursEl.querySelectorAll('.el-time-spinner__item')[4] as any
    const minuteEl = minutesEl.querySelectorAll(
      '.el-time-spinner__item',
    )[36] as any
    const secondEl = secondsEl.querySelectorAll(
      '.el-time-spinner__item',
    )[20] as any
    // click hour, minute, second one at a time.
    await clickPickerCell(hourEl)
    await nextTick()
    await clickPickerCell(minuteEl)
    await nextTick()
    await clickPickerCell(secondEl)
    await nextTick()

    const date = value.value as Date
    expect(getSpinnerTextAsArray(hoursEl, '.is-active')).toEqual([4])
    expect(getSpinnerTextAsArray(minutesEl, '.is-active')).toEqual([36])
    expect(getSpinnerTextAsArray(secondsEl, '.is-active')).toEqual([20])
    expect(date.getHours()).toBe(4)
    expect(date.getMinutes()).toBe(36)
    expect(date.getSeconds()).toBe(20)
  })

  it('click confirm / cancel button', async () => {
    const value = ref('')
    const wrapper = mount(() => <TimePicker v-model={value.value} />)

    const input = wrapper.find('input')
    input.trigger('blur')
    input.trigger('focus')
    await nextTick()
    await clickActionButton(
      document.querySelector('.el-time-panel__btn.cancel') as HTMLElement,
    )

    expect(value.value).toBe('')
    input.trigger('blur')
    input.trigger('focus')
    await nextTick()
    await clickActionButton(
      document.querySelector('.el-time-panel__btn.confirm') as HTMLElement,
    )
    expect(value.value).toBeInstanceOf(Date)
  })

  it('should update oldValue when visible change', async () => {
    const value = ref(new Date(2016, 9, 10, 18, 40))
    const wrapper = mount(() => <TimePicker v-model={value.value} />)

    // show picker panel
    const input = wrapper.find('input')
    input.trigger('blur')
    input.trigger('focus')
    await nextTick()

    // select time
    const list = document.querySelectorAll('.el-time-spinner__list')
    const hoursEl = list[0]
    const minutesEl = list[1]
    const secondsEl = list[2]
    const hourEl = hoursEl.querySelectorAll('.el-time-spinner__item')[4] as any
    const minuteEl = minutesEl.querySelectorAll(
      '.el-time-spinner__item',
    )[36] as any
    const secondEl = secondsEl.querySelectorAll(
      '.el-time-spinner__item',
    )[20] as any
    await clickPickerCell(hourEl)
    await nextTick()
    await clickPickerCell(minuteEl)
    await nextTick()
    await clickPickerCell(secondEl)
    await nextTick()

    // click confirm button
    await clickActionButton(
      document.querySelector('.el-time-panel__btn.confirm') as HTMLElement,
    )
    const date = value.value
    expect(date.getHours()).toBe(4)
    expect(date.getMinutes()).toBe(36)
    expect(date.getSeconds()).toBe(20)

    // show picker panel and click cancel button
    input.trigger('blur')
    input.trigger('focus')
    await nextTick()
    await clickActionButton(
      document.querySelector('.el-time-panel__btn.cancel') as HTMLElement,
    )
    expect(date.getHours()).toBe(4)
    expect(date.getMinutes()).toBe(36)
    expect(date.getSeconds()).toBe(20)
  })

  it('set format', async () => {
    const value = ref('')
    const wrapper = mount(() => (
      <TimePicker v-model={value.value} format="HH:mm" />
    ))

    const input = wrapper.find('input')
    input.trigger('blur')
    input.trigger('focus')
    await nextTick()
    const spinnerDom = document.querySelectorAll('.el-time-spinner__wrapper')
    const minutesDom = spinnerDom[1]
    const secondsDom = spinnerDom[2]
    expect(minutesDom).not.toBeUndefined()
    expect(secondsDom).toBeUndefined()
  })

  it('does not reset spinner scroll position on mousemove', async () => {
    const value = ref(new Date(2016, 9, 10, 18, 40))
    const wrapper = mount(() => <TimePicker v-model={value.value} />)

    const input = wrapper.find('input')
    await input.trigger('focus')
    await nextTick()
    await rAF()
    await rAF()

    const spinner = document.querySelector<HTMLElement>(
      '.el-time-spinner__wrapper',
    )!
    const scrollWrap = spinner.querySelector<HTMLElement>(
      '.el-scrollbar__wrap',
    )!
    let scrollTop = 0
    let scrollWrites = 0
    Object.defineProperty(scrollWrap, 'scrollTop', {
      configurable: true,
      get: () => scrollTop,
      set: (value) => {
        scrollWrites += 1
        scrollTop = Number(value)
      },
    })

    spinner.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }))
    spinner.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }))
    spinner.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }))

    expect(scrollWrites).toBe(0)
    await rAF()
    expect(scrollWrites).toBe(0)
  })

  it('coalesces spinner scroll changes into one animation frame', async () => {
    const value = ref(new Date(2016, 9, 10, 18, 40))
    const wrapper = mount(() => <TimePicker v-model={value.value} />)

    const input = wrapper.find('input')
    await input.trigger('focus')
    await nextTick()
    await rAF()
    await rAF()

    const spinner = document.querySelector<HTMLElement>(
      '.el-time-spinner__wrapper',
    )!
    const scrollWrap = spinner.querySelector<HTMLElement>(
      '.el-scrollbar__wrap',
    )!
    const firstItem = spinner.querySelector<HTMLElement>(
      '.el-time-spinner__item',
    )!
    firstItem.style.height = '32px'

    scrollWrap.scrollTop = 32 * (2 * 24 + 19)
    scrollWrap.dispatchEvent(new Event('scroll'))
    scrollWrap.scrollTop = 32 * (2 * 24 + 20)
    scrollWrap.dispatchEvent(new Event('scroll'))
    scrollWrap.scrollTop = 32 * (2 * 24 + 21)
    scrollWrap.dispatchEvent(new Event('scroll'))

    expect(value.value.getHours()).toBe(18)
    await rAF()
    await nextTick()
    expect(
      spinner.querySelector<HTMLElement>('.el-time-spinner__item.is-active')
        ?.textContent,
    ).toBe('21')
    expect(value.value.getHours()).toBe(18)

    await sleep(360)
    await rAF()
    expect(value.value.getHours()).toBe(21)
  })

  it('smooths spinner wheel scroll over animation frames', async () => {
    const value = ref(new Date(2016, 9, 10, 18, 40))
    const wrapper = mount(() => <TimePicker v-model={value.value} />)

    const input = wrapper.find('input')
    await input.trigger('focus')
    await nextTick()
    await rAF()
    await rAF()

    const spinner = document.querySelector<HTMLElement>(
      '.el-time-spinner__wrapper',
    )!
    const scrollWrap = spinner.querySelector<HTMLElement>(
      '.el-scrollbar__wrap',
    )!
    const firstItem = spinner.querySelector<HTMLElement>(
      '.el-time-spinner__item',
    )!
    firstItem.style.height = '32px'

    const scrollHeightRestore = defineGetter(scrollWrap, 'scrollHeight', 6000)
    const clientHeightRestore = defineGetter(scrollWrap, 'clientHeight', 192)
    let scrollTop = 32 * (3 * 24 + 18)
    Object.defineProperty(scrollWrap, 'scrollTop', {
      configurable: true,
      get: () => scrollTop,
      set: (value) => {
        scrollTop = Number(value)
      },
    })

    const prevented = !scrollWrap.dispatchEvent(
      new WheelEvent('wheel', {
        bubbles: true,
        cancelable: true,
        deltaY: 120,
      }),
    )

    expect(prevented).toBe(true)
    expect(scrollTop).toBe(32 * (3 * 24 + 18))

    await rAF()
    expect(scrollTop).toBeGreaterThan(32 * (3 * 24 + 18))
    expect(scrollTop).toBeLessThan(32 * (3 * 24 + 18) + 32)

    scrollHeightRestore()
    clientHeightRestore()
  })

  it('marks spinner recenter scrolls as silent', async () => {
    const value = ref(new Date(2016, 9, 10, 18, 40))
    const wrapper = mount(() => <TimePicker v-model={value.value} />)

    const input = wrapper.find('input')
    await input.trigger('focus')
    await nextTick()
    await rAF()
    await rAF()

    const spinner = document.querySelector<HTMLElement>(
      '.el-time-spinner__wrapper',
    )!
    const scrollWrap = spinner.querySelector<HTMLElement>(
      '.el-scrollbar__wrap',
    )!
    const firstItem = spinner.querySelector<HTMLElement>(
      '.el-time-spinner__item',
    )!
    firstItem.style.height = '32px'

    let scrollTop = 0
    const scrollWrites: Array<{ silent?: string; value: number }> = []
    Object.defineProperty(scrollWrap, 'scrollTop', {
      configurable: true,
      get: () => scrollTop,
      set: (value) => {
        scrollTop = Number(value)
        scrollWrites.push({
          silent: scrollWrap.dataset.fsusSilentScroll,
          value: scrollTop,
        })
      },
    })

    const cycleCount =
      spinner.querySelectorAll('.el-time-spinner__item').length / 24
    const middleCycle = Math.floor(cycleCount / 2)
    const edgeCycle = cycleCount - 1

    scrollWrap.scrollTop = 32 * (edgeCycle * 24 + 13)
    scrollWrap.dispatchEvent(new Event('scroll'))
    await rAF()
    await nextTick()
    expect(
      spinner.querySelector<HTMLElement>('.el-time-spinner__item.is-active')
        ?.textContent,
    ).toBe('13')
    expect(value.value.getHours()).toBe(18)

    await sleep(360)
    await rAF()
    expect(value.value.getHours()).toBe(13)
    expect(scrollWrites).toContainEqual({
      silent: 'true',
      value: 32 * (middleCycle * 24 + 13),
    })
  })

  it('keeps spinner buffer position while safely away from edges', async () => {
    const value = ref(new Date(2016, 9, 10, 18, 40))
    const wrapper = mount(() => <TimePicker v-model={value.value} />)

    const input = wrapper.find('input')
    await input.trigger('focus')
    await nextTick()
    await rAF()
    await rAF()

    const spinner = document.querySelector<HTMLElement>(
      '.el-time-spinner__wrapper',
    )!
    const scrollWrap = spinner.querySelector<HTMLElement>(
      '.el-scrollbar__wrap',
    )!
    const firstItem = spinner.querySelector<HTMLElement>(
      '.el-time-spinner__item',
    )!
    firstItem.style.height = '32px'

    const cycleCount =
      spinner.querySelectorAll('.el-time-spinner__item').length / 24
    const middleCycle = Math.floor(cycleCount / 2)
    const safeCycle = middleCycle + 1
    const middleTarget = 32 * (middleCycle * 24 + 13)
    const safeTarget = 32 * (safeCycle * 24 + 13)

    let scrollTop = 0
    const scrollWrites: Array<{ silent?: string; value: number }> = []
    Object.defineProperty(scrollWrap, 'scrollTop', {
      configurable: true,
      get: () => scrollTop,
      set: (value) => {
        scrollTop = Number(value)
        scrollWrites.push({
          silent: scrollWrap.dataset.fsusSilentScroll,
          value: scrollTop,
        })
      },
    })

    scrollWrap.scrollTop = safeTarget + 12
    scrollWrites.length = 0
    scrollWrap.dispatchEvent(new Event('scroll'))
    await rAF()
    await nextTick()
    expect(
      spinner.querySelector<HTMLElement>('.el-time-spinner__item.is-active')
        ?.textContent,
    ).toBe('13')
    expect(value.value.getHours()).toBe(18)

    await sleep(360)
    await rAF()

    expect(value.value.getHours()).toBe(13)
    expect(scrollWrites).toContainEqual({
      silent: 'true',
      value: safeTarget,
    })
    expect(scrollWrites.some((write) => write.value === middleTarget)).toBe(
      false,
    )
  })

  it('event change, focus, blur, keydown', async () => {
    const changeHandler = vi.fn()
    const focusHandler = vi.fn()
    const blurHandler = vi.fn()
    const keydownHandler = vi.fn()
    const eventListeners = {
      onChange: changeHandler,
      onFocus: focusHandler,
      onBlur: blurHandler,
      onKeydown: keydownHandler,
    } as any

    const value = ref(new Date(2016, 9, 10, 18, 40))
    const wrapper = mount(() => (
      <TimePicker v-model={value.value} {...eventListeners} />
    ))

    const input = wrapper.find('input')
    input.trigger('focus')
    await nextTick()
    await rAF() // Set selection range causes focus to be retained
    input.element.blur()
    input.trigger('blur')
    await nextTick()
    await rAF() // Blur is delayed to ensure focus was not moved to popper
    input.trigger('keydown')
    await nextTick()
    await rAF()
    expect(focusHandler).toHaveBeenCalledTimes(1)
    expect(blurHandler).toHaveBeenCalledTimes(1)
    expect(keydownHandler).toHaveBeenCalledTimes(1)

    input.trigger('focus')
    await nextTick()
    await rAF()
    const list = document.querySelectorAll('.el-time-spinner__list')
    const hoursEl = list[0]
    const hourEl = hoursEl.querySelectorAll('.el-time-spinner__item')[4] as any
    await clickPickerCell(hourEl)
    await nextTick()
    expect(changeHandler).toHaveBeenCalledTimes(0)
    await clickActionButton(
      document.querySelector('.el-time-panel__btn.confirm') as HTMLElement,
    )
    await nextTick()
    await nextTick() // onchange is triggered by props.modelValue update
    expect(changeHandler).toHaveBeenCalledTimes(1)
  })

  it('selectableRange ', async () => {
    // ['17:30:00 - 18:30:00', '18:50:00 - 20:30:00', '21:00:00 - 22:00:00']
    const disabledHoursArr = [
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 23,
    ]
    const disabledHoursData = () => {
      return disabledHoursArr
    }
    const disabledMinutesData = (hour) => {
      // ['17:30:00 - 18:30:00', '18:50:00 - 20:30:00', '21:00:00 - 22:00:00']
      if (hour === 17) {
        return makeRange(0, 29)
      }
      if (hour === 18) {
        return makeRange(31, 49)
      }
      if (hour === 20) {
        return makeRange(31, 59)
      }
      if (hour === 22) {
        return makeRange(1, 59)
      }
    }
    const disabledSeconds = (hour, minute) => {
      if (hour === 18 && minute === 30) {
        return makeRange(1, 59)
      }
      if (hour === 20 && minute === 30) {
        return makeRange(1, 59)
      }
      if (hour === 22 && minute === 0) {
        return makeRange(1, 59)
      }
    }
    const value = ref('')
    const wrapper = mount(() => (
      <TimePicker
        v-model={value.value}
        disabled-hours={disabledHoursData}
        disabled-minutes={disabledMinutesData}
        disabled-seconds={disabledSeconds}
      />
    ))

    const input = wrapper.find('input')
    input.trigger('focus')
    await nextTick()

    const list = document.querySelectorAll('.el-time-spinner__list')
    const hoursEl = list[0]
    const minutesEl = list[1]
    const secondsEl = list[2]
    const disabledHours = getSpinnerTextAsArray(hoursEl, '.is-disabled')
    expect(disabledHours).toEqual(disabledHoursArr)
    const hourSpinners = hoursEl.querySelectorAll('.el-time-spinner__item')
    await clickPickerCell(hourSpinners[18] as HTMLElement)
    await nextTick()
    const disabledMinutes = getSpinnerTextAsArray(minutesEl, '.is-disabled')
    expect(disabledMinutes.every((t) => t > 30 && t < 50)).toBeTruthy()
    expect(disabledMinutes.length).toEqual(19)
    await clickPickerCell(hourSpinners[22] as HTMLElement)
    await nextTick()
    const enabledMinutes = getSpinnerTextAsArray(
      minutesEl,
      ':not(.is-disabled)',
    )
    const enabledSeconds = getSpinnerTextAsArray(
      secondsEl,
      ':not(.is-disabled)',
    )
    expect(enabledMinutes).toEqual([0])
    expect(enabledSeconds).toEqual([0])
  })

  it('ref focus', async () => {
    const value = ref(new Date(2016, 9, 10, 18, 40))
    const wrapper = mount(() => <TimePicker v-model={value.value} />)

    await nextTick()
    wrapper.findComponent(TimePicker).vm.$.exposed.focus()

    // This one allows mounted to take effect
    await nextTick()
    // These following two allows popper to gets rendered.
    await rAF()
    const popperEl = document.querySelector('.el-picker__popper')
    const attr = popperEl.getAttribute('aria-hidden')
    expect(attr).toEqual('false')
  })

  it('ref blur', async () => {
    const value = ref(new Date(2016, 9, 10, 18, 40))
    const wrapper = mount(() => <TimePicker v-model={value.value} />)
    const timePickerExposed = wrapper.findComponent(TimePicker).vm.$.exposed

    await nextTick()
    timePickerExposed.focus()
    await nextTick()
    timePickerExposed.blur()

    await nextTick()
    const popperEl = document.querySelector('.el-picker__popper')
    const attr = popperEl.getAttribute('aria-hidden')
    expect(attr).toEqual('false')
  })

  it('ref handleOpen', async () => {
    const value = ref(new Date(2016, 9, 10, 18, 40))
    const wrapper = mount(() => <TimePicker v-model={value.value} />)
    const timePickerExposed = wrapper.findComponent(TimePicker).vm.$.exposed

    await nextTick()
    timePickerExposed.handleOpen()

    await nextTick()
    const popperEl = document.querySelector('.el-picker__popper')
    const attr = popperEl.getAttribute('aria-hidden')
    expect(attr).toEqual('false')
  })

  it('ref handleClose', async () => {
    vi.useFakeTimers()

    const value = ref(new Date(2016, 9, 10, 18, 40))
    const wrapper = mount(() => <TimePicker v-model={value.value} />)
    const timePickerExposed = wrapper.findComponent(TimePicker).vm.$.exposed

    await nextTick()
    timePickerExposed.handleOpen()
    await nextTick()
    timePickerExposed.handleClose()

    await nextTick()
    const popperEl = document.querySelector('.el-picker__popper')
    const attr = popperEl.getAttribute('aria-hidden')
    expect(attr).toEqual('true')

    vi.useRealTimers()
  })

  it('model value should sync when disabled-hours was updated', async () => {
    const value = ref('2000-01-01 00:00:00')
    const minHour = ref('8')
    const disabledHours = computed(() => () => {
      return Array.from({ length: 24 })
        .fill(null)
        .map((_, i) => i)
        .filter((h) => h < Number.parseInt(minHour.value, 10))
    })
    mount(() => (
      <TimePicker
        v-model={value.value}
        disabled-hours={disabledHours.value}
        value-format="YYYY-MM-DD HH:mm:ss"
      />
    ))

    await nextTick()

    expect(value.value).toEqual('2000-01-01 08:00:00')
    minHour.value = '9'
    await nextTick()
    expect(value.value).toEqual('2000-01-01 09:00:00')
    minHour.value = '8'
    await nextTick()
    expect(value.value).toEqual('2000-01-01 09:00:00')
  })

  it('picker-panel should not pop up when readonly', async () => {
    const wrapper = mount(() => <TimePicker readonly />)

    const input = wrapper.find('input')
    await input.trigger('mousedown')
    await nextTick()
    expect((wrapper.findComponent(Picker).vm as any).pickerVisible).toEqual(
      false,
    )
  })

  it('picker-panel should not pop up when disabled', async () => {
    const wrapper = mount(() => <TimePicker readonly />)

    const input = wrapper.find('input')
    await input.trigger('mousedown')
    await nextTick()
    expect((wrapper.findComponent(Picker).vm as any).pickerVisible).toEqual(
      false,
    )
  })

  it('can auto skip when disabled', async () => {
    const disabledHours = () => [
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 23,
    ]
    const value = ref(new Date(2016, 9, 20, 18, 30))
    const wrapper = mount(
      () => (
        <TimePicker
          v-model={value.value}
          disabled-hours={disabledHours}
          arrow-control
        />
      ),
      {
        attachTo: document.body,
      },
    )
    const input = wrapper.find('input')
    input.trigger('focus')
    await nextTick()

    const list = document.querySelectorAll('.el-time-spinner__list')
    const hoursEl = list[0]
    let activeHours = getSpinnerTextAsArray(hoursEl, '.is-active')[0]

    expect(activeHours).toEqual(20)
    const hoursElWrapperList = document.querySelectorAll(
      '.el-time-spinner__wrapper',
    )
    const hoursElWrapper = hoursElWrapperList[0]
    const hoursElArrowDown: Element | null =
      hoursElWrapper.querySelector('.arrow-down')
    expect(hoursElArrowDown).toBeTruthy()

    const mousedownEvt = new MouseEvent('mousedown')
    const mouseupEvt = new MouseEvent('mouseup')

    const testTime = 130
    hoursElArrowDown.dispatchEvent(mousedownEvt)
    hoursElArrowDown.dispatchEvent(mouseupEvt)
    await sleep(testTime)
    activeHours = getSpinnerTextAsArray(hoursEl, '.is-active')[0]
    expect(activeHours).toEqual(21)
    hoursElArrowDown.dispatchEvent(mousedownEvt)
    hoursElArrowDown.dispatchEvent(mouseupEvt)
    await sleep(testTime)
    activeHours = getSpinnerTextAsArray(hoursEl, '.is-active')[0]
    expect(activeHours).toEqual(22)
    hoursElArrowDown.dispatchEvent(new MouseEvent('mousedown'))
    hoursElArrowDown.dispatchEvent(new MouseEvent('mouseup'))
    await sleep(testTime)
    activeHours = getSpinnerTextAsArray(hoursEl, '.is-active')[0]
    expect(activeHours).toEqual(20)
  })
})

describe('TimePicker(range)', () => {
  it('create', async () => {
    const value = ref([
      new Date(2016, 9, 10, 18, 40),
      new Date(2016, 9, 10, 19, 40),
    ])
    const wrapper = mount(
      () => <TimePicker v-model={value.value} size="small" is-range={true} />,
      {
        attachTo: document.body,
      },
    )

    expect(wrapper.find('.el-range-editor--small').exists()).toBeTruthy()
    const input = wrapper.find('input')
    input.trigger('blur')
    input.trigger('focus')
    await nextTick()
    // For skipping Transition animation
    await rAF()
    const list = document.querySelectorAll(
      '.el-time-spinner__list .el-time-spinner__item.is-active',
    )

    ;['18', '40', '00', '19', '40', '00'].forEach((_, i) => {
      expect(list[i].textContent).toBe(_)
    })
  })

  it('default value', async () => {
    const value = ref('')
    const defaultValue = ref([
      new Date(2000, 9, 1, 10, 20, 0),
      new Date(2000, 9, 1, 11, 10, 0),
    ])
    const wrapper = mount(
      () => (
        <TimePicker
          v-model={value.value}
          default-value={defaultValue.value}
          is-range={true}
        />
      ),
      {
        attachTo: document.body,
      },
    )

    const input = wrapper.find('input')
    input.trigger('blur')
    input.trigger('focus')
    await nextTick()
    // For skipping Transition animation
    await rAF()
    const list = document.querySelectorAll(
      '.el-time-spinner__list .el-time-spinner__item.is-active',
    )

    ;['10', '20', '00', '11', '10', '00'].forEach((_, i) => {
      expect(list[i].textContent).toBe(_)
    })
  })

  it('cancel button', async () => {
    const cancelDates = [
      new Date(2016, 9, 10, 9, 40),
      new Date(2016, 9, 10, 15, 40),
    ]
    const value = ref(cancelDates)
    const wrapper = mount(() => <TimePicker v-model={value.value} is-range />, {
      attachTo: document.body,
    })

    const input = wrapper.find('input')
    input.trigger('blur')
    await nextTick()
    input.trigger('focus')
    await nextTick()
    // For skipping Transition animation
    await rAF()
    await clickActionButton(
      document.querySelector('.el-time-panel__btn.cancel') as HTMLElement,
    )
    await rAF()

    expect(value.value).toEqual(cancelDates)
    expect((wrapper.findComponent(Picker).vm as any).pickerVisible).toEqual(
      false,
    )
    expect(document.querySelector('.el-picker-panel')).toBeNull()
    input.trigger('blur')
    input.trigger('focus')
    await nextTick()
    await clickActionButton(
      document.querySelector('.el-time-panel__btn.confirm') as HTMLElement,
    )
    expect(Array.isArray(value.value)).toBeTruthy()
    value.value.forEach((v: unknown) => {
      expect(v).toBeInstanceOf(Date)
    })
  })

  it('clear button', async () => {
    const value = ref([
      new Date(2016, 9, 10, 9, 40),
      new Date(2016, 9, 10, 15, 40),
    ])
    const wrapper = mount(() => <TimePicker v-model={value.value} is-range />)

    const findInputWrapper = () => wrapper.find('.el-date-editor')
    const findClear = () => wrapper.find('.el-range__close-icon')

    await nextTick()
    const inputWrapper = findInputWrapper()
    await inputWrapper.trigger('mouseenter')
    await rAF()
    const clearIcon = findClear()
    await clearIcon.trigger('click')
    await nextTick()
    expect(value.value).toEqual(null)
  })

  it('selectableRange ', async () => {
    // left ['08:00:00 - 12:59:59'] right ['11:00:00 - 16:59:59']
    const value = ref([
      new Date(2016, 9, 10, 9, 40),
      new Date(2016, 9, 10, 15, 40),
    ])
    const disabledHours = (role) => {
      if (role === 'start') {
        return makeRange(0, 7).concat(makeRange(13, 23))
      }
      return makeRange(0, 10).concat(makeRange(17, 23))
    }
    const wrapper = mount(() => (
      <TimePicker
        v-model={value.value}
        is-range
        disabled-hours={disabledHours}
      />
    ))

    const input = wrapper.find('input')
    input.trigger('focus')
    await nextTick()
    // For skipping Transition animation
    await rAF()

    const list = document.querySelectorAll('.el-time-spinner__list')
    const leftHoursEl = list[0]
    const leftEndbledHours = getSpinnerTextAsArray(
      leftHoursEl,
      ':not(.is-disabled)',
    )
    expect(leftEndbledHours).toEqual([8, 9, 10, 11, 12])
    const rightHoursEl = list[3]
    const rightEndbledHours = getSpinnerTextAsArray(
      rightHoursEl,
      ':not(.is-disabled)',
    )
    expect(rightEndbledHours).toEqual([11, 12, 13, 14, 15, 16])
    await clickPickerCell(
      leftHoursEl.querySelectorAll('.el-time-spinner__item')[12] as HTMLElement,
    )
    await nextTick()
    const NextRightEndbledHours = getSpinnerTextAsArray(
      rightHoursEl,
      ':not(.is-disabled)',
    )
    expect(NextRightEndbledHours).toEqual([12, 13, 14, 15, 16])
  })

  it('arrow key', async () => {
    const value = ref(new Date(2016, 9, 10, 18, 40))
    const wrapper = mount(() => (
      <TimePicker v-model={value.value} format="YYYY-MM-DD HH:mm:ss" />
    ))

    const input = wrapper.find('input')
    input.trigger('blur')
    input.trigger('focus')
    await nextTick()
    const initValue = input.element.value
    triggerEvent(input.element, 'keydown', 'ArrowDown')
    await nextTick()
    const addOneHour = input.element.value
    triggerEvent(input.element, 'keydown', 'ArrowRight')
    await nextTick()
    triggerEvent(input.element, 'keydown', 'ArrowDown')
    await nextTick()
    const addOneHourOneMinute = input.element.value
    expect(dayjs(initValue).diff(addOneHour, 'minute')).toEqual(-60)
    expect(dayjs(initValue).diff(addOneHourOneMinute, 'minute')).toEqual(-61)
  })

  it('should be able to inherit options from parent injection', async () => {
    const ElPopperOptions = {
      strategy: 'fixed',
    }
    const value = ref(new Date(2016, 9, 10, 18, 40))
    const options = ref(ElPopperOptions)
    const wrapper = mount(
      () => (
        <TimePicker
          v-model={value.value}
          format="YYYY-MM-DD HH:mm:ss"
          popper-options={options.value}
        />
      ),
      {
        global: {
          provide() {
            return {
              ElPopperOptions,
            }
          },
        },
      },
    )

    await nextTick()

    expect((wrapper.findComponent(Picker).vm as any).elPopperOptions).toEqual(
      ElPopperOptions,
    )
  })

  it('am/pm mode avoid render redundant content', async () => {
    const timeRange = ref([])
    const wrapper = mount(
      () => (
        <TimePicker
          v-model={timeRange.value}
          is-range
          range-separator="To"
          start-placeholder="Start time"
          end-placeholder="End time"
          arrow-control
          format="hh:mm:ss a"
        />
      ),
      {
        attachTo: document.body,
      },
    )

    const input = wrapper.find('input')
    input.trigger('blur')
    input.trigger('focus')
    await nextTick()
    // For skipping Transition animation
    await rAF()

    const list = document.querySelectorAll('.el-time-spinner__list')
    expect(
      list[0]
        .querySelector('.el-time-spinner__item.is-active')
        .innerHTML.split(' ').length,
    ).toBe(2)
    expect(
      list[1]
        .querySelector('.el-time-spinner__item.is-active')
        .innerHTML.split(' ').length,
    ).toBe(1)
    expect(
      list[2]
        .querySelector('.el-time-spinner__item.is-active')
        .innerHTML.split(' ').length,
    ).toBe(1)
  })

  describe('form item accessibility integration', () => {
    it('automatic id attachment', async () => {
      const wrapper = mount(() => (
        <ElFormItem label="Foobar" data-test-ref="item">
          <TimePicker />
        </ElFormItem>
      ))

      await nextTick()
      const formItem = wrapper.find('[data-test-ref="item"]')
      const formItemLabel = formItem.find('.el-form-item__label')
      const timePickerInput = wrapper.find('.el-input__inner')
      expect(formItem.attributes().role).toBeFalsy()
      expect(formItemLabel.attributes().for).toBe(
        timePickerInput.attributes().id,
      )
    })

    it('specified id attachment', async () => {
      const wrapper = mount(() => (
        <ElFormItem label="Foobar" data-test-ref="item">
          <TimePicker id="foobar" />
        </ElFormItem>
      ))

      await nextTick()
      const formItem = wrapper.find('[data-test-ref="item"]')
      const formItemLabel = formItem.find('.el-form-item__label')
      const timePickerInput = wrapper.find('.el-input__inner')
      expect(formItem.attributes().role).toBeFalsy()
      expect(timePickerInput.attributes().id).toBe('foobar')
      expect(formItemLabel.attributes().for).toBe(
        timePickerInput.attributes().id,
      )
    })

    it('form item role is group when multiple inputs', async () => {
      const wrapper = mount(() => (
        <ElFormItem label="Foobar" data-test-ref="item">
          <TimePicker />
          <TimePicker />
        </ElFormItem>
      ))

      await nextTick()
      const formItem = wrapper.find('[data-test-ref="item"]')
      expect(formItem.attributes().role).toBe('group')
    })
  })

  describe('dismiss events restore picker', () => {
    let wrapper: ReturnType<typeof mount>

    const findInput = () =>
      wrapper.findComponent({
        name: 'ElInput',
      })
    const findClear = () => wrapper.find('.clear-icon')
    const findPicker = () =>
      wrapper.findComponent({
        name: 'Picker',
      })

    beforeEach(() => {
      const value = ref(new Date(2016, 9, 10, 18, 40))
      wrapper = mount(() => <TimePicker v-model={value.value} ref="input" />, {
        attachTo: document.body,
      })
    })

    afterEach(() => {
      wrapper.unmount()
    })

    it('should be able to focus back and callout picker after clear', async () => {
      await nextTick()
      const input = findInput()
      await input.trigger('mouseenter')
      await rAF()
      const clearIcon = findClear()
      await clearIcon.trigger('click')
      await rAF()
      expect(document.activeElement).toBe(wrapper.find('input').element)
      expect(document.querySelector('.el-time-panel')).toBeFalsy()
      await input.vm.$emit('input', 'a')
      await rAF()
      expect(document.querySelector('.el-time-panel')).toBeTruthy()
    })

    it('should be able to focus back and callout picker after pick', async () => {
      await nextTick()
      const picker = findPicker()
      const input = findInput()
      input.vm.$emit('input', 'a')
      await rAF()
      expect(document.querySelector('.el-time-panel')).toBeTruthy()
      picker.vm.onPick('', false)
      await rAF() // Picker triggers popup close, event propagation
      await rAF() // Focus trap recognizes focusout event, and propagation
      expect(document.activeElement).toBe(wrapper.find('input').element)
      expect(document.querySelector('.el-time-panel')).toBeFalsy()
      input.vm.$emit('input', 'a')
      await rAF()
      expect(document.querySelector('.el-time-panel')).toBeTruthy()
    })
  })

  it('display value', async () => {
    const value = ref([undefined, undefined])
    const wrapper = mount(() => <TimePicker v-model={value.value} is-range />)

    await nextTick()

    const [startInput, endInput] = wrapper.findAll('input')
    expect(startInput.element.value).toBe('')
    expect(endInput.element.value).toBe('')
  })
})
