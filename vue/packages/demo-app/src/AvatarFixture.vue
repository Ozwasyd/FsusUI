<script setup lang="ts">
import { FsusAvatar } from '@ozwasyd/fsusui'
</script>

<template>
  <div style="display: inline-flex; gap: 16px; padding: 24px; background: #fff">
    <fsus-avatar :size="64" shape="circle">A</fsus-avatar>
    <fsus-avatar :size="64" shape="square">B</fsus-avatar>
  </div>
</template>
