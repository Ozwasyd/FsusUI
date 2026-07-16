import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { createFsusViteManualChunks } from '../../../scripts/vite-manual-chunks.mjs'

export default defineConfig({
  plugins: [vue()],
  build: {
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
