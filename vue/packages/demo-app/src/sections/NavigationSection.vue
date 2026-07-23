<template>
  <div id="navigation" class="demo-section" data-testid="section-navigation">
    <h2>Navigation</h2>
    <div class="demo-block">
      <h3>Menu & MenuItem & SubMenu & MenuItemGroup</h3>
      <el-menu mode="horizontal" default-active="1">
        <el-menu-item index="1">内容中心</el-menu-item>
        <el-sub-menu index="2">
          <template #title>Workspace</template>
          <el-menu-item index="2-1">草稿箱</el-menu-item>
          <el-menu-item index="2-2">发布队列</el-menu-item>
          <el-menu-item-group title="内容工作区">
            <el-menu-item index="2-3">权限设置</el-menu-item>
          </el-menu-item-group>
        </el-sub-menu>
      </el-menu>
    </div>
    <div class="demo-block">
      <h3>Tabs & TabPane</h3>
      <el-tabs v-model="activeTab">
        <el-tab-pane label="草稿" name="first">继续编辑未发布文章</el-tab-pane>
        <el-tab-pane label="已发布" name="second">管理读者可见版本</el-tab-pane>
        <el-tab-pane label="归档" name="third">查看已归档文章</el-tab-pane>
      </el-tabs>
    </div>
    <div class="demo-block">
      <h3>Breadcrumb & BreadcrumbItem</h3>
      <div data-testid="breadcrumb-5">
        <el-breadcrumb separator="/" ariaLabel="Article location">
          <el-breadcrumb-item :to="{ path: '/' }">首页</el-breadcrumb-item>
          <el-breadcrumb-item :to="{ path: '/workspace' }">
            内容工作区
          </el-breadcrumb-item>
          <el-breadcrumb-item :to="{ path: '/workspace/articles' }">
            文章管理
          </el-breadcrumb-item>
          <el-breadcrumb-item :to="{ path: '/workspace/articles/drafts' }">
            待复核草稿
          </el-breadcrumb-item>
          <el-breadcrumb-item>
            响应式导航契约与 Long Latin title verification
          </el-breadcrumb-item>
        </el-breadcrumb>
      </div>
      <div class="navigation-breadcrumb-fixtures">
        <div data-testid="breadcrumb-2">
          <el-breadcrumb separator="→" ariaLabel="Short article location">
            <el-breadcrumb-item :to="{ path: '/' }">首页</el-breadcrumb-item>
            <el-breadcrumb-item>当前文章</el-breadcrumb-item>
          </el-breadcrumb>
        </div>
        <div data-testid="breadcrumb-10">
          <el-breadcrumb
            :separator-icon="ArrowRight"
            ariaLabel="Deep article location"
          >
            <el-breadcrumb-item :to="{ path: '/' }">首页</el-breadcrumb-item>
            <el-breadcrumb-item :to="{ path: '/library' }">
              知识库
            </el-breadcrumb-item>
            <el-breadcrumb-item :to="{ path: '/library/design' }">
              设计系统
            </el-breadcrumb-item>
            <el-breadcrumb-item :to="{ path: '/library/design/components' }">
              组件规范
            </el-breadcrumb-item>
            <el-breadcrumb-item
              :to="{ path: '/library/design/components/navigation' }"
            >
              导航组件
            </el-breadcrumb-item>
            <el-breadcrumb-item
              :to="{ path: '/library/design/components/navigation/mobile' }"
            >
              移动端
            </el-breadcrumb-item>
            <el-breadcrumb-item
              :to="{
                path: '/library/design/components/navigation/mobile/layout',
              }"
            >
              布局
            </el-breadcrumb-item>
            <el-breadcrumb-item
              :to="{
                path: '/library/design/components/navigation/mobile/layout/wrapping',
              }"
            >
              换行规则
            </el-breadcrumb-item>
            <el-breadcrumb-item
              :to="{
                path: '/library/design/components/navigation/mobile/layout/wrapping/evidence',
              }"
            >
              验收证据
            </el-breadcrumb-item>
            <el-breadcrumb-item>
              超长当前层级 Long current breadcrumb destination
            </el-breadcrumb-item>
          </el-breadcrumb>
        </div>
      </div>
    </div>
    <div class="demo-block">
      <h3>PageHeader</h3>
      <el-page-header content="文章详情" @back="goBack" />
    </div>
    <div class="demo-block dropdown-trigger-proxy">
      <h3>Dropdown & DropdownMenu & DropdownItem</h3>
      <el-dropdown>
        <el-button type="primary">
          Dropdown List<el-icon class="el-icon--right"><ArrowDown /></el-icon>
        </el-button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item>保存草稿</el-dropdown-item>
            <el-dropdown-item disabled>预览发布</el-dropdown-item>
            <el-dropdown-item divided>导出 Markdown</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>
    <div class="demo-block">
      <h3>Steps & Step</h3>
      <div data-testid="steps-description">
        <el-steps :active="1">
          <el-step title="撰写" description="整理正文与封面" />
          <el-step
            title="复核"
            description="检查摘要和权限"
            clickable
            @click="stepClicks += 1"
          />
          <el-step
            title="发布"
            description="同步到公开站点并确认 Long Latin destination 完整可见"
          />
        </el-steps>
      </div>
      <div class="navigation-steps-fixtures">
        <div data-testid="steps-compact">
          <el-steps :active="0">
            <el-step title="起草" clickable @click="stepClicks += 1" />
            <el-step title="发布" />
          </el-steps>
        </div>
        <div data-testid="steps-six">
          <el-steps :active="2">
            <el-step title="收集资料" description="确认引用来源" />
            <el-step title="整理结构" description="建立文章提纲" />
            <el-step title="撰写正文" description="完成长篇中英文内容草稿" />
            <el-step title="编辑复核" description="检查措辞、链接与权限" />
            <el-step title="发布预览" description="确认窄屏与宽屏阅读效果" />
            <el-step
              title="正式发布"
              description="同步公开站点并写入审计记录"
            />
          </el-steps>
        </div>
      </div>
      <output data-testid="step-click-count">{{ stepClicks }}</output>
    </div>
    <div class="demo-block demo-backtop-block">
      <h3>Backtop</h3>
      <el-scrollbar height="100px">
        <div class="demo-backtop-content">
          Scroll down to see backtop button
          <el-backtop :right="20" :bottom="20" />
        </div>
      </el-scrollbar>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ArrowDown, ArrowRight, useDemoState } from '../demo-state'

const { activeTab, goBack } = useDemoState()
const stepClicks = ref(0)
</script>
