import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cAF, rAF } from '..'

const clientState = vi.hoisted(() => ({
  isClient: false,
}))

vi.mock('../browser', () => ({
  get isClient() {
    return clientState.isClient
  },
  isFirefox: () => false,
  isIOS: false,
}))

describe('raf', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('CSR should work', () => {
    clientState.isClient = true

    const fn = vi.fn()
    rAF(() => fn('first'))
    vi.runAllTimers()
    expect(fn.mock.calls).toMatchInlineSnapshot(`
      [
        [
          "first",
        ],
      ]
    `)

    rAF(() => fn('second'))
    vi.runAllTimers()
    expect(fn.mock.calls).toMatchInlineSnapshot(`
      [
        [
          "first",
        ],
        [
          "second",
        ],
      ]
    `)

    const handle = rAF(() => fn('cancel'))
    cAF(handle)
    vi.runAllTimers()
    expect(fn.mock.calls).toMatchInlineSnapshot(`
      [
        [
          "first",
        ],
        [
          "second",
        ],
      ]
    `)
  })

  it('SSR should work', () => {
    clientState.isClient = false

    const fn = vi.fn()
    rAF(() => fn('first'))
    vi.runAllTimers()
    expect(fn.mock.calls).toMatchInlineSnapshot(`
      [
        [
          "first",
        ],
      ]
    `)

    rAF(() => fn('second'))
    vi.runAllTimers()
    expect(fn.mock.calls).toMatchInlineSnapshot(`
      [
        [
          "first",
        ],
        [
          "second",
        ],
      ]
    `)

    const handle = rAF(() => fn('cancel'))
    cAF(handle)
    vi.runAllTimers()
    expect(fn.mock.calls).toMatchInlineSnapshot(`
      [
        [
          "first",
        ],
        [
          "second",
        ],
      ]
    `)
  })
})
