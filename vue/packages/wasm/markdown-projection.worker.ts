import {
  bindMarkdownProjectionWorkerScope,
  type MarkdownProjectionWorkerScope,
} from './markdown-projection-worker'

bindMarkdownProjectionWorkerScope(
  self as unknown as MarkdownProjectionWorkerScope,
)
