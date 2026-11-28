<template>
  <FsusPublicShell
    brand="Fsus"
    active-nav="archive"
    auth-label="Login"
    auth-href="/login"
    :nav-items="navItems"
    :search-query="searchQuery"
    :spa-search="true"
    mobile-nav-mode="menu"
    mobile-nav-label="Primary sections"
    mobile-nav-menu-label="Menu"
    mobile-search-mode="trigger"
    search-aria-label="搜索"
    search-placeholder="搜索文章、标签或关键词"
    hydration-kind="IssuePrimitives"
    @search="handleSearch"
    @update:search-query="searchQuery = $event"
  >
    <template #desktop-actions>
      <FsusThemeModeToggle visibility="desktop" compact />
    </template>

    <template #mobile-primary-actions>
      <FsusThemeModeToggle
        visibility="mobile"
        variant="menu-button"
        label="外观模式"
        :labels="themeModeLabels"
      />
    </template>

    <section class="issue-primitives">
      <header class="issue-primitives__header">
        <h2>Issue #1 primitives</h2>
        <fsus-button text type="primary" inline-action>
          Platform guidelines
        </fsus-button>
      </header>

      <section
        class="issue-primitives__task-page-header-demo"
        aria-labelledby="task-page-header-fixtures-title"
      >
        <h3 id="task-page-header-fixtures-title">
          Task page header comparisons
        </h3>
        <div class="issue-primitives__task-page-header-comparisons">
          <article
            v-for="fixture in taskPageHeaderFixtures"
            :key="fixture.key"
            class="issue-primitives__task-page-header-comparison"
          >
            <p class="issue-primitives__task-page-header-context">
              {{ fixture.context }}
            </p>
            <div class="issue-primitives__task-page-header-pair">
              <div class="issue-primitives__task-page-header-surface">
                <span class="issue-primitives__task-page-header-variant">
                  Before
                </span>
                <header class="issue-primitives__legacy-page-header">
                  <span class="issue-primitives__legacy-page-header-eyebrow">
                    {{ fixture.context }} workspace
                  </span>
                  <h4>{{ fixture.title }}</h4>
                  <p v-if="fixture.description">
                    {{ fixture.description }}
                  </p>
                  <div
                    v-if="fixture.action"
                    class="issue-primitives__legacy-page-header-actions"
                  >
                    <fsus-button size="small">{{ fixture.action }}</fsus-button>
                  </div>
                </header>
              </div>

              <div class="issue-primitives__task-page-header-surface">
                <span class="issue-primitives__task-page-header-variant">
                  After
                </span>
                <FsusPageHeader
                  :title="fixture.title"
                  :description="fixture.description"
                  title-tag="h4"
                  :density="compact ? 'compact' : 'default'"
                >
                  <template v-if="fixture.action" #actions>
                    <fsus-button size="small">{{ fixture.action }}</fsus-button>
                  </template>
                </FsusPageHeader>
              </div>
            </div>
          </article>
        </div>
      </section>

      <div class="issue-primitives__site-header-fixtures">
        <FsusSiteHeader
          :sticky="false"
          max-width="100%"
          ariaLabel="Blog header fixture"
        >
          <template #brand>
            <a href="#blog-header">Blog</a>
          </template>
          <template #desktop-nav>
            <a href="#home">Home</a>
            <a href="#archive">Archive</a>
          </template>
          <template #desktop-actions>
            <FsusThemeModeToggle visibility="desktop" compact />
          </template>
          <template #mobile-primary-actions>
            <FsusThemeModeToggle visibility="mobile" variant="menu-button" />
          </template>
        </FsusSiteHeader>

        <FsusSiteHeader
          :sticky="false"
          max-width="100%"
          ariaLabel="Auth header fixture"
        >
          <template #brand>
            <a href="#auth-header">Auth</a>
          </template>
          <template #desktop-actions>
            <a href="#register">Register</a>
          </template>
          <template #mobile-primary-actions>
            <a href="#register-mobile">Register</a>
          </template>
        </FsusSiteHeader>

        <FsusSiteHeader
          :sticky="false"
          max-width="100%"
          ariaLabel="Workspace header fixture"
        >
          <template #brand>
            <a href="#workspace-header">Workspace</a>
          </template>
          <template #desktop-actions>
            <a href="#main-site">Main site</a>
            <button type="button">Sign out</button>
          </template>
          <template #mobile-overflow-trigger>
            <button type="button">Menu</button>
          </template>
          <template #mobile-secondary-actions>
            <a href="#workspace-settings">Settings</a>
          </template>
        </FsusSiteHeader>
      </div>

      <div class="issue-primitives__empty-grid">
        <FsusEmptyState
          title="No rows"
          description="Adjust filters and try again."
        >
          <fsus-button text type="primary" inline-action>Clear filters</fsus-button>
        </FsusEmptyState>

        <FsusEmptyState
          size="compact"
          title="Nothing selected"
          description="Select an item to view details."
        >
          <fsus-button>Browse items</fsus-button>
        </FsusEmptyState>

        <FsusEmptyState
          size="page"
          title="No results"
          description="Try a broader search term."
          action-variant="primary"
        >
          <fsus-button type="primary">Create item</fsus-button>
        </FsusEmptyState>
      </div>

      <div class="issue-primitives__collection-panel">
        <FsusCollectionToolbar ariaLabel="Collection controls">
          <template #primary>
            <fsus-input v-model="collectionQuery" placeholder="Search" />
          </template>

          <template #filters>
            <FsusFilterGroup label="State">
              <FsusSegmentedControl
                v-model="collectionState"
                :items="collectionStateItems"
                ariaLabel="Filter state"
              />
            </FsusFilterGroup>
          </template>

          <template #actions>
            <fsus-button>Refresh</fsus-button>
          </template>
        </FsusCollectionToolbar>

        <FsusCollectionSummary
          title="Results"
          :total="12"
          :visible="rows.length"
          state="Filtered"
        />
      </div>

      <div class="issue-primitives__settings-demo">
        <FsusSectionNav
          ariaLabel="Settings primitive sections"
          :items="settingsNavItems"
          :density="compact ? 'compact' : 'default'"
        />

        <div class="issue-primitives__settings-grid">
          <FsusSettingsSection
            id="settings-overview"
            title="Generic settings"
            description="Reusable section structure with product-owned copy."
            title-tag="h3"
            :density="compact ? 'compact' : 'default'"
          >
            <template #actions>
              <fsus-button size="small">Save</fsus-button>
            </template>

            <FsusSectionHeader
              title="Standalone header"
              description="Use this when a page needs only the header primitive."
              title-tag="h4"
              :density="compact ? 'compact' : 'default'"
            />

            <FsusFormSection
              title="Form-compatible group"
              description="The consuming form owns labels, validation, and submit."
              title-tag="h4"
              :density="compact ? 'compact' : 'default'"
            >
              <label class="issue-primitives__field">
                Label
                <input value="Neutral value" />
              </label>
            </FsusFormSection>
          </FsusSettingsSection>

          <FsusSettingsSection
            id="settings-resources"
            title="Resource list"
            description="Rows support metadata, badges, inline actions, and local empty states."
            title-tag="h3"
            :density="compact ? 'compact' : 'default'"
          >
            <FsusResourceList :density="compact ? 'compact' : 'default'">
              <FsusResourceListItem
                title="Resource Alpha"
                description="Updated recently"
                :density="compact ? 'compact' : 'default'"
              >
                <template #badge>
                  <fsus-tag size="small" type="info">Ready</fsus-tag>
                </template>

                <FsusMetadataRow :density="compact ? 'compact' : 'default'">
                  <FsusMetadataItem label="Created" value="2026-01-01" />
                  <FsusMetadataItem
                    label="Fingerprint"
                    value="A1B2-C3D4"
                    monospace
                  />
                  <FsusMetadataItem label="Optional" />
                </FsusMetadataRow>

                <template #actions>
                  <FsusInlineActions ariaLabel="Resource actions">
                    <fsus-button text size="small">Edit</fsus-button>
                    <fsus-button text size="small">Disable</fsus-button>
                  </FsusInlineActions>
                </template>
              </FsusResourceListItem>

              <FsusResourceListItem title="Empty resource group">
                <FsusEmptyState
                  size="inline"
                  title="No resources"
                  description="Downstream apps supply the exact copy."
                >
                  <fsus-button text type="primary" inline-action>
                    Add resource
                  </fsus-button>
                </FsusEmptyState>
              </FsusResourceListItem>
            </FsusResourceList>
          </FsusSettingsSection>
        </div>

        <FsusDangerZone
          id="settings-risk"
          title="Risk area"
          description="Danger content uses explicit text in addition to color."
          title-tag="h3"
          :density="compact ? 'compact' : 'default'"
        >
          <FsusRiskNotice title="Review" role="note">
            Confirm the impact before continuing.
          </FsusRiskNotice>

          <FsusDestructiveActionPanel title="Destructive action">
            <template #description>
              Product copy explains outcome, recovery, and permissions.
            </template>
            <template #actions>
              <fsus-button type="danger" size="small">Continue</fsus-button>
            </template>
          </FsusDestructiveActionPanel>

          <FsusTypedConfirmField
            v-model="confirmation"
            phrase="CONFIRM"
            label="Confirmation phrase"
            description="Type the exact phrase to continue."
          />
        </FsusDangerZone>
      </div>

      <div class="issue-primitives__metrics-demo">
        <FsusKpiGroup :density="compact ? 'compact' : 'default'">
          <FsusMetricList :density="compact ? 'compact' : 'default'">
            <FsusMetricItem
              label="Metric Alpha"
              primary="P75 22ms"
              :secondary="['Avg 23ms', 'Min 8ms']"
              meta="58 samples"
              :density="compact ? 'compact' : 'default'"
            />
            <FsusMetricItem
              label="Metric Beta"
              primary="99.4%"
              secondary="Target 99%"
              meta="12 checks"
              :density="compact ? 'compact' : 'default'"
            />
          </FsusMetricList>

          <FsusKeyValueGrid :density="compact ? 'compact' : 'default'">
            <FsusKeyValueItem label="State" value="Ready" tone="success">
              <template #badge>
                <fsus-tag size="small" type="success">OK</fsus-tag>
              </template>
            </FsusKeyValueItem>
            <FsusKeyValueItem label="Queue" value="0 / 0" monospace />
            <FsusKeyValueItem label="Optional" />
          </FsusKeyValueGrid>
        </FsusKpiGroup>

        <FsusDistributionList :density="compact ? 'compact' : 'default'">
          <FsusDistributionBarRow
            rank="1"
            label="Segment Alpha"
            value="245"
            :ratio="1"
            :density="compact ? 'compact' : 'default'"
          />
          <FsusDistributionBarRow
            rank="2"
            label="Segment Beta"
            value="106"
            :ratio="0.43"
            :density="compact ? 'compact' : 'default'"
          />
          <FsusDistributionBarRow
            rank="3"
            label="Segment Gamma"
            value="31"
            :ratio="0.13"
            :density="compact ? 'compact' : 'default'"
          />
        </FsusDistributionList>

        <FsusStatusSummary
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
            <fsus-button text size="small">Inspect</fsus-button>
          </template>
        </FsusStatusSummary>

        <FsusDiagnosticsList :density="compact ? 'compact' : 'default'">
          <FsusDiagnosticsItem
            title="diagnostic.event"
            message="Recent event summary supplied by the product."
            meta="warning - 17:48:11 - 3 times"
            detail="diagnostic-node:runCheck:sample-0001"
            tone="warning"
            :density="compact ? 'compact' : 'default'"
          >
            <template #actions>
              <FsusCopyableDetail
                value="diagnostic-node:runCheck:sample-0001"
                label="Copy detail"
                inline
              />
            </template>
          </FsusDiagnosticsItem>
          <FsusDiagnosticsItem title="No diagnostic rows">
            <FsusEmptyState
              size="inline"
              title="No diagnostics"
              description="Downstream apps supply operational copy."
            />
          </FsusDiagnosticsItem>
        </FsusDiagnosticsList>
      </div>

      <FsusResponsiveCollection
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
            <fsus-button text type="primary" inline-action>Edit</fsus-button>
          </article>
        </template>
      </FsusResponsiveCollection>

      <FsusPaginationBar ariaLabel="Results pagination">
        <template #summary>Page 1 of 6</template>
        <template #pagination>
          <fsus-pagination small layout="prev, pager, next" :total="12" />
        </template>
      </FsusPaginationBar>

      <fsus-upload
        media-field
        media-aspect-ratio="1200 / 630"
        action="#"
        :auto-upload="false"
        :show-file-list="false"
      >
        <div class="issue-primitives__upload-surface">
          <span>Upload cover</span>
        </div>
      </fsus-upload>

      <FsusInboxLayout
        class="issue-primitives__inbox-demo"
        selected
        mobile-pane="detail"
        list-label="Generic item list"
        detail-label="Generic thread detail"
      >
        <template #list>
          <FsusConversationList ariaLabel="Generic conversation list">
            <FsusConversationListItem
              title="关于评论权限的讨论"
              preview="长摘要内容仍然需要留在列表列宽内。"
              meta="09:00"
              :selected="selectedInboxItem === 'alpha'"
              :unread-count="2"
              @select="selectedInboxItem = 'alpha'"
            >
              <template #badges>
                <fsus-tag size="small" type="info">Ready</fsus-tag>
              </template>
            </FsusConversationListItem>
            <FsusConversationListItem
              title="下周封面图评审"
              preview="第二条工作流摘要保持安全换行。"
              meta="10:30"
              :selected="selectedInboxItem === 'beta'"
              @select="selectedInboxItem = 'beta'"
            />
            <FsusInboxEmptyState
              title="No more items"
              description="Adjust filters or broaden the current view."
            />
          </FsusConversationList>
        </template>

        <template #detail>
          <FsusThreadPanel title="评论权限讨论">
            <template #back>
              <fsus-button text inline-action>Back</fsus-button>
            </template>
            <template #status>
              <fsus-tag size="small" type="info">Ready</fsus-tag>
            </template>
            <template #actions>
              <fsus-button text type="primary" inline-action>Open</fsus-button>
            </template>
            <template #context>
              <FsusConversationContextBar>
                <span>Kind: Generic</span>
                <span>Source: Neutral</span>
                <span>Mode: Slot-first</span>
              </FsusConversationContextBar>
            </template>
            <template #messages>
              <FsusMessageTimeline>
                <FsusMessageBubble author="A" meta="09:00">
                  The message body preserves line breaks and wraps long text
                  without product-specific sender labels.
                </FsusMessageBubble>
                <FsusMessageBubble variant="self" author="B" meta="09:10">
                  Slot-first reply content remains generic.
                </FsusMessageBubble>
                <FsusMessageBubble variant="system">
                  Generic state changed.
                </FsusMessageBubble>
                <FsusMessageBubble variant="muted">
                  Muted note with neutral supporting copy.
                </FsusMessageBubble>
              </FsusMessageTimeline>
            </template>
            <template #composer>
              <FsusReplyComposerShell title="Reply">
                <template #input>
                  <fsus-input
                    type="textarea"
                    model-value=""
                    label="Reply body"
                    placeholder="Write a reply"
                  />
                </template>
                <template #actions>
                  <fsus-button type="primary">Send</fsus-button>
                </template>
              </FsusReplyComposerShell>
            </template>
          </FsusThreadPanel>
          <FsusEmptySelectionState
            title="Select an item"
            description="Choose an item from the list to view details."
          />
        </template>
      </FsusInboxLayout>
    </section>

    <template #footer>
      <div class="issue-primitives__footer">Fsus public shell footer</div>
    </template>
  </FsusPublicShell>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import {
  FsusCollectionSummary,
  FsusCollectionToolbar,
  FsusConversationContextBar,
  FsusConversationList,
  FsusConversationListItem,
  FsusCopyableDetail,
  FsusDangerZone,
  FsusDiagnosticsItem,
  FsusDiagnosticsList,
  FsusDestructiveActionPanel,
  FsusDistributionBarRow,
  FsusDistributionList,
  FsusEmptySelectionState,
  FsusEmptyState,
  FsusFilterGroup,
  FsusFormSection,
  FsusInboxEmptyState,
  FsusInboxLayout,
  FsusInlineActions,
  FsusKeyValueGrid,
  FsusKeyValueItem,
  FsusKpiGroup,
  FsusMetadataItem,
  FsusMetadataRow,
  FsusMessageBubble,
  FsusMessageTimeline,
  FsusMetricItem,
  FsusMetricList,
  FsusPaginationBar,
  FsusPublicShell,
  FsusReplyComposerShell,
  FsusResourceList,
  FsusResourceListItem,
  FsusRiskNotice,
  FsusSectionHeader,
  FsusSectionNav,
  FsusSettingsSection,
  FsusResponsiveCollection,
  FsusSegmentedControl,
  FsusSiteHeader,
  FsusStatusSummary,
  FsusPageHeader,
  FsusThemeModeToggle,
  FsusThreadPanel,
  FsusTypedConfirmField,
  type SegmentedControlValue,
} from '@ozwasyd/fsusui'

