import { cpSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolvePackageContract } from './github-package-contract.mjs'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, '..')
const templateRoot = path.join(repoRoot, 'tests', 'consumer-install', 'template')
const distRoot = path.join(repoRoot, 'dist', 'element-plus')
const distPackagePath = path.join(distRoot, 'package.json')
const sourcePackagePath = path.join(
  repoRoot,
  'packages',
  'element-plus',
  'package.json',
)

if (!existsSync(distPackagePath)) {
  throw new Error(
    'Missing dist/element-plus/package.json. Run `pnpm run build:github-package` before `pnpm test:consumer-install`.',
  )
}

const sourcePackage = JSON.parse(readFileSync(sourcePackagePath, 'utf8'))
const distPackage = JSON.parse(readFileSync(distPackagePath, 'utf8'))
const { packageName, repositoryWebUrl } = resolvePackageContract({
  repoRoot,
  sourcePackageName: sourcePackage.name,
})

if (distPackage.name !== packageName) {
  throw new Error(
    `Built package name drifted. Expected ${packageName}, got ${distPackage.name}.`,
  )
}

if (distPackage.peerDependencies?.vue !== sourcePackage.peerDependencies?.vue) {
  throw new Error(
    `Built package peerDependencies.vue drifted. Expected ${sourcePackage.peerDependencies?.vue}, got ${distPackage.peerDependencies?.vue}.`,
  )
}

if (distPackage.homepage !== repositoryWebUrl) {
  throw new Error(
    `Built package homepage drifted. Expected ${repositoryWebUrl}, got ${distPackage.homepage}.`,
  )
}

function run(command, args, options) {
  execFileSync(command, args, {
    stdio: 'inherit',
    ...options,
  })
}

const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'fsusui-consumer-'))
const fixtureRoot = path.join(tempRoot, 'fixture')
const artifactsRoot = path.join(tempRoot, 'artifacts')

try {
  cpSync(templateRoot, fixtureRoot, { recursive: true })
  mkdirSync(artifactsRoot, { recursive: true })

  for (const relativePath of ['src/main.ts', 'tsconfig.json']) {
    const filePath = path.join(fixtureRoot, relativePath)
    const content = readFileSync(filePath, 'utf8').replaceAll(
      '__FSUS_PACKAGE_NAME__',
      packageName,
    )
    writeFileSync(filePath, content)
  }

  const packOutput = execFileSync(
    'npm',
    ['pack', '--silent', '--pack-destination', artifactsRoot],
    {
      cwd: distRoot,
      encoding: 'utf8',
    },
  )

  const tarballName = packOutput
    .trim()
    .split(/\r?\n/u)
    .at(-1)
  if (!tarballName) {
    throw new Error('npm pack did not return a tarball filename.')
  }

  const tarballPath = path.join(artifactsRoot, tarballName)

  run('pnpm', ['install', '--no-frozen-lockfile'], { cwd: fixtureRoot })
  run('pnpm', ['add', tarballPath], { cwd: fixtureRoot })
  run('pnpm', ['exec', 'vue-tsc', '--noEmit'], { cwd: fixtureRoot })
  run('pnpm', ['exec', 'vite', 'build'], { cwd: fixtureRoot })

  console.log(`Consumer install smoke passed for ${packageName}.`)
} finally {
  rmSync(tempRoot, { force: true, recursive: true })
}
