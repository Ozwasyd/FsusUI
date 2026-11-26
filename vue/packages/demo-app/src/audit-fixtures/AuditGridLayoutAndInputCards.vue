<template>
      <AuditCard name="ElMetricList" :state="auditState">
        <div class="audit-metric-primitives">
          <ElKpiGroup :density="compact ? 'compact' : 'default'">
            <ElMetricList :density="compact ? 'compact' : 'default'">
              <ElMetricItem
                label="Metric Alpha"
                primary="P75 22ms"
                secondary="Avg 23ms"
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
              <ElKeyValueItem label="State" value="Ready" tone="success" />
              <ElKeyValueItem label="Queue" value="0 / 0" monospace />
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
          </ElDistributionList>

          <ElStatusSummary
            label="Generic status"
            status="Stable"
            updated-at="2026-06-14 20:30"
            tone="success"
            :density="compact ? 'compact' : 'default'"
          >
            <template #detail>Product-owned detail copy.</template>
            <template #actions>
              <el-button size="small">Inspect</el-button>
            </template>
          </ElStatusSummary>

          <ElDiagnosticsList :density="compact ? 'compact' : 'default'">
            <ElDiagnosticsItem
              title="diagnostic.event"
              message="Recent event summary."
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
                >
                  <template #button>
                    <span data-audit-focus data-audit-target data-audit-active>
                      Copy
                    </span>
                  </template>
                </ElCopyableDetail>
              </template>
            </ElDiagnosticsItem>
          </ElDiagnosticsList>
        </div>
      </AuditCard>

      <AuditCard name="ElFooter" :state="auditState">
        <el-container class="audit-container">
          <el-main>Main</el-main>
          <el-footer height="40px">Footer</el-footer>
        </el-container>
      </AuditCard>

      <AuditCard name="ElForm" :state="auditState">
        <el-form :model="formModel" label-width="88px">
          <el-form-item label="Name">
            <el-input :model-value="activeText" />
          </el-form-item>
        </el-form>
      </AuditCard>

      <AuditCard name="ElFormItem" :state="auditState">
        <el-form :model="formModel" label-width="88px">
          <el-form-item label="Region">
            <el-select :model-value="active ? 'one' : ''" :teleported="false">
              <el-option label="Zone one" value="one" />
            </el-select>
          </el-form-item>
        </el-form>
      </AuditCard>

      <AuditCard name="ElHeader" :state="auditState">
        <el-container class="audit-container">
          <el-header height="40px">Header</el-header>
          <el-main>Main</el-main>
        </el-container>
      </AuditCard>

      <AuditCard name="ElIcon" :state="auditState">
        <el-icon :size="32" :color="active ? scholarlyBlue : undefined">
          <Search />
        </el-icon>
      </AuditCard>

      <AuditCard name="ElImage" :state="auditState">
        <el-image
          class="audit-image"
          :src="imageData"
          :preview-src-list="[imageData]"
          fit="cover"
        />
      </AuditCard>

      <AuditCard name="ElImageViewer" :state="auditState">
        <el-image class="audit-image" :src="imageData" fit="cover" />
        <el-button
          data-audit-active
          data-audit-target
          @click="imageViewerVisible = true"
        >
          Preview
        </el-button>
        <el-image-viewer
          v-if="imageViewerVisible"
          :url-list="[imageData]"
          @close="imageViewerVisible = false"
        />
      </AuditCard>

      <AuditCard name="ElInboxLayout" :state="auditState">
        <ElInboxLayout
          class="audit-inbox-layout"
          selected
          mobile-pane="detail"
          list-label="Generic item list"
          detail-label="Generic item detail"
          :density="compact ? 'compact' : 'default'"
        >
          <template #list>
            <ElConversationList ariaLabel="Generic item list">
              <ElConversationListItem
                title="关于评论权限的讨论"
                preview="长摘要内容仍然需要留在列表列宽内"
                meta="09:00"
                selected
                :unread-count="active ? 3 : 1"
              />
              <ElConversationListItem
                title="下周封面图评审"
                preview="第二条工作流摘要保持安全换行"
                meta="10:30"
              />
            </ElConversationList>
          </template>
          <template #detail>
            <ElThreadPanel title="评论权限讨论">
              <template #status>
                <el-tag size="small" type="info">
                  {{ active ? 'Active' : 'Ready' }}
                </el-tag>
              </template>
              <template #context>
                <ElConversationContextBar>
                  <span>Kind: Generic</span>
                  <span>Source: Neutral</span>
                </ElConversationContextBar>
              </template>
              <template #messages>
                <ElMessageTimeline>
                  <ElMessageBubble author="A" meta="09:00">
                    Neutral timeline content.
                  </ElMessageBubble>
                  <ElMessageBubble variant="self" author="B" meta="09:10">
                    Reply content with enough length to test wrapping in a
                    compact panel.
                  </ElMessageBubble>
                  <ElMessageBubble variant="system">
                    Generic state changed.
                  </ElMessageBubble>
                </ElMessageTimeline>
              </template>
              <template #composer>
                <ElReplyComposerShell title="Reply">
                  <template #input>
                    <el-input
                      type="textarea"
                      :model-value="activeText"
                      label="Reply body"
                    />
                  </template>
                  <template #actions>
                    <el-button
                      type="primary"
                      data-audit-active
                      data-audit-focus
                      data-audit-target
                    >
                      Send
                    </el-button>
                  </template>
                </ElReplyComposerShell>
              </template>
            </ElThreadPanel>
          </template>
        </ElInboxLayout>
      </AuditCard>

      <AuditCard name="ElInput" :state="auditState">
        <el-input
          :model-value="activeText"
          placeholder="Input"
          clearable
          data-audit-focus
          data-audit-target
        />
      </AuditCard>

      <AuditCard name="ElInputNumber" :state="auditState">
        <el-input-number
          :model-value="active ? 6 : 2"
          :min="1"
          :max="10"
          data-audit-focus
          data-audit-target
        />
      </AuditCard>

      <AuditCard name="ElLink" :state="auditState">
        <el-link
          href="#audit-link"
          :type="active ? 'primary' : 'default'"
          data-audit-focus
          data-audit-target
          @click.prevent
        >
          Link action
        </el-link>
      </AuditCard>

      <AuditCard name="ElMain" :state="auditState">
        <el-container class="audit-container">
          <el-main>Main surface</el-main>
        </el-container>
      </AuditCard>

      <AuditCard name="ElMarkdownEditor" :state="auditState">
        <div class="audit-markdown-editor-frame">
          <el-markdown-editor
            :model-value="markdownEditorAuditContent"
            default-mode="split"
            :min-rows="4"
            data-audit-focus
            data-audit-target
          />
        </div>
      </AuditCard>

      <AuditCard name="ElMarkdownRenderer" :state="auditState">
        <div class="audit-markdown-frame">
          <el-markdown-renderer :content="markdownAuditContent" />
        </div>
      </AuditCard>

      <AuditCard name="ElMenu" :state="auditState">
        <el-menu
          :default-active="active ? '2' : '1'"
          :default-openeds="active ? ['sub'] : []"
        >
          <el-menu-item index="1">Dashboard</el-menu-item>
          <el-sub-menu index="sub">
            <template #title>Workspace</template>
            <el-menu-item index="2">Reports</el-menu-item>
          </el-sub-menu>
        </el-menu>
      </AuditCard>

      <AuditCard name="ElMenuItem" :state="auditState">
        <el-menu :default-active="active ? '2' : '1'">
          <el-menu-item index="1">Overview</el-menu-item>
          <el-menu-item index="2">Active item</el-menu-item>
        </el-menu>
      </AuditCard>

      <AuditCard name="ElMenuItemGroup" :state="auditState">
        <el-menu default-active="group-1" :default-openeds="['group']">
          <el-sub-menu index="group">
            <template #title>Group</template>
            <el-menu-item-group title="Group label">
              <el-menu-item index="group-1">Grouped item</el-menu-item>
            </el-menu-item-group>
          </el-sub-menu>
        </el-menu>
      </AuditCard>

      <AuditCard name="ElOption" :state="auditState">
        <el-select
          :model-value="active ? 'private' : ''"
          placeholder="选择发布范围"
          :teleported="false"
          data-audit-focus
          data-audit-target
          data-audit-active
        >
          <el-option label="公开" value="public" />
          <el-option label="仅自己可见" value="private" />
        </el-select>
      </AuditCard>

      <AuditCard name="ElOptionGroup" :state="auditState">
        <el-select
          :model-value="active ? 'homepage' : ''"
          placeholder="选择推荐策略"
          :teleported="false"
          data-audit-focus
          data-audit-target
          data-audit-active
        >
          <el-option-group label="内容分发">
            <el-option label="推送到首页" value="homepage" />
          </el-option-group>
        </el-select>
      </AuditCard>

      <AuditCard name="ElOverlay" :state="auditState">
        <div class="audit-overlay-demo">
          <el-overlay v-if="active" :z-index="1">
            <div class="audit-overlay-panel">Overlay content</div>
          </el-overlay>
          <el-button v-else data-audit-focus data-audit-target>
            Overlay trigger
          </el-button>
        </div>
      </AuditCard>

      <AuditCard name="ElPageHeader" :state="auditState">
        <el-page-header content="Detail" title="Back" />
      </AuditCard>

      <AuditCard name="ElTaskPageHeader" :state="auditState">
        <ElTaskPageHeader
          title="Review release evidence"
          description="Confirm the final production checks before publishing."
          :density="active ? 'compact' : 'default'"
        >
          <template #actions>
            <el-button data-audit-focus data-audit-target>
              Open evidence
            </el-button>
          </template>
        </ElTaskPageHeader>
      </AuditCard>

      <AuditCard name="ElPublicShell" :state="auditState">
        <el-public-shell
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
            <el-button size="small"> Action </el-button>
          </template>
          <template #mobile-actions>
            <el-button size="small"> Go </el-button>
          </template>
        </el-public-shell>
      </AuditCard>

      <AuditCard name="ElPagination" :state="auditState">
        <el-pagination
          background
          small
          layout="prev, pager, next, total"
          :default-current-page="active ? 2 : 1"
          :total="50"
        />
      </AuditCard>

      <AuditCard name="ElPerceptionChallenge" :state="auditState">
        <div class="audit-perception-stack">
          <ElPerceptionChallenge
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

      <AuditCard name="ElPopconfirm" :state="auditState">
        <el-popconfirm title="Delete item?" :teleported="false">
          <template #reference>
            <el-button data-audit-focus data-audit-target data-audit-active>
              Popconfirm
            </el-button>
          </template>
        </el-popconfirm>
      </AuditCard>

      <AuditCard name="ElPopover" :state="auditState">
        <el-popover
          trigger="click"
          placement="bottom-start"
          title="Popover"
          content="Editorial popover content"
          :width="220"
          :teleported="false"
        >
          <template #reference>
            <el-button data-audit-focus data-audit-target data-audit-active>
              Popover
            </el-button>
          </template>
        </el-popover>
      </AuditCard>

      <AuditCard name="ElPopper" :state="auditState">
        <el-popper>
          <el-popper-trigger>
            <el-button data-audit-focus data-audit-target>Raw popper</el-button>
          </el-popper-trigger>
          <el-popper-content :visible="true">
            <el-popper-arrow />
            Raw content
          </el-popper-content>
        </el-popper>
      </AuditCard>

      <AuditCard name="ElPopperArrow" :state="auditState">
        <el-popper>
          <el-popper-trigger>
            <el-button>Arrow</el-button>
          </el-popper-trigger>
          <el-popper-content :visible="true">
            <el-popper-arrow />Arrow content
          </el-popper-content>
        </el-popper>
      </AuditCard>

      <AuditCard name="ElPopperContent" :state="auditState">
        <el-popper>
          <el-popper-trigger>
            <el-button>Content trigger</el-button>
          </el-popper-trigger>
          <el-popper-content :visible="true">Popper content</el-popper-content>
        </el-popper>
      </AuditCard>

      <AuditCard name="ElPopperTrigger" :state="auditState">
        <el-popper>
          <el-popper-trigger>
            <el-button data-audit-focus data-audit-target>Trigger</el-button>
          </el-popper-trigger>
          <el-popper-content
            v-if="active"
            :visible="true"
            placement="bottom-start"
          >
            Triggered content
          </el-popper-content>
        </el-popper>
      </AuditCard>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import * as Icons from '@element-plus/icons-vue'
import {
  ElConversationContextBar,
  ElConversationList,
  ElConversationListItem,
  ElCopyableDetail,
  ElDiagnosticsItem,
  ElDiagnosticsList,
  ElDistributionBarRow,
  ElDistributionList,
  ElInboxLayout,
  ElKeyValueGrid,
  ElKeyValueItem,
  ElKpiGroup,
  ElMessageBubble,
  ElMessageTimeline,
  ElMetricItem,
  ElMetricList,
  ElPerceptionChallenge,
  ElReplyComposerShell,
  ElStatusSummary,
  ElTaskPageHeader,
  ElThreadPanel,
} from '../../../element-plus'
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
