<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { ElButton, ElDialog } from '@ozwasyd/element-plus'

const open = ref(false)
const nestedOpen = ref(false)
const destroyOnClose = ref(false)
const closedCount = ref(0)
const opener = new URLSearchParams(window.location.search).get('opener')
const conditionalMount = opener?.startsWith('conditional') ?? false
const openDelay = opener?.includes('delay') ? 30 : 0

async function reopen() {
  open.value = false
  await nextTick()
  open.value = true
}
</script>

<template>
  <template v-if="opener">
    <input aria-label="Previous focus" />
    <button
      :tabindex="opener === 'negative-tabindex' ? -1 : 0"
      @mousedown.prevent
      @click="open = true"
    >
      <span>Open dialog</span>
    </button>
  </template>
  <ElButton v-else @click="open = true"><span>Open dialog</span></ElButton>
  <ElButton @click="open = false">External close</ElButton>
  <label
    ><input v-model="destroyOnClose" type="checkbox" /> Destroy content</label
  >
  <output aria-label="Closed count">{{ closedCount }}</output>
  <ElDialog
    v-if="!conditionalMount || open"
    v-model="open"
    title="Focus restoration"
    append-to-body
    :destroy-on-close="destroyOnClose"
    :open-delay="openDelay"
    @closed="closedCount++"
  >
    <p>Dialog content uses the public component and its production theme.</p>
    <ElButton @click="nestedOpen = true">
      <span>Open nested dialog</span>
    </ElButton>
    <ElButton @click="reopen">Interrupt close</ElButton>
    <template #footer>
      <ElButton @click="open = false">Close dialog</ElButton>
    </template>
    <ElDialog v-model="nestedOpen" title="Nested focus" append-to-body>
      <p>Nested modal content.</p>
      <template #footer>
        <ElButton @click="nestedOpen = false">Close nested dialog</ElButton>
      </template>
    </ElDialog>
  </ElDialog>
</template>
