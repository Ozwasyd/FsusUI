import { isMainThread, parentPort } from 'node:worker_threads'
import { tsImport } from 'tsx/esm/api'

if (!isMainThread && parentPort) {
  const { bindMarkdownProjectionWorkerScope } = await tsImport(
    './markdown-projection-worker.ts',
    import.meta.url,
  )
  const port = parentPort
  bindMarkdownProjectionWorkerScope({
    set onmessage(handler) {
      port.on('message', (data) => handler({ data }))
    },
    get onmessage() {
      return null
    },
    postMessage(message) {
      port.postMessage(message)
    },
  })
}
