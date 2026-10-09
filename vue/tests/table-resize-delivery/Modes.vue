<script setup lang="ts">
import { ref } from 'vue'
import { ElButton, ElTable, ElTableColumn } from '@ozwasyd/element-plus'

const mode = new URLSearchParams(location.search).get('mode')
const mounted = ref(true)
const height = ref(300)
const compact = ref(false)
const rows = Array.from({ length: 50 }, (_, i) => ({
  articleIdentity: `article:${i}`,
  outcome: i === 0 ? '版本冲突' : '成功',
  reason: i === 0 ? '版本已变化' : '已处理',
}))
</script>

<template>
  <section class="flex-parent">
    <main :style="{ maxWidth: compact ? '600px' : '960px' }">
      <ElButton @click="compact = !compact">Resize container</ElButton>
      <ElButton @click="height = height === 300 ? 400 : 300">
        Resize height
      </ElButton>
      <ElButton @click="mounted = !mounted">Toggle table</ElButton>
      <ElTable
        v-if="mounted"
        :data="rows"
        row-key="articleIdentity"
        :fit="mode !== 'fit-false'"
        :flexible="mode === 'flexible'"
        :height="mode === 'auto' ? undefined : height"
        :table-layout="mode === 'auto' ? 'auto' : 'fixed'"
        aria-label="ordinary public table modes"
      >
        <ElTableColumn
          prop="articleIdentity"
          label="文章标识"
          width="120"
          :fixed="mode === 'fixed'"
        />
        <ElTableColumn prop="outcome" label="结果" min-width="80" />
        <ElTableColumn prop="reason" label="原因" min-width="80" />
        <ElTableColumn
          prop="articleIdentity"
          label="重试"
          width="120"
          :fixed="mode === 'fixed' ? 'right' : false"
        />
      </ElTable>
    </main>
  </section>
</template>

<style>
body {
  margin: 0;
  font-family: system-ui, sans-serif;
}
.flex-parent {
  display: flex;
}
main {
  width: 100%;
  margin: auto;
  padding: 24px;
  box-sizing: border-box;
}
</style>
