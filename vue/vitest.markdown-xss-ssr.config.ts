import { defineConfig } from 'vitest/config'

export default defineConfig({
  esbuild: {
    target: 'es2022',
  },
  test: {
    environment: 'node',
    include: [
      'vue/packages/wasm/__tests__/markdown-xss-ssr.test.ts',
    ],
    testTimeout: 20_000,
  },
})
