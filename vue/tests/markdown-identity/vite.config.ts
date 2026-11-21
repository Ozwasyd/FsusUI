import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import demoConfig from '../../packages/demo-app/vite.config'

export default defineConfig({
  plugins: demoConfig.plugins,
  root: fileURLToPath(new URL('.', import.meta.url)),
  resolve: {
    ...demoConfig.resolve,
    alias: {
      ...demoConfig.resolve?.alias,
      '@ozwasyd/element-plus/markdown-runtime': fileURLToPath(
        new URL(
          '../../packages/element-plus/markdown-runtime.ts',
          import.meta.url,
        ),
      ),
      '@ozwasyd/element-plus': fileURLToPath(
        new URL('../../packages/element-plus/index.ts', import.meta.url),
      ),
    },
  },
  worker: demoConfig.worker,
  build: {
    outDir: fileURLToPath(
      new URL('../../../.tmp/markdown-identity', import.meta.url),
    ),
    emptyOutDir: true,
  },
})
