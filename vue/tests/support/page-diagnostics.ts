import type { Page } from '@playwright/test'

const diagnosticConsoleTypes = new Set(['error', 'warning'])
const transientAbortError = 'net::ERR_ABORTED'
const successCreditLifetimeMs = 1_000
const maxSuccessCredits = 512
const viteModulePathPrefixes = [
  '/@fs/',
  '/@id/',
  '/@vite/',
  '/node_modules/.vite/',
  '/src/',
  '/vue/packages/',
]

type PendingAbort = {
  message: string
}

const requestRecoveryKey = (method: string, requestUrl: string) => {
  try {
    const url = new URL(requestUrl)

    if (url.pathname.includes('/node_modules/.vite/deps/')) {
      url.searchParams.delete('v')
      return `${method} ${url.toString()}`
    }
  } catch {
    // A non-standard URL cannot be a Vite optimized dependency URL. Keep the
    // exact value so diagnostics remain fail-safe for custom protocols.
  }

  return `${method} ${requestUrl}`
}

const isRecoverableViteModuleRequest = (method: string, requestUrl: string) => {
  if (method !== 'GET') return false

  try {
    const { pathname } = new URL(requestUrl)
    return viteModulePathPrefixes.some((prefix) => pathname.startsWith(prefix))
  } catch {
    return false
  }
}

export const attachPageDiagnostics = (page: Page) => {
  const diagnostics: string[] = []
  const successCredits = new Map<string, number>()
  const pendingAborts = new Map<string, PendingAbort[]>()

  const reconcileOnePendingAbort = (key: string) => {
    const pending = pendingAborts.get(key)
    const failure = pending?.shift()
    if (!failure) return false

    const index = diagnostics.indexOf(failure.message)
    if (index >= 0) diagnostics.splice(index, 1)
    if (pending.length === 0) pendingAborts.delete(key)
    return true
  }

  const addSuccessCredit = (key: string) => {
    successCredits.delete(key)
    while (successCredits.size >= maxSuccessCredits) {
      const oldestKey = successCredits.keys().next().value
      if (typeof oldestKey !== 'string') break
      successCredits.delete(oldestKey)
    }
    successCredits.set(key, Date.now() + successCreditLifetimeMs)
  }

  const consumeSuccessCredit = (key: string) => {
    const expiresAt = successCredits.get(key)
    if (expiresAt === undefined) return false
    successCredits.delete(key)
    return expiresAt >= Date.now()
  }

  page.on('console', (message) => {
    if (diagnosticConsoleTypes.has(message.type())) {
      diagnostics.push(`console.${message.type()}: ${message.text()}`)
    }
  })

  page.on('pageerror', (error) => {
    diagnostics.push(`pageerror: ${error.message}`)
  })

  page.on('requestfailed', (request) => {
    const method = request.method()
    const url = request.url()
    const errorText = request.failure()?.errorText ?? ''
    const message = `requestfailed: ${method} ${url} ${errorText}`

    if (
      errorText !== transientAbortError ||
      !isRecoverableViteModuleRequest(method, url)
    ) {
      diagnostics.push(message)
      return
    }

    const key = requestRecoveryKey(method, url)
    if (consumeSuccessCredit(key)) return

    diagnostics.push(message)
    const pending = pendingAborts.get(key) ?? []
    pending.push({ message })
    pendingAborts.set(key, pending)
  })

  page.on('response', (response) => {
    const method = response.request().method()
    const url = response.url()
    const recoverable = isRecoverableViteModuleRequest(method, url)
    const key = recoverable ? requestRecoveryKey(method, url) : null

    if (response.status() >= 400) {
      diagnostics.push(`http.${response.status()}: ${url}`)
      if (key) successCredits.delete(key)
      return
    }

    if (!key) return
    if (!reconcileOnePendingAbort(key)) addSuccessCredit(key)
  })

  return diagnostics
}
