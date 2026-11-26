import { defineConfig } from '@playwright/test'
import { createPlaywrightReporter } from '../scripts/test-parallelism'
import {
  FSUS_VISUAL_VIEWPORTS,
  createBaseUse,
  createChromiumDefaultProjects,
  createDemoPreviewWebServer,
  resolveChromiumLaunchOptions,
  resolveServerEndpoint,
} from './playwright.shared'

const { port, baseURL, useExternalServer } = resolveServerEndpoint(
  'FSUS_GEOMETRY_PORT',
  5177,
  'url',
)

export default defineConfig({
  testDir: './tests/geometry',
  outputDir: 'test-results/geometry',
  fullyParallel: false,
  workers: 1,
  reporter: createPlaywrightReporter('geometry'),
  timeout: 180_000,
  expect: { timeout: 20_000 },
  use: createBaseUse(baseURL, {
    browserName: 'chromium',
    viewport: FSUS_VISUAL_VIEWPORTS.desktop,
    launchOptions: resolveChromiumLaunchOptions(),
    screenshot: 'off',
    trace: 'off',
    video: 'off',
  }),
  projects: createChromiumDefaultProjects(),
  ...(useExternalServer
    ? {}
    : { webServer: createDemoPreviewWebServer(port, baseURL, 300_000) }),
})
