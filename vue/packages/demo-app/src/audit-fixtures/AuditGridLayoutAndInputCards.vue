<template>
      <AuditCard name="FsusMetricList" :state="auditState">
        <div class="audit-metric-primitives">
          <FsusKpiGroup :density="compact ? 'compact' : 'default'">
            <FsusMetricList :density="compact ? 'compact' : 'default'">
              <FsusMetricItem
                label="Metric Alpha"
                primary="P75 22ms"
                secondary="Avg 23ms"
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
              <FsusKeyValueItem label="State" value="Ready" tone="success" />
              <FsusKeyValueItem label="Queue" value="0 / 0" monospace />
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
          </FsusDistributionList>

          <FsusStatusSummary
            label="Generic status"
            status="Stable"
            updated-at="2026-06-14 20:30"
            tone="success"
            :density="compact ? 'compact' : 'default'"
          >
            <template #detail>Product-owned detail copy.</template>
            <template #actions>
              <fsus-button size="small">Inspect</fsus-button>
            </template>
          </FsusStatusSummary>

          <FsusDiagnosticsList :density="compact ? 'compact' : 'default'">
            <FsusDiagnosticsItem
              title="diagnostic.event"
              message="Recent event summary."
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
                >
                  <template #button>
                    <span data-audit-focus data-audit-target data-audit-active>
                      Copy
                    </span>
                  </template>
                </FsusCopyableDetail>
              </template>
            </FsusDiagnosticsItem>
          </FsusDiagnosticsList>
        </div>
      </AuditCard>

      <AuditCard name="FsusFooter" :state="auditState">
        <fsus-container class="audit-container">
          <fsus-main>Main</fsus-main>
          <fsus-footer height="40px">Footer</fsus-footer>
        </fsus-container>
      </AuditCard>

      <AuditCard name="FsusForm" :state="auditState">
        <fsus-form :model="formModel" label-width="88px">
          <fsus-form-item label="Name">
            <fsus-input :model-value="activeText" />
          </fsus-form-item>
        </fsus-form>
      </AuditCard>

      <AuditCard name="FsusFormItem" :state="auditState">
        <fsus-form :model="formModel" label-width="88px">
          <fsus-form-item label="Region">
            <fsus-select :model-value="active ? 'one' : ''" :teleported="false">
              <fsus-option label="Zone one" value="one" />
            </fsus-select>
          </fsus-form-item>
        </fsus-form>
      </AuditCard>

      <AuditCard name="FsusHeader" :state="auditState">
        <fsus-container class="audit-container">
          <fsus-header height="40px">Header</fsus-header>
          <fsus-main>Main</fsus-main>
        </fsus-container>
      </AuditCard>

      <AuditCard name="FsusIcon" :state="auditState">
        <fsus-icon :size="32" :color="active ? scholarlyBlue : undefined">
          <Search />
        </fsus-icon>
      </AuditCard>

      <AuditCard name="FsusImage" :state="auditState">
        <fsus-image
          class="audit-image"
          :src="imageData"
          :preview-src-list="[imageData]"
          fit="cover"
        />
      </AuditCard>

      <AuditCard name="FsusImageViewer" :state="auditState">
        <fsus-image class="audit-image" :src="imageData" fit="cover" />
        <fsus-button
          data-audit-active
          data-audit-target
          @click="imageViewerVisible = true"
        >
          Preview
        </fsus-button>
        <fsus-image-viewer
          v-if="imageViewerVisible"
          :url-list="[imageData]"
          @close="imageViewerVisible = false"
        />
      </AuditCard>

      <AuditCard name="FsusInboxLayout" :state="auditState">
        <FsusInboxLayout
          class="audit-inbox-layout"
          selected
          mobile-pane="detail"
          list-label="Generic item list"
          detail-label="Generic item detail"
          :density="compact ? 'compact' : 'default'"
        >
          <template #list>
            <FsusConversationList ariaLabel="Generic item list">
              <FsusConversationListItem
                title="关于评论权限的讨论"
                preview="长摘要内容仍然需要留在列表列宽内"
                meta="09:00"
                selected
                :unread-count="active ? 3 : 1"
              />
              <FsusConversationListItem
                title="下周封面图评审"
                preview="第二条工作流摘要保持安全换行"
                meta="10:30"
              />
            </FsusConversationList>
          </template>
          <template #detail>
            <FsusThreadPanel title="评论权限讨论">
              <template #status>
                <fsus-tag size="small" type="info">
                  {{ active ? 'Active' : 'Ready' }}
                </fsus-tag>
              </template>
              <template #context>
                <FsusConversationContextBar>
                  <span>Kind: Generic</span>
                  <span>Source: Neutral</span>
                </FsusConversationContextBar>
              </template>
              <template #messages>
                <FsusMessageTimeline>
                  <FsusMessageBubble author="A" meta="09:00">
                    Neutral timeline content.
                  </FsusMessageBubble>
                  <FsusMessageBubble variant="self" author="B" meta="09:10">
                    Reply content with enough length to test wrapping in a
                    compact panel.
                  </FsusMessageBubble>
                  <FsusMessageBubble variant="system">
                    Generic state changed.
                  </FsusMessageBubble>
                </FsusMessageTimeline>
              </template>
              <template #composer>
                <FsusReplyComposerShell title="Reply">
                  <template #input>
                    <fsus-input
                      type="textarea"
                      :model-value="activeText"
                      label="Reply body"
                    />
                  </template>
                  <template #actions>
                    <fsus-button
                      type="primary"
                      data-audit-active
                      data-audit-focus
                      data-audit-target
                    >
                      Send
                    </fsus-button>
                  </template>
                </FsusReplyComposerShell>
              </template>
            </FsusThreadPanel>
          </template>
        </FsusInboxLayout>
      </AuditCard>

      <AuditCard name="FsusInput" :state="auditState">
        <fsus-input
          :model-value="activeText"
          placeholder="Input"
          clearable
          data-audit-focus
          data-audit-target
        />
      </AuditCard>

      <AuditCard name="FsusInputNumber" :state="auditState">
        <fsus-input-number
          :model-value="active ? 6 : 2"
          :min="1"
          :max="10"
          data-audit-focus
          data-audit-target
        />
      </AuditCard>

      <AuditCard name="FsusLink" :state="auditState">
        <fsus-link
          href="#audit-link"
          :type="active ? 'primary' : 'default'"
          data-audit-focus
          data-audit-target
          @click.prevent
        >
          Link action
        </fsus-link>
      </AuditCard>

      <AuditCard name="FsusMain" :state="auditState">
        <fsus-container class="audit-container">
          <fsus-main>Main surface</fsus-main>
        </fsus-container>
      </AuditCard>

      <AuditCard name="FsusMarkdownEditor" :state="auditState">
        <div class="audit-markdown-editor-frame">
          <fsus-markdown-editor
            :model-value="markdownEditorAuditContent"
            default-mode="split"
            :min-rows="4"
            data-audit-focus
            data-audit-target
          />
        </div>
      </AuditCard>

      <AuditCard name="FsusMarkdownRenderer" :state="auditState">
        <div class="audit-markdown-frame">
          <fsus-markdown-renderer :content="markdownAuditContent" />
        </div>
      </AuditCard>

      <AuditCard name="FsusMenu" :state="auditState">
        <fsus-menu
          :default-active="active ? '2' : '1'"
          :default-openeds="active ? ['sub'] : []"
        >
          <fsus-menu-item index="1">Dashboard</fsus-menu-item>
          <fsus-sub-menu index="sub">
            <template #title>Workspace</template>
            <fsus-menu-item index="2">Reports</fsus-menu-item>
          </fsus-sub-menu>
        </fsus-menu>
      </AuditCard>

      <AuditCard name="FsusMenuItem" :state="auditState">
        <fsus-menu :default-active="active ? '2' : '1'">
          <fsus-menu-item index="1">Overview</fsus-menu-item>
          <fsus-menu-item index="2">Active item</fsus-menu-item>
        </fsus-menu>
      </AuditCard>

      <AuditCard name="FsusMenuItemGroup" :state="auditState">
        <fsus-menu default-active="group-1" :default-openeds="['group']">
          <fsus-sub-menu index="group">
            <template #title>Group</template>
            <fsus-menu-item-group title="Group label">
              <fsus-menu-item index="group-1">Grouped item</fsus-menu-item>
            </fsus-menu-item-group>
          </fsus-sub-menu>
        </fsus-menu>
      </AuditCard>

      <AuditCard name="FsusOption" :state="auditState">
        <fsus-select
          :model-value="active ? 'private' : ''"
          placeholder="选择发布范围"
          :teleported="false"
          data-audit-focus
          data-audit-target
          data-audit-active
        >
          <fsus-option label="公开" value="public" />
          <fsus-option label="仅自己可见" value="private" />
        </fsus-select>
      </AuditCard>

      <AuditCard name="FsusOptionGroup" :state="auditState">
        <fsus-select
          :model-value="active ? 'homepage' : ''"
          placeholder="选择推荐策略"
          :teleported="false"
          data-audit-focus
          data-audit-target
          data-audit-active
        >
          <fsus-option-group label="内容分发">
            <fsus-option label="推送到首页" value="homepage" />
          </fsus-option-group>
        </fsus-select>
      </AuditCard>

      <AuditCard name="FsusOverlay" :state="auditState">
        <div class="audit-overlay-demo">
          <div v-if="active" class="fsus-overlay" :z-index="1">
            <div class="audit-overlay-panel">Overlay content</div>
          </div>
          <fsus-button v-else data-audit-focus data-audit-target>
            Overlay trigger
          </fsus-button>
        </div>
      </AuditCard>

      <AuditCard name="FsusPageHeader" :state="auditState">
        <fsus-page-header content="Detail" title="Back" />
      </AuditCard>

      <AuditCard name="FsusPageHeader" :state="auditState">
        <FsusPageHeader
          title="Review release evidence"
          description="Confirm the final production checks before publishing."
          :density="active ? 'compact' : 'default'"
        >
          <template #actions>
            <fsus-button data-audit-focus data-audit-target>
              Open evidence
            </fsus-button>
          </template>
        </FsusPageHeader>
      </AuditCard>

      <AuditCard name="FsusPublicShell" :state="auditState">
        <fsus-public-shell
          brand="Fsus"
          brand-href="#brand"
          :nav-items="shellNavItems"
          active-nav="docs"
          auth-label="Sign in"
          auth-href="#auth"
          :show-search="false"
          :sticky="false"
          max-width="100%"
        >
          <p class="audit-public-shell-copy">Public shell content</p>
          <template #desktop-actions>
            <fsus-button size="small"> Action </fsus-button>
          </template>
          <template #mobile-actions>
            <fsus-button size="small"> Go </fsus-button>
          </template>
        </fsus-public-shell>
      </AuditCard>

      <AuditCard name="FsusPagination" :state="auditState">
        <fsus-pagination
          background
          small
          layout="prev, pager, next, total"
          :default-current-page="active ? 2 : 1"
          :total="50"
        />
      </AuditCard>

      <AuditCard name="FsusPerceptionCharacterChallenge" :state="auditState">
        <div class="audit-perception-stack">
          <FsusPerceptionCharacterChallenge
            v-for="challenge in perceptionChallenges"
            :key="challenge.challengeId"
            :challenge="challenge"
            :state="active ? 'submitting' : 'ready'"
            title="Challenge review"
            eyebrow="Signal"
            :disabled="auditState === 'interaction'"
            data-audit-active
          />
        </div>
      </AuditCard>

      <AuditCard name="FsusPopconfirm" :state="auditState">
        <fsus-popconfirm title="Delete item?" :teleported="false">
          <template #reference>
            <fsus-button data-audit-focus data-audit-target data-audit-active>
              Popconfirm
            </fsus-button>
          </template>
        </fsus-popconfirm>
      </AuditCard>

      <AuditCard name="FsusPopover" :state="auditState">
        <fsus-popover
          trigger="click"
          placement="bottom-start"
          title="Popover"
          content="Editorial popover content"
          :width="220"
          :teleported="false"
        >
          <template #reference>
            <fsus-button data-audit-focus data-audit-target data-audit-active>
              Popover
            </fsus-button>
          </template>
        </fsus-popover>
      </AuditCard>

      <AuditCard name="FsusPopper" :state="auditState">
        <div>
          <div>
            <fsus-button data-audit-focus data-audit-target>Raw popper</fsus-button>
          </div>
          <div :visible="true">
            <span />
            Raw content
          </div>
        </div>
      </AuditCard>

      <AuditCard name="FsusPopperArrow" :state="auditState">
        <div>
          <div>
            <fsus-button>Arrow</fsus-button>
          </div>
          <div :visible="true">
            <span />Arrow content
          </div>
        </div>
      </AuditCard>

      <AuditCard name="FsusPopperContent" :state="auditState">
        <div>
          <div>
            <fsus-button>Content trigger</fsus-button>
          </div>
          <div :visible="true">Popper content</div>
        </div>
      </AuditCard>

      <AuditCard name="FsusPopperTrigger" :state="auditState">
        <div>
          <div>
            <fsus-button data-audit-focus data-audit-target>Trigger</fsus-button>
          </div>
          <div
            v-if="active"
            :visible="true"
            placement="bottom-start"
          >
            Triggered content
          </div>
        </div>
      </AuditCard>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import * as Icons from '@fsusui/icons'
