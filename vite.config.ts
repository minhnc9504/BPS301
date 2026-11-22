import { defineConfig } from 'vite'
import { bps301Materials } from './scripts/materials-manifest.mjs'

export default defineConfig(({ command, isPreview }) => ({
  plugins: [bps301Materials()],
  base: command === 'serve' && !isPreview ? '/' : '/BPS301/',
}))
