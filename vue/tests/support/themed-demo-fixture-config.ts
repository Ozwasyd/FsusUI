import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import demoConfig from '../../packages/demo-app/vite.config'

export const createThemedDemoFixtureConfig = (
  configUrl: string,
  fixtureName: string,
) =>
  defineConfig({
    worker: demoConfig.worker,
    root: fileURLToPath(new URL('.', configUrl)),
    plugins: demoConfig.plugins,
    resolve: {
      ...demoConfig.resolve,
      dedupe: ['vue'],
      alias: {
        ...demoConfig.resolve?.alias,
        '@ozwasyd/element-plus/dist/fsus.css': fileURLToPath(
          new URL(
            '../../packages/theme-chalk/dist/el-fsus.css',
            import.meta.url,
          ),
        ),
        '@ozwasyd/element-plus': fileURLToPath(
          new URL('../../packages/element-plus/index.ts', import.meta.url),
        ),
      },
    },
    build: {
      outDir: fileURLToPath(
        new URL(`../../../.tmp/${fixtureName}`, import.meta.url),
      ),
      emptyOutDir: true,
    },
  })
