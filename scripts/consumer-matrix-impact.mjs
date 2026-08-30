import { execFileSync } from 'node:child_process'
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import {
  canonicalJson,
  classifyConsumerMatrixImpact,
  digestJson,
} from './consumer-matrix-lib.mjs'

const repoRoot = path.resolve(import.meta.dirname, '..')
const args = process.argv.slice(2)
const option = (name, fallback = '') => {
  const index = args.indexOf(name)
  return index >= 0 ? args[index + 1] : fallback
}
const base = option('--base')
const output = path.resolve(
  repoRoot,
  option('--output', '.consumer-matrix/impact-plan.json'),
)

let paths = []
let fallbackReason = null
if (!base) {
  fallbackReason = 'base-unavailable:conservative-run'
} else {
  try {
    paths = execFileSync(
      'git',
      ['diff', '--name-only', '--diff-filter=ACMRDTUXB', `${base}...HEAD`],
      { cwd: repoRoot, encoding: 'utf8' },
    )
      .split(/\r?\n/u)
      .filter(Boolean)
  } catch (error) {
    fallbackReason = `diff-unavailable:conservative-run:${error.status ?? 'unknown'}`
  }
}

const decision =
  fallbackReason || paths.length === 0
    ? {
        action: 'run',
        paths,
        reason: fallbackReason ?? 'empty-diff:conservative-run',
      }
    : classifyConsumerMatrixImpact(paths)
const unsigned = {
  schema: 'fsusui.consumer-matrix-impact.v1',
  base: base || null,
  action: decision.action,
  paths: decision.paths,
  reason: decision.reason,
}
const plan = { ...unsigned, digest: digestJson(unsigned) }
mkdirSync(path.dirname(output), { recursive: true })
writeFileSync(output, canonicalJson(plan))
if (process.env.GITHUB_OUTPUT) {
  appendFileSync(
    process.env.GITHUB_OUTPUT,
    `run=${plan.action === 'run'}\nreason=${plan.reason}\ndigest=${plan.digest}\nplan=${path.relative(repoRoot, output)}\n`,
  )
}
console.log(canonicalJson(plan).trim())
