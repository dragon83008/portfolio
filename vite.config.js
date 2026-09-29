import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'

export default defineConfig(({ mode }) => mode === 'public' ? {
  root: 'public-site',
  publicDir: false,
  base: process.env.PORTFOLIO_PUBLIC_BASE || '/',
  plugins: [react()],
  resolve: { alias: { './profileData.js': fileURLToPath(new URL('./src/publicProfileData.js', import.meta.url)) } },
  build: { outDir: '../dist-public', emptyOutDir: true },
} : { plugins: [react()] })
