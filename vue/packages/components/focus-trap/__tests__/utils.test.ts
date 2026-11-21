import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  focusFirstDescendant,
  getEdges,
  obtainAllFocusableElements,
} from '../src/utils'

describe('focus-trap utils', () => {
  const buildDOM = () => {
    const parser = new DOMParser()
    return parser.parseFromString(
      `
    <div class="root">
      <span>some val</span>
      <input class="focusable-input" />
      <span tabindex="0" class="focusable-span">other val</span>
      <span hidden tabindex="0"> hidden span</span>
      <input disabled />
      <input hidden />
    </div>
    `,
      'text/html'
    )
  }

  beforeEach(() => {
    const dom = buildDOM()

    Array.from(dom.children).forEach((child) => {
      document.body.appendChild(child)
    })
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('should be able to focus', () => {
    const focusable = obtainAllFocusableElements(document.body)
    expect(focusable).toHaveLength(2)
    expect(focusable[0].classList.contains('focusable-input')).toBeTruthy()
  })

  it('should be able to get focusable edge', () => {
    const [first, last] = getEdges(document.body)
    expect(first?.classList.contains('focusable-input')).toBeTruthy()
    expect(last?.classList.contains('focusable-span')).toBeTruthy()
  })

  it('should be able to focus on the first descendant', () => {
    expect(document.activeElement).toBe(document.body)
    const focusable = obtainAllFocusableElements(document.body)
    focusFirstDescendant(focusable)
    expect(document.activeElement).toBe(focusable[0])
  })
})


describe('focus-trap cached programmatic targets', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  const createCandidates = (position: number, buttonCount = 2) => {
    const container = document.createElement('div')
    container.tabIndex = -1
    const buttons = Array.from({ length: buttonCount }, () => {
      const button = document.createElement('button')
      container.appendChild(button)
      return button
    })
    const target = document.createElement('span')
    target.tabIndex = -1
    container.insertBefore(target, buttons[position] ?? null)
    document.body.appendChild(container)
    return { container, target, buttons }
  }

  it.each([0, 1, 2])(
    'includes only the current negative target at DOM position %i',
    (position) => {
      const { container, target, buttons } = createCandidates(position)
      const withTarget: HTMLElement[] = [...buttons]
      withTarget.splice(position, 0, target)

      target.focus()
      expect(obtainAllFocusableElements(container)).toEqual(withTarget)
      buttons[0].focus()
      expect(obtainAllFocusableElements(container)).toEqual(buttons)
      expect(getEdges(container)).toEqual([buttons[0], buttons[1]])
      target.focus()
      expect(obtainAllFocusableElements(container)).toEqual(withTarget)
      buttons[1].focus()
      expect(obtainAllFocusableElements(container)).toEqual(buttons)
    }
  )

  it.each([0, 1])(
    'preserves programmatic focus with %i sequential targets',
    (buttonCount) => {
      const { container, target, buttons } = createCandidates(0, buttonCount)
      target.focus()
      expect(obtainAllFocusableElements(container)).toEqual([target, ...buttons])
      expect(getEdges(container)).toEqual([target, buttons.at(-1) ?? target])
      container.focus()
      expect(obtainAllFocusableElements(container)).toEqual(buttons)
    }
  )

  it('does not retain an old target or include focus outside the container', () => {
    const { container, target, buttons } = createCandidates(0)
    target.focus()
    expect(obtainAllFocusableElements(container)[0]).toBe(target)
    const outside = document.createElement('button')
    document.body.appendChild(outside)
    outside.focus()
    expect(obtainAllFocusableElements(container)).toEqual(buttons)
  })

  it('keeps body uncached across focus and DOM changes', () => {
    const { target, buttons } = createCandidates(0)
    target.focus()
    expect(obtainAllFocusableElements(document.body)).toEqual([target, ...buttons])
    buttons[0].focus()
    const added = document.createElement('button')
    document.body.appendChild(added)
    expect(obtainAllFocusableElements(document.body)).toEqual([...buttons, added])
  })

  it('keeps disabled, hidden and hidden-input exclusions and positive tabindex DOM order', () => {
    const container = document.createElement('div')
    const first = document.createElement('button')
    first.tabIndex = 3
    const last = document.createElement('button')
    last.tabIndex = 1
    const disabled = document.createElement('button')
    disabled.disabled = true
    const hidden = document.createElement('span')
    hidden.hidden = true
    hidden.tabIndex = 0
    const hiddenInput = document.createElement('input')
    hiddenInput.type = 'hidden'
    hiddenInput.tabIndex = 0
    container.append(first, disabled, hidden, hiddenInput, last)
    document.body.appendChild(container)
    expect(obtainAllFocusableElements(container)).toEqual([first, last])
    expect(getEdges(container)).toEqual([first, last])
  })

  it('keeps a focused SVG target dynamic without narrowing the existing walker', () => {
    const container = document.createElement('div')
    const target = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    target.setAttribute('tabindex', '-1')
    const button = document.createElement('button')
    container.append(target, button)
    document.body.appendChild(container)
    target.focus()
    expect(document.activeElement).toBe(target)
    expect(obtainAllFocusableElements(container)).toEqual([target, button])
    button.focus()
    expect(obtainAllFocusableElements(container)).toEqual([button])
    target.focus()
    expect(obtainAllFocusableElements(container)).toEqual([target, button])
  })

})