defineProps<{
  compact?: boolean
}>()

const searchQuery = ref('')
const collectionQuery = ref('')
const collectionState = ref<SegmentedControlValue>('all')
const confirmation = ref('CONF')
const selectedInboxItem = ref('alpha')
const themeModeLabels = {
  light: '浅色',
  dark: '深色',
  system: '跟随系统',
  lightShort: '浅',
  darkShort: '深',
  systemShort: '系统',
}
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
const taskPageHeaderFixtures = [
  {
    key: 'account',
    context: 'Account',
    title: 'Profile and security',
    description: 'Manage profile details and sign-in preferences.',
    action: 'Edit profile',
  },
  {
    key: 'dashboard',
    context: 'Dashboard',
    title: 'Operations overview',
    description: 'Review the latest health and delivery signals.',
    action: 'Refresh',
  },
  {
    key: 'collection',
    context: 'Collection',
    title: 'Article collection',
    description: 'Filter, review, and export the current result set.',
    action: 'Create item',
  },
  {
    key: 'form',
    context: 'Form',
    title: 'Edit resource',
    description: 'Update the fields required by this workflow.',
    action: 'Save',
  },
  {
    key: 'settings',
    context: 'Settings',
    title: 'Notification preferences',
    description: '',
    action: '',
  },
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
