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
const keydown = (wrapper: VueWrapper, key: string) =>
  wrapper.element.dispatchEvent(
    new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }),
  )

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

  test.each(['consumer', 'unmount'] as const)(
    '%s retains capture cleanup without reading extra coordinate range getters',
    (reason) => {
      let mocks: ReturnType<typeof capture> | undefined
      const extra = vi.fn(() => {
        throw new Error('Extra coordinate range field must not be read')
      })
      const range = {
        get start() {
          if (mocks?.captured.size)
            throw new Error('Snapshot start must be read before capture')
          return props.coordinateRange.start
        },
        get end() {
          if (mocks?.captured.size)
            throw new Error('Snapshot end must be read before capture')
          return props.coordinateRange.end
        },
        get extra() {
          return extra()
        },
      }
      const wrapper = render({ coordinateRange: range })
      mocks = capture(wrapper)
      pointer(wrapper, 'pointerdown')
      expect(extra).not.toHaveBeenCalled()
      expect(mocks.captured.has(7)).toBe(true)
      expect(wrapper.emitted('start')).toEqual([
        [{ value: 0.5, source: 'pointer', pointerId: 7 }],
      ])
      if (reason === 'consumer')
        (wrapper.vm as ResizeSeparatorInstance).cancel()
      else wrapper.unmount()
      expect(mocks.release).toHaveBeenCalledExactlyOnceWith(7)
      expect(mocks.captured.size).toBe(0)
      expect(wrapper.emitted('cancel')).toEqual([
        [{ value: 0.5, source: 'pointer', pointerId: 7, reason }],
      ])
      expect(extra).not.toHaveBeenCalled()
    },
  )

  test.each(['pointer', 'keyboard'] as const)(
    'snapshot getter cannot admit reentrant %s input',
    (source) => {
      let wrapper: VueWrapper
      let armed = false
      const range = {
        get start() {
          if (armed) {
            armed = false
            if (source === 'pointer')
              pointer(wrapper, 'pointerdown', { pointerId: 8 })
            else
              wrapper.element.dispatchEvent(
                new KeyboardEvent('keydown', {
                  key: 'ArrowRight',
                  bubbles: true,
                  cancelable: true,
                }),
              )
          }
          return props.coordinateRange.start
        },
        end: props.coordinateRange.end,
      }
      wrapper = render({ coordinateRange: range })
      const mocks = capture(wrapper)
      armed = true
      pointer(wrapper, 'pointerdown')
      expect(mocks.set).toHaveBeenCalledExactlyOnceWith(7)
      expect(wrapper.emitted('start')).toEqual([
        [{ value: 0.5, source: 'pointer', pointerId: 7 }],
      ])
      pointer(wrapper, 'pointerup')
      expect(wrapper.emitted('end')).toEqual([
        [{ value: 0.5, source: 'pointer', pointerId: 7 }],
      ])
      expect(wrapper.emitted('cancel')).toBeUndefined()
      expect(mocks.release).toHaveBeenCalledExactlyOnceWith(7)
      expect(mocks.captured.size).toBe(0)
    },
  )

  test.each([
    ['pointer', 'consumer'],
    ['pointer', 'unmount'],
    ['pointer', 'throw'],
    ['keyboard', 'consumer'],
    ['keyboard', 'unmount'],
    ['keyboard', 'throw'],
  ] as const)(
    '%s snapshot getter %s invalidates admission without capture or start',
    (source, action) => {
      let wrapper: VueWrapper
      let armed = false
      const cause = new Error('Snapshot getter failure')
      const errors: unknown[] = []
      const range = {
        get start() {
          if (armed) {
            armed = false
            if (action === 'throw') throw cause
            if (action === 'consumer')
              (wrapper.vm as ResizeSeparatorInstance).cancel()
            else wrapper.unmount()
          }
          return props.coordinateRange.start
        },
        end: props.coordinateRange.end,
      }
      wrapper = render({ coordinateRange: range })
      wrapper.vm.$.appContext.config.errorHandler = (error) =>
        errors.push(error)
      const mocks = capture(wrapper)
      const trigger = () =>
        source === 'pointer'
          ? pointer(wrapper, 'pointerdown')
          : keydown(wrapper, 'ArrowRight')
      armed = true
      trigger()
      expect(mocks.set).not.toHaveBeenCalled()
      expect(mocks.captured.size).toBe(0)
      for (const event of ['start', 'proposal', 'end', 'cancel'])
        expect(wrapper.emitted(event)).toBeUndefined()
      expect(errors).toEqual(action === 'throw' ? [cause] : [])
      if (action !== 'unmount') {
        trigger()
        if (source === 'pointer') {
          pointer(wrapper, 'pointerup')
          expect(mocks.set).toHaveBeenCalledExactlyOnceWith(7)
        } else expect(mocks.set).not.toHaveBeenCalled()
        expect(wrapper.emitted('start')).toHaveLength(1)
        expect(wrapper.emitted('end')).toHaveLength(1)
        expect(mocks.captured.size).toBe(0)
      }
    },
  )

  test.each(['pointer', 'keyboard'] as const)(
    'keyboard endpoint getter cannot admit reentrant %s input',
    (source) => {
      let wrapper: VueWrapper
      let armed = false
      const range = {
        start: props.coordinateRange.start,
        get end() {
          if (armed) {
            armed = false
            if (source === 'pointer')
              pointer(wrapper, 'pointerdown', { pointerId: 8 })
            else keydown(wrapper, 'ArrowLeft')
          }
          return props.coordinateRange.end
        },
      }
      wrapper = render({ coordinateRange: range })
      const mocks = capture(wrapper)
      armed = true
      keydown(wrapper, 'ArrowRight')
      expect(mocks.set).not.toHaveBeenCalled()
      expect(wrapper.emitted('start')).toEqual([
        [{ value: 0.5, source: 'keyboard', pointerId: null }],
      ])
      expect(proposals(wrapper)).toEqual([
        { value: 0.55, source: 'keyboard', pointerId: null },
      ])
      expect(wrapper.emitted('end')).toHaveLength(1)
      expect(wrapper.emitted('cancel')).toBeUndefined()
      pointer(wrapper, 'pointerdown')
      pointer(wrapper, 'pointerup')
      expect(mocks.set).toHaveBeenCalledExactlyOnceWith(7)
      expect(wrapper.emitted('start')).toHaveLength(2)
      expect(wrapper.emitted('end')).toHaveLength(2)
      expect(mocks.captured.size).toBe(0)
    },
  )

  test.each([
    ['pointer', 'start'],
    ['pointer', 'proposal'],
    ['keyboard', 'start'],
    ['keyboard', 'proposal'],
  ] as const)(
    '%s %s listener may cancel and replace without stale proposal or terminal',
    (source, phase) => {
      let wrapper: VueWrapper
      let armed = true
      const replace = () => {
        if (!armed) return
        armed = false
        const instance = wrapper.vm as ResizeSeparatorInstance
        instance.cancel()
        pointer(wrapper, 'pointerdown', { pointerId: 8 })
      }
      wrapper = mount(ElResizeSeparator, {
        props: {
          ...props,
          ...(phase === 'start'
            ? { onStart: replace }
            : { onProposal: replace }),
        },
        attachTo: document.body,
      })
      const mocks = capture(wrapper)
      if (source === 'pointer') {
        pointer(wrapper, 'pointerdown')
        if (phase === 'proposal')
          pointer(wrapper, 'pointerup', { clientX: 600 })
      } else keydown(wrapper, 'ArrowRight')
      expect(wrapper.emitted('start')).toHaveLength(2)
      expect(wrapper.emitted('cancel')).toHaveLength(1)
      expect(wrapper.emitted('end')).toBeUndefined()
      expect(proposals(wrapper)?.length ?? 0).toBe(phase === 'start' ? 0 : 1)
      expect(mocks.captured).toEqual(new Set([8]))
      pointer(wrapper, 'pointerup', { pointerId: 8 })
      expect(wrapper.emitted('end')).toEqual([
        [{ value: 0.5, source: 'pointer', pointerId: 8 }],
      ])
      expect(mocks.captured.size).toBe(0)
    },
  )

  test.each(['pointermove', 'pointerup'] as const)(
    '%s axis getter replacement preserves the new capture without a stale proposal',
    (type) => {
      const wrapper = render()
      const instance = wrapper.vm as ResizeSeparatorInstance
      const mocks = capture(wrapper)
      pointer(wrapper, 'pointerdown')
      const event = new Event(type, { bubbles: true, cancelable: true })
      Object.assign(event, { pointerId: 7 })
      Object.defineProperty(event, 'clientX', {
        get() {
          instance.cancel()
          pointer(wrapper, 'pointerdown', { pointerId: 8 })
          return 600
        },
      })
      wrapper.element.dispatchEvent(event)
      expect(proposals(wrapper)).toBeUndefined()
      expect(wrapper.emitted('start')).toHaveLength(2)
      expect(wrapper.emitted('cancel')).toHaveLength(1)
      expect(wrapper.emitted('end')).toBeUndefined()
      expect(mocks.captured).toEqual(new Set([8]))
      pointer(wrapper, 'pointerup', { pointerId: 8 })
      expect(wrapper.emitted('end')).toEqual([
        [{ value: 0.5, source: 'pointer', pointerId: 8 }],
      ])
      expect(mocks.captured.size).toBe(0)
    },
  )

  test.each(['end', 'consumer'] as const)(
    '%s release blocks reentry until the terminal listener may admit a new pointer',
    (reason) => {
      let wrapper: VueWrapper
      let armed = true
      const restart = () => {
        if (!armed) return
        armed = false
        pointer(wrapper, 'pointerdown', { pointerId: 9 })
      }
      wrapper = mount(ElResizeSeparator, {
        props: {
          ...props,
          ...(reason === 'end' ? { onEnd: restart } : { onCancel: restart }),
        },
        attachTo: document.body,
      })
      const mocks = capture(wrapper)
      mocks.release.mockImplementation((id: number) => {
        mocks.captured.delete(id)
        pointer(wrapper, 'pointerdown', { pointerId: 8 })
        keydown(wrapper, 'ArrowRight')
        pointer(wrapper, 'lostpointercapture', { pointerId: id })
      })
      pointer(wrapper, 'pointerdown')
      if (reason === 'end') pointer(wrapper, 'pointerup')
      else (wrapper.vm as ResizeSeparatorInstance).cancel()
      expect(mocks.set.mock.calls).toEqual([[7], [9]])
      expect(wrapper.emitted('start')).toHaveLength(2)
      expect(mocks.captured).toEqual(new Set([9]))
      pointer(wrapper, 'pointerup', { pointerId: 9 })
      expect(wrapper.emitted('end')).toHaveLength(reason === 'end' ? 2 : 1)
      expect(wrapper.emitted('cancel')?.length ?? 0).toBe(
        reason === 'end' ? 0 : 1,
      )
      expect(mocks.release.mock.calls).toEqual([[7], [9]])
      expect(mocks.captured.size).toBe(0)
    },
  )

  test('capture-time cancellation retains cleanup without starting an invalidated admission', () => {
    const wrapper = render()
    const mocks = capture(wrapper)
    const instance = wrapper.vm as ResizeSeparatorInstance
    mocks.set.mockImplementation((id: number) => {
      mocks.captured.add(id)
      instance.cancel()
      return mocks.captured
    })
    pointer(wrapper, 'pointerdown')
    expect(mocks.release).toHaveBeenCalledExactlyOnceWith(7)
    expect(mocks.captured.size).toBe(0)
    for (const event of ['start', 'proposal', 'end', 'cancel'])
      expect(wrapper.emitted(event)).toBeUndefined()
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
    [100, 101, 100.5, 0.1, 350, 100.4],
    [100, 101, 100.5, 0.1, 349.999999, 100.3],
    [100, 101, 100.5, 0.1, 350.000001, 100.4],
    [-100, -99, -99.5, 0.1, 350, -99.6],
    [-100, -99, -99.5, 0.1, 349.999999, -99.7],
    [-100, -99, -99.5, 0.1, 350.000001, -99.6],
    [1e15, 1e15 + 1, 1e15 + 0.5, 0.25, 125, 1e15 + 0.25],
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

  test.each([
    [100, 101, 100.25, 100.4],
    [-100, -99, -99.75, -99.6],
  ])(
    'keyboard half-step decisions survive translation: min=%s',
    async (min, max, value, expected) => {
      const wrapper = render({ min, max, value, step: 0.1 })
      await wrapper.trigger('keydown', { key: 'ArrowRight' })
      expect(proposals(wrapper)).toEqual([
        { value: expected, source: 'keyboard', pointerId: null },
      ])
    },
  )

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
    { min: 1e15, max: 1e15 + 1, value: 1e15 + 0.5, step: 0.1 },
    { min: 1e15, max: 1e15 + 1, value: 1e15 + 0.5, step: 0.125 },
    { min: -1e15 - 1, max: -1e15, value: -1e15 - 0.5, step: 0.1 },
    { min: 0, max: 1, step: Number.MIN_VALUE },
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
