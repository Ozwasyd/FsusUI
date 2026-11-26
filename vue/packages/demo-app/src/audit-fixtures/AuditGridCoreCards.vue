<template>
      <AuditCard name="FixedSizeList" :state="auditState">
        <div class="audit-virtual-frame audit-virtual-frame--list">
          <fixed-size-list
            :item-size="44"
            :total="12"
            :width="260"
            :height="176"
          >
            <template #default="{ index, style }">
              <div :style="style" class="audit-virtual-row">
                Fixed row {{ index }}
              </div>
            </template>
          </fixed-size-list>
        </div>
      </AuditCard>

      <AuditCard name="DynamicSizeList" :state="auditState">
        <div class="audit-virtual-frame audit-virtual-frame--list">
          <dynamic-size-list
            :estimated-item-size="44"
            :item-size="() => 44"
            :total="12"
            :width="260"
            :height="176"
          >
            <template #default="{ index, style }">
              <div :style="style" class="audit-virtual-row">
                Dynamic row {{ index }}
              </div>
            </template>
          </dynamic-size-list>
        </div>
      </AuditCard>

      <AuditCard name="FixedSizeGrid" :state="auditState">
        <div class="audit-virtual-frame audit-virtual-frame--grid">
          <fixed-size-grid
            :column-width="88"
            :row-height="44"
            :total-column="8"
            :total-row="8"
            :width="264"
            :height="176"
          >
            <template #default="{ columnIndex, rowIndex, style }">
              <div :style="style" class="audit-virtual-row">
                {{ rowIndex }},{{ columnIndex }}
              </div>
            </template>
          </fixed-size-grid>
        </div>
      </AuditCard>

      <AuditCard name="DynamicSizeGrid" :state="auditState">
        <div class="audit-virtual-frame audit-virtual-frame--grid">
          <dynamic-size-grid
            :column-width="() => 88"
            :row-height="() => 44"
            :estimated-column-width="88"
            :estimated-row-height="44"
            :total-column="8"
            :total-row="8"
            :width="264"
            :height="176"
          >
            <template #default="{ columnIndex, rowIndex, style }">
              <div :style="style" class="audit-virtual-row">
                {{ rowIndex }},{{ columnIndex }}
              </div>
            </template>
          </dynamic-size-grid>
        </div>
      </AuditCard>

      <AuditCard name="ElVisuallyHidden" :state="auditState">
        <el-visually-hidden>Hidden audit text</el-visually-hidden>
        <span class="audit-inline-note">Visible companion text</span>
      </AuditCard>

      <AuditCard name="ElAffix" :state="auditState">
        <el-affix :offset="8" target=".audit-page">
          <el-button data-audit-focus data-audit-target>Affix action</el-button>
        </el-affix>
      </AuditCard>

      <AuditCard name="ElAlert" :state="auditState">
        <el-alert title="Focused feedback" type="info" show-icon />
      </AuditCard>

      <AuditCard name="ElAside" :state="auditState">
        <el-container class="audit-container">
          <el-aside width="96px">Aside</el-aside>
          <el-main>Main</el-main>
        </el-container>
      </AuditCard>

      <AuditCard name="ElAutocomplete" :state="auditState">
        <el-autocomplete
          :model-value="activeText"
          :fetch-suggestions="querySearch"
          data-audit-focus
          data-audit-target
        />
      </AuditCard>

      <AuditCard name="ElAvatar" :state="auditState">
        <el-space wrap>
          <el-avatar :src="imageData" />
          <el-avatar shape="square">UI</el-avatar>
        </el-space>
      </AuditCard>

      <AuditCard name="ElBacktop" :state="auditState">
        <div class="audit-scroll-shell">
          <div class="audit-scroll-content">Scroll shell</div>
          <el-backtop :right="16" :bottom="16" :visibility-height="0" />
        </div>
      </AuditCard>

      <AuditCard name="ElBadge" :state="auditState">
        <el-badge :value="active ? 24 : 8">
          <el-button data-audit-focus data-audit-target>Inbox</el-button>
        </el-badge>
      </AuditCard>

      <AuditCard name="ElBreadcrumb" :state="auditState">
        <el-breadcrumb separator="/">
          <el-breadcrumb-item>Home</el-breadcrumb-item>
          <el-breadcrumb-item>Library</el-breadcrumb-item>
        </el-breadcrumb>
      </AuditCard>

      <AuditCard name="ElBreadcrumbItem" :state="auditState">
        <el-breadcrumb separator="/">
          <el-breadcrumb-item :to="{ path: '/' }">
            Current item
          </el-breadcrumb-item>
        </el-breadcrumb>
      </AuditCard>

      <AuditCard name="ElButton" :state="auditState">
        <el-button
          :type="active ? 'primary' : undefined"
          data-audit-focus
          data-audit-target
        >
          Button
        </el-button>
      </AuditCard>

      <AuditCard name="ElButtonGroup" :state="auditState">
        <el-button-group>
          <el-button :type="active ? 'primary' : undefined" :icon="ArrowLeft">
            Prev
          </el-button>
          <el-button type="primary">
            Next
            <el-icon class="el-icon--right"><ArrowRight /></el-icon>
          </el-button>
        </el-button-group>
      </AuditCard>

      <AuditCard name="ElCalendar" :state="auditState">
        <div class="audit-calendar-frame">
          <el-calendar :model-value="dateValue" :range="calendarRange" />
        </div>
      </AuditCard>

      <AuditCard name="ElCard" :state="auditState">
        <el-card>
          <template #header>Card header</template>
          <p>Curated surface content</p>
        </el-card>
      </AuditCard>

      <AuditCard name="ElCarousel" :state="auditState">
        <el-carousel
          height="120px"
          :autoplay="false"
          :initial-index="active ? 1 : 0"
        >
          <el-carousel-item v-for="item in 3" :key="item">
            <div class="audit-carousel-panel">Slide {{ item }}</div>
          </el-carousel-item>
        </el-carousel>
      </AuditCard>

      <AuditCard name="ElCarouselItem" :state="auditState">
        <el-carousel
          height="120px"
          :autoplay="false"
          :initial-index="active ? 1 : 0"
        >
          <el-carousel-item>
            <div class="audit-carousel-panel">Carousel item</div>
          </el-carousel-item>
        </el-carousel>
      </AuditCard>

      <AuditCard name="ElCascader" :state="auditState">
        <el-cascader
          :model-value="active ? ['guide', 'docs'] : []"
          :options="cascaderOptions"
          :teleported="false"
          placeholder="Cascader"
          data-audit-focus
          data-audit-target
        />
      </AuditCard>

      <AuditCard name="ElCascaderPanel" :state="auditState">
        <el-cascader-panel
          :model-value="active ? ['guide', 'docs'] : []"
          :options="cascaderOptions"
        />
      </AuditCard>

      <AuditCard name="ElCheckbox" :state="auditState">
        <el-checkbox :model-value="active" data-audit-focus data-audit-target>
          Checkbox
        </el-checkbox>
      </AuditCard>

      <AuditCard name="ElCheckboxButton" :state="auditState">
        <el-checkbox-group :model-value="active ? ['A'] : []">
          <el-checkbox-button label="A">推送到首页</el-checkbox-button>
        </el-checkbox-group>
      </AuditCard>

      <AuditCard name="ElCheckboxGroup" :state="auditState">
        <el-checkbox-group :model-value="active ? ['A', 'B'] : ['A']">
          <el-checkbox label="A">A</el-checkbox>
          <el-checkbox label="B">B</el-checkbox>
        </el-checkbox-group>
      </AuditCard>

      <AuditCard name="ElCheckTag" :state="auditState">
        <el-check-tag :checked="active" data-audit-target>
          Check tag
        </el-check-tag>
      </AuditCard>

      <AuditCard name="ElCol" :state="auditState">
        <el-row :gutter="12">
          <el-col :span="12"><div class="audit-grid-cell">12</div></el-col>
          <el-col :span="12"><div class="audit-grid-cell">12</div></el-col>
        </el-row>
      </AuditCard>

      <AuditCard name="ElCollapse" :state="auditState">
        <el-collapse :model-value="active ? ['1', '2'] : ['1']">
          <el-collapse-item title="Consistency" name="1">
            First panel
          </el-collapse-item>
          <el-collapse-item title="Interaction" name="2">
            Second panel
          </el-collapse-item>
        </el-collapse>
      </AuditCard>

      <AuditCard name="ElCollapseItem" :state="auditState">
        <el-collapse :model-value="active ? ['item'] : []">
          <el-collapse-item title="Collapse item" name="item">
            发布前检查摘要
          </el-collapse-item>
        </el-collapse>
      </AuditCard>

      <AuditCard name="ElCollapseTransition" :state="auditState">
        <el-button
          data-audit-target
          @click="transitionVisible = !transitionVisible"
        >
          Toggle
        </el-button>
        <el-collapse-transition>
          <div
            v-show="active || transitionVisible"
            class="audit-transition-box"
          >
            Transition content
          </div>
        </el-collapse-transition>
      </AuditCard>

      <AuditCard name="ElColorPicker" :state="auditState">
        <el-color-picker
          :model-value="active ? scholarlyBlue : dotGray"
          data-audit-focus
          data-audit-target
        />
      </AuditCard>

      <AuditCard name="ElCollectionToolbar" :state="auditState">
        <ElCollectionToolbar ariaLabel="Collection controls" density="compact">
          <template #primary>
            <el-input
              :model-value="activeText"
              placeholder="Search"
              data-audit-focus
              data-audit-target
            />
          </template>
          <template #filters>
            <ElFilterGroup label="State" density="compact">
              <ElSegmentedControl
                :model-value="active ? 'open' : 'all'"
                :items="collectionStateItems"
                ariaLabel="Filter state"
                density="compact"
              />
            </ElFilterGroup>
          </template>
          <template #actions>
            <el-button data-audit-active data-audit-target>Refresh</el-button>
          </template>
        </ElCollectionToolbar>
        <ElCollectionSummary
          title="Results"
          :total="12"
          :visible="active ? 3 : 12"
          :state="active ? 'Filtered' : ''"
          density="compact"
        />
        <ElPaginationBar ariaLabel="Results pagination" density="compact">
          <template #summary>Page 1 of 4</template>
          <template #pagination>
            <el-pagination small layout="prev, pager, next" :total="40" />
          </template>
        </ElPaginationBar>
      </AuditCard>

      <AuditCard name="ElConfigProvider" :state="auditState">
        <el-config-provider :button="{ autoInsertSpace: false }">
          <el-button type="primary" data-audit-target>
            Provider child
          </el-button>
        </el-config-provider>
      </AuditCard>

      <AuditCard name="ElContainer" :state="auditState">
        <el-container class="audit-container">
          <el-header height="36px">Header</el-header>
          <el-main>Main</el-main>
          <el-footer height="36px">Footer</el-footer>
        </el-container>
      </AuditCard>

      <AuditCard name="ElCountdown" :state="auditState">
        <el-countdown title="Countdown" :value="countdownValue" />
      </AuditCard>

      <AuditCard name="ElDatePicker" :state="auditState">
        <el-date-picker
          :model-value="dateValue"
          type="date"
          placeholder="Pick day"
          data-audit-focus
          data-audit-target
        />
      </AuditCard>

      <AuditCard name="ElDescriptions" :state="auditState">
        <el-descriptions title="Profile" border :column="1">
          <el-descriptions-item label="Name">FsusUI</el-descriptions-item>
          <el-descriptions-item label="State">
            {{ active ? 'Active' : 'Ready' }}
          </el-descriptions-item>
        </el-descriptions>
      </AuditCard>

      <AuditCard name="ElDescriptionsItem" :state="auditState">
        <el-descriptions :column="1" border>
          <el-descriptions-item label="文章状态">
            等待复核
          </el-descriptions-item>
        </el-descriptions>
      </AuditCard>

      <AuditCard name="ElDialog" :state="auditState">
        <el-button
          v-if="!dialogVisible"
          data-audit-active
          data-audit-focus
          data-audit-target
          @click="dialogVisible = true"
        >
          Open dialog
        </el-button>
        <el-dialog
          v-model="dialogVisible"
          title="Dialog"
          width="280px"
          :append-to-body="false"
          modal-class="audit-floating-overlay"
          :modal="false"
          :lock-scroll="false"
        >
          <span>Dialog content</span>
        </el-dialog>
      </AuditCard>

      <AuditCard name="ElDivider" :state="auditState">
        <span>Before</span>
        <el-divider content-position="left">Divider</el-divider>
        <span>After</span>
      </AuditCard>

      <AuditCard name="ElDrawer" :state="auditState">
        <el-button
          v-if="!drawerVisible"
          data-audit-active
          data-audit-focus
          data-audit-target
          @click="drawerVisible = true"
        >
          Open drawer
        </el-button>
        <el-drawer
          v-model="drawerVisible"
          title="Drawer"
          size="260px"
          :append-to-body="false"
          modal-class="audit-floating-overlay"
          :modal="false"
          :lock-scroll="false"
        >
          Drawer content
        </el-drawer>
      </AuditCard>

      <AuditCard name="ElDropdown" :state="auditState">
        <el-dropdown trigger="click" :show-timeout="0" :teleported="false">
          <el-button
            type="primary"
            data-audit-focus
            data-audit-target
            data-audit-active
          >
            Dropdown
            <el-icon class="el-icon--right"><ArrowDown /></el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item>Action one</el-dropdown-item>
              <el-dropdown-item :disabled="!active">
                Action two
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </AuditCard>

      <AuditCard name="ElDropdownItem" :state="auditState">
        <el-dropdown trigger="click" :show-timeout="0" :teleported="false">
          <el-button data-audit-active data-audit-target>
            Dropdown item
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item :divided="active">
                导出 Markdown
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </AuditCard>

      <AuditCard name="ElDropdownMenu" :state="auditState">
        <el-dropdown trigger="click" :show-timeout="0" :teleported="false">
          <el-button data-audit-active data-audit-target>
            Dropdown menu
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item>Menu action</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </AuditCard>

      <AuditCard name="ElEmpty" :state="auditState">
        <el-empty description="No records" />
      </AuditCard>

      <AuditCard name="ElEmptyState" :state="auditState">
        <ElEmptyState
          :size="active ? 'page' : 'compact'"
          title="No records"
          description="Adjust filters or create a new item."
          :action-variant="active ? 'primary' : 'secondary'"
        >
          <el-button
            :type="active ? 'primary' : undefined"
            data-audit-focus
            data-audit-target
            data-audit-active
          >
            Create item
          </el-button>
        </ElEmptyState>
      </AuditCard>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import * as Icons from '@element-plus/icons-vue'
import {
  ElCollectionSummary,
  ElCollectionToolbar,
  ElEmptyState,
  ElFilterGroup,
  ElPaginationBar,
  ElSegmentedControl,
} from '../../../element-plus'
import AuditCard from '../AuditCard.vue'
import type { UiAuditState } from '../ui-audit-manifest'
import type { AuditGridData } from './use-audit-grid-data'

const props = defineProps<{
  auditState: UiAuditState
  data: AuditGridData
}>()

const { ArrowDown, ArrowLeft, ArrowRight } = Icons
const {
  active,
  activeText,
  calendarRange,
  cascaderOptions,
  collectionStateItems,
  countdownValue,
  dateValue,
  dotGray,
  imageData,
  querySearch,
  scholarlyBlue,
} = props.data

const transitionVisible = ref(false)
const dialogVisible = ref(false)
const drawerVisible = ref(false)

watch(
  () => props.auditState,
  () => {
    transitionVisible.value = false
    dialogVisible.value = false
    drawerVisible.value = false
  },
)
</script>
