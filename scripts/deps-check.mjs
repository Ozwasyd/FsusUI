#!/usr/bin/env node
/**
 * pnpm deps:check — read-only drift checker against npm authority.
 *
 * Does not mutate the working tree. Does not invoke the sync command. Does not contact
 * the npm registry. Failures print file / field / expected / actual.
 */

import {
  runDepsCheck,
  formatDriftError,
  AUTHORITY_REL,
} from './deps-check-lib.mjs'

const result = runDepsCheck()

if (result.ok) {
  const packageCount = Object.keys(result.authority?.install || {}).length
  console.log(
    `[deps:check] ok authority=${AUTHORITY_REL} packages=${packageCount} drifts=0`,
  )
  process.exit(0)
}

console.error(
  `[deps:check] failed drifts=${result.errors.length} authority=${AUTHORITY_REL}`,
)
for (const error of result.errors) {
  console.error(formatDriftError(error))
}
process.exit(1)
