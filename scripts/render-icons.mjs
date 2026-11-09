// Renders the source artwork in assets/icon.svg into the PNGs that @capacitor/assets expects.
// Run: node scripts/render-icons.mjs   (needs `sharp`, installed with @capacitor/assets)
// Then: npx capacitor-assets generate --android --ios
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const svg = await readFile(join(root, 'assets/icon.svg'), 'utf8')
const art = svg.match(/<g id="art"[\s\S]*?<\/g>/)?.[0]
if (!art) throw new Error('assets/icon.svg must contain <g id="art">')

// Brand colours (design-system/measure-sama/MASTER.md): tape yellow, and the light and dark app grounds.
const TAPE = '#FFC629'
const GROUND_LIGHT = '#F4F4F1'
const GROUND_DARK = '#0F0F0F'

const wrap = (size, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">${body}</svg>`
// The LogoMark tile: a yellow square with 25% rounded corners (as in Logo.tsx), ticks clipped to it.
const tile = (size, scale, bg) => {
  const side = size * scale
  const off = (size - side) / 2
  return `<rect width="${size}" height="${size}" fill="${bg}"/>
  <svg x="${off}" y="${off}" width="${side}" height="${side}" viewBox="0 0 1024 1024">
    <clipPath id="tile"><rect width="1024" height="1024" rx="256"/></clipPath>
    <g clip-path="url(#tile)"><rect width="1024" height="1024" fill="${TAPE}"/>${art}</g>
  </svg>`
}

const out = (name, markup, size) => sharp(Buffer.from(wrap(size, markup))).png().toFile(join(root, 'assets', name))

// Full bleed: iOS and the Android launchers mask the corners themselves. The ticks hang from the top edge,
// so whatever the mask shape, they stay attached to it.
await out('icon-only.png', `<rect width="1024" height="1024" fill="${TAPE}"/>${art}`, 1024)
// Adaptive icon: @capacitor/assets insets both layers by 16.7%, so this canvas is exactly the visible area.
await out('icon-foreground.png', art, 1024)
await out('icon-background.png', `<rect width="1024" height="1024" fill="${TAPE}"/>`, 1024)
await out('splash.png', tile(2732, 0.28, GROUND_LIGHT), 2732)
await out('splash-dark.png', tile(2732, 0.28, GROUND_DARK), 2732)
console.log('Rendered assets/*.png')
