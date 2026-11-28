<template>
      <AuditCard name="FsusVirtualList" :state="auditState">
        <div class="audit-virtual-frame audit-virtual-frame--list">
          <fsus-virtual-list
            :items="Array.from({ length: 12 }, (_, i) => i)"
            :item-height="44"
            :height="176"
          >
            <template #default="{ item }">
              <div class="audit-virtual-row">Virtual row {{ item }}</div>
            </template>
          </fsus-virtual-list>
        </div>
      </AuditCard>

      <AuditCard name="FsusAffix" :state="auditState">
        <fsus-affix :offset="8" target=".audit-page">
          <fsus-button data-audit-focus data-audit-target>Affix action</fsus-button>
        </fsus-affix>
      </AuditCard>

      <AuditCard name="FsusAlert" :state="auditState">
        <fsus-alert title="Focused feedback" type="info" show-icon />
      </AuditCard>

      <AuditCard name="FsusAside" :state="auditState">
        <fsus-container class="audit-container">
          <fsus-aside width="96px">Aside</fsus-aside>
          <fsus-main>Main</fsus-main>
        </fsus-container>
      </AuditCard>

      <AuditCard name="FsusAutocomplete" :state="auditState">
        <fsus-autocomplete
          :model-value="activeText"
          :fetch-suggestions="querySearch"
          data-audit-focus
          data-audit-target
        />
      </AuditCard>

      <AuditCard name="FsusAvatar" :state="auditState">
        <fsus-space wrap>
          <fsus-avatar :src="imageData" />
          <fsus-avatar shape="square">UI</fsus-avatar>
        </fsus-space>
      </AuditCard>

      <AuditCard name="FsusBacktop" :state="auditState">
        <div class="audit-scroll-shell">
          <div class="audit-scroll-content">Scroll shell</div>
          <fsus-backtop :right="16" :bottom="16" :visibility-height="0" />
        </div>
      </AuditCard>

      <AuditCard name="FsusBadge" :state="auditState">
        <fsus-badge :value="active ? 24 : 8">
          <fsus-button data-audit-focus data-audit-target>Inbox</fsus-button>
        </fsus-badge>
      </AuditCard>

      <AuditCard name="FsusBreadcrumb" :state="auditState">
        <fsus-breadcrumb separator="/">
          <fsus-breadcrumb-item>Home</fsus-breadcrumb-item>
          <fsus-breadcrumb-item>Library</fsus-breadcrumb-item>
        </fsus-breadcrumb>
      </AuditCard>

      <AuditCard name="FsusBreadcrumbItem" :state="auditState">
        <fsus-breadcrumb separator="/">
          <fsus-breadcrumb-item :to="{ path: '/' }">
            Current item
          </fsus-breadcrumb-item>
        </fsus-breadcrumb>
      </AuditCard>

      <AuditCard name="FsusButton" :state="auditState">
        <fsus-button
          :type="active ? 'primary' : undefined"
          data-audit-focus
          data-audit-target
        >
          Button
        </fsus-button>
      </AuditCard>

      <AuditCard name="FsusButtonGroup" :state="auditState">
        <fsus-button-group>
          <fsus-button :type="active ? 'primary' : undefined" :icon="ArrowLeft">
            Prev
          </fsus-button>
          <fsus-button type="primary">
            Next
            <fsus-icon class="fsus-icon--right"><ArrowRight /></fsus-icon>
          </fsus-button>
        </fsus-button-group>
      </AuditCard>

      <AuditCard name="FsusCalendar" :state="auditState">
        <div class="audit-calendar-frame">
          <fsus-calendar :model-value="dateValue" :range="calendarRange" />
        </div>
      </AuditCard>

      <AuditCard name="FsusCard" :state="auditState">
        <fsus-card>
          <template #header>Card header</template>
          <p>Curated surface content</p>
        </fsus-card>
      </AuditCard>

      <AuditCard name="FsusCarousel" :state="auditState">
        <fsus-carousel
          height="120px"
          :autoplay="false"
          :initial-index="active ? 1 : 0"
        >
          <fsus-carousel-item v-for="item in 3" :key="item">
            <div class="audit-carousel-panel">Slide {{ item }}</div>
          </fsus-carousel-item>
        </fsus-carousel>
      </AuditCard>

      <AuditCard name="FsusCarouselItem" :state="auditState">
        <fsus-carousel
          height="120px"
          :autoplay="false"
          :initial-index="active ? 1 : 0"
        >
          <fsus-carousel-item>
            <div class="audit-carousel-panel">Carousel item</div>
          </fsus-carousel-item>
        </fsus-carousel>
      </AuditCard>

      <AuditCard name="FsusCascader" :state="auditState">
        <fsus-cascader
          :model-value="active ? ['guide', 'docs'] : []"
          :options="cascaderOptions"
          :teleported="false"
          placeholder="Cascader"
          data-audit-focus
          data-audit-target
        />
      </AuditCard>

      <AuditCard name="FsusCascaderPanel" :state="auditState">
        <fsus-cascader-panel
          :model-value="active ? ['guide', 'docs'] : []"
          :options="cascaderOptions"
        />
      </AuditCard>

      <AuditCard name="FsusCheckbox" :state="auditState">
        <fsus-checkbox :model-value="active" data-audit-focus data-audit-target>
          Checkbox
        </fsus-checkbox>
      </AuditCard>

      <AuditCard name="FsusCheckboxButton" :state="auditState">
        <fsus-checkbox-group :model-value="active ? ['A'] : []">
          <fsus-checkbox-button value="A">推送到首页</fsus-checkbox-button>
        </fsus-checkbox-group>
      </AuditCard>

      <AuditCard name="FsusCheckboxGroup" :state="auditState">
        <fsus-checkbox-group :model-value="active ? ['A', 'B'] : ['A']">
          <fsus-checkbox label="A">A</fsus-checkbox>
          <fsus-checkbox label="B">B</fsus-checkbox>
        </fsus-checkbox-group>
      </AuditCard>

      <AuditCard name="FsusCheckTag" :state="auditState">
        <fsus-check-tag :checked="active" data-audit-target>
          Check tag
        </fsus-check-tag>
      </AuditCard>

      <AuditCard name="FsusCol" :state="auditState">
        <fsus-row :gutter="12">
          <fsus-col :span="12"><div class="audit-grid-cell">12</div></fsus-col>
          <fsus-col :span="12"><div class="audit-grid-cell">12</div></fsus-col>
        </fsus-row>
      </AuditCard>

      <AuditCard name="FsusCollapse" :state="auditState">
        <fsus-collapse :model-value="active ? ['1', '2'] : ['1']">
          <fsus-collapse-item title="Consistency" name="1">
            First panel
          </fsus-collapse-item>
          <fsus-collapse-item title="Interaction" name="2">
            Second panel
          </fsus-collapse-item>
        </fsus-collapse>
      </AuditCard>

      <AuditCard name="FsusCollapseItem" :state="auditState">
        <fsus-collapse :model-value="active ? ['item'] : []">
          <fsus-collapse-item title="Collapse item" name="item">
            发布前检查摘要
          </fsus-collapse-item>
        </fsus-collapse>
      </AuditCard>

      <AuditCard name="FsusColorPicker" :state="auditState">
        <fsus-color-picker
          :model-value="active ? scholarlyBlue : dotGray"
          data-audit-focus
          data-audit-target
        />
      </AuditCard>

      <AuditCard name="FsusCollectionToolbar" :state="auditState">
        <FsusCollectionToolbar ariaLabel="Collection controls" density="compact">
          <template #primary>
            <fsus-input
              :model-value="activeText"
              placeholder="Search"
              data-audit-focus
              data-audit-target
            />
          </template>
          <template #filters>
            <FsusFilterGroup label="State" density="compact">
              <FsusSegmentedControl
                :model-value="active ? 'open' : 'all'"
                :items="collectionStateItems"
                ariaLabel="Filter state"
                density="compact"
              />
            </FsusFilterGroup>
          </template>
          <template #actions>
            <fsus-button data-audit-active data-audit-target>Refresh</fsus-button>
          </template>
        </FsusCollectionToolbar>
        <FsusCollectionSummary
          title="Results"
          :total="12"
          :visible="active ? 3 : 12"
          :state="active ? 'Filtered' : ''"
          density="compact"
        />
        <FsusPaginationBar ariaLabel="Results pagination" density="compact">
          <template #summary>Page 1 of 4</template>
          <template #pagination>
            <fsus-pagination small layout="prev, pager, next" :total="40" />
          </template>
        </FsusPaginationBar>
      </AuditCard>

      <AuditCard name="FsusConfigProvider" :state="auditState">
        <fsus-config-provider :button="{ autoInsertSpace: false }">
          <fsus-button type="primary" data-audit-target>
            Provider child
          </fsus-button>
        </fsus-config-provider>
      </AuditCard>

      <AuditCard name="FsusContainer" :state="auditState">
        <fsus-container class="audit-container">
          <fsus-header height="36px">Header</fsus-header>
          <fsus-main>Main</fsus-main>
          <fsus-footer height="36px">Footer</fsus-footer>
        </fsus-container>
      </AuditCard>

      <AuditCard name="FsusCountdown" :state="auditState">
        <fsus-countdown title="Countdown" :value="countdownValue" />
      </AuditCard>

      <AuditCard name="FsusDatePicker" :state="auditState">
        <fsus-date-picker
          :model-value="dateValue"
          type="date"
          placeholder="Pick day"
          data-audit-focus
          data-audit-target
        />
      </AuditCard>

      <AuditCard name="FsusDescriptions" :state="auditState">
        <fsus-descriptions title="Profile" border :column="1">
          <fsus-descriptions-item label="Name">FsusUI</fsus-descriptions-item>
          <fsus-descriptions-item label="State">
            {{ active ? 'Active' : 'Ready' }}
          </fsus-descriptions-item>
        </fsus-descriptions>
      </AuditCard>

      <AuditCard name="FsusDescriptionsItem" :state="auditState">
        <fsus-descriptions :column="1" border>
          <fsus-descriptions-item label="文章状态">
            等待复核
          </fsus-descriptions-item>
        </fsus-descriptions>
      </AuditCard>

      <AuditCard name="FsusDialog" :state="auditState">
        <fsus-button
          v-if="!dialogVisible"
          data-audit-active
          data-audit-focus
          data-audit-target
          @click="dialogVisible = true"
        >
          Open dialog
        </fsus-button>
        <fsus-dialog
          v-model:open="dialogVisible"
          title="Dialog"
          width="280px"
          :append-to-body="false"
          modal-class="audit-floating-overlay"
          :modal="false"
          :lock-scroll="false"
        >
          <span>Dialog content</span>
        </fsus-dialog>
      </AuditCard>

      <AuditCard name="FsusDivider" :state="auditState">
        <span>Before</span>
        <fsus-divider content-position="left">Divider</fsus-divider>
        <span>After</span>
      </AuditCard>

      <AuditCard name="FsusDrawer" :state="auditState">
        <fsus-button
          v-if="!drawerVisible"
          data-audit-active
          data-audit-focus
          data-audit-target
          @click="drawerVisible = true"
        >
          Open drawer
        </fsus-button>
        <fsus-drawer
          v-model:open="drawerVisible"
          title="Drawer"
          size="260px"
          :append-to-body="false"
          modal-class="audit-floating-overlay"
          :modal="false"
          :lock-scroll="false"
        >
          Drawer content
        </fsus-drawer>
      </AuditCard>

      <AuditCard name="FsusDropdown" :state="auditState">
        <fsus-dropdown trigger="click" :show-timeout="0" :teleported="false">
          <fsus-button
            type="primary"
            data-audit-focus
            data-audit-target
            data-audit-active
          >
            Dropdown
            <fsus-icon class="fsus-icon--right"><ArrowDown /></fsus-icon>
          </fsus-button>
          <template #dropdown>
            <fsus-dropdown-menu>
              <fsus-dropdown-item>Action one</fsus-dropdown-item>
              <fsus-dropdown-item :disabled="!active">
                Action two
              </fsus-dropdown-item>
            </fsus-dropdown-menu>
          </template>
        </fsus-dropdown>
      </AuditCard>

      <AuditCard name="FsusDropdownItem" :state="auditState">
        <fsus-dropdown trigger="click" :show-timeout="0" :teleported="false">
          <fsus-button data-audit-active data-audit-target>
            Dropdown item
          </fsus-button>
          <template #dropdown>
            <fsus-dropdown-menu>
              <fsus-dropdown-item :divided="active">
                导出 Markdown
              </fsus-dropdown-item>
            </fsus-dropdown-menu>
          </template>
        </fsus-dropdown>
      </AuditCard>

      <AuditCard name="FsusDropdownMenu" :state="auditState">
        <fsus-dropdown trigger="click" :show-timeout="0" :teleported="false">
          <fsus-button data-audit-active data-audit-target>
            Dropdown menu
          </fsus-button>
          <template #dropdown>
            <fsus-dropdown-menu>
              <fsus-dropdown-item>Menu action</fsus-dropdown-item>
            </fsus-dropdown-menu>
          </template>
        </fsus-dropdown>
      </AuditCard>

      <AuditCard name="FsusEmptyState" :state="auditState">
        <FsusEmptyState
          :size="active ? 'page' : 'compact'"
          title="No records"
          description="Adjust filters or create a new item."
          :action-variant="active ? 'primary' : 'secondary'"
        >
          <fsus-button
            :type="active ? 'primary' : undefined"
            data-audit-focus
            data-audit-target
            data-audit-active
          >
            Create item
          </fsus-button>
        </FsusEmptyState>
      </AuditCard>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import * as Icons from '@fsusui/icons'
import {
  FsusCollectionSummary,
  FsusCollectionToolbar,
  FsusEmptyState,
  FsusFilterGroup,
  FsusPaginationBar,
  FsusSegmentedControl,
} from '@ozwasyd/fsusui'
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
