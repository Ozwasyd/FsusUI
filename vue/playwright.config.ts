import { defineConfig, devices } from '@playwright/test'
import {
  createPlaywrightReporter,
  resolveTestPort,
  resolveVisualPreviewWorkers,
} from '../scripts/test-parallelism'

delete process.env.NO_COLOR

const previewPort = resolveTestPort('FSUS_VISUAL_PREVIEW_PORT', 4173)
const previewBaseUrl = `http://127.0.0.1:${previewPort}`

export default defineConfig({
  testDir: './tests/visual',
  outputDir: 'test-results/visual-preview',
  fullyParallel: true,
  workers: resolveVisualPreviewWorkers(),
  retries: process.env.CI ? 2 : 0,
  reporter: createPlaywrightReporter('visual-preview'),
  timeout: 30_000,
  expect: {
    timeout: 20_000,
    toHaveScreenshot: {
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
      maxDiffPixelRatio: 0.012,
    },
  },
  use: {
    baseURL: previewBaseUrl,
    launchOptions: process.env.FSUS_PLAYWRIGHT_EXECUTABLE_PATH
      ? { executablePath: process.env.FSUS_PLAYWRIGHT_EXECUTABLE_PATH }
      : undefined,
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
    colorScheme: 'light',
    viewport: { width: 1440, height: 1600 },
  },
  projects: [
    {
      name: 'desktop-light',
      use: {
        ...devices['Desktop Chrome'],
        colorScheme: 'light',
        viewport: { width: 1440, height: 1600 },
      },
    },
    {
      name: 'mobile-light',
      use: {
        ...devices['Pixel 7'],
        colorScheme: 'light',
        viewport: { width: 412, height: 1200 },
      },
    },
    {
      name: 'desktop-dark',
      use: {
        ...devices['Desktop Chrome'],
        colorScheme: 'dark',
        viewport: { width: 1440, height: 1600 },
      },
    },
    {
      name: 'mobile-dark',
      use: {
        ...devices['Pixel 7'],
        colorScheme: 'dark',
        viewport: { width: 412, height: 1200 },
      },
    },
  ],
  webServer: {
    command: `pnpm -C .. run prepare:test-artifacts && pnpm -C packages/demo-app build && pnpm -C packages/demo-app preview --host 127.0.0.1 --port ${previewPort} --strictPort`,
    url: previewBaseUrl,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
})
