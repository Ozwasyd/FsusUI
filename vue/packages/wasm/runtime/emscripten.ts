export type EmscriptenModuleFactory<TModule> = (options?: {
  locateFile?: (path: string) => string
  print?: (message: string) => void
  printErr?: (message: string) => void
  wasmBinary?: Uint8Array
}) => Promise<TModule>

type ModuleNamespace<TModule> = {
  default?: EmscriptenModuleFactory<TModule>
  [key: string]: unknown
}

export async function loadEmscriptenModule<TModule>(
  moduleUrl: string,
  exportName: string,
  wasmUrl: string,
  options?: {
    print?: (message: string) => void
    printErr?: (message: string) => void
  },
): Promise<TModule | null> {
  const resolvedModuleUrl = await resolveRuntimeUrl(moduleUrl)
  const resolvedWasmUrl = await resolveRuntimeUrl(wasmUrl)
  const moduleRef = await importRuntimeModule<TModule>(resolvedModuleUrl)
  const factory = (moduleRef.default ?? moduleRef[exportName]) as
    | EmscriptenModuleFactory<TModule>
    | undefined
  if (typeof factory !== 'function') {
    return null
  }

  const nodeDirname = resolveNodeDirname(resolvedModuleUrl)
  const wasmBinary = readNodeWasmBinary(resolvedWasmUrl)
  const globals = globalThis as { __dirname?: string }
  const savedDirname = globals.__dirname
  if (nodeDirname) {
    globals.__dirname = nodeDirname
  }

  try {
    return await factory({
      locateFile: (path) => (path.endsWith('.wasm') ? resolvedWasmUrl : path),
      print: options?.print,
      printErr: options?.printErr,
      wasmBinary,
    })
  } finally {
    if (nodeDirname) {
      if (savedDirname === undefined) {
        delete globals.__dirname
      } else {
        globals.__dirname = savedDirname
      }
    }
  }
}

async function importRuntimeModule<TModule>(
  moduleUrl: string,
): Promise<ModuleNamespace<TModule>> {
  if (moduleUrl.startsWith('file://')) {
    try {
      const nativeImport = new Function(
        'specifier',
        'return import(specifier)',
      ) as (specifier: string) => Promise<unknown>
      return (await nativeImport(moduleUrl)) as ModuleNamespace<TModule>
    } catch (error) {
      if (!isMissingDynamicImportCallback(error)) {
        throw error
      }

      const moduleRef = requireNodeFileRuntimeModule(moduleUrl)
      if (moduleRef) {
        return moduleRef as ModuleNamespace<TModule>
      }

      throw error
    }
  }

  return (await import(
    /* @vite-ignore */ moduleUrl
  )) as ModuleNamespace<TModule>
}

function isMissingDynamicImportCallback(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.includes('dynamic import callback was not specified')
  )
}

function requireNodeFileRuntimeModule(moduleUrl: string): unknown {
  const nodeModule = getNodeModuleModule()
  if (typeof nodeModule?.createRequire !== 'function') {
    return null
  }

  const modulePath = fileUrlToPath(moduleUrl)
  return nodeModule.createRequire(modulePath)(modulePath)
}

function resolveNodeDirname(moduleUrl: string): string | null {
  if (!moduleUrl.startsWith('file://')) {
    return null
  }

  return fileUrlToPath(new URL('.', moduleUrl).href).replace(/[\\/]+$/u, '')
}

export function readNodeWasmBinary(wasmUrl: string): Uint8Array | undefined {
  if (!wasmUrl.startsWith('file://')) {
    return undefined
  }

  const nodeProcess = (
    globalThis as {
      process?: {
        getBuiltinModule?: (
          name: string,
        ) => { readFileSync?: (path: string) => Uint8Array } | undefined
      }
    }
  ).process
  const fs = nodeProcess?.getBuiltinModule?.('fs')
  if (typeof fs?.readFileSync !== 'function') {
    return undefined
  }

  return fs.readFileSync(fileUrlToPath(wasmUrl))
}

