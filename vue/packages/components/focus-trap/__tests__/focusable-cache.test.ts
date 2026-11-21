import { afterEach, describe, expect, it } from 'vitest'
import {
  invalidateFocusableCache,
  obtainAllFocusableElements,
} from '../src/utils'

const createContainer = () => {
  const container = document.createElement('div')
  const target = document.createElement('span')
  target.tabIndex = -1
  const first = document.createElement('button')
  const last = document.createElement('button')
  container.append(target, first, last)
  document.body.appendChild(container)
  return { container, target, first, last }
}

describe('focus-trap candidate cache boundaries', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('does not mutate the stable cached array when merging an active exception', () => {
    const { container, target, first, last } = createContainer()
    first.focus()
    obtainAllFocusableElements(container)
    const stable = obtainAllFocusableElements(container)
    expect(obtainAllFocusableElements(container)).toBe(stable)

    target.focus()
    const withTarget = obtainAllFocusableElements(container)
    expect(withTarget).toEqual([target, first, last])
    expect(withTarget).not.toBe(stable)
    expect(stable).toEqual([first, last])
    last.focus()
    expect(obtainAllFocusableElements(container)).toBe(stable)
    expect(stable).toEqual([first, last])
  })

  it('replaces a negative active exception when focus moves directly to another', () => {
    const { container, target, first, last } = createContainer()
    const nextTarget = document.createElement('span')
    nextTarget.tabIndex = -1
    container.appendChild(nextTarget)
    target.focus()
    expect(obtainAllFocusableElements(container)).toEqual([target, first, last])

    nextTarget.focus()
    expect(document.activeElement).toBe(nextTarget)
    expect(obtainAllFocusableElements(container)).toEqual([first, last, nextTarget])
    target.focus()
    expect(obtainAllFocusableElements(container)).toEqual([target, first, last])
  })

  it('rebuilds DOM order and eligibility after explicit invalidation', () => {
    const { container, first, last } = createContainer()
    first.focus()
    expect(obtainAllFocusableElements(container)).toEqual([first, last])

    last.disabled = true
    const added = document.createElement('button')
    container.append(added, first)
    invalidateFocusableCache(container)
    expect(obtainAllFocusableElements(container)).toEqual([added, first])

    last.disabled = false
    added.tabIndex = -1
    invalidateFocusableCache(container)
    expect(obtainAllFocusableElements(container)).toEqual([last, first])
  })
})
