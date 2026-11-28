<script setup lang="ts">
import { ref } from 'vue'
import { FsusCheckTag } from '@ozwasyd/fsusui'

const first = ref(true)
const second = ref(false)
</script>

<template>
  <div style="width: 320px; padding: 24px; background: #fff">
    <div style="display: inline-flex; gap: 8px; align-items: center">
      <fsus-check-tag v-model:checked="first">Checked tag</fsus-check-tag>
      <fsus-check-tag v-model:checked="second">Unchecked tag</fsus-check-tag>
    </div>
  </div>
</template>
