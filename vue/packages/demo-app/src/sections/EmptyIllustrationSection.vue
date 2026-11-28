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
        <h2>Default FsusEmptyState</h2>
        <FsusEmptyState
          description="No archived documents yet. Import one to start this collection."
        >
          <FsusButton type="primary">Import document</FsusButton>
        </FsusEmptyState>
      </article>

      <article
        class="empty-illustration-fixture__panel"
        v-bind="{ 'data-empty-variant': 'no-action' }"
      >
        <h2>No action</h2>
        <FsusEmptyState
          size="compact"
          title="All review notes are resolved"
          description="New review notes will appear here when a teammate requests a change."
        />
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
          <FsusButton text type="primary" inline-action>Clear filters</FsusButton>
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
          <FsusButton>Browse documents</FsusButton>
        </FsusEmptyState>
      </article>

      <article
        class="empty-illustration-fixture__panel"
        v-bind="{ 'data-empty-variant': 'primary-secondary' }"
      >
        <h2>Primary and secondary</h2>
        <FsusEmptyState
          size="compact"
          action-variant="primary"
          title="No deployment target is configured"
          description="Choose the production workspace, then verify its release policy before the first deployment."
        >
          <FsusButton type="primary">Choose workspace</FsusButton>
          <FsusButton>Review release policy</FsusButton>
        </FsusEmptyState>
      </article>

      <article
        class="empty-illustration-fixture__panel"
        v-bind="{ 'data-empty-variant': 'disabled-loading' }"
      >
        <h2>Loading and disabled</h2>
        <FsusEmptyState
          size="compact"
          title="The archive is still being indexed"
          description="You can retry when indexing completes, or return to the document list without losing your filters."
        >
          <FsusButton type="primary" loading>Checking archive</FsusButton>
          <FsusButton disabled>Retry indexing</FsusButton>
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
          <FsusButton>Create entry</FsusButton>
        </FsusEmptyState>
      </article>
    </div>
  </section>
</template>

<script lang="ts" setup>
import { FsusButton, FsusEmptyState } from '@ozwasyd/fsusui'
</script>

<style scoped>
.empty-illustration-fixture {
  min-height: 100vh;
  padding: 48px;
  background: var(--fsus-color-surface-page);
  color: var(--fsus-color-text-primary);
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
  color: var(--fsus-color-text-quiet);
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
  border: 1px solid var(--fsus-color-border-lighter);
  background: var(--fsus-color-surface-base);
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
