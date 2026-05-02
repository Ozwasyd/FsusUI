<script setup lang="ts">
import { computed, ref } from 'vue'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import { demoComponents } from './demo-components'
import type { CheckboxGroupValueType } from '../../element-plus'

const {
  ElAutoResizer,
  ElAlert,
  ElBadge,
  ElButton,
  ElButtonGroup,
  ElCascader,
  ElCheckboxButton,
  ElCheckboxGroup,
  ElCollapseTransition,
  ElCol,
  ElDatePicker,
  ElDialog,
  ElDrawer,
  ElDropdown,
  ElDropdownItem,
  ElDropdownMenu,
  ElEmpty,
  ElInput,
  ElInputNumber,
  ElIcon,
  ElOption,
  ElOptionGroup,
  ElPagination,
  ElPopover,
  ElProgress,
  ElRadioButton,
  ElRadioGroup,
  ElRow,
  ElScrollbar,
  ElSelect,
  ElSelectV2,
  ElSkeleton,
  ElSkeletonItem,
  ElSpace,
  ElSwitch,
  ElTable,
  ElTableColumn,
  ElTableV2,
  ElTag,
  ElText,
  ElTimePicker,
  ElTooltip,
  ElTooltipV2,
  ElTree,
  ElTreeSelect,
  ElUpload,
  ElVisuallyHidden,
} = demoComponents

const iconGallery = Object.entries(ElementPlusIconsVue)
  .map(([name, component]) => ({ name, component }))
  .sort((first, second) => first.name.localeCompare(second.name))

const props = defineProps<{
  mode: string
  theme?: 'light' | 'dark'
  compact?: boolean
}>()

const inputValue = ref('FsusUI')
const inputNumberValue = ref<number | undefined>(12.34)
const selectValue = ref('studio')
const selectV2Value = ref('hangzhou')
const checkboxButtonValue = ref<CheckboxGroupValueType>(['Desktop', 'A11y'])
const radioButtonValue = ref<boolean | string | number>('desktop')
const cascaderValue = ref<any>(['guide', 'token'])
const currentPage = ref(2)
const dateValue = ref(new Date('2026-04-22T09:00:00+08:00'))
const timeValue = ref(new Date('2026-04-22T10:30:00+08:00'))
const dialogVisible = ref(true)
const drawerVisible = ref(true)
const dropdownVisible = ref(false)
const switchValue = ref(true)
const transitionVisible = ref(true)

const selectOptions = [
  { label: 'Studio', value: 'studio' },
  { label: 'Design Ops', value: 'design-ops' },
  { label: 'Frontend', value: 'frontend' },
]

const selectV2Options = [
  { label: 'Hangzhou', value: 'hangzhou' },
  { label: 'Shanghai', value: 'shanghai' },
  { label: 'Tokyo', value: 'tokyo' },
]

const cascaderOptions = [
  {
    value: 'guide',
    label: '设计规范',
    children: [
      { value: 'token', label: 'Token 系统' },
      { value: 'motion', label: '动效策略' },
    ],
  },
  {
    value: 'component',
    label: '组件层',
    children: [
      { value: 'button', label: 'Button' },
      { value: 'overlay', label: 'Overlay' },
    ],
  },
]

const tableData = [
  { date: '2026-04-06', name: '视觉一致性', address: '设计评审中' },
  { date: '2026-04-07', name: '交互焦点环', address: '验收通过' },
  { date: '2026-04-08', name: '骨架屏过渡', address: '联调中' },
]

const tableV2Columns = [
  { key: 'name', dataKey: 'name', title: '组件', width: 180 },
  { key: 'status', dataKey: 'status', title: '状态', width: 120 },
  { key: 'owner', dataKey: 'owner', title: '负责人', width: 120 },
]

const tableV2Data = [
  { id: 1, name: 'Button', status: 'Ready', owner: 'UI' },
  { id: 2, name: 'Dialog', status: 'Review', owner: 'UX' },
  { id: 3, name: 'Table', status: 'Demo', owner: 'FE' },
  { id: 4, name: 'Tree', status: 'Demo', owner: 'FE' },
]

