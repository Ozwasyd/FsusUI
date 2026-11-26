#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { loadVisualReuseOwnerPlan } from './visual-reuse-playwright-plan.mjs'
import {
  executeCellWithReceipt,
  fail,
  option,
  repoRoot,
  sha256File,
  waitForServer,
} from './lib/playwright-owner-core.mjs'

export async function runVisualReuseCell(ownerId, cellId, group, options = {}) {
  const plan = loadVisualReuseOwnerPlan(group)
  const evidenceDir = options.evidenceDir ?? '.tmp/visual-runtime-reuse'
  const runtimeDir = options.runtimeDir ?? '.tmp/visual-runtime-reuse-runtime'
  const serverUrl = options.serverUrl ?? 'http://127.0.0.1:4182'
  const manifestPath = resolve(repoRoot, runtimeDir, 'manifest.json')

  const loadReuseRuntime = () => {
    if (!existsSync(manifestPath)) return null
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
    return {
      runtimeMode: 'prepared-reuse',
      manifestDigest: sha256File(manifestPath),
      sourceFingerprint: manifest.sourceFingerprint,
    }
  }

  return executeCellWithReceipt({
    ownerId,
    cellId,
    group,
    plan,
    evidenceDir,
    logPrefix: 'visual-runtime-reuse',
    cellNotFoundLabel: 'visual-reuse',
    browsers: ['chromium'],
    chromiumFallback: 'unknown',
    prepareRuntime: async () => {
      if (!existsSync(manifestPath)) {
        fail(`runtime manifest missing: ${manifestPath}`)
      }
      const runtime = loadReuseRuntime()
      await waitForServer(serverUrl)
      return runtime
    },
    resolveFallbackRuntime: loadReuseRuntime,
    prepareEnv: () => ({
      ...process.env,
      FSUS_PLAYWRIGHT_EXTERNAL_SERVER: serverUrl,
    }),
  })
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const argv = process.argv.slice(2)
  if (argv[0] !== 'cell-run') {
    fail(
      'Usage: visual-reuse-playwright-runner.mjs cell-run --owner <id> --cell <cell> --group <g> [--runtime-dir <dir>] [--evidence-dir <dir>] [--server-url <url>]',
    )
  }
  const cellId = option(argv, 'cell')
  if (!cellId) fail('cell-run requires --cell')
  const result = await runVisualReuseCell(
    option(argv, 'owner', 'visual-runtime-reuse'),
    cellId,
    option(argv, 'group', 'main'),
    {
      runtimeDir: option(argv, 'runtime-dir'),
      evidenceDir: option(argv, 'evidence-dir'),
      serverUrl: option(argv, 'server-url'),
    },
  )
  if (!result.ok) process.exitCode = 1
}
