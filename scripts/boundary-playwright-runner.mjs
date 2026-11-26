#!/usr/bin/env node
/* global URL */

import { pathToFileURL } from 'node:url'
import { loadBoundaryOwnerPlan } from './boundary-playwright-plan.mjs'
import {
  computeSuiteCellRuntime,
  executeCellWithReceipt,
  fail,
  option,
  readBrowserToolchain as readCoreBrowserToolchain,
  writeSuiteRuntimeManifest,
} from './lib/playwright-owner-core.mjs'

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

export const readBrowserToolchain = () =>
  readCoreBrowserToolchain({ browsers: ['chromium', 'webkit'] })

export const computeBoundaryCellRuntime = (cell) =>
  computeSuiteCellRuntime(cell, BOUNDARY_FINGERPRINT_INPUTS, {
    runtimeMode: 'prepared-preview',
    label: 'boundary',
  })

export const writeBoundaryCellRuntimeManifest = (cell, evidenceDir, runtime) =>
  writeSuiteRuntimeManifest(cell, evidenceDir, runtime)

export async function runBoundaryCell(ownerId, cellId, group, options = {}) {
  const plan = loadBoundaryOwnerPlan(group)
  const evidenceDir = options.evidenceDir ?? '.tmp/playwright-boundary'
  const serverUrl = options.serverUrl ?? 'http://127.0.0.1:4181'
  return executeCellWithReceipt({
    ownerId,
    cellId,
    group,
    plan,
    evidenceDir,
    logPrefix: 'playwright-boundary',
    cellNotFoundLabel: 'boundary',
    browsers: ['chromium', 'webkit'],
    resolveDimensions: (cell) => ({
      browser: cell.dimensions.browser,
      viewport: cell.dimensions.viewport ?? null,
      theme: cell.dimensions.theme ?? null,
      safeArea:
        cell.dimensions.browser === 'webkit' &&
        cell.project.startsWith('safe-area')
          ? true
          : null,
      deviceScaleFactor: cell.dimensions.deviceScaleFactor ?? null,
    }),
    resolveFailureDimensions: (cell) => ({
      browser: cell.dimensions.browser,
      viewport: cell.dimensions.viewport ?? null,
      theme: cell.dimensions.theme ?? null,
      deviceScaleFactor: null,
    }),
    prepareRuntime: async (cell) => {
      const computed = await computeBoundaryCellRuntime(cell)
      return writeBoundaryCellRuntimeManifest(cell, evidenceDir, computed)
    },
    prepareEnv: () => ({
      ...process.env,
      CI: 'true',
      FSUS_BOUNDARY_AUDIT_PORT: String(new URL(serverUrl).port),
      FSUS_PLAYWRIGHT_EXTERNAL_SERVER: serverUrl,
    }),
  })
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const argv = process.argv.slice(2)
  if (argv[0] !== 'cell-run') {
    fail(
      'Usage: boundary-playwright-runner.mjs cell-run --owner playwright-boundary --cell <cell> --group <g> [--evidence-dir <dir>] [--server-url <url>]',
    )
  }
  const cellId = option(argv, 'cell')
  if (!cellId) fail('cell-run requires --cell')
  const result = await runBoundaryCell(
    option(argv, 'owner', 'playwright-boundary'),
    cellId,
    option(argv, 'group', 'main'),
    {
      evidenceDir: option(argv, 'evidence-dir'),
      serverUrl: option(argv, 'server-url'),
    },
  )
  if (!result.ok) process.exitCode = 1
}
