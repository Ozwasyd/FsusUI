import path from 'path'
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

      if (changed) {
        await writeFile(filePath, rewritten)
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
)

export default buildPackage

export * from './src'
