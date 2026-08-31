<script setup lang="ts">
import { ElAvatar } from '@element-plus/components/avatar'
</script>

<template>
  <div style="display: inline-flex; gap: 16px; padding: 24px; background: #fff">
    <el-avatar :size="64" shape="circle">A</el-avatar>
    <el-avatar :size="64" shape="square">B</el-avatar>
  </div>
</template>
