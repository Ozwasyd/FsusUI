<script setup lang="ts">
import type { CollapseModelValue } from '@ozwasyd/fsusui'
import { FsusCollapse, FsusCollapseItem } from '@ozwasyd/fsusui'
import { ref } from 'vue'

const activeNames = ref<CollapseModelValue>(['options'])
</script>

<template>
  <div style="width: 560px; padding: 24px; background: #fff">
    <fsus-collapse v-model="activeNames">
      <fsus-collapse-item title="Options" name="options">
        <div>Options content.</div>
      </fsus-collapse-item>
      <fsus-collapse-item title="Advanced" name="advanced">
        <div>Advanced content.</div>
      </fsus-collapse-item>
      <fsus-collapse-item title="Disabled" name="disabled" disabled>
        <div>Disabled content.</div>
      </fsus-collapse-item>
    </fsus-collapse>
  </div>
</template>
