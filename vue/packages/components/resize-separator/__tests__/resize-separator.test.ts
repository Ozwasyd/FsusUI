import { createApp } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, test, vi } from 'vitest'
import { ElResizeSeparator, FsusResizeSeparator } from '..'

import type { VueWrapper } from '@vue/test-utils'
import type { ResizeSeparatorInstance, ResizeSeparatorProps } from '..'

const props = {
  value: 0.5,
  min: 0.2,
  max: 0.8,
  step: 0.05,
  label: 'Resize primary region',
  primaryRegionId: 'primary-region',
  secondaryRegionId: 'secondary-region',
  coordinateRange: { start: 200, end: 800 },
}
const render = (overrides: Partial<ResizeSeparatorProps> = {}) =>
  mount(ElResizeSeparator, {
    props: { ...props, ...overrides },
    attachTo: document.body,
  })

// Local capture simulation verifies ID/target ownership and cleanup, not native
// browser capture, layout geometry, or pointer-event user-agent behavior.
const pointer = (
  wrapper: VueWrapper,
  type: string,
  overrides: Record<string, number | boolean> = {},
) => {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.assign(event, {
    pointerId: 7,
    isPrimary: true,
    button: 0,
    clientX: 500,
    clientY: 500,
    ...overrides,
  })
  wrapper.element.dispatchEvent(event)
  return event
}
const capture = (wrapper: VueWrapper) => {
  const captured = new Set<number>()
  const set = vi.fn((id: number) => captured.add(id))
  const has = vi.fn((id: number) => captured.has(id))
  const release = vi.fn((id: number) => {
    captured.delete(id)
    pointer(wrapper, 'lostpointercapture', { pointerId: id })
  })
  Object.assign(wrapper.element, {
    setPointerCapture: set,
    hasPointerCapture: has,
    releasePointerCapture: release,
  })
  return { set, has, release, captured }
}
const proposals = (wrapper: VueWrapper) =>
  wrapper.emitted('proposal')?.map(([payload]) => payload)

