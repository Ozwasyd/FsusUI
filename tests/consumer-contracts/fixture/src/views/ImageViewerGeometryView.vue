<script setup lang="ts">
import { ref } from 'vue'
import { ElButton, ElImageViewer } from '@ozwasyd/element-plus'

const visible = ref(false)
const images = ['/images/fig-1.svg', '/images/fig-2.svg', '/images/fig-3.svg']
const alts = ['Geometry diagram 1', 'Geometry diagram 2', 'Geometry diagram 3']
</script>

<template>
  <section data-testid="viewer-geometry-contract-section">
    <h1>ImageViewer Toolbar Geometry Contract (#834)</h1>

    <div class="contract-toolbar">
      <ElButton data-testid="open-geometry-viewer-btn" @click="visible = true">
        Open geometry viewer
      </ElButton>
    </div>

    <ElImageViewer
      v-model:visible="visible"
      :url-list="images"
      :alt-list="alts"
      aria-label="Geometry verification viewer"
      teleported
    />
  </section>
</template>
