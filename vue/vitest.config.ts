import { defineConfig } from 'vitest/config'
import Vue from '@vitejs/plugin-vue'
import VueJsx from '@vitejs/plugin-vue-jsx'
import VueMacros from 'unplugin-vue-macros/vite'
import { resolveVitestWorkers } from '../scripts/test-parallelism'

export default defineConfig({
  root: '.',
  plugins: [
    VueMacros({
      setupComponent: false,
      setupSFC: false,
      plugins: {
        vue: Vue(),
        vueJsx: VueJsx(),
      },
    }),
  ],
  esbuild: {
    target: 'es2022',
  },
  test: {
    clearMocks: true,
    fileParallelism: true,
    maxWorkers: resolveVitestWorkers(),
    include: [
      'vue/packages/**/__tests__/**/*.{test,spec,vitest}.{js,jsx,ts,tsx}',
      'vue/tests/boundary/**/*.{test,spec,vitest}.{js,jsx,ts,tsx}',
    ],
    exclude: [
      '**/node_modules/**',
      'vue/packages/wasm/__tests__/markdown-xss-ssr.test.ts',
      'vue/tests/visual/**',
      'vue/playwright.config.ts',
      'vue/playwright.reuse.config.ts',
    ],
    testTimeout: 20_000,
    environment: 'jsdom',
    environmentOptions: {
      jsdom: {
        // jsdom 29+ 启用 ES2022 特性
        pretendToBeVisual: true,
      },
    },
    setupFiles: ['./vue/vitest.setup.ts'],
    // 使用 v8 coverage（更准确）
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      thresholds: {
        lines: 35,
        statements: 35,
        functions: 35,
        branches: 25,
      },
      exclude: [
        'vue/packages/wasm/**',
        '**/__tests__/**',
        '**/*.d.ts',
        'vue/tests/visual/**',
        'vue/playwright.config.ts',
        'vue/playwright.reuse.config.ts',
      ],
    },
  },
})
