import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  testMatch: 'customer-journey-isolated.spec.ts',
  outputDir: 'test-results/isolated-customer-journey',
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: process.env.ISOLATED_CLIENT_URL ?? 'http://127.0.0.1:15175',
    trace: 'on',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 5'] } },
  ],
  // This is deliberately a dedicated loopback Vite process. API calls are
  // fulfilled by the test fixture, so neither development nor staging data is
  // reachable during the journey.
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 15175 --strictPort',
    url: 'http://127.0.0.1:15175',
    reuseExistingServer: false,
    timeout: 30_000,
  },
})
