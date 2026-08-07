#!/usr/bin/env node

import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { listControlledManifests } from './npm-authority-lib.mjs'

const root = process.cwd()
const AUTHORITY = 'config/dependencies/npm-authority.json'
const SCHEMA = 'config/dependencies/npm-authority.schema.json'
const INVENTORY = 'config/dependencies/npm-authority.inventory.json'
const BASELINE = 'config/dependencies/migration-baseline.json'

const readJson = (relative) =>
  JSON.parse(readFileSync(resolve(root, relative), 'utf8'))

const isExact = (version) =>
  typeof version === 'string' &&
  /^[0-9]+\.[0-9]+\.[0-9]+([.-][0-9A-Za-z.-]+)?$/.test(version) &&
  version !== '*' &&
  version !== 'latest'

const isForbidden = (version) =>
  version === '*' ||
  version === 'latest' ||
  (typeof version === 'string' &&
    (version.startsWith('git+') ||
      version.startsWith('git:') ||
      version.startsWith('github:') ||
      version.includes('://')))

function collectExternalIds() {
  const ids = new Map()
  for (const { absolute, relative } of listControlledManifests(root)) {
    let data
    try {
      data = JSON.parse(readFileSync(absolute, 'utf8'))
    } catch {
      continue
    }
    for (const field of [
      'dependencies',
      'devDependencies',
      'peerDependencies',
      'optionalDependencies',
    ]) {
      for (const [id, version] of Object.entries(data[field] || {})) {
        if (String(version).startsWith('workspace:')) continue
        if (!ids.has(id)) ids.set(id, [])
        ids.get(id).push({ path: relative, field, version })
      }
    }
  }
  return ids
}

// --- structural existence ---
for (const path of [AUTHORITY, SCHEMA, INVENTORY, BASELINE]) {
  assert.ok(existsSync(path), `${path} missing`)
}

const authority = readJson(AUTHORITY)
const inventory = readJson(INVENTORY)
const baseline = readJson(BASELINE)

assert.equal(authority.schemaVersion, 1)
assert.ok(authority.install && typeof authority.install === 'object')
assert.ok(authority.published?.dependencies)
assert.ok(authority.published?.peerDependencies)
assert.ok(authority.consumerProfiles)

// install pins exact only
for (const [id, version] of Object.entries(authority.install)) {
  assert.ok(
    isExact(version),
    `install[${id}] must be exact semver, got ${JSON.stringify(version)}`,
  )
  assert.ok(!isForbidden(version), `install[${id}] forbidden form`)
}

// published ranges not * / latest / git
for (const field of [
  'dependencies',
  'peerDependencies',
  'optionalDependencies',
]) {
  for (const [id, version] of Object.entries(authority.published[field] || {})) {
    assert.ok(
      !isForbidden(version),
      `published.${field}[${id}] forbidden ${version}`,
    )
    assert.ok(
      authority.install[id],
      `published.${field}[${id}] missing install pin`,
    )
  }
}

// consumer profiles only reference install or peer floor pins already in authority
for (const [profileName, profile] of Object.entries(
  authority.consumerProfiles,
)) {
  assert.ok(profile.packages, `profile ${profileName} missing packages`)
  for (const [id, version] of Object.entries(profile.packages)) {
    assert.ok(
      isExact(version),
      `consumerProfiles.${profileName}.packages[${id}] must be exact`,
    )
    assert.ok(
      authority.install[id] ||
        authority.published.peerDependencies[id],
      `consumerProfiles.${profileName} references unregistered package ${id}`,
    )
  }
}

// inventory covers all external IDs found in manifests
const external = collectExternalIds()
for (const id of external.keys()) {
  assert.ok(
    authority.install[id],
    `external package ${id} missing from authority.install (inventory gap)`,
  )
  assert.ok(
    inventory.packages?.[id],
    `external package ${id} missing from inventory report`,
  )
}

// mutation-kill style checks on cloned authority
function expectFail(label, mutate) {
  const clone = JSON.parse(JSON.stringify(authority))
  mutate(clone)
  let failed = false
  try {
    // re-run critical assertions
    for (const version of Object.values(clone.install)) {
      if (!isExact(version) || isForbidden(version)) throw new Error('bad pin')
    }
    for (const field of [
      'dependencies',
      'peerDependencies',
      'optionalDependencies',
    ]) {
      for (const [id, version] of Object.entries(
        clone.published[field] || {},
      )) {
        if (isForbidden(version)) throw new Error('bad published')
        if (!clone.install[id]) throw new Error('missing install')
      }
    }
    for (const profile of Object.values(clone.consumerProfiles)) {
      for (const [id, version] of Object.entries(profile.packages || {})) {
        if (!isExact(version)) throw new Error('bad consumer')
        if (
          !clone.install[id] &&
          !clone.published.peerDependencies[id]
        ) {
          throw new Error('unregistered consumer')
        }
      }
    }
  } catch {
    failed = true
  }
  assert.equal(failed, true, label)
}

expectFail('rejects * install pin', (clone) => {
  clone.install.vue = '*'
})
expectFail('rejects latest install pin', (clone) => {
  clone.install.vue = 'latest'
})
expectFail('rejects git install pin', (clone) => {
  clone.install.vue = 'git+https://example.com/vue.git'
})
expectFail('rejects missing install for published', (clone) => {
  clone.published.dependencies['not-registered-pkg'] = '^1.0.0'
  delete clone.install['not-registered-pkg']
})
expectFail('rejects unregistered consumer package', (clone) => {
  clone.consumerProfiles['npm-latest'].packages['totally-unknown-dep'] =
    '1.0.0'
})

// baseline freeze present
assert.equal(baseline.schemaVersion, 1)
assert.ok(baseline.files['pnpm-lock.yaml'])
assert.ok(baseline.files['config/dependencies/npm-authority.json'])
assert.equal(
  baseline.installPackageCount,
  Object.keys(authority.install).length,
)

console.log(
  `[npm-authority] check ok packages=${Object.keys(authority.install).length}`,
)
