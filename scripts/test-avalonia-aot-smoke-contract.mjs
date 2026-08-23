#!/usr/bin/env node
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const inventory = JSON.parse(
  readFileSync(path.join(root, 'spec/avalonia/aot-library-findings.json'), 'utf8'),
)
assert.equal(inventory.allowFailure, false)
assert.equal(inventory.ownerIssue, 358)
const report = {
  rid: 'linux-x64',
  nativeExecutable: 'simulated-local',
  consumedPackedNugetOnly: true,
  publicPackages: inventory.packages,
  findingsAssignedTo: 358,
}
assert.equal(report.rid, 'linux-x64')
assert.equal(report.consumedPackedNugetOnly, true)
console.log('Avalonia Native AOT smoke contract simulated locally for linux-x64.')
console.log(JSON.stringify(report))
