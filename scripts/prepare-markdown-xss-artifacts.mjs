import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { resolve, relative } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const outputRoot = resolve(root, '.tmp/markdown-xss-production-artifacts')
const browserOutput = resolve(outputRoot, 'browser')
const fingerprintInputs = [
  'vue/packages/wasm/index.ts',
  'vue/packages/wasm/markdown.ts',
  'vue/packages/wasm/markdown-runtime.ts',
  'vue/packages/wasm/markdown-feature-output-gateway.ts',
  'vue/packages/wasm/runtime/assets.ts',
  'vue/packages/wasm/runtime/emscripten.ts',
  'vue/packages/wasm/markdown/include/markdown_contract.hpp',
  'vue/packages/wasm/markdown/src/markdown_contract.cpp',
]

const wasmEsmPath = resolve(root, 'vue/packages/wasm/dist/index.mjs')
const wasmEsm = await readFile(wasmEsmPath, 'utf8').catch(() => '')
if (!wasmEsm || wasmEsm.includes('createJiti')) {
  const pnpmEntry = process.env.npm_execpath
  if (!pnpmEntry) {
    throw new Error(
      '[markdown-xss] real Wasm ESM/CJS bundle is missing and pnpm producer is unavailable',
    )
  }
  const result = spawnSync(
    process.execPath,
    [pnpmEntry, 'run', '-C', 'vue/packages/wasm', 'build'],
    { cwd: root, env: process.env, stdio: 'inherit' },
  )
  if (result.status !== 0) {
    throw new Error('[markdown-xss] Wasm ESM/CJS bundle producer failed')
  }
}

const hash = createHash('sha256')
for (const path of fingerprintInputs) {
  hash.update(path)
  hash.update(await readFile(resolve(root, path)))
}
const sourceFingerprint = hash.digest('hex')

const manifestPath = resolve(outputRoot, 'manifest.json')
const cachedManifest = await readFile(manifestPath, 'utf8')
  .then(JSON.parse)
  .catch(() => null)
if (
  cachedManifest?.sourceFingerprint === sourceFingerprint &&
  Array.isArray(cachedManifest.browserFiles) &&
  cachedManifest.browserFiles.length > 0 &&
  (
    await Promise.all(
      cachedManifest.browserFiles.map((path) =>
        stat(resolve(root, path))
          .then((info) => info.isFile() && info.size > 0)
          .catch(() => false),
      ),
    )
  ).every(Boolean)
) {
  console.log(
    `[markdown-xss] production artifact cache-hit fingerprint=${sourceFingerprint.slice(
      0,
      16,
    )} browserFiles=${cachedManifest.browserFiles.length}`,
  )
  process.exit(0)
}

const { build } = await import('vite')
await build({
  configFile: false,
  root,
  logLevel: 'warn',
  build: {
    emptyOutDir: true,
    lib: {
      entry: resolve(root, 'vue/packages/wasm/index.ts'),
      fileName: 'fsus-wasm-browser',
      formats: ['es'],
    },
    outDir: browserOutput,
    rollupOptions: {
      external: (id) =>
        /^(?:@element-plus\/utils|katex|mermaid|shiki(?:\/.*)?)$/u.test(id),
      output: {
        chunkFileNames: 'chunks/[name]-[hash].mjs',
        entryFileNames: '[name].mjs',
      },
    },
    target: 'es2022',
  },
})

const listFiles = async (directory) => {
  const files = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) files.push(...(await listFiles(path)))
    else files.push(relative(root, path))
  }
  return files.sort()
}

const browserFiles = await listFiles(browserOutput)
if (browserFiles.length === 0) {
  throw new Error('[markdown-xss] browser production candidate is empty')
}
await mkdir(outputRoot, { recursive: true })
await writeFile(
  manifestPath,
  `${JSON.stringify(
    {
      browserFiles,
      fingerprintInputs,
      sourceFingerprint,
      version: 1,
    },
    null,
    2,
  )}\n`,
)
console.log(
  `[markdown-xss] production artifacts ready fingerprint=${sourceFingerprint.slice(
    0,
    16,
  )} browserFiles=${browserFiles.length}`,
)
