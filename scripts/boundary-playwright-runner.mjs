#!/usr/bin/env node
/* global URL */

import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { sha256File, validateCellReceipt } from './layout-playwright-verify.mjs'
import { loadBoundaryOwnerPlan } from './boundary-playwright-plan.mjs'
import { fingerprintPaths } from './visual-runtime-core.mjs'
import fg from 'fast-glob'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const fail = (message) => {
  throw new Error(message)
}

const stableStringify = (value) => {
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

const readRepositoryCommit = () => {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: root,
    encoding: 'utf8',
  })
  return result.status === 0 ? result.stdout.trim() : ''
}

const findPlaywrightPackage = () => {
  for (const candidate of [
    resolve(root, 'node_modules/@playwright/test/package.json'),
    resolve(root, 'node_modules/playwright/package.json'),
  ]) {
    if (existsSync(candidate)) {
      return JSON.parse(readFileSync(candidate, 'utf8')).version
    }
  }
  return undefined
}

const readBrowserRevision = (prefix) => {
  const browserRoot = process.env.PLAYWRIGHT_BROWSERS_PATH
    ? resolve(process.env.PLAYWRIGHT_BROWSERS_PATH)
    : resolve(process.env.HOME ?? '', '.cache/ms-playwright')
  if (!existsSync(browserRoot)) return null
  try {
    const revision = readdirSync(browserRoot).find((name) =>
      name.startsWith(`${prefix}-`),
    )
    return revision ?? null
  } catch {
    return null
  }
}

export const readBrowserToolchain = () => {
  const chromiumRevision = readBrowserRevision('chromium')
  const webkitRevision = readBrowserRevision('webkit')
  return {
    chromiumRevision,
    ...(webkitRevision ? { webkitRevision } : {}),
  }
}

const parseJsonReporterOutput = (stdout) => {
  const text = (stdout ?? '').trim()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    const start = text.lastIndexOf('{')
    if (start >= 0) {
      try {
        return JSON.parse(text.slice(start))
      } catch {
        return null
      }
    }
    return null
  }
}

const testsFromStats = (stats) => {
  const expected = Number.isFinite(stats?.expected) ? stats.expected : 0
  const unexpected = Number.isFinite(stats?.unexpected) ? stats.unexpected : 0
  const skipped = Number.isFinite(stats?.skipped) ? stats.skipped : 0
  const flaky = Number.isFinite(stats?.flaky) ? stats.flaky : 0
  return {
    total: expected + unexpected + skipped,
    passed: expected,
    failed: unexpected,
    skipped,
    flaky,
  }
}

const BOUNDARY_FINGERPRINT_INPUTS = Object.freeze({
  'visual-boundary-audit': [
    'vue/playwright.boundary-audit.config.ts',
    'vue/tests/visual-boundary/**',
    'vue/packages/demo-app/package.json',
    'vue/packages/demo-app/index.html',
    'vue/packages/demo-app/vite.config.ts',
    'vue/packages/demo-app/tsconfig.json',
    'vue/packages/demo-app/src/**',
  ],
})

const expandFingerprintInputs = async (inputs) => {
  const files = []
  for (const input of inputs) {
    if (input.includes('*')) {
      const matches = await fg(input, {
        cwd: root,
        onlyFiles: true,
        dot: true,
        ignore: ['**/node_modules/**', '**/dist/**', '**/.tmp/**'],
      })
      files.push(...matches.map((match) => `./${match}`))
    } else {
      files.push(input)
    }
  }
  return files
}

export async function computeBoundaryCellRuntime(cell) {
  const inputs = BOUNDARY_FINGERPRINT_INPUTS[cell.suiteId]
  if (!inputs) fail(`no boundary fingerprint inputs for suite ${cell.suiteId}`)
  const fingerprintFiles = await expandFingerprintInputs(inputs)
  const fingerprint = await fingerprintPaths(root, fingerprintFiles)
  if (fingerprint.missing.length > 0) {
    fail(
      `boundary runtime fingerprint missing inputs for ${cell.id}: ${fingerprint.missing.join(', ')}`,
    )
  }
  const inputsDigest = createHash('sha256')
    .update(stableStringify({ suiteId: cell.suiteId, inputs }))
    .digest('hex')
  return {
    runtimeMode: 'prepared-preview',
    sourceFingerprint: fingerprint.fingerprint,
    inputsDigest,
    fingerprintInputs: inputs,
    fingerprintFiles,
  }
}

