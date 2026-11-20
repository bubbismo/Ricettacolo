import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

export default defineConfig({
  preset: {
    ...minimal2023Preset,
    maskable: { sizes: [512], padding: 0.15, resizeOptions: { background: '#FBF1DF' } },
    apple: { sizes: [180], padding: 0.08, resizeOptions: { background: '#FBF1DF' } },
  },
  images: ['public/favicon.svg'],
})
