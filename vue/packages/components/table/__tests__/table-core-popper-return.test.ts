import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createTablePopper, removePopper } from '../src/util'

describe('ordinary Table core Popper return', () => {
  let parent: HTMLDivElement
  let trigger: HTMLSpanElement

  beforeEach(() => {
    parent = document.createElement('div')
    parent.dataset.prefix = 'el'
    trigger = document.createElement('span')
    parent.appendChild(trigger)
    document.body.appendChild(parent)
  })

  afterEach(() => {
    removePopper?.()
    parent.remove()
  })

  it('returns the real core instance with its original elements and options', async () => {
    const instance = createTablePopper(
      parent,
      trigger,
      '<unsafe>',
      () => 2000,
      {
        enterable: false,
        placement: 'bottom',
        offset: 12,
      },
    )
    expect(instance.state.elements.reference).toBe(trigger)
    expect(instance.state.elements.popper.parentElement).toBe(parent)
    expect(instance.state.elements.popper.firstChild?.textContent).toBe(
      '<unsafe>',
    )
    expect(instance.state.elements.popper.querySelector('unsafe')).toBeNull()
    expect(
      instance.state.elements.popper.querySelector('.el-popper__arrow'),
    ).not.toBeNull()
    expect(instance.state.elements.popper.style.zIndex).toBe('2000')
    expect(instance.state.options.placement).toBe('bottom')
    expect(instance.state.options.strategy).toBe('fixed')
    expect(instance.update).toBeTypeOf('function')
    expect(instance.forceUpdate).toBeTypeOf('function')
    expect(instance.setOptions).toBeTypeOf('function')
    expect(instance.destroy).toBeTypeOf('function')
    expect(await instance.update()).toBe(instance.state)
  })

  it('keeps replacement and scroll cleanup tied to the core instance', () => {
    const scroll = document.createElement('div')
    scroll.className = 'el-scrollbar__wrap'
    parent.appendChild(scroll)
    const first = createTablePopper(parent, trigger, 'first', () => 2000, {
      enterable: false,
    })
    const second = createTablePopper(parent, trigger, 'second', () => 2001, {
      enterable: false,
    })
    expect(first.state.elements.popper.isConnected).toBe(false)
    expect(second.state.elements.popper.isConnected).toBe(true)
    expect(parent.querySelectorAll('.el-popper')).toHaveLength(1)
    scroll.dispatchEvent(new Event('scroll'))
    expect(second.state.elements.popper.isConnected).toBe(false)
    expect(removePopper).toBeUndefined()
  })
})
