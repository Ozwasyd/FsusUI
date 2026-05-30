import { readFileSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import fg from 'fast-glob'
import { describe, expect, it } from 'vitest'

const domRenderPipelineGlobs = [
  'packages/hooks/use-render-pipeline/**/*.{ts,tsx,vue}',
  'packages/components/markdown-renderer/src/**/*.{ts,tsx,vue}',
  'packages/components/virtual-list/src/**/*.{ts,tsx,vue}',
]

const forbiddenDomRendererApis =
  /\b(OffscreenCanvas|WebGPU|webgpu|transferControlToOffscreen)\b|createElement\(['"]canvas['"]\)|getContext\(['"]2d['"]\)|<canvas\b/

const renderPipelineDirectConsumerPattern =
  /useGlobalConfig\(['"]renderPipeline['"]\)|useFsusRenderPipelineRuntime|resolveFsusRenderPipelineCache|resolveFsusRenderPipelineUnitAttrs|useFsusRenderPipelineHardwareProfile/

const allowedRenderPipelineConsumers = [
  /^packages\/components\/config-provider\//,
  /^packages\/components\/markdown-renderer\//,
  /^packages\/components\/popper\/src\/composables\/use-content\.ts$/,
  /^packages\/components\/virtual-list\//,
]

describe('render pipeline pure DOM boundary', () => {
  it('keeps the unified render pipeline free of canvas and WebGPU renderers', async () => {
    const files = await fg(domRenderPipelineGlobs, {
      cwd: process.cwd(),
      absolute: true,
    })

    for (const file of files) {
      const source = readFileSync(file, 'utf8')
      expect(
        forbiddenDomRendererApis.test(source),
        `${resolve(file)} must keep render-pipeline output on DOM/Vue, not canvas/WebGPU`,
      ).toBe(false)
    }
  })

  it('keeps component-level render-pipeline consumers behind shared DOM primitives', async () => {
    const files = await fg('packages/components/**/*.{ts,tsx,vue}', {
      cwd: process.cwd(),
      absolute: true,
    })

    for (const file of files) {
      const source = readFileSync(file, 'utf8')
      if (!renderPipelineDirectConsumerPattern.test(source)) continue

      const repoPath = relative(process.cwd(), file)
      expect(
        allowedRenderPipelineConsumers.some((pattern) =>
          pattern.test(repoPath),
        ),
        `${repoPath} must consume render-pipeline through shared primitives, not component-local strategy branches`,
      ).toBe(true)
    }
  })
})
