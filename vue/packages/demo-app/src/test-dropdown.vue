<script setup lang="ts">
import { demoComponents } from './demo-components'

const { FsusButton, FsusDropdown, FsusDropdownItem, FsusDropdownMenu } = demoComponents
</script>

<template>
  <fsus-dropdown trigger="click">
    <fsus-button> Dropdown List </fsus-button>
    <template #dropdown>
      <fsus-dropdown-menu>
        <fsus-dropdown-item>保存草稿</fsus-dropdown-item>
        <fsus-dropdown-item>预览发布</fsus-dropdown-item>
        <fsus-dropdown-item>导出 Markdown</fsus-dropdown-item>
      </fsus-dropdown-menu>
    </template>
  </fsus-dropdown>
</template>
