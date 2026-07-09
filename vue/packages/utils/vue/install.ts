import { NOOP } from '@vue/shared'
import {
  registerFsusDefaultRenderPipelineComponentPolicies,
  registerFsusRenderPipelineComponentPolicyByName,
  resolveFsusInstallComponentName,
} from './render-pipeline-policy'

import type { App, Directive } from 'vue'
import type { SFCInstallWithContext, SFCWithInstall } from './typescript'

export const withInstall = <T, E extends Record<string, any>>(
  main: T,
  extra?: E,
) => {
  ;(main as SFCWithInstall<T>).install = (app: App): void => {
    const components = [main, ...Object.values(extra ?? {})]
    registerFsusDefaultRenderPipelineComponentPolicies(components)

    for (const comp of components) {
      app.component(comp.name!, comp)
    }
  }

  if (extra) {
    for (const [key, comp] of Object.entries(extra)) {
      ;(main as any)[key] = comp
    }
  }
  return main as SFCWithInstall<T> & E
}

export const withInstallFunction = <T>(fn: T, name: string) => {
  ;(fn as { __fsusRenderPipelineComponentName?: string })
    .__fsusRenderPipelineComponentName = resolveFsusInstallComponentName(name)

  ;(fn as SFCWithInstall<T>).install = (app: App) => {
    registerFsusRenderPipelineComponentPolicyByName(
      resolveFsusInstallComponentName(name),
    )
    ;(fn as SFCInstallWithContext<T>)._context = app._context
    app.provide?.(name, fn)
    app.config.globalProperties[name] = fn
  }

  return fn as SFCInstallWithContext<T>
}

export const withInstallDirective = <T extends Directive>(
  directive: T,
  name: string,
) => {
  ;(directive as { __fsusRenderPipelineComponentName?: string })
    .__fsusRenderPipelineComponentName = resolveFsusInstallComponentName(
    name,
    'Directive',
  )

  ;(directive as SFCWithInstall<T>).install = (app: App): void => {
    registerFsusRenderPipelineComponentPolicyByName(
      resolveFsusInstallComponentName(name, 'Directive'),
    )
    app.directive(name, directive)
  }

  return directive as SFCWithInstall<T>
}

export const withNoopInstall = <T>(component: T) => {
  ;(component as SFCWithInstall<T>).install = () => {
    registerFsusDefaultRenderPipelineComponentPolicies([component])
    NOOP()
  }

  return component as SFCWithInstall<T>
}
