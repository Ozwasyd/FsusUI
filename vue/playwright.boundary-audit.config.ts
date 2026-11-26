import { defineConfig, devices } from '@playwright/test'
import { createPlaywrightReporter } from '../scripts/test-parallelism'
import {
  FSUS_VISUAL_VIEWPORTS,
  createBaseUse,
  createDemoDevWebServer,
  createViewportThemeMatrixProjects,
  resolveServerEndpoint,
} from './playwright.shared'

const { port, baseURL, useExternalServer } = resolveServerEndpoint(
  'FSUS_BOUNDARY_AUDIT_PORT',
  5175,
  'url',
)

export default defineConfig({
  testDir: './tests/visual-boundary',
  outputDir: 'test-results/visual-boundary',
  fullyParallel: false,
  workers: 1,
  reporter: createPlaywrightReporter('visual-boundary'),
  timeout: 600_000,
  expect: { timeout: 20_000 },
  use: createBaseUse(baseURL, { viewport: FSUS_VISUAL_VIEWPORTS.desktop }),
  projects: [
    ...createViewportThemeMatrixProjects({
      includeTiny: true,
      customize: () => ({ testIgnore: '**/safe-area-*.spec.ts' }),
    }),
    // Issue #262: safe-area geometry matrix on Chromium + WebKit.
    // Profiles set viewport size at runtime; default here is portrait phone.
    {
      name: 'safe-area-chromium',
      testMatch: '**/safe-area-*.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        colorScheme: 'light',
        viewport: FSUS_VISUAL_VIEWPORTS.safeArea,
      },
    },
    {
      name: 'safe-area-webkit',
      testMatch: '**/safe-area-*.spec.ts',
      use: {
        ...devices['Desktop Safari'],
        colorScheme: 'light',
        viewport: FSUS_VISUAL_VIEWPORTS.safeArea,
      },
    },
  ],
  ...(useExternalServer
    ? {}
    : { webServer: createDemoDevWebServer(port, baseURL) }),
})
