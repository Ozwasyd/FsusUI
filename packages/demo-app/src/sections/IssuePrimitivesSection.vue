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

    <template #mobile-primary-actions>
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

      <div class="issue-primitives__collection-panel">
        <ElCollectionToolbar ariaLabel="Collection controls">
          <template #primary>
            <el-input v-model="collectionQuery" placeholder="Search" />
          </template>

          <template #filters>
            <ElFilterGroup label="State">
              <ElSegmentedControl
                v-model="collectionState"
                :items="collectionStateItems"
                ariaLabel="Filter state"
              />
            </ElFilterGroup>
          </template>

          <template #actions>
            <el-button>Refresh</el-button>
          </template>
        </ElCollectionToolbar>

        <ElCollectionSummary
          title="Results"
          :total="12"
          :visible="rows.length"
          state="Filtered"
        />
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

      <ElPaginationBar ariaLabel="Results pagination">
        <template #summary>Page 1 of 6</template>
        <template #pagination>
          <el-pagination small layout="prev, pager, next" :total="12" />
        </template>
      </ElPaginationBar>

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

      <ElInboxLayout
        class="issue-primitives__inbox-demo"
        selected
        mobile-pane="detail"
        list-label="Generic item list"
        detail-label="Generic thread detail"
      >
        <template #list>
          <ElConversationList ariaLabel="Generic conversation list">
            <ElConversationListItem
              title="关于评论权限的讨论"
              preview="长摘要内容仍然需要留在列表列宽内。"
              meta="09:00"
              :selected="selectedInboxItem === 'alpha'"
              :unread-count="2"
              @select="selectedInboxItem = 'alpha'"
            >
              <template #badges>
                <el-tag size="small" type="info">Ready</el-tag>
              </template>
            </ElConversationListItem>
            <ElConversationListItem
              title="下周封面图评审"
              preview="第二条工作流摘要保持安全换行。"
              meta="10:30"
              :selected="selectedInboxItem === 'beta'"
              @select="selectedInboxItem = 'beta'"
            />
            <ElInboxEmptyState
              title="No more items"
              description="Adjust filters or broaden the current view."
            />
          </ElConversationList>
        </template>

        <template #detail>
          <ElThreadPanel title="评论权限讨论">
            <template #back>
              <el-button text inline-action>Back</el-button>
            </template>
            <template #status>
              <el-tag size="small" type="info">Ready</el-tag>
            </template>
            <template #actions>
              <el-button text type="primary" inline-action>Open</el-button>
            </template>
            <template #context>
              <ElConversationContextBar>
                <span>Kind: Generic</span>
                <span>Source: Neutral</span>
                <span>Mode: Slot-first</span>
              </ElConversationContextBar>
            </template>
            <template #messages>
              <ElMessageTimeline>
                <ElMessageBubble author="A" meta="09:00">
                  The message body preserves line breaks and wraps long text
                  without product-specific sender labels.
                </ElMessageBubble>
                <ElMessageBubble variant="self" author="B" meta="09:10">
                  Slot-first reply content remains generic.
                </ElMessageBubble>
                <ElMessageBubble variant="system">
                  Generic state changed.
                </ElMessageBubble>
                <ElMessageBubble variant="muted">
                  Muted note with neutral supporting copy.
                </ElMessageBubble>
              </ElMessageTimeline>
            </template>
            <template #composer>
              <ElReplyComposerShell title="Reply">
                <template #input>
                  <el-input
                    type="textarea"
                    model-value=""
                    label="Reply body"
                    placeholder="Write a reply"
                  />
                </template>
                <template #actions>
                  <el-button type="primary">Send</el-button>
                </template>
              </ElReplyComposerShell>
            </template>
          </ElThreadPanel>
          <ElEmptySelectionState
            title="Select an item"
            description="Choose an item from the list to view details."
          />
        </template>
      </ElInboxLayout>
    </section>

    <template #footer>
      <div class="issue-primitives__footer">Fsus public shell footer</div>
    </template>
  </ElPublicShell>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import {
  ElCollectionSummary,
  ElCollectionToolbar,
  ElConversationContextBar,
  ElConversationList,
  ElConversationListItem,
  ElCopyableDetail,
  ElDangerZone,
  ElDiagnosticsItem,
  ElDiagnosticsList,
  ElDestructiveActionPanel,
  ElDistributionBarRow,
  ElDistributionList,
  ElEmptySelectionState,
  ElEmptyState,
  ElFilterGroup,
  ElFormSection,
  ElInboxEmptyState,
  ElInboxLayout,
  ElInlineActions,
  ElKeyValueGrid,
  ElKeyValueItem,
  ElKpiGroup,
  ElMetadataItem,
  ElMetadataRow,
  ElMessageBubble,
  ElMessageTimeline,
  ElMetricItem,
  ElMetricList,
  ElPaginationBar,
  ElPublicShell,
  ElReplyComposerShell,
  ElResourceList,
  ElResourceListItem,
  ElRiskNotice,
  ElSectionHeader,
  ElSectionNav,
  ElSettingsSection,
  ElResponsiveCollection,
  ElSegmentedControl,
  ElStatusSummary,
  ElThemeModeToggle,
  ElThreadPanel,
  ElTypedConfirmField,
  type SegmentedControlValue,
} from '../../../element-plus'

defineProps<{
  compact?: boolean
}>()

const searchQuery = ref('')
const collectionQuery = ref('')
const collectionState = ref<SegmentedControlValue>('all')
const confirmation = ref('CONF')
const selectedInboxItem = ref('alpha')
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
const collectionStateItems = [
  { label: 'All', value: 'all' },
  { label: 'Open', value: 'open' },
  { label: 'Closed', value: 'closed' },
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
