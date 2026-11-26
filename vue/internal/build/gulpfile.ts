import path from 'path'
import { copyFile, mkdir, readFile, stat, writeFile } from 'fs/promises'
import { copy } from 'fs-extra'
import { parallel, series } from 'gulp'
import {
  buildOutput,
  epOutput,
  epPackage,
  projRoot,
} from '@element-plus/build-utils'
import {
  rewriteBuildStageWorkerReferences,
  rewriteBundledWorkspaceReferences,
} from '../../../scripts/lib/package-artifact-rewriter.mjs'
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

const assertArtifactReady = async (target: string, producerTask: string) => {
  try {
    await stat(target)
  } catch (error) {
    throw new Error(
      `Expected build artifact "${target}" was not produced by upstream task "${producerTask}".`,
      { cause: error },
    )
  }
}

const copyElementPlusPackageManifest = async () => {
  const packageJson = JSON.parse(await readFile(epPackage, 'utf8'))
  delete packageJson.dependencies?.['@element-plus/motion']
  delete packageJson.dependencies?.['@element-plus/icons-vue']

  await writeFile(
    path.join(epOutput, 'package.json'),
    `${JSON.stringify(packageJson, null, 2)}\n`,
  )
}

export const rewriteBuiltBundledWorkspaceDependencyReferences = async () => {
  rewriteBundledWorkspaceReferences(epOutput, {
    packageName: 'element-plus',
    dependencyNames: ['@element-plus/motion'],
    strict: false,
  })
  rewriteBuildStageWorkerReferences(epOutput)
}

export const copyFiles = () =>
  Promise.all([
    copyElementPlusPackageManifest(),
    copyFile(
      path.resolve(projRoot, 'README.md'),
      path.resolve(epOutput, 'README.md'),
    ),
    copyFile(
      path.resolve(projRoot, 'vue/global.d.ts'),
      path.resolve(epOutput, 'global.d.ts'),
    ),
  ])

export const copyTypesDefinitions: TaskFunction = (done) => {
  const src = path.resolve(buildOutput, 'types', 'packages')
  const copyTypes = (module: Module) =>
    withTaskName(`copyTypes:${module}`, async () => {
      await assertArtifactReady(src, 'generateTypesDefinitions')
      await copy(src, buildConfig[module].output.path)
    })

  return parallel(copyTypes('esm'), copyTypes('cjs'))(done)
}

export const copyFullStyle = async () => {
  const fullStyleSource = path.resolve(epOutput, 'theme-chalk/index.css')
  const fsusStyleSource = path.resolve(epOutput, 'theme-chalk/el-fsus.css')
  const criticalStyleSource = path.resolve(
    epOutput,
    'theme-chalk/el-public-shell-critical.css',
  )
  const fsusThemeSource = path.resolve(
    epOutput,
    'theme-chalk/el-fsus-theme.css',
  )

  await Promise.all([
    assertArtifactReady(fullStyleSource, 'buildThemeChalk'),
    assertArtifactReady(fsusStyleSource, 'buildThemeChalk'),
    assertArtifactReady(criticalStyleSource, 'buildThemeChalk'),
    assertArtifactReady(fsusThemeSource, 'buildThemeChalk'),
  ])
  await mkdir(path.resolve(epOutput, 'dist'), { recursive: true })
  await copyFile(fullStyleSource, path.resolve(epOutput, 'dist/index.css'))
  await copyFile(fsusStyleSource, path.resolve(epOutput, 'dist/fsus.css'))
  await copyFile(
    criticalStyleSource,
    path.resolve(epOutput, 'dist/public-shell-critical.css'),
  )
  await copyFile(
    fsusThemeSource,
    path.resolve(epOutput, 'dist/el-fsus-theme.css'),
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
      source: path.resolve(projRoot, 'vue/packages/wasm/ep_wasm.mjs'),
      targets: [
        path.resolve(epOutput, 'es/wasm/ep_wasm.mjs'),
        path.resolve(epOutput, 'lib/wasm/ep_wasm.mjs'),
      ],
    },
    {
      source: path.resolve(projRoot, 'vue/packages/wasm/dist/ep_wasm.mjs'),
      targets: [
        path.resolve(epOutput, 'dist/ep_wasm.mjs'),
        path.resolve(epOutput, 'es/wasm/dist/ep_wasm.mjs'),
        path.resolve(epOutput, 'lib/wasm/dist/ep_wasm.mjs'),
      ],
    },
    {
      source: path.resolve(projRoot, 'vue/packages/wasm/dist/ep_wasm.wasm'),
      targets: [
        path.resolve(epOutput, 'dist/ep_wasm.wasm'),
        path.resolve(epOutput, 'es/wasm/dist/ep_wasm.wasm'),
        path.resolve(epOutput, 'lib/wasm/dist/ep_wasm.wasm'),
      ],
    },
    ...markdownArtifacts.map((artifact) => ({
      source: path.resolve(projRoot, 'vue/packages/wasm/dist', artifact),
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

const buildPackage: TaskFunction = series(
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
        run('pnpm run -C vue/packages/theme-chalk build'),
      ),
      copyFullStyle,
    ),
    withTaskName('buildFullBundle', buildFullBundle),
    parallel(copyTypesDefinitions, copyFiles, copyWasmRuntimeAssets),
    withTaskName(
      'rewriteBuiltBundledWorkspaceDependencyReferences',
      rewriteBuiltBundledWorkspaceDependencyReferences,
    ),
  ),
)

export default buildPackage

export * from './src'
