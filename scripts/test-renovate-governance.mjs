#!/usr/bin/env node
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (relativePath) => readFileSync(path.join(root, relativePath), 'utf8')

const renovate = read('renovate.json5')
const updateSurface = JSON.parse(read('config/dependencies/update-surface.json'))
const updateSurfaceSchema = JSON.parse(
  read('config/dependencies/update-surface.schema.json'),
)

assert.match(renovate, /automerge\s*:\s*false/, 'Renovate automerge must remain disabled')
assert.match(renovate, /minimumReleaseAge\s*:\s*0/, 'Renovate must not delay stable releases')
assert.ok(
  Array.isArray(updateSurface.items) || Array.isArray(updateSurface.surfaces),
  'the update surface must enumerate governed dependency fields',
)
assert.equal(updateSurfaceSchema.type, 'object', 'the update surface must have a JSON schema')

const items = updateSurface.items ?? updateSurface.surfaces
assert.ok(items.length > 0, 'the update surface must not be empty')
const ownershipByVersionField = new Map()
for (const item of items) {
  assert.equal(typeof item.id, 'string', 'each governed item must have an id')
  assert.equal(typeof item.datasource, 'string', `${item.id} must declare a datasource`)
  assert.equal(typeof item.packageName, 'string', `${item.id} must declare a package name`)
  assert.ok(item.manager || item.customManager, `${item.id} must declare manager ownership`)
  assert.ok(Array.isArray(item.files) && item.files.length > 0, `${item.id} must declare owned files`)
  assert.equal(typeof item.versioning, 'string', `${item.id} must declare versioning`)
  assert.equal(typeof item.group, 'string', `${item.id} must declare a semantic group`)
  assert.equal(typeof item.stabilityPolicy, 'string', `${item.id} must declare a stability policy`)

  for (const file of item.files) {
    assert.equal(typeof file, 'string', `${item.id} must use repository-relative file paths`)
    assert.ok(file.length > 0, `${item.id} must not declare an empty owned path`)

    const versionField = `${file}:${item.packageName}`
    assert.ok(
      !ownershipByVersionField.has(versionField),
      `${versionField} must have exactly one Renovate manager owner`,
    )
    ownershipByVersionField.set(versionField, item.id)
  }
}

assert.ok(
  items.some((item) => item.files.includes('pnpm-lock.yaml')),
  'the update surface must govern the pnpm lockfile projection',
)
assert.ok(
  items.some((item) => item.files.includes('dotnet/Directory.Packages.props')),
  'the update surface must govern central NuGet versions',
)
assert.ok(
  items.some((item) => item.files.includes('config/dependencies/npm-authority.json')),
  'the update surface must govern the npm authority source',
)
assert.doesNotMatch(
  renovate,
  /(?:ignoreDeps\s*:\s*\[[\s\S]*?\]|enabled\s*:\s*false)/,
  'Renovate must not permanently ignore dependency update surfaces',
)
assert.match(
  renovate,
  /schedule\s*:\s*\[[\s\S]*?(?:every\s+6\s+hours|\*\/6)[\s\S]*?\]/,
  'Renovate must run at least every six hours',
)
assert.match(
  renovate,
  /lockFileMaintenance\s*:\s*\{[\s\S]*?enabled\s*:\s*true/,
  'Renovate must keep daily lockfile maintenance enabled',
)

console.log('Renovate governance contract assertions passed.')
import ioAssert from 'node:assert/strict'
import { readFileSync as ioReadFileSync } from 'node:fs'
import ioPath from 'node:path'
import { fileURLToPath as ioFileURLToPath } from 'node:url'

const ioTestRoot = ioPath.resolve(ioPath.dirname(ioFileURLToPath(import.meta.url)), '..')
const ioPackageJson = JSON.parse(ioReadFileSync(ioPath.join(ioTestRoot, 'package.json'), 'utf8'))
const ioRenovateConfig = ioReadFileSync(ioPath.join(ioTestRoot, 'renovate.json5'), 'utf8')

ioAssert.match(ioPackageJson.packageManager, /^pnpm@\d+/, 'packageManager must pin pnpm for Renovate-managed Node tooling')
ioAssert.ok(ioPackageJson.engines?.node, 'engines.node must declare the supported Node runtime')
ioAssert.match(ioRenovateConfig, /github-actions/, 'Renovate must manage GitHub Actions references')
// Renovate governance contract: the frozen update-surface fixtures must remain covered.
