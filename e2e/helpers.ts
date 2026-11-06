import type { Page } from '@playwright/test'

/**
 * Collect uncaught errors and console errors from a page. Call before navigating and
 * assert the returned array is empty at the end of the test.
 */
export function collectErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('pageerror', (err) => errors.push(err.message))
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !/Failed to load resource|net::ERR|favicon/i.test(msg.text())) errors.push(msg.text())
  })
  return errors
}
