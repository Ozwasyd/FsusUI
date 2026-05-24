import { defineConfig } from 'vitest/config'
import Vue from '@vitejs/plugin-vue'
import VueJsx from '@vitejs/plugin-vue-jsx'
import VueMacros from 'unplugin-vue-macros/vite'
import { resolveVitestWorkers } from './scripts/test-parallelism'

export default defineConfig({
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
      'packages/**/__tests__/**/*.{test,spec,vitest}.{js,jsx,ts,tsx}',
      'tests/boundary/**/*.{test,spec,vitest}.{js,jsx,ts,tsx}',
    ],
    exclude: [
      '**/node_modules/**',
      'tests/visual/**',
      'playwright.config.ts',
      'playwright.reuse.config.ts',
    ],
    testTimeout: 20_000,
    environment: 'jsdom',
    environmentOptions: {
      jsdom: {
        // jsdom 29+ 启用 ES2022 特性
        pretendToBeVisual: true,
      },
    },
    setupFiles: ['./vitest.setup.ts'],
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
        'packages/wasm/**',
        '**/__tests__/**',
        '**/*.d.ts',
        'tests/visual/**',
        'playwright.config.ts',
        'playwright.reuse.config.ts',
      ],
    },
  },
})