function fileUrlToPath(fileUrl: string): string {
  const nodeUrl = getNodeUrlModule()
  if (typeof nodeUrl?.fileURLToPath === 'function') {
    return nodeUrl.fileURLToPath(fileUrl)
  }

  const url = new URL(fileUrl)
  return normalizeWindowsDrivePath(decodeURIComponent(url.pathname))
}

function pathToFileUrl(filePath: string): string {
  const normalized = normalizeWindowsDrivePath(filePath)
  const nodeUrl = getNodeUrlModule()
  if (typeof nodeUrl?.pathToFileURL === 'function') {
    return nodeUrl.pathToFileURL(normalized).href
  }

  const slashPath = normalized.replace(/\\/gu, '/')
  return `file://${slashPath.startsWith('/') ? '' : '/'}${slashPath}`
}

function normalizeWindowsDrivePath(value: string): string {
  return value.replace(/^\/([A-Za-z]:[\\/])/u, '$1')
}

function getNodeUrlModule():
  | {
      fileURLToPath?: (url: string | URL) => string
      pathToFileURL?: (path: string) => URL
    }
  | undefined {
  const nodeProcess = (
    globalThis as {
      process?: {
        getBuiltinModule?: (
          name: string,
        ) =>
          | {
              fileURLToPath?: (url: string | URL) => string
              pathToFileURL?: (path: string) => URL
            }
          | undefined
      }
    }
  ).process

  return nodeProcess?.getBuiltinModule?.('url')
}

function getNodeModuleModule():
  | {
      createRequire?: (filename: string) => (id: string) => unknown
    }
  | undefined {
  const nodeProcess = (
    globalThis as {
      process?: {
        getBuiltinModule?: (
          name: string,
        ) =>
          | {
              createRequire?: (filename: string) => (id: string) => unknown
            }
          | undefined
      }
    }
  ).process

  return nodeProcess?.getBuiltinModule?.('module')
}

async function resolveRuntimeUrl(url: string): Promise<string> {
  const nodeLocalRuntimeUrl = resolveNodeLocalRuntimeUrl(url)
  if (nodeLocalRuntimeUrl) {
    return nodeLocalRuntimeUrl
  }

  if (!url.startsWith('/')) {
    return url
  }

  if (typeof window !== 'undefined' && window.location?.origin) {
    return new URL(url, window.location.origin).href
  }

  if (typeof self !== 'undefined' && 'location' in self) {
    const location = (self as { location?: Location }).location
    if (location?.origin) {
      return new URL(url, location.origin).href
    }
  }

  const nodeProcess = (globalThis as { process?: { cwd(): string } }).process
  if (nodeProcess) {
    const fileName = url.split('/').filter(Boolean).pop()
    if (fileName) {
      const cwd = nodeProcess.cwd().replace(/\\/g, '/').replace(/\/+$/, '')
      return pathToFileUrl(`${cwd}/vue/packages/wasm/dist/${fileName}`)
    }
  }

  return url
}

function resolveNodeLocalRuntimeUrl(url: string): string | null {
  if (!/^https?:\/\//u.test(url)) {
    return null
  }

  const nodeProcess = (globalThis as { process?: { cwd(): string } }).process
  if (!nodeProcess) {
    return null
  }

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }

  if (!['localhost', '127.0.0.1', '0.0.0.0'].includes(parsed.hostname)) {
    return null
  }

  const cwd = nodeProcess.cwd().replace(/\\/g, '/').replace(/\/+$/, '')
  const pathname = decodeURIComponent(parsed.pathname)
  const filePath = pathname.startsWith('/@fs/')
    ? pathname.slice('/@fs'.length)
    : pathname.startsWith(`${cwd}/`)
      ? pathname
    : pathname.startsWith('/vue/packages/wasm/dist/')
      ? `${cwd}${pathname}`
        : null

  return filePath ? pathToFileUrl(filePath) : null
}
