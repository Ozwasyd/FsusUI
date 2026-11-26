#!/usr/bin/env node

import { pathToFileURL } from 'node:url'
import { loadMarkdownOwnerPlan } from './markdown-playwright-plan.mjs'
import {
  computeSuiteCellRuntime,
  executeCellWithReceipt,
  fail,
  option,
  readBrowserToolchain,
  sha256File,
  writeSuiteRuntimeManifest,
} from './lib/playwright-owner-core.mjs'

export { readBrowserToolchain, sha256File }

const MARKDOWN_FINGERPRINT_INPUTS = Object.freeze({
  'markdown-editor-interaction': [
    'vue/playwright.markdown-editor.config.ts',
    'vue/tests/markdown-editor/**',
    'vue/packages/components/markdown-editor/**',
    'vue/packages/components/markdown-renderer/**',
    'vue/packages/wasm/**',
    'vue/packages/demo-app/package.json',
    'vue/packages/demo-app/index.html',
    'vue/packages/demo-app/vite.config.ts',
    'vue/packages/demo-app/tsconfig.json',
    'vue/packages/demo-app/src/**',
  ],
})

export function createMarkdownPlaywrightEnvironment(
  identity,
  env = process.env,
) {
  if (!identity) return { ...env, CI: 'true' }
  for (const key of ['baseline', 'candidate']) {
    if (!/^[a-f0-9]{40}$/u.test(identity[key] ?? '')) {
      fail(`interaction ${key} must be an exact commit SHA`)
    }
  }
  for (const [key, expected] of [
    ['GITHUB_SHA', identity.candidate],
    ['FSUS_INTERACTION_CANDIDATE', identity.candidate],
    ['FSUS_INTERACTION_BASELINE', identity.baseline],
  ]) {
    if (env[key] !== undefined && env[key] !== expected) {
      fail(`interaction ${key} does not match verified identity`)
    }
  }
  return {
    ...env,
    CI: 'true',
    FSUS_INTERACTION_BASELINE: identity.baseline,
    FSUS_INTERACTION_CANDIDATE: identity.candidate,
  }
}

export function assertMarkdownPlaywrightCollection(parsed, result) {
  if (result.error) fail(`Playwright process failed: ${result.error.message}`)
  if (!parsed) {
    fail(
      `Playwright JSON report unavailable: ${result.stderr?.trim() || `exit ${result.status}`}`,
    )
  }
  if (parsed.errors?.length) {
    fail(
      `Playwright collection failed: ${parsed.errors.map((error) => error.message ?? error.stack).join('\n')}`,
    )
  }
}

export const computeMarkdownCellRuntime = (
  cell,
  fingerprintInputsBySuite = MARKDOWN_FINGERPRINT_INPUTS,
) =>
  computeSuiteCellRuntime(cell, fingerprintInputsBySuite, {
    runtimeMode: 'native',
    label: 'markdown',
  })

export const writeMarkdownCellRuntimeManifest = (
  cell,
  evidenceDir,
  runtime,
  manifestId = cell.suiteId,
) => writeSuiteRuntimeManifest(cell, evidenceDir, runtime, manifestId)

export async function runMarkdownCell(ownerId, cellId, group, options = {}) {
  const planLoader = options.planLoader ?? loadMarkdownOwnerPlan
  const plan = planLoader(group)
  const logPrefix = options.logPrefix ?? 'playwright-markdown'
  const evidenceDir = options.evidenceDir ?? '.tmp/playwright-markdown'

  return executeCellWithReceipt({
    ownerId,
    cellId,
    group,
    plan,
    evidenceDir,
    logPrefix,
    asyncSpawn: true,
    writeStderrLog: true,
    resolveDimensions: (cell) => ({
      browser: cell.dimensions.browser,
      viewport: cell.dimensions.viewport ?? null,
      theme: cell.dimensions.theme ?? null,
      deviceScaleFactor: null,
    }),
    prepareRuntime: async (cell) => {
      if (
        options.precomputedRuntime?.manifestDigest &&
        !options.runtimeManifestId
      ) {
        return options.precomputedRuntime
      }
      const computed =
        options.precomputedRuntime ??
        (await computeMarkdownCellRuntime(
          cell,
          options.fingerprintInputsBySuite ?? MARKDOWN_FINGERPRINT_INPUTS,
        ))
      return writeMarkdownCellRuntimeManifest(
        cell,
        evidenceDir,
        computed,
        options.runtimeManifestId?.(cell) ?? cell.suiteId,
      )
    },
    prepareEnv: () => ({
      ...createMarkdownPlaywrightEnvironment(options.interactionIdentity),
      ...(options.externalServer ? { FSUS_PLAYWRIGHT_EXTERNAL_SERVER: '1' } : {}),
      ...(options.envOverrides ?? {}),
    }),
    afterPlaywrightRun: assertMarkdownPlaywrightCollection,
    receiptExtension: options.receiptExtension,
    validateReceipt: options.validateReceipt,
  })
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const argv = process.argv.slice(2)
  if (argv[0] !== 'cell-run') {
    fail(
      'Usage: markdown-playwright-runner.mjs cell-run --owner playwright-markdown --cell <cell> --group <g> [--evidence-dir <dir>]',
    )
  }
  const cellId = option(argv, 'cell')
  if (!cellId) fail('cell-run requires --cell')
  const result = await runMarkdownCell(
    option(argv, 'owner', 'playwright-markdown'),
    cellId,
    option(argv, 'group', 'main'),
    { evidenceDir: option(argv, 'evidence-dir') },
  )
  if (!result.ok) process.exitCode = 1
}
