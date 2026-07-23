<template>
  <main class="transfer-responsive" data-testid="transfer-responsive-fixture">
    <header class="transfer-responsive__header">
      <p class="transfer-responsive__eyebrow">内容分发</p>
      <h1>选择需要同步的文章</h1>
      <p>可用文章、移动操作和已选文章始终按阅读与键盘顺序排列。</p>
    </header>

    <section
      class="transfer-responsive__case"
      data-testid="transfer-standard"
      v-bind="{ 'data-state': 'ten-items' }"
    >
      <h2>待同步文章</h2>
      <el-transfer
        v-model="selected"
        :data="items"
        :left-default-checked="[1]"
        :right-default-checked="[2]"
        :titles="['可用文章', '已选文章']"
        filterable
      />
    </section>

    <section
      class="transfer-responsive__case"
      data-testid="transfer-long-text"
      v-bind="{ 'data-state': 'long-text' }"
    >
      <h2>长标题</h2>
      <el-transfer
        v-model="longSelected"
        :data="longItems"
        :titles="['可用文章', '已选文章']"
      />
    </section>

    <section
      class="transfer-responsive__case"
      data-testid="transfer-disabled"
      v-bind="{ 'data-state': 'disabled' }"
    >
      <h2>部分文章不可移动</h2>
      <el-transfer
        v-model="disabledSelected"
        :data="disabledItems"
        :titles="['可用文章', '已选文章']"
      />
    </section>

    <section
      class="transfer-responsive__case"
      data-testid="transfer-all-checked"
      v-bind="{ 'data-state': 'all-checked' }"
    >
      <h2>全部选中</h2>
      <el-transfer
        v-model="allCheckedSelected"
        :data="allCheckedItems"
        :left-default-checked="allCheckedKeys"
        :titles="['可用文章', '已选文章']"
      />
    </section>

    <section
      v-loading="true"
      class="transfer-responsive__case"
      data-testid="transfer-loading"
      v-bind="{ 'data-state': 'loading' }"
    >
      <h2>加载中</h2>
      <el-transfer
        v-model="loadingSelected"
        :data="items"
        :titles="['可用文章', '已选文章']"
      />
    </section>

    <section
      class="transfer-responsive__case"
      data-testid="transfer-empty"
      v-bind="{ 'data-state': 'empty' }"
    >
      <h2>暂无文章</h2>
      <el-transfer
        v-model="emptySelected"
        :data="[]"
        :titles="['可用文章', '已选文章']"
      />
    </section>
  </main>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const labels = [
  '季度复盘：内容增长与订阅留存',
  '发布前检查清单',
  '设计系统升级记录',
  '搜索索引迁移计划',
  '移动端阅读体验回顾',
  '评论权限调整说明',
  '首页推荐策略',
  '附件存储迁移',
  '公开缓存预热',
  '回滚演练记录',
]

const items = labels.map((label, index) => ({
  key: index + 1,
  label,
  disabled: index === 5,
}))
const selected = ref<Array<string | number>>([2, 7])

const longTitle =
  '这是一条在窄屏中需要省略显示，但仍应通过 title 读取完整内容的超长文章标题'
const longItems = [
  { key: 1, label: longTitle },
  { key: 2, label: '短标题' },
]
const longSelected = ref<Array<string | number>>([])

const disabledItems = [
  { key: 1, label: '需要管理员权限', disabled: true },
  { key: 2, label: '普通文章', disabled: false },
  { key: 3, label: '归档文章', disabled: true },
]
const disabledSelected = ref<Array<string | number>>([])

const allCheckedItems = [
  { key: 1, label: '发布前检查清单' },
  { key: 2, label: '首页推荐策略' },
  { key: 3, label: '回滚演练记录' },
]
const allCheckedKeys = allCheckedItems.map(({ key }) => key)
const allCheckedSelected = ref<Array<string | number>>([])

const loadingSelected = ref<Array<string | number>>([])
const emptySelected = ref<Array<string | number>>([])
</script>

<style scoped>
.transfer-responsive {
  display: grid;
  gap: 24px;
  min-width: 0;
  max-width: 1100px;
  margin: 0 auto;
}

.transfer-responsive__header {
  max-width: 680px;
}

.transfer-responsive__header h1,
.transfer-responsive__header p,
.transfer-responsive__case h2 {
  margin: 0;
}

.transfer-responsive__header h1 {
  font-size: clamp(24px, 4vw, 36px);
  line-height: 1.2;
}

.transfer-responsive__header > p:last-child {
  margin-top: 8px;
  color: var(--el-text-color-secondary);
  line-height: 1.6;
}

.transfer-responsive__eyebrow {
  margin-bottom: 6px !important;
  color: var(--el-color-primary);
  font-size: 13px;
  font-weight: 700;
}

.transfer-responsive__case {
  min-width: 0;
  padding: 16px;
  border: 1px solid var(--fsus-border);
  border-radius: 12px;
  background: var(--el-bg-color);
  box-sizing: border-box;
}

.transfer-responsive__case h2 {
  margin-bottom: 12px;
  font-size: 16px;
  line-height: 1.4;
}

@media (max-width: 480px) {
  .transfer-responsive {
    gap: 16px;
  }

  .transfer-responsive__case {
    padding: 12px;
  }
}
</style>
