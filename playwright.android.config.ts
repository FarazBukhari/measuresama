import { defineConfig } from '@playwright/test'

/**
 * End-to-end tests that run inside the real Android app (the installed debug APK) on an
 * emulator or USB device, driving its WebView with Playwright. Needs `adb` on PATH and
 * `npx playwright install android`. See .github/workflows/android.yml.
 */
export default defineConfig({
  testDir: './e2e-android',
  timeout: 180_000,
  expect: { timeout: 20_000 },
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  outputDir: 'test-results/android',
  reporter: process.env.CI ? [['list'], ['html', { open: 'never', outputFolder: 'playwright-report-android' }]] : [['list']],
})