const treeData = [
  {
    id: 'foundation',
    value: 'foundation',
    label: '基础层',
    children: [
      { id: 'visual', value: 'visual', label: '视觉 Token' },
      { id: 'motion', value: 'motion', label: '动效模式' },
    ],
  },
  {
    id: 'patterns',
    value: 'patterns',
    label: '模式层',
    children: [
      { id: 'mobile', value: 'mobile', label: '移动端布局' },
      { id: 'desktop', value: 'desktop', label: '桌面端布局' },
    ],
  },
]

const uploadFiles = [
  {
    name: 'brand-surface.fig',
    url: 'https://example.com/brand-surface.fig',
  },
]

const pageTitle = computed(() => {
  switch (props.mode) {
    case 'forms':
      return 'Visual Fixtures / Forms'
    case 'data':
      return 'Visual Fixtures / Data'
    case 'surfaces':
      return 'Visual Fixtures / Surfaces'
    case 'states':
      return 'Visual Fixtures / Boundary States'
    case 'overlays':
      return 'Visual Fixtures / Overlay Boundaries'
    case 'data-boundaries':
      return 'Visual Fixtures / Data Boundaries'
    case 'icons':
      return 'Visual Fixtures / Icons'
    default:
      return 'Visual Fixtures'
  }
})

const currentTheme = computed(() => props.theme ?? 'light')
const isCompact = computed(() => props.compact ?? false)
const currentTooltipEffect = computed(() =>
  currentTheme.value === 'dark' ? 'dark' : 'light'
)
const currentPopoverEffect = currentTooltipEffect
const paginationLayout = computed(() =>
  isCompact.value ? 'prev, pager, next' : 'prev, pager, next, jumper, ->, total'
)
const tableV2Width = computed(() => (isCompact.value ? 320 : 480))
const dialogWidth = computed(() => (isCompact.value ? 'min(100%, 360px)' : '420px'))
const drawerSize = computed(() => (isCompact.value ? '100%' : '40%'))
</script>

