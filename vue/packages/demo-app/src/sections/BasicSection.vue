<template>
  <div id="basic" class="demo-section" data-testid="section-basic">
    <h2>Basic</h2>
    <div class="demo-block">
      <h3>Button & ButtonGroup</h3>
      <fsus-space wrap>
        <fsus-button>Default</fsus-button>
        <fsus-button variant="primary">Primary</fsus-button>
        <fsus-button variant="secondary">Secondary</fsus-button>
        <fsus-button variant="ghost">Ghost</fsus-button>
        <fsus-button variant="link">Link</fsus-button>
        <fsus-button variant="danger">Danger</fsus-button>
        <fsus-button disabled>Disabled</fsus-button>
        <fsus-button-group>
          <fsus-button variant="primary" :icon="ArrowLeft">Prev</fsus-button>
          <fsus-button variant="primary">
            Next<fsus-icon class="fsus-icon--right"><ArrowRight /></fsus-icon>
          </fsus-button>
        </fsus-button-group>
      </fsus-space>
    </div>
    <div class="demo-block">
      <h3>Link</h3>
      <fsus-space wrap>
        <fsus-link tone="neutral">Default</fsus-link>
        <fsus-link tone="info">Primary</fsus-link>
        <fsus-link tone="success">Success</fsus-link>
        <fsus-link tone="warning">Warning</fsus-link>
        <fsus-link tone="danger">Danger</fsus-link>
        <fsus-link tone="info">Info</fsus-link>
      </fsus-space>
    </div>
    <div class="demo-block">
      <h3>Text</h3>
      <fsus-space wrap>
        <fsus-text>Default</fsus-text>
        <fsus-text tone="info">Primary</fsus-text>
        <fsus-text tone="success">Success</fsus-text>
        <fsus-text tone="warning">Warning</fsus-text>
        <fsus-text tone="danger">Danger</fsus-text>
        <fsus-text tone="quiet">Info</fsus-text>
        <fsus-text truncated style="width: 100px">Truncated text content</fsus-text>
      </fsus-space>
    </div>
    <div class="demo-block" data-testid="typography-real-weight-fixture">
      <h3>Real font weights · 真实字重</h3>
      <div class="demo-typography-fixture">
        <span class="demo-font-weight-400">Latin 400 · 中文正文</span>
        <span class="demo-font-weight-500">Latin 500 · 中文强调</span>
        <span class="demo-font-weight-700">Latin 700 · 中文标题</span>
      </div>
    </div>
    <div class="demo-block">
      <h3>Icon</h3>
      <fsus-space>
        <fsus-icon :size="20"><Search /></fsus-icon>
        <fsus-icon :size="20" color="var(--fsus-scholarly-blue)">
          <Edit />
        </fsus-icon>
      </fsus-space>
    </div>
    <div class="demo-block">
      <h3>Layout (Row/Col)</h3>
      <fsus-row :gutter="20">
        <fsus-col :span="6"><div class="demo-layout-box">6</div></fsus-col>
        <fsus-col :span="6"><div class="demo-layout-box">6</div></fsus-col>
        <fsus-col :span="6"><div class="demo-layout-box">6</div></fsus-col>
        <fsus-col :span="6"><div class="demo-layout-box">6</div></fsus-col>
      </fsus-row>
    </div>
    <div class="demo-block">
      <h3>Container (Header/Aside/Main/Footer)</h3>
      <fsus-container class="demo-container-box">
        <fsus-header height="40px">Header</fsus-header>
        <fsus-container>
          <fsus-aside width="100px">Aside</fsus-aside>
          <fsus-main>Main</fsus-main>
        </fsus-container>
        <fsus-footer height="40px">Footer</fsus-footer>
      </fsus-container>
    </div>
    <div class="demo-block">
      <h3>Space</h3>
      <fsus-space :size="20">
        <fsus-button>保存草稿</fsus-button>
        <fsus-button>发布文章</fsus-button>
        <fsus-button>移入归档</fsus-button>
      </fsus-space>
    </div>
    <div class="demo-block">
      <h3>Scrollbar</h3>
      <fsus-scrollbar height="100px">
        <div v-for="item in 10" :key="item" class="demo-layout-box">
          {{ item }}
        </div>
      </fsus-scrollbar>
    </div>
    <div class="demo-block">
      <h3>ConfigProvider</h3>
      <fsus-config-provider>
        <fsus-button variant="primary">Provider Child</fsus-button>
      </fsus-config-provider>
    </div>
    <div class="demo-block">
      <h3>Affix</h3>
      <fsus-affix :offset="20">
        <fsus-button variant="primary">Affix top 20px</fsus-button>
      </fsus-affix>
    </div>
    <div class="demo-block">
      <h3>Watermark</h3>
      <fsus-watermark content="FsusUI">
        <div class="demo-watermark-box" />
      </fsus-watermark>
    </div>
    <div class="demo-block">
      <h3>Divider</h3>
      <span>Top</span>
      <fsus-divider content-position="left">Text</fsus-divider>
      <span>Bottom</span>
    </div>
    <div class="demo-block">
      <h3>VisuallyHidden</h3>
      <span class="fsus-sr-only">Hidden Text</span>
      <span>Text visible next to hidden one</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ArrowLeft, ArrowRight, Edit, Search } from '../demo-state'
</script>
