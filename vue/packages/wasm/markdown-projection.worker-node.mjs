import { registerHooks } from 'node:module'
import { isMainThread, parentPort } from 'node:worker_threads'

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (
      specifier.startsWith('.') &&
      !/\.(?:[cm]?[jt]s|json|wasm)$/.test(specifier)
    ) {
      try {
        return nextResolve(specifier, context)
      } catch {
        return nextResolve(`${specifier}.ts`, context)
      }
    }
    return nextResolve(specifier, context)
  },
})

if (!isMainThread && parentPort) {
  const { bindMarkdownProjectionWorkerScope } = await import(
    './markdown-projection-worker.ts'
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
