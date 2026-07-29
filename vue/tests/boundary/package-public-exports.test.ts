import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import * as iconsVue from '../../packages/element-plus/icons-vue'
import * as markdownRuntime from '../../packages/element-plus/markdown-runtime'
import * as result from '../../packages/element-plus/result'
import * as theme from '../../packages/element-plus/theme'
import * as wasm from '../../packages/element-plus/wasm'

const repoRoot = join(__dirname, '..', '..', '..')
const vueRoot = join(repoRoot, 'vue')

describe('package public exports', () => {
  it('declares stable subpath exports for downstream adapters', () => {
    const packageJson = JSON.parse(
      readFileSync(
        join(vueRoot, 'packages', 'element-plus', 'package.json'),
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
        './dist/index.css': './dist/index.css',
        './dist/public-shell-critical.css': './dist/public-shell-critical.css',
        './theme-chalk/*': './theme-chalk/*',
      }),
    )
  })

  it('uses an explicit compatibility allowlist without broad or wasm deep exports', () => {
    const packageJson = JSON.parse(
      readFileSync(
        join(vueRoot, 'packages', 'element-plus', 'package.json'),
        'utf8',
      ),
    )

    for (const forbidden of [
      './*',
      './es/*.mjs',
      './es/*',
      './lib/*.js',
      './lib/*',
    ]) {
      expect(Object.hasOwn(packageJson.exports, forbidden)).toBe(false)
    }
    expect(packageJson.exports['./es/wasm/*']).toBeNull()
    expect(packageJson.exports['./lib/wasm/*']).toBeNull()

    expect(packageJson.exports).toEqual(
      expect.objectContaining({
        './es/index': {
          types: './es/index.d.ts',
          import: './es/index.mjs',
        },
        './lib/index': {
          types: './lib/index.d.ts',
          require: './lib/index.js',
        },
        './es/icons-vue': {
          types: './es/icons-vue.d.ts',
          import: './es/icons-vue.mjs',
        },
        './lib/icons-vue': {
          types: './lib/icons-vue.d.ts',
          require: './lib/icons-vue.js',
        },
        './es/wasm': {
          types: './es/wasm.d.ts',
          import: './es/wasm.mjs',
        },
        './lib/wasm': {
          types: './lib/wasm.d.ts',
          require: './lib/wasm.js',
        },
        './es/motion': {
          types: './es/motion.d.ts',
          import: './es/motion.mjs',
        },
        './lib/motion': {
          types: './lib/motion.d.ts',
          require: './lib/motion.js',
        },
      }),
    )

    for (const directory of [
      'components',
      'constants',
      'directives',
      'hooks',
      'locale',
      'motion',
      'utils',
    ]) {
      expect(packageJson.exports[`./es/${directory}/*`]).toEqual({
        types: [`./es/${directory}/*.d.ts`, `./es/${directory}/*/index.d.ts`],
        import: `./es/${directory}/*.mjs`,
      })
      expect(packageJson.exports[`./lib/${directory}/*`]).toEqual({
        types: [`./lib/${directory}/*.d.ts`, `./lib/${directory}/*/index.d.ts`],
        require: `./lib/${directory}/*.js`,
      })
      expect(packageJson.exports[`./es/${directory}/*.mjs`]).toEqual({
        types: `./es/${directory}/*.d.ts`,
        import: `./es/${directory}/*.mjs`,
      })
      expect(packageJson.exports[`./lib/${directory}/*.js`]).toEqual({
        types: `./lib/${directory}/*.d.ts`,
        require: `./lib/${directory}/*.js`,
      })
    }
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
