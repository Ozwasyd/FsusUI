#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

export const PLAYWRIGHT_OWNERS_PATH = 'spec/ci/playwright-owners.json'
export const PLAYWRIGHT_SUITES_PATH = 'spec/ci/playwright-suites.json'

export function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(',')}]`
  }
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

export function loadPlaywrightRegistry(repositoryRoot = repoRoot) {
  return {
    owners: JSON.parse(
      readFileSync(
        resolve(repositoryRoot, PLAYWRIGHT_OWNERS_PATH),
        'utf8',
      ),
    ),
    suites: JSON.parse(
      readFileSync(
        resolve(repositoryRoot, PLAYWRIGHT_SUITES_PATH),
        'utf8',
      ),
    ),
  }
}

export function computePlaywrightRegistryHash(registry) {
  const hash = createHash('sha256')
  hash.update(stableStringify(registry.owners))
  hash.update('\0')
  hash.update(stableStringify(registry.suites))
  hash.update('\0')
  return hash.digest('hex')
}

/** Map suiteId -> owning gate (from the #479 owners registry). */
export function suiteOwnerGate(registry) {
  const map = new Map()
  for (const owner of Object.values(registry.owners.owners ?? {})) {
    for (const suiteId of owner.suiteIds ?? []) {
      if (map.has(suiteId) && map.get(suiteId) !== owner.gate) {
        throw new Error(
          `playwright registry: suite ${suiteId} claimed by multiple owners (${map.get(
            suiteId,
          )}, ${owner.gate}).`,
        )
      }
      map.set(suiteId, owner.gate)
    }
  }
  return map
}

/**
 * Expected Playwright cells for a profile.
 * Cells are derived exclusively from the #479 registry (owners + suites),
 * never from a second hand-written matrix.
 */
export function expectedPlaywrightCells(registry, ownerIds, profile) {
  const owners = registry.owners.owners ?? {}
  const profileSuites = new Set(
    (registry.suites.profiles?.[profile]?.suiteIds ?? []).map(
      (id) => id,
    ),
  )
  const cells = []
  for (const ownerId of ownerIds) {
    const owner = owners[ownerId]
    if (!owner) throw new Error(`Unknown playwright owner: ${ownerId}.`)
    for (const suiteId of owner.suiteIds ?? []) {
      if (!profileSuites.has(suiteId)) continue
      const suite = registry.suites.suites.find((entry) => entry.id === suiteId)
      if (!suite) throw new Error(`playwright registry: unknown suite ${suiteId}.`)
      for (const cell of suite.cells) {
        cells.push({
          owner: ownerId,
          gate: owner.gate,
          suiteId,
          cellId: cell.id,
          project: cell.project,
          dimensions: cell.dimensions,
        })
      }
    }
  }
  return cells.sort((left, right) =>
    `${left.gate}\0${left.cellId}`.localeCompare(`${right.gate}\0${right.cellId}`),
  )
}
