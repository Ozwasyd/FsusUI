import path from 'path'
import { existsSync } from 'node:fs'
import {
  copyFile,
  mkdir,
  readFile,
  readdir,
  stat,
  writeFile,
} from 'fs/promises'
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
  writeNodeDeclarationFormats,
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

const bundledWorkspaceDependencyNames = ['@element-plus/motion']
const packageReferenceExtensions = [
  '.d.ts',
  '.d.mts',
  '.d.cts',
  '.js',
  '.mjs',
  '.cjs',
]

const copyElementPlusPackageManifest = async () => {
  const packageJson = JSON.parse(await readFile(epPackage, 'utf8'))
  delete packageJson.dependencies?.['@element-plus/motion']
  delete packageJson.dependencies?.['@element-plus/icons-vue']

  await writeFile(
    path.join(epOutput, 'package.json'),
    `${JSON.stringify(packageJson, null, 2)}\n`,
  )
}

const toModuleSpecifier = (relativePath: string) => {
  const normalized = relativePath.split(path.sep).join('/')
  return normalized.startsWith('.') ? normalized : `./${normalized}`
}

const collectPackageReferenceCandidates = async (
  rootDir: string,
  currentDir = rootDir,
) => {
  const files: string[] = []
  const entries = await readdir(currentDir, { withFileTypes: true })

  for (const entry of entries) {
    const absolutePath = path.join(currentDir, entry.name)

    if (entry.isDirectory()) {
      files.push(
        ...(await collectPackageReferenceCandidates(rootDir, absolutePath)),
      )
      continue
    }

    if (
      packageReferenceExtensions.some((extension) =>
        absolutePath.endsWith(extension),
      )
    ) {
      files.push(absolutePath)
    }
  }

  return files
}

const resolveBundledWorkspaceRuntimeSpecifier = (
  rootDir: string,
  filePath: string,
) => {
  if (
    filePath.endsWith('.d.ts') ||
    filePath.endsWith('.d.mts') ||
    filePath.endsWith('.d.cts')
  ) {
    return 'element-plus/es/motion'
  }

  const relativePath = path
    .relative(rootDir, filePath)
    .split(path.sep)
    .join('/')
  const extension = path.extname(filePath)

  if (relativePath.startsWith('es/') && extension === '.mjs') {
    return toModuleSpecifier(
      path.relative(
        path.dirname(filePath),
        path.join(rootDir, 'es', 'motion', 'index.mjs'),
      ),
    )
  }

  if (
    relativePath.startsWith('lib/') &&
    (extension === '.js' || extension === '.cjs')
  ) {
    return toModuleSpecifier(
      path.relative(
        path.dirname(filePath),
        path.join(rootDir, 'lib', 'motion', 'index.js'),
      ),
    )
  }

  return undefined
}

