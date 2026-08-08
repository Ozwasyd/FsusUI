<template>
  <div
    id="segmented-visual"
    class="demo-section"
    data-testid="segmented-visual-fixtures"
  >
    <h2>Segmented Visual Acceptance</h2>

    <!-- RadioButton -->
    <div class="demo-block" data-segmented-fixture="radio-button">
      <h3>RadioButton</h3>
      <div class="segmented-fixture-row" data-segmented-variant="radio-default">
        <el-radio-group v-model="radio1">
          <el-radio-button label="a">选项 A</el-radio-button>
          <el-radio-button label="b">选项 B</el-radio-button>
          <el-radio-button label="c">选项 C</el-radio-button>
        </el-radio-group>
      </div>
      <div class="segmented-fixture-row" data-segmented-variant="radio-disabled">
        <el-radio-group v-model="radio2" disabled>
          <el-radio-button label="a">选项 A</el-radio-button>
          <el-radio-button label="b">选项 B</el-radio-button>
          <el-radio-button label="c">选项 C</el-radio-button>
        </el-radio-group>
      </div>
      <div class="segmented-fixture-row" data-segmented-variant="radio-six">
        <el-radio-group v-model="radio3">
          <el-radio-button label="a">选项 A</el-radio-button>
          <el-radio-button label="b">选项 B</el-radio-button>
          <el-radio-button label="c">选项 C</el-radio-button>
          <el-radio-button label="d">选项 D</el-radio-button>
          <el-radio-button label="e">选项 E</el-radio-button>
          <el-radio-button label="f">选项 F</el-radio-button>
        </el-radio-group>
      </div>
      <div class="segmented-fixture-row" data-segmented-variant="radio-cjk">
        <el-radio-group v-model="radio4">
          <el-radio-button label="zh">简体中文</el-radio-button>
          <el-radio-button label="ja">日本語</el-radio-button>
          <el-radio-button label="ko">한국어</el-radio-button>
        </el-radio-group>
      </div>
      <div class="segmented-fixture-row" data-segmented-variant="radio-rtl" dir="rtl">
        <el-radio-group v-model="radio5">
          <el-radio-button label="a">אופציה א</el-radio-button>
          <el-radio-button label="b">אופציה ב</el-radio-button>
          <el-radio-button label="c">אופציה ג</el-radio-button>
        </el-radio-group>
      </div>
    </div>

    <!-- CheckboxButton -->
    <div class="demo-block" data-segmented-fixture="checkbox-button">
      <h3>CheckboxButton</h3>
      <div class="segmented-fixture-row" data-segmented-variant="checkbox-default">
        <el-checkbox-group v-model="checkbox1">
          <el-checkbox-button label="a">标签 A</el-checkbox-button>
          <el-checkbox-button label="b">标签 B</el-checkbox-button>
          <el-checkbox-button label="c">标签 C</el-checkbox-button>
        </el-checkbox-group>
      </div>
      <div class="segmented-fixture-row" data-segmented-variant="checkbox-disabled">
        <el-checkbox-group v-model="checkbox2" disabled>
          <el-checkbox-button label="a">标签 A</el-checkbox-button>
          <el-checkbox-button label="b">标签 B</el-checkbox-button>
        </el-checkbox-group>
      </div>
      <div class="segmented-fixture-row" data-segmented-variant="checkbox-multi">
        <el-checkbox-group v-model="checkbox3">
          <el-checkbox-button label="a">标签 A</el-checkbox-button>
          <el-checkbox-button label="b">标签 B</el-checkbox-button>
          <el-checkbox-button label="c">标签 C</el-checkbox-button>
          <el-checkbox-button label="d">标签 D</el-checkbox-button>
        </el-checkbox-group>
      </div>
    </div>

    <!-- ThemeModeToggle -->
    <div class="demo-block" data-segmented-fixture="theme-toggle">
      <h3>ThemeModeToggle</h3>
      <div class="segmented-fixture-row" data-segmented-variant="toggle-default">
        <el-theme-mode-toggle visibility="desktop" compact />
      </div>
      <div class="segmented-fixture-row" data-segmented-variant="toggle-menu">
        <el-theme-mode-toggle visibility="mobile" variant="menu-button" />
      </div>
    </div>

    <!-- Collection segmented -->
    <div class="demo-block" data-segmented-fixture="collection">
      <h3>Collection Segmented</h3>
      <div class="segmented-fixture-row" data-segmented-variant="collection-default">
        <div class="el-segmented-control" role="tablist">
          <button
            v-for="item in collectionItems"
            :key="item"
            type="button"
            class="el-segmented-control__item"
            :class="{ 'is-active': item === collectionActive }"
            role="tab"
            :aria-selected="item === collectionActive ? 'true' : 'false'"
            @click="collectionActive = item"
          >
            {{ item }}
          </button>
        </div>
      </div>
      <div class="segmented-fixture-row" data-segmented-variant="collection-six">
        <div class="el-segmented-control" role="tablist">
          <button
            v-for="item in collectionSixItems"
            :key="item"
            type="button"
            class="el-segmented-control__item"
            :class="{ 'is-active': item === collectionSixActive }"
            role="tab"
            :aria-selected="item === collectionSixActive ? 'true' : 'false'"
            @click="collectionSixActive = item"
          >
            {{ item }}
          </button>
        </div>
      </div>
    </div>

    <!-- Static CSS gate -->
    <div
      data-testid="segmented-gate-css"
      style="display: none"
      aria-hidden="true"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { CheckboxGroupValueType } from '@element-plus/components/checkbox'

const radio1 = ref<string | number | boolean>('a')
const radio2 = ref<string | number | boolean>('a')
const radio3 = ref<string | number | boolean>('a')
const radio4 = ref<string | number | boolean>('zh')
const radio5 = ref<string | number | boolean>('a')

const checkbox1 = ref<CheckboxGroupValueType>(['a'])
const checkbox2 = ref<CheckboxGroupValueType>(['a'])
const checkbox3 = ref<CheckboxGroupValueType>(['a', 'c'])

const collectionActive = ref('全部')
const collectionItems = ['全部', '进行中', '已完成']

const collectionSixActive = ref('日')
const collectionSixItems = ['日', '周', '月', '季', '半年', '年']
</script>
