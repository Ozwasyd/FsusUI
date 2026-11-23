import path from 'path'
import { spawn } from 'child_process'
import { createRequire } from 'module'
import { mkdir, readFile, writeFile } from 'fs/promises'
import consola from 'consola'
import glob from 'fast-glob'
import chalk from 'chalk'
import {
  buildOutput,
  epRoot,
  excludeFiles,
  pkgRoot,
  projRoot,
} from '@element-plus/build-utils'
import { pathRewriter } from '../utils'
import type { TaskFunction } from 'gulp'
import type * as TsNamespace from 'typescript'

const loadVueTscEngine = () => {
  const rootRequire = createRequire(path.join(projRoot, 'package.json'))
  const ts = rootRequire('typescript') as typeof TsNamespace
  const vueTscRequire = createRequire(rootRequire.resolve('vue-tsc/package.json'))
  const vueCore = vueTscRequire('@vue/language-core') as {
    createParsedCommandLine: (
      tsModule: typeof TsNamespace,
      parseConfigHost: TsNamespace.ParseConfigHost,
      tsConfigPath: string,
    ) => {
      options: TsNamespace.CompilerOptions
      vueOptions: Record<string, unknown>
    }
    createVueLanguagePlugin: (
      tsModule: typeof TsNamespace,
      compilerOptions: TsNamespace.CompilerOptions,
      vueCompilerOptions: Record<string, unknown>,
      asFileName: (scriptId: string) => string,
    ) => unknown
  }
  const { proxyCreateProgram } = vueTscRequire(
    '@volar/typescript/lib/node/proxyCreateProgram',
  ) as {
    proxyCreateProgram: (
      tsModule: typeof TsNamespace,
      originalCreateProgram: typeof TsNamespace.createProgram,
      create: (
        tsModule: typeof TsNamespace,
        options: TsNamespace.CreateProgramOptions,
      ) => { languagePlugins: unknown[] },
    ) => typeof TsNamespace.createProgram
  }
  return { ts, vueCore, proxyCreateProgram }
}

const TSCONFIG_PATH = path.resolve(projRoot, 'vue/tsconfig.web.json')
const vueRoot = path.resolve(projRoot, 'vue')
const outDir = path.resolve(buildOutput, 'types')
const iconsVueTypesDir = path.resolve(
  projRoot,
  'vue/packages/icons-vue/dist/types',
)
const iconsVueTypesEntry = path.join(iconsVueTypesDir, 'index.d.ts')
const iconsVuePublicDeclaration = "export * from './icons-vue/index'\n"
const iconsVuePublishedTypesDir = path.join(outDir, 'packages', 'icons-vue')
const wasmTypesEntry = path.resolve(
  projRoot,
  'vue/packages/wasm/dist/index.d.ts',
)
const wasmPublicDeclaration = "export * from './wasm/index'\n"
const wasmPublishedTypesEntry = path.join(
  outDir,
  'packages',
  'wasm',
  'index.d.ts',
)
const wasmPublicTypeExports = [
  'MarkdownSafeHtml',
  'MarkdownSafeRenderResult',
] as const

const normalizeSlashes = (filePath: string) => filePath.replace(/\\/gu, '/')

const assertPortableDeclarationContent = (
  declaration: string,
  label: string,
  { allowWorkspaceSpecifier = false } = {},
) => {
  if (
    /from\s+['"](?:\/|[A-Za-z]:[\\/])/u.test(declaration) ||
    declaration.includes(projRoot) ||
    /(?:^|[\\/])(?:FsusUI|[^\\/]*worktree[^\\/]*)(?:[\\/]|$)/iu.test(
      declaration,
    )
  ) {
    throw new Error(`${label} must not contain repository-local paths.`)
  }

  if (!allowWorkspaceSpecifier && declaration.includes('@element-plus/')) {
    throw new Error(`${label} must not contain private workspace specifiers.`)
  }
}

const assertWasmDeclarationOwner = (
  declaration: string,
  label: string,
  { allowWorkspaceSpecifier = false } = {},
) => {
  const finalTypeExport = [
    ...declaration.matchAll(/export type\s*\{([^}]*)\}/gu),
  ].at(-1)?.[1]

  for (const typeName of wasmPublicTypeExports) {
    if (
      !finalTypeExport
        ?.split(',')
        .map((name) => name.trim())
        .includes(typeName)
    ) {
      throw new Error(
        `${label} must include ${typeName} in its final type export.`,
      )
    }
  }

  assertPortableDeclarationContent(declaration, label, {
    allowWorkspaceSpecifier,
  })
}

