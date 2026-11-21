import { defineConfig, devices } from '@playwright/test'

const baseURL = process.env.CONSUMER_CONTRACT_BASE_URL || 'http://127.0.0.1:4179'

export default defineConfig({
  testDir: './specs',
  fullyParallel: true,
  workers: 4,
  retries: 0,
  timeout: 30_000,
  expect: {
    timeout: 8_000,
  },
  reporter: [['list']],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],
})
