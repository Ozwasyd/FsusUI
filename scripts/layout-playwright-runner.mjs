#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { loadPlaywrightOwners, planOwnerCells } from './layout-playwright-plan.mjs'
import { loadPlaywrightSuiteRegistry } from './playwright-suites.mjs'
import {
  executeCellWithReceipt,
  fail,
  option,
  repoRoot,
  runVisualRuntimePrepare,
  sha256File,
  waitForServer,
} from './lib/playwright-owner-core.mjs'

export async function runCell(ownerId, cellId, group, options = {}) {
  const registry = loadPlaywrightSuiteRegistry()
  const owners = loadPlaywrightOwners()
  const plan = planOwnerCells(ownerId, group, registry, owners)
  const owner = owners.owners[ownerId]
  const runtimeDir = options.runtimeDir ?? '.tmp/visual-runtime-playwright'
  const evidenceDir = options.evidenceDir ?? owner?.evidenceDirectory
  const serverUrl = options.serverUrl ?? 'http://127.0.0.1:4181'
  const manifestPath = resolve(repoRoot, runtimeDir, 'manifest.json')
  let loadedManifest = null

  return executeCellWithReceipt({
    ownerId,
    cellId,
    group,
    plan,
    evidenceDir,
    logPrefix: 'playwright-layout',
    cellNotFoundLabel: 'layout',
    browsers: ['chromium'],
    resolveDimensions: (cell) => ({
      browser: cell.dimensions.browser,
      viewport: cell.dimensions.viewport,
      theme: cell.dimensions.theme,
      deviceScaleFactor: cell.dimensions.deviceScaleFactor,
    }),
    prepareRuntime: async () => {
      runVisualRuntimePrepare(runtimeDir, { checkOnly: true })
      if (!existsSync(manifestPath)) {
        fail(`runtime manifest missing: ${manifestPath}`)
      }
      loadedManifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
      await waitForServer(serverUrl, 60_000)
      return {
        runtimeMode: owner.runtimeMode,
        manifestDigest: sha256File(manifestPath),
        sourceFingerprint: loadedManifest.sourceFingerprint,
      }
    },
    resolveFallbackRuntime: () =>
      loadedManifest
        ? {
            runtimeMode: owner.runtimeMode,
            manifestDigest: sha256File(manifestPath),
            sourceFingerprint: loadedManifest.sourceFingerprint,
          }
        : null,
    prepareEnv: () => ({
      ...process.env,
      FSUS_PLAYWRIGHT_EXTERNAL_SERVER: serverUrl,
    }),
  })
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    const argv = process.argv.slice(2)
    if (argv[0] !== 'cell-run') {
      fail(
        'Usage: layout-playwright-runner.mjs cell-run --owner <id> --cell <cell> --group <g> [--runtime-dir <dir>] [--evidence-dir <dir>] [--server-url <url>]',
      )
    }
    const ownerId = option(argv, 'owner')
    const cellId = option(argv, 'cell')
    if (!ownerId || !cellId) fail('cell-run requires --owner and --cell')
    const result = await runCell(ownerId, cellId, option(argv, 'group', 'main'), {
      runtimeDir: option(argv, 'runtime-dir'),
      evidenceDir: option(argv, 'evidence-dir'),
      serverUrl: option(argv, 'server-url'),
    })
    if (!result.ok) process.exitCode = 1
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}
