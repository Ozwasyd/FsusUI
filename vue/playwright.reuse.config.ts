import { defineConfig } from '@playwright/test'
import baseConfig from './playwright.config'

export default defineConfig({
  ...baseConfig,
  outputDir: 'test-results/visual-reuse',
  webServer: undefined,
})
