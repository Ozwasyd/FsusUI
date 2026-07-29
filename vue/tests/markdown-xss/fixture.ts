import { createApp, h, nextTick } from 'vue'
import MarkdownRenderer from '../../packages/components/markdown-renderer/src/markdown-renderer.vue'
import {
  renderMarkdownChunksWithRuntime,
  renderMarkdownHtmlWithRuntime,
  renderMarkdownResultWithRuntime,
} from '@element-plus/wasm'
import { commitMarkdownFeatureOutput } from '../../packages/wasm/markdown-feature-output-gateway'
import { markdownXssKillControls } from '../support/markdown-xss-kill-controls'
import {
  auditMarkdownXssHtml,
  canonicalMarkdownXssDomProjection,
} from '../support/markdown-xss-dom'
import type { FeatureRenderOutput } from '../../packages/wasm/markdown-feature-output-gateway'
import type { MarkdownRenderRequest } from '../../packages/wasm/markdown'

type FsusResult<T> =
  | { ok: true; value: T }
  | { error: { message: string }; ok: false }
type CorpusCase = {
  featureOutput?: FeatureRenderOutput
  id: string
  source?: string
}

const unwrap = <T>(result: FsusResult<T>) => {
  if (result.ok === false) throw new Error(result.error.message)
  return result.value
}

let workerSequence = 0
let markdownWorker: Worker | undefined
const workerRequests = new Map<
  number,
  {
    reject: (error: Error) => void
    resolve: (html: string) => void
    timeout: number
  }
>()
const getMarkdownWorker = () => {
  if (markdownWorker) return markdownWorker
  markdownWorker = new Worker(
    new URL('./markdown-xss-worker.ts', import.meta.url),
    { type: 'module' },
  )
  markdownWorker.onerror = (event) => {
    for (const request of workerRequests.values()) {
      window.clearTimeout(request.timeout)
      request.reject(new Error(event.message))
    }
    workerRequests.clear()
    markdownWorker?.terminate()
    markdownWorker = undefined
  }
  markdownWorker.onmessage = (event) => {
    const request = workerRequests.get(event.data.id)
    if (!request) return
    workerRequests.delete(event.data.id)
    window.clearTimeout(request.timeout)
    const result = unwrap(event.data.result)
    request.resolve(
      result.chunks.map((chunk: { html: string }) => chunk.html).join(''),
    )
  }
  return markdownWorker
}
const renderInWorker = (request: MarkdownRenderRequest) =>
  new Promise<string>((resolve, reject) => {
    const id = ++workerSequence
    const timeout = window.setTimeout(() => {
      workerRequests.delete(id)
      reject(new Error(`markdown_xss_worker_timeout:${id}`))
    }, 15_000)
    workerRequests.set(id, { reject, resolve, timeout })
    getMarkdownWorker().postMessage({ id, request })
  })

const renderInitialHydration = async (
  request: MarkdownRenderRequest,
  initialRender: Awaited<
    ReturnType<typeof renderMarkdownResultWithRuntime>
  > extends FsusResult<infer Result>
    ? Result
    : never,
) => {
  const mountTarget = document.createElement('div')
  document.body.append(mountTarget)
  const app = createApp({
    render: () =>
      h(MarkdownRenderer, {
        content: request.source,
        initialRender,
      }),
  })
  app.mount(mountTarget)
  const initial = mountTarget.innerHTML
  await nextTick()
  await new Promise((resolve) => window.setTimeout(resolve, 0))
  await nextTick()
  const hydrated = mountTarget.innerHTML
  app.unmount()
  mountTarget.remove()
  return { hydrated, initial }
}

const renderFeatureOutput = (output: FeatureRenderOutput) => {
  const target =
    output.kind === 'code-highlight'
      ? Object.assign(document.createElement('pre'), { className: 'shiki' })
      : document.createElement('div')
  const host = document.createElement('div')
  host.append(target)
  const committed = commitMarkdownFeatureOutput(target, output, {
    mode: output.kind === 'code-highlight' ? 'replace-element' : undefined,
    nonce: 'markdown-xss-test',
  })
  return output.kind === 'code-highlight' ? committed.outerHTML : host.innerHTML
}

const renderCorpusCase = async (entry: CorpusCase) => {
  if (entry.featureOutput) {
    return {
      'feature-gateway': renderFeatureOutput(entry.featureOutput),
    }
  }
  if (!entry.source) throw new Error(`${entry.id}: missing source`)
  const request: MarkdownRenderRequest = {
    allowLatex: true,
    allowMermaid: true,
    source: entry.source,
  }
  const [htmlOnly, full, chunks, worker] = await Promise.all([
    renderMarkdownHtmlWithRuntime(request).then(unwrap),
    renderMarkdownResultWithRuntime(request).then(unwrap),
    renderMarkdownChunksWithRuntime(request).then(unwrap),
    renderInWorker(request),
  ])
  const initialRender = await renderInitialHydration(request, full)
  return {
    'core-sync': full.html,
    wasm: htmlOnly.html,
    worker,
    chunked: chunks.chunks.map((chunk) => chunk.html).join(''),
    'ssr-no-dom': htmlOnly.html,
    'initial-render': initialRender.initial,
    'initial-render-hydrated': initialRender.hydrated,
  }
}

const dispose = () => {
  markdownWorker?.terminate()
  markdownWorker = undefined
  workerRequests.clear()
}

const auditHtml = (
  html: string,
  invariants?: {
    allowedNamespaces?: string[]
    forbidSelectors?: string[]
  },
) => auditMarkdownXssHtml(document, html, invariants)

Object.assign(window, {
  __markdownXss: {
    auditHtml,
    canonicalProjection: (html: string) =>
      canonicalMarkdownXssDomProjection(document, html),
    controls: markdownXssKillControls,
    dispose,
    renderCorpusCase,
  },
})

declare global {
  interface Window {
    __markdownXss: {
      auditHtml: typeof auditHtml
      canonicalProjection: (html: string) => unknown
      controls: typeof markdownXssKillControls
      dispose: typeof dispose
      renderCorpusCase: typeof renderCorpusCase
    }
  }
}
