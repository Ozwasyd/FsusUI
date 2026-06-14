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

      <div class="issue-primitives__settings-demo">
        <ElSectionNav
          ariaLabel="Settings primitive sections"
          :items="settingsNavItems"
          :density="compact ? 'compact' : 'default'"
        />

        <div class="issue-primitives__settings-grid">
          <ElSettingsSection
            id="settings-overview"
            title="Generic settings"
            description="Reusable section structure with product-owned copy."
            title-tag="h3"
            :density="compact ? 'compact' : 'default'"
          >
            <template #actions>
              <el-button size="small">Save</el-button>
            </template>

            <ElSectionHeader
              title="Standalone header"
              description="Use this when a page needs only the header primitive."
              title-tag="h4"
              :density="compact ? 'compact' : 'default'"
            />

            <ElFormSection
              title="Form-compatible group"
              description="The consuming form owns labels, validation, and submit."
              title-tag="h4"
              :density="compact ? 'compact' : 'default'"
            >
              <label class="issue-primitives__field">
                Label
                <input value="Neutral value" />
              </label>
            </ElFormSection>
          </ElSettingsSection>

          <ElSettingsSection
            id="settings-resources"
            title="Resource list"
            description="Rows support metadata, badges, inline actions, and local empty states."
            title-tag="h3"
            :density="compact ? 'compact' : 'default'"
          >
            <ElResourceList :density="compact ? 'compact' : 'default'">
              <ElResourceListItem
                title="Resource Alpha"
                description="Updated recently"
                :density="compact ? 'compact' : 'default'"
              >
                <template #badge>
                  <el-tag size="small" type="info">Ready</el-tag>
                </template>

                <ElMetadataRow :density="compact ? 'compact' : 'default'">
                  <ElMetadataItem label="Created" value="2026-01-01" />
                  <ElMetadataItem
                    label="Fingerprint"
                    value="A1B2-C3D4"
                    monospace
                  />
                  <ElMetadataItem label="Optional" />
                </ElMetadataRow>

                <template #actions>
                  <ElInlineActions ariaLabel="Resource actions">
                    <el-button text size="small">Edit</el-button>
                    <el-button text size="small">Disable</el-button>
                  </ElInlineActions>
                </template>
              </ElResourceListItem>

              <ElResourceListItem title="Empty resource group">
                <ElEmptyState
                  size="inline"
                  title="No resources"
                  description="Downstream apps supply the exact copy."
                >
                  <el-button text type="primary" inline-action>
                    Add resource
                  </el-button>
                </ElEmptyState>
              </ElResourceListItem>
            </ElResourceList>
          </ElSettingsSection>
        </div>

        <ElDangerZone
          id="settings-risk"
          title="Risk area"
          description="Danger content uses explicit text in addition to color."
          title-tag="h3"
          :density="compact ? 'compact' : 'default'"
        >
          <ElRiskNotice title="Review" role="note">
            Confirm the impact before continuing.
          </ElRiskNotice>

          <ElDestructiveActionPanel title="Destructive action">
            <template #description>
              Product copy explains outcome, recovery, and permissions.
            </template>
            <template #actions>
              <el-button type="danger" size="small">Continue</el-button>
            </template>
          </ElDestructiveActionPanel>

          <ElTypedConfirmField
            v-model="confirmation"
            phrase="CONFIRM"
            label="Confirmation phrase"
            description="Type the exact phrase to continue."
          />
        </ElDangerZone>
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
  ElDangerZone,
  ElDestructiveActionPanel,
  ElEmptyState,
  ElFormSection,
  ElInlineActions,
  ElMetadataItem,
  ElMetadataRow,
  ElPublicShell,
  ElResourceList,
  ElResourceListItem,
  ElRiskNotice,
  ElSectionHeader,
  ElSectionNav,
  ElSettingsSection,
  ElResponsiveCollection,
  ElThemeModeToggle,
  ElTypedConfirmField,
} from '../../../element-plus'

defineProps<{
  compact?: boolean
}>()

const searchQuery = ref('')
const confirmation = ref('CONF')
const navItems = [
  { key: 'home', label: 'Home', href: '/' },
  { key: 'archive', label: 'Archive', href: '/archive' },
  { key: 'about', label: 'About', href: '/about' },
]
const settingsNavItems = [
  {
    key: 'overview',
    label: 'Overview',
    href: '#settings-overview',
    current: true,
  },
  { key: 'resources', label: 'Resources', href: '#settings-resources' },
  { key: 'risk', label: 'Risk', href: '#settings-risk' },
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
