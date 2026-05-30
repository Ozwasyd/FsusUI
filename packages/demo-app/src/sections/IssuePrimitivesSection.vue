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

      <el-empty
        description="Long public boundary text wraps safely without a downstream description wrapper."
        description-layout="wide"
        :description-width="384"
      >
        <el-button type="primary">Retry</el-button>
      </el-empty>

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
  ElPublicShell,
  ElResponsiveCollection,
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
