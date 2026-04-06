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
import { generateExternal, writeBundles } from '../utils'
import { ElementPlusAlias } from '../plugins/element-plus-alias'
import { buildConfigEntries, target } from '../build-info'

import type { OutputOptions } from 'rollup'

const ignoreRollupWarning = (warning: { code?: string; exporter?: string; id?: string; message?: string }) => {
  const source = warning.exporter ?? warning.id ?? warning.message ?? ''
  return (
    (warning.code === 'UNRESOLVED_IMPORT' &&
      (source.includes('fsevents') || source.includes('vue-sfc-transformer/mkdist'))) ||
    (warning.code === 'CIRCULAR_DEPENDENCY' &&
      (source.includes('mlly') || source.includes('semver/classes')))
  )
}

export const buildModules = async () => {
  const input = excludeFiles(
    await glob('**/*.{js,ts,vue}', {
      cwd: pkgRoot,
      absolute: true,
      onlyFiles: true,
    })
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
      if (ignoreRollupWarning(warning)) return
      warn(warning)
    },
    plugins: [
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
    external: await generateExternal({ full: false }),
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
    })
  )
}
