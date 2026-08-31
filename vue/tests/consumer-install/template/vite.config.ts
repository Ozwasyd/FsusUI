import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { createFsusViteManualChunks } from '../../../scripts/vite-manual-chunks.mjs'

export default defineConfig({
  plugins: [vue()],
  worker: {
    format: 'es',
    rollupOptions: {
      output: {
        entryFileNames: 'assets/w-[hash].mjs',
      },
    },
  },
  build: {
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: Number.POSITIVE_INFINITY,
    manifest: true,
    rollupOptions: {
      output: {
        manualChunks: createFsusViteManualChunks({ profile: 'consumer' }),
        onlyExplicitManualChunks: true,
      },
    },
  },
})
