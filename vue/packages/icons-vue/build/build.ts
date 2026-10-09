import { mkdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import Vue from 'unplugin-vue/esbuild'
import type { Format } from 'esbuild'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const packageRoot = path.resolve(__dirname, '..')
const distDir = path.join(packageRoot, 'dist')

// Invalidate certification without deleting declarations built in parallel.
await rm(path.join(distDir, '.artifact-fingerprint'), { force: true })
await mkdir(distDir, { recursive: true })

const entries = [
  { entry: 'src/index.ts', outfile: 'dist/index.js', format: 'esm' as Format },
  { entry: 'src/index.ts', outfile: 'dist/index.cjs', format: 'cjs' as Format },
  {
    entry: 'src/global.ts',
    outfile: 'dist/global.js',
    format: 'esm' as Format,
  },
  {
    entry: 'src/global.ts',
    outfile: 'dist/global.cjs',
    format: 'cjs' as Format,
  },
]

for (const item of entries) {
  await build({
    absWorkingDir: packageRoot,
    entryPoints: [item.entry],
    outfile: item.outfile,
    bundle: true,
    format: item.format,
    platform: 'neutral',
    target: 'es2020',
    sourcemap: true,
    external: ['vue'],
    plugins: [Vue()],
    define: {
      'process.env.NODE_ENV': JSON.stringify(
        process.env.NODE_ENV ?? 'production',
      ),
    },
  })
}

console.log('icons-vue bundles generated.')
