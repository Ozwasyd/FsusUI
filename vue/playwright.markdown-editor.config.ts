import { defineConfig } from '@playwright/test'
import { createPlaywrightReporter } from '../scripts/test-parallelism'
import {
  createBaseUse,
  createDemoPreviewWebServer,
  createDesktopBrowserProjects,
  resolveServerEndpoint,
} from './playwright.shared'

const { port, baseURL, useExternalServer } = resolveServerEndpoint(
  'FSUS_MARKDOWN_EDITOR_PORT',
  5191,
  'flag',
)

const nonChromiumIgnoredSpecs = [
  '**/markdown-editor-command-palette-ime.spec.ts',
  '**/markdown-editor-frame-scheduler.spec.ts',
]

export default defineConfig({
  testDir: './tests/markdown-editor',
  outputDir: 'test-results/markdown-editor',
  fullyParallel: false,
  workers: 1,
  reporter: createPlaywrightReporter('markdown-editor'),
  timeout: 180_000,
  expect: { timeout: 20_000 },
  use: createBaseUse(baseURL, {
    viewport: { width: 1280, height: 1100 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'off',
  }),
  projects: createDesktopBrowserProjects({
    chromium:
      process.env.FSUS_MARKDOWN_IMPORT_EVIDENCE === '1'
        ? {}
        : { grepInvert: /records the issue 395/ },
    firefox: {
      testIgnore: nonChromiumIgnoredSpecs,
      grepInvert: /records the issue 395/,
    },
    webkit: {
      testIgnore: nonChromiumIgnoredSpecs,
      grepInvert: /records the issue 395/,
    },
  }),
  ...(useExternalServer
    ? {}
    : { webServer: createDemoPreviewWebServer(port, baseURL) }),
})
