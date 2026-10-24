#!/usr/bin/env node
/**
 * pnpm deps:baseline:verify — verify frozen migration evidence against its Git checkpoint.
 *
 * Current dependency projections remain owned by deps:check and npm-authority.json.
 */

import { repoRoot } from './npm-authority-lib.mjs'
import {
  MIGRATION_BASELINE_REL,
  verifyMigrationBaseline,
} from './deps-baseline-verify-lib.mjs'

try {
  if (process.argv.length !== 2) throw new Error('unexpected CLI arguments')
  const result = verifyMigrationBaseline(repoRoot)
  console.log(
    `[deps:baseline] ok baseline=${MIGRATION_BASELINE_REL} checkpoint=${result.revision} files=${result.files} drifts=0`,
  )
} catch (error) {
  console.error(
    `[deps:baseline] FAILED baseline=${MIGRATION_BASELINE_REL} ${error.message}`,
  )
  process.exitCode = 1
}
