import { setPhotoFixtureInPage } from '../e2e/photoFixture'
import { expect, go, PKG, test } from './fixtures'

// These run inside the installed Android app (its WebView) on the CI emulator, where Google
// Play Services for AR is not installed. Never tap "Install it" or "Start measuring" here.

const back = (device: { shell: (cmd: string) => Promise<Buffer> }) => device.shell('input keyevent 4')

test('the app launches on the home page', async ({ app, errors }) => {
  await expect(app.getByRole('heading', { level: 1, name: 'Measure Sama' })).toBeVisible()
  await expect(app.getByTestId('mode-card')).toHaveCount(9)
  // Every mode is built, so none is marked coming soon.
  await expect(app.locator('[data-testid="mode-card"][data-status="available"]')).toHaveCount(9)
  const overflow = await app.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow, 'page scrolls sideways').toBeLessThanOrEqual(0)
  expect(errors).toEqual([])
})

test('on-screen ruler reads the display density and back closes the full-screen ruler', async ({ app, device, errors }) => {
  await go(app, '/ruler')
  await expect(app.getByRole('heading', { level: 1, name: 'On-screen ruler' })).toBeVisible()
  // The app-local ScreenMetrics plugin answers, so the scale comes from the display itself.
  await app.getByText('Screen details', { exact: true }).click()
  const source = app.getByTestId('scale-source')
  await expect(source).toBeVisible()
  await expect(source).toHaveAttribute('data-source', 'android-display')
  await expect(source).toHaveText(/^Your phone’s display report/)
  await expect(app.getByText(/^\d+ pixels per inch \(ppi\)$/)).toBeVisible()

  await app.getByRole('button', { name: 'Full-screen ruler' }).click()
  const dialog = app.getByRole('dialog', { name: 'Full-screen ruler' })
  await expect(dialog).toBeVisible()
  await back(device)
  await expect(dialog).toBeHidden()
  await expect(app.getByRole('heading', { level: 1, name: 'On-screen ruler' })).toBeVisible()
  expect(errors).toEqual([])
})

test('history starts empty', async ({ app, errors }) => {
  await go(app, '/history')
  await expect(app.getByRole('heading', { level: 1, name: 'History' })).toBeVisible()
  await expect(app.getByText('No measurements yet')).toBeVisible()
  await expect(app.getByRole('button', { name: 'Measure something' })).toBeVisible()
  expect(errors).toEqual([])
})

test.describe('unit setting', () => {
  // The second test relaunches the app (the `app` fixture force-stops it) and expects the choice to stick.
  // The emulator is US English, which defaults to inches, so pick centimetres: only storage can bring it back.
  test.describe.configure({ mode: 'serial' })

  test('switch to centimetres', async ({ app, errors }) => {
    await go(app, '/settings')
    const cm = app.getByLabel('Centimetres (cm)', { exact: true })
    await cm.check()
    await expect(cm).toBeChecked()
    expect(await app.evaluate(() => localStorage.getItem('measuresama:unit'))).toBe('"cm"')
    // No waiting on purpose: the next test force-stops the app within a second or two. The
    // WebView alone needs about 5 s to commit localStorage; the native store must survive this.
    expect(errors).toEqual([])
  })

  test('still centimetres after a relaunch', async ({ app, errors }) => {
    expect(await app.evaluate(() => localStorage.getItem('measuresama:unit'))).toBe('"cm"')
    await go(app, '/settings')
    await expect(app.getByLabel('Centimetres (cm)', { exact: true })).toBeChecked()
    await expect(app.getByLabel('Inches (in)', { exact: true })).not.toBeChecked()
    // Leave the device as we found it: no saved unit, in the WebView or the native store.
    await app.evaluate(async () => {
      type Prefs = { remove(options: { key: string }): Promise<void> }
      const { Capacitor } = window as unknown as { Capacitor: { Plugins: { Preferences: Prefs } } }
      await Capacitor.Plugins.Preferences.remove({ key: 'measuresama:unit' })
      localStorage.removeItem('measuresama:unit')
    })
    expect(errors).toEqual([])
  })
})

test('back from Settings returns to the home page instead of closing the app', async ({ app, device, errors }) => {
  await app.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Settings' }).click()
  await expect(app.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible()
  await back(device)
  await expect(app.getByRole('heading', { level: 1, name: 'Measure Sama' })).toBeVisible()
  const focused = (await device.shell('dumpsys activity activities | grep -E "mResumedActivity|topResumedActivity"')).toString()
  expect(focused).toContain(PKG)
  expect(errors).toEqual([])
})

test('AR distance falls back to the on-screen ruler on a phone without AR', async ({ app, errors }) => {
  await app.getByRole('link', { name: /Distance/ }).click()
  await expect(app.getByRole('heading', { level: 1, name: 'Measure a distance' })).toBeVisible()
  // Any status except "supported" (unsupported, unknown, needs-install, needs-update) shows the fallback.
  // The native check can take up to 10 s before it settles.
  const fallback = app.getByTestId('ar-fallback')
  await expect(fallback).toBeVisible({ timeout: 30_000 })
  await expect(app.getByRole('button', { name: 'Start measuring' })).toHaveCount(0)
  await fallback.getByRole('button', { name: 'Use the on-screen ruler' }).click()
  await expect(app.getByRole('heading', { level: 1, name: 'On-screen ruler' })).toBeVisible()
  expect(errors).toEqual([])
})

// Every AR mode opens its own page. The emulator has no ARCore, so each shows the fallback and
// never a start button (the plugin's start() is never called here).
const AR_MODES = [
  { mode: 'distance', h1: 'Measure a distance' },
  { mode: 'path', h1: 'Measure a path' },
  { mode: 'area', h1: 'Measure an area' },
  { mode: 'angle', h1: 'Measure an angle' },
  { mode: 'height', h1: 'Measure height' },
  { mode: 'volume', h1: 'Measure volume' },
  { mode: 'room-plan', h1: 'Room plan' },
]

for (const m of AR_MODES) {
  test(`AR ${m.mode} page shows the fallback on a phone without AR`, async ({ app, errors }) => {
    await go(app, `/ar/${m.mode}`)
    await expect(app.getByRole('heading', { level: 1, name: m.h1 })).toBeVisible()
    await expect(app.getByTestId('ar-fallback')).toBeVisible({ timeout: 30_000 })
    await expect(app.getByRole('button', { name: 'Start measuring' })).toHaveCount(0)
    expect(errors).toEqual([])
  })
}

test('photo measure loads a photo and shows the four card corners', async ({ app, errors }) => {
  await go(app, '/photo')
  await expect(app.getByRole('heading', { level: 1, name: 'Photo measure' })).toBeVisible()
  // The file is built inside the WebView (setInputFiles can't reach host files from here).
  await setPhotoFixtureInPage(app, '[data-testid="photo-input-choose"]')
  await expect(app.getByTestId('photo-canvas')).toBeVisible({ timeout: 30_000 })
  for (let i = 1; i <= 4; i++) await expect(app.getByRole('button', { name: `Card corner ${i}`, exact: true })).toBeVisible()
  // Not checked here: the 10.0 cm reading. It needs the four corners dragged onto the card, and
  // pointer drags through CDP are not reliable in the WebView. The web e2e (e2e/photo.spec.ts)
  // covers the reading; this test covers photo loading in the real WebView.
  expect(errors).toEqual([])
})
