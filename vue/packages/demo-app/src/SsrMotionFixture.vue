<script setup lang="ts">
import { nextTick, ref } from 'vue'
import {
  ElBadge,
  ElButton,
  ElCollapse,
  ElCollapseItem,
  ElDialog,
  ElDrawer,
  ElDropdown,
  ElDropdownItem,
  ElDropdownMenu,
  ElMenu,
  ElMenuItem,
  ElNotification,
  ElPopover,
  ElSubMenu,
  ElTabPane,
  ElTabs,
  ElTag,
  ElUpload,
  vLoading,
} from '../../element-plus'

import type { CollapseModelValue } from '../../components/collapse'
import type { TabPaneName } from '../../components/tabs'
import type { UploadUserFile } from '../../components/upload'

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
  const instance = ElNotification({
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
      <el-button @click="dialogVisible = true">
        <span data-testid="dialog-trigger">打开 Dialog</span>
      </el-button>
      <el-button @click="drawerVisible = true">
        <span data-testid="drawer-trigger">打开 Drawer</span>
      </el-button>

      <el-popover
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
          <el-dropdown
            trigger="click"
            :teleported="false"
            :show-timeout="0"
            :hide-timeout="0"
          >
            <el-button>
              <span data-testid="nested-dropdown-trigger">嵌套 Dropdown</span>
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item>嵌套项</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
        <template #reference>
          <el-button class="ssr-motion-fixture__flip-anchor">
            <span data-testid="popover-trigger">打开 Popover</span>
          </el-button>
        </template>
      </el-popover>

      <el-dropdown
        trigger="click"
        :teleported="false"
        :show-timeout="0"
        :hide-timeout="0"
        @visible-change="
          (visible: boolean) =>
            record(visible ? 'dropdown:visible' : 'dropdown:hidden')
        "
      >
        <el-button>
          <span data-testid="dropdown-trigger">打开 Dropdown</span>
        </el-button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item>第一项</el-dropdown-item>
            <el-dropdown-item>第二项</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>

      <el-button @click="openNotification">
        <span data-testid="notification-trigger">打开 Notification</span>
      </el-button>

      <el-button @click="badgeHidden = !badgeHidden">
        <span data-testid="badge-toggle">切换 Badge</span>
      </el-button>
      <el-badge :hidden="badgeHidden" :value="8">
        <span data-testid="badge-anchor">Badge anchor</span>
      </el-badge>

      <el-button @click="rapidToggleTag">
        <span data-testid="tag-rapid-toggle">快速切换 Tag</span>
      </el-button>
      <span v-if="tagVisible" data-testid="motion-tag">
        <el-tag closable>状态 Tag</el-tag>
      </span>
    </section>

    <section class="ssr-motion-fixture__legacy-consumers">
      <div>
        <el-button @click="addUploadFile">
          <span data-testid="list-add">添加列表项</span>
        </el-button>
        <el-button @click="removeUploadFile">
          <span data-testid="list-remove">删除列表项</span>
        </el-button>
        <el-button @click="reorderUploadFiles">
          <span data-testid="list-reorder">重排列表</span>
        </el-button>
        <div data-testid="motion-upload">
          <el-upload
            :file-list="uploadFiles"
            :auto-upload="false"
            action="#"
            list-type="picture-card"
          >
            <template #trigger>
              <span class="ssr-motion-fixture__hidden-trigger">上传</span>
            </template>
          </el-upload>
        </div>
      </div>

      <el-menu
        class="ssr-motion-fixture__collapsed-menu"
        :collapse="true"
        :collapse-transition="false"
      >
        <el-sub-menu index="motion-menu" :teleported="false">
          <template #title>
            <span data-testid="collapsed-menu-trigger">Menu</span>
          </template>
          <el-menu-item index="motion-menu-1">第一项</el-menu-item>
          <el-sub-menu index="motion-menu-nested" :teleported="false">
            <template #title>
              <span data-testid="nested-menu-trigger">嵌套菜单</span>
            </template>
            <el-menu-item index="motion-menu-nested-1">嵌套项</el-menu-item>
          </el-sub-menu>
        </el-sub-menu>
      </el-menu>
    </section>

    <el-dialog
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
    </el-dialog>

    <el-drawer
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
    </el-drawer>

    <el-collapse v-model="collapseActive">
      <el-collapse-item name="motion">
        <template #title>
          <span data-testid="collapse-trigger">切换 Collapse</span>
        </template>
        <div data-testid="collapse-content" class="ssr-motion-fixture__panel">
          Collapse 最终内容
        </div>
      </el-collapse-item>
    </el-collapse>

    <el-tabs v-model="activeTab">
      <el-tab-pane label="第一页" name="one">
        <div class="ssr-motion-fixture__panel">第一页内容</div>
      </el-tab-pane>
      <el-tab-pane label="第二页" name="two">
        <div data-testid="tab-panel-two" class="ssr-motion-fixture__panel">
          第二页最终内容
        </div>
      </el-tab-pane>
    </el-tabs>

    <div
      v-loading="loading"
      class="ssr-motion-fixture__loading"
      data-testid="loading-target"
    >
      Loading 最终几何目标
    </div>
    <el-button @click="loading = false">
      <span data-testid="loading-toggle">完成 Loading</span>
    </el-button>
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
