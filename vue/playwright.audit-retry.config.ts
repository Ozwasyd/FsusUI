import { defineConfig, devices } from '@playwright/test'
import {
  createVisualResultDirectory,
  resolveVisualPreviewWorkers,
} from '../scripts/test-parallelism'
import {
  createBaseUse,
  createVisualRuntimeWebServer,
  resolveChromiumLaunchOptions,
  resolveServerEndpoint,
} from './playwright.shared'

const { port, baseURL } = resolveServerEndpoint(
  'FSUS_VISUAL_AUDIT_RETRY_PORT',
  4373,
)

export default defineConfig({
  testDir: './tests/visual-retry',
  fullyParallel: true,
  outputDir: createVisualResultDirectory('audit-retry', 'desktop-light'),
  workers: Math.min(2, resolveVisualPreviewWorkers()),
  retries: 1,
  reporter: [['list'], ['../scripts/visual-audit-retry-reporter.cjs']],
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: createBaseUse(baseURL, {
    ...devices['Desktop Chrome'],
    launchOptions: resolveChromiumLaunchOptions(),
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    viewport: { width: 1440, height: 1200 },
  }),
  webServer: createVisualRuntimeWebServer('preview', port, baseURL, {
    reuseExistingServer: false,
    timeout: 120_000,
  }),
})
