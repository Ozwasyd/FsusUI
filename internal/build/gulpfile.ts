import path from 'path'
import { copyFile, mkdir, stat } from 'fs/promises'
import { setTimeout as sleep } from 'timers/promises'
import { copy } from 'fs-extra'
import { parallel, series } from 'gulp'
import {
  buildOutput,
  epOutput,
  epPackage,
  projRoot,
} from '@element-plus/build-utils'
import {
  buildConfig,
  buildFullBundle,
  buildHelper,
  buildModules,
  generateTypesDefinitions,
  run,
  withTaskName,
} from './src'
import type { TaskFunction } from 'gulp'
import type { Module } from './src'

const waitForPath = async (target: string) => {
  let lastError: unknown
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      await stat(target)
      return
    } catch (error) {
      lastError = error
      await sleep(50)
    }
  }

  throw lastError
}

export const copyFiles = () =>
  Promise.all([
    copyFile(epPackage, path.join(epOutput, 'package.json')),
    copyFile(
      path.resolve(projRoot, 'README.md'),
      path.resolve(epOutput, 'README.md'),
    ),
    copyFile(
      path.resolve(projRoot, 'global.d.ts'),
      path.resolve(epOutput, 'global.d.ts'),
    ),
  ])

export const copyTypesDefinitions: TaskFunction = (done) => {
  const src = path.resolve(buildOutput, 'types', 'packages')
  const copyTypes = (module: Module) =>
    withTaskName(`copyTypes:${module}`, () =>
      waitForPath(src).then(() => copy(src, buildConfig[module].output.path)),
    )

  return parallel(copyTypes('esm'), copyTypes('cjs'))(done)
}

export const copyFullStyle = async () => {
  const fullStyleSource = path.resolve(epOutput, 'theme-chalk/index.css')
  const criticalStyleSource = path.resolve(
    epOutput,
    'theme-chalk/el-public-shell-critical.css',
  )

  await Promise.all([
    waitForPath(fullStyleSource),
    waitForPath(criticalStyleSource),
  ])
  await mkdir(path.resolve(epOutput, 'dist'), { recursive: true })
  await copyFile(
    fullStyleSource,
    path.resolve(epOutput, 'dist/index.css'),
  )
  await copyFile(
    criticalStyleSource,
    path.resolve(epOutput, 'dist/public-shell-critical.css'),
  )
}

export const copyWasmRuntimeAssets = async () => {
  const markdownArtifacts = [
    'markdown_basic.js',
    'markdown_basic.wasm',
    'markdown_simd.js',
    'markdown_simd.wasm',
  ]
  const assets = [
    {
      source: path.resolve(projRoot, 'packages/wasm/ep_wasm.mjs'),
      targets: [
        path.resolve(epOutput, 'es/wasm/ep_wasm.mjs'),
        path.resolve(epOutput, 'lib/wasm/ep_wasm.mjs'),
      ],
    },
    {
      source: path.resolve(projRoot, 'packages/wasm/dist/ep_wasm.mjs'),
      targets: [
        path.resolve(epOutput, 'dist/ep_wasm.mjs'),
        path.resolve(epOutput, 'es/wasm/dist/ep_wasm.mjs'),
        path.resolve(epOutput, 'lib/wasm/dist/ep_wasm.mjs'),
      ],
    },
    {
      source: path.resolve(projRoot, 'packages/wasm/dist/ep_wasm.wasm'),
      targets: [
        path.resolve(epOutput, 'dist/ep_wasm.wasm'),
        path.resolve(epOutput, 'es/wasm/dist/ep_wasm.wasm'),
        path.resolve(epOutput, 'lib/wasm/dist/ep_wasm.wasm'),
      ],
    },
    ...markdownArtifacts.map((artifact) => ({
      source: path.resolve(projRoot, 'packages/wasm/dist', artifact),
      targets: [
        path.resolve(epOutput, 'dist', artifact),
        path.resolve(epOutput, 'es/wasm/dist', artifact),
        path.resolve(epOutput, 'lib/wasm/dist', artifact),
      ],
    })),
  ]

  await Promise.all(
    assets.flatMap(({ source, targets }) =>
      targets.map(async (target) => {
        await mkdir(path.dirname(target), { recursive: true })
        await copyFile(source, target)
      }),
    ),
  )
}

export default series(
  withTaskName('cleanPackageBuild', () => run('pnpm run clean:package-build')),
  withTaskName('createOutput', () => mkdir(epOutput, { recursive: true })),

  parallel(
    withTaskName('ensureWasmArtifacts', () => run('pnpm run ensure:wasm')),
    withTaskName('ensureIconsVueArtifacts', () => run('pnpm run ensure:icons')),
  ),

  series(
    withTaskName('buildHelper', buildHelper),
    withTaskName('buildModules', buildModules),
    withTaskName('generateTypesDefinitions', generateTypesDefinitions),
    series(
      withTaskName('buildThemeChalk', () =>
        run('pnpm run -C packages/theme-chalk build'),
      ),
      copyFullStyle,
    ),
    withTaskName('buildFullBundle', buildFullBundle),
  ),

  parallel(copyTypesDefinitions, copyFiles, copyWasmRuntimeAssets),
)

export * from './src'
