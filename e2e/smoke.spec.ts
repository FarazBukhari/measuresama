import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { collectErrors } from './helpers'

// Every main page, on desktop (light) and mobile (dark): renders an h1, no WCAG 2.2 AA
// violations (axe), no sideways scrolling and no console errors.
const PAGES: { path: string; h1: string; ready?: string }[] = [
  { path: '/', h1: 'Measure Sama' },
  { path: '/ar', h1: 'Measure a distance', ready: 'ar-fallback' },
  { path: '/ruler', h1: 'On-screen ruler', ready: 'ruler' },
  { path: '/history', h1: 'History' },
  { path: '/settings', h1: 'Settings' },
]

for (const p of PAGES) {
  test(`${p.path} renders and passes WCAG 2.2 AA`, async ({ page }) => {
    const errors = collectErrors(page)
    await page.goto(p.path)
    await expect(page.getByRole('heading', { level: 1, name: p.h1 })).toBeVisible()
    if (p.ready) await expect(page.getByTestId(p.ready).first()).toBeVisible()

    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze()
    const violations = results.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)
    expect(violations, violations.join('\n')).toEqual([])

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow, 'page scrolls sideways').toBeLessThanOrEqual(0)
    expect(errors, errors.join('\n')).toEqual([])
  })
}
