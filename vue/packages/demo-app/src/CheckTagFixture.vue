<script setup lang="ts">
import { ref } from 'vue'
import { ElCheckTag } from '@element-plus/components/check-tag'

const first = ref(true)
const second = ref(false)
</script>

<template>
  <div style="width: 320px; padding: 24px; background: #fff">
    <div style="display: inline-flex; gap: 8px; align-items: center">
      <el-check-tag v-model:checked="first">Checked tag</el-check-tag>
      <el-check-tag v-model:checked="second">Unchecked tag</el-check-tag>
    </div>
  </div>
</template>
