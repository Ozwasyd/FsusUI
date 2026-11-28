import {
  existsSync,
  readdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'

export const PACKAGE_CODE_EXTENSIONS = [
  '.d.ts',
  '.d.mts',
  '.d.cts',
  '.js',
  '.mjs',
  '.cjs',
]

export const BUNDLED_WORKSPACE_RUNTIME_ENTRIES = new Map([
  [
    '@fsusui/core',
    { es: 'dist/core.mjs', lib: 'dist/core.mjs', types: 'dist/core' },
  ],
  [
    '@fsusui/icons',
    { es: 'dist/icons.mjs', lib: 'dist/icons.mjs', types: 'dist/icons' },
  ],
  [
    '@fsusui/motion',
    { es: 'dist/motion.mjs', lib: 'dist/motion.mjs', types: 'dist/motion' },
  ],
  [
    '@fsusui/components',
    { es: 'dist/index.mjs', lib: 'dist/index.mjs', types: 'dist/index' },
  ],
  [
    '@fsusui/markdown',
    { es: 'dist/markdown.mjs', lib: 'dist/markdown.mjs', types: 'dist/markdown' },
  ],
  [
    '@fsusui/theme',
    { es: 'dist/theme.mjs', lib: 'dist/theme.mjs', types: 'dist/theme' },
  ],
  [
    '@fsusui/wasm',
    { es: 'dist/wasm.mjs', lib: 'dist/wasm.mjs', types: 'dist/wasm' },
  ],
])

export const BUNDLED_WORKSPACE_DEPENDENCY_NAMES = new Set(
  BUNDLED_WORKSPACE_RUNTIME_ENTRIES.keys(),
)

export const WORKER_NAMES = [
  'data-pipeline',
  'markdown-renderer',
  'markdown-parser',
]

export const VITE_WORKER_RUNTIME_PATHS = new Map([
  ['data-pipeline.worker', 'es/components/_internal/data-pipeline.worker.mjs'],
  [
    'markdown-renderer.worker',
    'es/components/markdown-renderer/src/markdown-renderer.worker.mjs',
  ],
  [
    'markdown-parser.worker',
    'es/components/markdown-renderer/src/markdown-parser.worker.mjs',
  ],
])

const BUNDLED_FULL_DIST_WORKER_PATHS = {
  'data-pipeline': {
    esm: 'es/components/_internal/data-pipeline.worker.mjs',
    cjs: 'lib/components/_internal/data-pipeline.worker.js',
  },
  'markdown-renderer': {
    esm: 'es/components/markdown-renderer/src/markdown-renderer.worker.mjs',
    cjs: 'lib/components/markdown-renderer/src/markdown-renderer.worker.js',
  },
}

export function toModuleSpecifier(relativePath) {
  const normalized = relativePath.split(path.sep).join('/')
  return normalized.startsWith('.') ? normalized : `./${normalized}`
}

export function isDeclarationFile(filePath) {
  return (
    filePath.endsWith('.d.ts') ||
    filePath.endsWith('.d.mts') ||
    filePath.endsWith('.d.cts')
  )
}

export function isPackageCodeFile(filePath) {
  return PACKAGE_CODE_EXTENSIONS.some((ext) => filePath.endsWith(ext))
}

export function collectDirectoryFiles(rootDir, currentDir = rootDir) {
  const files = []
  const entries = readdirSync(currentDir, { withFileTypes: true })
  for (const entry of entries) {
    const absolutePath = path.join(currentDir, entry.name)
    if (entry.isDirectory()) {
      files.push(...collectDirectoryFiles(rootDir, absolutePath))
    } else {
      files.push(absolutePath)
    }
  }
  return files
}

export function collectPackageCodeFiles(rootDir) {
  return collectDirectoryFiles(rootDir).filter(isPackageCodeFile)
}

export function resolveBundledWorkspaceRuntimeSpecifier(
  rootDir,
  filePath,
  packageName,
  dependencyName,
  { strict = true } = {},
) {
  const entries = BUNDLED_WORKSPACE_RUNTIME_ENTRIES.get(dependencyName)
  if (!entries) {
    if (strict) {
      throw new Error(
        `No bundled runtime entry mapping for workspace dependency "${dependencyName}".`,
      )
    }
    return undefined
  }

  if (isDeclarationFile(filePath)) {
    return `${packageName}/${entries.types}`
  }

  const relativePath = path
    .relative(rootDir, filePath)
    .split(path.sep)
    .join('/')
  const extension = path.extname(filePath)

  if (relativePath.startsWith('es/') && extension === '.mjs') {
    return toModuleSpecifier(
      path.relative(path.dirname(filePath), path.join(rootDir, entries.es)),
    )
  }

  if (
    relativePath.startsWith('lib/') &&
    (extension === '.js' || extension === '.cjs')
  ) {
    return toModuleSpecifier(
      path.relative(path.dirname(filePath), path.join(rootDir, entries.lib)),
    )
  }

  if (strict) {
    throw new Error(
      `Unable to rewrite bundled workspace dependency reference in ${relativePath}.`,
    )
  }
  return undefined
}

export function rewriteBundledWorkspaceReferences(
  rootDir,
  {
    packageName = 'element-plus',
    dependencyNames = BUNDLED_WORKSPACE_DEPENDENCY_NAMES,
    strict = true,
  } = {},
) {
  const candidates = collectPackageCodeFiles(rootDir)
  let updatedFiles = 0
  let replacementCount = 0

  for (const filePath of candidates) {
    if (!existsSync(filePath)) continue
    const original = readFileSync(filePath, 'utf8')
    let rewritten = original

    for (const dependencyName of dependencyNames) {
      if (!rewritten.includes(dependencyName)) continue
      const replacement = resolveBundledWorkspaceRuntimeSpecifier(
        rootDir,
        filePath,
        packageName,
        dependencyName,
        { strict },
      )
      if (!replacement) continue
      const pattern = new RegExp(
        `(['"])${dependencyName.replace('/', '\\/')}\\1`,
        'g',
      )
      rewritten = rewritten.replace(pattern, (_match, quote) => {
        replacementCount += 1
        return `${quote}${replacement}${quote}`
      })
    }

    if (rewritten !== original) {
      writeFileSync(filePath, rewritten)
      updatedFiles += 1
    }
  }

  return { updatedFiles, replacementCount }
}

export function rewriteBuildStageWorkerReferences(rootDir) {
  const candidates = collectPackageCodeFiles(rootDir)
  let updatedFiles = 0

  for (const filePath of candidates) {
    if (!existsSync(filePath)) continue
    const original = readFileSync(filePath, 'utf8')
    let rewritten = original
    const relativePath = path
      .relative(rootDir, filePath)
      .split(path.sep)
      .join('/')

    const isEsmModule = relativePath.startsWith('es/')
    const isCjsModule = relativePath.startsWith('lib/')
    if (isEsmModule || isCjsModule) {
      const extension = isEsmModule ? '.mjs' : '.js'
      for (const workerName of WORKER_NAMES) {
        rewritten = rewritten
          .replace(
            new RegExp(`(['"])(\\./)?${workerName}\\.worker\\.ts\\1`, 'gu'),
            (_match, quote) => `${quote}./${workerName}.worker${extension}${quote}`,
          )
          .replace(
            new RegExp(
              `(['"])components/.*?/${workerName}\\.worker\\.js\\1`,
              'gu',
            ),
            (_match, quote) => `${quote}./${workerName}.worker.js${quote}`,
          )
      }
    }

    const isEsmBundle =
      relativePath.startsWith('dist/') && filePath.endsWith('.mjs')
    const isCjsBundle =
      relativePath.startsWith('dist/') &&
      (filePath.endsWith('.js') || filePath.endsWith('.cjs'))
    if (isEsmBundle || isCjsBundle) {
      const moduleKind = isEsmBundle ? 'esm' : 'cjs'
      for (const [workerKey, targets] of Object.entries(
        BUNDLED_FULL_DIST_WORKER_PATHS,
      )) {
        const targetRel = targets[moduleKind]
        rewritten = rewritten.replace(
          new RegExp(`(['"])\\./${workerKey}\\.worker\\.ts\\1`, 'gu'),
          (_match, quote) =>
            `${quote}${toModuleSpecifier(
              path.relative(
                path.dirname(filePath),
                path.join(rootDir, targetRel),
              ),
            )}${quote}`,
        )
      }
    } else {
      rewritten = rewritten.replace(
        /(['"])([^'"]*\.worker\.ts)\1/gu,
        (_match, quote, specifier) => {
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

    if (rewritten !== original) {
      writeFileSync(filePath, rewritten)
      updatedFiles += 1
    }
  }

  return updatedFiles
}

export function rewritePublishStageWorkerReferences(rootDir) {
  const candidates = collectDirectoryFiles(rootDir).filter((filePath) =>
    ['.js', '.mjs', '.cjs'].includes(path.extname(filePath)),
  )
  const workerReferencePattern =
    /(['"])(?:[^'"]*\/)?(data-pipeline\.worker|markdown-renderer\.worker|markdown-parser\.worker)\.(?:ts|js|mjs)\1/g
  let rewritten = 0

  for (const filePath of candidates) {
    const original = readFileSync(filePath, 'utf8')
    const next = original.replace(
      workerReferencePattern,
      (match, quote, workerName) => {
        const targetPath = VITE_WORKER_RUNTIME_PATHS.get(workerName)
        if (!targetPath) return match
        const relativePath = path
          .relative(path.dirname(filePath), path.join(rootDir, targetPath))
          .split(path.sep)
          .join('/')
        rewritten += 1
        return `${quote}${toModuleSpecifier(relativePath)}${quote}`
      },
    )
    if (next !== original) {
      writeFileSync(filePath, next)
    }
  }

  return rewritten
}

export function rewritePublishedSelfReferences(rootDir, packageName) {
  const candidates = collectPackageCodeFiles(rootDir)
  const patterns = [
    /(\bfrom\s+['"])element-plus(?=(?:\/[^'"]*)?['"])/g,
    /(\bimport\s*\(\s*['"])element-plus(?=(?:\/[^'"]*)?['"])/g,
    /(\brequire\s*\(\s*['"])element-plus(?=(?:\/[^'"]*)?['"])/g,
    /(\bimport\s+['"])element-plus(?=(?:\/[^'"]*)?['"])/g,
  ]

  let updatedFiles = 0
  let replacementCount = 0

  for (const filePath of candidates) {
    if (!existsSync(filePath)) continue
    const original = readFileSync(filePath, 'utf8')
    let rewritten = original

    for (const pattern of patterns) {
      rewritten = rewritten.replace(pattern, (_, prefix) => {
        replacementCount += 1
        return `${prefix}${packageName}`
      })
    }

    if (rewritten !== original) {
      writeFileSync(filePath, rewritten)
      updatedFiles += 1
    }
  }

  return { updatedFiles, replacementCount }
}

export function rewriteEmscriptenWasmFallbackReferences(rootDir) {
  const candidates = collectDirectoryFiles(rootDir).filter((filePath) =>
    ['.js', '.mjs', '.cjs'].includes(path.extname(filePath)),
  )
  const wasmFallbackPattern =
    /new URL\((['"])(ep_wasm|markdown_basic|markdown_simd)\.wasm\1,\s*import\.meta\.url\)/g
  let rewritten = 0

  for (const filePath of candidates) {
    const original = readFileSync(filePath, 'utf8')
    const next = original.replace(
      wasmFallbackPattern,
      'new URL(/* @vite-ignore */ $1$2.wasm$1, import.meta.url)',
    )
    if (next !== original) {
      writeFileSync(filePath, next)
      rewritten += 1
    }
  }

  return rewritten
}

export function stripSourceMappingUrlReferences(rootDir) {
  const candidates = collectDirectoryFiles(rootDir).filter((filePath) =>
    ['.css', '.js', '.mjs', '.cjs'].includes(path.extname(filePath)),
  )
  for (const filePath of candidates) {
    const original = readFileSync(filePath, 'utf8')
    const stripped = original
      .replace(/\n?\/\/# sourceMappingURL=.*$/gmu, '')
      .replace(/\n?\/\*# sourceMappingURL=.*?\*\/\s*$/gmu, '')
    if (stripped !== original) {
      writeFileSync(filePath, stripped)
    }
  }
}

export function pruneSourceMaps(rootDir) {
  const maps = collectDirectoryFiles(rootDir).filter((filePath) =>
    filePath.endsWith('.map'),
  )
  for (const filePath of maps) {
    unlinkSync(filePath)
  }
  return maps.length
}
