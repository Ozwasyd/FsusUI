import { defineConfig, devices } from '@playwright/test'
import {
  createPlaywrightReporter,
  resolveTestPort,
} from '../scripts/test-parallelism'

delete process.env.NO_COLOR

const port = resolveTestPort('FSUS_MARKDOWN_EDITOR_PORT', 5191)
const baseURL = `http://127.0.0.1:${port}`
const useExternalServer = process.env.FSUS_PLAYWRIGHT_EXTERNAL_SERVER === '1'

export default defineConfig({
  testDir: './tests/markdown-editor',
  outputDir: 'test-results/markdown-editor',
  fullyParallel: false,
  workers: 1,
  reporter: createPlaywrightReporter('markdown-editor'),
  timeout: 180_000,
  expect: {
    timeout: 20_000,
  },
  use: {
    baseURL,
    colorScheme: 'light',
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
    viewport: { width: 1280, height: 1100 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'off',
  },
  projects: [
    {
      name: 'chromium',
      ...(process.env.FSUS_MARKDOWN_IMPORT_EVIDENCE === '1'
        ? {}
        : { grepInvert: /records the issue 395/ }),
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      testIgnore: [
        '**/markdown-editor-command-palette-ime.spec.ts',
        '**/markdown-editor-frame-scheduler.spec.ts',
      ],
      grepInvert: /records the issue 395/,
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      testIgnore: [
        '**/markdown-editor-command-palette-ime.spec.ts',
        '**/markdown-editor-frame-scheduler.spec.ts',
      ],
      grepInvert: /records the issue 395/,
      use: { ...devices['Desktop Safari'] },
    },
  ],
  ...(useExternalServer
    ? {}
    : {
        webServer: {
          command: `pnpm -C .. run build:demo && pnpm -C packages/demo-app exec vite preview --host 127.0.0.1 --port ${port} --strictPort`,
          url: baseURL,
          reuseExistingServer: !process.env.CI,
          timeout: 180_000,
        },
      }),
})
