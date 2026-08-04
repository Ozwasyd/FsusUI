import { defineConfig, devices } from '@playwright/test'
import { projectsForSuite } from '../scripts/playwright-suite-projects.mjs'
import {
  createPlaywrightReporter,
  resolveTestPort,
} from '../scripts/test-parallelism'

delete process.env.NO_COLOR

const port = resolveTestPort('FSUS_MARKDOWN_EDITOR_PORT', 5191)
const baseURL = `http://127.0.0.1:${port}`

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
  projects: projectsForSuite('markdown-editor-interaction').map((cell) => ({
    name: cell.project,
    use:
      cell.browser === 'chromium'
        ? { ...devices['Desktop Chrome'] }
        : cell.browser === 'firefox'
          ? { ...devices['Desktop Firefox'] }
          : { ...devices['Desktop Safari'] },
  })),
  webServer: {
    command: `pnpm -C .. run build:demo && pnpm -C packages/demo-app exec vite preview --host 127.0.0.1 --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