export const rewriteBuiltBundledWorkspaceDependencyReferences = async () => {
  const candidates = await collectPackageReferenceCandidates(epOutput)
  const bundledWorkerRuntimePaths = {
    dataPipeline: {
      esm: 'es/components/_internal/data-pipeline.worker.mjs',
      cjs: 'lib/components/_internal/data-pipeline.worker.js',
    },
    markdownRenderer: {
      esm: 'es/components/markdown-renderer/src/markdown-renderer.worker.mjs',
      cjs: 'lib/components/markdown-renderer/src/markdown-renderer.worker.js',
    },
  }

  await Promise.all(
    candidates.map(async (filePath) => {
      let rewritten = await readFile(filePath, 'utf8')
      let changed = false

      for (const dependencyName of bundledWorkspaceDependencyNames) {
        if (!rewritten.includes(dependencyName)) continue

        const replacement = resolveBundledWorkspaceRuntimeSpecifier(
          epOutput,
          filePath,
        )
        if (!replacement) continue

        const pattern = new RegExp(
          `(['"])${dependencyName.replace('/', '\\/')}\\1`,
          'g',
        )
        rewritten = rewritten.replace(pattern, (_match, quote) => {
          changed = true
          return `${quote}${replacement}${quote}`
        })
      }

      const relativeOutputPath = path.relative(epOutput, filePath)
      const isEsmModule = relativeOutputPath.startsWith('es/')
      const isCjsModule = relativeOutputPath.startsWith('lib/')
      if (isEsmModule || isCjsModule) {
        const extension = isEsmModule ? '.mjs' : '.js'
        for (const workerName of [
          'markdown-parser',
          'markdown-renderer',
          'data-pipeline',
        ]) {
          const next = rewritten
            .replace(
              new RegExp(`(['"])(\\./)?${workerName}\\.worker\\.ts\\1`, 'gu'),
              (_match, quote: string) =>
                `${quote}./${workerName}.worker${extension}${quote}`,
            )
            .replace(
              new RegExp(
                `(['"])components/.*?/${workerName}\\.worker\\.js\\1`,
                'gu',
              ),
              (_match, quote: string) =>
                `${quote}./${workerName}.worker.js${quote}`,
            )
          if (next !== rewritten) {
            rewritten = next
            changed = true
          }
        }
      }

      const isEsmBundle =
        path.relative(epOutput, filePath).startsWith('dist') &&
        filePath.endsWith('.mjs')
      const isCjsBundle =
        path.relative(epOutput, filePath).startsWith('dist') &&
        (filePath.endsWith('.js') || filePath.endsWith('.cjs'))
      if (isEsmBundle || isCjsBundle) {
        const moduleKind = isEsmBundle ? 'esm' : 'cjs'
        const markdownWorker =
          bundledWorkerRuntimePaths.markdownRenderer[moduleKind]
        const dataPipelineWorker =
          bundledWorkerRuntimePaths.dataPipeline[moduleKind]
        rewritten = rewritten
          .replace(
            /(['"])\.\/markdown-renderer\.worker\.ts\1/gu,
            (_match, quote: string) =>
              `${quote}${toModuleSpecifier(
                path.relative(
                  path.dirname(filePath),
                  path.join(epOutput, markdownWorker),
                ),
              )}${quote}`,
          )
          .replace(
            /(['"])\.\/data-pipeline\.worker\.ts\1/gu,
            (_match, quote: string) =>
              `${quote}${toModuleSpecifier(
                path.relative(
                  path.dirname(filePath),
                  path.join(epOutput, dataPipelineWorker),
                ),
              )}${quote}`,
          )
      } else {
        const workerPattern = /(['"])([^'"]*\.worker\.ts)\1/gu
        rewritten = rewritten.replace(
          workerPattern,
          (_match, quote: string, specifier: string) => {
            const extension = filePath.endsWith('.mjs') ? '.mjs' : '.js'
            const runtimeSpecifier = specifier.replace(/\.ts$/u, extension)
            const runtimePath = path.resolve(
              path.dirname(filePath),
              runtimeSpecifier,
            )
            if (!existsSync(runtimePath)) return `${quote}${specifier}${quote}`
            return `${quote}${runtimeSpecifier}${quote}`
          },
        )
      }
      if (
        isEsmBundle ||
        isCjsBundle ||
        changed ||
        /[.]worker[.]ts(?:['"]|$)/u.test(rewritten)
      ) {
        const previous = await readFile(filePath, 'utf8')
        if (previous !== rewritten) await writeFile(filePath, rewritten)
      }
    }),
  )
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
    withTaskName(`copyTypes:${module}`, () =>
      waitForPath(src).then(() => copy(src, buildConfig[module].output.path)),
    )

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
    waitForPath(fullStyleSource),
    waitForPath(fsusStyleSource),
    waitForPath(criticalStyleSource),
    waitForPath(fsusThemeSource),
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
    withTaskName(
      'rewriteBuiltBundledWorkspaceDependencyReferences',
      rewriteBuiltBundledWorkspaceDependencyReferences,
    ),
  ),

  parallel(copyTypesDefinitions, copyFiles, copyWasmRuntimeAssets),
  withTaskName('writeNodeDeclarationFormats', () =>
    writeNodeDeclarationFormats(epOutput),
  ),
)

export default buildPackage

export * from './src'
