#!/usr/bin/env node
/**
 * Run the Linux-local native IME required matrix:
 * ibus libpinyin/chewing/mozc-jp/hangul × Chromium/Firefox/WebKit.
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  BROWSER_PROFILES,
  ENGINE_PROFILES,
} from './native-ime-profiles.mjs'

export const REQUIRED_LINUX_IME_CELLS = Object.freeze(
  Object.keys(ENGINE_PROFILES).flatMap((engine) =>
    Object.keys(BROWSER_PROFILES).map((browser) => `${engine}__${browser}`),
  ),
)

const requiredManifestFields = [
  'candidateSha',
  'os',
  'browser',
  'browserVersion',
  'ime',
  'imeVersion',
  'locale',
  'fixture',
  'traceDigest',
]

const isSha = (value) => typeof value === 'string' && /^[0-9a-f]{40}$/u.test(value)
const isDigest = (value) =>
  typeof value === 'string' && /^[0-9a-f]{64}$/u.test(value)

/** Machine-check leftover #320 evidence manifests. Synthetic cells are never valid. */
export const validateManifest = (manifest, expectedCandidateSha) => {
  const errors = []
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    return { valid: false, errors: ['manifest must be an object'] }
  }
  if (manifest.schema !== 'fsusui.native-ime-evidence-matrix.v1') {
    errors.push('unexpected schema')
  }
  if (!Array.isArray(manifest.cells)) errors.push('cells must be an array')
  const seen = new Set()
  for (const cell of manifest.cells ?? []) {
    if (!cell || typeof cell !== 'object') {
      errors.push('cell must be an object')
      continue
    }
    if (!REQUIRED_LINUX_IME_CELLS.includes(cell.id)) {
      errors.push(`unknown cell ${cell.id}`)
    }
    if (seen.has(cell.id)) errors.push(`duplicate cell ${cell.id}`)
    seen.add(cell.id)
    if (!['success', 'external-blocked'].includes(cell.status)) {
      errors.push(`invalid status for ${cell.id}`)
    }
    if (cell.synthetic === true) {
      errors.push(`synthetic evidence is not admissible for ${cell.id}`)
    }
    for (const field of requiredManifestFields) {
      if (!cell[field]) errors.push(`missing ${field} for ${cell.id}`)
    }
    if (!isSha(cell.candidateSha)) errors.push(`invalid candidateSha for ${cell.id}`)
    if (!isDigest(cell.traceDigest)) errors.push(`invalid traceDigest for ${cell.id}`)
    if (expectedCandidateSha && cell.candidateSha !== expectedCandidateSha) {
      errors.push(`candidate SHA mismatch for ${cell.id}`)
    }
    if (cell.status === 'external-blocked' && !cell.blocker) {
      errors.push(`external blocker missing for ${cell.id}`)
    }
    if (
      cell.status === 'success' &&
      (!Array.isArray(cell.operations) || cell.operations.length === 0)
    ) {
      errors.push(`successful cell lacks operation evidence for ${cell.id}`)
    }
  }
  for (const id of REQUIRED_LINUX_IME_CELLS) {
    if (!seen.has(id)) errors.push(`missing required cell ${id}`)
  }
  return { valid: errors.length === 0, errors }
}

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const harnessPath = resolve(repositoryRoot, 'scripts/native-ime-harness.mjs')
const defaultOut = resolve(repositoryRoot, '.tmp/native-ime-matrix')

const parseArguments = (argv) => {
  const options = {
    out: defaultOut,
    skipBuild: false,
    engines: Object.keys(ENGINE_PROFILES),
    browsers: Object.keys(BROWSER_PROFILES),
  }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--out') options.out = resolve(process.cwd(), argv[++index])
    else if (argument === '--skip-build') options.skipBuild = true
    else if (argument === '--engine') options.engines = argv[++index].split(',')
    else if (argument === '--browser') options.browsers = argv[++index].split(',')
  }
  return options
}

const runMatrix = () => {
  const options = parseArguments(process.argv.slice(2))
  mkdirSync(options.out, { recursive: true })

  const cells = []
  let first = true
  for (const engine of options.engines) {
  for (const browser of options.browsers) {
    const cellDirectory = join(options.out, `${engine}__${browser}`)
    const args = [
      harnessPath,
      '--engine',
      engine,
      '--browser',
      browser,
      '--out',
      cellDirectory,
    ]
    if (options.skipBuild || !first) args.push('--skip-build')
    first = false
    console.log(`[matrix] ${engine} × ${browser}`)
    const started = Date.now()
    const result = spawnSync(process.execPath, args, {
      cwd: repositoryRoot,
      encoding: 'utf8',
      env: process.env,
      stdio: 'inherit',
    })
    cells.push({
      engine,
      browser,
      status: result.status,
      durationMs: Date.now() - started,
      out: cellDirectory,
      required: true,
    })
  }
  }

  const passed = cells.filter((cell) => cell.status === 0).length
  const failed = cells.filter((cell) => cell.status !== 0)
  const summary = {
    schemaVersion: 1,
    kind: 'native-ime-linux-local-matrix',
    candidateCommand: 'git rev-parse HEAD',
    requiredCells: cells,
    optionalOffHost: [
      'Windows Microsoft IME',
      'macOS system IME',
      'Safari browser UI',
    ],
    passed,
    failed: failed.length,
    verdict: failed.length === 0 ? 'pass' : 'fail',
  }
  writeFileSync(
    join(options.out, 'summary.json'),
    `${JSON.stringify(summary, null, 2)}\n`,
  )
  console.log(
    `[matrix] ${summary.verdict} passed=${passed}/${cells.length} evidence=${options.out}`,
  )
  process.exitCode = failed.length === 0 ? 0 : 1
}

const isMain =
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])

if (isMain) {
  runMatrix()
}
