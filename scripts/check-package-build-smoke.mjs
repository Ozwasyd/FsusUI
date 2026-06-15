import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { registryUrl, resolvePackageContract } from './npm-package-contract.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (relativePath) => readFileSync(path.join(root, relativePath), 'utf8')
const readJson = (relativePath) => JSON.parse(read(relativePath))

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

const rootPackage = readJson('package.json')
const sourcePackage = readJson('packages/element-plus/package.json')
const { packageName, repositoryGitUrl, repositoryWebUrl } =
  resolvePackageContract({ repoRoot: root })

assert(
  rootPackage.scripts?.build?.includes('pnpm run -C internal/build start'),
  'root build script must call the internal package build entrypoint',
)
assert(
  rootPackage.scripts?.['build:npm-package']?.includes('prepare-npm-package.mjs --strict'),
  'build:npm-package must keep the strict publish artifact validation step',
)
assert(
  rootPackage.scripts?.['build:package-smoke']?.includes('check-package-build-smoke.mjs'),
  'build:package-smoke must stay a lightweight smoke check, not a full package build',
)
assert(sourcePackage.main === 'lib/index.js', 'source package main entry drift')
assert(sourcePackage.module === 'es/index.mjs', 'source package module entry drift')
assert(sourcePackage.types === 'es/index.d.ts', 'source package types entry drift')
assert(sourcePackage.style === 'dist/index.css', 'source package style entry drift')
assert(sourcePackage.homepage === repositoryWebUrl, 'source package homepage drift')
assert(sourcePackage.repository?.url === `git+${repositoryGitUrl}`, 'source package repository drift')
assert(sourcePackage.bugs?.url === `${repositoryWebUrl}/issues`, 'source package bugs URL drift')
assert(sourcePackage.publishConfig?.access === 'public', 'source package must publish with public access')
assert(
  sourcePackage.publishConfig?.registry === undefined
    || sourcePackage.publishConfig.registry === registryUrl,
  'source package publish registry must be npm public registry when present',
)

for (const exportPath of ['.', './global', './theme', './icons-vue', './wasm', './markdown-runtime']) {
  assert(sourcePackage.exports?.[exportPath], `source package exports must include ${exportPath}`)
}

for (const artifact of [
  'packages/icons-vue/dist/index.js',
  'packages/icons-vue/dist/types/index.d.ts',
  'packages/wasm/dist/index.mjs',
  'packages/wasm/dist/ep_wasm.wasm',
  'packages/wasm/dist/markdown_basic.wasm',
  'packages/wasm/dist/markdown_simd.wasm',
]) {
  assert(existsSync(path.join(root, artifact)), `package smoke requires prepared artifact: ${artifact}`)
}

const gulpfile = read('internal/build/gulpfile.ts')
for (const task of [
  'cleanPackageBuild',
  'buildModules',
  'generateTypesDefinitions',
  'buildThemeChalk',
  'buildFullBundle',
  'copyWasmRuntimeAssets',
]) {
  assert(gulpfile.includes(task), `internal build gulpfile must keep ${task}`)
}

console.log(`Package build smoke passed for ${packageName}.`)
