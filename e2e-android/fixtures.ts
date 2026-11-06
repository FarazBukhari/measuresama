import { _android, test as base, expect, type AndroidDevice, type Page } from '@playwright/test'

export const PKG = 'com.foxysama.measuresama'
export const SAVE_DIR = '/sdcard/Documents/Measure Sama'

/** Errors the app logged; tests assert this stays empty. */
type Errors = string[]

export const test = base.extend<{ app: Page; errors: Errors }, { device: AndroidDevice }>({
  device: [
    async ({}, provide) => {
      const [device] = await _android.devices()
      if (!device) throw new Error('No Android device or emulator found (check `adb devices`).')
      // Pre-grant runtime permissions so no system dialog blocks the WebView.
      for (const p of ['CAMERA']) await device.shell(`pm grant ${PKG} android.permission.${p}`).catch(() => undefined)
      await device.shell(`rm -rf '${SAVE_DIR}'`)
      await provide(device)
      await device.close()
    },
    { scope: 'worker' },
  ],
  errors: async ({}, provide) => {
    await provide([])
  },
  app: async ({ device, errors }, provide) => {
    await device.shell(`am force-stop ${PKG}`)
    await device.shell(`am start -W -n ${PKG}/.MainActivity`)
    const webview = await device.webView({ pkg: PKG }, { timeout: 60_000 })
    const page = await webview.page()
    page.on('pageerror', (e) => errors.push(e.message))
    page.on('console', (m) => {
      if (m.type() === 'error' && !/Failed to load resource|net::ERR/i.test(m.text())) errors.push(m.text())
    })
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 60_000 })
    await provide(page)
  },
})

export { expect }

/** In-app navigation without a reload (the same thing a tap on a link does). */
export async function go(page: Page, path: string): Promise<void> {
  await page.evaluate((p) => {
    window.history.pushState(null, '', p)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, path)
}

/** True when the app saved a file with this exact name. */
export async function savedFileExists(device: AndroidDevice, name: string): Promise<boolean> {
  return (await device.shell(`test -f '${SAVE_DIR}/${name}' && echo yes || echo no`)).toString().trim() === 'yes'
}

/** Read a file the app saved, straight from the device's storage. */
export async function savedFile(device: AndroidDevice, name: string): Promise<Buffer> {
  return device.shell(`cat '${SAVE_DIR}/${name}'`)
}
