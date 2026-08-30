<script setup lang="ts">
import { ref } from 'vue'
import { ElCheckboxButton } from '@element-plus/components/checkbox'

const first = ref(true)
const second = ref(false)
const third = ref(false)
</script>

<template>
  <div style="display: inline-flex; gap: 8px; padding: 24px; background: #fff">
    <el-checkbox-button v-model="first">Checked</el-checkbox-button>
    <el-checkbox-button v-model="second">Unchecked</el-checkbox-button>
    <el-checkbox-button v-model="third" disabled>Disabled</el-checkbox-button>
  </div>
</template>