const writeWasmDeclarationOwner = async () => {
  const sourceDeclaration = await readFile(wasmTypesEntry, 'utf8')
  assertWasmDeclarationOwner(sourceDeclaration, 'WASM source declaration', {
    allowWorkspaceSpecifier: true,
  })

  const publishedDeclaration = pathRewriter('esm')(sourceDeclaration)
  assertWasmDeclarationOwner(publishedDeclaration, 'WASM published declaration')

  await mkdir(path.dirname(wasmPublishedTypesEntry), {
    recursive: true,
  })
  await writeFile(wasmPublishedTypesEntry, publishedDeclaration, 'utf8')
  consola.success(
    chalk.green(
      `Definition owner for file: ${chalk.bold(
        path.relative(outDir, wasmPublishedTypesEntry),
      )} generated`,
    ),
  )
}

const writeIconsVueDeclarationOwner = async () => {
  const declarationFiles = await glob('**/*.d.ts', {
    cwd: iconsVueTypesDir,
    onlyFiles: true,
  })
  if (
    !declarationFiles.includes('index.d.ts') ||
    !declarationFiles.includes('components/index.d.ts')
  ) {
    throw new Error(
      `icons-vue declaration owner is incomplete in ${iconsVueTypesDir}; run pnpm run ensure:icons first.`,
    )
  }

  let sawArrowDown = false
  await Promise.all(
    declarationFiles.map(async (relativeFile) => {
      const sourcePath = path.join(iconsVueTypesDir, relativeFile)
      const destinationPath = path.join(iconsVuePublishedTypesDir, relativeFile)
      const sourceDeclaration = await readFile(sourcePath, 'utf8')
      const publishedDeclaration = pathRewriter('esm')(sourceDeclaration)
      assertPortableDeclarationContent(
        publishedDeclaration,
        `icons-vue published declaration (${relativeFile})`,
      )
      if (
        relativeFile === 'components/index.d.ts' &&
        /\bArrowDown\b/u.test(publishedDeclaration)
      ) {
        sawArrowDown = true
      }
      await mkdir(path.dirname(destinationPath), { recursive: true })
      await writeFile(destinationPath, publishedDeclaration, 'utf8')
    }),
  )

  if (!sawArrowDown) {
    throw new Error(
      'icons-vue published components/index.d.ts must export ArrowDown.',
    )
  }

  consola.success(
    chalk.green(
      `Definition owner for ${chalk.bold(
        `packages/icons-vue (${declarationFiles.length} files)`,
      )} generated`,
    ),
  )
}

const expectedDeclarationRelativePath = (sourcePath: string) => {
  const relativeFromVue = path.relative(vueRoot, sourcePath)
  if (relativeFromVue.endsWith('.vue')) {
    return `${relativeFromVue}.d.ts`
  }
  return relativeFromVue.replace(/\.(?:[cm]?tsx?|[cm]?jsx?)$/u, '.d.ts')
}

const formatDiagnostics = (
  ts: typeof TsNamespace,
  diagnostics: readonly TsNamespace.Diagnostic[],
) =>
  ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCurrentDirectory: () => projRoot,
    getCanonicalFileName: (fileName) => fileName,
    getNewLine: () => '\n',
  })

