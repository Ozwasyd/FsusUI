import { defineConfig } from '@playwright/test'
import { createPlaywrightReporter } from '../scripts/test-parallelism'
import {
  createBaseUse,
  createDemoPreviewWebServer,
  createDesktopBrowserProjects,
  resolveServerEndpoint,
} from './playwright.shared'

const { port, baseURL, useExternalServer } = resolveServerEndpoint(
  'FSUS_CONFORMANCE_INTERACTION_PORT',
  5192,
  'flag',
)

export default defineConfig({
  testDir: './tests/markdown-editor',
  testMatch: 'markdown-interaction-trace.spec.ts',
  outputDir: 'test-results/conformance-interaction',
  fullyParallel: false,
  workers: 1,
  reporter: createPlaywrightReporter('conformance-interaction'),
  timeout: 180_000,
  expect: { timeout: 20_000 },
  use: createBaseUse(baseURL, {
    viewport: { width: 1280, height: 1100 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'off',
  }),
  projects: createDesktopBrowserProjects(),
  ...(useExternalServer
    ? {}
    : { webServer: createDemoPreviewWebServer(port, baseURL) }),
})
