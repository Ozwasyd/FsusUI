import { describe, expect, it } from 'vitest'
import { createApp, h } from 'vue'
import {
  clearFsusRenderPipelineComponentPolicies,
  getFsusRenderPipelineComponentPolicy,
  registerFsusRenderPipelineComponentPolicies,
  resolveFsusRenderPipelineComponentPolicy,
  resolveFsusRenderPipelineConfig,
} from '@element-plus/hooks'
import {
  createFsusRenderPipelineComponentPolicies,
  createFsusRenderPipelineComponentPolicy,
} from '../../packages/element-plus/render-pipeline-policies'
import {
  ElButton,
  ElLoading,
  ElMessage,
  ElMessageBox,
  ElNotification,
  ElPopoverDirective,
} from '../../packages/element-plus'
import { makeInstaller } from '../../packages/element-plus/make-installer'
import { demoComponents } from '../../packages/demo-app/src/demo-components'

const componentNameOf = (component: unknown) => {
  const candidate = component as { name?: unknown; __name?: unknown }
  if (typeof candidate.name === 'string') return candidate.name
  if (typeof candidate.__name === 'string') return candidate.__name
  return null
}

describe('render pipeline component coverage', () => {
  it('creates a render pipeline policy for every demo component', () => {
    const components = Object.values(demoComponents)
    const names = components.map(componentNameOf)
    const policies = createFsusRenderPipelineComponentPolicies(components)
    const policyNames = new Set(policies.map((policy) => policy.componentName))

    expect(
      names.every(Boolean),
      'every demo component must expose a stable component name',
    ).toBe(true)

    for (const name of names) {
      expect(
        policyNames.has(name!),
        `${name} is missing a render pipeline policy`,
      ).toBe(true)
    }
  })

  it('resolves every demo component through the shared strategy path', () => {
    clearFsusRenderPipelineComponentPolicies()
    const policies = createFsusRenderPipelineComponentPolicies(
      Object.values(demoComponents),
    )
    const unregister = registerFsusRenderPipelineComponentPolicies(policies)
    const config = resolveFsusRenderPipelineConfig()

    for (const policy of policies) {
      expect(
        getFsusRenderPipelineComponentPolicy(policy.componentName),
        `${policy.componentName} was not registered`,
      ).toBeDefined()

      const resolved = resolveFsusRenderPipelineComponentPolicy(
        policy.componentName,
        config,
      )
      expect(
        ['sync', 'chunked-main', 'chunked-worker', 'disabled'].includes(
          resolved.strategy,
        ),
        `${policy.componentName} resolved an unknown strategy`,
      ).toBe(true)
    }

    unregister()
  })

  it('classifies chunkable and inherited controls without component-local branches', () => {
    const config = resolveFsusRenderPipelineConfig()
    clearFsusRenderPipelineComponentPolicies()
    const unregister = registerFsusRenderPipelineComponentPolicies([
      createFsusRenderPipelineComponentPolicy('ElButton'),
      createFsusRenderPipelineComponentPolicy('ElMarkdownRenderer'),
      createFsusRenderPipelineComponentPolicy('ElFixedSizeList'),
      createFsusRenderPipelineComponentPolicy('ElTableV2'),
      createFsusRenderPipelineComponentPolicy('ElScrollbar'),
    ])

    expect(
      resolveFsusRenderPipelineComponentPolicy('ElButton', config).strategy,
    ).toBe('sync')
    expect(
      resolveFsusRenderPipelineComponentPolicy('ElMarkdownRenderer', config)
        .role,
    ).toBe('chunk-adapter')
    expect(
      resolveFsusRenderPipelineComponentPolicy('ElMarkdownRenderer', config)
        .strategy,
    ).not.toBe('sync')
    expect(
      resolveFsusRenderPipelineComponentPolicy('ElFixedSizeList', config).role,
    ).toBe('virtual-list')
    expect(
      resolveFsusRenderPipelineComponentPolicy('ElTableV2', config).inherits,
    ).toBe('ElFixedSizeGrid')
    expect(
      resolveFsusRenderPipelineComponentPolicy('ElScrollbar', config).role,
    ).toBe('viewport-provider')
    unregister()
  })

  it('registers policies through the installer path', () => {
    clearFsusRenderPipelineComponentPolicies()
    const app = createApp({ render: () => h('div') })

    app.use(
      makeInstaller([
        demoComponents.ElButton,
        demoComponents.ElMarkdownRenderer,
        demoComponents.ElTableV2,
      ]),
    )

    expect(getFsusRenderPipelineComponentPolicy('ElButton')?.role).toBe(
      'sync-monitored',
    )
    expect(
      getFsusRenderPipelineComponentPolicy('ElMarkdownRenderer')?.role,
    ).toBe('chunk-adapter')
    expect(getFsusRenderPipelineComponentPolicy('ElTableV2')?.inherits).toBe(
      'ElFixedSizeGrid',
    )
  })

  it('registers policies through single component on-demand installs', () => {
    clearFsusRenderPipelineComponentPolicies()
    const app = createApp({ render: () => h('div') })

    app.use(ElButton)
    expect(getFsusRenderPipelineComponentPolicy('ElButton')?.role).toBe(
      'sync-monitored',
    )
    expect(getFsusRenderPipelineComponentPolicy('ElButtonGroup')?.role).toBe(
      'sync-monitored',
    )

    app.use(demoComponents.ElMarkdownRenderer)
    expect(
      getFsusRenderPipelineComponentPolicy('ElMarkdownRenderer')?.role,
    ).toBe('chunk-adapter')

    app.use(demoComponents.FixedSizeList)
    expect(getFsusRenderPipelineComponentPolicy('ElFixedSizeList')?.role).toBe(
      'virtual-list',
    )
  })

  it('registers policies through single service and directive installs', () => {
    clearFsusRenderPipelineComponentPolicies()
    const app = createApp({ render: () => h('div') })

    app.use(ElLoading)
    app.use(ElMessage)
    app.use(ElMessageBox)
    app.use(ElNotification)
    app.use(ElPopoverDirective)

    expect(getFsusRenderPipelineComponentPolicy('ElLoading')?.role).toBe(
      'service',
    )
    expect(getFsusRenderPipelineComponentPolicy('ElMessage')?.role).toBe(
      'service',
    )
    expect(getFsusRenderPipelineComponentPolicy('ElMessageBox')?.role).toBe(
      'service',
    )
    expect(getFsusRenderPipelineComponentPolicy('ElNotification')?.role).toBe(
      'service',
    )
    expect(
      getFsusRenderPipelineComponentPolicy('ElPopoverDirective')?.role,
    ).toBe('directive')
  })

  it('registers every installable demo component through on-demand install', () => {
    for (const [exportName, component] of Object.entries(demoComponents)) {
      const install = (component as { install?: unknown }).install
      const componentName = componentNameOf(component)
      if (!componentName || typeof install !== 'function') continue

      clearFsusRenderPipelineComponentPolicies()
      const app = createApp({ render: () => h('div') })
      app.use(component as never)

      expect(
        getFsusRenderPipelineComponentPolicy(componentName),
        `${exportName}/${componentName} did not register a render pipeline policy through app.use(component)`,
      ).toBeDefined()
    }
  })
})
