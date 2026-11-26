import { defineConfig } from '@playwright/test'
import {
  createPlaywrightReporter,
  createVisualResultDirectory,
  resolveVisualPreviewWorkers,
} from '../scripts/test-parallelism'
import { visualEvidencePolicy } from '../scripts/visual-evidence-policy.cjs'
import {
  visualProjectGrepInvert,
  visualProjectTestIgnore,
} from '../scripts/visual-variant.mjs'
import {
  FSUS_VISUAL_VIEWPORTS,
  createBaseUse,
  createViewportThemeMatrixProjects,
  createVisualRuntimeWebServer,
  resolveChromiumLaunchOptions,
  resolveServerEndpoint,
} from './playwright.shared'

const { port, baseURL, useExternalServer } = resolveServerEndpoint(
  'FSUS_VISUAL_PREVIEW_PORT',
  4173,
  'url',
)
const evidencePolicy = visualEvidencePolicy()

export default defineConfig({
  testDir: './tests/visual',
  fullyParallel: true,
  globalTeardown: '../scripts/visual-evidence-policy.cjs',
  preserveOutput: evidencePolicy.preserveOutput,
  workers: resolveVisualPreviewWorkers(),
  retries: process.env.CI ? 2 : 0,
  reporter: createPlaywrightReporter('preview'),
  timeout: 30_000,
  expect: {
    timeout: 20_000,
    toHaveScreenshot: {
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
      maxDiffPixelRatio: 0.012,
    },
  },
  use: createBaseUse(baseURL, {
    actionTimeout: 10_000,
    launchOptions: resolveChromiumLaunchOptions(),
    screenshot: evidencePolicy.screenshot,
    trace: evidencePolicy.trace,
    viewport: FSUS_VISUAL_VIEWPORTS.desktop,
  }),
  projects: createViewportThemeMatrixProjects({
    customize: (projectName) => ({
      outputDir: createVisualResultDirectory('preview', projectName),
      grepInvert: visualProjectGrepInvert(projectName),
      testIgnore: visualProjectTestIgnore(projectName),
    }),
  }),
  ...(useExternalServer
    ? {}
    : { webServer: createVisualRuntimeWebServer('preview', port, baseURL) }),
})
