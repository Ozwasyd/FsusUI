import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'

const sanitizeChunkName = (name: string) =>
  name
    .replaceAll(/^@/g, '')
    .replaceAll(/[\\/]/g, '-')
    .replaceAll(/[^a-zA-Z0-9-_]/g, '')

const resolveElementPlusChunk = (id: string) => {
  if (id.includes('/node_modules/@element-plus/components/')) {
    const packageComponent = id.match(/\/node_modules\/@element-plus\/components\/([^/]+)\//)
    if (packageComponent) {
      return `ep-${sanitizeChunkName(packageComponent[1])}`
    }

    return 'ep-installer'
  }

  const workspaceComponent = id.match(/\/packages\/components\/([^/]+)\//)
  if (workspaceComponent) {
    return `ep-${sanitizeChunkName(workspaceComponent[1])}`
  }

  const workspaceSupport = id.match(/\/packages\/(constants|directives|hooks|locale|utils)\//)
  if (workspaceSupport) {
    return `ep-${sanitizeChunkName(workspaceSupport[1])}`
  }

  const packageSupport = id.match(/\/node_modules\/@element-plus\/(constants|directives|hooks|locale|utils)\//)
  if (packageSupport) {
    return `ep-${sanitizeChunkName(packageSupport[1])}`
  }

  if (id.includes('/packages/element-plus/') || id.includes('/node_modules/@element-plus/element-plus/')) {
    return 'ep-installer'
  }

  if (id.includes('/packages/icons-vue/') || id.includes('/node_modules/@element-plus/icons-vue/')) {
    return 'ep-icons'
  }
}

const resolveVendorChunk = (id: string) => {
  const pkgMatch = id.match(/\/node_modules\/(@[^/]+\/[^/]+|[^/]+)/)
  if (!pkgMatch) {
    return undefined
  }

  return `vendor-${sanitizeChunkName(pkgMatch[1])}`
}

export default defineConfig({
  plugins: [vue(), vueJsx()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/packages/wasm/') || id.includes('/node_modules/@element-plus/wasm/')) {
            return 'fsus-wasm'
          }

          const elementPlusChunk = resolveElementPlusChunk(id)
          if (elementPlusChunk) {
            return elementPlusChunk
          }

          if (id.includes('/node_modules/vue/') || id.includes('/node_modules/@vue/')) {
            return 'vue-vendor'
          }

          if (id.includes('/node_modules/dayjs/')) {
            return 'dayjs'
          }

          if (
            id.includes('/node_modules/lodash-es/')
            || id.includes('/node_modules/lodash-unified/')
            || id.includes('/node_modules/lodash/')
          ) {
            return 'lodash'
          }

          if (id.includes('/node_modules/')) {
            return resolveVendorChunk(id)
          }
        },
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
        new URL('../element-plus/index.ts', import.meta.url)
      ),
      '@element-plus/components': fileURLToPath(
        new URL('../components', import.meta.url)
      ),
      '@element-plus/constants': fileURLToPath(
        new URL('../constants', import.meta.url)
      ),
      '@element-plus/directives': fileURLToPath(
        new URL('../directives', import.meta.url)
      ),
      '@element-plus/hooks': fileURLToPath(
        new URL('../hooks', import.meta.url)
      ),
      '@element-plus/locale': fileURLToPath(
        new URL('../locale', import.meta.url)
      ),
      '@element-plus/utils': fileURLToPath(
        new URL('../utils', import.meta.url)
      ),
      '@element-plus/icons-vue': fileURLToPath(
        new URL('../icons-vue/src/index.ts', import.meta.url)
      ),
      '@element-plus/theme-chalk/src': fileURLToPath(
        new URL('../theme-chalk/src', import.meta.url)
      ),
      '@element-plus/wasm': fileURLToPath(
        new URL('../wasm/index.ts', import.meta.url)
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
