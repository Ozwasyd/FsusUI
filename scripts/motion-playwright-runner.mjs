#!/usr/bin/env node

import { pathToFileURL } from 'node:url'
import { loadMotionOwnerPlan } from './motion-playwright-plan.mjs'
import {
  allocateFreePort,
  computeSuiteCellRuntime,
  executeCellWithReceipt,
  fail,
  option,
  readBrowserToolchain,
  sha256File,
  writeSuiteRuntimeManifest,
} from './lib/playwright-owner-core.mjs'

export { readBrowserToolchain, sha256File }

const FINGERPRINT_INPUTS = Object.freeze({
  'view-transitions': [
    'vue/playwright.view-transitions.config.ts',
    'vue/tests/view-transitions/**',
    'vue/packages/demo-app/package.json',
    'vue/packages/demo-app/index.html',
    'vue/packages/demo-app/view-transitions.html',
    'vue/packages/demo-app/vite.config.ts',
    'vue/packages/demo-app/tsconfig.json',
    'vue/packages/demo-app/src/**',
  ],
  'motion-ssr': [
    'vue/playwright.motion-ssr.config.ts',
    'vue/tests/motion-ssr/**',
  ],
})

export const computeCellRuntime = (cell) =>
  computeSuiteCellRuntime(cell, FINGERPRINT_INPUTS, {
    runtimeMode: 'native',
    label: 'motion',
  })

export const writeCellRuntimeManifest = (cell, evidenceDir, runtime) =>
  writeSuiteRuntimeManifest(cell, evidenceDir, runtime)

export async function runMotionCell(ownerId, cellId, group, options = {}) {
  const plan = loadMotionOwnerPlan(group)
  const evidenceDir = options.evidenceDir ?? '.tmp/playwright-motion'
  return executeCellWithReceipt({
    ownerId,
    cellId,
    group,
    plan,
    evidenceDir,
    logPrefix: 'playwright-motion',
    cellNotFoundLabel: 'motion',
    resolveDimensions: (cell) => ({
      browser: cell.dimensions.browser,
      viewport: cell.dimensions.viewport ?? null,
      theme: cell.dimensions.theme ?? null,
      deviceScaleFactor: null,
    }),
    prepareRuntime: async (cell) => {
      const computed = await computeCellRuntime(cell)
      return writeCellRuntimeManifest(cell, evidenceDir, computed)
    },
    prepareEnv: async () => {
      const port = await allocateFreePort()
      return {
        ...process.env,
        CI: 'true',
        FSUS_VIEW_TRANSITION_PORT: String(port),
        FSUS_MOTION_SSR_PORT: String(port),
      }
    },
  })
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const argv = process.argv.slice(2)
  if (argv[0] !== 'cell-run') {
    fail(
      'Usage: motion-playwright-runner.mjs cell-run --owner playwright-motion --cell <cell> --group <g> [--evidence-dir <dir>]',
    )
  }
  const cellId = option(argv, 'cell')
  if (!cellId) fail('cell-run requires --cell')
  const result = await runMotionCell(
    option(argv, 'owner', 'playwright-motion'),
    cellId,
    option(argv, 'group', 'main'),
    { evidenceDir: option(argv, 'evidence-dir') },
  )
  if (!result.ok) process.exitCode = 1
}
