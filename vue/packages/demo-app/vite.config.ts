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
        onlyExplicitManualChunks: true,
      },
    },
  },
  optimizeDeps: {
    exclude: [
      'element-plus',
      '@element-plus/components',
      '@element-plus/constants',
      '@element-plus/directives',
      '@element-plus/hooks',
      '@element-plus/locale',
      '@element-plus/utils',
      '@element-plus/icons-vue',
      '@element-plus/wasm',
    ],
    include: [
      'escape-html',
      'dayjs/plugin/advancedFormat.js',
      'dayjs/plugin/customParseFormat.js',
      'dayjs/plugin/dayOfYear.js',
      'dayjs/plugin/isSameOrAfter.js',
      'dayjs/plugin/isSameOrBefore.js',
      'dayjs/plugin/localeData.js',
      'dayjs/plugin/updateLocale',
      'dayjs/plugin/weekOfYear.js',
      'dayjs/plugin/weekYear.js',
    ],
  },
  resolve: {
    alias: {
      'element-plus': fileURLToPath(
        new URL('../element-plus/index.ts', import.meta.url),
      ),
      '@element-plus/components': fileURLToPath(
        new URL('../components', import.meta.url),
      ),
      '@element-plus/constants': fileURLToPath(
        new URL('../constants', import.meta.url),
      ),
      '@element-plus/directives': fileURLToPath(
        new URL('../directives', import.meta.url),
      ),
      '@element-plus/hooks': fileURLToPath(
        new URL('../hooks', import.meta.url),
      ),
      '@element-plus/locale': fileURLToPath(
        new URL('../locale', import.meta.url),
      ),
      '@element-plus/utils': fileURLToPath(
        new URL('../utils', import.meta.url),
      ),
      '@element-plus/icons-vue': fileURLToPath(
        new URL('../icons-vue/src/index.ts', import.meta.url),
      ),
      '@element-plus/theme-chalk/src': fileURLToPath(
        new URL('../theme-chalk/src', import.meta.url),
      ),
      '@element-plus/wasm': fileURLToPath(
        new URL('../wasm/index.ts', import.meta.url),
      ),
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
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
})
