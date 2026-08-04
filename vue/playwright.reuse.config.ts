import { defineConfig } from '@playwright/test'
import baseConfig from './playwright.config'
import { projectsForSuite } from '../scripts/playwright-suite-projects.mjs'

export default defineConfig({
  ...baseConfig,
  outputDir: 'test-results/visual-reuse',
  projects: projectsForSuite('visual-runtime-reuse').map((cell) => ({
    name: cell.project,
    use: { browserName: cell.browser },
  })),
  webServer: undefined,
})
