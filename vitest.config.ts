import { defineConfig } from 'vitest/config'
import Vue from '@vitejs/plugin-vue'
import VueJsx from '@vitejs/plugin-vue-jsx'
import VueMacros from 'unplugin-vue-macros/vite'

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
      exclude: [
        'packages/wasm/**',
        '**/__tests__/**',
        '**/*.d.ts',
      ],
    },
  },
})
