<template>
      <AuditCard name="ElProgress" :state="auditState">
        <el-progress :percentage="active ? 88 : 44" />
        <el-progress type="circle" :percentage="active ? 72 : 28" />
      </AuditCard>

      <AuditCard name="ElRadio" :state="auditState">
        <el-radio :model-value="active ? 'selected' : ''" label="selected">
          Radio
        </el-radio>
      </AuditCard>

      <AuditCard name="ElRadioButton" :state="auditState">
        <el-radio-group :model-value="active ? 'B' : 'A'">
          <el-radio-button label="A">A</el-radio-button>
          <el-radio-button label="B">B</el-radio-button>
        </el-radio-group>
      </AuditCard>

      <AuditCard name="ElRadioGroup" :state="auditState">
        <el-radio-group :model-value="active ? '2' : '1'">
          <el-radio label="1">One</el-radio>
          <el-radio label="2">Two</el-radio>
        </el-radio-group>
      </AuditCard>

      <AuditCard name="ElRate" :state="auditState">
        <el-rate :model-value="active ? 5 : 3" allow-half />
      </AuditCard>

      <AuditCard name="ElResult" :state="auditState">
        <el-result icon="success" title="Success" sub-title="Result detail">
          <template #extra>
            <el-button type="primary">Confirm</el-button>
          </template>
        </el-result>
      </AuditCard>

      <AuditCard name="ElResponsiveCollection" :state="auditState">
        <el-responsive-collection
          :items="responsiveCollectionItems"
          row-key="name"
          :compact="compact"
        >
          <template #table>
            <el-table
              :data="responsiveCollectionItems"
              size="small"
              height="132"
            >
              <el-table-column prop="name" label="Name" />
              <el-table-column prop="state" label="State" />
            </el-table>
          </template>
          <template #card="{ item }">
            <div class="audit-responsive-card" role="listitem">
              {{ formatCollectionItem(item) }}
            </div>
          </template>
        </el-responsive-collection>
      </AuditCard>

      <AuditCard name="ElRow" :state="auditState">
        <el-row :gutter="12">
          <el-col :span="8"><div class="audit-grid-cell">8</div></el-col>
          <el-col :span="16"><div class="audit-grid-cell">16</div></el-col>
        </el-row>
      </AuditCard>

      <AuditCard name="ElScrollbar" :state="auditState">
        <el-scrollbar height="140px">
          <div v-for="item in 6" :key="item" class="audit-virtual-row">
            Scroll item {{ item }}
          </div>
        </el-scrollbar>
      </AuditCard>

      <AuditCard name="ElSectionNav" :state="auditState">
        <div class="audit-settings-primitives">
          <ElSectionNav
            ariaLabel="Settings audit sections"
            :density="compact ? 'compact' : 'default'"
          >
            <a
              class="el-section-nav__link is-current"
              href="#audit-overview"
              aria-current="location"
              data-audit-focus
              data-audit-target
              data-audit-active
            >
              Overview
            </a>
            <a class="el-section-nav__link" href="#audit-resources">
              Resources
            </a>
            <a
              class="el-section-nav__link is-disabled"
              aria-disabled="true"
              tabindex="-1"
            >
              Disabled
            </a>
          </ElSectionNav>

          <ElSettingsSection
            title="Generic settings"
            description="Reusable layout for copy supplied by the product."
            title-tag="h3"
            :density="compact ? 'compact' : 'default'"
          >
            <template #actions>
              <el-button size="small">Update</el-button>
            </template>

            <ElSectionHeader
              title="Standalone header"
              description="Header primitive without an eyebrow."
              title-tag="h4"
              :density="compact ? 'compact' : 'default'"
            />

            <ElFormSection
              title="Form group"
              description="Labels and inputs remain owned by the form."
              title-tag="h4"
              :density="compact ? 'compact' : 'default'"
            >
              <label class="audit-settings-field">
                Label
                <input :value="activeText" />
              </label>
            </ElFormSection>

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
                  <ElMetadataItem label="Fingerprint" monospace />
                </ElMetadataRow>
                <template #actions>
                  <ElInlineActions ariaLabel="Resource actions">
                    <el-button text size="small">Edit</el-button>
                  </ElInlineActions>
                </template>
              </ElResourceListItem>
              <ElResourceListItem title="Empty resource group">
                <ElEmptyState
                  size="inline"
                  title="No resources"
                  description="Add product-owned copy here."
                />
              </ElResourceListItem>
            </ElResourceList>
          </ElSettingsSection>

          <ElDangerZone
            title="Risk area"
            description="Use explicit text in addition to color."
            title-tag="h3"
            :density="compact ? 'compact' : 'default'"
          >
            <ElRiskNotice title="Review" role="note">
              Confirm consequences before continuing.
            </ElRiskNotice>
            <ElDestructiveActionPanel title="Destructive action">
              <template #description>
                Product copy explains the outcome and recovery path.
              </template>
              <template #actions>
                <el-button type="danger" size="small">Continue</el-button>
              </template>
            </ElDestructiveActionPanel>
            <ElTypedConfirmField
              :model-value="active ? 'CONFIRM' : 'CONF'"
              phrase="CONFIRM"
              label="Confirmation phrase"
              description="Type the exact phrase to continue."
            />
          </ElDangerZone>
        </div>
      </AuditCard>

      <AuditCard name="ElSiteHeader" :state="auditState">
        <ElSiteHeader
          :sticky="false"
          max-width="100%"
          ariaLabel="Audit site header"
        >
          <template #brand>
            <a href="#audit-brand" data-audit-focus>FsusUI</a>
          </template>
          <template #desktop-nav>
            <a href="#audit-docs">Docs</a>
            <a href="#audit-components">Components</a>
          </template>
          <template #desktop-actions>
            <el-button size="small" data-audit-target data-audit-active>
              Action
            </el-button>
          </template>
          <template #mobile-primary-actions>
            <el-button size="small">Menu</el-button>
          </template>
        </ElSiteHeader>
      </AuditCard>

      <AuditCard name="ElSelect" :state="auditState">
        <el-select
          :model-value="active ? 'two' : ''"
          placeholder="Select"
          :teleported="false"
          data-audit-focus
          data-audit-target
          data-audit-active
        >
          <el-option label="One" value="one" />
          <el-option label="Two" value="two" />
        </el-select>
      </AuditCard>

      <AuditCard name="ElSelectV2" :state="auditState">
        <el-select-v2
          :model-value="active ? 'cover-review' : ''"
          :options="selectV2Options"
          placeholder="选择工作流"
          :teleported="false"
          data-audit-focus
          data-audit-target
        />
      </AuditCard>

      <AuditCard name="ElSlider" :state="auditState">
        <el-slider :model-value="active ? 80 : 40" data-audit-target />
      </AuditCard>

      <AuditCard name="ElSkeleton" :state="auditState">
        <el-skeleton style="width: 240px" animated>
          <template #template>
            <el-skeleton-item
              variant="image"
              style="width: 100%; height: 88px"
            />
            <el-skeleton-item
              variant="text"
              style="width: 80%; margin-top: 12px"
            />
          </template>
        </el-skeleton>
      </AuditCard>

      <AuditCard name="ElSkeletonItem" :state="auditState">
        <el-skeleton animated>
          <template #template>
            <el-skeleton-item variant="p" style="width: 80%; height: 18px" />
          </template>
        </el-skeleton>
      </AuditCard>

      <AuditCard name="ElSpace" :state="auditState">
        <el-space wrap>
          <el-button>A</el-button>
          <el-button type="primary">B</el-button>
        </el-space>
      </AuditCard>

      <AuditCard name="ElStatistic" :state="auditState">
        <el-statistic title="Active users" :value="active ? 268500 : 128000" />
      </AuditCard>

      <AuditCard name="ElStep" :state="auditState">
        <el-steps :active="active ? 2 : 1">
          <el-step title="Draft" />
          <el-step title="Review" />
          <el-step title="Ship" />
        </el-steps>
      </AuditCard>

      <AuditCard name="ElSteps" :state="auditState">
        <el-steps :active="active ? 2 : 1">
          <el-step title="撰写" description="整理正文" />
          <el-step title="复核" description="检查权限" />
          <el-step title="发布" description="同步公开页" />
        </el-steps>
      </AuditCard>

      <AuditCard name="ElSubMenu" :state="auditState">
        <el-menu default-active="2" :default-openeds="['sub']">
          <el-sub-menu index="sub">
            <template #title>Sub menu</template>
            <el-menu-item index="2">Nested item</el-menu-item>
          </el-sub-menu>
        </el-menu>
      </AuditCard>

      <AuditCard name="ElSwitch" :state="auditState">
        <el-switch
          :model-value="active"
          active-text="Open"
          inactive-text="Closed"
        />
      </AuditCard>

      <AuditCard name="ElTabPane" :state="auditState">
        <el-tabs :model-value="active ? 'second' : 'first'">
          <el-tab-pane label="First" name="first">First pane</el-tab-pane>
          <el-tab-pane label="Second" name="second">Second pane</el-tab-pane>
        </el-tabs>
      </AuditCard>

      <AuditCard name="ElTable" :state="auditState">
        <el-table :data="tableData" border style="width: 100%">
          <el-table-column prop="name" label="Name" width="120" />
          <el-table-column prop="state" label="State" />
        </el-table>
      </AuditCard>

      <AuditCard name="ElTableColumn" :state="auditState">
        <el-table :data="tableData" border style="width: 100%">
          <el-table-column prop="name" label="Column" />
        </el-table>
      </AuditCard>

      <AuditCard name="ElAutoResizer" :state="auditState">
        <div class="audit-table-v2-frame">
          <el-auto-resizer>
            <template #default="{ height, width }">
              <el-table-v2
                :columns="tableV2Columns"
                :data="tableV2Data"
                :width="width"
                :height="height"
              />
            </template>
          </el-auto-resizer>
        </div>
      </AuditCard>

      <AuditCard name="ElTableV2" :state="auditState">
        <div class="audit-table-v2-frame">
          <el-table-v2
            :columns="tableV2Columns"
            :data="tableV2Data"
            :width="260"
            :height="160"
          />
        </div>
      </AuditCard>

      <AuditCard name="ElTabs" :state="auditState">
        <el-tabs :model-value="active ? 'second' : 'first'">
          <el-tab-pane label="First" name="first">First content</el-tab-pane>
          <el-tab-pane label="Second" name="second">Second content</el-tab-pane>
        </el-tabs>
      </AuditCard>

      <AuditCard name="ElTag" :state="auditState">
        <el-space wrap>
          <el-tag :type="active ? 'info' : undefined">Tag</el-tag>
          <el-tag type="info">Info</el-tag>
        </el-space>
      </AuditCard>

      <AuditCard name="ElText" :state="auditState">
        <el-text :type="active ? 'primary' : undefined">
          Editorial text sample
        </el-text>
      </AuditCard>

      <AuditCard name="ElThemeModeToggle" :state="auditState">
        <el-theme-mode-toggle
          :model-value="themeMode"
          :compact="compact"
          data-audit-focus
          data-audit-target
        />
      </AuditCard>

      <AuditCard name="ElTimePicker" :state="auditState">
        <el-time-picker
          :model-value="dateValue"
          placeholder="Pick time"
          data-audit-focus
          data-audit-target
        />
      </AuditCard>

      <AuditCard name="ElTimeSelect" :state="auditState">
        <el-time-select
          :model-value="active ? '09:00' : ''"
          start="08:30"
          step="00:15"
          end="09:00"
          placeholder="Select time"
          data-audit-focus
          data-audit-target
        />
      </AuditCard>

      <AuditCard name="ElTimeline" :state="auditState">
        <el-timeline>
          <el-timeline-item timestamp="2026/05/20" placement="top">
            Audit started
          </el-timeline-item>
          <el-timeline-item timestamp="2026/05/21" placement="top">
            Review
          </el-timeline-item>
        </el-timeline>
      </AuditCard>

      <AuditCard name="ElTimelineItem" :state="auditState">
        <el-timeline>
          <el-timeline-item timestamp="2026/05/20">
            Timeline item
          </el-timeline-item>
        </el-timeline>
      </AuditCard>

      <AuditCard name="ElTooltip" :state="auditState">
        <el-tooltip
          content="Tooltip content"
          placement="bottom-start"
          :trigger="['hover', 'click']"
          :show-after="0"
          :hide-after="0"
          :teleported="false"
        >
          <el-button data-audit-focus data-audit-target data-audit-active>
            Tooltip
          </el-button>
        </el-tooltip>
      </AuditCard>

      <AuditCard name="ElTooltipV2" :state="auditState">
        <el-tooltip-v2
          :placement="boundary ? 'bottom-start' : 'right'"
          :open="active"
          :delay-duration="0"
          :teleported="false"
        >
          <template #trigger>
            <el-button data-audit-focus data-audit-target data-audit-active>
              Tooltip V2
            </el-button>
          </template>
          Tooltip V2 content
        </el-tooltip-v2>
      </AuditCard>

      <AuditCard name="ElTransfer" :state="auditState">
        <el-transfer
          :model-value="active ? [1, 2] : [1]"
          :data="transferData"
          filterable
          filter-placeholder="Search"
        />
      </AuditCard>

      <AuditCard name="ElTree" :state="auditState">
        <el-tree
          :data="treeData"
          node-key="value"
          show-checkbox
          :default-checked-keys="active ? ['level-1-1'] : []"
          :default-expanded-keys="['level-1']"
        />
      </AuditCard>

      <AuditCard name="ElTreeSelect" :state="auditState">
        <el-tree-select
          :model-value="active ? 'level-1-1' : 'level-1'"
          :data="treeData"
          :teleported="false"
          popper-class="audit-tree-select-popper"
          data-audit-focus
          data-audit-target
          data-audit-active
        />
      </AuditCard>

      <AuditCard name="ElTreeV2" :state="auditState">
        <el-tree-v2
          :data="treeDataV2"
          :height="180"
          :item-size="44"
          :default-expanded-keys="[0]"
        />
      </AuditCard>

      <AuditCard name="ElUpload" :state="auditState">
        <el-upload action="#" :auto-upload="false" drag>
          <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
          <div class="el-upload__text">Drop a file here or <em>browse</em></div>
          <p data-upload-help>PNG/JPG, max 10 MB</p>
        </el-upload>
      </AuditCard>

      <AuditCard name="ElWatermark" :state="auditState">
        <el-watermark content="FsusUI">
          <div class="audit-watermark-box" />
        </el-watermark>
      </AuditCard>
</template>

<script setup lang="ts">
import * as Icons from '@element-plus/icons-vue'
import {
  ElDangerZone,
  ElDestructiveActionPanel,
  ElEmptyState,
  ElFormSection,
  ElInlineActions,
  ElMetadataItem,
  ElMetadataRow,
  ElResourceList,
  ElResourceListItem,
  ElRiskNotice,
  ElSectionHeader,
  ElSectionNav,
  ElSettingsSection,
  ElSiteHeader,
  ElTypedConfirmField,
} from '../../../element-plus'
import AuditCard from '../AuditCard.vue'
import type { UiAuditState } from '../ui-audit-manifest'
import type { AuditGridData } from './use-audit-grid-data'

const props = defineProps<{
  auditState: UiAuditState
  boundary: boolean
  compact: boolean
  data: AuditGridData
}>()

const { UploadFilled } = Icons
const {
  active,
  activeText,
  dateValue,
  formatCollectionItem,
  responsiveCollectionItems,
  selectV2Options,
  tableData,
  tableV2Columns,
  tableV2Data,
  themeMode,
  transferData,
  treeData,
  treeDataV2,
} = props.data
</script>
