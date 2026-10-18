import path from 'path'
import { nodeResolve } from '@rollup/plugin-node-resolve'
import { rollup } from 'rollup'
import commonjs from '@rollup/plugin-commonjs'
import vue from '@vitejs/plugin-vue'
import { createVueMacros } from '../utils/vue-macros'
import vueJsx from '@vitejs/plugin-vue-jsx'
import esbuild, { minify as minifyPlugin } from 'rollup-plugin-esbuild'
import { series } from 'gulp'
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
import { MarkdownHeavyFeatureFrameUrl } from '../plugins/markdown-heavy-feature-frame'
import {
  formatBundleFilename,
  generateExternal,
  shouldIgnoreRollupWarning,
  run,
  withTaskName,
  writeBundles,
} from '../utils'
import { target } from '../build-info'
import { runFullBuildTasks } from '../utils/full-build-tasks'
import type { TaskFunction } from 'gulp'
import type { Plugin } from 'rollup'

const banner = `/*! ${PKG_BRAND_NAME} v${version} */\n`
const tsconfig = path.resolve(projRoot, 'vue/tsconfig.web.json')

async function buildFullEntry(minify: boolean) {
  const externalPackage = await generateExternal({ full: true })
  const wasmSourceEntry = path.resolve(pkgRoot, 'wasm/index.ts')
  const external = (id: string) =>
    externalPackage(id) ||
    id === './ep_wasm.mjs' ||
    id.endsWith('/packages/wasm/ep_wasm.mjs') ||
    id.endsWith('/packages/wasm/dist/ep_wasm.mjs')
  const vueMacrosPlugins = await createVueMacros({
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
    MarkdownHeavyFeatureFrameUrl({
      assetFileName: 'markdown-heavy-feature-frame.mjs',
    }),
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
      if (shouldIgnoreRollupWarning(warning)) return
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

async function buildFullLocale(file: string, minify: boolean) {
  const filename = path.basename(file, '.ts')
  const name = upperFirst(camelCase(filename))

  const bundle = await rollup({
    input: file,
    onwarn(warning, warn) {
      if (shouldIgnoreRollupWarning(warning)) return
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
}

export const buildFull =
  (minify: boolean): TaskFunction =>
  async () => {
    const files = await glob(`**/*.ts`, {
      cwd: path.resolve(localeRoot, 'lang'),
      absolute: true,
    })
    await runFullBuildTasks(
      () => buildFullEntry(minify),
      files,
      (file) => buildFullLocale(file, minify),
    )
  }

export const buildFullUnminified: TaskFunction = buildFull(false)
export const buildFullMinified: TaskFunction = buildFull(true)

export const buildFullBundle: TaskFunction = series(
  withTaskName('buildFull', () =>
    run('pnpm run -C vue/internal/build start buildFullUnminified'),
  ),
  withTaskName('buildFullMinified', () =>
    run('pnpm run -C vue/internal/build start buildFullMinified'),
  ),
)
