import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import { createFsusViteManualChunks } from '../../../scripts/vite-manual-chunks.mjs'

export default defineConfig({
  plugins: [vue(), vueJsx()],
  build: {
    chunkSizeWarningLimit: Number.POSITIVE_INFINITY,
    rollupOptions: {
      output: {
        manualChunks: createFsusViteManualChunks(),
        onlyExplicitManualChunks: false,
      },
    },
  },
  optimizeDeps: {
    noDiscovery: true,
    exclude: [
      '@ozwasyd/fsusui',
      '@fsusui/core',
      '@fsusui/icons',
      '@fsusui/motion',
      '@fsusui/theme',
      '@fsusui/components',
      '@fsusui/markdown',
      '@fsusui/wasm',
    ],
    include: [
      '@floating-ui/dom',
      '@vue/shared',
      'katex',
      'mermaid',
      'shiki/core',
      'shiki/dist/langs/bash.mjs',
      'shiki/dist/langs/csharp.mjs',
      'shiki/dist/langs/javascript.mjs',
      'shiki/dist/langs/typescript.mjs',
      'shiki/dist/themes/github-dark.mjs',
      'shiki/dist/themes/github-light.mjs',
      'shiki/engine/javascript',
      'vue',
    ],
  },
  resolve: {
    alias: [
      {
        find: /^@ozwasyd\/fsusui\/markdown$/,
        replacement: fileURLToPath(new URL('../fsusui/src/markdown.ts', import.meta.url)),
      },
      {
        find: /^@ozwasyd\/fsusui\/motion$/,
        replacement: fileURLToPath(new URL('../fsusui/src/motion.ts', import.meta.url)),
      },
      {
        find: /^@ozwasyd\/fsusui\/icons$/,
        replacement: fileURLToPath(new URL('../fsusui/src/icons.ts', import.meta.url)),
      },
      {
        find: /^@ozwasyd\/fsusui\/wasm$/,
        replacement: fileURLToPath(new URL('../fsusui/src/wasm.ts', import.meta.url)),
      },
      {
        find: /^@ozwasyd\/fsusui\/render-pipeline$/,
        replacement: fileURLToPath(new URL('../fsusui/src/render-pipeline.ts', import.meta.url)),
      },
      {
        find: /^@ozwasyd\/fsusui\/perception-challenge$/,
        replacement: fileURLToPath(new URL('../fsusui/src/perception-challenge.ts', import.meta.url)),
      },
      {
        find: /^@ozwasyd\/fsusui\/core$/,
        replacement: fileURLToPath(new URL('../fsusui/src/core.ts', import.meta.url)),
      },
      {
        find: /^@ozwasyd\/fsusui$/,
        replacement: fileURLToPath(new URL('../fsusui/src/index.ts', import.meta.url)),
      },
      {
        find: /^@fsusui\/core\/(.*)$/,
        replacement: fileURLToPath(new URL('../core/src/$1', import.meta.url)),
      },
      {
        find: /^@fsusui\/core$/,
        replacement: fileURLToPath(new URL('../core/src/index.ts', import.meta.url)),
      },
      {
        find: /^@fsusui\/icons$/,
        replacement: fileURLToPath(new URL('../icons/src/index.ts', import.meta.url)),
      },
      {
        find: /^@fsusui\/motion$/,
        replacement: fileURLToPath(new URL('../motion/src/index.ts', import.meta.url)),
      },
      {
        find: /^@fsusui\/components$/,
        replacement: fileURLToPath(new URL('../components/src/index.ts', import.meta.url)),
      },
      {
        find: /^@fsusui\/markdown$/,
        replacement: fileURLToPath(new URL('../markdown/src/index.ts', import.meta.url)),
      },
      {
        find: /^@fsusui\/theme\/src\/(.*)$/,
        replacement: fileURLToPath(new URL('../theme/src/$1', import.meta.url)),
      },
      {
        find: /^@fsusui\/wasm\/(.*)$/,
        replacement: fileURLToPath(new URL('../wasm/$1', import.meta.url)),
      },
      {
        find: /^@fsusui\/wasm$/,
        replacement: fileURLToPath(new URL('../wasm/index.ts', import.meta.url)),
      },
      {
        find: '@',
        replacement: fileURLToPath(new URL('./src', import.meta.url)),
      },
    ],
    preserveSymlinks: true,
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    strictPort: true,
  },
  worker: {
    format: 'es',
  },
})
