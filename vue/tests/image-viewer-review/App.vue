<script setup lang="ts">
import { ref } from 'vue'
import { ElDialog, ElImageViewer } from '@ozwasyd/element-plus'

const parameters = new URLSearchParams(window.location.search)
const cspSafe = parameters.get('csp') !== '0'
const caption = parameters.get('caption') !== '0'
const viewerOpen = ref(false)
const dialogOpen = ref(false)
const image = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="2400" height="1600"><rect width="2400" height="1600" fill="steelblue"/></svg>')}`
</script>

<template>
  <button @click="viewerOpen = true">Open viewer</button>
  <button>Background action</button>
  <ElImageViewer
    v-model:visible="viewerOpen"
    :url-list="[image]"
    :alt-list="['Large source image']"
    aria-label="Review viewer"
    :csp-safe="cspSafe"
    :labels="{ close: 'Close viewer', toggleMode: 'Toggle original size' }"
    teleported
  >
    <template v-if="caption" #caption>
      <section aria-label="Long caption">
        <button @click="dialogOpen = true">Open nested dialog</button>
        <p v-for="index in 80" :key="index">
          Figure {{ index }}: ordinary long caption text with enough content to
          require reading beyond the initially visible caption viewport.
        </p>
      </section>
    </template>
  </ElImageViewer>
  <ElDialog v-model="dialogOpen" append-to-body title="Nested dialog">
    <button @click="dialogOpen = false">Nested action</button>
  </ElDialog>
</template>
