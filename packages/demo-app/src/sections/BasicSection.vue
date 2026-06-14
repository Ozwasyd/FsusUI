<template>
  <div id="basic" class="demo-section" data-testid="section-basic">
    <h2>Basic</h2>
    <div class="demo-block">
      <h3>Button & ButtonGroup</h3>
      <el-space wrap>
        <el-button>Default</el-button>
        <el-button type="primary">Primary</el-button>
        <el-button type="success">Success</el-button>
        <el-button type="info">Info</el-button>
        <el-button type="warning">Warning</el-button>
        <el-button type="danger">Danger</el-button>
        <el-button disabled>Disabled</el-button>
        <el-button-group>
          <el-button type="primary" :icon="ArrowLeft">Prev</el-button>
          <el-button type="primary">
            Next<el-icon class="el-icon--right"><ArrowRight /></el-icon>
          </el-button>
        </el-button-group>
      </el-space>
    </div>
    <div class="demo-block">
      <h3>Link</h3>
      <el-space wrap>
        <el-link>Default</el-link>
        <el-link type="primary">Primary</el-link>
        <el-link type="success">Success</el-link>
        <el-link type="warning">Warning</el-link>
        <el-link type="danger">Danger</el-link>
        <el-link type="info">Info</el-link>
      </el-space>
    </div>
    <div class="demo-block">
      <h3>Text</h3>
      <el-space wrap>
        <el-text>Default</el-text>
        <el-text type="primary">Primary</el-text>
        <el-text type="success">Success</el-text>
        <el-text type="warning">Warning</el-text>
        <el-text type="danger">Danger</el-text>
        <el-text type="info">Info</el-text>
        <el-text truncated style="width: 100px">Truncated text content</el-text>
      </el-space>
    </div>
    <div class="demo-block">
      <h3>Icon</h3>
      <el-space>
        <el-icon :size="20"><Search /></el-icon>
        <el-icon :size="20" color="var(--fsus-scholarly-blue)">
          <Edit />
        </el-icon>
      </el-space>
    </div>
    <div class="demo-block">
      <h3>Layout (Row/Col)</h3>
      <el-row :gutter="20">
        <el-col :span="6"><div class="demo-layout-box">6</div></el-col>
        <el-col :span="6"><div class="demo-layout-box">6</div></el-col>
        <el-col :span="6"><div class="demo-layout-box">6</div></el-col>
        <el-col :span="6"><div class="demo-layout-box">6</div></el-col>
      </el-row>
    </div>
    <div class="demo-block">
      <h3>Container (Header/Aside/Main/Footer)</h3>
      <el-container class="demo-container-box">
        <el-header height="40px">Header</el-header>
        <el-container>
          <el-aside width="100px">Aside</el-aside>
          <el-main>Main</el-main>
        </el-container>
        <el-footer height="40px">Footer</el-footer>
      </el-container>
    </div>
    <div class="demo-block">
      <h3>Space</h3>
      <el-space :size="20">
        <el-button>保存草稿</el-button>
        <el-button>发布文章</el-button>
        <el-button>移入归档</el-button>
      </el-space>
    </div>
    <div class="demo-block">
      <h3>Scrollbar</h3>
      <el-scrollbar height="100px">
        <div v-for="item in 10" :key="item" class="demo-layout-box">
          {{ item }}
        </div>
      </el-scrollbar>
    </div>
    <div class="demo-block">
      <h3>ConfigProvider</h3>
      <el-config-provider>
        <el-button type="primary">Provider Child</el-button>
      </el-config-provider>
    </div>
    <div class="demo-block">
      <h3>Affix</h3>
      <el-affix :offset="20">
        <el-button type="primary">Affix top 20px</el-button>
      </el-affix>
    </div>
    <div class="demo-block">
      <h3>Watermark</h3>
      <el-watermark content="FsusUI">
        <div class="demo-watermark-box" />
      </el-watermark>
    </div>
    <div class="demo-block">
      <h3>Divider</h3>
      <span>Top</span>
      <el-divider content-position="left">Text</el-divider>
      <span>Bottom</span>
    </div>
    <div class="demo-block">
      <h3>VisuallyHidden</h3>
      <el-visually-hidden>Hidden Text</el-visually-hidden>
      <span>Text visible next to hidden one</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ArrowLeft, ArrowRight, Edit, Search } from '../demo-state'
</script>
