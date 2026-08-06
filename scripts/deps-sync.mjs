#!/usr/bin/env node
/**
 * pnpm deps:sync — project config/dependencies/npm-authority.json into
 * root / workspace / published-source / consumer fixture package.json files.
 *
 * Does not consult the npm registry. Does not invent version constants.
 * Second run is a no-op (zero diff) when authority is unchanged.
 */

import {
  loadAuthority,
  syncAllManifests,
  CONSUMER_FIXTURE_RELS,
  AUTHORITY_REL,
} from './npm-authority-lib.mjs'

const dryRun = process.argv.includes('--dry-run')

const authority = loadAuthority()
const results = syncAllManifests(undefined, { authority, dryRun })
const changed = results.filter((result) => result.changed)

console.log(
  `[deps:sync] authority=${AUTHORITY_REL} manifests=${results.length} changed=${changed.length} dryRun=${dryRun}`,
)
for (const result of results) {
  const mark = result.changed ? 'UPDATE' : 'ok'
  console.log(`  [${mark}] ${result.relative} (${result.role})`)
}

if (changed.length === 0) {
  console.log('[deps:sync] already synchronized')
}

// Surface required fixture coverage for mutation tests / operators
for (const rel of CONSUMER_FIXTURE_RELS) {
  if (!results.some((result) => result.relative === rel)) {
    console.error(`[deps:sync] missing required fixture ${rel}`)
    process.exit(1)
  }
}
