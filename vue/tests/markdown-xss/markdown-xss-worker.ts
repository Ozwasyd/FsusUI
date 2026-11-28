import { renderMarkdownChunksWithRuntime } from '@fsusui/wasm'
import type { MarkdownRenderRequest } from '@fsusui/wasm'

self.onmessage = async (
  event: MessageEvent<{ id: number; request: MarkdownRenderRequest }>,
) => {
  const result = await renderMarkdownChunksWithRuntime(event.data.request)
  self.postMessage({ id: event.data.id, result })
}
