import { defineConfig } from '@playwright/test'
import { createPlaywrightReporter } from '../scripts/test-parallelism'
import {
  createBaseUse,
  createChromiumDefaultProjects,
  resolveChromiumLaunchOptions,
  resolveServerEndpoint,
} from './playwright.shared'

const { port, baseURL } = resolveServerEndpoint('FSUS_MOTION_SSR_PORT', 5183)

export default defineConfig({
  testDir: './tests/motion-ssr',
  outputDir: 'test-results/motion-ssr',
  fullyParallel: false,
  workers: 1,
  reporter: createPlaywrightReporter('motion-ssr'),
  timeout: 180_000,
  expect: { timeout: 20_000 },
  use: createBaseUse(baseURL, {
    browserName: 'chromium',
    viewport: { width: 1280, height: 1100 },
    launchOptions: resolveChromiumLaunchOptions(),
    screenshot: 'off',
    trace: 'off',
    video: 'off',
  }),
  projects: createChromiumDefaultProjects(),
  webServer: {
    command: `node tests/motion-ssr/serve-motion-ssr.mjs --port=${port}`,
    url: `${baseURL}/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
