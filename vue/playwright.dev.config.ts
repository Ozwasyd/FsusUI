import { defineConfig, devices } from '@playwright/test'
import {
  createPlaywrightReporter,
  createVisualResultDirectory,
  resolveVisualDevWorkers,
} from '../scripts/test-parallelism'
import { visualEvidencePolicy } from '../scripts/visual-evidence-policy.cjs'
import {
  FSUS_VISUAL_VIEWPORTS,
  createBaseUse,
  createVisualRuntimeWebServer,
  resolveChromiumLaunchOptions,
  resolveServerEndpoint,
} from './playwright.shared'

const { port, baseURL } = resolveServerEndpoint('FSUS_VISUAL_DEV_PORT', 5173)
const evidencePolicy = visualEvidencePolicy()

export default defineConfig({
  testDir: './tests/demo-app-dev',
  outputDir: createVisualResultDirectory('dev', 'default'),
  fullyParallel: false,
  globalTeardown: '../scripts/visual-evidence-policy.cjs',
  preserveOutput: evidencePolicy.preserveOutput,
  workers: resolveVisualDevWorkers(),
  retries: process.env.CI ? 2 : 0,
  reporter: createPlaywrightReporter('dev'),
  timeout: 60_000,
  expect: { timeout: 20_000 },
  use: createBaseUse(baseURL, {
    ...devices['Desktop Chrome'],
    launchOptions: resolveChromiumLaunchOptions(),
    screenshot: evidencePolicy.screenshot,
    trace: evidencePolicy.trace,
    viewport: FSUS_VISUAL_VIEWPORTS.desktop,
  }),
  webServer: createVisualRuntimeWebServer('dev', port, baseURL),
})
