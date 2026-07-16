import path from 'node:path'
import { rollup } from 'rollup'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import VueMacros from 'unplugin-vue-macros/rollup'
import json from '@rollup/plugin-json'
import { nodeResolve } from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import esbuild from 'rollup-plugin-esbuild'
import glob from 'fast-glob'
import { epRoot, excludeFiles, pkgRoot } from '@element-plus/build-utils'
import {
  generateExternal,
  shouldIgnoreRollupWarning,
  writeBundles,
} from '../utils'
import { ElementPlusAlias } from '../plugins/element-plus-alias'
import { buildConfigEntries, target } from '../build-info'

import type { OutputOptions } from 'rollup'

export const buildModules = async () => {
  const externalPackage = await generateExternal({ full: false })
  const wasmSourceEntry = path.resolve(pkgRoot, 'wasm/index.ts')
  const external = (id: string) =>
    externalPackage(id) ||
    id === './ep_wasm.mjs' ||
    id.endsWith('/packages/wasm/ep_wasm.mjs') ||
    id.endsWith('/packages/wasm/dist/ep_wasm.mjs')
  const input = excludeFiles(
    await glob('**/*.{js,ts,vue}', {
      cwd: pkgRoot,
      absolute: true,
      onlyFiles: true,
    }),
  )
  const vueMacrosPlugins = await VueMacros({
    setupComponent: false,
    setupSFC: false,
    plugins: {
      vue: vue({
        isProduction: false,
      }),
      vueJsx: vueJsx(),
    },
  })
  const bundle = await rollup({
    input,
    onwarn(warning, warn) {
      if (shouldIgnoreRollupWarning(warning)) return
      warn(warning)
    },
    plugins: [
      {
        name: 'element-plus-wasm-source',
        resolveId(id) {
          if (id === '@element-plus/wasm') return wasmSourceEntry
        },
      },
      ElementPlusAlias(),
      ...vueMacrosPlugins,
      json(),
      nodeResolve({
        extensions: ['.mjs', '.js', '.json', '.ts'],
      }),
      commonjs(),
      esbuild({
        sourceMap: true,
        target,
        loaders: {
          '.vue': 'ts',
        },
      }),
    ],
    external,
    treeshake: false,
  })
  await writeBundles(
    bundle,
    buildConfigEntries.map(([module, config]): OutputOptions => {
      return {
        format: config.format,
        dir: config.output.path,
        exports: module === 'cjs' ? 'named' : undefined,
        preserveModules: true,
        preserveModulesRoot: epRoot,
        sourcemap: true,
        entryFileNames: `[name].${config.ext}`,
      }
    }),
  )
}
