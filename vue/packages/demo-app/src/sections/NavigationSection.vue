<template>
  <div id="navigation" class="demo-section" data-testid="section-navigation">
    <h2>Navigation</h2>
    <div class="demo-block">
      <h3>Menu & MenuItem & SubMenu & MenuItemGroup</h3>
      <fsus-menu mode="horizontal" default-active="1">
        <fsus-menu-item index="1">内容中心</fsus-menu-item>
        <fsus-sub-menu index="2">
          <template #title>Workspace</template>
          <fsus-menu-item index="2-1">草稿箱</fsus-menu-item>
          <fsus-menu-item index="2-2">发布队列</fsus-menu-item>
          <fsus-menu-item-group title="内容工作区">
            <fsus-menu-item index="2-3">权限设置</fsus-menu-item>
          </fsus-menu-item-group>
        </fsus-sub-menu>
      </fsus-menu>
    </div>
    <div class="demo-block">
      <h3>Tabs & TabPane</h3>
      <fsus-tabs v-model="activeTab">
        <fsus-tab-pane label="草稿" name="first">继续编辑未发布文章</fsus-tab-pane>
        <fsus-tab-pane label="已发布" name="second">管理读者可见版本</fsus-tab-pane>
        <fsus-tab-pane label="归档" name="third">查看已归档文章</fsus-tab-pane>
      </fsus-tabs>
    </div>
    <div class="demo-block">
      <h3>Breadcrumb & BreadcrumbItem</h3>
      <div data-testid="breadcrumb-5">
        <fsus-breadcrumb separator="/" ariaLabel="Article location">
          <fsus-breadcrumb-item :to="{ path: '/' }">首页</fsus-breadcrumb-item>
          <fsus-breadcrumb-item :to="{ path: '/workspace' }">
            内容工作区
          </fsus-breadcrumb-item>
          <fsus-breadcrumb-item :to="{ path: '/workspace/articles' }">
            文章管理
          </fsus-breadcrumb-item>
          <fsus-breadcrumb-item :to="{ path: '/workspace/articles/drafts' }">
            待复核草稿
          </fsus-breadcrumb-item>
          <fsus-breadcrumb-item>
            响应式导航契约与 Long Latin title verification
          </fsus-breadcrumb-item>
        </fsus-breadcrumb>
      </div>
      <div class="navigation-breadcrumb-fixtures">
        <div data-testid="breadcrumb-2">
          <fsus-breadcrumb separator="→" ariaLabel="Short article location">
            <fsus-breadcrumb-item :to="{ path: '/' }">首页</fsus-breadcrumb-item>
            <fsus-breadcrumb-item>当前文章</fsus-breadcrumb-item>
          </fsus-breadcrumb>
        </div>
        <div data-testid="breadcrumb-10">
          <fsus-breadcrumb
            :separator-icon="ArrowRight"
            ariaLabel="Deep article location"
          >
            <fsus-breadcrumb-item :to="{ path: '/' }">首页</fsus-breadcrumb-item>
            <fsus-breadcrumb-item :to="{ path: '/library' }">
              知识库
            </fsus-breadcrumb-item>
            <fsus-breadcrumb-item :to="{ path: '/library/design' }">
              设计系统
            </fsus-breadcrumb-item>
            <fsus-breadcrumb-item :to="{ path: '/library/design/components' }">
              组件规范
            </fsus-breadcrumb-item>
            <fsus-breadcrumb-item
              :to="{ path: '/library/design/components/navigation' }"
            >
              导航组件
            </fsus-breadcrumb-item>
            <fsus-breadcrumb-item
              :to="{ path: '/library/design/components/navigation/mobile' }"
            >
              移动端
            </fsus-breadcrumb-item>
            <fsus-breadcrumb-item
              :to="{
                path: '/library/design/components/navigation/mobile/layout',
              }"
            >
              布局
            </fsus-breadcrumb-item>
            <fsus-breadcrumb-item
              :to="{
                path: '/library/design/components/navigation/mobile/layout/wrapping',
              }"
            >
              换行规则
            </fsus-breadcrumb-item>
            <fsus-breadcrumb-item
              :to="{
                path: '/library/design/components/navigation/mobile/layout/wrapping/evidence',
              }"
            >
              验收证据
            </fsus-breadcrumb-item>
            <fsus-breadcrumb-item>
              超长当前层级 Long current breadcrumb destination
            </fsus-breadcrumb-item>
          </fsus-breadcrumb>
        </div>
      </div>
    </div>
    <div class="demo-block">
      <h3>PageHeader</h3>
      <fsus-page-header content="文章详情" @back="goBack" />
    </div>
    <div class="demo-block dropdown-trigger-proxy">
      <h3>Dropdown & DropdownMenu & DropdownItem</h3>
      <fsus-dropdown>
        <fsus-button type="primary">
          Dropdown List<fsus-icon class="fsus-icon--right"><ArrowDown /></fsus-icon>
        </fsus-button>
        <template #dropdown>
          <fsus-dropdown-menu>
            <fsus-dropdown-item>保存草稿</fsus-dropdown-item>
            <fsus-dropdown-item disabled>预览发布</fsus-dropdown-item>
            <fsus-dropdown-item divided>导出 Markdown</fsus-dropdown-item>
          </fsus-dropdown-menu>
        </template>
      </fsus-dropdown>
    </div>
    <div class="demo-block">
      <h3>Steps & Step</h3>
      <div data-testid="steps-description">
        <fsus-steps :active="1">
          <fsus-step title="撰写" description="整理正文与封面" />
          <fsus-step
            title="复核"
            description="检查摘要和权限"
            clickable
            @click="stepClicks += 1"
          />
          <fsus-step
            title="发布"
            description="同步到公开站点并确认 Long Latin destination 完整可见"
          />
        </fsus-steps>
      </div>
      <div class="navigation-steps-fixtures">
        <div data-testid="steps-compact">
          <fsus-steps :active="0">
            <fsus-step title="起草" clickable @click="stepClicks += 1" />
            <fsus-step title="发布" />
          </fsus-steps>
        </div>
        <div data-testid="steps-six">
          <fsus-steps :active="2">
            <fsus-step title="收集资料" description="确认引用来源" />
            <fsus-step title="整理结构" description="建立文章提纲" />
            <fsus-step title="撰写正文" description="完成长篇中英文内容草稿" />
            <fsus-step title="编辑复核" description="检查措辞、链接与权限" />
            <fsus-step title="发布预览" description="确认窄屏与宽屏阅读效果" />
            <fsus-step
              title="正式发布"
              description="同步公开站点并写入审计记录"
            />
          </fsus-steps>
        </div>
      </div>
      <output data-testid="step-click-count">{{ stepClicks }}</output>
    </div>
    <div class="demo-block demo-backtop-block">
      <h3>Backtop</h3>
      <fsus-scrollbar height="100px">
        <div class="demo-backtop-content">
          Scroll down to see backtop button
          <fsus-backtop :right="20" :bottom="20" />
        </div>
      </fsus-scrollbar>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ArrowDown, ArrowRight, useDemoState } from '../demo-state'

const { activeTab, goBack } = useDemoState()
const stepClicks = ref(0)
</script>
