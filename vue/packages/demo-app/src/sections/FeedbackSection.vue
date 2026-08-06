<template>
  <div id="feedback" class="demo-section" data-testid="section-feedback">
    <h2>Feedback</h2>
    <div class="demo-block">
      <h3>Alert</h3>
      <el-space direction="vertical" style="width: 100%">
        <el-alert title="草稿已保存" type="success" show-icon />
        <el-alert title="权限更新已生效" type="info" show-icon />
        <el-alert title="标题不能为空" type="warning" show-icon />
        <el-alert title="删除后不可恢复" type="error" show-icon />
      </el-space>
    </div>
    <div class="demo-block">
      <h3>Dialog / Drawer</h3>
      <el-space wrap>
        <el-button
          v-bind="{ 'data-testid': 'open-publish-dialog' }"
          @click="dialogVisible = true"
        >
          打开发布确认
        </el-button>
        <el-button
          v-bind="{ 'data-testid': 'open-review-drawer' }"
          @click="drawerVisible = true"
        >
          查看审阅记录
        </el-button>
<<<<<<< Updated upstream
=======
        <el-button
          v-bind="{ 'data-testid': 'open-long-title-dialog' }"
          @click="longTitleDialogVisible = true"
        >
          长标题 Dialog
        </el-button>
>>>>>>> Stashed changes
        <el-dialog v-model="dialogVisible" title="确认发布" width="30%">
          <span>发布后读者将看到最新版本。</span>
          <template #footer>
            <span class="dialog-footer">
              <el-button @click="dialogVisible = false">继续编辑</el-button>
              <el-button type="primary" @click="dialogVisible = false">
                确认发布
              </el-button>
            </span>
          </template>
        </el-dialog>
        <el-dialog
          v-model="longTitleDialogVisible"
          title="确认发布超长中英文标题 Confirmation with very long Latin and 中文混合标题避免与关闭按钮重叠"
          width="30%"
        >
          <span>长标题不得侵入 54px 关闭命中盒。</span>
        </el-dialog>
        <el-drawer
          v-model="drawerVisible"
          title="审阅记录超长标题 Review history with extended Latin and 中文"
          direction="rtl"
        >
          <span>查看最近一次修改摘要。</span>
        </el-drawer>
      </el-space>
    </div>
    <div class="demo-block">
      <h3>Tooltip / TooltipV2 / Popover / Popconfirm</h3>
      <el-space wrap>
        <el-tooltip content="权限同步已开始" placement="top">
          <el-button>Tooltip</el-button>
        </el-tooltip>
        <el-tooltip-v2 placement="bottom">
          <template #trigger><el-button>TooltipV2</el-button></template>
          Tooltip V2
        </el-tooltip-v2>
        <el-popover
          placement="top"
          title="同步成员权限"
          :width="200"
          content="将向所选成员推送更新"
        >
          <template #reference><el-button>Popover</el-button></template>
        </el-popover>
        <el-popconfirm title="确定移入归档？">
          <template #reference><el-button>Popconfirm</el-button></template>
        </el-popconfirm>
      </el-space>
    </div>
    <div class="demo-block">
      <h3>Message / MessageBox / Notification</h3>
      <el-space wrap>
        <el-button @click="showMessage">Message</el-button>
<<<<<<< Updated upstream
        <el-button @click="showMessageBox">MessageBox</el-button>
        <el-button
          v-bind="{ 'data-testid': 'open-notification' }"
          @click="showNotification"
        >
          Notification
        </el-button>
=======
        <el-button
          v-bind="{ 'data-testid': 'open-message-box' }"
          @click="showMessageBox"
        >
          MessageBox
        </el-button>
        <el-button @click="showNotification">Notification</el-button>
>>>>>>> Stashed changes
      </el-space>
    </div>
    <div class="demo-block">
      <h3>Loading (Directive)</h3>
      <div v-loading="true" class="demo-layout-box">Loading Container</div>
    </div>
    <div class="demo-block">
      <h3>Overlay</h3>
      <el-space wrap>
        <el-button @click="overlayVisible = true">Open Overlay</el-button>
        <el-overlay v-if="overlayVisible" @click="overlayVisible = false">
          <div class="demo-overlay-panel">Click to close</div>
        </el-overlay>
      </el-space>
    </div>
    <div class="demo-block">
      <h3>Popper (Raw) & PopperArrow & PopperContent & PopperTrigger</h3>
      <el-popper>
        <el-popper-trigger>
          <el-button>Popper Trigger</el-button>
        </el-popper-trigger>
        <el-popper-content :visible="true">
          <el-popper-arrow />Raw Popper Content
        </el-popper-content>
      </el-popper>
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
