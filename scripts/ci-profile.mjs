#!/usr/bin/env node

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { readinessSpec } from './ci-readiness-contract.mjs'

const args = process.argv.slice(2).filter((argument) => argument !== '--')
const command = args.shift()
const option = (name, fallback) => {
  const flag = `--${name}`
  const index = args.indexOf(flag)
  if (index >= 0) return args[index + 1]
  return (
    args
      .find((argument) => argument.startsWith(`${flag}=`))
      ?.slice(flag.length + 1) ?? fallback
  )
}
const repoRoot = path.resolve(import.meta.dirname, '..')
const read = (relativePath) =>
  fs.readFileSync(path.resolve(repoRoot, relativePath), 'utf8')
const job = (workflow, name) =>
  workflow.match(
    new RegExp(
      `\\n  ${name}:\\n([\\s\\S]*?)(?=\\n  [a-zA-Z][\\w-]*:\\n|$)`,
      'u',
    ),
  )?.[1] ?? ''
const containsAll = (source, values, label) => {
  for (const value of values)
    assert.ok(source.includes(value), `${label} is missing ${value}`)
}

function plan(group) {
  const gates = readinessSpec.profiles[group]
  const execution = readinessSpec.execution?.[group]
  assert.ok(gates && execution, `Unknown CI profile: ${group}.`)
  console.log(
    JSON.stringify(
      {
        schemaVersion: readinessSpec.schemaVersion,
        group,
        gates: gates.map((gate) => ({
          gate,
          ...readinessSpec.owners[gate],
        })),
        ...execution,
        artifactBindings: readinessSpec.artifactBindings,
        execution: 'dry-run',
      },
      null,
      2,
    ),
  )
}

function check(publishPath) {
  assert.deepEqual(Object.keys(readinessSpec.profiles), [
    'main',
    'nightly',
    'release',
  ])
  const releaseGates = readinessSpec.profiles.release
  const playwrightGates = releaseGates.filter((gate) =>
    readinessSpec.playwright?.ownerIds?.includes(gate),
  )
  const workflowGates = releaseGates.filter(
    (gate) => !readinessSpec.playwright?.ownerIds?.includes(gate),
  )
  containsAll(
    releaseGates,
    [
      'static-quality',
      'typecheck',
      'unit',
      'coverage',
      'visual',
      'dotnet-platform',
      'dotnet-package',
      'build-package',
      'consumer-install',
      'real-render-performance',
    ],
    'release profile',
  )
  assert.equal(readinessSpec.execution.release.aggregator, 'release-readiness')
  assert.equal(readinessSpec.execution.release.realRenderProfile, 'full')
  assert.equal(readinessSpec.execution.release.visualProfile, 'evidence')
  assert.equal(
    readinessSpec.execution.release.identityBinding,
    'commit-tag-package',
  )

  const reusable = read('.github/workflows/_quality.yml')
  const releaseAggregator = job(reusable, 'release-readiness')
  containsAll(
    releaseAggregator,
    workflowGates.map((gate) => `- ${gate}`),
    'release-readiness needs',
  )
  assert.ok(
    playwrightGates.length > 0,
    'release profile must include playwright gates',
  )
  containsAll(
    releaseAggregator,
    [
      '--profile release',
      '--release-tag "$release_tag"',
      '--candidate-manifest .npm-candidate/fsusui-npm-candidate.manifest.json',
      'id: release-evidence',
    ],
    'release-readiness aggregator',
  )
  for (const forbidden of ['verify:release', 'test:visual', 'test:coverage'])
    assert.ok(
      !releaseAggregator.includes(forbidden),
      `release-readiness must not rerun ${forbidden}`,
    )

  const publish = read(publishPath)
  const quality = job(publish, 'quality')
  const preflight = job(publish, 'preflight')
  const publishJob = job(publish, 'publish')
  containsAll(
    quality,
    [
      'uses: ./.github/workflows/_quality.yml',
      'group: release',
      'release_tag: ${{ github.ref_name }}',
    ],
    'tag quality job',
  )
  containsAll(
    `${preflight}\n${publishJob}`,
    ['needs.quality.outputs.release-readiness-digest', 'needs: [quality, plan'],
    'publish dependency chain',
  )
  assert.ok(
    !publishJob.includes('package:candidate:build'),
    'publish must not rebuild the npm candidate',
  )

  const qualityWorkflow = read('.github/workflows/quality.yml')
  containsAll(
    job(qualityWorkflow, 'release'),
    ['group: release', 'release_tag: ${{ inputs.release_tag }}'],
    'manual release job',
  )
  containsAll(
    job(qualityWorkflow, 'release-playwright'),
    ['uses: ./.github/workflows/_quality-playwright.yml', 'group: release'],
    'release playwright job',
  )
  containsAll(
    job(qualityWorkflow, 'release'),
    ['needs: release-playwright'],
    'manual release job ordering',
  )
  containsAll(
    job(publish, 'quality'),
    ['needs: quality-playwright'],
    'publish quality ordering',
  )
  console.log(
    `[ci-profile] profiles=${Object.keys(readinessSpec.profiles).join(',')} publish=${publishPath} status=valid`,
  )
}

if (command === 'plan') plan(option('group', 'main'))
else if (command === 'check')
  check(option('workflow', '.github/workflows/publish-npm.yml'))
else
  throw new Error(
    'Usage: ci-profile.mjs <plan --group main|nightly|release|check> [--workflow path]',
  )
