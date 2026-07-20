#!/usr/bin/env node

import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import {
  readinessSpec,
  repositoryCommit,
  sha256Path,
  validateReadiness,
} from './ci-readiness-contract.mjs'

const args = process.argv.slice(2).filter((arg) => arg !== '--')
const command = args.shift()
const option = (name, fallback) => {
  const index = args.indexOf(`--${name}`)
  if (index >= 0) return args[index + 1]
  const prefix = `--${name}=`
  return (
    args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) ?? fallback
  )
}
const options = (name) => {
  const flag = `--${name}`
  const prefix = `${flag}=`
  return args.flatMap((arg, index) => {
    if (arg.startsWith(prefix)) return [arg.slice(prefix.length)]
    if (arg === flag && args[index + 1]) return [args[index + 1]]
    return []
  })
}
const pairs = (values, label) =>
  Object.fromEntries(
    values.map((value) => {
      const separator = value.indexOf('=')
      if (separator <= 0) throw new Error(`${label} must use name=value.`)
      return [value.slice(0, separator), value.slice(separator + 1)]
    }),
  )
const jsonFiles = (root) => {
  const files = []
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name)
      if (entry.isDirectory()) visit(absolute)
      else if (
        entry.name.endsWith('.json') &&
        absolute.includes(`${path.sep}manifests${path.sep}`)
      )
        files.push(absolute)
    }
  }
  visit(root)
  return files.sort()
}

if (command === 'plan') {
  const profile = option('group', 'stable')
  const required = readinessSpec.profiles[profile]
  if (!required) throw new Error(`Unknown readiness profile: ${profile}.`)
  console.log(
    JSON.stringify(
      {
        schemaVersion: readinessSpec.schemaVersion,
        profile,
        gates: required.map((gate) => ({
          gate,
          ...readinessSpec.owners[gate],
        })),
        artifactBindings: readinessSpec.artifactBindings,
        execution: 'read-only-manifest-aggregation',
      },
      null,
      2,
    ),
  )
} else if (command === 'emit') {
  const root = path.resolve(option('root', '.'))
  const gate = option('gate')
  const group = option('group')
  const status = option('status', 'success')
  if (!gate || !readinessSpec.owners[gate])
    throw new Error(`Unknown leaf gate: ${gate}.`)
  if (!group) throw new Error('--group is required.')
  const dimensions = pairs(options('dimension'), '--dimension')
  const suffix = Object.values(dimensions).join('-')
  const id = [gate, suffix]
    .filter(Boolean)
    .join('-')
    .replace(/[^a-z0-9_.-]+/giu, '-')
  const evidenceRoot = path.resolve(root, option('evidence-root', '.readiness'))
  const reportSummary = `reports/${id}.json`
  const reportPath = path.join(evidenceRoot, reportSummary)
  const inputFiles = options('input').length
    ? options('input')
    : [
        'package.json',
        'pnpm-lock.yaml',
        '.github/workflows/_quality.yml',
        'spec/ci/readiness-gates.json',
      ]
  const fingerprint = createHash('sha256')
  for (const input of inputFiles.sort()) {
    const absolute = path.resolve(root, input)
    fingerprint.update(input)
    fingerprint.update('\0')
    if (fs.existsSync(absolute)) fingerprint.update(fs.readFileSync(absolute))
    fingerprint.update('\0')
  }
  const artifacts = options('artifact').flatMap((value) => {
    const [name, ...pathParts] = value.split('=')
    const artifactPath = pathParts.join('=')
    const absolute = path.resolve(root, artifactPath)
    if (!fs.existsSync(absolute)) {
      if (status !== 'success') return []
      throw new Error(`Artifact is missing: ${artifactPath}`)
    }
    return [{ name, path: artifactPath, sha256: sha256Path(absolute) }]
  })
  const manifest = {
    schemaVersion: 1,
    workflowGroup: group,
    commitSha: option(
      'commit',
      process.env.GITHUB_SHA ?? repositoryCommit(root),
    ),
    gate,
    status,
    toolchain: {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
    },
    inputFingerprint: fingerprint.digest('hex'),
    artifacts,
    dimensions,
    reportSummary,
    createdAt: new Date().toISOString(),
    run: {
      id: String(option('run-id', process.env.GITHUB_RUN_ID ?? 'local')),
      attempt: String(
        option('run-attempt', process.env.GITHUB_RUN_ATTEMPT ?? '1'),
      ),
    },
  }
  fs.mkdirSync(path.dirname(reportPath), { recursive: true })
  fs.writeFileSync(
    reportPath,
    `${JSON.stringify({ gate, status, artifacts }, null, 2)}\n`,
  )
  const output = path.resolve(
    root,
    option('output', path.join(evidenceRoot, 'manifests', `${id}.json`)),
  )
  fs.mkdirSync(path.dirname(output), { recursive: true })
  fs.writeFileSync(output, `${JSON.stringify(manifest, null, 2)}\n`)
  console.log(
    `[ci-readiness] emitted=${path.relative(root, output)} status=${status}`,
  )
} else if (command === 'check') {
  const root = path.resolve(option('fixtures', option('root', '.readiness')))
  const files = jsonFiles(root)
  if (files.length === 0)
    throw new Error(`No readiness manifests found under ${root}.`)
  const manifests = files.map((file) => ({
    file: path.relative(root, file),
    manifest: JSON.parse(fs.readFileSync(file, 'utf8')),
  }))
  const first = manifests[0].manifest
  const evidence = validateReadiness({
    manifests,
    profile: option('profile', option('group', first.workflowGroup)),
    group: option('workflow-group', first.workflowGroup),
    commitSha: option('commit', first.commitSha),
    runId: option('run-id', first.run?.id),
    runAttempt: option('run-attempt', first.run?.attempt),
    root,
  })
  const output = option('evidence')
  if (output) {
    const absolute = path.resolve(output)
    fs.mkdirSync(path.dirname(absolute), { recursive: true })
    fs.writeFileSync(absolute, `${JSON.stringify(evidence, null, 2)}\n`)
  }
  console.log(
    `[ci-readiness] profile=${evidence.profile} manifests=${evidence.manifests.length} status=ready`,
  )
} else {
  throw new Error('Usage: ci-readiness.mjs <plan|emit|check> [options]')
}
