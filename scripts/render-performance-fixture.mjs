export const waitForPerformanceFixture = async (page) => {
  const state = await page.waitForFunction(
    () => {
      const fixture = document.querySelector('[data-performance-scenario]')
      if (!fixture) return false
      const ready = fixture.getAttribute('data-performance-ready')
      const error = fixture.getAttribute('data-performance-error')
      if (ready !== 'true' && ready !== 'error' && error === null) return false
      return {
        ready,
        error,
        scenario: fixture.getAttribute('data-performance-scenario'),
      }
    },
    undefined,
    { timeout: 120_000 },
  )
  try {
    const result = await state.jsonValue()
    // A fallback render can emit completion after its error callback. The
    // retained error takes precedence over the later ready="true" attribute.
    if (result.error !== null || result.ready === 'error') {
      throw new Error(
        `Performance fixture failed (${result.scenario}): ${result.error || 'render error'}`,
      )
    }
  } finally {
    await state.dispose()
  }
}
