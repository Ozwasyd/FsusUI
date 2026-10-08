import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import demoConfig from '../../packages/demo-app/vite.config'

export default defineConfig({
  worker: demoConfig.worker,
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: demoConfig.plugins,
  resolve: {
    ...demoConfig.resolve,
    dedupe: ['vue'],
    alias: {
      ...demoConfig.resolve?.alias,
      '@ozwasyd/element-plus/dist/fsus.css': fileURLToPath(
        new URL('../../packages/theme-chalk/dist/el-fsus.css', import.meta.url),
      ),
      '@ozwasyd/element-plus': fileURLToPath(
        new URL('../../packages/element-plus/index.ts', import.meta.url),
      ),
    },
  },
  build: {
    outDir: fileURLToPath(
      new URL('../../../.tmp/dialog-focus', import.meta.url),
    ),
    emptyOutDir: true,
  },
})
