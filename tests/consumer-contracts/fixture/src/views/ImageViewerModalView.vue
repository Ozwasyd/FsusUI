<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { ElButton, ElDialog, ElImageViewer } from '@ozwasyd/element-plus'

const props = defineProps<{
  neg?: string
}>()

const images = ['/images/fig-1.svg', '/images/fig-2.svg']
const alts = ['Architecture schematic', 'Throughput profile']

const routeMounted = ref(true)
const viewerVisible = ref(false)
const nestedDialogOpen = ref(false)
const hideOnClickModal = ref(true)
const bgClicks = ref(0)
const closeCount = ref(0)
const preInertRef = ref<HTMLDivElement | null>(null)

const handleViewerClose = () => {
  closeCount.value += 1
  if (props.neg === 'unrestored-focus') {
    window.setTimeout(() => {
      ;(document.activeElement as HTMLElement | null)?.blur?.()
    }, 10)
  }
  if (props.neg === 'unrestored-scroll') {
    window.setTimeout(() => {
      window.scrollTo(0, 0)
    }, 10)
  }
}

const openViewer = () => {
  viewerVisible.value = true
  if (props.neg === 'unprotected-background') {
    window.setTimeout(() => {
      const bg = document.querySelector<HTMLElement>('[data-testid="bg-action-btn"]')
      bg?.closest('[inert]')?.removeAttribute('inert')
      bg?.removeAttribute('inert')
    }, 30)
  }
}

const handleExternalHide = () => {
  viewerVisible.value = false
}

const handleRouteUnmount = () => {
  routeMounted.value = false
}

const handleRouteRemount = () => {
  viewerVisible.value = false
  routeMounted.value = true
}

interface ModalControls {
  open: () => void
  hideExternally: () => void
  unmountRoute: () => void
  remountRoute: () => void
}

declare global {
  interface Window {
    __viewerModalControls?: ModalControls
  }
}

onMounted(() => {
  preInertRef.value?.setAttribute('inert', 'app-owned')
  window.__viewerModalControls = {
    open: openViewer,
    hideExternally: handleExternalHide,
    unmountRoute: handleRouteUnmount,
    remountRoute: handleRouteRemount,
  }
})

onBeforeUnmount(() => {
  delete window.__viewerModalControls
})
</script>

<template>
  <section data-testid="viewer-modal-contract-section">
    <h1>ImageViewer Modal Lifecycle Contract (#832)</h1>

    <div
      ref="preInertRef"
      data-testid="app-pre-inert"
    >
      <button type="button" data-testid="pre-inert-btn">
        Pre-existing app inert control
      </button>
    </div>

    <div class="contract-spacer-tall">
      <div class="contract-toolbar">
        <button
          type="button"
          class="contract-compact-trigger"
          data-testid="open-viewer-btn"
          @click="openViewer"
        >
          Open modal viewer
        </button>

        <button
          type="button"
          class="contract-compact-trigger"
          data-testid="bg-action-btn"
          @click="bgClicks += 1"
        >
          Background action ({{ bgClicks }})
        </button>

        <ElButton data-testid="external-hide-btn" @click="handleExternalHide">
          External visible=false
        </ElButton>

        <ElButton data-testid="route-unmount-btn" @click="handleRouteUnmount">
          Unmount route
        </ElButton>

        <ElButton data-testid="route-remount-btn" @click="handleRouteRemount">
          Remount route
        </ElButton>
      </div>

      <div class="contract-status" data-testid="modal-status">
        <div data-testid="viewer-visible-state">{{ String(viewerVisible) }}</div>
        <div data-testid="bg-click-count">{{ bgClicks }}</div>
        <div data-testid="close-event-count">{{ closeCount }}</div>
      </div>
    </div>

    <div v-if="routeMounted" data-testid="viewer-route-host">
      <ElImageViewer
        v-model:visible="viewerVisible"
        :url-list="images"
        :alt-list="alts"
        aria-label="Modal lifecycle viewer"
        :hide-on-click-modal="hideOnClickModal"
        teleported
        @close="handleViewerClose"
      >
        <template #caption="{ index, alt }">
          <div>
            <span>{{ index + 1 }} / {{ images.length }} — {{ alt }}</span>
            <button
              type="button"
              data-testid="open-nested-dialog-btn"
              @click="nestedDialogOpen = true"
            >
              Open nested dialog
            </button>
          </div>
        </template>
      </ElImageViewer>

      <ElDialog
        v-model="nestedDialogOpen"
        title="Nested metadata dialog"
        append-to-body
      >
        <button
          type="button"
          data-testid="nested-dialog-action-btn"
          @click="nestedDialogOpen = false"
        >
          Confirm nested action
        </button>
      </ElDialog>
    </div>
  </section>
</template>
