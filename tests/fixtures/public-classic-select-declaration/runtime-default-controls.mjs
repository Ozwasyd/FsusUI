import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { installedAuthority } from './authority.mjs'

const consumer = path.resolve(process.argv[2])
const authority = await installedAuthority(path.join(consumer, 'node_modules/@ozwasyd/element-plus'))
assert.equal(authority.node16ModuleObject, true, 'Native directory exports and matching Node16 declaration identity must be inspected first.')
const require = createRequire(path.join(consumer, 'package.json'))
assert.equal(require('vue/package.json').version, '3.5.32')
assert.equal(require('vite/package.json').version, '7.3.1')
const native = path.join(consumer, 'native-defaults.mjs')
await copyFile(path.join(import.meta.dirname, 'native-defaults.mjs'), native)
const nativeEvidence = JSON.parse(execFileSync(process.execPath, [native], { cwd: consumer, encoding: 'utf8' }).trim())
const entry = path.join(consumer, 'bundler-defaults.ts')
await copyFile(path.join(import.meta.dirname, 'bundler-defaults.ts'), entry)
const { build } = await import(pathToFileURL(require.resolve('vite')))
const outDir = path.join(consumer, 'bundler-defaults-output')
await mkdir(outDir, { recursive: true })
const buildOptions = (input) => ({
  root: consumer, configFile: false, logLevel: 'warn',
  build: {
    outDir, emptyOutDir: true, minify: false,
    lib: { entry: input, formats: ['es'], fileName: () => 'defaults.mjs' },
  },
})
let packageBundlerImport
try {
  await build(buildOptions(entry))
  packageBundlerImport = { status: 'PASS' }
} catch (error) {
  assert.equal(error.code, 'PLUGIN_ERROR')
  assert.match(error.message, /No known conditions for "\.\/lib\/components\/select"/)
  packageBundlerImport = { status: 'FAIL', code: error.code, message: error.message }
}
const resolvedEntry = path.join(consumer, 'resolved-bundler-defaults.ts')
const entrySource = await readFile(entry, 'utf8')
await writeFile(resolvedEntry, entrySource.replace("'@ozwasyd/element-plus/lib/components/select'", JSON.stringify(require.resolve('@ozwasyd/element-plus/lib/components/select'))))
await build(buildOptions(resolvedEntry))
const { evidence } = await import(pathToFileURL(path.join(outDir, 'defaults.mjs')))
assert.deepEqual(evidence, { cjsDefaultIsNamed: true, optionExtra: true, groupExtra: true, installer: true })
const result = { authority: authority.name, nativeNode: process.version, vite: '7.3.1', native: nativeEvidence, bundler: evidence, packageBundlerImport, loaderContractControls: 'PASS on the actual require-resolved CJS file', publicImportQualification: nativeEvidence.nativePackageImport.status === 'PASS' && packageBundlerImport.status === 'PASS' ? 'PASS' : 'FAIL' }
await writeFile(path.join(consumer, 'runtime-default-results.json'), JSON.stringify(result, null, 2) + '\n')
console.log(JSON.stringify(result))
