import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ElFocusTrap from '../src/focus-trap.vue'

type LayerState = { active: boolean; paused: boolean }

// Source timing controls only: the real Viewer-owned inert implementation and
// Chromium counterexample must be verified on the separate combined candidate.
describe('canonical focus-layer notifications', () => {
  const wrappers: ReturnType<typeof mount>[] = []
  const settle = async () => {
    await nextTick()
    await nextTick()
    await nextTick()
  }
  const create = (onState = (_state: LayerState) => {}) => {
    const container = document.createElement('div')
    container.tabIndex = -1
    container.append(document.createElement('button'))
    document.body.append(container)
    const states: LayerState[] = []
    const wrapper = mount(ElFocusTrap, {
      props: {
        trapped: false,
        focusTrapEl: container,
        focusStartEl: 'container',
        onFocusLayerChange: (state: LayerState) => {
          states.push({ ...state })
          onState(state)
        },
      },
    })
    wrappers.push(wrapper)
    return { wrapper, container, states }
  }
  // A test observer's owned inert lease; never writes focus or adds a layer.
  const ownInert = (elements: HTMLElement[]) => {
    const originals = new Map<HTMLElement, string | null>()
    return ({ active, paused }: LayerState) => {
      if (active && !paused) {
        for (const element of elements) {
          if (!originals.has(element)) {
            originals.set(element, element.getAttribute('inert'))
            element.setAttribute('inert', '')
          }
        }
      } else {
        for (const [element, original] of originals) {
          if (original === null) element.removeAttribute('inert')
          else element.setAttribute('inert', original)
        }
        originals.clear()
      }
    }
  }

  afterEach(() => {
    wrappers
      .splice(0)
      .reverse()
      .forEach((wrapper) => wrapper.unmount())
    document.body.innerHTML = ''
  })

  it('reports initial, active and inactive state without duplicate ownership', async () => {
    const { wrapper, states } = create()
    expect(states).toEqual([{ active: false, paused: false }])
    await wrapper.setProps({ trapped: true })
    await settle()
    await wrapper.setProps({ trapped: false })
    await settle()
    wrapper.unmount()
    expect(states).toEqual([
      { active: false, paused: false },
      { active: true, paused: false },
      { active: false, paused: false },
    ])
  })

  it('releases lower isolation before upper activation and autofocus', async () => {
    const upper = create()
    const order: string[] = []
    const release = ownInert([upper.container])
    const lower = create((state) => {
      release(state)
      if (state.active && state.paused) order.push('lower paused')
    })
    await lower.wrapper.setProps({ trapped: true })
    await settle()
    expect(upper.container.hasAttribute('inert')).toBe(true)
    await upper.wrapper.setProps({
      onFocusLayerChange: (state: LayerState) => {
        if (state.active && !state.paused) {
          order.push('upper active')
          expect(upper.container.closest('[inert]')).toBeNull()
        }
      },
    })
    vi.spyOn(upper.container, 'focus').mockImplementation(() => {
      order.push('upper focus')
      expect(upper.container.closest('[inert]')).toBeNull()
    })
    await upper.wrapper.setProps({ trapped: true })
    await settle()
    expect(order).toEqual(['lower paused', 'upper active', 'upper focus'])
  })

  it('releases the closing upper lease before resuming and restoring the lower opener', async () => {
    const original = document.createElement('button')
    document.body.append(original)
    original.focus()
    const lower = create()
    await lower.wrapper.setProps({ trapped: true })
    await settle()
    const nestedTrigger = lower.container.firstElementChild as HTMLButtonElement
    nestedTrigger.focus()
    const order: string[] = []
    const upper = create((state) => {
      if (!state.active) order.push('upper inactive')
    })
    await upper.wrapper.setProps({ trapped: true })
    await settle()
    await lower.wrapper.setProps({
      onFocusLayerChange: (state: LayerState) => {
        if (state.active && !state.paused) order.push('lower resumed')
      },
    })
    order.length = 0
    await upper.wrapper.setProps({ trapped: false })
    await settle()
    expect(order).toEqual(['upper inactive', 'lower resumed'])
    expect(document.activeElement).toBe(nestedTrigger)
    await lower.wrapper.setProps({ trapped: false })
    await settle()
    expect(document.activeElement).toBe(original)
  })

  it('never revives an unmounted lower layer or reacquires an unchanged upper lease', async () => {
    const lower = create()
    const upper = create()
    await lower.wrapper.setProps({ trapped: true })
    await settle()
    await upper.wrapper.setProps({ trapped: true })
    await settle()
    const upperStateCount = upper.states.length
    lower.wrapper.unmount()
    lower.container.remove()
    expect(lower.states.at(-1)).toEqual({ active: false, paused: true })
    expect(upper.states).toHaveLength(upperStateCount)
    expect(document.activeElement).toBe(upper.container)
    const lowerStateCount = lower.states.length
    await upper.wrapper.setProps({ trapped: false })
    await settle()
    expect(lower.states).toHaveLength(lowerStateCount)
  })

  it('lets the observer preserve preexisting inert values across suspend/resume and cleanup', async () => {
    const existing = document.createElement('div')
    const background = document.createElement('div')
    existing.setAttribute('inert', 'original')
    document.body.append(existing, background)
    const lower = create(ownInert([existing, background]))
    const upper = create()
    await lower.wrapper.setProps({ trapped: true })
    await settle()
    await upper.wrapper.setProps({ trapped: true })
    await settle()
    expect(existing.getAttribute('inert')).toBe('original')
    expect(background.hasAttribute('inert')).toBe(false)
    await upper.wrapper.setProps({ trapped: false })
    await settle()
    expect(background.hasAttribute('inert')).toBe(true)
    lower.wrapper.unmount()
    expect(existing.getAttribute('inert')).toBe('original')
    expect(background.hasAttribute('inert')).toBe(false)
  })

  it('does not announce a layer whose pending start is canceled by unmount', async () => {
    const { wrapper, states } = create()
    const pending = wrapper.setProps({ trapped: true })
    wrapper.unmount()
    await pending
    await settle()
    expect(states).toEqual([{ active: false, paused: false }])
  })

  it('keeps Escape release requests with the top active owner', async () => {
    const lower = create()
    const upper = create()
    const lowerRelease = vi.fn()
    const upperRelease = vi.fn()
    await lower.wrapper.setProps({
      trapped: true,
      onReleaseRequested: lowerRelease,
    })
    await settle()
    await upper.wrapper.setProps({
      trapped: true,
      onReleaseRequested: upperRelease,
    })
    await settle()
    document.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Escape',
        code: 'Escape',
        bubbles: true,
      }),
    )
    expect(upperRelease).toHaveBeenCalledTimes(1)
    expect(lowerRelease).not.toHaveBeenCalled()
    await upper.wrapper.setProps({ trapped: false })
    await settle()
    document.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Escape',
        code: 'Escape',
        bubbles: true,
      }),
    )
    expect(upperRelease).toHaveBeenCalledTimes(1)
    expect(lowerRelease).toHaveBeenCalledTimes(1)
  })

  it('releases observed isolation when an activation is interrupted before autofocus', async () => {
    const background = document.createElement('div')
    document.body.append(background)
    const observe = ownInert([background])
    const layer = create((state) => {
      observe(state)
      if (state.active && !state.paused)
        void layer.wrapper.setProps({ trapped: false })
    })
    const focus = vi.spyOn(layer.container, 'focus')
    await layer.wrapper.setProps({ trapped: true })
    await settle()
    expect(focus).not.toHaveBeenCalled()
    expect(background.hasAttribute('inert')).toBe(false)
    expect(layer.states.at(-1)).toEqual({ active: false, paused: false })
  })
})
