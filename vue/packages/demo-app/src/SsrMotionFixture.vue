<script setup lang="ts">
import { nextTick, ref } from 'vue'
import {
  FsusBadge,
  FsusButton,
  FsusCollapse,
  FsusCollapseItem,
  FsusDialog,
  FsusDrawer,
  FsusDropdown,
  FsusDropdownItem,
  FsusDropdownMenu,
  FsusMenu,
  FsusMenuItem,
  FsusNotification,
  FsusPopover,
  FsusSubMenu,
  FsusTabPane,
  FsusTabs,
  FsusTag,
  FsusUpload,
  vFsusLoading,
} from '@ozwasyd/fsusui'

import type { CollapseModelValue } from '@ozwasyd/fsusui'
import type { TabPaneName } from '@ozwasyd/fsusui'
import type { UploadUserFile } from '@ozwasyd/fsusui'

const dialogVisible = ref(false)
const drawerVisible = ref(false)
const popoverVisible = ref(false)
const collapseActive = ref<CollapseModelValue>([])
const loading = ref(true)
const activeTab = ref<TabPaneName>('one')
const events = ref<string[]>([])
const badgeHidden = ref(false)
const tagVisible = ref(true)
const uploadFiles = ref<UploadUserFile[]>([])
let uploadUid = 0

const record = (event: string) => {
  events.value.push(event)
}

const openNotification = () => {
  const instance = FsusNotification({
    title: '同步完成',
    message: '状态机已进入最终位置',
    duration: 0,
    onClose: () => record('notification:closed'),
  })
  record('notification:opened')
  return instance
}

const rapidToggleTag = async () => {
  tagVisible.value = false
  await nextTick()
  tagVisible.value = true
  await nextTick()
  tagVisible.value = false
  await nextTick()
  tagVisible.value = true
  record('tag:rapid-terminal-visible')
}

const addUploadFile = () => {
  uploadUid += 1
  uploadFiles.value = [
    ...uploadFiles.value,
    { name: `item-${uploadUid}.txt`, status: 'success', uid: uploadUid },
  ]
  record('list:added')
}

const removeUploadFile = () => {
  uploadFiles.value = uploadFiles.value.slice(1)
  record('list:removed')
}

const reorderUploadFiles = () => {
  uploadFiles.value = [...uploadFiles.value].reverse()
  record('list:reordered')
}
</script>

