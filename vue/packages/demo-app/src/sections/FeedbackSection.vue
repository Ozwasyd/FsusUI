<template>
  <div id="feedback" class="demo-section" data-testid="section-feedback">
    <h2>Feedback</h2>
    <div class="demo-block">
      <h3>Alert</h3>
      <fsus-space direction="vertical" style="width: 100%">
        <fsus-alert title="草稿已保存" type="success" show-icon />
        <fsus-alert title="权限更新已生效" type="info" show-icon />
        <fsus-alert title="标题不能为空" type="warning" show-icon />
        <fsus-alert title="删除后不可恢复" type="error" show-icon />
      </fsus-space>
    </div>
    <div class="demo-block">
      <h3>Dialog / Drawer</h3>
      <fsus-space wrap>
        <fsus-button
          v-bind="{ 'data-testid': 'open-publish-dialog' }"
          @click="dialogVisible = true"
        >
          打开发布确认
        </fsus-button>
        <fsus-button
          v-bind="{ 'data-testid': 'open-review-drawer' }"
          @click="drawerVisible = true"
        >
          查看审阅记录
        </fsus-button>
        <fsus-button
          v-bind="{ 'data-testid': 'open-long-title-dialog' }"
          @click="longTitleDialogVisible = true"
        >
          长标题 Dialog
        </fsus-button>
        <fsus-dialog v-model="dialogVisible" title="确认发布" width="30%">
          <span>发布后读者将看到最新版本。</span>
          <template #footer>
            <span class="dialog-footer">
              <fsus-button @click="dialogVisible = false">继续编辑</fsus-button>
              <fsus-button type="primary" @click="dialogVisible = false">
                确认发布
              </fsus-button>
            </span>
          </template>
        </fsus-dialog>
        <fsus-dialog
          v-model="longTitleDialogVisible"
          title="确认发布超长中英文标题 Confirmation with very long Latin and 中文混合标题避免与关闭按钮重叠"
          width="30%"
        >
          <span>长标题不得侵入 54px 关闭命中盒。</span>
        </fsus-dialog>
        <fsus-drawer
          v-model="drawerVisible"
          title="审阅记录超长标题 Review history with extended Latin and 中文"
          direction="rtl"
        >
          <span>查看最近一次修改摘要。</span>
        </fsus-drawer>
      </fsus-space>
    </div>
    <div class="demo-block">
      <h3>Tooltip / TooltipV2 / Popover / Popconfirm</h3>
      <fsus-space wrap>
        <fsus-tooltip content="权限同步已开始" placement="top">
          <fsus-button>Tooltip</fsus-button>
        </fsus-tooltip>
        <fsus-tooltip placement="bottom">
          <template #trigger><fsus-button>TooltipV2</fsus-button></template>
          Tooltip V2
        </fsus-tooltip>
        <fsus-popover
          placement="top"
          title="同步成员权限"
          :width="200"
          content="将向所选成员推送更新"
        >
          <template #reference><fsus-button>Popover</fsus-button></template>
        </fsus-popover>
        <fsus-popconfirm title="确定移入归档？">
          <template #reference><fsus-button>Popconfirm</fsus-button></template>
        </fsus-popconfirm>
      </fsus-space>
    </div>
    <div class="demo-block">
      <h3>Message / MessageBox / Notification</h3>
      <fsus-space wrap>
        <fsus-button @click="showMessage">Message</fsus-button>
        <fsus-button
          v-bind="{ 'data-testid': 'open-message-box' }"
          @click="showMessageBox"
        >
          MessageBox
        </fsus-button>
        <fsus-button
          v-bind="{ 'data-testid': 'open-notification' }"
          @click="showNotification"
        >
          Notification
        </fsus-button>
      </fsus-space>
    </div>
    <div class="demo-block">
      <h3>Loading (Directive)</h3>
      <div v-fsus-loading="true" class="demo-layout-box">Loading Container</div>
    </div>
    <div class="demo-block">
      <h3>Overlay</h3>
      <fsus-space wrap>
        <fsus-button @click="overlayVisible = true">Open Overlay</fsus-button>
        <div v-if="overlayVisible" class="fsus-overlay" @click="overlayVisible = false">
          <div class="demo-overlay-panel">Click to close</div>
        </div>
      </fsus-space>
    </div>
    <div class="demo-block">
      <h3>Popper (Raw) & PopperArrow & PopperContent & PopperTrigger</h3>
      <div>
        <div>
          <fsus-button>Popper Trigger</fsus-button>
        </div>
        <div :visible="true">
          <span />Raw Popper Content
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useDemoState } from '../demo-state'

const {
  dialogVisible,
  longTitleDialogVisible,
  drawerVisible,
  overlayVisible,
  showMessage,
  showMessageBox,
  showNotification,
} = useDemoState()
</script>
