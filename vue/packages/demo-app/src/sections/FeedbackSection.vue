<template>
  <div id="feedback" class="demo-section" data-testid="section-feedback">
    <h2>Feedback</h2>
    <div class="demo-block">
      <h3>Alert</h3>
      <el-space direction="vertical" style="width: 100%">
        <el-alert title="success alert" type="success" show-icon />
        <el-alert title="info alert" type="info" show-icon />
        <el-alert title="warning alert" type="warning" show-icon />
        <el-alert title="error alert" type="error" show-icon />
      </el-space>
    </div>
    <div class="demo-block">
      <h3>Dialog / Drawer</h3>
      <el-space wrap>
        <el-button data-testid="open-publish-dialog" @click="dialogVisible = true">
          打开发布确认
        </el-button>
        <el-button @click="drawerVisible = true">查看审阅记录</el-button>
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
        <el-drawer v-model="drawerVisible" title="审阅记录" direction="rtl">
          <span>查看最近一次修改摘要。</span>
        </el-drawer>
      </el-space>
    </div>
    <div class="demo-block">
      <h3>Tooltip / TooltipV2 / Popover / Popconfirm</h3>
      <el-space wrap>
        <el-tooltip content="Top Center prompts info" placement="top">
          <el-button>Tooltip</el-button>
        </el-tooltip>
        <el-tooltip-v2 placement="bottom">
          <template #trigger><el-button>TooltipV2</el-button></template>
          Tooltip V2
        </el-tooltip-v2>
        <el-popover
          placement="top"
          title="Title"
          :width="200"
          content="this is content, this is content, this is content"
        >
          <template #reference><el-button>Popover</el-button></template>
        </el-popover>
        <el-popconfirm title="Are you sure to delete this?">
          <template #reference><el-button>Popconfirm</el-button></template>
        </el-popconfirm>
      </el-space>
    </div>
    <div class="demo-block">
      <h3>Message / MessageBox / Notification</h3>
      <el-space wrap>
        <el-button @click="showMessage">Message</el-button>
        <el-button @click="showMessageBox">MessageBox</el-button>
        <el-button @click="showNotification">Notification</el-button>
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
  drawerVisible,
  overlayVisible,
  showMessage,
  showMessageBox,
  showNotification,
} = useDemoState()
</script>
