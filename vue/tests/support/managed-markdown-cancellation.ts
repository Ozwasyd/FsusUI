import type { Frame, Page, Request } from '@playwright/test'

// Only explicit test actions may attribute a managed realm cancellation. The
// iframe calls this binding itself, preserving its exact execution-context
// Frame even when synchronous teardown defeats frameElement() inspection.
export const observeManagedMarkdownCancellation = async (page: Page) => {
  const intended = new Set<Frame>()
  const detached = new Set<Frame>()
  const origins = new Map<Request, Frame>()
  const aborted: { request: Request; message: string }[] = []
  await page.exposeBinding('__fsusCaptureScrollMarkdownRealm', ({ frame }) => {
    if (frame !== page.mainFrame() && frame.parentFrame() === page.mainFrame())
      intended.add(frame)
  })
  page.on('request', (request) => {
    const frame = request.frame()
    if (frame !== page.mainFrame() && frame.parentFrame() === page.mainFrame())
      origins.set(request, frame)
  })
  page.on('framedetached', (frame) => detached.add(frame))
  page.on('requestfailed', (request) => {
    if (request.failure()?.errorText !== 'net::ERR_ABORTED') return
    aborted.push({
      request,
      message: `requestfailed: ${request.method()} ${request.url()} net::ERR_ABORTED`,
    })
  })
  return (messages: readonly string[]) => {
    const remaining = [...messages]
    for (const failure of aborted) {
      const frame = failure.request.frame()
      if (
        origins.get(failure.request) !== frame ||
        !intended.has(frame) ||
        !detached.has(frame) ||
        !frame.isDetached()
      )
        continue
      const index = remaining.indexOf(failure.message)
      if (index !== -1) remaining.splice(index, 1)
    }
    return remaining
  }
}
