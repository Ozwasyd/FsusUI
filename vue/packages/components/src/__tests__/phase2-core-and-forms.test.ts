import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, reactive, ref } from 'vue'
import {
  FsusAlert,
  FsusBadge,
  FsusButton,
  FsusCalendar,
  FsusCard,
  FsusCascader,
  FsusCheckbox,
  FsusCheckboxGroup,
  FsusCheckTag,
  FsusColorPicker,
  FsusConfigProvider,
  FsusDatePicker,
  FsusDialog,
  FsusDrawer,
  FsusEmptyState,
  FsusForm,
  FsusFormItem,
  FsusInput,
  FsusInputNumber,
  FsusMessage,
  FsusNotification,
  FsusProgress,
  FsusRadio,
  FsusRadioGroup,
  FsusRate,
  FsusResult,
  FsusRow,
  FsusCol,
  FsusSelect,
  FsusSkeleton,
  FsusSlider,
  FsusSwitch,
  FsusTag,
  FsusThemeModeToggle,
  FsusTimePicker,
  FsusTimeSelect,
  FsusTooltip,
  FsusTransfer,
  FsusUpload,
} from '../index'

describe('Phase 2 Core, Overlay & Form Components', () => {
  it('renders FsusButton with native data-* attributes and respects loading/disabled', async () => {
    const w = mount(FsusButton, {
      props: { variant: 'primary', size: 'sm' },
      slots: { default: 'Save' },
    })
    expect(w.classes()).toContain('fsus-button')
    expect(w.attributes('data-variant')).toBe('primary')
    expect(w.attributes('data-size')).toBe('sm')
    await w.trigger('click')
    expect(w.emitted('click')).toHaveLength(1)

    await w.setProps({ loading: true })
    expect(w.attributes('aria-busy')).toBe('true')
    await w.trigger('click')
    expect(w.emitted('click')).toHaveLength(1)
  })

  it('renders Grid layout, Card, Badge, Tag, CheckTag, Alert, Progress, Result, Skeleton, EmptyState', async () => {
    const grid = mount(FsusRow, {
      props: { gutter: 16 },
      slots: { default: () => h(FsusCol, { span: 12 }, () => 'Half') },
    })
    expect(grid.find('.fsus-col').text()).toBe('Half')
    expect(mount(FsusCard, { props: { header: 'Title' } }).find('.fsus-card__header').text()).toBe('Title')
    expect(mount(FsusBadge, { props: { value: 120, max: 99 } }).find('.fsus-badge__content').text()).toBe('99+')
    expect(mount(FsusTag, { props: { tone: 'success' }, slots: { default: 'OK' } }).text()).toBe('OK')

    const ct = mount(FsusCheckTag, { props: { modelValue: false }, slots: { default: 'Filter' } })
    await ct.trigger('click')
    expect(ct.emitted('update:modelValue')?.[0]).toEqual([true])

    expect(mount(FsusAlert, { props: { title: 'Heads up' } }).attributes('role')).toBe('alert')
    expect(mount(FsusProgress, { props: { percentage: 60 } }).attributes('aria-valuenow')).toBe('60')
    expect(mount(FsusResult, { props: { title: 'Done' } }).text()).toContain('Done')
    expect(mount(FsusSkeleton, { props: { rows: 4 } }).findAll('.fsus-skeleton__item')).toHaveLength(4)
    expect(mount(FsusEmptyState, { props: { title: 'Nothing' } }).text()).toContain('Nothing')
  })

  it('handles Dialog, Drawer, Tooltip, Message, Notification, and ThemeModeToggle', async () => {
    const dlg = mount(FsusDialog, {
      props: { open: true, title: 'Settings', teleported: false },
      slots: { default: 'Body' },
    })
    expect(dlg.find('[role="dialog"]').text()).toContain('Settings')

    const drw = mount(FsusDrawer, {
      props: { open: true, title: 'Inspect', placement: 'right', teleported: false },
    })
    expect(drw.find('.fsus-drawer').attributes('data-placement')).toBe('right')

    const tip = mount(FsusTooltip, {
      props: { content: 'Help', open: true, teleported: false },
      slots: { default: 'Hover' },
    })
    expect(tip.find('[role="tooltip"]').text()).toBe('Help')

    const msg = FsusMessage.success('Saved')
    expect(document.body.textContent).toContain('Saved')
    msg.close()

    const notif = FsusNotification.info({ title: 'Synced' })
    expect(document.body.textContent).toContain('Synced')
    notif.close()

    const toggle = mount(FsusThemeModeToggle, { props: { modelValue: 'light', syncDocument: false } })
    await toggle.trigger('click')
    expect(toggle.emitted('update:modelValue')?.[0]).toEqual(['dark'])
  })

  it('validates FsusForm with native rules + Standard Schema', async () => {
    const model = reactive({ email: '' })
    const formRef = ref<InstanceType<typeof FsusForm> | null>(null)
    const Host = defineComponent({
      setup() {
        return () =>
          h(FsusConfigProvider, { size: 'sm' }, () =>
            h(
              FsusForm,
              {
                ref: formRef,
                model,
                rules: {
                  email: [{ required: true, message: 'Email required' }, { type: 'email', message: 'Bad email' }],
                },
              },
              () =>
                h(FsusFormItem, { label: 'Email', prop: 'email' }, () =>
                  h(FsusInput, {
                    modelValue: model.email,
                    'onUpdate:modelValue': (v: string | number) => (model.email = String(v)),
                  }),
                ),
            ),
          )
      },
    })
    const w = mount(Host)
    const r1 = await formRef.value!.validate()
    expect(r1.ok).toBe(false)
    expect(w.text()).toContain('Email required')

    model.email = 'ok@fsus.dev'
    const r2 = await formRef.value!.validate()
    expect(r2.ok).toBe(true)
  })

  it('handles InputNumber, CheckboxGroup, RadioGroup, Switch, Slider, Rate', async () => {
    const num = mount(FsusInputNumber, { props: { modelValue: 5, step: 2 } })
    await num.findAll('button')[1]!.trigger('click')
    expect(num.emitted('update:modelValue')?.[0]).toEqual([7])

    const cbg = mount(FsusCheckboxGroup, {
      props: { modelValue: ['a'] },
      slots: {
        default: () => [
          h(FsusCheckbox, { value: 'a', label: 'A' }),
          h(FsusCheckbox, { value: 'b', label: 'B' }),
        ],
      },
    })
    await cbg.findAll('input')[1]!.trigger('change')
    expect(cbg.emitted('update:modelValue')?.[0]).toEqual([['a', 'b']])

    const rg = mount(FsusRadioGroup, {
      props: { modelValue: 'x' },
      slots: { default: () => [h(FsusRadio, { value: 'x' }), h(FsusRadio, { value: 'y' })] },
    })
    await rg.findAll('input')[1]!.trigger('change')
    expect(rg.emitted('update:modelValue')?.[0]).toEqual(['y'])

    const sw = mount(FsusSwitch, { props: { modelValue: false } })
    await sw.trigger('click')
    expect(sw.emitted('update:modelValue')?.[0]).toEqual([true])

    const sl = mount(FsusSlider, { props: { modelValue: 20, step: 10 } })
    await sl.find('[role="slider"]').trigger('keydown', { key: 'ArrowRight' })
    expect(sl.emitted('update:modelValue')?.[0]).toEqual([30])

    const rate = mount(FsusRate, { props: { modelValue: 2 } })
    await rate.findAll('button')[3]!.trigger('click')
    expect(rate.emitted('update:modelValue')?.[0]).toEqual([4])
  })

  it('supports unified FsusSelect (standard + automatic virtualization for 200 items), Cascader, Transfer, Pickers & Calendar', async () => {
    const manyOptions = Array.from({ length: 200 }, (_, i) => ({ value: i, label: `Item ${i}` }))
    const sel = mount(FsusSelect, {
      props: { modelValue: null, options: manyOptions, teleported: false, virtualThreshold: 50 },
    })
    await sel.find('.fsus-select').trigger('click')
    // Virtualized spacer should render far fewer than 200 DOM nodes!
    expect(sel.find('.fsus-select__virtual-spacer').exists()).toBe(true)
    expect(sel.findAll('[role="option"]').length).toBeLessThan(30)
    await sel.find('[role="option"]').trigger('click')
    expect(sel.emitted('update:modelValue')?.[0]).toEqual([0])

    expect(
      mount(FsusCascader, {
        props: { options: [{ value: 'a', label: 'A', children: [{ value: 'b', label: 'B' }] }], modelValue: ['a', 'b'] },
      }).text(),
    ).toContain('A / B')

    const tr = mount(FsusTransfer, {
      props: {
        modelValue: [2],
        data: [
          { key: 1, label: 'One' },
          { key: 2, label: 'Two' },
        ],
      },
    })
    expect(tr.text()).toContain('One')
    expect(tr.text()).toContain('Two')

    expect(
      (mount(FsusDatePicker, { props: { modelValue: '2026-11-28' } }).find('input').element as HTMLInputElement).value,
    ).toBe('2026-11-28')
    expect(mount(FsusTimePicker, { props: { modelValue: '09:30:00' } }).text()).toContain('09:30:00')
    expect(mount(FsusTimeSelect, { props: { start: '09:00', end: '10:00', step: '00:30' } }).exists()).toBe(true)
    expect(mount(FsusCalendar).findAll('[role="gridcell"]')).toHaveLength(42)
    expect(mount(FsusColorPicker, { props: { modelValue: '#2A599C' } }).exists()).toBe(true)
    expect(mount(FsusUpload, { props: { drag: true } }).find('.fsus-upload__dropzone').exists()).toBe(true)
  })
})
