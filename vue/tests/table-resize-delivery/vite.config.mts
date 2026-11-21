import { realpathSync } from 'node:fs'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'

const blogRoot = process.env.FSUSBLOG_ROOT!
const uiRoot = process.env.FSUSUI_ROOT!
const { createFsusUiAliases } = await import(
  `${blogRoot}/src/frontend/scripts/fsusui-local.ts`
)

export default defineConfig({
  root: import.meta.dirname,
  plugins: [vue(), vueJsx()],
  resolve: {
    dedupe: ['vue'],
    alias: [
      {
        find: /^vue$/,
        replacement: `${blogRoot}/src/frontend/node_modules/vue/dist/vue.esm-bundler.js`,
      },
      ...createFsusUiAliases(uiRoot),
    ],
  },
  server: {
    host: '127.0.0.1',
    port: 4174,
    strictPort: true,
    fs: {
      allow: [
        import.meta.dirname,
        blogRoot,
        uiRoot,
        realpathSync(`${blogRoot}/src/frontend/node_modules`),
      ],
    },
  },
})
