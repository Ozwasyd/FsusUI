import { resolve } from 'node:path'
import Vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  root: resolve(import.meta.dirname, '../../..'),
  plugins: [Vue()],
  optimizeDeps: {
    include: [
      'katex',
      'mermaid',
      'shiki/core',
      'shiki/engine/javascript',
      'shiki/dist/langs/bash.mjs',
      'shiki/dist/langs/csharp.mjs',
      'shiki/dist/langs/javascript.mjs',
      'shiki/dist/langs/typescript.mjs',
      'shiki/dist/themes/github-dark.mjs',
      'shiki/dist/themes/github-light.mjs',
    ],
  },
  server: {
    strictPort: true,
  },
})
