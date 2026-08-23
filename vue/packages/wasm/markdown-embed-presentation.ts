import type { MarkdownEmbedResult } from './markdown-embed-provider'

export const presentMarkdownEmbed = (result: MarkdownEmbedResult) => {
  if (result.status !== 'resolved') {
    return { visible: false, title: null, mode: result.mode }
  }
  return {
    visible: true,
    title: result.title ?? result.target,
    mode: result.mode,
    card: false,
  }
}
