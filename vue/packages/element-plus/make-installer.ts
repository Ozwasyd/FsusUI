import { provideGlobalConfig } from '@element-plus/components/config-provider'
import { syncThemeMode } from '@element-plus/components/config-provider'
import { INSTALLED_KEY } from '@element-plus/constants'
import { registerFsusDefaultRenderPipelineComponentPolicies } from './render-pipeline-policies'
import { version } from './version'

import type { App, Plugin } from 'vue'
import type { ConfigProviderContext } from '@element-plus/components/config-provider'

export const makeInstaller = (components: Plugin[] = []) => {
  const install = (app: App, options?: ConfigProviderContext) => {
    if (app[INSTALLED_KEY]) return

    app[INSTALLED_KEY] = true
    registerFsusDefaultRenderPipelineComponentPolicies(components)
    components.forEach((c) => app.use(c))

    if (options) provideGlobalConfig(options, app, true)
    if (options?.themeMode) syncThemeMode(options.themeMode)
  }

  return {
    version,
    install,
  }
}

export const makeGroupedInstaller = (
  groups: Record<string, readonly Plugin[]>,
  enabledGroups = Object.keys(groups),
) =>
  makeInstaller(
    enabledGroups.flatMap((groupName) => [...(groups[groupName] ?? [])]),
  )
