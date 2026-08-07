#!/usr/bin/env node
/* global fetch, setTimeout */

import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  loadPlaywrightOwners,
  planOwnerCells,
} from './layout-playwright-plan.mjs'
import { loadPlaywrightSuiteRegistry } from './playwright-suites.mjs'
import { sha256File, validateCellReceipt } from './layout-playwright-verify.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const fail = (message) => {
  throw new Error(message)
}

const readToolVersion = (command, args, cwd = root) => {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8' })
  return result.status === 0 ? result.stdout.trim() : undefined
}

const readRepositoryCommit = () => {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: root,
    encoding: 'utf8',
  })
  return result.status === 0 ? result.stdout.trim() : ''
}

const readChromiumRevision = () => {
  const browserRoot = process.env.PLAYWRIGHT_BROWSERS_PATH
    ? resolve(process.env.PLAYWRIGHT_BROWSERS_PATH)
    : resolve(process.env.HOME ?? '', '.cache/ms-playwright')
  if (!existsSync(browserRoot)) return null
  try {
    const chromium = readdirSync(browserRoot).find((name) =>
      name.startsWith('chromium-'),
    )
    return chromium ?? null
  } catch {
    return null
  }
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

const runRuntimeCheck = (runtimeDir) => {
  const result = spawnSync(
    process.execPath,
    [
      'scripts/prepare-visual-runtime.mjs',
      '--check',
      `--runtime-dir=${runtimeDir}`,
    ],
    { cwd: root, encoding: 'utf8' },
  )
  if (result.status !== 0) {
    throw new Error(
      `visual runtime check failed (${result.status ?? 'no status'}):\n${result.stdout}\n${result.stderr}`,
    )
  }
}

const readRuntimeManifest = (runtimeDir) => {
  const manifestPath = resolve(root, runtimeDir, 'manifest.json')
  if (!existsSync(manifestPath)) {
    fail(`runtime manifest missing: ${manifestPath}`)
  }
  return JSON.parse(readFileSync(manifestPath, 'utf8'))
}

const waitForServer = async (url, timeoutMs = 60_000) => {
  const deadline = Date.now() + timeoutMs
  let lastError
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url)
      if (response.status === 200) return true
      lastError = new Error(`server responded ${response.status}`)
    } catch (error) {
      lastError = error
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 500))
  }
  throw lastError ?? new Error(`server readiness timeout: ${url}`)
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