import {
  FsusConversationContextBar,
  FsusConversationList,
  FsusConversationListItem,
  FsusCopyableDetail,
  FsusDiagnosticsItem,
  FsusDiagnosticsList,
  FsusDistributionBarRow,
  FsusDistributionList,
  FsusInboxLayout,
  FsusKeyValueGrid,
  FsusKeyValueItem,
  FsusKpiGroup,
  FsusMessageBubble,
  FsusMessageTimeline,
  FsusMetricItem,
  FsusMetricList,
  FsusPerceptionCharacterChallenge,
  FsusReplyComposerShell,
  FsusStatusSummary,
  FsusPageHeader,
  FsusThreadPanel,
} from '@ozwasyd/fsusui'
import AuditCard from '../AuditCard.vue'
import type { UiAuditState } from '../ui-audit-manifest'
import type { AuditGridData } from './use-audit-grid-data'

const props = defineProps<{
  auditState: UiAuditState
  compact: boolean
  data: AuditGridData
}>()

const { Search } = Icons
const {
  active,
  activeText,
  formModel,
  imageData,
  markdownAuditContent,
  markdownEditorAuditContent,
  perceptionChallenges,
  scholarlyBlue,
  shellNavItems,
} = props.data

const imageViewerVisible = ref(false)

watch(
  () => props.auditState,
  () => {
    imageViewerVisible.value = false
  },
)
</script>
