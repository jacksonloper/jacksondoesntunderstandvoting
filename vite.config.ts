import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // relative asset paths so the build works from any sub-path (e.g. GitHub Pages project sites)
  base: './',
  plugins: [react()],
})
