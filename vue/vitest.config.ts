import path from 'node:path'
import { defineConfig } from 'vitest/config'
import Vue from '@vitejs/plugin-vue'
import VueJsx from '@vitejs/plugin-vue-jsx'
import { resolveVitestWorkers } from '../scripts/test-parallelism'

const packagesDir = path.resolve(import.meta.dirname, 'packages')

export default defineConfig({
  root: '.',
  resolve: {
    alias: [
      { find: /^@ozwasyd\/fsusui$/, replacement: path.join(packagesDir, 'fsusui/src/index.ts') },
      { find: /^@fsusui\/core$/, replacement: path.join(packagesDir, 'core/src/index.ts') },
      { find: /^@fsusui\/icons$/, replacement: path.join(packagesDir, 'icons/src/index.ts') },
      { find: /^@fsusui\/motion$/, replacement: path.join(packagesDir, 'motion/src/index.ts') },
      { find: /^@fsusui\/components$/, replacement: path.join(packagesDir, 'components/src/index.ts') },
      { find: /^@fsusui\/markdown$/, replacement: path.join(packagesDir, 'markdown/src/index.ts') },
      { find: /^@fsusui\/wasm$/, replacement: path.join(packagesDir, 'wasm/index.ts') },
      { find: /^@fsusui\/wasm\/(.*)$/, replacement: path.join(packagesDir, 'wasm/$1') },
      { find: /^@fsusui\/core\/(.*)$/, replacement: path.join(packagesDir, 'core/src/$1') },
      { find: /^@fsusui\/test-utils$/, replacement: path.join(packagesDir, 'test-utils/index.ts') },
    ],
  },
  plugins: [Vue(), VueJsx()],
  esbuild: {
    target: 'es2022',
  },
  test: {
    clearMocks: true,
    fileParallelism: true,
    maxWorkers: resolveVitestWorkers(),
    include: [
      'vue/packages/core/**/__tests__/**/*.{test,spec}.{ts,tsx}',
      'vue/packages/icons/**/__tests__/**/*.{test,spec}.{ts,tsx}',
      'vue/packages/motion/**/__tests__/**/*.{test,spec}.{ts,tsx}',
      'vue/packages/components/**/__tests__/**/*.{test,spec}.{ts,tsx}',
      'vue/packages/markdown/src/__tests__/**/*.{test,spec}.{ts,tsx}',
      'vue/packages/fsusui/**/__tests__/**/*.{test,spec}.{ts,tsx}',
      'vue/packages/theme/**/__tests__/**/*.{test,spec}.{ts,tsx}',
      'vue/packages/wasm/**/__tests__/**/*.{test,spec}.{ts,tsx}',
    ],
    exclude: [
      '**/node_modules/**',
      '**/_native-pending/**',
      'vue/tests/visual/**',
      'vue/packages/wasm/__tests__/markdown-xss-ssr.test.ts',
    ],
    testTimeout: 20_000,
    environment: 'jsdom',
    environmentOptions: {
      jsdom: {
        pretendToBeVisual: true,
      },
    },
    setupFiles: ['./vue/vitest.setup.ts'],
  },
})