<template>
  <main
    v-bind="{
      'data-visual-mode': mode,
      'data-visual-theme': currentTheme,
      'data-visual-compact': isCompact ? 'true' : 'false',
    }"
    :class="['visual-fixtures', `theme-${currentTheme}`, { 'is-compact': isCompact }]"
  >
    <header class="visual-header">
      <h1>{{ pageTitle }}</h1>
      <p>
        稳定视觉夹具页，只用于 Playwright 视觉回归。
        <span class="fixture-meta">{{ currentTheme }} / {{ isCompact ? 'mobile' : 'desktop' }}</span>
      </p>
    </header>

    <section
      v-if="mode === 'forms'"
      v-bind="{ 'data-testid': 'fixture-forms' }"
      class="fixture-grid"
    >
      <article class="fixture-card">
        <h2>Input</h2>
        <el-space fill>
          <el-input v-model="inputValue" placeholder="请输入关键字" clearable />
          <el-input model-value="Readonly" readonly />
          <el-input model-value="Disabled" disabled />
          <el-input model-value="" placeholder="Empty state" clearable />
        </el-space>
      </article>

      <article class="fixture-card">
        <h2>Button Group</h2>
        <el-space fill>
          <el-button-group>
            <el-button>Prev</el-button>
            <el-button type="primary">Next</el-button>
          </el-button-group>
          <el-button loading>Loading</el-button>
          <el-button disabled>Disabled</el-button>
        </el-space>
      </article>

      <article class="fixture-card">
        <h2>Input Number</h2>
        <el-input-number v-model="inputNumberValue" :precision="2" :step="0.25" />
      </article>

      <article class="fixture-card">
        <h2>Select</h2>
        <el-select v-model="selectValue" :teleported="false" clearable>
          <el-option-group label="Teams">
            <el-option
              v-for="option in selectOptions"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            />
          </el-option-group>
          <el-option-group label="Disabled">
            <el-option label="Archive" value="archive" disabled />
          </el-option-group>
        </el-select>
      </article>

      <article class="fixture-card">
        <h2>Select V2</h2>
        <el-select-v2
          v-model="selectV2Value"
          :options="selectV2Options"
          :teleported="false"
        />
      </article>

      <article class="fixture-card">
        <h2>Cascader</h2>
        <el-cascader
          v-model="cascaderValue"
          :options="cascaderOptions"
          :teleported="false"
        />
      </article>

      <article class="fixture-card">
        <h2>Choice Buttons</h2>
        <el-space fill>
          <el-checkbox-group v-model="checkboxButtonValue">
            <el-checkbox-button label="Desktop" />
            <el-checkbox-button label="Mobile" />
            <el-checkbox-button label="A11y" />
          </el-checkbox-group>
          <el-radio-group v-model="radioButtonValue">
            <el-radio-button label="desktop">Desktop</el-radio-button>
            <el-radio-button label="mobile">Mobile</el-radio-button>
          </el-radio-group>
        </el-space>
      </article>

      <article class="fixture-card">
        <h2>Date / Time</h2>
        <el-space fill>
          <el-date-picker v-model="dateValue" type="date" />
          <el-time-picker v-model="timeValue" />
        </el-space>
      </article>

      <article class="fixture-card">
        <h2>Upload</h2>
        <el-upload
          action="#"
          :auto-upload="false"
          :file-list="uploadFiles"
          list-type="text"
        >
          <el-button type="primary">Select File</el-button>
        </el-upload>
      </article>
    </section>

    <section
      v-else-if="mode === 'data'"
      v-bind="{ 'data-testid': 'fixture-data' }"
      class="fixture-grid"
    >
      <article class="fixture-card">
        <h2>Pagination</h2>
        <el-pagination
          v-model:current-page="currentPage"
          :layout="paginationLayout"
          :page-size="10"
          :total="120"
          :small="isCompact"
        />
      </article>

      <article class="fixture-card fixture-card--wide">
        <h2>Table</h2>
        <div class="fixture-scroll-shell">
          <el-table :data="tableData" style="width: 100%; min-width: 420px">
            <el-table-column prop="date" label="Date" width="140" />
            <el-table-column prop="name" label="Name" />
            <el-table-column prop="address" label="Status" />
          </el-table>
        </div>
      </article>

      <article class="fixture-card fixture-card--wide">
        <h2>Table V2</h2>
        <div class="fixture-scroll-shell">
          <el-table-v2 :columns="tableV2Columns" :data="tableV2Data" :width="tableV2Width" :height="220" />
        </div>
        <div class="fixture-scroll-shell" style="height: 240px; margin-top: 12px">
          <el-auto-resizer>
            <template #default="{ width }">
              <el-table-v2
                :columns="tableV2Columns"
                :data="tableV2Data"
                :width="Math.max(width, 320)"
                :height="220"
              />
            </template>
          </el-auto-resizer>
        </div>
      </article>

      <article class="fixture-card">
        <h2>Skeleton Item</h2>
        <el-skeleton animated>
          <template #template>
            <el-skeleton-item variant="image" />
            <el-skeleton-item variant="h3" />
            <el-skeleton-item variant="text" />
            <el-skeleton-item variant="text" />
          </template>
        </el-skeleton>
      </article>

      <article class="fixture-card">
        <h2>Tree</h2>
        <el-tree :data="treeData" node-key="id" default-expand-all />
      </article>

      <article class="fixture-card">
        <h2>Tree Select</h2>
        <el-tree-select
          :model-value="'visual'"
          :data="treeData"
          node-key="id"
          default-expand-all
          check-strictly
          :teleported="false"
        />
      </article>
    </section>

    <section
      v-else-if="mode === 'states'"
      v-bind="{ 'data-testid': 'fixture-states' }"
      class="fixture-grid"
    >
      <article class="fixture-card">
        <h2>Empty / Disabled / Loading</h2>
        <el-space fill>
          <el-input model-value="" placeholder="Empty input" clearable />
          <el-input model-value="Readonly boundary" readonly />
          <el-input model-value="Disabled boundary" disabled />
          <el-button loading>Loading action</el-button>
          <el-button disabled>Disabled action</el-button>
        </el-space>
      </article>

      <article class="fixture-card">
        <h2>Text Overflow</h2>
        <el-space fill>
          <el-text truncated>
            This is a deliberately long boundary string that should stay inside
            the fixture card without changing the visual system.
          </el-text>
          <el-tag>short</el-tag>
          <el-tag type="warning">very-long-tag-label-boundary</el-tag>
          <el-alert
            title="Long state message"
            description="Long descriptions, compact cards, and status icons share this state fixture."
            type="warning"
            show-icon
            :closable="false"
          />
        </el-space>
      </article>

      <article class="fixture-card">
        <h2>Binary Controls</h2>
        <el-space fill>
          <el-switch
            :model-value="switchValue"
            active-text="On"
            inactive-text="Off"
            @update:model-value="switchValue = $event === true"
          />
          <el-radio-group v-model="radioButtonValue">
            <el-radio-button label="desktop">Desktop</el-radio-button>
            <el-radio-button label="mobile">Mobile</el-radio-button>
          </el-radio-group>
          <el-checkbox-group v-model="checkboxButtonValue">
            <el-checkbox-button label="Desktop" />
            <el-checkbox-button label="Mobile" disabled />
            <el-checkbox-button label="A11y" />
          </el-checkbox-group>
        </el-space>
      </article>

      <article class="fixture-card">
        <h2>Assistive / Transition</h2>
        <el-visually-hidden>Assistive text boundary</el-visually-hidden>
        <el-button @click="transitionVisible = !transitionVisible">
          Toggle transition
        </el-button>
        <el-collapse-transition>
          <div v-show="transitionVisible" class="fixture-note">
            Collapse transition content
          </div>
        </el-collapse-transition>
        <el-badge :value="99">
          <el-button>Badge boundary</el-button>
        </el-badge>
      </article>
    </section>

    <section
      v-else-if="mode === 'overlays'"
      v-bind="{ 'data-testid': 'fixture-overlays' }"
      class="fixture-grid"
    >
      <article class="fixture-card">
        <h2>Tooltip / Popover</h2>
        <el-space>
          <el-tooltip
            :visible="true"
            content="Visible tooltip boundary"
            :teleported="false"
          >
            <el-button>Tooltip</el-button>
          </el-tooltip>
          <el-tooltip-v2
            always-on
            show-arrow
            placement="right"
            :teleported="false"
          >
            <template #trigger>
              <el-button>Tooltip V2</el-button>
            </template>
            Tooltip V2 overlay
          </el-tooltip-v2>
          <el-popover
            :visible="true"
            title="Popover boundary"
            content="Persistent popover content"
            :teleported="false"
          >
            <template #reference>
              <el-button>Popover</el-button>
            </template>
          </el-popover>
        </el-space>
      </article>

      <article class="fixture-card">
        <h2>Dropdown</h2>
        <el-dropdown
          trigger="click"
          :hide-on-click="false"
          :teleported="false"
        >
          <span class="dropdown-trigger-proxy">
            <el-button>Open Dropdown</el-button>
          </span>
          <template #dropdown>
            <div class="dropdown-menu-proxy">
              <el-dropdown-menu>
                <el-dropdown-item>Primary</el-dropdown-item>
                <el-dropdown-item divided>Separated</el-dropdown-item>
                <el-dropdown-item disabled>Disabled</el-dropdown-item>
              </el-dropdown-menu>
            </div>
          </template>
        </el-dropdown>
      </article>

      <article class="fixture-card fixture-card--wide">
        <h2>Dialog</h2>
        <el-dialog
          v-model="dialogVisible"
          title="Boundary Dialog"
          :append-to-body="false"
          :modal="false"
          :width="dialogWidth"
        >
          <p>Dialog boundary content with footer actions and close affordance.</p>
          <template #footer>
            <el-button>Cancel</el-button>
            <el-button type="primary">Confirm</el-button>
          </template>
        </el-dialog>
      </article>

      <article class="fixture-card fixture-card--wide">
        <h2>Drawer</h2>
        <el-drawer
          v-model="drawerVisible"
          :append-to-body="false"
          :modal="false"
          :size="drawerSize"
          title="Boundary Drawer"
        >
          <p>Drawer boundary content remains mounted in fixture scope.</p>
        </el-drawer>
      </article>
    </section>

    <section
      v-else-if="mode === 'data-boundaries'"
      v-bind="{ 'data-testid': 'fixture-data-boundaries' }"
      class="fixture-grid"
    >
      <article class="fixture-card fixture-card--wide">
        <h2>Empty Table / Overflow Table</h2>
        <div class="fixture-scroll-shell">
          <el-table :data="[]" empty-text="No boundary rows" style="width: 100%; min-width: 520px">
            <el-table-column prop="date" label="Date" width="140" />
            <el-table-column prop="name" label="Name" min-width="220" />
            <el-table-column prop="address" label="Status" min-width="220" />
          </el-table>
        </div>
      </article>

      <article class="fixture-card fixture-card--wide">
        <h2>Auto Resized Virtual Table</h2>
        <div class="fixture-scroll-shell" style="height: 260px">
          <el-auto-resizer>
            <template #default="{ width }">
              <el-table-v2
                :columns="tableV2Columns"
                :data="tableV2Data"
                :width="Math.max(width, 320)"
                :height="240"
              />
            </template>
          </el-auto-resizer>
        </div>
      </article>

      <article class="fixture-card">
        <h2>Empty States</h2>
        <el-empty description="No data boundary">
          <el-button>Reset</el-button>
        </el-empty>
      </article>

      <article class="fixture-card">
        <h2>Tree Boundaries</h2>
        <el-space fill>
          <el-tree :data="[]" empty-text="No tree nodes" />
          <el-tree-select
            model-value=""
            :data="[]"
            placeholder="No tree options"
            :teleported="false"
          />
        </el-space>
      </article>

      <article class="fixture-card">
        <h2>Progress / Pagination</h2>
        <el-space fill>
          <el-progress :percentage="0" />
          <el-progress :percentage="100" status="success" />
          <el-pagination
            v-model:current-page="currentPage"
            layout="prev, pager, next, total"
            :page-size="1"
            :total="1"
            :small="isCompact"
          />
        </el-space>
      </article>

      <article class="fixture-card">
        <h2>Grid Boundaries</h2>
        <el-row :gutter="12" justify="space-between" align="middle">
          <el-col :span="12">
            <div class="fixture-note">Col 12</div>
          </el-col>
          <el-col :span="12">
            <div class="fixture-note">Col 12</div>
          </el-col>
        </el-row>
      </article>
    </section>

    <section
      v-else-if="mode === 'icons'"
      v-bind="{ 'data-testid': 'fixture-icons' }"
      class="fixture-grid"
    >
      <article class="fixture-card fixture-card--wide">
        <h2>Icon Gallery</h2>
        <p class="fixture-note">{{ iconGallery.length }} icons</p>
        <el-scrollbar height="520px">
          <el-space wrap>
            <el-tooltip
              v-for="icon in iconGallery"
              :key="icon.name"
              :content="icon.name"
              :teleported="false"
            >
              <el-button size="small" plain>
                <el-icon>
                  <component :is="icon.component" />
                </el-icon>
                {{ icon.name }}
              </el-button>
            </el-tooltip>
          </el-space>
        </el-scrollbar>
      </article>
    </section>

    <section
      v-else
      v-bind="{ 'data-testid': 'fixture-surfaces' }"
      class="fixture-grid"
    >
      <article class="fixture-card">
        <h2>Tooltip / Popover</h2>
        <el-space>
          <el-tooltip
            :visible="true"
            :effect="currentTooltipEffect"
            content="Tooltip state"
            :teleported="false"
          >
            <el-button>Tooltip</el-button>
          </el-tooltip>

          <el-tooltip-v2
            always-on
            show-arrow
            placement="top"
            :teleported="false"
          >
            <template #trigger>
              <el-button>Tooltip V2</el-button>
            </template>
            Tooltip V2 state
          </el-tooltip-v2>

          <el-popover
            :visible="true"
            :effect="currentPopoverEffect"
            title="Popover title"
            content="Popover content"
            :teleported="false"
          >
            <template #reference>
              <el-button>Popover</el-button>
            </template>
          </el-popover>
        </el-space>
      </article>

      <article class="fixture-card">
        <h2>Dropdown</h2>
        <el-dropdown
          trigger="click"
          :hide-on-click="false"
          :teleported="false"
          @visible-change="dropdownVisible = $event"
        >
          <span class="dropdown-trigger-proxy">
            <el-button>
              Open Dropdown
            </el-button>
          </span>
          <template #dropdown>
            <div class="dropdown-menu-proxy">
              <el-dropdown-menu>
                <el-dropdown-item>Profile</el-dropdown-item>
                <el-dropdown-item>Billing</el-dropdown-item>
                <el-dropdown-item disabled>Archived</el-dropdown-item>
              </el-dropdown-menu>
            </div>
          </template>
        </el-dropdown>
        <p class="fixture-note">Dropdown visible: {{ dropdownVisible ? 'true' : 'false' }}</p>
      </article>

      <article class="fixture-card fixture-card--wide">
        <h2>Dialog</h2>
        <el-dialog
          v-model="dialogVisible"
          title="Visual Review Dialog"
          :append-to-body="false"
          :modal="false"
          :width="dialogWidth"
        >
          <p>Dialog close icon, spacing, typography and actions should remain stable.</p>
          <template #footer>
            <el-button>Cancel</el-button>
            <el-button type="primary">Confirm</el-button>
          </template>
        </el-dialog>
      </article>

      <article class="fixture-card fixture-card--wide">
        <h2>Drawer</h2>
        <el-drawer
          v-model="drawerVisible"
          :append-to-body="false"
          :modal="false"
          :size="drawerSize"
          title="Side Surface"
        >
          <p>Drawer spacing and header actions are validated here.</p>
        </el-drawer>
      </article>

      <article class="fixture-card fixture-card--wide">
        <h2>Icon Gallery</h2>
        <p class="fixture-note">{{ iconGallery.length }} icons</p>
        <el-scrollbar height="360px">
          <el-space wrap>
            <el-tooltip
              v-for="icon in iconGallery"
              :key="icon.name"
              :content="icon.name"
              :teleported="false"
            >
              <el-button size="small" plain>
                <el-icon>
                  <component :is="icon.component" />
                </el-icon>
                {{ icon.name }}
              </el-button>
            </el-tooltip>
          </el-space>
        </el-scrollbar>
      </article>
    </section>
  </main>
