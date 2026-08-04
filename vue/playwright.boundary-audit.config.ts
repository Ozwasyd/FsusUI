import { defineConfig, devices } from '@playwright/test'
import { projectsForSuite } from '../scripts/playwright-suite-projects.mjs'
import {
  createPlaywrightReporter,
  resolveTestPort,
} from '../scripts/test-parallelism'

delete process.env.NO_COLOR

const boundaryAuditPort = resolveTestPort('FSUS_BOUNDARY_AUDIT_PORT', 5175)
const boundaryAuditBaseUrl = `http://127.0.0.1:${boundaryAuditPort}`

export default defineConfig({
  testDir: './tests/visual-boundary',
  outputDir: 'test-results/visual-boundary',
  fullyParallel: false,
  workers: 1,
  reporter: createPlaywrightReporter('visual-boundary'),
  timeout: 600_000,
  expect: {
    timeout: 20_000,
  },
  use: {
    baseURL: boundaryAuditBaseUrl,
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
    colorScheme: 'light',
    viewport: { width: 1440, height: 1600 },
  },
  projects: projectsForSuite('visual-boundary-audit').map((cell) => ({
    name: cell.project,
    ...(cell.safeArea
      ? { testMatch: '**/safe-area-*.spec.ts' }
      : { testIgnore: '**/safe-area-*.spec.ts' }),
    use: {
      ...(cell.browser === 'webkit'
        ? devices['Desktop Safari']
        : cell.viewport === 'mobile' || cell.viewport === 'tiny'
          ? devices['Pixel 7']
          : devices['Desktop Chrome']),
      colorScheme: cell.theme,
      viewport:
        cell.viewport === 'tiny'
          ? { width: 320, height: 900 }
          : cell.viewport === 'mobile'
            ? { width: cell.safeArea ? 390 : 412, height: cell.safeArea ? 844 : 1200 }
            : { width: 1440, height: 1600 },
    },
  })),
  webServer: {
    command:
      `pnpm -C .. run ensure:wasm && pnpm -C packages/demo-app exec vite --host 127.0.0.1 --port ${boundaryAuditPort} --strictPort`,
    url: boundaryAuditBaseUrl,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
