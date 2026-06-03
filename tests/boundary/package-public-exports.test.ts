import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import * as iconsVue from '../../packages/element-plus/icons-vue'
import * as markdownRuntime from '../../packages/element-plus/markdown-runtime'
import * as result from '../../packages/element-plus/result'
import * as theme from '../../packages/element-plus/theme'
import * as wasm from '../../packages/element-plus/wasm'

const repoRoot = join(__dirname, '..', '..')

describe('package public exports', () => {
  it('declares stable subpath exports for downstream adapters', () => {
    const packageJson = JSON.parse(
      readFileSync(
        join(repoRoot, 'packages', 'element-plus', 'package.json'),
        'utf8',
      ),
    )

    expect(packageJson.exports).toEqual(
      expect.objectContaining({
        './icons-vue': expect.any(Object),
        './markdown-runtime': expect.any(Object),
        './result': expect.any(Object),
        './theme': expect.any(Object),
        './wasm': expect.any(Object),
        './dist/public-shell-critical.css': './dist/public-shell-critical.css',
      }),
    )
  })

  it('resolves stable public API modules without deep component paths', () => {
    expect(typeof theme.syncThemeMode).toBe('function')
    expect(typeof theme.readThemeMode).toBe('function')
    expect(typeof result.isFsusResult).toBe('function')
    expect(typeof result.getFsusErrorMessage).toBe('function')
    expect(typeof markdownRuntime.activateMarkdownFeatures).toBe('function')
    expect(typeof markdownRuntime.renderMarkdownResultWithRuntime).toBe(
      'function',
    )
    expect(typeof wasm.ensureWasmReady).toBe('function')
    expect(iconsVue.Search).toBeTruthy()
  })

  it('keeps the downstream fixture on public package paths only', () => {
    const fixture = readFileSync(
      join(repoRoot, 'tests', 'fixtures', 'downstream-public-api-adapter.ts'),
      'utf8',
    )

    expect(fixture).toContain('@ozwasyd/element-plus/theme')
    expect(fixture).toContain('@ozwasyd/element-plus/icons-vue')
    expect(fixture).toContain('@ozwasyd/element-plus/markdown-runtime')
    expect(fixture).not.toMatch(/@ozwasyd\/element-plus\/es\/.*\/src\//)
  })
})
