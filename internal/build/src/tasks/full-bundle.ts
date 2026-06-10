import path from 'path'
import { nodeResolve } from '@rollup/plugin-node-resolve'
import { rollup } from 'rollup'
import commonjs from '@rollup/plugin-commonjs'
import vue from '@vitejs/plugin-vue'
import VueMacros from 'unplugin-vue-macros/rollup'
import vueJsx from '@vitejs/plugin-vue-jsx'
import esbuild, { minify as minifyPlugin } from 'rollup-plugin-esbuild'
import { parallel } from 'gulp'
import glob from 'fast-glob'
import { camelCase, upperFirst } from 'lodash-es'
import {
  PKG_BRAND_NAME,
  PKG_CAMELCASE_LOCAL_NAME,
  PKG_CAMELCASE_NAME,
} from '@element-plus/build-constants'
import {
  epOutput,
  epRoot,
  localeRoot,
  pkgRoot,
  projRoot,
} from '@element-plus/build-utils'
import { version } from '../../../../packages/element-plus/version'
import { ElementPlusAlias } from '../plugins/element-plus-alias'
import {
  formatBundleFilename,
  generateExternal,
  withTaskName,
  writeBundles,
} from '../utils'
import { target } from '../build-info'
import type { Plugin } from 'rollup'

const banner = `/*! ${PKG_BRAND_NAME} v${version} */\n`
const tsconfig = path.resolve(projRoot, 'tsconfig.web.json')
const ignoreRollupWarning = (warning: {
  code?: string
  exporter?: string
  id?: string
  message?: string
}) => {
  const source = warning.exporter ?? warning.id ?? warning.message ?? ''
  return (
    (warning.code === 'UNRESOLVED_IMPORT' &&
      (source.includes('fsevents') ||
        source.includes('vue-sfc-transformer/mkdist'))) ||
    (warning.code === 'CIRCULAR_DEPENDENCY' &&
      (source.includes('mlly') || source.includes('semver/classes')))
  )
}

async function buildFullEntry(minify: boolean) {
  const externalPackage = await generateExternal({ full: true })
  const wasmSourceEntry = path.resolve(pkgRoot, 'wasm/index.ts')
  const external = (id: string) =>
    externalPackage(id) ||
    id === './ep_wasm.mjs' ||
    id.endsWith('/packages/wasm/ep_wasm.mjs') ||
    id.endsWith('/packages/wasm/dist/ep_wasm.mjs')
  const vueMacrosPlugins = await VueMacros({
    setupComponent: false,
    setupSFC: false,
    plugins: {
      vue: vue({
        isProduction: true,
      }),
      vueJsx: vueJsx(),
    },
  })
  const plugins: Plugin[] = [
    {
      name: 'element-plus-wasm-source',
      resolveId(id) {
        if (id === '@element-plus/wasm') return wasmSourceEntry
      },
    },
    ElementPlusAlias(),
    ...vueMacrosPlugins,
    nodeResolve({
      extensions: ['.mjs', '.js', '.json', '.ts'],
    }),
    commonjs(),
    esbuild({
      exclude: [],
      sourceMap: minify,
      target,
      tsconfig,
      loaders: {
        '.vue': 'ts',
      },
      define: {
        'process.env.NODE_ENV': JSON.stringify('production'),
      },
      treeShaking: true,
      legalComments: 'eof',
    }),
  ]
  if (minify) {
    plugins.push(
      minifyPlugin({
        target,
        sourceMap: true,
      }),
    )
  }

  const bundle = await rollup({
    input: path.resolve(epRoot, 'index.ts'),
    onwarn(warning, warn) {
      if (ignoreRollupWarning(warning)) return
      warn(warning)
    },
    plugins,
    external,
    treeshake: true,
  })
  await writeBundles(bundle, [
    {
      format: 'umd',
      file: path.resolve(
        epOutput,
        'dist',
        formatBundleFilename('index.full', minify, 'js'),
      ),
      inlineDynamicImports: true,
      exports: 'named',
      name: PKG_CAMELCASE_NAME,
      globals: {
        vue: 'Vue',
      },
      sourcemap: minify,
      banner,
    },
    {
      format: 'esm',
      file: path.resolve(
        epOutput,
        'dist',
        formatBundleFilename('index.full', minify, 'mjs'),
      ),
      inlineDynamicImports: true,
      sourcemap: minify,
      banner,
    },
  ])
}

async function buildFullLocale(minify: boolean) {
  const files = await glob(`**/*.ts`, {
    cwd: path.resolve(localeRoot, 'lang'),
    absolute: true,
  })
  return Promise.all(
    files.map(async (file) => {
      const filename = path.basename(file, '.ts')
      const name = upperFirst(camelCase(filename))

      const bundle = await rollup({
        input: file,
        onwarn(warning, warn) {
          if (ignoreRollupWarning(warning)) return
          warn(warning)
        },
        plugins: [
          esbuild({
            minify,
            sourceMap: minify,
            target,
            tsconfig,
          }),
        ],
      })
      await writeBundles(bundle, [
        {
          format: 'umd',
          file: path.resolve(
            epOutput,
            'dist/locale',
            formatBundleFilename(filename, minify, 'js'),
          ),
          exports: 'default',
          name: `${PKG_CAMELCASE_LOCAL_NAME}${name}`,
          sourcemap: minify,
          banner,
        },
        {
          format: 'esm',
          file: path.resolve(
            epOutput,
            'dist/locale',
            formatBundleFilename(filename, minify, 'mjs'),
          ),
          sourcemap: minify,
          banner,
        },
      ])
    }),
  )
}

export const buildFull = (minify: boolean) => async () =>
  Promise.all([buildFullEntry(minify), buildFullLocale(minify)])

export const buildFullBundle = parallel(
  withTaskName('buildFullMinified', buildFull(true)),
  withTaskName('buildFull', buildFull(false)),
)