export function writeBoundaryCellRuntimeManifest(cell, evidenceDir, runtime) {
  const manifestPath = resolve(
    root,
    evidenceDir,
    'runtime-manifests',
    `${cell.suiteId}.json`,
  )
  mkdirSync(dirname(manifestPath), { recursive: true })
  writeFileSync(
    manifestPath,
    `${JSON.stringify({ schemaVersion: 1, suiteId: cell.suiteId, ...runtime }, null, 2)}\n`,
  )
  return {
    ...runtime,
    manifestDigest: sha256File(manifestPath),
  }
}

export async function runBoundaryCell(ownerId, cellId, group, options = {}) {
  const plan = loadBoundaryOwnerPlan(group)
  const cell = plan.cells.find((entry) => entry.id === cellId)
  if (!cell) fail(`unknown boundary cell ${cellId} for owner ${ownerId}`)
  const evidenceDir = options.evidenceDir ?? '.tmp/playwright-boundary'
  const serverUrl = options.serverUrl ?? 'http://127.0.0.1:4181'
  const startedAt = new Date().toISOString()
  let failureReason = null
  let runtime = null

  const reportRelative = `${evidenceDir}/reports/${cell.suiteId}/${cell.project}/report.json`
  const reportPath = resolve(root, reportRelative)
  const outputDirectory = resolve(root, evidenceDir, 'output', cell.suiteId, cell.project)
  mkdirSync(outputDirectory, { recursive: true })
  mkdirSync(dirname(reportPath), { recursive: true })

  try {
    runtime = await computeBoundaryCellRuntime(cell)
    runtime = writeBoundaryCellRuntimeManifest(cell, evidenceDir, runtime)
    const cellEnv = {
      ...process.env,
      CI: 'true',
      FSUS_BOUNDARY_AUDIT_PORT: String(new URL(serverUrl).port),
      FSUS_PLAYWRIGHT_EXTERNAL_SERVER: serverUrl,
    }
    const result = spawnSync(
      'pnpm',
      [
        'exec',
        'playwright',
        'test',
        `--config=${cell.config}`,
        `--project=${cell.project}`,
        '--reporter=json',
        `--output=${outputDirectory}`,
      ],
      {
        cwd: root,
        env: cellEnv,
        encoding: 'utf8',
        maxBuffer: 256 * 1024 * 1024,
      },
    )
    const stdout = result.stdout ?? ''
    const parsed = parseJsonReporterOutput(stdout)
    const tests = testsFromStats(parsed?.stats)
    writeFileSync(reportPath, stdout.trim() ? stdout : '{}')
    const status = result.status === 0 ? 'success' : 'failure'

    const playwrightVersion = spawnSync('pnpm', ['exec', 'playwright', '--version'], {
      cwd: root,
      encoding: 'utf8',
    })
    const receipt = {
      schemaVersion: 1,
      owner: ownerId,
      gate: 'playwright-boundary',
      suiteId: cell.suiteId,
      cellId: cell.id,
      project: cell.project,
      dimensions: {
        browser: cell.dimensions.browser,
        viewport: cell.dimensions.viewport ?? null,
        theme: cell.dimensions.theme ?? null,
        safeArea: cell.dimensions.browser === 'webkit' && cell.project.startsWith('safe-area') ? true : null,
        deviceScaleFactor: cell.dimensions.deviceScaleFactor ?? null,
      },
      commitSha: process.env.GITHUB_SHA ?? readRepositoryCommit(),
      workflowGroup: group,
      run: {
        id: process.env.GITHUB_RUN_ID ?? 'local',
        attempt: process.env.GITHUB_RUN_ATTEMPT ?? '1',
      },
      toolchain: {
        node: process.version,
        pnpm: spawnSync('pnpm', ['--version'], { cwd: root, encoding: 'utf8' }).stdout.trim(),
        playwright:
          playwrightVersion.status === 0
            ? playwrightVersion.stdout.trim()
            : findPlaywrightPackage(),
        ...readBrowserToolchain(),
      },
      runtime: {
        runtimeMode: runtime.runtimeMode,
        manifestDigest: runtime.manifestDigest,
        sourceFingerprint: runtime.sourceFingerprint,
        inputsDigest: runtime.inputsDigest,
        fingerprintInputs: runtime.fingerprintInputs,
        fingerprintFiles: runtime.fingerprintFiles,
      },
      config: { path: cell.config, sha256: cell.configSha256 },
      tests,
      report: { path: reportRelative, sha256: sha256File(reportPath) },
      status,
      failureReason: null,
      startedAt,
      endedAt: new Date().toISOString(),
    }
    validateCellReceipt(receipt, cell)
    const receiptRelative = cell.receiptPath
    const receiptPath = resolve(root, receiptRelative)
    mkdirSync(dirname(receiptPath), { recursive: true })
    writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`)
    console.log(
      `[playwright-boundary] ${cell.id} status=${status} passed=${tests.passed} failed=${tests.failed} skipped=${tests.skipped} receipt=${receiptRelative}`,
    )
    return { ok: status === 'success', cellId: cell.id, status, receiptPath: receiptRelative }
  } catch (error) {
    failureReason = error instanceof Error ? error.message : String(error)
    console.error(`[playwright-boundary] ${cellId} failed: ${failureReason}`)
    if (runtime) {
      const receipt = {
        schemaVersion: 1,
        owner: ownerId,
        gate: 'playwright-boundary',
        suiteId: cell.suiteId,
        cellId: cell.id,
        project: cell.project,
        dimensions: {
          browser: cell.dimensions.browser,
          viewport: cell.dimensions.viewport ?? null,
          theme: cell.dimensions.theme ?? null,
          deviceScaleFactor: null,
        },
        commitSha: process.env.GITHUB_SHA ?? readRepositoryCommit(),
        workflowGroup: group,
        run: {
          id: process.env.GITHUB_RUN_ID ?? 'local',
          attempt: process.env.GITHUB_RUN_ATTEMPT ?? '1',
        },
        toolchain: {
          node: process.version,
          pnpm: 'unknown',
          playwright: findPlaywrightPackage(),
          ...readBrowserToolchain(),
        },
        runtime,
        config: { path: cell.config, sha256: cell.configSha256 },
        tests: { total: 0, passed: 0, failed: 0, skipped: 0, flaky: 0 },
        report: null,
        status: 'failure',
        failureReason,
        startedAt,
        endedAt: new Date().toISOString(),
      }
      const receiptPath = resolve(root, cell.receiptPath)
      mkdirSync(dirname(receiptPath), { recursive: true })
      writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`)
      return { ok: false, cellId: cell.id, status: 'failure', receiptPath: cell.receiptPath, error: failureReason }
    }
    return { ok: false, cellId: cell.id, status: 'failure', receiptPath: null, error: failureReason }
  }
}

const option = (args, name, fallback) => {
  const index = args.indexOf(`--${name}`)
  if (index >= 0) return args[index + 1]
  const prefix = `--${name}=`
  return args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) ?? fallback
}

function main(argv = process.argv.slice(2)) {
  const command = argv[0]
  if (command !== 'cell-run') {
    fail('Usage: boundary-playwright-runner.mjs cell-run --owner playwright-boundary --cell <cell> --group <g> [--evidence-dir <dir>] [--server-url <url>]')
  }
  const ownerId = option(argv, 'owner', 'playwright-boundary')
  const cellId = option(argv, 'cell')
  const group = option(argv, 'group', 'main')
  if (!cellId) fail('cell-run requires --cell')
  runBoundaryCell(ownerId, cellId, group, {
    evidenceDir: option(argv, 'evidence-dir'),
    serverUrl: option(argv, 'server-url'),
  }).then((result) => {
    if (!result.ok) process.exitCode = 1
  })
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main()
}
