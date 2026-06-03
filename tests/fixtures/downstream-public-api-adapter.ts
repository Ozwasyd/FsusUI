import {
  readThemeMode,
  subscribeThemeMode,
  syncThemeMode,
  writeThemeMode,
} from '@ozwasyd/element-plus/theme'
import { Search } from '@ozwasyd/element-plus/icons-vue'
import {
  activateMarkdownFeatures,
  renderMarkdownResultWithRuntime,
} from '@ozwasyd/element-plus/markdown-runtime'
import {
  getFsusErrorMessage,
  isTruthyFsusOk,
} from '@ozwasyd/element-plus/result'
import {
  getFsusRenderPipelineComponentPolicy,
  resolveFsusRenderPipelineConfig,
} from '@ozwasyd/element-plus/render-pipeline'

export const connectDownstreamPublicApi = () => {
  const mode = readThemeMode({ storageKey: 'fsus-blog-theme' })
  const resolved = syncThemeMode(mode)
  writeThemeMode(mode, { storageKey: 'fsus-blog-theme' })
  const unsubscribe = subscribeThemeMode(() => undefined)

  return {
    Search,
    activateMarkdownFeatures,
    getFsusErrorMessage,
    getFsusRenderPipelineComponentPolicy,
    isTruthyFsusOk,
    renderMarkdownResultWithRuntime,
    resolveFsusRenderPipelineConfig,
    resolved,
    unsubscribe,
  }
}
