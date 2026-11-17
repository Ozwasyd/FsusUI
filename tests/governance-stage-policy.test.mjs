import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  staticGovernanceArgs,
  validateGovernanceStages,
} from '../scripts/governance-stage-policy.mjs'

const assets = () => ({
  scripts: JSON.parse(readFileSync('package.json', 'utf8')).scripts,
  quality: readFileSync('.github/workflows/quality.yml', 'utf8'),
  reusable: readFileSync('.github/workflows/_quality.yml', 'utf8'),
  capacity: readFileSync('scripts/run-capacity-suite.mjs', 'utf8'),
})

test('static/dynamic governance preserves the full union and required producer ordering', () => {
  validateGovernanceStages(assets())
})

for (const mutation of [
  'drop static gate',
  'drop dynamic gate',
  'reverse producer order',
  'optional producer',
  'drop PR dependency',
  'shallow producer',
]) {
  test(`governance split rejects ${mutation}`, () => {
    const value = assets()
    if (mutation === 'shallow producer')
      value.reusable = value.reusable.replace('          fetch-depth: 3\n', '')
    if (mutation === 'drop static gate')
      value.scripts['governance:check:ci-static'] = value.scripts[
        'governance:check:ci-static'
      ].replace('run-ci-static-governance.mjs', 'skip-governance.mjs')
    if (mutation === 'drop dynamic gate')
      value.reusable = value.reusable.replace(
        '          pnpm run check:avalonia-stable-readiness\n',
        '',
      )
    if (mutation === 'reverse producer order')
      value.reusable = value.reusable.replace(
        'pnpm run conformance:v2\n          pnpm run check:avalonia-stable-readiness',
        'pnpm run check:avalonia-stable-readiness\n          pnpm run conformance:v2',
      )
    if (mutation === 'optional producer')
      value.reusable = value.reusable.replace(
        '  dotnet-package:\n',
        '  dotnet-package:\n    if: false\n',
      )
    if (mutation === 'drop PR dependency')
      value.quality = value.quality.replaceAll('      - premerge-main\n', '')
    assert.throws(() => validateGovernanceStages(value))
  })
}

test('CI derivation retains all static tasks and their original order', () => {
  const full = assets().scripts['governance:check']
  assert.deepEqual(
    staticGovernanceArgs(full),
    full
      .split(/\s+/u)
      .slice(1)
      .filter((part) => part !== 'check:avalonia-stable-readiness'),
  )
  assert.throws(() =>
    staticGovernanceArgs(full.replace(' check:avalonia-stable-readiness', '')),
  )
  assert.throws(() =>
    staticGovernanceArgs(`${full} check:avalonia-stable-readiness`),
  )
  assert.throws(() => staticGovernanceArgs(`${full} && true`))
})
