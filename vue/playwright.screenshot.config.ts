import { defineConfig, devices } from '@playwright/test'
import {
  createPlaywrightReporter,
  resolveTestPort,
} from '../scripts/test-parallelism'
import { visualProjectTestIgnore } from '../scripts/visual-variant.mjs'

const screenshotPort = resolveTestPort('FSUS_SCREENSHOT_PORT', 5173)
const screenshotBaseUrl = `http://127.0.0.1:${screenshotPort}`

export default defineConfig({
  testDir: './tests/visual',
  testMatch: ['capture-all.spec.ts', 'audit-interactive.spec.ts'],
  outputDir: 'test-results/screenshots',
  fullyParallel: true,
  reporter: createPlaywrightReporter('screenshots'),
  timeout: 60_000,
  use: {
    baseURL: screenshotBaseUrl,
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
  },
  projects: [
    {
      name: 'desktop-light',
      testIgnore: visualProjectTestIgnore('desktop-light'),
      use: {
        ...devices['Desktop Chrome'],
        colorScheme: 'light',
        viewport: { width: 1440, height: 1600 },
      },
    },
    {
      name: 'mobile-light',
      testIgnore: visualProjectTestIgnore('mobile-light'),
      use: {
        ...devices['Pixel 7'],
        colorScheme: 'light',
        viewport: { width: 412, height: 1200 },
      },
    },
    {
      name: 'desktop-dark',
      testIgnore: visualProjectTestIgnore('desktop-dark'),
      use: {
        ...devices['Desktop Chrome'],
        colorScheme: 'dark',
        viewport: { width: 1440, height: 1600 },
      },
    },
    {
      name: 'mobile-dark',
      testIgnore: visualProjectTestIgnore('mobile-dark'),
      use: {
        ...devices['Pixel 7'],
        colorScheme: 'dark',
        viewport: { width: 412, height: 1200 },
      },
    },
  ],
  webServer: {
    command: `pnpm -C .. run ensure:wasm && pnpm -C packages/demo-app exec vite --host 127.0.0.1 --port ${screenshotPort} --strictPort`,
    url: screenshotBaseUrl,
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
