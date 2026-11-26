import { defineConfig } from '@playwright/test'
import { createPlaywrightReporter } from '../scripts/test-parallelism'
import {
  visualProjectGrepInvert,
  visualProjectTestIgnore,
} from '../scripts/visual-variant.mjs'
import {
  createBaseUse,
  createDemoDevWebServer,
  createViewportThemeMatrixProjects,
  resolveServerEndpoint,
} from './playwright.shared'

const { port, baseURL } = resolveServerEndpoint('FSUS_SCREENSHOT_PORT', 5173)

export default defineConfig({
  testDir: './tests/visual',
  testMatch: ['capture-all.spec.ts', 'audit-interactive.spec.ts'],
  outputDir: 'test-results/screenshots',
  fullyParallel: true,
  reporter: createPlaywrightReporter('screenshots'),
  timeout: 60_000,
  use: createBaseUse(baseURL),
  projects: createViewportThemeMatrixProjects({
    customize: (projectName) => ({
      grepInvert: visualProjectGrepInvert(projectName),
      testIgnore: visualProjectTestIgnore(projectName),
    }),
  }),
  webServer: createDemoDevWebServer(port, baseURL, {
    reuseExistingServer: true,
  }),
})
