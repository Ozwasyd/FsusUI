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
  const moduleRef = (await import(
    /* @vite-ignore */ resolvedModuleUrl
  )) as ModuleNamespace<TModule>
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

function resolveNodeDirname(moduleUrl: string): string | null {
  if (!moduleUrl.startsWith('file://')) {
    return null
  }

  const pathname = new URL('.', moduleUrl).pathname.replace(/\/+$/, '')
  return decodeURIComponent(pathname)
}

function readNodeWasmBinary(wasmUrl: string): Uint8Array | undefined {
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
  const url = new URL(fileUrl)
  return decodeURIComponent(url.pathname)
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
      return `file://${cwd}/packages/wasm/dist/${fileName}`
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
      : pathname.startsWith('/packages/wasm/dist/')
        ? `${cwd}${pathname}`
        : null

  return filePath ? `file://${filePath}` : null
}
