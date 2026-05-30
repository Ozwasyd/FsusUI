import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { createFsusViteManualChunks } from '../../../scripts/vite-manual-chunks.mjs'

export default defineConfig({
  plugins: [vue()],
  build: {
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        manualChunks: createFsusViteManualChunks(),
      },
    },
  },
})
