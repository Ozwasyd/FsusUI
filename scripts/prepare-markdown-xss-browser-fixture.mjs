import { createHash } from 'node:crypto'
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { resolve, relative } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const outputRoot = resolve(root, '.tmp/markdown-xss-browser-fixture')
const manifestPath = resolve(outputRoot, 'fixture-manifest.json')
const sourceRoots = [
  'vue/packages/components/markdown-renderer/src',
  'vue/packages/wasm',
  'vue/tests/markdown-xss',
  'vue/tests/support/markdown-xss-dom.ts',
  'vue/tests/support/markdown-xss-kill-controls.ts',
]

const listSourceFiles = async (path) => {
  const info = await stat(path)
  if (info.isFile()) return [path]
  const files = []
  for (const entry of await readdir(path, { withFileTypes: true })) {
    if (
      entry.name === '__tests__' ||
      entry.name === 'dist' ||
      entry.name === 'node_modules'
    ) {
      continue
    }
    const child = resolve(path, entry.name)
    if (entry.isDirectory()) files.push(...(await listSourceFiles(child)))
    else if (
      /\.(?:cpp|css|h|hpp|html|js|json|mjs|ts|tsx|vue|wasm)$/u.test(entry.name)
    ) {
      files.push(child)
    }
  }
  return files
}

const sourceFiles = (
  await Promise.all(
    sourceRoots.map((path) => listSourceFiles(resolve(root, path))),
  )
)
  .flat()
  .sort()
const hash = createHash('sha256')
for (const path of sourceFiles) {
  hash.update(relative(root, path))
  hash.update(await readFile(path))
}
const sourceFingerprint = hash.digest('hex')
const cached = await readFile(manifestPath, 'utf8')
  .then(JSON.parse)
  .catch(() => null)
const cachedEntry = cached?.entry
if (
  cached?.sourceFingerprint === sourceFingerprint &&
  typeof cachedEntry === 'string' &&
  (await stat(resolve(outputRoot, cachedEntry)).catch(() => null))?.isFile()
) {
  console.log(
    `[markdown-xss] browser fixture cache-hit fingerprint=${sourceFingerprint.slice(
      0,
      16,
    )}`,
  )
  process.exit(0)
}

const [{ default: Vue }, { build }] = await Promise.all([
  import('@vitejs/plugin-vue'),
  import('vite'),
])
await build({
  configFile: false,
  root,
  base: './',
  logLevel: 'warn',
  plugins: [Vue()],
  build: {
    emptyOutDir: true,
    outDir: outputRoot,
    rollupOptions: {
      input: resolve(root, 'vue/tests/markdown-xss/index.html'),
    },
    target: 'es2022',
  },
})

const entry = 'vue/tests/markdown-xss/index.html'
await mkdir(outputRoot, { recursive: true })
await writeFile(
  manifestPath,
  `${JSON.stringify({ entry, sourceFingerprint, version: 1 }, null, 2)}\n`,
)
console.log(
  `[markdown-xss] browser fixture ready fingerprint=${sourceFingerprint.slice(
    0,
    16,
  )}`,
)
