#!/usr/bin/env node
/**
 * pnpm deps:baseline:verify — compare current lock/resolution against migration baseline.
 *
 * Verifies that pnpm-lock.yaml and key package manifests have not drifted from
 * the #405 zero-version-change migration baseline. Fails if any hash differs,
 * indicating an unapproved dependency change.
 */

import { createHash } from 'node:crypto'
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { repoRoot } from './npm-authority-lib.mjs'

const BASELINE_REL = 'config/dependencies/migration-baseline.json'
const baselinePath = path.resolve(repoRoot, BASELINE_REL)

if (!existsSync(baselinePath)) {
  console.error(`[deps:baseline] missing baseline: ${BASELINE_REL}`)
  process.exit(1)
}

const baseline = JSON.parse(readFileSync(baselinePath, 'utf-8'))
const files = baseline.files || {}

const errors = []

for (const [fileRel, expectedHash] of Object.entries(files)) {
  const filePath = path.resolve(repoRoot, fileRel)
  if (!existsSync(filePath)) {
    errors.push({ file: fileRel, error: 'missing', expected: expectedHash })
    continue
  }
  const content = readFileSync(filePath)
  const actualHash = createHash('sha256').update(content).digest('hex')
  if (actualHash !== expectedHash) {
    errors.push({
      file: fileRel,
      error: 'hash-mismatch',
      expected: expectedHash,
      actual: actualHash,
    })
  }
}

if (errors.length > 0) {
  console.error(
    `[deps:baseline] FAILED drifts=${errors.length} baseline=${BASELINE_REL}`,
  )
  for (const error of errors) {
    console.error(
      `[deps:baseline] FAIL file=${error.file} ${error.error}` +
        (error.expected ? ` expected=${error.expected}` : '') +
        (error.actual ? ` actual=${error.actual}` : ''),
    )
  }
  process.exit(1)
}

const fileCount = Object.keys(files).length
console.log(
  `[deps:baseline] ok baseline=${BASELINE_REL} files=${fileCount} drifts=0`,
)
