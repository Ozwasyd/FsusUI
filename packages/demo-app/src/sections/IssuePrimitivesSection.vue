<template>
  <ElPublicShell
    brand="Fsus"
    active-nav="archive"
    auth-label="Login"
    auth-href="/login"
    :nav-items="navItems"
    :search-query="searchQuery"
    :spa-search="true"
    search-placeholder="Search"
    hydration-kind="IssuePrimitives"
    @search="handleSearch"
    @update:search-query="searchQuery = $event"
  >
    <template #desktop-actions>
      <ElThemeModeToggle visibility="desktop" compact />
    </template>

    <template #mobile-actions>
      <ElThemeModeToggle visibility="mobile" compact />
    </template>

    <section class="issue-primitives">
      <header class="issue-primitives__header">
        <h2>Issue #1 primitives</h2>
        <el-button text type="primary" inline-action>
          Platform guidelines
        </el-button>
      </header>

      <div class="issue-primitives__empty-grid">
        <ElEmptyState
          title="No rows"
          description="Adjust filters and try again."
        >
          <el-button text type="primary" inline-action>Clear filters</el-button>
        </ElEmptyState>

        <ElEmptyState
          size="compact"
          title="Nothing selected"
          description="Select an item to view details."
        >
          <el-button>Browse items</el-button>
        </ElEmptyState>

        <ElEmptyState
          size="page"
          title="No results"
          description="Try a broader search term."
          action-variant="primary"
        >
          <el-button type="primary">Create item</el-button>
        </ElEmptyState>
      </div>

      <div class="issue-primitives__metrics-demo">
        <ElKpiGroup :density="compact ? 'compact' : 'default'">
          <ElMetricList :density="compact ? 'compact' : 'default'">
            <ElMetricItem
              label="Metric Alpha"
              primary="P75 22ms"
              :secondary="['Avg 23ms', 'Min 8ms']"
              meta="58 samples"
              :density="compact ? 'compact' : 'default'"
            />
            <ElMetricItem
              label="Metric Beta"
              primary="99.4%"
              secondary="Target 99%"
              meta="12 checks"
              :density="compact ? 'compact' : 'default'"
            />
          </ElMetricList>

          <ElKeyValueGrid :density="compact ? 'compact' : 'default'">
            <ElKeyValueItem label="State" value="Ready" tone="success">
              <template #badge>
                <el-tag size="small" type="success">OK</el-tag>
              </template>
            </ElKeyValueItem>
            <ElKeyValueItem label="Queue" value="0 / 0" monospace />
            <ElKeyValueItem label="Optional" />
          </ElKeyValueGrid>
        </ElKpiGroup>

        <ElDistributionList :density="compact ? 'compact' : 'default'">
          <ElDistributionBarRow
            rank="1"
            label="Segment Alpha"
            value="245"
            :ratio="1"
            :density="compact ? 'compact' : 'default'"
          />
          <ElDistributionBarRow
            rank="2"
            label="Segment Beta"
            value="106"
            :ratio="0.43"
            :density="compact ? 'compact' : 'default'"
          />
          <ElDistributionBarRow
            rank="3"
            label="Segment Gamma"
            value="31"
            :ratio="0.13"
            :density="compact ? 'compact' : 'default'"
          />
        </ElDistributionList>

        <ElStatusSummary
          label="Generic status"
          status="Stable"
          updated-at="2026-06-14 20:30"
          tone="success"
          :density="compact ? 'compact' : 'default'"
        >
          <template #detail>
            Product-owned detail copy can describe the current state.
          </template>
          <template #actions>
            <el-button text size="small">Inspect</el-button>
          </template>
        </ElStatusSummary>

        <ElDiagnosticsList :density="compact ? 'compact' : 'default'">
          <ElDiagnosticsItem
            title="diagnostic.event"
            message="Recent event summary supplied by the product."
            meta="warning - 17:48:11 - 3 times"
            detail="diagnostic-node:runCheck:sample-0001"
            tone="warning"
            :density="compact ? 'compact' : 'default'"
          >
            <template #actions>
              <ElCopyableDetail
                value="diagnostic-node:runCheck:sample-0001"
                label="Copy detail"
                inline
              />
            </template>
          </ElDiagnosticsItem>
          <ElDiagnosticsItem title="No diagnostic rows">
            <ElEmptyState
              size="inline"
              title="No diagnostics"
              description="Downstream apps supply operational copy."
            />
          </ElDiagnosticsItem>
        </ElDiagnosticsList>
      </div>

      <ElResponsiveCollection
        :items="rows"
        row-key="id"
        :compact="compact"
        ariaLabel="Responsive article list"
      >
        <template #table="{ items }">
          <div class="issue-primitives__table">
            <div
              v-for="item in items"
              :key="getRowId(item)"
              class="issue-primitives__row"
            >
              <strong>{{ getRowTitle(item) }}</strong>
              <span>{{ getRowMeta(item) }}</span>
            </div>
          </div>
        </template>

        <template #card="{ item }">
          <article class="issue-primitives__card">
            <strong>{{ getRowTitle(item) }}</strong>
            <span>{{ getRowMeta(item) }}</span>
            <el-button text type="primary" inline-action>Edit</el-button>
          </article>
        </template>
      </ElResponsiveCollection>

      <el-upload
        media-field
        media-aspect-ratio="1200 / 630"
        action="#"
        :auto-upload="false"
        :show-file-list="false"
      >
        <div class="issue-primitives__upload-surface">
          <span>Upload cover</span>
        </div>
      </el-upload>
    </section>

    <template #footer>
      <div class="issue-primitives__footer">Fsus public shell footer</div>
    </template>
  </ElPublicShell>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import {
  ElCopyableDetail,
  ElDiagnosticsItem,
  ElDiagnosticsList,
  ElDistributionBarRow,
  ElDistributionList,
  ElEmptyState,
  ElKeyValueGrid,
  ElKeyValueItem,
  ElKpiGroup,
  ElMetricItem,
  ElMetricList,
  ElPublicShell,
  ElResponsiveCollection,
  ElStatusSummary,
  ElThemeModeToggle,
} from '../../../element-plus'

defineProps<{
  compact?: boolean
}>()

const searchQuery = ref('')
const navItems = [
  { key: 'home', label: 'Home', href: '/' },
  { key: 'archive', label: 'Archive', href: '/archive' },
  { key: 'about', label: 'About', href: '/about' },
]
const rows = [
  { id: 1, title: 'Layout primitives', meta: '42 views' },
  { id: 2, title: 'Media upload field', meta: 'Draft' },
]

const normalizeRow = (item: unknown) =>
  item as { id: number; title: string; meta: string }
const getRowId = (item: unknown) => normalizeRow(item).id
const getRowTitle = (item: unknown) => normalizeRow(item).title
const getRowMeta = (item: unknown) => normalizeRow(item).meta

const handleSearch = (query: string) => {
  searchQuery.value = query
}
</script>
