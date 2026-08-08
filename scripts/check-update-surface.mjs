#!/usr/bin/env node
/**
 * pnpm check:update-surface — validate update-surface.json against renovate.json5.
 *
 * Verifies:
 * 1. Every surface entry maps to exactly one manager/group.
 * 2. No duplicate surface IDs or missing/overlapping ownership.
 * 3. Exclusions have required governance fields.
 * 4. Governance parameters (automerge, major/minor/patch enabled, no permanent ignores).
 * 5. Schema validation against update-surface.schema.json.
 */

import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const Ajv2020 = require('ajv/dist/2020.js')
const JSON5 = require('json5')

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')

const SURFACE_REL = 'config/dependencies/update-surface.json'
const SCHEMA_REL = 'config/dependencies/update-surface.schema.json'
const RENOVATE_REL = 'renovate.json5'

function readJson(relPath) {
  const fullPath = path.resolve(repoRoot, relPath)
  if (!existsSync(fullPath)) return null
  return JSON.parse(readFileSync(fullPath, 'utf-8'))
}

function readJson5(relPath) {
  const fullPath = path.resolve(repoRoot, relPath)
  if (!existsSync(fullPath)) return null
  return JSON5.parse(readFileSync(fullPath, 'utf-8'))
}

const errors = []

function fail(msg) {
  errors.push(msg)
  console.error(`[check:update-surface] FAIL ${msg}`)
}

// 1. Load and validate schema
const schema = readJson(SCHEMA_REL)
if (!schema) {
  fail(`schema missing: ${SCHEMA_REL}`)
  process.exit(1)
}

const surface = readJson(SURFACE_REL)
if (!surface) {
  fail(`surface missing: ${SURFACE_REL}`)
  process.exit(1)
}

const ajv = new Ajv2020({ allErrors: true })
const validate = ajv.compile(schema)
if (!validate(surface)) {
  for (const err of validate.errors) {
    fail(`schema: ${err.instancePath} ${err.message}`)
  }
}

// 2. Load renovate.json5 for group validation
const renovate = readJson5(RENOVATE_REL)
const renovateGroups = new Set()
if (renovate && renovate.packageRules) {
  for (const rule of renovate.packageRules) {
    if (rule.groupName) renovateGroups.add(rule.groupName)
  }
}

// 3. Check surface entries
const seenIds = new Set()
const seenPackages = new Set()
const groupCoverage = new Set()

for (const entry of surface.surfaces || []) {
  // Unique ID
  if (seenIds.has(entry.id)) {
    fail(`duplicate surface id: ${entry.id}`)
  }
  seenIds.add(entry.id)

  // Unique package+datasource identity
  const pkgKey = `${entry.datasource}:${entry.packageName}`
  if (seenPackages.has(pkgKey)) {
    fail(`duplicate package identity: ${pkgKey}`)
  }
  seenPackages.add(pkgKey)

  // Valid group
  if (renovateGroups.size > 0 && entry.group && !renovateGroups.has(entry.group)) {
    fail(`surface ${entry.id} references unknown group: ${entry.group}`)
  }
  if (entry.group) groupCoverage.add(entry.group)

  // Required fields
  if (!entry.id || !entry.datasource || !entry.packageName || !entry.manager || !entry.files) {
    fail(`surface ${entry.id} missing required fields`)
  }
}

// 4. Group coverage: every renovate group must be covered
for (const group of renovateGroups) {
  if (!groupCoverage.has(group) && group !== 'github-actions') {
    // github-actions is auto-covered by the manager
    fail(`renovate group not covered by any surface: ${group}`)
  }
}

// 5. Exclusion governance
const now = new Date()
for (const exclusion of surface.exclusions || []) {
  const required = ['id', 'reason', 'owner', 'createdAt', 'reviewAfter', 'removalCondition']
  for (const field of required) {
    if (!exclusion[field]) {
      fail(`exclusion ${exclusion.id || 'UNKNOWN'} missing field: ${field}`)
    }
  }
  if (exclusion.reviewAfter) {
    const reviewDate = new Date(exclusion.reviewAfter)
    if (reviewDate < now) {
      fail(`exclusion ${exclusion.id} reviewAfter expired: ${exclusion.reviewAfter}`)
    }
  }
}

// 6. Governance checks
const gov = surface.governance
if (gov) {
  if (gov.automerge !== false) fail('governance.automerge must be false')
  if (gov.majorEnabled !== true) fail('governance.majorEnabled must be true')
  if (gov.minorEnabled !== true) fail('governance.minorEnabled must be true')
  if (gov.patchEnabled !== true) fail('governance.patchEnabled must be true')
  if (gov.digestEnabled !== true) fail('governance.digestEnabled must be true')
  if (gov.lockfileMaintenanceEnabled !== true) fail('governance.lockfileMaintenanceEnabled must be true')
  if (gov.permanentIgnoreCount !== 0) fail('governance.permanentIgnoreCount must be 0')
}

// 7. No version copies in surface entries
for (const entry of surface.surfaces || []) {
  if (entry.currentVersion) {
    fail(`surface ${entry.id} must not copy currentVersion`)
  }
}

// Result
if (errors.length === 0) {
  console.log(
    `[check:update-surface] ok surfaces=${surface.surfaces?.length || 0} ` +
    `exclusions=${surface.exclusions?.length || 0} groups=${groupCoverage.size}`,
  )
  process.exit(0)
}

console.error(`[check:update-surface] FAILED errors=${errors.length}`)
process.exit(1)
