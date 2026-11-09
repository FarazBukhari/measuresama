import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    // Full bleed: the yellow fills the rounded corners, and the OS applies its own mask.
    maskable: { ...minimal2023Preset.maskable, padding: 0, resizeOptions: { background: '#FFC629' } },
    apple: { ...minimal2023Preset.apple, padding: 0, resizeOptions: { background: '#FFC629' } },
  },
  images: ['public/favicon.svg'],
})
