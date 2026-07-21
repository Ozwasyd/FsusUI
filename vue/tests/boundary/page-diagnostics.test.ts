import { EventEmitter } from 'node:events'
import type { Page, Request, Response } from '@playwright/test'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { attachPageDiagnostics } from '../support/page-diagnostics'

const request = (
  url: string,
  errorText = 'net::ERR_ABORTED',
  method = 'GET',
) =>
  ({
    failure: () => ({ errorText }),
    method: () => method,
    url: () => url,
  }) as Request

const response = (url: string, status = 200, method = 'GET') =>
  ({
    request: () => request(url, '', method),
    status: () => status,
    url: () => url,
  }) as Response

const setup = () => {
  const page = new EventEmitter()
  const diagnostics = attachPageDiagnostics(page as unknown as Page)
  return { diagnostics, page }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('page diagnostics request recovery', () => {
  it('reconciles an exact URL abort after a later successful response', () => {
    const { diagnostics, page } = setup()
    const url = 'http://127.0.0.1:5173/src/main.ts?raw=1'

    page.emit('requestfailed', request(url))
    expect(diagnostics).toHaveLength(1)

    page.emit('response', response(url))
    expect(diagnostics).toEqual([])
  })

  it('reconciles Vite dependency reloads across cache-busting v hashes only', () => {
    const { diagnostics, page } = setup()
    const failed =
      'http://127.0.0.1:5173/node_modules/.vite/deps/vue.js?v=old&mode=dev'
    const recovered =
      'http://127.0.0.1:5173/node_modules/.vite/deps/vue.js?v=new&mode=dev'

    page.emit('requestfailed', request(failed))
    page.emit('response', response(recovered))

    expect(diagnostics).toEqual([])
  })

  it('does not normalize non-v query parameters on Vite dependency URLs', () => {
    const { diagnostics, page } = setup()
    const failed =
      'http://127.0.0.1:5173/node_modules/.vite/deps/vue.js?v=old&mode=dev'
    const differentRequest =
      'http://127.0.0.1:5173/node_modules/.vite/deps/vue.js?v=new&mode=prod'

    page.emit('requestfailed', request(failed))
    page.emit('response', response(differentRequest))

    expect(diagnostics).toEqual([
      `requestfailed: GET ${failed} net::ERR_ABORTED`,
    ])
  })

  it('ignores a transient abort when the matching success arrived first', () => {
    const { diagnostics, page } = setup()
    const url = 'http://127.0.0.1:5173/src/reused.ts'

    page.emit('response', response(url))
    page.emit('requestfailed', request(url))

    expect(diagnostics).toEqual([])
  })

  it('retains an independent abort after a success credit expires', () => {
    vi.useFakeTimers()
    const { diagnostics, page } = setup()
    const url = 'http://127.0.0.1:5173/src/later.ts'

    page.emit('response', response(url))
    vi.advanceTimersByTime(1_001)
    page.emit('requestfailed', request(url))

    expect(diagnostics).toEqual([
      `requestfailed: GET ${url} net::ERR_ABORTED`,
    ])
  })

  it('invalidates a success credit when the same module returns an HTTP error', () => {
    const { diagnostics, page } = setup()
    const url = 'http://127.0.0.1:5173/src/stale.ts'

    page.emit('response', response(url))
    page.emit('response', response(url, 404))
    page.emit('requestfailed', request(url))

    expect(diagnostics).toEqual([
      `http.404: ${url}`,
      `requestfailed: GET ${url} net::ERR_ABORTED`,
    ])
  })

  it('pairs one successful response with only one pending abort', () => {
    const { diagnostics, page } = setup()
    const url = 'http://127.0.0.1:5173/src/reloaded.ts'

    page.emit('requestfailed', request(url))
    page.emit('requestfailed', request(url))
    page.emit('response', response(url))

    expect(diagnostics).toEqual([
      `requestfailed: GET ${url} net::ERR_ABORTED`,
    ])
  })

  it('never grants recovery credit to API GETs or repeated POST aborts', () => {
    const { diagnostics, page } = setup()
    const readUrl = 'http://127.0.0.1:5173/api/read'
    const saveUrl = 'http://127.0.0.1:5173/api/save'

    page.emit('response', response(readUrl))
    page.emit('requestfailed', request(readUrl))
    page.emit('response', response(saveUrl, 200, 'POST'))
    page.emit('requestfailed', request(saveUrl, undefined, 'POST'))
    page.emit('requestfailed', request(saveUrl, undefined, 'POST'))

    expect(diagnostics).toEqual([
      `requestfailed: GET ${readUrl} net::ERR_ABORTED`,
      `requestfailed: POST ${saveUrl} net::ERR_ABORTED`,
      `requestfailed: POST ${saveUrl} net::ERR_ABORTED`,
    ])
  })

  it('retains unresolved aborts, non-abort failures, and method mismatches', () => {
    const { diagnostics, page } = setup()
    const unresolved = 'http://127.0.0.1:5173/src/unresolved.ts'
    const refused = 'http://127.0.0.1:5173/src/refused.ts'
    const methodMismatch = 'http://127.0.0.1:5173/api/save'

    page.emit('requestfailed', request(unresolved))
    page.emit('requestfailed', request(refused, 'net::ERR_CONNECTION_REFUSED'))
    page.emit('requestfailed', request(methodMismatch, undefined, 'POST'))
    page.emit('response', response(methodMismatch, 200, 'GET'))

    expect(diagnostics).toEqual([
      `requestfailed: GET ${unresolved} net::ERR_ABORTED`,
      `requestfailed: GET ${refused} net::ERR_CONNECTION_REFUSED`,
      `requestfailed: POST ${methodMismatch} net::ERR_ABORTED`,
    ])
  })

  it('retains HTTP, console, and page errors', () => {
    const { diagnostics, page } = setup()
    const url = 'http://127.0.0.1:5173/api/missing'

    page.emit('response', response(url, 404))
    page.emit('console', { text: () => 'render warning', type: () => 'warning' })
    page.emit('pageerror', new Error('render failed'))

    expect(diagnostics).toEqual([
      `http.404: ${url}`,
      'console.warning: render warning',
      'pageerror: render failed',
    ])
  })
})
