import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { collectErrors } from './helpers'

// Every main page, on desktop (light) and mobile (dark): renders an h1, no WCAG 2.2 AA
// violations (axe), no sideways scrolling and no console errors.
const PAGES: { path: string; h1: string; ready?: string; seed?: boolean }[] = [
  { path: '/', h1: 'Measure Sama' },
  { path: '/ar', h1: 'Measure a distance', ready: 'ar-fallback' },
  { path: '/ar/height', h1: 'Measure height', ready: 'ar-fallback' },
  { path: '/ar/room-plan', h1: 'Room plan', ready: 'ar-fallback' },
  { path: '/photo', h1: 'Photo measure' },
  { path: '/ruler', h1: 'On-screen ruler', ready: 'ruler' },
  { path: '/history', h1: 'History' },
  { path: '/settings', h1: 'Settings' },
  // A saved room plan (history v2, seeded once) with its SVG plan and Save PDF.
  { path: '/history/smoke-room', h1: 'Measurement', ready: 'room-plan', seed: true },
]

const ROOM_SEED = {
  version: 2,
  items: [
    {
      id: 'smoke-room',
      mode: 'room-plan',
      unit: 'cm',
      createdAt: '2026-11-01T10:00:00.000Z',
      points: [
        { x: 0, y: 0, z: 0 },
        { x: 5, y: 0, z: 0 },
        { x: 5, y: 0, z: 4 },
        { x: 0, y: 0, z: 4 },
      ],
      segmentsM: [5, 4, 5, 4],
      perimeterM: 18,
      areaM2: 20,
      wallHeightM: 2.4,
    },
  ],
}

for (const p of PAGES) {
  test(`${p.path} renders and passes WCAG 2.2 AA`, async ({ page }) => {
    const errors = collectErrors(page)
    if (p.seed) {
      await page.addInitScript((seed) => {
        if (localStorage.getItem('measuresama:history') === null) localStorage.setItem('measuresama:history', JSON.stringify(seed))
        if (localStorage.getItem('measuresama:unit') === null) localStorage.setItem('measuresama:unit', JSON.stringify('cm'))
      }, ROOM_SEED)
    }
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