const runGenerateTypesDefinitions = async () => {
  const { ts, vueCore, proxyCreateProgram } = loadVueTscEngine()
  const parsed = vueCore.createParsedCommandLine(
    ts,
    ts.sys,
    normalizeSlashes(TSCONFIG_PATH),
  )
  const compilerOptions: TsNamespace.CompilerOptions = {
    ...parsed.options,
    emitDeclarationOnly: true,
    declaration: true,
    noEmit: false,
    outDir,
    rootDir: vueRoot,
    baseUrl: undefined,
    paths: {
      '@element-plus/motion': [
        path.resolve(projRoot, 'vue/packages/motion/index.ts'),
      ],
      '@element-plus/motion/*': [
        path.resolve(projRoot, 'vue/packages/motion/*'),
      ],
      '@element-plus/*': [path.resolve(projRoot, 'vue/packages/*')],
      '@element-plus/icons-vue': [iconsVueTypesEntry],
      '@element-plus/icons-vue/*': [path.join(iconsVueTypesDir, '*')],
      '@element-plus/wasm': [wasmTypesEntry],
      '@element-plus/wasm/*': [
        path.resolve(projRoot, 'vue/packages/wasm/dist/*'),
      ],
    },
    // pnpm links workspace package peer deps through nested symlinks. Keeping the
    // symlink path here makes Vue's own d.ts re-exports unable to resolve
    // @vue/runtime-* packages during declaration generation.
    preserveSymlinks: false,
    skipLibCheck: true,
    noImplicitAny: false,
    noUncheckedSideEffectImports: false,
    allowArbitraryExtensions: true,
  }

  const globSourceFile = '**/*.{js?(x),ts?(x),vue}'
  const workspaceExternalPackages = [
    '!demo-app/**/*',
    '!icons-svg/**/*',
    '!icons-vue/**/*',
    '!theme-chalk/**/*',
    '!wasm/**/*',
  ]
  const filePaths = excludeFiles(
    await glob(
      [globSourceFile, '!element-plus/**/*', ...workspaceExternalPackages],
      {
        cwd: pkgRoot,
        absolute: true,
        onlyFiles: true,
      },
    ),
  )
  const epPaths = excludeFiles(
    await glob(globSourceFile, {
      cwd: epRoot,
      onlyFiles: true,
    }),
  )

  const virtualFiles = new Map<string, string>()
  const virtualRootFiles: string[] = []
  const expectedEmitPaths = new Set<string>()
  const vueEntryPaths: string[] = []
  const scriptRootPaths: string[] = [
    path.resolve(projRoot, 'vue/typings/env.d.ts'),
    path.resolve(projRoot, 'vue/typings/vite-worker.d.ts'),
  ]

  for (const file of filePaths) {
    if (file.endsWith('.vue')) {
      vueEntryPaths.push(file)
    } else {
      scriptRootPaths.push(file)
    }
    if (!file.endsWith('.d.ts')) {
      expectedEmitPaths.add(
        normalizeSlashes(expectedDeclarationRelativePath(file)),
      )
    }
  }

  await Promise.all(
    epPaths.map(async (relativeFile) => {
      const content = await readFile(path.resolve(epRoot, relativeFile), 'utf8')
      const virtualPath = path.resolve(pkgRoot, relativeFile)
      virtualFiles.set(normalizeSlashes(virtualPath), content)
      virtualRootFiles.push(virtualPath)
      if (!virtualPath.endsWith('.d.ts')) {
        expectedEmitPaths.add(
          normalizeSlashes(expectedDeclarationRelativePath(virtualPath)),
        )
      }
    }),
  )

  const virtualVueEntriesPath = path.resolve(
    vueRoot,
    '__virtual_vue_entries__.ts',
  )
  const virtualVueEntriesDtsRelative = normalizeSlashes(
    expectedDeclarationRelativePath(virtualVueEntriesPath),
  )
  const virtualVueEntriesContent = vueEntryPaths
    .sort()
    .map(
      (vueFile) =>
        `import type {} from './${normalizeSlashes(path.relative(vueRoot, vueFile))}'`,
    )
    .join('\n')
  virtualFiles.set(
    normalizeSlashes(virtualVueEntriesPath),
    `${virtualVueEntriesContent}\n`,
  )

  const rootNames = [
    ...scriptRootPaths,
    ...virtualRootFiles,
    virtualVueEntriesPath,
  ]

  const host = ts.createCompilerHost(compilerOptions, true)
  const origFileExists = host.fileExists.bind(host)
  const origReadFile = host.readFile.bind(host)
  const origGetSourceFile = host.getSourceFile.bind(host)

  host.fileExists = (fileName) =>
    virtualFiles.has(normalizeSlashes(fileName)) || origFileExists(fileName)
  host.readFile = (fileName) => {
    const virtual = virtualFiles.get(normalizeSlashes(fileName))
    return virtual !== undefined ? virtual : origReadFile(fileName)
  }
  host.getSourceFile = (
    fileName,
    languageVersionOrOptions,
    onError,
    shouldCreateNewSourceFile,
  ) => {
    const virtual = virtualFiles.get(normalizeSlashes(fileName))
    if (virtual !== undefined) {
      return ts.createSourceFile(fileName, virtual, languageVersionOrOptions)
    }
    return origGetSourceFile(
      fileName,
      languageVersionOrOptions,
      onError,
      shouldCreateNewSourceFile,
    )
  }

  const emittedFiles = new Map<string, string>()
  host.writeFile = (fileName, text) => {
    const relativePath = normalizeSlashes(path.relative(outDir, fileName))
    if (relativePath === virtualVueEntriesDtsRelative) return
    emittedFiles.set(fileName, text)
  }

  const createProgram = proxyCreateProgram(
    ts,
    ts.createProgram,
    (tsModule, options) => ({
      languagePlugins: [
        vueCore.createVueLanguagePlugin(
          tsModule,
          options.options,
          parsed.vueOptions,
          (id) => id,
        ),
      ],
    }),
  )

  const program = createProgram({
    rootNames,
    options: compilerOptions,
    host,
  })
  consola.success('Added source files')

  const preEmitDiagnostics = ts.getPreEmitDiagnostics(program)
  if (preEmitDiagnostics.length > 0) {
    throw new Error(formatDiagnostics(ts, preEmitDiagnostics))
  }
  consola.success('Type check passed!')

  const emitResult = program.emit(undefined, undefined, undefined, true)
  if (emitResult.diagnostics.length > 0) {
    throw new Error(formatDiagnostics(ts, emitResult.diagnostics))
  }

  const emittedRelativePaths = new Set(
    [...emittedFiles.keys()].map((filePath) =>
      normalizeSlashes(path.relative(outDir, filePath)),
    ),
  )
  const missingDeclarations = [...expectedEmitPaths]
    .filter((expected) => !emittedRelativePaths.has(expected))
    .sort()
  if (missingDeclarations.length > 0) {
    throw new Error(
      `Declaration emit omitted ${missingDeclarations.length} expected .d.ts file(s):\n${missingDeclarations.join('\n')}`,
    )
  }

  if (emittedFiles.size === 0) {
    throw new Error('No declaration files were emitted.')
  }

  const tasks = [...emittedFiles.entries()].map(async ([filepath, text]) => {
    const relativePath = path.relative(outDir, filepath)
    const declaration =
      relativePath === path.join('packages', 'wasm.d.ts')
        ? wasmPublicDeclaration
        : relativePath === path.join('packages', 'icons-vue.d.ts')
          ? iconsVuePublicDeclaration
          : text

    consola.trace(
      chalk.yellow(
        `Generating definition for file: ${chalk.bold(relativePath)}`,
      ),
    )

    await mkdir(path.dirname(filepath), {
      recursive: true,
    })

    await writeFile(filepath, pathRewriter('esm')(declaration), 'utf8')
  })

  await Promise.all(tasks)
  consola.success(
    chalk.green(`Generated ${chalk.bold(String(emittedFiles.size))} .d.ts files`),
  )

  await writeWasmDeclarationOwner()
  await writeIconsVueDeclarationOwner()
}

