import type { Frame, Page, Request } from '@playwright/test'

// Test-only observation of the actual lazy adapter's external abort path.
// Ordinary resolve/error cleanup is untouched. Source-shape drift fails closed;
// no production module, URL-based diagnostic allowlist, or lifecycle is changed.
export const instrumentManagedBridgeTeardown = (source: string) => {
  const start = source.indexOf(
    'const createMarkdownHeavyFeatureAdapterResourceBridgeInternal =',
  )
  const end = source.indexOf(
    'const createMarkdownHeavyFeatureAdapterResourceBridge =',
    start + 1,
  )
  if (start < 0 || end < 0)
    throw new Error('Managed bridge instrumentation boundary missing')
  const body = source.slice(start, end)
  const marker = /return Object\.freeze\(\{\s*resources,\s*run,\s*snapshot:/g
  if (
    [...body.matchAll(marker)].length !== 1 ||
    !/\n\s*teardown,?\s*\n/.test(body)
  )
    throw new Error('Managed bridge instrumentation shape changed')
  const instrumented = body
    .replace(
      marker,
      `let observedRequest;
  return Object.freeze({
    resources,
    run: (...args) => { observedRequest = args[2]; return run(...args); },
    snapshot:`,
    )
    .replace(
      /\n(\s*)teardown,?\s*\n/,
      `
    teardown: () => {
      try {
        if (taskActive && isolatedHandle)
          window.__fsusObserveBridgeAbort?.(observedRequest);
      } finally { return teardown(); }
    },
`,
    )
  return source.slice(0, start) + instrumented + source.slice(end)
}

export const isManagedMarkdownBridgeModule = (url: URL) =>
  url.pathname.endsWith('/vue/packages/wasm/markdown-heavy-feature-resource.ts')

export const observeManagedMarkdownCancellation = async (page: Page) => {
  await page.route(isManagedMarkdownBridgeModule, async (route) => {
    const response = await route.fetch()
    const source = await response.text()
    await route.fulfill({
      response,
      body: instrumentManagedBridgeTeardown(source),
    })
  })
  await page.addInitScript(() => {
    const scope = window as Window & {
      __fsusMeasuredMarkdownScroll?: boolean
      __fsusObserveBridgeAbort?: (request?: {
        lifecycleKey?: string
        kind?: string
      }) => void
    }
    scope.__fsusObserveBridgeAbort = (request) => {
      if (!scope.__fsusMeasuredMarkdownScroll || !request?.lifecycleKey) return
      const renderers = document.querySelectorAll<HTMLElement>(
        '.markdown-stress-content[data-markdown-heavy-lifecycle]',
      )
      if (renderers.length !== 1) return
      const metrics = JSON.parse(
        renderers[0].dataset.markdownHeavyLifecycle ?? '{}',
      )
      const identities = metrics.identitySequences?.[request.kind ?? ''] ?? []
      if (
        !identities.some(
          (identity: {
            documentKey: string
            documentEpoch: number
            nodeId: string
          }) =>
            [
              identity.documentKey,
              identity.documentEpoch,
              identity.nodeId,
              request.kind,
            ].join(':') === request.lifecycleKey,
        )
      )
        return
      const frames = Array.from(
        document.querySelectorAll<HTMLIFrameElement>(
          'iframe[data-fsus-markdown-heavy-node]',
        ),
      ).filter(
        (frame) =>
          frame.dataset.fsusMarkdownHeavyNode === request.lifecycleKey &&
          frame.dataset.fsusMarkdownHeavyPending === request.kind &&
          frame.getAttribute('aria-hidden') === 'true',
      )
      if (frames.length !== 1) return
      void (
        frames[0].contentWindow as Window & {
          __fsusCaptureScrollMarkdownRealm: () => Promise<void>
        }
      ).__fsusCaptureScrollMarkdownRealm()
    }
  })
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
