import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: process.env.GITHUB_ACTIONS ? `/${process.env.GITHUB_REPOSITORY?.split('/')[1] ?? ''}/` : '/',
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          "react-vendor": ["react", "react-dom", "react-router-dom"],
          "charts-vendor": ["recharts"],
          "data-vendor": ["@supabase/supabase-js"],
        },
      },
    },
  },
  test: { environment: 'jsdom', setupFiles: './src/test/setup.ts' },
})
