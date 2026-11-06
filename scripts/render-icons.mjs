// Renders the source artwork in assets/icon.svg into the PNGs that @capacitor/assets expects.
// Run: node scripts/render-icons.mjs   (needs `sharp`, installed with @capacitor/assets)
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const svg = await readFile(join(root, 'assets/icon.svg'), 'utf8')
const art = svg.match(/<g id="art">[\s\S]*<\/g>(?=\s*<\/svg>)/)?.[0]
if (!art) throw new Error('assets/icon.svg must contain <g id="art">')

const INDIGO = '#3730A3'
const wrap = (size, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">${body}</svg>`
// Artwork is drawn on a 1024 grid; place it at `scale` around the centre of a `size` canvas.
const place = (size, scale) => {
  const k = (size / 1024) * scale
  return `<g transform="translate(${size / 2} ${size / 2}) scale(${k}) translate(-512 -512)">${art}</g>`
}
// A rounded indigo tile with the artwork on it, for the splash screens.
const tile = (size, scale, bg) => {
  const side = size * scale
  const off = (size - side) / 2
  return `<rect width="${size}" height="${size}" fill="${bg}"/>
  <svg x="${off}" y="${off}" width="${side}" height="${side}" viewBox="0 0 1024 1024"><rect width="1024" height="1024" rx="224" fill="${INDIGO}"/>${art}</svg>`
}

const out = (name, markup, size) => sharp(Buffer.from(wrap(size, markup))).png().toFile(join(root, 'assets', name))

await out('icon-only.png', `<rect width="1024" height="1024" fill="${INDIGO}"/>${place(1024, 1)}`, 1024)
// Adaptive icon: the launcher masks the outer third, so keep the artwork in the middle.
await out('icon-foreground.png', place(1024, 0.62), 1024)
await out('icon-background.png', `<rect width="1024" height="1024" fill="${INDIGO}"/>`, 1024)
await out('splash.png', tile(2732, 0.28, '#F5F7FF'), 2732)
await out('splash-dark.png', tile(2732, 0.28, '#0B1020'), 2732)
console.log('Rendered assets/*.png')
