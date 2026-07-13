<template>
  <section
    class="empty-illustration-fixture"
    data-testid="empty-illustration-fixture"
  >
    <header class="empty-illustration-fixture__header">
      <p>Empty-state guidance</p>
      <h1>Explain what is missing and offer the next useful step.</h1>
    </header>

    <div class="empty-illustration-fixture__grid">
      <article
        class="empty-illustration-fixture__panel empty-illustration-fixture__panel--default"
        v-bind="{ 'data-empty-variant': 'default' }"
      >
        <h2>Default ElEmpty</h2>
        <ElEmpty
          description="No archived documents yet. Import one to start this collection."
        >
          <ElButton>Import document</ElButton>
        </ElEmpty>
      </article>

      <article
        class="empty-illustration-fixture__panel"
        v-bind="{ 'data-empty-variant': 'inline' }"
      >
        <h2>Inline</h2>
        <FsusEmptyState
          title="No matching rows"
          description="The current filters exclude every row."
        >
          <ElButton text type="primary" inline-action>Clear filters</ElButton>
        </FsusEmptyState>
      </article>

      <article
        class="empty-illustration-fixture__panel"
        v-bind="{ 'data-empty-variant': 'compact' }"
      >
        <h2>Compact</h2>
        <FsusEmptyState
          size="compact"
          title="Nothing selected"
          description="Choose a document to inspect its metadata."
        >
          <ElButton>Browse documents</ElButton>
        </FsusEmptyState>
      </article>

      <article
        class="empty-illustration-fixture__panel empty-illustration-fixture__panel--page"
        v-bind="{ 'data-empty-variant': 'page' }"
      >
        <h2>Page</h2>
        <FsusEmptyState
          size="page"
          title="The archive is empty"
          description="Import an existing document or create the first entry."
        >
          <ElButton>Create entry</ElButton>
        </FsusEmptyState>
      </article>
    </div>
  </section>
</template>

<script lang="ts" setup>
import { ElButton, ElEmpty, FsusEmptyState } from '../../../element-plus'
</script>

<style scoped>
.empty-illustration-fixture {
  min-height: 100vh;
  padding: 48px;
  background: var(--el-bg-color-page);
  color: var(--el-text-color-primary);
  box-sizing: border-box;
}

.empty-illustration-fixture__header,
.empty-illustration-fixture__grid {
  width: min(100%, 72rem);
  margin-inline: auto;
}

.empty-illustration-fixture__header {
  margin-bottom: 32px;
}

.empty-illustration-fixture__header p,
.empty-illustration-fixture__panel h2 {
  margin: 0;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.empty-illustration-fixture__header h1 {
  max-width: 28ch;
  margin: 8px 0 0;
  font-size: 30px;
  line-height: 1.25;
}

.empty-illustration-fixture__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px;
}

.empty-illustration-fixture__panel {
  min-height: 15rem;
  padding: 24px;
  border: 1px solid var(--el-border-color-lighter);
  background: var(--el-bg-color);
  box-sizing: border-box;
}

.empty-illustration-fixture__panel--default,
.empty-illustration-fixture__panel--page {
  min-height: 24rem;
}

@media (max-width: 767px) {
  .empty-illustration-fixture {
    padding: 24px;
  }

  .empty-illustration-fixture__grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
