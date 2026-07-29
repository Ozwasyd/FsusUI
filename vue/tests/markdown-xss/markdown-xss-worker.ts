import { renderMarkdownChunksWithRuntime } from '@element-plus/wasm'
import type { MarkdownRenderRequest } from '@element-plus/wasm'

self.onmessage = async (
  event: MessageEvent<{ id: number; request: MarkdownRenderRequest }>,
) => {
  const result = await renderMarkdownChunksWithRuntime(event.data.request)
  self.postMessage({ id: event.data.id, result })
}
