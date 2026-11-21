import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import SsrContractApp from './SsrContractApp.vue'

export interface SsrRenderOptions {
  initialOpen: boolean
  theme: 'light' | 'dark'
}

export interface SsrRenderResult {
  appHtml: string
  viewerTeleport: string
  probeTeleport: string
}

export async function render(options: SsrRenderOptions): Promise<SsrRenderResult> {
  const app = createSSRApp({
    render() {
      return h(SsrContractApp, {
        initialOpen: options.initialOpen,
        theme: options.theme,
      })
    },
  })
  const context: { teleports?: Record<string, string> } = {}
  const appHtml = await renderToString(app, context)
  return {
    appHtml,
    viewerTeleport: context.teleports?.['#viewer-teleports'] ?? '',
    probeTeleport: context.teleports?.['#probe-teleports'] ?? '',
  }
}
