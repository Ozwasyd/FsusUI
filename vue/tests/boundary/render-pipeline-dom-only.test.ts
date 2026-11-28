import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import fg from 'fast-glob'
import { describe, expect, it } from 'vitest'

const domRenderPipelineGlobs = [
  'vue/packages/core/src/render-pipeline/**/*.{ts,tsx,vue}',
  'vue/packages/markdown/src/markdown-renderer/**/*.{ts,tsx,vue}',
]

const forbiddenDomRendererApis =
  /\b(OffscreenCanvas|WebGPU|webgpu|transferControlToOffscreen)\b|createElement\(['"]canvas['"]\)|getContext\(['"]2d['"]\)|<canvas\b/

describe('render pipeline pure DOM boundary', () => {
  it('keeps the unified render pipeline free of canvas and WebGPU renderers', async () => {
    const files = await fg(domRenderPipelineGlobs, {
      cwd: process.cwd(),
      absolute: true,
      ignore: ['**/__tests__/**'],
    })

    expect(files.length).toBeGreaterThan(0)
    for (const file of files) {
      const source = readFileSync(file, 'utf8')
      expect(
        forbiddenDomRendererApis.test(source),
        `${resolve(file)} must keep render-pipeline output on DOM/Vue, not canvas/WebGPU`,
      ).toBe(false)
    }
  })
})
