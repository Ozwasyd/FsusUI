#!/usr/bin/env node
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const candidate = path.join(root, 'dist/npm-candidate/fsusui-npm-candidate.manifest.json')
const authority = JSON.parse(
  readFileSync(path.join(root, 'config/dependencies/npm-authority.json'), 'utf8'),
)
assert.ok(authority.consumerProfiles['npm-latest'])
assert.ok(authority.consumerProfiles['pnpm-latest'])
assert.ok(authority.consumerProfiles['npm-peer-floor'])
const receipt = {
  kind: 'fsusblog-consumer-gate',
  localSimulation: true,
  profiles: Object.keys(authority.consumerProfiles),
  candidateManifestPresent: existsSync(candidate),
  appInstall: 'simulated-readonly',
}
assert.deepEqual(receipt.profiles.sort(), ['npm-latest', 'npm-peer-floor', 'pnpm-latest'].sort())
console.log('Cross-repo consumer receipt simulated locally.')
console.log(JSON.stringify(receipt))
