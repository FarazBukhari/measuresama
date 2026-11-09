import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Locator, type Page } from '@playwright/test'
import { collectErrors } from './helpers'
import { PHOTO_FIXTURE, photoFixtureBuffer } from './photoFixture'

const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

/** Screen position of an image pixel on the shown photo. */
async function toScreen(canvas: Locator, p: { x: number; y: number }) {
  const box = (await canvas.boundingBox())!
  const scale = box.width / PHOTO_FIXTURE.width
  return { x: box.x + p.x * scale, y: box.y + p.y * scale }
}

async function centre(l: Locator) {
  const b = (await l.boundingBox())!
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 }
}

async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }, during?: () => Promise<void>) {
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 4 })
  await during?.()
  await page.mouse.move(to.x, to.y, { steps: 4 })
  await page.mouse.up()
}

const cm = (text: string | null) => Number.parseFloat((text ?? '').replace(/[^\d.]/g, ''))

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (localStorage.getItem('measuresama:unit') === null) localStorage.setItem('measuresama:unit', JSON.stringify('cm'))
  })
})

test('photo measure reads a 100 mm bar from a card in the photo', async ({ page }) => {
  const errors = collectErrors(page)
  const external: string[] = []
  page.on('request', (r) => {
    const url = new URL(r.url())
    if (url.protocol.startsWith('http') && url.hostname !== 'localhost') external.push(r.url())
  })

  await page.goto('/photo')
  await expect(page.getByRole('heading', { level: 1, name: 'Photo measure' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Take photo' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Choose photo' })).toBeVisible()
  await expect(page.getByTestId('photo-input-take')).toHaveAttribute('capture', 'environment')

  const buffer = await photoFixtureBuffer(page)
  await page.getByTestId('photo-input-choose').setInputFiles({ name: 'table.png', mimeType: 'image/png', buffer })
  const canvas = page.getByTestId('photo-canvas')
  await expect(canvas).toBeVisible()
  await expect(page.getByText('Drag corners onto the card')).toBeVisible()

  // Corners onto the card; the magnifier shows while a corner is being dragged.
  for (let i = 0; i < 4; i++) {
    const handle = page.getByRole('button', { name: `Card corner ${i + 1}`, exact: true })
    const target = await toScreen(canvas, PHOTO_FIXTURE.card[i])
    await drag(page, await centre(handle), target, i === 0 ? () => expect(page.getByTestId('magnifier')).toBeVisible() : undefined)
  }
  await expect(page.getByTestId('magnifier')).toHaveCount(0)
  await expect(page.getByText('Now drag along the object')).toBeVisible()

  // Keyboard moves a corner: Shift+arrow by 10 px, arrow by 1 px.
  const first = page.getByRole('button', { name: 'Card corner 1', exact: true })
  const x0 = Number(await first.getAttribute('data-x'))
  await first.focus()
  await page.keyboard.press('Shift+ArrowRight')
  await page.keyboard.press('ArrowLeft')
  expect(Number(await first.getAttribute('data-x')) - x0).toBeCloseTo(9, 5)
  await page.keyboard.press('Shift+ArrowLeft')
  await page.keyboard.press('ArrowRight')
  expect(Number(await first.getAttribute('data-x'))).toBeCloseTo(x0, 5)

  // Draw a line along the bar.
  await drag(page, await toScreen(canvas, PHOTO_FIXTURE.bar.a), await toScreen(canvas, PHOTO_FIXTURE.bar.b))
  const label = page.getByTestId('photo-line-length')
  await expect(label).toHaveCount(1)
  await expect(label).toHaveText(/ cm$/)
  expect(Math.abs(cm(await label.textContent()) - 10)).toBeLessThanOrEqual(0.2)

  const axe = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze()
  expect(axe.violations).toEqual([])

  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page).toHaveURL(/\/history\/[\w-]+$/)
  const main = page.getByTestId('result-main')
  await expect(main).toHaveText(/ cm$/)
  expect(Math.abs(cm(await main.textContent()) - 10)).toBeLessThanOrEqual(0.2)

  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('measuresama:history') ?? 'null'))
  expect(saved.version).toBe(2)
  expect(saved.items[0]).toMatchObject({ mode: 'photo', unit: 'cm', points: [], photo: { imageWidth: 1600, imageHeight: 1000 } })
  expect(saved.items[0].photo.card).toHaveLength(4)
  expect(saved.items[0].screenshotUri).toBeUndefined()

  expect(external).toEqual([])
  expect(errors).toEqual([])
})

test('a file that is not a photo shows a short error', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto('/photo')
  await page.getByTestId('photo-input-choose').setInputFiles({ name: 'notes.png', mimeType: 'image/png', buffer: Buffer.from('not an image') })
  await expect(page.getByRole('alert')).toHaveText('Can’t open this photo')
  await expect(page.getByTestId('photo-canvas')).toHaveCount(0)
  expect(errors).toEqual([])
})

test('lines wait until the corners make a card', async ({ page }) => {
  await page.goto('/photo')
  const buffer = await photoFixtureBuffer(page)
  await page.getByTestId('photo-input-choose').setInputFiles({ name: 'table.png', mimeType: 'image/png', buffer })
  const canvas = page.getByTestId('photo-canvas')
  await expect(canvas).toBeVisible()
  // Squash two corners together: no card any more.
  const c2 = page.getByRole('button', { name: 'Card corner 2', exact: true })
  await drag(page, await centre(c2), await centre(page.getByRole('button', { name: 'Card corner 1', exact: true })))
  await expect(page.getByText('Move the corners onto the card')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Add line' })).toBeDisabled()
  await drag(page, await toScreen(canvas, PHOTO_FIXTURE.bar.a), await toScreen(canvas, PHOTO_FIXTURE.bar.b))
  await expect(page.getByTestId('photo-line-length')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeDisabled()
})