<template>
  <main class="ssr-motion-fixture">
    <p data-testid="ssr-marker">server-rendered-before-hydration</p>
    <output data-testid="motion-events">{{ events.join('|') }}</output>

    <section class="ssr-motion-fixture__actions">
      <fsus-button @click="dialogVisible = true">
        <span data-testid="dialog-trigger">打开 Dialog</span>
      </fsus-button>
      <fsus-button @click="drawerVisible = true">
        <span data-testid="drawer-trigger">打开 Drawer</span>
      </fsus-button>

      <fsus-popover
        v-model:visible="popoverVisible"
        trigger="click"
        :persistent="false"
        :hide-after="0"
        placement="top"
        @after-enter="record('popover:after-enter')"
        @after-leave="record('popover:after-leave')"
      >
        <div data-testid="popover-content">
          Popover 最终内容
          <fsus-dropdown
            trigger="click"
            :teleported="false"
            :show-timeout="0"
            :hide-timeout="0"
          >
            <fsus-button>
              <span data-testid="nested-dropdown-trigger">嵌套 Dropdown</span>
            </fsus-button>
            <template #dropdown>
              <fsus-dropdown-menu>
                <fsus-dropdown-item>嵌套项</fsus-dropdown-item>
              </fsus-dropdown-menu>
            </template>
          </fsus-dropdown>
        </div>
        <template #reference>
          <fsus-button class="ssr-motion-fixture__flip-anchor">
            <span data-testid="popover-trigger">打开 Popover</span>
          </fsus-button>
        </template>
      </fsus-popover>

      <fsus-dropdown
        trigger="click"
        :teleported="false"
        :show-timeout="0"
        :hide-timeout="0"
        @visible-change="
          (visible: boolean) =>
            record(visible ? 'dropdown:visible' : 'dropdown:hidden')
        "
      >
        <fsus-button>
          <span data-testid="dropdown-trigger">打开 Dropdown</span>
        </fsus-button>
        <template #dropdown>
          <fsus-dropdown-menu>
            <fsus-dropdown-item>第一项</fsus-dropdown-item>
            <fsus-dropdown-item>第二项</fsus-dropdown-item>
          </fsus-dropdown-menu>
        </template>
      </fsus-dropdown>

      <fsus-button @click="openNotification">
        <span data-testid="notification-trigger">打开 Notification</span>
      </fsus-button>

      <fsus-button @click="badgeHidden = !badgeHidden">
        <span data-testid="badge-toggle">切换 Badge</span>
      </fsus-button>
      <fsus-badge :hidden="badgeHidden" :value="8">
        <span data-testid="badge-anchor">Badge anchor</span>
      </fsus-badge>

      <fsus-button @click="rapidToggleTag">
        <span data-testid="tag-rapid-toggle">快速切换 Tag</span>
      </fsus-button>
      <span v-if="tagVisible" data-testid="motion-tag">
        <fsus-tag closable>状态 Tag</fsus-tag>
      </span>
    </section>

    <section class="ssr-motion-fixture__legacy-consumers">
      <div>
        <fsus-button @click="addUploadFile">
          <span data-testid="list-add">添加列表项</span>
        </fsus-button>
        <fsus-button @click="removeUploadFile">
          <span data-testid="list-remove">删除列表项</span>
        </fsus-button>
        <fsus-button @click="reorderUploadFiles">
          <span data-testid="list-reorder">重排列表</span>
        </fsus-button>
        <div data-testid="motion-upload">
          <fsus-upload
            :file-list="uploadFiles"
            :auto-upload="false"
            action="#"
            list-type="picture-card"
          >
            <template #trigger>
              <span class="ssr-motion-fixture__hidden-trigger">上传</span>
            </template>
          </fsus-upload>
        </div>
      </div>

      <fsus-menu
        class="ssr-motion-fixture__collapsed-menu"
        :collapse="true"
        :collapse-transition="false"
      >
        <fsus-sub-menu index="motion-menu" :teleported="false">
          <template #title>
            <span data-testid="collapsed-menu-trigger">Menu</span>
          </template>
          <fsus-menu-item index="motion-menu-1">第一项</fsus-menu-item>
          <fsus-sub-menu index="motion-menu-nested" :teleported="false">
            <template #title>
              <span data-testid="nested-menu-trigger">嵌套菜单</span>
            </template>
            <fsus-menu-item index="motion-menu-nested-1">嵌套项</fsus-menu-item>
          </fsus-sub-menu>
        </fsus-sub-menu>
      </fsus-menu>
    </section>

    <fsus-dialog
      v-model="dialogVisible"
      title="Dialog 状态机"
      width="420px"
      :z-index="2101"
      destroy-on-close
      @open="record('dialog:open')"
      @opened="record('dialog:opened')"
      @close="record('dialog:close')"
      @closed="record('dialog:closed')"
    >
      <p>Dialog 最终内容</p>
    </fsus-dialog>

    <fsus-drawer
      v-model="drawerVisible"
      title="Drawer 状态机"
      size="360px"
      :z-index="2102"
      destroy-on-close
      @open="record('drawer:open')"
      @opened="record('drawer:opened')"
      @close="record('drawer:close')"
      @closed="record('drawer:closed')"
    >
      <p>Drawer 最终内容</p>
    </fsus-drawer>

    <fsus-collapse v-model="collapseActive">
      <fsus-collapse-item name="motion">
        <template #title>
          <span data-testid="collapse-trigger">切换 Collapse</span>
        </template>
        <div data-testid="collapse-content" class="ssr-motion-fixture__panel">
          Collapse 最终内容
        </div>
      </fsus-collapse-item>
    </fsus-collapse>

    <fsus-tabs v-model="activeTab">
      <fsus-tab-pane label="第一页" name="one">
        <div class="ssr-motion-fixture__panel">第一页内容</div>
      </fsus-tab-pane>
      <fsus-tab-pane label="第二页" name="two">
        <div data-testid="tab-panel-two" class="ssr-motion-fixture__panel">
          第二页最终内容
        </div>
      </fsus-tab-pane>
    </fsus-tabs>

    <div
      v-fsus-loading="loading"
      class="ssr-motion-fixture__loading"
      data-testid="loading-target"
    >
      Loading 最终几何目标
    </div>
    <fsus-button @click="loading = false">
      <span data-testid="loading-toggle">完成 Loading</span>
    </fsus-button>
  </main>
</template>

<style scoped>
.ssr-motion-fixture {
  display: grid;
  gap: 24px;
  width: min(880px, calc(100vw - 48px));
  margin: 32px auto;
}

.ssr-motion-fixture__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.ssr-motion-fixture__legacy-consumers {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 80px;
  gap: 24px;
  align-items: start;
}

.ssr-motion-fixture__collapsed-menu {
  width: 64px;
}

.ssr-motion-fixture__hidden-trigger {
  display: none;
}

:deep(.ssr-motion-fixture__legacy-consumers .fsus-upload--picture-card) {
  display: none;
}

.ssr-motion-fixture__flip-anchor {
  position: fixed;
  top: 0;
  left: 50%;
  z-index: 1;
}

.ssr-motion-fixture__panel {
  box-sizing: border-box;
  min-height: 72px;
  padding: 16px;
}

.ssr-motion-fixture__loading {
  position: relative;
  box-sizing: border-box;
  width: 100%;
  height: 128px;
  padding: 24px;
  border: 1px solid var(--fsus-border-subtle);
}
</style>
