import path from 'path'
import { lstat, mkdir, readFile, rm, writeFile } from 'fs/promises'
import { spawn } from 'node:child_process'
import consola from 'consola'
import glob from 'fast-glob'
import chalk from 'chalk'
import { copy } from 'fs-extra'
import {
  buildOutput,
  epRoot,
  excludeFiles,
  pkgRoot,
  projRoot,
} from '@element-plus/build-utils'
import { pathRewriter } from '../utils'
import type { TaskFunction } from 'gulp'

const TSCONFIG_PATH = path.resolve(projRoot, 'vue/tsconfig.web.json')
const outDir = path.resolve(buildOutput, 'types')
const enumMemberDeclarationPaths = [
  'components/table-v2/src/constants.enum-members.d.ts',
  'components/tooltip-v2/src/common.enum-members.d.ts',
  'components/tree-v2/src/virtual-tree.enum-members.d.ts',
  'utils/vue/vnode.enum-members.d.ts',
] as const
const enumRuntimeSourceFiles = new Set(
  enumMemberDeclarationPaths.map((relativePath) =>
    path.resolve(pkgRoot, relativePath.replace(/\.d\.ts$/u, '.js')),
  ),
)
const iconsVueTypesEntry = path.resolve(
  projRoot,
  'vue/packages/icons-vue/dist/types/index.d.ts',
)
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

const writeWasmDeclarationOwner = async () => {
  const sourceDeclaration = await readFile(wasmTypesEntry, 'utf8')
  assertWasmDeclarationOwner(sourceDeclaration, 'WASM source declaration', {
    allowWorkspaceSpecifier: true,
  })

  const publishedDeclaration = pathRewriter(
    'esm',
    'wasm/index.d.ts',
  )(sourceDeclaration)
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

// Use Vue's declaration compiler for SFCs as well as TypeScript entry points.
// compileScript + a plain TypeScript emitter loses template slots and can emit
// invalid expanded Vue generics, duplicate emit parameters or no entry at all.
const runGenerateTypesDefinitions = async () => {
  const sourceFiles = await collectSourceFiles()
  const sourceFilePaths = new Set(sourceFiles)
  const enumMemberDeclarations = await Promise.all(
    enumMemberDeclarationPaths.map(async (relativePath) => {
      const declarationPath = path.resolve(pkgRoot, relativePath)
      const runtimePath = declarationPath.replace(/\.d\.ts$/u, '.js')
      const [declarationStat, runtimeStat, declaration, runtime] =
        await Promise.all([
          lstat(declarationPath),
          lstat(runtimePath),
          readFile(declarationPath, 'utf8'),
          readFile(runtimePath, 'utf8'),
        ])
      if (
        !sourceFilePaths.has(declarationPath) ||
        !declarationStat.isFile() ||
        !runtimeStat.isFile() ||
        !declaration.trim() ||
        !runtime.trim()
      ) {
        throw new Error(
          `Enum source pair must contain regular, nonempty files: ${relativePath}`,
        )
      }
      return { relativePath, declaration }
    }),
  )

  await rm(outDir, { recursive: true, force: true })
  await mkdir(outDir, { recursive: true })
  const rawOutput = path.join(outDir, '.vue-tsc')
  const generatedConfig = path.join(outDir, 'tsconfig.declarations.json')
  await writeFile(
    generatedConfig,
    JSON.stringify(
      {
        extends: TSCONFIG_PATH,
        compilerOptions: {
          declaration: true,
          emitDeclarationOnly: true,
          noEmit: false,
          noEmitOnError: true,
          declarationMap: false,
          rootDir: path.join(projRoot, 'vue'),
          outDir: rawOutput,
          paths: {
            '@element-plus/icons-vue': [iconsVueTypesEntry],
            '@element-plus/icons-vue/*': [
              path.resolve(projRoot, 'vue/packages/icons-vue/dist/types/*'),
            ],
            '@element-plus/*': [path.resolve(pkgRoot, '*')],
          },
          preserveSymlinks: false,
        },
        files: sourceFiles,
        include: [],
      },
      null,
      2,
    ),
  )
  const vueTsc = path.join(
    projRoot,
    'scripts/generate-package-declarations.mjs',
  )
  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [vueTsc, '--project', generatedConfig],
      {
        cwd: projRoot,
        stdio: 'inherit',
      },
    )
    child.once('error', reject)
    child.once('exit', (code, signal) => {
      if (code === 0) resolve()
      else
        reject(
          new Error(`Vue declaration generation failed (${signal ?? code}).`),
        )
    })
  })

  const declarations = await glob('packages/**/*.d.ts', {
    cwd: rawOutput,
    onlyFiles: true,
  })
  if (declarations.length === 0) {
    throw new Error('No declaration files were emitted.')
  }
  for (const emittedPath of declarations.sort()) {
    let relativePath = emittedPath
    const publicDirectory = `${path.join('packages', 'element-plus')}${path.sep}`
    if (relativePath.startsWith(publicDirectory)) {
      relativePath = path.join(
        'packages',
        relativePath.slice(publicDirectory.length),
      )
    }
    const source = await readFile(path.join(rawOutput, emittedPath), 'utf8')
    const declaration =
      relativePath === path.join('packages', 'wasm.d.ts')
        ? wasmPublicDeclaration
        : source
    const target = path.join(outDir, relativePath)
    await mkdir(path.dirname(target), { recursive: true })
    await writeFile(
      target,
      pathRewriter('esm', path.relative('packages', relativePath))(declaration),
      'utf8',
    )
  }

  // TypeScript does not emit handwritten declaration inputs. Preserve each
  // JavaScript enum owner's original companion in both package formats.
  for (const { relativePath, declaration } of enumMemberDeclarations) {
    const target = path.join(outDir, 'packages', relativePath)
    await mkdir(path.dirname(target), { recursive: true })
    await writeFile(
      target,
      pathRewriter('esm', relativePath)(declaration),
      'utf8',
    )
  }
  await writeWasmDeclarationOwner()
  await copy(
    path.dirname(iconsVueTypesEntry),
    path.join(outDir, 'packages', 'icons-vue', 'src'),
  )
  consola.success(
    `Generated ${declarations.length} Vue/TypeScript declarations`,
  )
}

export const generateTypesDefinitions: TaskFunction = (done) => {
  runGenerateTypesDefinitions().then(() => done(), done)
}

async function collectSourceFiles() {
  // Keep the original owned package roots and add WASM's referenced type owners;
  // its canonical bundled public declaration is still copied above.
  const packageFiles = excludeFiles(
    await glob(
      [
        '**/*.{js?(x),ts?(x),vue}',
        '!element-plus/**/*',
        '!demo-app/**/*',
        '!icons-svg/**/*',
        '!icons-vue/**/*',
        '!theme-chalk/**/*',
      ],
      { cwd: pkgRoot, absolute: true, onlyFiles: true },
    ),
  ).filter((file) => !enumRuntimeSourceFiles.has(path.resolve(file)))
  const publicFiles = excludeFiles(
    await glob('**/*.{js?(x),ts?(x),vue}', {
      cwd: epRoot,
      absolute: true,
      onlyFiles: true,
    }),
  )
  return [
    path.resolve(projRoot, 'vue/typings/env.d.ts'),
    path.resolve(projRoot, 'vue/typings/vite-worker.d.ts'),
    ...packageFiles,
    ...publicFiles,
  ].sort()
}
