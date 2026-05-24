<template>
  <div id="navigation" class="demo-section" data-testid="section-navigation">
    <h2>Navigation</h2>
    <div class="demo-block">
      <h3>Menu & MenuItem & SubMenu & MenuItemGroup</h3>
      <el-menu mode="horizontal" default-active="1">
        <el-menu-item index="1">Processing Center</el-menu-item>
        <el-sub-menu index="2">
          <template #title>Workspace</template>
          <el-menu-item index="2-1">item one</el-menu-item>
          <el-menu-item index="2-2">item two</el-menu-item>
          <el-menu-item-group title="Group One">
            <el-menu-item index="2-3">item three</el-menu-item>
          </el-menu-item-group>
        </el-sub-menu>
      </el-menu>
    </div>
    <div class="demo-block">
      <h3>Tabs & TabPane</h3>
      <el-tabs v-model="activeTab">
        <el-tab-pane label="User" name="first">User Content</el-tab-pane>
        <el-tab-pane label="Config" name="second">Config Content</el-tab-pane>
        <el-tab-pane label="Role" name="third">Role Content</el-tab-pane>
      </el-tabs>
    </div>
    <div class="demo-block">
      <h3>Breadcrumb & BreadcrumbItem</h3>
      <el-breadcrumb separator="/">
        <el-breadcrumb-item :to="{ path: '/' }">homepage</el-breadcrumb-item>
        <el-breadcrumb-item>
          <a href="/">promotion management</a>
        </el-breadcrumb-item>
        <el-breadcrumb-item>promotion list</el-breadcrumb-item>
      </el-breadcrumb>
    </div>
    <div class="demo-block">
      <h3>PageHeader</h3>
      <el-page-header content="Detail" @back="goBack" />
    </div>
    <div class="demo-block dropdown-trigger-proxy">
      <h3>Dropdown & DropdownMenu & DropdownItem</h3>
      <el-dropdown>
        <el-button type="primary">
          Dropdown List<el-icon class="el-icon--right"><ArrowDown /></el-icon>
        </el-button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item>Action 1</el-dropdown-item>
            <el-dropdown-item disabled>Action 2</el-dropdown-item>
            <el-dropdown-item divided>Action 3</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>
    <div class="demo-block">
      <h3>Steps & Step</h3>
      <el-steps :active="1">
        <el-step title="Step 1" description="Some description" />
        <el-step title="Step 2" description="Some description" />
        <el-step title="Step 3" description="Some description" />
      </el-steps>
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
import { ArrowDown, useDemoState } from '../demo-state'

const { activeTab, goBack } = useDemoState()
</script>
