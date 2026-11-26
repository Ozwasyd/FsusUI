import { defineConfig } from '@playwright/test'
import {
  createPlaywrightReporter,
  resolveDomLayoutWorkers,
} from '../scripts/test-parallelism'
import {
  FSUS_VISUAL_VIEWPORTS,
  createBaseUse,
  createDemoPreviewWebServer,
  createViewportThemeMatrixProjects,
  resolveChromiumLaunchOptions,
  resolveServerEndpoint,
} from './playwright.shared'

const { port, baseURL, useExternalServer } = resolveServerEndpoint(
  'FSUS_DOM_LAYOUT_PORT',
  5174,
  'url',
)

export default defineConfig({
  testDir: './tests/dom-layout',
  outputDir: 'test-results/dom-layout',
  fullyParallel: true,
  workers: resolveDomLayoutWorkers(),
  reporter: createPlaywrightReporter('dom-layout'),
  timeout: 600_000,
  expect: { timeout: 20_000 },
  use: createBaseUse(baseURL, {
    launchOptions: resolveChromiumLaunchOptions(),
    viewport: FSUS_VISUAL_VIEWPORTS.desktop,
    screenshot: 'off',
    trace: 'off',
    video: 'off',
  }),
  projects: createViewportThemeMatrixProjects({
    customize: (name) =>
      name.startsWith('desktop-') ? { grepInvert: /sticky hover/ } : {},
  }),
  ...(useExternalServer
    ? {}
    : { webServer: createDemoPreviewWebServer(port, baseURL, 300_000) }),
})
