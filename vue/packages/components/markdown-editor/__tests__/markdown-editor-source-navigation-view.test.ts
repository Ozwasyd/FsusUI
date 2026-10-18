import { describe, expect, it } from 'vitest'
import { resolveMarkdownEditorFocusEndpoint } from '../src/markdown-editor-live-layout'
import { createMarkdownEditorSourceNavigationViewOwner } from '../src/markdown-editor-source-navigation-view'
import type { MarkdownEditorSourceNavigationViewOptions } from '..'

describe('original source navigation focus policy and unsupported observation', () => {
  it.each([
    ['backward', 3, 'before'],
    ['forward', 12, 'after'],
    ['none', 12, 'after'],
  ] as const)(
    'shares native focus policy for %s selection',
    (direction, offset, affinity) => {
      expect(
        resolveMarkdownEditorFocusEndpoint({ start: 3, end: 12, direction }),
      ).toEqual({ offset, affinity })
    },
  )
  it('refuses a missing mounted measurement without requesting work from either reader', () => {
    let work = 0
    const owner = createMarkdownEditorSourceNavigationViewOwner({
      readNative: () => null,
      requestFrame: () => {
        work += 1
        return undefined
      },
      cancelFrame: () => {
        work += 1
      },
      bind: () => {
        work += 1
        return () => {}
      },
      notify: () => {
        work += 1
      },
    })
    // No session is read when the original mounted context is unavailable.
    const options = {
      signal: new AbortController().signal,
      assertAdmission: () => {},
      expected: { documentIdentity: { id: 'missing', epoch: 1 }, revision: 0 },
    }
    expect(owner.read({ ...options, session: undefined! })).toBeNull()
    expect(work).toBe(0)
  })
  it('preserves the original abort reason before consulting unavailable layout', () => {
    const owner = createMarkdownEditorSourceNavigationViewOwner({
      readNative: () => null,
      requestFrame: () => undefined,
      cancelFrame: () => {},
      bind: () => () => {},
      notify: () => {},
    })
    const controller = new AbortController()
    const reason = new Error('original abort')
    controller.abort(reason)
    const options: MarkdownEditorSourceNavigationViewOptions = {
      session: undefined!,
      signal: controller.signal,
      expected: { documentIdentity: { id: 'missing', epoch: 1 }, revision: 0 },
      assertAdmission: () => {
        throw new Error('must not replace abort')
      },
    }
    expect(() => owner.read(options)).toThrow(reason)
  })
})
