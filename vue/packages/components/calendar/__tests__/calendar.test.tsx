import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { clickPickerCell } from '../../../test-utils/dom'
import ConfigProvider from '@element-plus/components/config-provider'
import Chinese from '@element-plus/locale/lang/zh-cn'
import German from '@element-plus/locale/lang/de'
import updateLocale from 'dayjs/plugin/updateLocale'
import dayjs from 'dayjs'
import Calendar from '../src/calendar.vue'

const AXIOM = 'Rem is the best girl'

const setDayjsWeekStart = (weekStart = 0) => {
  dayjs.extend(updateLocale)
  const dayjsLocale = dayjs.locale()
  dayjs.updateLocale(dayjsLocale, {
    weekStart,
  })
}

const queryCalendarRows = (wrapper: { element: unknown }) => {
  return Array.from(
    (wrapper.element as HTMLElement).querySelectorAll(
      '.el-calendar-table__row',
    ),
  ) as HTMLElement[]
}

const expectCalendarTitle = (
  titleEl: { element: Element },
  expected: string,
) => {
  expect(titleEl.element.textContent?.trim()).toBe(expected)
}

describe('Calendar.vue', () => {
  it('create', async () => {
    const wrapper = mount({
      data: () => ({ value: new Date('2019-04-01') }),
      render() {
        return <Calendar v-model={(this as any).value} />
      },
    })
    const titleEl = wrapper.find('.el-calendar__title')
    expectCalendarTitle(titleEl, 'April 2019')
    expect(wrapper.element.querySelectorAll('thead th').length).toBe(7)
    const rows = queryCalendarRows(wrapper)
    expect(rows.length).toBe(5)
    await clickPickerCell(rows[4].lastElementChild as HTMLElement)

    await nextTick()
    expectCalendarTitle(titleEl, 'May 2019')
    const vm = wrapper.vm as any
    const date = vm.value
    expect(date.getFullYear()).toBe(2019)
    expect(date.getMonth()).toBe(4)
    expect(wrapper.find('.is-selected').text()).toContain('4')
  })

  it('range', () => {
    const wrapper = mount(() => (
      <Calendar range={[new Date(2019, 2, 4), new Date(2019, 2, 24)]} />
    ))
    const titleEl = wrapper.find('.el-calendar__title')
    expectCalendarTitle(titleEl, 'March 2019')
    const rows = queryCalendarRows(wrapper)
    expect(rows.length).toBe(4)
    expect(
      wrapper.element.querySelector('.el-calendar__button-group'),
    ).toBeNull()
  })

  // https://github.com/element-plus/element-plus/issues/3155
  it('range when the start date will be calculated to last month', () => {
    const wrapper = mount(() => (
      <Calendar range={[new Date(2021, 1, 2), new Date(2021, 1, 28)]} />
    ))
    const titleEl = wrapper.find('.el-calendar__title')
    expectCalendarTitle(titleEl, 'January 2021')
    const rows = queryCalendarRows(wrapper)
    expect(rows.length).toBe(5)
    expect(
      wrapper.element.querySelector('.el-calendar__button-group'),
    ).toBeNull()
  })

  it('range tow monthes', async () => {
    const wrapper = mount(() => (
      <Calendar range={[new Date(2019, 3, 14), new Date(2019, 4, 18)]} />
    ))
    const titleEl = wrapper.find('.el-calendar__title')
    expectCalendarTitle(titleEl, 'April 2019')
    const dateTables = wrapper.element.querySelectorAll(
      '.el-calendar-table.is-range',
    )
    expect(dateTables.length).toBe(2)
    const rows = queryCalendarRows(wrapper)
    expect(rows.length).toBe(5)
    const cell = Array.from(rows).at(-1)?.firstElementChild as HTMLElement
    await clickPickerCell(cell)

    await nextTick()

    expectCalendarTitle(titleEl, 'May 2019')
    expect(cell?.classList.contains('is-selected')).toBeTruthy()
  })

  // https://github.com/element-plus/element-plus/issues/3155
  it('range tow monthes when the start date will be calculated to last month', async () => {
    const wrapper = mount(() => (
      <Calendar range={[new Date(2021, 1, 2), new Date(2021, 2, 21)]} />
    ))
    const titleEl = wrapper.find('.el-calendar__title')
    expectCalendarTitle(titleEl, 'January 2021')
    const dateTables = wrapper.element.querySelectorAll(
      '.el-calendar-table.is-range',
    )
    expect(dateTables.length).toBe(3)
    const rows = queryCalendarRows(wrapper)
    expect(rows.length).toBe(8)
    const cell = rows.at(-1)?.firstElementChild as HTMLElement
    await clickPickerCell(cell)

    await nextTick()

    expectCalendarTitle(titleEl, 'March 2021')
    expect(cell?.classList.contains('is-selected')).toBeTruthy()
  })

  it('firstDayOfWeek', async () => {
    // default en locale, weekStart 0 Sunday
    const wrapper = mount({
      data: () => ({ value: new Date('2019-04-01') }),
      render() {
        return <Calendar v-model={(this as any).value} />
      },
    })
    const head = wrapper.element.querySelector('.el-calendar-table thead')
    expect(head?.firstElementChild?.innerHTML).toBe('Sun')
    expect(head?.lastElementChild?.innerHTML).toBe('Sat')
    const firstRow = wrapper.element.querySelector('.el-calendar-table__row')
    expect(firstRow?.firstElementChild?.innerHTML).toContain('31')
    expect(firstRow?.lastElementChild?.innerHTML).toContain('6')
  })

  it('firstDayOfWeek when set 1', async () => {
    setDayjsWeekStart(1)
    const wrapper = mount({
      data: () => ({ value: new Date('2019-09-01') }),
      render() {
        return <Calendar v-model={(this as any).value} />
      },
    })
    const head = wrapper.element.querySelector('.el-calendar-table thead')
    expect(head?.firstElementChild?.innerHTML).toBe('Mon')
    expect(head?.lastElementChild?.innerHTML).toBe('Sun')
    const firstRow = wrapper.element.querySelector('.el-calendar-table__row')
    expect(firstRow?.firstElementChild?.innerHTML).toContain('26')
    expect(firstRow?.lastElementChild?.innerHTML).toContain('1')
    const rows = wrapper.element.querySelectorAll('.el-calendar-table__row')
    expect(rows.length).toBe(6)
    // reset weekStart 0
    setDayjsWeekStart()
  })

  it('firstDayOfWeek in range mode', async () => {
    const wrapper = mount({
      data: () => ({ value: new Date('2019-03-04') }),
      render() {
        return (
          <Calendar
            v-model={(this as any).value}
            range={[new Date(2019, 1, 3), new Date(2019, 2, 23)]}
          />
        )
      },
    })
    const head = wrapper.element.querySelector('.el-calendar-table thead')
    expect(head?.firstElementChild?.innerHTML).toBe('Sun')
    expect(head?.lastElementChild?.innerHTML).toBe('Sat')
    const firstRow = wrapper.element.querySelector('.el-calendar-table__row')
    expect(firstRow?.firstElementChild?.innerHTML).toContain('3')
    expect(firstRow?.lastElementChild?.innerHTML).toContain('9')
  })

  it('click previous month or next month', async () => {
    const wrapper = mount({
      data: () => ({ value: new Date('2019-04-01') }),
      render() {
        return <Calendar v-model={(this as any).value} />
      },
    })
    await nextTick()
    const btns = wrapper.findAll('.el-button')
    const prevBtn = btns.at(0)
    const nextBtn = btns.at(2)
    await prevBtn?.trigger('click')
    await nextTick()
    expect(wrapper.find('.is-selected').text()).toBe('1')
    expect(
      wrapper.find('.el-calendar__body').attributes('data-motion-direction'),
    ).toBe('backward')
    await nextBtn?.trigger('click')
    await nextTick()
    expect(wrapper.find('.is-selected').text()).toBe('1')
    expect(
      wrapper.find('.el-calendar__body').attributes('data-motion-direction'),
    ).toBe('forward')
  })

  it('range two years', async () => {
    const wrapper = mount(() => (
      <Calendar range={[new Date(2022, 0, 1), new Date(2022, 0, 31)]} />
    ))
    const titleEl = wrapper.find('.el-calendar__title')
    expectCalendarTitle(titleEl, 'December 2021')
    const dateTables = wrapper.element.querySelectorAll(
      '.el-calendar-table.is-range',
    )
    expect(dateTables.length).toBe(3)
    const rows = queryCalendarRows(wrapper)
    expect(rows.length).toBe(6)
    const cell = rows.at(-1)?.firstElementChild as HTMLElement
    await clickPickerCell(cell)

    await nextTick()

    expectCalendarTitle(titleEl, 'January 2022')
    expect(cell?.classList.contains('is-selected')).toBeTruthy()
  })

  it('range two years', async () => {
    const wrapper = mount(() => (
      <Calendar range={[new Date(2021, 11, 20), new Date(2022, 0, 10)]} />
    ))
    const titleEl = wrapper.find('.el-calendar__title')
    expectCalendarTitle(titleEl, 'December 2021')
    const dateTables = wrapper.element.querySelectorAll(
      '.el-calendar-table.is-range',
    )
    expect(dateTables.length).toBe(2)
    const rows = queryCalendarRows(wrapper)
    expect(rows.length).toBe(4)
    const cell = rows.at(-1)?.firstElementChild as HTMLElement
    await clickPickerCell(cell)

    await nextTick()

    expectCalendarTitle(titleEl, 'January 2022')
    expect(cell?.classList.contains('is-selected')).toBeTruthy()
  })

  it('slots', async () => {
    const wrapper = mount(() => (
      <Calendar
        v-slots={{
          header: () => AXIOM,
          'date-cell': () => AXIOM,
        }}
      />
    ))

    expect(wrapper.find('.el-calendar__header').text()).toEqual(AXIOM)
    expect(wrapper.find('.current.is-today').text()).toEqual(AXIOM)
  })

  it('formats title by current locale order', () => {
    const wrapper = mount(() => (
      <ConfigProvider locale={Chinese}>
        <Calendar modelValue={new Date('2026-05-01')} />
      </ConfigProvider>
    ))

    expectCalendarTitle(wrapper.find('.el-calendar__title'), '2026年5月')
  })

  it('keeps accessible icon navigation and stable header source order', () => {
    const wrapper = mount(() => (
      <Calendar modelValue={new Date('2026-05-01')} />
    ))
    const header = wrapper.find('.el-calendar__header')
    const buttons = wrapper.findAll('.el-calendar__button-group button')

    expect(
      Array.from(header.element.children).map((child) => child.className),
    ).toEqual(['el-calendar__title', 'el-calendar__button-group'])
    expect(buttons).toHaveLength(3)
    expect(buttons[0].attributes('aria-label')).toBe('Previous Month')
    expect(buttons[0].attributes('title')).toBe('Previous Month')
    expect(buttons[0].find('.el-calendar__mobile-nav-icon').exists()).toBe(true)
    expect(buttons[1].attributes('aria-label')).toBe('Today')
    expect(buttons[2].attributes('aria-label')).toBe('Next Month')
    expect(buttons[2].attributes('title')).toBe('Next Month')
  })

  it('preserves long localized month titles', () => {
    const wrapper = mount(() => (
      <ConfigProvider locale={German}>
        <Calendar modelValue={new Date('2026-09-01')} />
      </ConfigProvider>
    ))

    expectCalendarTitle(wrapper.find('.el-calendar__title'), 'September 2026')
  })
})