</template>

<style scoped>
.visual-fixtures {
  --fixture-bg-start: #f8fafc;
  --fixture-bg-end: #eef2f7;
  --fixture-text-strong: #111827;
  --fixture-text-muted: #4b5563;
  --fixture-border: rgba(15, 23, 42, 0.08);
  --fixture-surface: rgba(255, 255, 255, 0.92);
  --fixture-shadow: 0 12px 40px rgba(15, 23, 42, 0.08);
  --fixture-glow: rgba(24, 24, 27, 0.06);
  --el-bg-color: #ffffff;
  --el-bg-color-page: #f8fafc;
  --el-bg-color-overlay: #ffffff;
  --el-fill-color: #f3f4f6;
  --el-fill-color-light: #f8fafc;
  --el-fill-color-lighter: #edf2f7;
  --el-fill-color-blank: #ffffff;
  --el-text-color-primary: #111827;
  --el-text-color-regular: #374151;
  --el-text-color-secondary: #6b7280;
  --el-text-color-placeholder: #94a3b8;
  --el-border-color: rgba(148, 163, 184, 0.35);
  --el-border-color-light: rgba(148, 163, 184, 0.24);
  --el-border-color-lighter: rgba(148, 163, 184, 0.16);
  --el-box-shadow: 0 12px 32px rgba(15, 23, 42, 0.12);
  --el-box-shadow-light: 0 8px 20px rgba(15, 23, 42, 0.08);
  --el-box-shadow-dark: 0 16px 36px rgba(15, 23, 42, 0.24);
  min-height: 100vh;
  padding: 32px;
  background:
    radial-gradient(circle at top left, var(--fixture-glow), transparent 28%),
    linear-gradient(180deg, var(--fixture-bg-start) 0%, var(--fixture-bg-end) 100%);
  color: var(--fixture-text-strong);
  color-scheme: light;
}