describe('ResizeSeparator public component', () => {
  test('exports and installs typed aliases with controlled separator ARIA', async () => {
    const app = createApp({})
    ElResizeSeparator.install(app)
    expect(app.component('ElResizeSeparator')).toBe(ElResizeSeparator)
    expect(app.component('FsusResizeSeparator')).toBe(FsusResizeSeparator)
    const wrapper = render({ valueText: '50 percent' })
    expect(wrapper.attributes()).toMatchObject({
      role: 'separator',
      tabindex: '0',
      'aria-label': props.label,
      'aria-controls': 'primary-region secondary-region',
      'aria-orientation': 'vertical',
      'aria-valuemin': '0.2',
      'aria-valuemax': '0.8',
      'aria-valuenow': '0.5',
      'aria-valuetext': '50 percent',
    })
    await wrapper.trigger('keydown', { key: 'ArrowRight' })
    expect(proposals(wrapper)).toEqual([
      { value: 0.55, source: 'keyboard', pointerId: null },
    ])
    expect(wrapper.attributes('aria-valuenow')).toBe('0.5')
    expect(wrapper.emitted('update:value')).toBeUndefined()
    await wrapper.setProps({ value: 0.55 })
    expect(wrapper.attributes('aria-valuenow')).toBe('0.55')
  })

  test('maps pointer deltas, quantizes and bounds proposals without changing accepted value', async () => {
    const wrapper = render()
    const mocks = capture(wrapper)
    expect(pointer(wrapper, 'pointerdown').defaultPrevented).toBe(true)
    expect(mocks.set).toHaveBeenCalledExactlyOnceWith(7)
    expect(document.activeElement).toBe(wrapper.element)
    pointer(wrapper, 'pointermove', { clientX: 576 })
    pointer(wrapper, 'pointermove', { clientX: 580 })
    expect(proposals(wrapper)).toEqual([
      { value: 0.6, source: 'pointer', pointerId: 7 },
    ])
    expect(wrapper.attributes('aria-valuenow')).toBe('0.5')
    await wrapper.setProps({
      value: 0.6,
      coordinateRange: { ...props.coordinateRange },
    })
    expect(wrapper.emitted('cancel')).toBeUndefined()
    pointer(wrapper, 'pointermove', { clientX: -1000 })
    pointer(wrapper, 'pointerup', { clientX: 2000 })
    expect(proposals(wrapper)?.slice(1)).toEqual([
      { value: 0.2, source: 'pointer', pointerId: 7 },
      { value: 0.8, source: 'pointer', pointerId: 7 },
    ])
    expect(wrapper.emitted('start')).toEqual([
      [{ value: 0.5, source: 'pointer', pointerId: 7 }],
    ])
    expect(wrapper.emitted('end')).toEqual([
      [{ value: 0.8, source: 'pointer', pointerId: 7 }],
    ])
    expect(mocks.release).toHaveBeenCalledExactlyOnceWith(7)
    expect(mocks.captured.size).toBe(0)
    expect(wrapper.emitted('cancel')).toBeUndefined()
  })

  test('ignores secondary buttons, nonprimary pointers, competing IDs, keys and nonfinite coordinates', async () => {
    const wrapper = render()
    const mocks = capture(wrapper)
    pointer(wrapper, 'pointerdown', { button: 2 })
    pointer(wrapper, 'pointerdown', { isPrimary: false })
    pointer(wrapper, 'pointerdown', { clientX: NaN })
    expect(mocks.set).not.toHaveBeenCalled()
    pointer(wrapper, 'pointerdown')
    pointer(wrapper, 'pointerdown', { pointerId: 8 })
    for (const type of [
      'pointermove',
      'pointerup',
      'pointercancel',
      'lostpointercapture',
    ]) {
      pointer(wrapper, type, { pointerId: 8, clientX: 900 })
    }
    pointer(wrapper, 'pointermove', { clientX: Infinity })
    await wrapper.trigger('keydown', { key: 'ArrowRight' })
    expect(proposals(wrapper)).toBeUndefined()
    expect(wrapper.emitted('end')).toBeUndefined()
    expect(wrapper.emitted('cancel')).toBeUndefined()
    pointer(wrapper, 'pointerup')
    expect(wrapper.emitted('end')).toHaveLength(1)
    expect(mocks.set).toHaveBeenCalledTimes(1)
  })

  test('capture failure never starts an interaction', () => {
    const wrapper = render()
    const mocks = capture(wrapper)
    mocks.set.mockImplementation(() => {
      throw new Error('Capture unavailable')
    })
    pointer(wrapper, 'pointerdown')
    pointer(wrapper, 'pointermove', { clientX: 700 })
    pointer(wrapper, 'pointerup')
    for (const event of ['start', 'proposal', 'end', 'cancel']) {
      expect(wrapper.emitted(event)).toBeUndefined()
    }
  })

  test('a stationary pointer gesture preserves an accepted off-step value', () => {
    const wrapper = render({ value: 0.53 })
    capture(wrapper)
    pointer(wrapper, 'pointerdown')
    pointer(wrapper, 'pointerup')
    expect(proposals(wrapper)).toBeUndefined()
    expect(wrapper.emitted('end')).toEqual([
      [{ value: 0.53, source: 'pointer', pointerId: 7 }],
    ])
  })

  test.each([
    [0, 1, 0.5, 0.1, 350, 0.4],
    [0, 1, 0.5, 0.1, 349.999999, 0.3],
    [0, 1, 0.5, 0.1, 350.000001, 0.4],
    [1, 2, 1.5, 0.1, 350, 1.4],
    [-1, 0, -0.5, 0.1, 350, -0.6],
    [0, 1e-6, 5e-7, 1e-7, 350, 4e-7],
    [0, 1e6, 5e5, 1e5, 350, 4e5],
  ])(
    'rounds pointer half-steps upward without promoting below-ties: min=%s max=%s value=%s step=%s x=%s',
    (min, max, value, step, clientX, expected) => {
      const wrapper = render({
        min,
        max,
        value,
        step,
        coordinateRange: { start: 0, end: 1000 },
      })
      capture(wrapper)
      pointer(wrapper, 'pointerdown', { clientX: 500 })
      pointer(wrapper, 'pointerup', { clientX })
      expect(proposals(wrapper)).toEqual([
        { value: expected, source: 'pointer', pointerId: 7 },
      ])
    },
  )

  test('keyboard proposals apply the same upward half-step rule', async () => {
    const wrapper = render({ min: 0, max: 1, value: 0.25, step: 0.1 })
    await wrapper.trigger('keydown', { key: 'ArrowRight' })
    expect(proposals(wrapper)).toEqual([
      { value: 0.4, source: 'keyboard', pointerId: null },
    ])
  })

  test('active Escape cancels without reaching an outer dismiss handler; idle Escape still bubbles', () => {
    const wrapper = render()
    const mocks = capture(wrapper)
    const outerDismiss = vi.fn()
    document.addEventListener('keydown', outerDismiss)
    try {
      pointer(wrapper, 'pointerdown')
      const activeEscape = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      })
      wrapper.element.dispatchEvent(activeEscape)
      expect(activeEscape.defaultPrevented).toBe(true)
      expect(outerDismiss).not.toHaveBeenCalled()
      expect(wrapper.emitted('cancel')).toEqual([
        [{ value: 0.5, source: 'pointer', pointerId: 7, reason: 'escape' }],
      ])
      expect(mocks.release).toHaveBeenCalledExactlyOnceWith(7)

      const idleEscape = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      })
      wrapper.element.dispatchEvent(idleEscape)
      expect(idleEscape.defaultPrevented).toBe(false)
      expect(outerDismiss).toHaveBeenCalledExactlyOnceWith(idleEscape)
      expect(wrapper.emitted('cancel')).toHaveLength(1)
    } finally {
      document.removeEventListener('keydown', outerDismiss)
    }
  })

  test.each(['pointercancel', 'lostpointercapture'] as const)(
    '%s cancels once and permits a fresh pointer',
    (reason) => {
      const wrapper = render()
      const mocks = capture(wrapper)
      pointer(wrapper, 'pointerdown')
      pointer(wrapper, 'pointermove', { clientX: 550 })
      if (reason === 'lostpointercapture') mocks.captured.clear()
      pointer(wrapper, reason)
      pointer(wrapper, reason)
      pointer(wrapper, 'pointerup', { clientX: 700 })
      expect(wrapper.emitted('cancel')).toEqual([
        [{ value: 0.55, source: 'pointer', pointerId: 7, reason }],
      ])
      expect(mocks.captured.size).toBe(0)
      expect(wrapper.emitted('end')).toBeUndefined()
      pointer(wrapper, 'pointerdown', { pointerId: 8 })
      pointer(wrapper, 'pointerup', { pointerId: 8 })
      expect(wrapper.emitted('start')).toHaveLength(2)
      expect(wrapper.emitted('end')).toHaveLength(1)
    },
  )

  test.each(['escape', 'consumer', 'unmount'] as const)(
    '%s releases its capture and emits no rollback proposal',
    async (reason) => {
      const wrapper = render()
      const mocks = capture(wrapper)
      pointer(wrapper, 'pointerdown')
      if (reason === 'escape')
        await wrapper.trigger('keydown', { key: 'Escape' })
      else if (reason === 'consumer') {
        const instance = wrapper.vm as ResizeSeparatorInstance
        instance.cancel()
        instance.cancel()
      } else wrapper.unmount()
      expect(wrapper.emitted('cancel')).toEqual([
        [{ value: 0.5, source: 'pointer', pointerId: 7, reason }],
      ])
      expect(mocks.release).toHaveBeenCalledExactlyOnceWith(7)
      expect(mocks.captured.size).toBe(0)
      expect(proposals(wrapper)).toBeUndefined()
      expect(wrapper.emitted('end')).toBeUndefined()
    },
  )

  test.each([
    { disabled: true },
    { min: 0.25 },
    { max: 0.75 },
    { step: 0.02 },
    { orientation: 'horizontal' },
    { coordinateRange: { start: 201, end: 800 } },
    { value: NaN },
    { primaryRegionId: 'replacement' },
    { label: 'New name' },
  ] as Partial<ResizeSeparatorProps>[])(
    'configuration update cancels active capture: %j',
    async (update) => {
      const wrapper = render()
      const mocks = capture(wrapper)
      pointer(wrapper, 'pointerdown')
      await wrapper.setProps(update)
      pointer(wrapper, 'pointermove', { clientX: 900 })
      expect(wrapper.emitted('cancel')?.[0]).toEqual([
        {
          value: 0.5,
          source: 'pointer',
          pointerId: 7,
          reason: update.disabled ? 'disabled' : 'configuration-change',
        },
      ])
      expect(mocks.captured.size).toBe(0)
      expect(proposals(wrapper)).toBeUndefined()
    },
  )

  test.each([
    { disabled: true },
    { min: 0.8 },
    { max: NaN },
    { step: 0 },
    { step: Infinity },
    { value: Infinity },
    { label: ' ' },
    { primaryRegionId: '' },
    { coordinateRange: { start: 1, end: 1 } },
    { coordinateRange: { start: 0, end: Infinity } },
    { coordinateRange: { start: 0, end: Number.MIN_VALUE } },
  ])('invalid or disabled input stays inert: %j', async (update) => {
    const wrapper = render(update)
    const mocks = capture(wrapper)
    pointer(wrapper, 'pointerdown')
    await wrapper.trigger('keydown', { key: 'End' })
    expect(wrapper.attributes('aria-disabled')).toBe('true')
    expect(wrapper.attributes('tabindex')).toBe('-1')
    expect(mocks.set).not.toHaveBeenCalled()
    expect(proposals(wrapper)).toBeUndefined()
    expect(wrapper.attributes('aria-valuenow') ?? '').not.toMatch(
      /NaN|Infinity/,
    )
  })

  test.each([
    [
      'vertical',
      { start: 800, end: 200 },
      'ArrowRight',
      0.45,
      { clientX: 600 },
    ],
    [
      'horizontal',
      { start: 200, end: 800 },
      'ArrowDown',
      0.55,
      { clientY: 600 },
    ],
    [
      'horizontal',
      { start: 800, end: 200 },
      'ArrowDown',
      0.45,
      { clientY: 600 },
    ],
  ] as const)(
    'uses the explicit %s axis and mapping for pointer and keyboard',
    async (orientation, coordinateRange, key, expected, position) => {
      const wrapper = render({ orientation, coordinateRange })
      capture(wrapper)
      await wrapper.trigger('keydown', { key })
      expect(proposals(wrapper)?.[0]).toEqual({
        value: expected,
        source: 'keyboard',
        pointerId: null,
      })
      pointer(wrapper, 'pointerdown')
      pointer(wrapper, 'pointerup', { ...position })
      expect(proposals(wrapper)?.[1]).toEqual({
        value: expected > 0.5 ? 0.6 : 0.4,
        source: 'pointer',
        pointerId: 7,
      })
    },
  )

  test('Home/End reach non-step endpoints, bound no-ops and unrelated keys emit nothing', async () => {
    const wrapper = render({ max: 0.83, value: 0.2 })
    for (const key of [
      'Home',
      'ArrowLeft',
      'ArrowUp',
      'Enter',
      'Tab',
      'Escape',
    ]) {
      await wrapper.trigger('keydown', { key })
    }
    await wrapper.trigger('keydown', { key: 'End', ctrlKey: true })
    expect(proposals(wrapper)).toBeUndefined()
    await wrapper.trigger('keydown', { key: 'End' })
    expect(proposals(wrapper)).toEqual([
      { value: 0.83, source: 'keyboard', pointerId: null },
    ])
    await wrapper.setProps({ value: 0.83 })
    await wrapper.trigger('keydown', { key: 'ArrowRight' })
    await wrapper.trigger('keydown', { key: 'Home' })
    expect(proposals(wrapper)).toHaveLength(2)
    expect(proposals(wrapper)?.[1]).toEqual({
      value: 0.2,
      source: 'keyboard',
      pointerId: null,
    })
    expect(wrapper.emitted('start')).toHaveLength(2)
    expect(wrapper.emitted('end')).toHaveLength(2)
  })

  test.each(['pointer', 'keyboard'] as const)(
    '%s proposal listener can synchronously cancel without a duplicate end',
    async (source) => {
      let instance: ResizeSeparatorInstance
      const wrapper = mount(ElResizeSeparator, {
        props: { ...props, onProposal: () => instance.cancel() },
      })
      instance = wrapper.vm
      if (source === 'pointer') {
        capture(wrapper)
        pointer(wrapper, 'pointerdown')
        pointer(wrapper, 'pointerup', { clientX: 600 })
      } else await wrapper.trigger('keydown', { key: 'ArrowRight' })
      expect(wrapper.emitted('proposal')).toHaveLength(1)
      expect(wrapper.emitted('cancel')).toHaveLength(1)
      expect(wrapper.emitted('end')).toBeUndefined()
    },
  )

  test('start listener can cancel before a keyboard proposal', async () => {
    let instance: ResizeSeparatorInstance
    const wrapper = mount(ElResizeSeparator, {
      props: { ...props, onStart: () => instance.cancel() },
    })
    instance = wrapper.vm
    await wrapper.trigger('keydown', { key: 'ArrowRight' })
    expect(wrapper.emitted('start')).toHaveLength(1)
    expect(wrapper.emitted('cancel')).toHaveLength(1)
    expect(proposals(wrapper)).toBeUndefined()
    expect(wrapper.emitted('end')).toBeUndefined()
  })
})