export async function runCell(ownerId, cellId, group, options = {}) {
  const registry = loadPlaywrightSuiteRegistry()
  const owners = loadPlaywrightOwners()
  const plan = planOwnerCells(ownerId, group, registry, owners)
  const cell = plan.cells.find((entry) => entry.id === cellId)
  if (!cell) fail(`unknown cell ${cellId} for owner ${ownerId}`)
  const owner = owners.owners[ownerId]

  const runtimeDir = options.runtimeDir ?? '.tmp/visual-runtime-playwright'
  const evidenceDir = options.evidenceDir ?? owner.evidenceDirectory
  const serverUrl = options.serverUrl ?? 'http://127.0.0.1:4181'
  const startedAt = new Date().toISOString()
  let failureReason = null
  let manifest = null

  const reportRelative = `${evidenceDir}/reports/${cell.suiteId}/${cell.project}/report.json`
  const reportPath = resolve(root, reportRelative)
  mkdirSync(resolve(root, evidenceDir, 'output', cell.suiteId, cell.project), {
    recursive: true,
  })
  mkdirSync(dirname(reportPath), { recursive: true })

  try {
    runRuntimeCheck(runtimeDir)
    manifest = readRuntimeManifest(runtimeDir)
    await waitForServer(serverUrl)

    const playwrightVersion = spawnSync('pnpm', ['exec', 'playwright', '--version'], {
      cwd: root,
      encoding: 'utf8',
    })
    const outputDirectory = resolve(root, evidenceDir, 'output', cell.suiteId, cell.project)
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
        env: {
          ...process.env,
          FSUS_PLAYWRIGHT_EXTERNAL_SERVER: serverUrl,
        },
        encoding: 'utf8',
        maxBuffer: 256 * 1024 * 1024,
      },
    )
    const stdout = result.stdout ?? ''
    const parsed = parseJsonReporterOutput(stdout)
    const tests = testsFromStats(parsed?.stats)
    writeFileSync(reportPath, stdout.trim() ? stdout : '{}')
    const status = result.status === 0 ? 'success' : 'failure'
    const receipt = {
      schemaVersion: 1,
      owner: ownerId,
      gate: owner.gate,
      suiteId: cell.suiteId,
      cellId: cell.id,
      project: cell.project,
      dimensions: {
        browser: cell.dimensions.browser,
        viewport: cell.dimensions.viewport,
        theme: cell.dimensions.theme,
        deviceScaleFactor: cell.dimensions.deviceScaleFactor,
      },
      commitSha: process.env.GITHUB_SHA ?? readRepositoryCommit(),
      workflowGroup: group,
      run: {
        id: process.env.GITHUB_RUN_ID ?? 'local',
        attempt: process.env.GITHUB_RUN_ATTEMPT ?? '1',
      },
      toolchain: {
        node: process.version,
        pnpm: readToolVersion('pnpm', ['--version']),
        playwright:
          playwrightVersion.status === 0
            ? playwrightVersion.stdout.trim()
            : findPlaywrightPackage(),
        chromiumRevision: readChromiumRevision(),
      },
      runtime: {
        runtimeMode: owner.runtimeMode,
        manifestDigest: sha256File(resolve(root, runtimeDir, 'manifest.json')),
        sourceFingerprint: manifest.sourceFingerprint,
      },
      config: {
        path: cell.config,
        sha256: cell.configSha256,
      },
      tests,
      report: {
        path: reportRelative,
        sha256: sha256File(reportPath),
      },
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
      `[playwright-layout] ${cell.id} status=${status} passed=${tests.passed} failed=${tests.failed} skipped=${tests.skipped} receipt=${receiptRelative}`,
    )
    return { ok: status === 'success', cellId: cell.id, status, receiptPath: receiptRelative }
  } catch (error) {
    failureReason = error instanceof Error ? error.message : String(error)
    console.error(`[playwright-layout] ${cellId} failed: ${failureReason}`)
    if (manifest) {
      const receipt = {
        schemaVersion: 1,
        owner: ownerId,
        gate: owner.gate,
        suiteId: cell.suiteId,
        cellId: cell.id,
        project: cell.project,
        dimensions: {
          browser: cell.dimensions.browser,
          viewport: cell.dimensions.viewport,
          theme: cell.dimensions.theme,
          deviceScaleFactor: cell.dimensions.deviceScaleFactor,
        },
        commitSha: process.env.GITHUB_SHA ?? readRepositoryCommit(),
        workflowGroup: group,
        run: {
          id: process.env.GITHUB_RUN_ID ?? 'local',
          attempt: process.env.GITHUB_RUN_ATTEMPT ?? '1',
        },
        toolchain: {
          node: process.version,
          pnpm: readToolVersion('pnpm', ['--version']),
          playwright: findPlaywrightPackage(),
          chromiumRevision: readChromiumRevision(),
        },
        runtime: {
          runtimeMode: owner.runtimeMode,
          manifestDigest: sha256File(resolve(root, runtimeDir, 'manifest.json')),
          sourceFingerprint: manifest.sourceFingerprint,
        },
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

async function main(argv = process.argv.slice(2)) {
  const command = argv[0]
  if (command !== 'cell-run') {
    fail('Usage: layout-playwright-runner.mjs cell-run --owner <id> --cell <cell> --group <g> [--runtime-dir <dir>] [--evidence-dir <dir>] [--server-url <url>]')
  }
  const ownerId = option(argv, 'owner')
  const cellId = option(argv, 'cell')
  const group = option(argv, 'group', 'main')
  if (!ownerId || !cellId) fail('cell-run requires --owner and --cell')
  const result = await runCell(ownerId, cellId, group, {
    runtimeDir: option(argv, 'runtime-dir'),
    evidenceDir: option(argv, 'evidence-dir'),
    serverUrl: option(argv, 'server-url'),
  })
  if (!result.ok) process.exitCode = 1
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    await main()
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}
