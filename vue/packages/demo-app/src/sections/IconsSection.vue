<template>
  <div id="icons" class="demo-section" data-testid="section-icons">
    <h2>Full Icon Gallery</h2>
    <div class="icon-gallery">
      <div v-for="(_path, name) in allIcons" :key="name" class="icon-item">
        <fsus-icon :name="name" :size="24" />
        <span class="icon-name">{{ name }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useDemoState } from '../demo-state'

const { allIcons } = useDemoState()
</script>
