import { tmpdir } from 'node:os'
import path from 'node:path'
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: import.meta.dirname,
  testMatch: 'ordinary-table-resize-delivery.spec.ts',
  outputDir: path.join(tmpdir(), 'ordinary-table-resize-delivery-results'),
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4174',
    viewport: { width: 1440, height: 900 },
    contextOptions: { reducedMotion: 'reduce' },
    browserName: 'chromium',
    launchOptions: process.env.FSUS_PLAYWRIGHT_EXECUTABLE_PATH
      ? { executablePath: process.env.FSUS_PLAYWRIGHT_EXECUTABLE_PATH }
      : undefined,
  },
})
