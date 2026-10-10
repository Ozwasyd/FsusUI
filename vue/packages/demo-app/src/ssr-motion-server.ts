import { renderToString } from 'vue/server-renderer'
import { createSsrMotionApp } from './ssr-motion-app'

export const render = async () => {
  const context: { teleports?: Record<string, string> } = {}
  const html = await renderToString(createSsrMotionApp(), context)
  const teleports = Object.entries(context.teleports ?? {})
    .map(([target, content]) => {
      if (target === 'body') return content
      if (!target.startsWith('#')) {
        throw new Error(`Unsupported SSR teleport target: ${target}`)
      }
      return `<div id="${target.slice(1)}">${content}</div>`
    })
    .join('')

  return { html, teleports }
}
