<script setup lang="ts">
import { ref } from 'vue'
import { ElCollapse, ElCollapseItem } from '@element-plus/components/collapse'

const activeNames = ref<string[]>(['options'])
</script>

<template>
  <div style="width: 560px; padding: 24px; background: #fff">
    <el-collapse v-model="activeNames">
      <el-collapse-item title="Options" name="options">
        <div>Options content.</div>
      </el-collapse-item>
      <el-collapse-item title="Advanced" name="advanced">
        <div>Advanced content.</div>
      </el-collapse-item>
      <el-collapse-item title="Disabled" name="disabled" disabled>
        <div>Disabled content.</div>
      </el-collapse-item>
    </el-collapse>
  </div>
</template>
