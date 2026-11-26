import { defineConfig } from '@playwright/test'
import {
  createPlaywrightReporter,
  resolvePlaywrightWorkers,
} from '../scripts/test-parallelism'
import {
  createBaseUse,
  createDemoDevWebServer,
  createDesktopBrowserProjects,
  resolveChromiumLaunchOptions,
  resolveServerEndpoint,
} from './playwright.shared'

const { port, baseURL } = resolveServerEndpoint(
  'FSUS_VIEW_TRANSITION_PORT',
  4187,
)
const detectedWorkers = resolvePlaywrightWorkers()

export default defineConfig({
  testDir: './tests/view-transitions',
  outputDir: 'test-results/view-transitions',
  fullyParallel: true,
  workers: Math.max(1, Math.ceil(detectedWorkers / 2)),
  retries: process.env.CI ? 1 : 0,
  reporter: createPlaywrightReporter('view-transitions'),
  timeout: 90_000,
  use: createBaseUse(baseURL, {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  }),
  projects: createDesktopBrowserProjects({
    chromium: { use: { launchOptions: resolveChromiumLaunchOptions() } },
    firefox: { grepInvert: /Chromium CPU profiles/ },
    webkit: { grepInvert: /Chromium CPU profiles/ },
  }),
  webServer: createDemoDevWebServer(port, baseURL, { ensureWasm: false }),
})
