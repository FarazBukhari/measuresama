import { defineConfig, devices } from '@playwright/test'

const PORT = Number(process.env.PORT ?? 4173)
// E2E_DEV=1 runs against the Vite dev server (fast iteration); default is the production build + preview.
const useDev = process.env.E2E_DEV === '1'

export default defineConfig({
  testDir: './e2e',
  outputDir: `test-results/${PORT}`,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  timeout: 30_000,
  expect: { timeout: 7_000 },
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    permissions: ['clipboard-read', 'clipboard-write'],
    // The preview build's service worker pops a "Ready to work offline" toast at a random moment, and
    // axe reports low contrast if it samples the toast mid-fade. Block the worker and skip animations.
    serviceWorkers: 'block',
    reducedMotion: 'reduce',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    // Mobile runs in dark mode so both themes are covered by the accessibility checks.
    { name: 'mobile', use: { ...devices['Pixel 7'], colorScheme: 'dark' }, testMatch: /(smoke|app)\.spec\.ts/ },
  ],
  webServer: {
    command: useDev
      ? `VITE_CACHE_DIR=node_modules/.vite-${PORT} npx vite --port ${PORT} --strictPort`
      : `npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
