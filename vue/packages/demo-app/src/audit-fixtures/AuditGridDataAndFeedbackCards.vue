<template>
      <AuditCard name="FsusProgress" :state="auditState">
        <fsus-progress :percentage="active ? 88 : 44" />
        <fsus-progress type="circle" :percentage="active ? 72 : 28" />
      </AuditCard>

      <AuditCard name="FsusRadio" :state="auditState">
        <fsus-radio :model-value="active ? 'selected' : ''" label="selected">
          Radio
        </fsus-radio>
      </AuditCard>

      <AuditCard name="FsusRadioButton" :state="auditState">
        <fsus-radio-group :model-value="active ? 'B' : 'A'">
          <fsus-radio-button label="A">A</fsus-radio-button>
          <fsus-radio-button label="B">B</fsus-radio-button>
        </fsus-radio-group>
      </AuditCard>

      <AuditCard name="FsusRadioGroup" :state="auditState">
        <fsus-radio-group :model-value="active ? '2' : '1'">
          <fsus-radio label="1">One</fsus-radio>
          <fsus-radio label="2">Two</fsus-radio>
        </fsus-radio-group>
      </AuditCard>

      <AuditCard name="FsusRate" :state="auditState">
        <fsus-rate :model-value="active ? 5 : 3" allow-half />
      </AuditCard>

      <AuditCard name="FsusResult" :state="auditState">
        <fsus-result icon="success" title="Success" sub-title="Result detail">
          <template #extra>
            <fsus-button type="primary">Confirm</fsus-button>
          </template>
        </fsus-result>
      </AuditCard>

      <AuditCard name="FsusResponsiveCollection" :state="auditState">
        <fsus-responsive-collection
          :items="responsiveCollectionItems"
          row-key="name"
          :compact="compact"
        >
          <template #table>
            <fsus-table
              :data="responsiveCollectionItems"
              size="small"
              height="132"
            >
              <fsus-table-column prop="name" label="Name" />
              <fsus-table-column prop="state" label="State" />
            </fsus-table>
          </template>
          <template #card="{ item }">
            <div class="audit-responsive-card" role="listitem">
              {{ formatCollectionItem(item) }}
            </div>
          </template>
        </fsus-responsive-collection>
      </AuditCard>

      <AuditCard name="FsusRow" :state="auditState">
        <fsus-row :gutter="12">
          <fsus-col :span="8"><div class="audit-grid-cell">8</div></fsus-col>
          <fsus-col :span="16"><div class="audit-grid-cell">16</div></fsus-col>
        </fsus-row>
      </AuditCard>

      <AuditCard name="FsusScrollbar" :state="auditState">
        <fsus-scrollbar height="140px">
          <div v-for="item in 6" :key="item" class="audit-virtual-row">
            Scroll item {{ item }}
          </div>
        </fsus-scrollbar>
      </AuditCard>

      <AuditCard name="FsusSectionNav" :state="auditState">
        <div class="audit-settings-primitives">
          <FsusSectionNav
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
          </FsusSectionNav>

          <FsusSettingsSection
            title="Generic settings"
            description="Reusable layout for copy supplied by the product."
            title-tag="h3"
            :density="compact ? 'compact' : 'default'"
          >
            <template #actions>
              <fsus-button size="small">Update</fsus-button>
            </template>

            <FsusSectionHeader
              title="Standalone header"
              description="Header primitive without an eyebrow."
              title-tag="h4"
              :density="compact ? 'compact' : 'default'"
            />

            <FsusFormSection
              title="Form group"
              description="Labels and inputs remain owned by the form."
              title-tag="h4"
              :density="compact ? 'compact' : 'default'"
            >
              <label class="audit-settings-field">
                Label
                <input :value="activeText" />
              </label>
            </FsusFormSection>

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
                  <FsusMetadataItem label="Fingerprint" monospace />
                </FsusMetadataRow>
                <template #actions>
                  <FsusInlineActions ariaLabel="Resource actions">
                    <fsus-button text size="small">Edit</fsus-button>
                  </FsusInlineActions>
                </template>
              </FsusResourceListItem>
              <FsusResourceListItem title="Empty resource group">
                <FsusEmptyState
                  size="inline"
                  title="No resources"
                  description="Add product-owned copy here."
                />
              </FsusResourceListItem>
            </FsusResourceList>
          </FsusSettingsSection>

          <FsusDangerZone
            title="Risk area"
            description="Use explicit text in addition to color."
            title-tag="h3"
            :density="compact ? 'compact' : 'default'"
          >
            <FsusRiskNotice title="Review" role="note">
              Confirm consequences before continuing.
            </FsusRiskNotice>
            <FsusDestructiveActionPanel title="Destructive action">
              <template #description>
                Product copy explains the outcome and recovery path.
              </template>
              <template #actions>
                <fsus-button type="danger" size="small">Continue</fsus-button>
              </template>
            </FsusDestructiveActionPanel>
            <FsusTypedConfirmField
              :model-value="active ? 'CONFIRM' : 'CONF'"
              phrase="CONFIRM"
              label="Confirmation phrase"
              description="Type the exact phrase to continue."
            />
          </FsusDangerZone>
        </div>
      </AuditCard>

      <AuditCard name="FsusSiteHeader" :state="auditState">
        <FsusSiteHeader
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
            <fsus-button size="small" data-audit-target data-audit-active>
              Action
            </fsus-button>
          </template>
          <template #mobile-primary-actions>
            <fsus-button size="small">Menu</fsus-button>
          </template>
        </FsusSiteHeader>
      </AuditCard>

      <AuditCard name="FsusSelect" :state="auditState">
        <fsus-select
          :model-value="active ? 'two' : ''"
          placeholder="Select"
          :teleported="false"
          data-audit-focus
          data-audit-target
          data-audit-active
        >
          <fsus-option label="One" value="one" />
          <fsus-option label="Two" value="two" />
        </fsus-select>
      </AuditCard>

      <AuditCard name="FsusSelect" :state="auditState">
        <fsus-select
          :model-value="active ? 'cover-review' : ''"
          :options="selectV2Options"
          placeholder="选择工作流"
          :teleported="false"
          data-audit-focus
          data-audit-target
        />
      </AuditCard>

      <AuditCard name="FsusSlider" :state="auditState">
        <fsus-slider :model-value="active ? 80 : 40" data-audit-target />
      </AuditCard>

      <AuditCard name="FsusSkeleton" :state="auditState">
        <fsus-skeleton style="width: 240px" animated>
          <template #template>
            <fsus-skeleton-item
              variant="image"
              style="width: 100%; height: 88px"
            />
            <fsus-skeleton-item
              variant="text"
              style="width: 80%; margin-top: 12px"
            />
          </template>
        </fsus-skeleton>
      </AuditCard>

      <AuditCard name="FsusSkeletonItem" :state="auditState">
        <fsus-skeleton animated>
          <template #template>
            <fsus-skeleton-item variant="p" style="width: 80%; height: 18px" />
          </template>
        </fsus-skeleton>
      </AuditCard>

      <AuditCard name="FsusSpace" :state="auditState">
        <fsus-space wrap>
          <fsus-button>A</fsus-button>
          <fsus-button type="primary">B</fsus-button>
        </fsus-space>
      </AuditCard>

      <AuditCard name="FsusStatistic" :state="auditState">
        <fsus-statistic title="Active users" :value="active ? 268500 : 128000" />
      </AuditCard>

      <AuditCard name="FsusStep" :state="auditState">
        <fsus-steps :active="active ? 2 : 1">
          <fsus-step title="Draft" />
          <fsus-step title="Review" />
          <fsus-step title="Ship" />
        </fsus-steps>
      </AuditCard>

      <AuditCard name="FsusSteps" :state="auditState">
        <fsus-steps :active="active ? 2 : 1">
          <fsus-step title="撰写" description="整理正文" />
          <fsus-step title="复核" description="检查权限" />
          <fsus-step title="发布" description="同步公开页" />
        </fsus-steps>
      </AuditCard>

      <AuditCard name="FsusSubMenu" :state="auditState">
        <fsus-menu default-active="2" :default-openeds="['sub']">
          <fsus-sub-menu index="sub">
            <template #title>Sub menu</template>
            <fsus-menu-item index="2">Nested item</fsus-menu-item>
          </fsus-sub-menu>
        </fsus-menu>
      </AuditCard>

      <AuditCard name="FsusSwitch" :state="auditState">
        <fsus-switch
          :model-value="active"
          active-text="Open"
          inactive-text="Closed"
        />
      </AuditCard>

      <AuditCard name="FsusTabPane" :state="auditState">
        <fsus-tabs :model-value="active ? 'second' : 'first'">
          <fsus-tab-pane label="First" name="first">First pane</fsus-tab-pane>
          <fsus-tab-pane label="Second" name="second">Second pane</fsus-tab-pane>
        </fsus-tabs>
      </AuditCard>

      <AuditCard name="FsusTable" :state="auditState">
        <fsus-table :data="tableData" border style="width: 100%">
          <fsus-table-column prop="name" label="Name" width="120" />
          <fsus-table-column prop="state" label="State" />
        </fsus-table>
      </AuditCard>

      <AuditCard name="FsusTableColumn" :state="auditState">
        <fsus-table :data="tableData" border style="width: 100%">
          <fsus-table-column prop="name" label="Column" />
        </fsus-table>
      </AuditCard>

      <AuditCard name="FsusAutoResizer" :state="auditState">
        <div class="audit-table-v2-frame">
          <fsus-auto-resizer>
            <template #default="{ height, width }">
              <fsus-table
                :columns="tableV2Columns"
                :data="tableV2Data"
                :width="width"
                :height="height"
              />
            </template>
          </fsus-auto-resizer>
        </div>
      </AuditCard>

      <AuditCard name="FsusTable" :state="auditState">
        <div class="audit-table-v2-frame">
          <fsus-table
            :columns="tableV2Columns"
            :data="tableV2Data"
            :width="260"
            :height="160"
          />
        </div>
      </AuditCard>

      <AuditCard name="FsusTabs" :state="auditState">
        <fsus-tabs :model-value="active ? 'second' : 'first'">
          <fsus-tab-pane label="First" name="first">First content</fsus-tab-pane>
          <fsus-tab-pane label="Second" name="second">Second content</fsus-tab-pane>
        </fsus-tabs>
      </AuditCard>

      <AuditCard name="FsusTag" :state="auditState">
        <fsus-space wrap>
          <fsus-tag :type="active ? 'info' : undefined">Tag</fsus-tag>
          <fsus-tag type="info">Info</fsus-tag>
        </fsus-space>
      </AuditCard>

      <AuditCard name="FsusText" :state="auditState">
        <fsus-text :type="active ? 'primary' : undefined">
          Editorial text sample
        </fsus-text>
      </AuditCard>

      <AuditCard name="FsusThemeModeToggle" :state="auditState">
        <fsus-theme-mode-toggle
          :model-value="themeMode"
          :compact="compact"
          data-audit-focus
          data-audit-target
        />
      </AuditCard>

      <AuditCard name="FsusTimePicker" :state="auditState">
        <fsus-time-picker
          :model-value="dateValue"
          placeholder="Pick time"
          data-audit-focus
          data-audit-target
        />
      </AuditCard>

      <AuditCard name="FsusTimeSelect" :state="auditState">
        <fsus-time-select
          :model-value="active ? '09:00' : ''"
          start="08:30"
          step="00:15"
          end="09:00"
          placeholder="Select time"
          data-audit-focus
          data-audit-target
        />
      </AuditCard>

      <AuditCard name="FsusTimeline" :state="auditState">
        <fsus-timeline>
          <fsus-timeline-item timestamp="2026/05/20" placement="top">
            Audit started
          </fsus-timeline-item>
          <fsus-timeline-item timestamp="2026/05/21" placement="top">
            Review
          </fsus-timeline-item>
        </fsus-timeline>
      </AuditCard>

      <AuditCard name="FsusTimelineItem" :state="auditState">
        <fsus-timeline>
          <fsus-timeline-item timestamp="2026/05/20">
            Timeline item
          </fsus-timeline-item>
        </fsus-timeline>
      </AuditCard>

      <AuditCard name="FsusTooltip" :state="auditState">
        <fsus-tooltip
          content="Tooltip content"
          placement="bottom-start"
          :trigger="['hover', 'click']"
          :show-after="0"
          :hide-after="0"
          :teleported="false"
        >
          <fsus-button data-audit-focus data-audit-target data-audit-active>
            Tooltip
          </fsus-button>
        </fsus-tooltip>
      </AuditCard>

      <AuditCard name="FsusTooltip" :state="auditState">
        <fsus-tooltip
          :placement="boundary ? 'bottom-start' : 'right'"
          :open="active"
          :delay-duration="0"
          :teleported="false"
        >
          <template #trigger>
            <fsus-button data-audit-focus data-audit-target data-audit-active>
              Tooltip V2
            </fsus-button>
          </template>
          Tooltip V2 content
        </fsus-tooltip>
      </AuditCard>

      <AuditCard name="FsusTransfer" :state="auditState">
        <fsus-transfer
          :model-value="active ? [1, 2] : [1]"
          :data="transferData"
          filterable
          filter-placeholder="Search"
        />
      </AuditCard>

      <AuditCard name="FsusTree" :state="auditState">
        <fsus-tree
          :data="treeData"
          node-key="value"
          show-checkbox
          :default-checked-keys="active ? ['level-1-1'] : []"
          :default-expanded-keys="['level-1']"
        />
      </AuditCard>

      <AuditCard name="FsusTreeSelect" :state="auditState">
        <fsus-tree-select
          :model-value="active ? 'level-1-1' : 'level-1'"
          :data="treeData"
          :teleported="false"
          popper-class="audit-tree-select-popper"
          data-audit-focus
          data-audit-target
          data-audit-active
        />
      </AuditCard>

      <AuditCard name="FsusTree" :state="auditState">
        <fsus-tree
          :data="treeDataV2"
          :height="180"
          :item-size="44"
          :default-expanded-keys="[0]"
        />
      </AuditCard>

      <AuditCard name="FsusUpload" :state="auditState">
        <fsus-upload action="#" :auto-upload="false" drag>
          <fsus-icon class="el-icon--upload"><UploadFilled /></fsus-icon>
          <div class="el-upload__text">Drop a file here or <em>browse</em></div>
          <p data-upload-help>PNG/JPG, max 10 MB</p>
        </fsus-upload>
      </AuditCard>

      <AuditCard name="FsusWatermark" :state="auditState">
        <fsus-watermark content="FsusUI">
          <div class="audit-watermark-box" />
        </fsus-watermark>
      </AuditCard>
</template>

<script setup lang="ts">
import * as Icons from '@fsusui/icons'
import {
  FsusDangerZone,
  FsusDestructiveActionPanel,
  FsusEmptyState,
  FsusFormSection,
  FsusInlineActions,
  FsusMetadataItem,
  FsusMetadataRow,
  FsusResourceList,
  FsusResourceListItem,
  FsusRiskNotice,
  FsusSectionHeader,
  FsusSectionNav,
  FsusSettingsSection,
  FsusSiteHeader,
  FsusTypedConfirmField,
} from '@ozwasyd/fsusui'
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
