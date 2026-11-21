<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { ElConfigProvider, ElImageViewer } from '@ozwasyd/element-plus'

const props = defineProps<{
  initialOpen: boolean
  theme: 'light' | 'dark'
}>()

const images = ['/images/fig-1.svg', '/images/fig-2.svg']
const alts = ['SSR primary diagram', 'SSR secondary diagram']

const viewerOpen = ref(props.initialOpen)
const routeMounted = ref(true)
const activeIndex = ref(0)
const bgClicks = ref(0)
const closeCount = ref(0)

const handleClose = () => {
  closeCount.value += 1
}

interface SsrControls {
  open: () => void
  close: () => void
  unmountRoute: () => void
  remountRoute: () => void
}

declare global {
  interface Window {
    __ssrContractControls?: SsrControls
  }
}

onMounted(() => {
  document.documentElement.classList.toggle('dark', props.theme === 'dark')
  document.documentElement.classList.toggle('light', props.theme === 'light')
  window.__ssrContractControls = {
    open() {
      viewerOpen.value = true
    },
    close() {
      viewerOpen.value = false
    },
    unmountRoute() {
      routeMounted.value = false
    },
    remountRoute() {
      viewerOpen.value = false
      routeMounted.value = true
    },
  }
})

onBeforeUnmount(() => {
  delete window.__ssrContractControls
})
</script>

<template>
  <ElConfigProvider :theme-mode="theme">
    <main class="contract-ssr-root" data-testid="ssr-main" data-ssr-hydrated="true">
      <h1>ImageViewer SSR + Strict CSP Contract (#835)</h1>

      <div class="contract-ssr-tall">
        <div class="contract-toolbar">
          <button
            type="button"
            class="contract-compact-trigger"
            data-testid="ssr-open-viewer-btn"
            @click="viewerOpen = true"
          >
            Open SSR viewer
          </button>

          <button
            type="button"
            class="contract-compact-trigger"
            data-testid="ssr-bg-action-btn"
            @click="bgClicks += 1"
          >
            Background action ({{ bgClicks }})
          </button>

          <button
            type="button"
            class="contract-compact-trigger"
            data-testid="ssr-unmount-route-btn"
            @click="routeMounted = false"
          >
            Unmount route
          </button>
        </div>

        <div class="contract-status" data-testid="ssr-status">
          <div data-testid="ssr-viewer-open">{{ String(viewerOpen) }}</div>
          <div data-testid="ssr-active-index">{{ activeIndex }}</div>
          <div data-testid="ssr-close-count">{{ closeCount }}</div>
          <div data-testid="ssr-bg-clicks">{{ bgClicks }}</div>
        </div>
      </div>

      <Teleport to="#probe-teleports">
        <div data-testid="probe-teleport">
          Dedicated plain Vue teleport positive control
        </div>
      </Teleport>

      <div v-if="routeMounted" data-testid="ssr-route-host">
        <ElImageViewer
          v-model:visible="viewerOpen"
          v-model:active-index="activeIndex"
          :url-list="images"
          :alt-list="alts"
          aria-label="SSR CSP gallery"
          teleported
          append-to="#viewer-teleports"
          csp-safe
          hide-on-click-modal
          @close="handleClose"
        >
          <template #caption="{ index, alt }">
            <span data-testid="ssr-caption">
              {{ index + 1 }} / {{ images.length }}: {{ alt }}
            </span>
          </template>
        </ElImageViewer>
      </div>
    </main>
  </ElConfigProvider>
</template>
