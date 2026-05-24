import path from 'path'
import { mkdir, readFile, writeFile } from 'fs/promises'
import consola from 'consola'
import * as vueCompiler from 'vue/compiler-sfc'
import glob from 'fast-glob'
import chalk from 'chalk'
import { Project } from 'ts-morph'
import {
  buildOutput,
  epRoot,
  excludeFiles,
  pkgRoot,
  projRoot,
} from '@element-plus/build-utils'
import { pathRewriter } from '../utils'
import type { TaskFunction } from 'gulp'
import type { CompilerOptions, SourceFile } from 'ts-morph'

const TSCONFIG_PATH = path.resolve(projRoot, 'tsconfig.web.json')
const outDir = path.resolve(buildOutput, 'types')
const iconsVueTypesEntry = path.resolve(
  projRoot,
  'packages/icons-vue/dist/index.d.ts',
)
const wasmTypesEntry = path.resolve(projRoot, 'packages/wasm/dist/index.d.ts')

/**
 * fork = require( https://github.com/egoist/vue-dts-gen/blob/main/src/index.ts
 */
const runGenerateTypesDefinitions = async () => {
  const compilerOptions: CompilerOptions = {
    emitDeclarationOnly: true,
    declaration: true,
    outDir,
    baseUrl: projRoot,
    paths: {
      '@element-plus/*': [path.resolve(projRoot, 'packages/*')],
      '@element-plus/icons-vue': [iconsVueTypesEntry],
      '@element-plus/icons-vue/*': [
        path.resolve(projRoot, 'packages/icons-vue/dist/*'),
      ],
      '@element-plus/wasm': [wasmTypesEntry],
      '@element-plus/wasm/*': [path.resolve(projRoot, 'packages/wasm/dist/*')],
    },
    preserveSymlinks: true,
    skipLibCheck: true,
    noImplicitAny: false,
  }
  const project = new Project({
    compilerOptions,
    tsConfigFilePath: TSCONFIG_PATH,
    skipAddingFilesFromTsConfig: true,
  })

  const sourceFiles = await addSourceFiles(project)
  consola.success('Added source files')

  typeCheck(project)
  consola.success('Type check passed!')

  const emitOutput = project.emitToMemory({
    emitOnlyDtsFiles: true,
  })
  const emitFiles = emitOutput.getFiles()
  if (emitFiles.length === 0) {
    consola.info(chalk.yellow('No declaration files were emitted.'))
    return
  }

  const tasks = emitFiles.map(async (outputFile) => {
    const filepath = outputFile.filePath
    const relativePath = path.relative(outDir, filepath)

    consola.trace(
      chalk.yellow(
        `Generating definition for file: ${chalk.bold(relativePath)}`,
      ),
    )

    await mkdir(path.dirname(filepath), {
      recursive: true,
    })

    await writeFile(filepath, pathRewriter('esm')(outputFile.text), 'utf8')

    consola.success(
      chalk.green(`Definition for file: ${chalk.bold(relativePath)} generated`),
    )
  })

  await Promise.all(tasks)
}

export const generateTypesDefinitions: TaskFunction = (done) => {
  runGenerateTypesDefinitions().then(() => done(), done)
}

async function addSourceFiles(project: Project) {
  project.addSourceFileAtPath(path.resolve(projRoot, 'typings/env.d.ts'))
  project.addSourceFileAtPath(
    path.resolve(projRoot, 'typings/vite-worker.d.ts'),
  )

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

  const sourceFiles: SourceFile[] = []
  await Promise.all([
    ...filePaths.map(async (file) => {
      if (file.endsWith('.vue')) {
        const content = await readFile(file, 'utf-8')
        const hasTsNoCheck = content.includes('@ts-nocheck')

        const sfc = vueCompiler.parse(content)
        const { script, scriptSetup } = sfc.descriptor
        if (script || scriptSetup) {
          let content =
            (hasTsNoCheck ? '// @ts-nocheck\n' : '') + (script?.content ?? '')

          if (scriptSetup) {
            const compiled = vueCompiler.compileScript(sfc.descriptor, {
              id: 'xxx',
            })
            content += compiled.content
          }

          const lang = scriptSetup?.lang || script?.lang || 'js'
          const sourceFile = project.createSourceFile(
            `${path.relative(process.cwd(), file)}.${lang}`,
            content,
          )
          sourceFiles.push(sourceFile)
        }
      } else {
        const sourceFile = project.addSourceFileAtPath(file)
        sourceFiles.push(sourceFile)
      }
    }),
    ...epPaths.map(async (file) => {
      const content = await readFile(path.resolve(epRoot, file), 'utf-8')
      sourceFiles.push(
        project.createSourceFile(path.resolve(pkgRoot, file), content),
      )
    }),
  ])

  return sourceFiles
}

function typeCheck(project: Project) {
  const diagnostics = project
    .getPreEmitDiagnostics()
    .filter((diagnostic) => diagnostic.getCode() !== 7056)
  if (diagnostics.length > 0) {
    throw new Error(project.formatDiagnosticsWithColorAndContext(diagnostics))
  }
}
