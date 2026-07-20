import { defineConfig, devices } from '@playwright/test'
import {
  createPlaywrightReporter,
  createVisualResultDirectory,
  resolveTestPort,
  resolveVisualPreviewWorkers,
} from '../scripts/test-parallelism'
import { visualEvidencePolicy } from '../scripts/visual-evidence-policy.cjs'

delete process.env.NO_COLOR

const previewPort = resolveTestPort('FSUS_VISUAL_PREVIEW_PORT', 4173)
const previewBaseUrl = `http://127.0.0.1:${previewPort}`
const evidencePolicy = visualEvidencePolicy()

export default defineConfig({
  testDir: './tests/visual',
  fullyParallel: true,
  globalTeardown: '../scripts/visual-evidence-policy.cjs',
  preserveOutput: evidencePolicy.preserveOutput,
  workers: resolveVisualPreviewWorkers(),
  retries: process.env.CI ? 2 : 0,
  reporter: createPlaywrightReporter('preview'),
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
    actionTimeout: 10_000,
    baseURL: previewBaseUrl,
    launchOptions: process.env.FSUS_PLAYWRIGHT_EXECUTABLE_PATH
      ? { executablePath: process.env.FSUS_PLAYWRIGHT_EXECUTABLE_PATH }
      : undefined,
    locale: 'zh-CN',
    screenshot: evidencePolicy.screenshot,
    timezoneId: 'Asia/Shanghai',
    trace: evidencePolicy.trace,
    colorScheme: 'light',
    viewport: { width: 1440, height: 1600 },
  },
  projects: [
    {
      name: 'desktop-light',
      outputDir: createVisualResultDirectory('preview', 'desktop-light'),
      use: {
        ...devices['Desktop Chrome'],
        colorScheme: 'light',
        viewport: { width: 1440, height: 1600 },
      },
    },
    {
      name: 'mobile-light',
      outputDir: createVisualResultDirectory('preview', 'mobile-light'),
      use: {
        ...devices['Pixel 7'],
        colorScheme: 'light',
        viewport: { width: 412, height: 1200 },
      },
    },
    {
      name: 'desktop-dark',
      outputDir: createVisualResultDirectory('preview', 'desktop-dark'),
      use: {
        ...devices['Desktop Chrome'],
        colorScheme: 'dark',
        viewport: { width: 1440, height: 1600 },
      },
    },
    {
      name: 'mobile-dark',
      outputDir: createVisualResultDirectory('preview', 'mobile-dark'),
      use: {
        ...devices['Pixel 7'],
        colorScheme: 'dark',
        viewport: { width: 412, height: 1200 },
      },
    },
  ],
  webServer: {
    command: `node ../scripts/serve-visual-runtime.mjs --suite=preview --host=127.0.0.1 --port=${previewPort}`,
    url: previewBaseUrl,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
})
