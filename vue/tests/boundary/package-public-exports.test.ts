import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import * as icons from '../../packages/fsusui/src/icons'
import * as markdown from '../../packages/fsusui/src/markdown'
import * as result from '../../packages/fsusui/src/result'
import * as theme from '../../packages/fsusui/src/theme'
import * as wasm from '../../packages/fsusui/src/wasm'

const repoRoot = join(__dirname, '..', '..', '..')
const vueRoot = join(repoRoot, 'vue')

describe('package public exports', () => {
  it('declares stable pure-ESM subpath exports for @ozwasyd/fsusui 2.0', () => {
    const packageJson = JSON.parse(
      readFileSync(
        join(vueRoot, 'packages', 'fsusui', 'package.json'),
        'utf8',
      ),
    )

    expect(packageJson.name).toBe('@ozwasyd/fsusui')
    expect(packageJson.type).toBe('module')
    expect(packageJson.exports).toEqual(
      expect.objectContaining({
        '.': expect.objectContaining({ import: './dist/index.mjs' }),
        './core': expect.objectContaining({ import: './dist/core.mjs' }),
        './icons': expect.objectContaining({ import: './dist/icons.mjs' }),
        './motion': expect.objectContaining({ import: './dist/motion.mjs' }),
        './markdown': expect.objectContaining({ import: './dist/markdown.mjs' }),
        './wasm': expect.objectContaining({ import: './dist/wasm.mjs' }),
        './theme': expect.objectContaining({ import: './dist/theme.mjs' }),
        './locale': expect.objectContaining({ import: './dist/locale.mjs' }),
        './result': expect.objectContaining({ import: './dist/result.mjs' }),
        './render-pipeline': expect.objectContaining({
          import: './dist/render-pipeline.mjs',
        }),
        './perception-challenge': expect.objectContaining({
          import: './dist/perception-challenge.mjs',
        }),
        './styles/fsus.css': './dist/styles/fsus.css',
        './styles/markdown.css': './dist/styles/markdown.css',
        './global': expect.objectContaining({ types: './dist/global.d.ts' }),
      }),
    )
  })

  it('retires all CommonJS, UMD, and Element Plus compatibility subpaths', () => {
    const packageJson = JSON.parse(
      readFileSync(
        join(vueRoot, 'packages', 'fsusui', 'package.json'),
        'utf8',
      ),
    )

    for (const forbidden of [
      './*',
      './lib/*',
      './lib/index',
      './es/*',
      './icons-vue',
      './theme-chalk/*',
      './markdown-runtime',
    ]) {
      expect(Object.hasOwn(packageJson.exports, forbidden)).toBe(false)
    }
  })

  it('resolves stable public API modules cleanly', () => {
    expect(typeof theme.syncThemeMode).toBe('function')
    expect(typeof theme.readThemeMode).toBe('function')
    expect(typeof result.isFsusResult).toBe('function')
    expect(typeof result.getFsusErrorMessage).toBe('function')
    expect(typeof markdown.activateMarkdownFeatures).toBe('function')
    expect(typeof markdown.renderMarkdownResultWithRuntime).toBe('function')
    expect(typeof wasm.ensureWasmReady).toBe('function')
    expect(icons.FsusIcon).toBeTruthy()
  })
})