.visual-header {
  margin: 0 auto 24px;
  max-width: 1280px;
}

.visual-header h1 {
  margin: 0 0 8px;
  font-size: 32px;
  line-height: 1.1;
}

.visual-header p {
  margin: 0;
  color: var(--fixture-text-muted);
}

.fixture-meta {
  margin-left: 8px;
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.fixture-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px;
  max-width: 1280px;
  margin: 0 auto;
}

.fixture-card {
  position: relative;
  min-height: 220px;
  padding: 20px;
  border: 1px solid var(--fixture-border);
  border-radius: 20px;
  background: var(--fixture-surface);
  box-shadow: var(--fixture-shadow);
  overflow: hidden;
}

.fixture-card--wide {
  grid-column: 1 / -1;
}

.fixture-card h2 {
  margin: 0 0 16px;
  font-size: 18px;
}

.fixture-note {
  margin-top: 12px;
  color: var(--fixture-text-muted);
  font-size: 13px;
}

.fixture-scroll-shell {
  width: 100%;
  overflow-x: auto;
}

.theme-dark {
  --fixture-bg-start: #050816;
  --fixture-bg-end: #0f172a;
  --fixture-text-strong: #f8fafc;
  --fixture-text-muted: #cbd5e1;
  --fixture-border: rgba(148, 163, 184, 0.18);
  --fixture-surface: rgba(15, 23, 42, 0.82);
  --fixture-shadow: 0 18px 48px rgba(2, 6, 23, 0.5);
  --fixture-glow: rgba(96, 165, 250, 0.12);
  --el-bg-color: #0f172a;
  --el-bg-color-page: #020617;
  --el-bg-color-overlay: #111c33;
  --el-fill-color: #16233f;
  --el-fill-color-light: #1d2b47;
  --el-fill-color-lighter: #233252;
  --el-fill-color-blank: #0f172a;
  --el-text-color-primary: #f8fafc;
  --el-text-color-regular: #e2e8f0;
  --el-text-color-secondary: #cbd5e1;
  --el-text-color-placeholder: #94a3b8;
  --el-border-color: rgba(148, 163, 184, 0.28);
  --el-border-color-light: rgba(148, 163, 184, 0.22);
  --el-border-color-lighter: rgba(148, 163, 184, 0.16);
  --el-box-shadow: 0 18px 40px rgba(2, 6, 23, 0.45);
  --el-box-shadow-light: 0 12px 24px rgba(2, 6, 23, 0.3);
  --el-box-shadow-dark: 0 22px 56px rgba(2, 6, 23, 0.6);
  color-scheme: dark;
}

