import type { Page } from '@playwright/test'

const diagnosticConsoleTypes = new Set(['error', 'warning'])

export const attachPageDiagnostics = (page: Page) => {
  const diagnostics: string[] = []

  page.on('console', (message) => {
    if (diagnosticConsoleTypes.has(message.type())) {
      diagnostics.push(`console.${message.type()}: ${message.text()}`)
    }
  })

  page.on('pageerror', (error) => {
    diagnostics.push(`pageerror: ${error.message}`)
  })

  page.on('requestfailed', (request) => {
    diagnostics.push(
      `requestfailed: ${request.method()} ${request.url()} ${request.failure()?.errorText ?? ''}`
    )
  })

  page.on('response', (response) => {
    if (response.status() >= 400) {
      diagnostics.push(`http.${response.status()}: ${response.url()}`)
    }
  })

  return diagnostics
}
