<script setup lang="ts">
import { demoComponents } from './demo-components'

const { ElButton, ElDropdown, ElDropdownItem, ElDropdownMenu } = demoComponents
</script>

<template>
  <el-dropdown trigger="click">
    <el-button> Dropdown List </el-button>
    <template #dropdown>
      <el-dropdown-menu>
        <el-dropdown-item>保存草稿</el-dropdown-item>
        <el-dropdown-item>预览发布</el-dropdown-item>
        <el-dropdown-item>导出 Markdown</el-dropdown-item>
      </el-dropdown-menu>
    </template>
  </el-dropdown>
</template>
