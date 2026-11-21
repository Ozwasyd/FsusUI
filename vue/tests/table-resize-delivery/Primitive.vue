<script setup lang="ts">
import { ElButton, ElTable, ElTableColumn } from '@ozwasyd/element-plus'

const rows = Array.from({ length: 50 }, (_, i) => ({
  articleIdentity: `article:${i}`,
  outcome: i === 0 ? '版本冲突' : '成功',
  reason: i === 0 ? '版本已变化' : '已处理',
  retryEligible: i === 0,
}))
</script>

<template>
  <main>
    <ElTable
      :data="rows"
      row-key="articleIdentity"
      aria-label="ordinary public table"
    >
      <ElTableColumn prop="articleIdentity" label="文章标识" />
      <ElTableColumn prop="outcome" label="结果" />
      <ElTableColumn prop="reason" label="原因" />
      <ElTableColumn label="重试">
        <template #default="scope">
          <ElButton v-if="scope.row.retryEligible" disabled>
            重新预览此项
          </ElButton>
        </template>
      </ElTableColumn>
    </ElTable>
  </main>
</template>

<style>
body {
  margin: 0;
  font-family: system-ui, sans-serif;
}
main {
  max-width: 960px;
  margin: auto;
  padding: 24px;
  box-sizing: border-box;
}
</style>