const runGenerateTypesDefinitionsInSubprocess = () =>
  new Promise<void>((resolvePromise, rejectPromise) => {
    const withHeapScript = path.resolve(projRoot, 'scripts/with-node-heap.mjs')
    const tsxCjs = path.resolve(projRoot, 'node_modules/tsx/dist/cjs/index.cjs')
    const selfScript = path.resolve(
      projRoot,
      'vue/internal/build/src/tasks/types-definitions.ts',
    )
    const child = spawn(
      process.execPath,
      [withHeapScript, process.execPath, '--require', tsxCjs, selfScript],
      {
        cwd: projRoot,
        stdio: 'inherit',
        env: {
          ...process.env,
          FSUS_DTS_SUBPROCESS: '1',
          FSUS_NODE_HEAP_PROFILE: 'typecheck',
          NODE_OPTIONS: '',
        },
      },
    )
    child.on('error', rejectPromise)
    child.on('exit', (code, signal) => {
      if (code === 0) {
        resolvePromise()
        return
      }
      rejectPromise(
        new Error(
          signal
            ? `generateTypesDefinitions subprocess exited with signal ${signal}`
            : `generateTypesDefinitions subprocess exited with code ${code ?? 1}`,
        ),
      )
    })
  })

export const generateTypesDefinitions: TaskFunction = (done) => {
  const runner =
    process.env.FSUS_DTS_SUBPROCESS === '1'
      ? runGenerateTypesDefinitions()
      : runGenerateTypesDefinitionsInSubprocess()
  runner.then(() => done(), done)
}

if (process.env.FSUS_DTS_SUBPROCESS === '1') {
  runGenerateTypesDefinitions().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
