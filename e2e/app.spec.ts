import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { collectErrors } from './helpers'

const SEED = {
  version: 1,
  items: [
    {
      id: 'seed-1',
      mode: 'distance',
      distanceM: 1.2345,
      points: [
        { x: 0, y: 0, z: 0 },
        { x: 1.2345, y: 0, z: 0 },
      ],
      unit: 'cm',
      createdAt: '2026-11-01T10:00:00.000Z',
    },
  ],
}

/** Seed history once (a later reload or deletion must not bring it back) and show lengths in cm. */
async function seedHistory(page: Page) {
  await page.addInitScript((seed) => {
    if (localStorage.getItem('measuresama:history') === null) localStorage.setItem('measuresama:history', JSON.stringify(seed))
    if (localStorage.getItem('measuresama:unit') === null) localStorage.setItem('measuresama:unit', JSON.stringify('cm'))
  }, SEED)
}

test('home lists the available modes and the ones coming soon', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto('/')
  const cards = page.getByTestId('mode-card')
  await expect(cards).toHaveCount(9)
  await expect(page.locator('[data-testid="mode-card"][data-status="available"]')).toHaveText([/Distance/, /On-screen ruler/])
  const soon = page.locator('[data-testid="mode-card"][data-status="coming-soon"]')
  await expect(soon).toHaveCount(7)
  for (const name of ['Height', 'Angle', 'Path', 'Area & perimeter', 'Volume', 'Room plan + PDF', 'Photo measure']) {
    await expect(soon.filter({ hasText: name }).getByText('Coming soon', { exact: true })).toBeVisible()
  }
  // Coming-soon cards are not links or buttons.
  await expect(soon.locator('a, button')).toHaveCount(0)

  await page.getByRole('link', { name: /On-screen ruler/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'On-screen ruler' })).toBeVisible()
  expect(errors).toEqual([])
})

test('AR page falls back to the on-screen ruler in the browser', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto('/')
  await page.getByRole('link', { name: /Distance/ }).click()
  const fallback = page.getByTestId('ar-fallback')
  await expect(fallback).toBeVisible()
  await expect(fallback).toHaveAttribute('data-status', 'unsupported')
  await expect(fallback.getByRole('heading', { name: 'AR isn’t available on this phone' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Start measuring' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Install it' })).toHaveCount(0)
  await fallback.getByRole('button', { name: 'Use the on-screen ruler' }).click()
  await expect(page).toHaveURL(/\/ruler$/)
  await expect(page.getByRole('heading', { level: 1, name: 'On-screen ruler' })).toBeVisible()
  expect(errors).toEqual([])
})

test.describe('unit setting', () => {
  // US English defaults to inches, so picking centimetres is a real change that only storage can bring back.
  test.use({ locale: 'en-US' })

  test('the unit setting is remembered after a reload', async ({ page }) => {
    const errors = collectErrors(page)
    await page.goto('/settings')
    const cm = page.getByLabel('Centimetres (cm)', { exact: true })
    const inches = page.getByLabel('Inches (in)', { exact: true })
    await expect(inches).toBeChecked()
    await cm.check()
    await expect(cm).toBeChecked()
    expect(await page.evaluate(() => localStorage.getItem('measuresama:unit'))).toBe('"cm"')
    await page.reload()
    await expect(cm).toBeChecked()
    await expect(inches).not.toBeChecked()
    expect(errors).toEqual([])
  })
})

test('history shows a saved measurement, its detail, and deletes it', async ({ page }) => {
  const errors = collectErrors(page)
  await seedHistory(page)
  await page.goto('/history')
  const rows = page.getByTestId('history-row')
  await expect(rows).toHaveCount(1)
  await expect(rows.first()).toContainText('1.23 m')

  await rows.first().click()
  await expect(page).toHaveURL(/\/history\/seed-1$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Measurement' })).toBeVisible()
  await expect(page.getByTestId('length-main')).toHaveText('1.23 m')
  await expect(page.getByTestId('length-other')).toHaveText('4 ft 0.6 in')
  await page.getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Yes, delete' })).toBeVisible()
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze()
  expect(axe.violations.map((v) => v.id)).toEqual([])
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()

  // Notes are saved as you type.
  await page.getByLabel('Note', { exact: true }).fill('Hallway, wall to door')
  await page.reload()
  await expect(page.getByLabel('Note', { exact: true })).toHaveValue('Hallway, wall to door')

  await page.getByRole('button', { name: 'Delete', exact: true }).click()
  await page.getByRole('button', { name: 'Yes, delete' }).click()
  await expect(page).toHaveURL(/\/history$/)
  await expect(page.getByText('No measurements yet')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Measure something' })).toBeVisible()
  await page.reload()
  await expect(page.getByText('No measurements yet')).toBeVisible()
  expect(errors).toEqual([])
})

test('history exports CSV as a download in the browser', async ({ page }) => {
  await seedHistory(page)
  await page.goto('/history')
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export CSV' }).click()
  const file = await download
  expect(file.suggestedFilename()).toMatch(/^measure-sama-\d{4}-\d{2}-\d{2}\.csv$/)
})

test('full-screen ruler opens and Escape closes it', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto('/ruler')
  await page.getByRole('button', { name: 'Full-screen ruler' }).click()
  const dialog = page.getByRole('dialog', { name: 'Full-screen ruler' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText('Estimate: not checked with a card')).toBeVisible()
  await expect(dialog.getByRole('slider', { name: 'Marker B' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await page.getByRole('button', { name: 'Full-screen ruler' }).click()
  await dialog.getByRole('button', { name: 'Close ruler' }).click()
  await expect(dialog).toBeHidden()
  expect(errors).toEqual([])
})

test('the ruler asks for a card check until one is saved, and Settings can ask again', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto('/ruler')
  const prompt = page.getByTestId('card-prompt')
  await expect(prompt.getByRole('heading', { name: 'Check the size with a bank card' })).toBeVisible()
  await expect(page.getByText('Estimate', { exact: true })).toBeVisible()

  await prompt.getByRole('button', { name: 'Start card check' }).click()
  const dialog = page.getByRole('dialog', { name: 'Card check' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Make outline larger' }).click()
  await dialog.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(dialog).toBeHidden()
  await expect(prompt).toHaveCount(0)
  await expect(page.getByText('Checked', { exact: true })).toBeVisible()
  await expect(page.getByTestId('scale-source')).toHaveAttribute('data-source', 'card')

  await page.reload()
  await expect(page.getByText('Checked', { exact: true })).toBeVisible()
  await expect(page.getByTestId('card-prompt')).toHaveCount(0)

  await page.getByRole('link', { name: 'Settings' }).click()
  await page.getByRole('button', { name: 'Recalibrate on-screen ruler' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'On-screen ruler' })).toBeVisible()
  await expect(page.getByTestId('card-prompt')).toBeVisible()
  expect(errors).toEqual([])
})

test('bottom navigation and the not-found page', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto('/nowhere')
  await expect(page.getByRole('heading', { level: 1, name: 'We can’t find that page' })).toBeVisible()
  const nav = page.getByRole('navigation', { name: 'Main' })
  await nav.getByRole('link', { name: 'History' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'History' })).toBeVisible()
  await expect(nav.getByRole('link', { name: 'History' })).toHaveAttribute('aria-current', 'page')
  await nav.getByRole('link', { name: 'Settings' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible()
  await nav.getByRole('link', { name: 'Home' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Measure Sama' })).toBeVisible()
  expect(errors).toEqual([])
})
