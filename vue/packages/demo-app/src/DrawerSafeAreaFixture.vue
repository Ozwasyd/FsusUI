<template>
  <button id="open" type="button" @click="visible = true">Open account</button>
  <input id="outside" aria-label="Outside drawer" />
  <output id="events">{{ events.join(',') }}</output>
  <output id="navigations">{{ navigations }}</output>
  <fsus-drawer
    v-model="visible"
    :direction="direction"
    :size="size"
    :destroy-on-close="destroyOnClose"
    append-to-body
    @open="events.push('open')"
    @opened="events.push('opened')"
    @close="events.push('close')"
    @closed="events.push('closed')"
  >
    <template #header="{ titleId, titleClass }">
      <span
        :id="titleId"
        :class="titleClass"
        role="heading"
        aria-level="2"
      >
        Account
      </span>
    </template>
    <a
      id="account-link"
      href="#profile"
      style="display: block; line-height: 44px"
      @click.prevent="navigations++"
    >
      Account profile
    </a>
  </fsus-drawer>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { FsusDrawer } from '@ozwasyd/fsusui'

const props = withDefaults(
  defineProps<{
    direction?: 'ltr' | 'rtl' | 'ttb' | 'btt'
    size?: string
    destroyOnClose?: boolean
  }>(),
  {
    direction: 'ltr',
    size: 'min(86vw, 22rem)',
    destroyOnClose: false,
  },
)

const visible = ref(false)
const events = ref<string[]>([])
const navigations = ref(0)
const direction = props.direction
const size = props.size
const destroyOnClose = props.destroyOnClose
</script>