.theme-dark :deep(.el-dialog),
.theme-dark :deep(.el-drawer),
.theme-dark :deep(.el-tooltip__popper),
.theme-dark :deep(.el-popover.el-popper),
.theme-dark :deep(.el-dropdown-menu),
.theme-dark :deep(.el-table),
.theme-dark :deep(.el-table__inner-wrapper),
.theme-dark :deep(.el-table-v2__main),
.theme-dark :deep(.el-select-dropdown),
.theme-dark :deep(.el-picker__popper),
.theme-dark :deep(.el-cascader__dropdown) {
  color: var(--el-text-color-primary);
}

.is-compact {
  padding: 20px 14px 28px;
}

.is-compact .visual-header h1 {
  font-size: 24px;
}

.is-compact .fixture-card {
  min-height: 0;
  padding: 16px;
  border-radius: 18px;
}

.is-compact :deep(.el-space) {
  width: 100%;
}

.is-compact :deep(.el-date-editor),
.is-compact :deep(.el-select),
.is-compact :deep(.el-select-v2),
.is-compact :deep(.el-input-number),
.is-compact :deep(.el-cascader),
.is-compact :deep(.el-tree-select),
.is-compact :deep(.el-upload) {
  width: 100%;
}

.is-compact :deep(.el-pagination) {
  width: 100%;
  row-gap: 8px;
  justify-content: flex-start;
}

:deep(.el-dialog),
:deep(.el-drawer) {
  position: relative;
  margin: 0;
}

@media (max-width: 900px) {
  .fixture-grid {
    grid-template-columns: 1fr;
  }

  .fixture-card--wide {
    grid-column: auto;
  }
}
</style>
