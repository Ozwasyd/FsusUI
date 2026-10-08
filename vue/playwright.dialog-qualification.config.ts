import { defineConfig } from '@playwright/test'
import candidateConfig from './playwright.dialog-focus.config'

export default defineConfig({
  ...candidateConfig,
  testMatch: 'qualification.spec.ts',
  outputDir: '../.tmp/dialog-touch-qualification',
  projects: [
    {
      name: 'chromium-touch',
      use: { browserName: 'chromium', hasTouch: true },
    },
  ],
})
