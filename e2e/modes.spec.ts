import { expect, test, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { collectErrors } from './helpers'

// History v2 with one saved measurement per mode (values in metres, m², m³, degrees).
const P = (x: number, y: number, z: number) => ({ x, y, z })
const ROOM = [P(0, 0, 0), P(5, 0, 0), P(5, 0, 4), P(0, 0, 4)]

interface Case {
  id: string
  mode: string
  main: string
  secondary: string[]
  item: Record<string, unknown>
}

const CASES: Case[] = [
  { id: 'm-distance', mode: 'distance', main: '1.23 m', secondary: [], item: { distanceM: 1.2345, points: [P(0, 0, 0), P(1.2345, 0, 0)] } },
  {
    id: 'm-path',
    mode: 'path',
    main: '2.25 m',
    secondary: ['3'],
    item: { distanceM: 2.25, segmentsM: [0.5, 0.75, 1], points: [P(0, 0, 0), P(0.5, 0, 0), P(0.5, 0, 0.75), P(1.5, 0, 0.75)] },
  },
  {
    id: 'm-area',
    mode: 'area',
    main: '2.50 m²',
    secondary: ['6.40 m'],
    item: { areaM2: 2.5, perimeterM: 6.4, distanceM: 6.4, segmentsM: [2, 1.2, 2, 1.2], points: [P(0, 0, 0), P(2, 0, 0), P(2, 0, 1.25), P(0, 0, 1.25)] },
  },
  { id: 'm-angle', mode: 'angle', main: '90.0°', secondary: ['1.00 m', '60.0 cm'], item: { angleDeg: 90, segmentsM: [1, 0.6], points: [P(1, 0, 0), P(0, 0, 0), P(0, 0, 0.6)] } },
  { id: 'm-height', mode: 'height', main: '1.80 m', secondary: [], item: { heightM: 1.8, distanceM: 1.8, points: [P(0, 0, 0), P(0, 1.8, 0)] } },
  {
    id: 'm-volume',
    mode: 'volume',
    main: '250 L',
    secondary: ['1.00 m × 50.0 cm × 50.0 cm', '0.250 m³', '5000 cm²'],
    item: { lengthM: 1, widthM: 0.5, heightM: 0.5, areaM2: 0.5, volumeM3: 0.25, points: [P(0, 0, 0), P(1, 0, 0), P(1, 0, 0.5), P(1, 0.5, 0.5)] },
  },
  {
    id: 'm-room',
    mode: 'room-plan',
    main: '20.00 m²',
    secondary: ['18.00 m', '4', '2.40 m', '43.20 m²'],
    item: { areaM2: 20, perimeterM: 18, distanceM: 18, wallHeightM: 2.4, segmentsM: [5, 4, 5, 4], points: ROOM },
  },
  {
    id: 'm-photo',
    mode: 'photo',
    main: '10.0 cm',
    secondary: ['25.0 cm'],
    item: {
      points: [],
      distanceM: 0.1,
      photo: {
        imageWidth: 1600,
        imageHeight: 1000,
        card: [{ x: 100, y: 100 }, { x: 956, y: 100 }, { x: 956, y: 640 }, { x: 100, y: 640 }],
        lines: [
          { a: { x: 100, y: 800 }, b: { x: 1100, y: 800 }, lengthM: 0.1 },
          { a: { x: 100, y: 900 }, b: { x: 2600, y: 900 }, lengthM: 0.25 },
        ],
      },
    },
  },
]

function seedFile() {
  const items = CASES.map((c, i) => ({
    id: c.id,
    mode: c.mode,
    unit: 'cm',
    createdAt: new Date(Date.UTC(2026, 10, 1, 10, 0, 0) + i * 60_000).toISOString(),
    ...c.item,
  }))
  return { version: 2, items }
}

/** Seed once (a later reload must not bring deleted items back) and show lengths in cm. */
async function seedV2(page: Page) {
  await page.addInitScript((seed) => {
    if (localStorage.getItem('measuresama:history') === null) localStorage.setItem('measuresama:history', JSON.stringify(seed))
    if (localStorage.getItem('measuresama:unit') === null) localStorage.setItem('measuresama:unit', JSON.stringify('cm'))
  }, seedFile())
}

test('history lists one row per mode with its main value', async ({ page }) => {
  const errors = collectErrors(page)
  await seedV2(page)
  await page.goto('/history')
  const rows = page.getByTestId('history-row')
  await expect(rows).toHaveCount(CASES.length)
  for (const c of CASES) await expect(page.locator(`a[href="/history/${c.id}"]`)).toContainText(c.main)
  expect(errors).toEqual([])
})

for (const c of CASES) {
  test(`${c.mode}: detail shows the result and Share copies it`, async ({ page }) => {
    const errors = collectErrors(page)
    await seedV2(page)
    await page.goto(`/history/${c.id}`)
    await expect(page.getByRole('heading', { level: 1, name: 'Measurement' })).toBeVisible()
    await expect(page.getByTestId(c.mode === 'distance' ? 'length-main' : 'result-main')).toHaveText(c.main)
    if (c.secondary.length > 0) {
      const sec = page.getByTestId('result-secondary')
      for (const v of c.secondary) await expect(sec.locator('dd', { hasText: v }).first()).toBeVisible()
    } else if (c.mode !== 'distance') {
      await expect(page.getByTestId('result-secondary')).toHaveCount(0)
    }

    await page.getByRole('button', { name: 'Share', exact: true }).click()
    await expect(page.getByText('Copied to clipboard')).toBeVisible()
    const copied = await page.evaluate(() => navigator.clipboard.readText())
    expect(copied).toContain(c.main)
    expect(copied).toMatch(/Measured with Measure Sama$/)
    expect(errors).toEqual([])
  })
}

test('room plan: the detail draws the plan and Save PDF downloads a PDF', async ({ page }) => {
  const errors = collectErrors(page)
  await seedV2(page)
  await page.goto('/history/m-room')
  await expect(page.getByTestId('room-plan')).toBeVisible()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Save PDF' }).click()
  const file = await download
  expect(file.suggestedFilename()).toMatch(/^room-plan-\d{4}-\d{2}-\d{2}\.pdf$/)
  const path = await file.path()
  const bytes = await readFile(path)
  expect(bytes.subarray(0, 5).toString('latin1')).toBe('%PDF-')
  expect(errors).toEqual([])
})

test('CSV export has the new header and one row per mode', async ({ page }) => {
  await seedV2(page)
  await page.goto('/history')
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export CSV' }).click()
  const file = await download
  const text = await readFile((await file.path())!, 'utf8')
  const lines = text.trim().split('\r\n')
  expect(lines[0]).toBe('Date,Mode,Length (m),Result,Unit,Area (m²),Perimeter (m),Angle (°),Height (m),Width (m),Volume (m³),Wall height (m),Segments (m),Note,Photo')
  expect(lines).toHaveLength(CASES.length + 1)
  const modes = lines.slice(1).map((l) => l.split(',')[1]).sort()
  expect(modes).toEqual(CASES.map((c) => c.mode).sort())
  expect(lines.find((l) => l.includes(',room-plan,'))).toContain('20')
})

test('JSON export is version 2 with every item', async ({ page }) => {
  await seedV2(page)
  await page.goto('/history')
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export JSON' }).click()
  const file = await download
  const json = JSON.parse(await readFile((await file.path())!, 'utf8')) as { version: number; items: unknown[] }
  expect(json.version).toBe(2)
  expect(json.items).toHaveLength(CASES.length)
})

test('a version 1 history is read and saved as version 2 at the next change', async ({ page }) => {
  const errors = collectErrors(page)
  await page.addInitScript(() => {
    if (localStorage.getItem('measuresama:history') === null) {
      localStorage.setItem(
        'measuresama:history',
        JSON.stringify({
          version: 1,
          items: [{ id: 'v1', mode: 'distance', distanceM: 2, points: [{ x: 0, y: 0, z: 0 }, { x: 2, y: 0, z: 0 }], unit: 'cm', createdAt: '2026-11-01T10:00:00.000Z' }],
        }),
      )
    }
    if (localStorage.getItem('measuresama:unit') === null) localStorage.setItem('measuresama:unit', JSON.stringify('cm'))
  })
  await page.goto('/history/v1')
  await expect(page.getByTestId('length-main')).toHaveText('2.00 m')
  await page.getByLabel('Note', { exact: true }).fill('old one')
  const version = await page.evaluate(() => (JSON.parse(localStorage.getItem('measuresama:history')!) as { version: number }).version)
  expect(version).toBe(2)
  expect(errors).toEqual([])
})

const AR_MODES: { mode: string; h1: string }[] = [
  { mode: 'distance', h1: 'Measure a distance' },
  { mode: 'path', h1: 'Measure a path' },
  { mode: 'area', h1: 'Measure an area' },
  { mode: 'angle', h1: 'Measure an angle' },
  { mode: 'height', h1: 'Measure height' },
  { mode: 'volume', h1: 'Measure volume' },
  { mode: 'room-plan', h1: 'Room plan' },
]

for (const m of AR_MODES) {
  test(`/ar/${m.mode} shows the fallback and photo measure opens`, async ({ page }) => {
    const errors = collectErrors(page)
    await page.goto(`/ar/${m.mode}`)
    await expect(page.getByRole('heading', { level: 1, name: m.h1 })).toBeVisible()
    const fallback = page.getByTestId('ar-fallback')
    await expect(fallback).toBeVisible()
    await expect(fallback).toHaveAttribute('data-status', 'unsupported')
    await expect(page.getByRole('button', { name: 'Start measuring' })).toHaveCount(0)
    await fallback.getByRole('button', { name: 'Use photo measure' }).click()
    await expect(page).toHaveURL(/\/photo$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Photo measure' })).toBeVisible()
    expect(errors).toEqual([])
  })
}
