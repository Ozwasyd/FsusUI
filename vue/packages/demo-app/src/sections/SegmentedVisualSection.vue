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
        <el-theme-mode-toggle visibility="always" variant="menu-button" />
      </div>
    </div>

    <!-- Collection segmented -->
    <div class="demo-block" data-segmented-fixture="collection">
      <h3>Collection Segmented</h3>
      <div class="segmented-fixture-row" data-segmented-variant="collection-default">
        <ElSegmentedControl
          v-model="collectionActive"
          :items="collectionItems"
          ariaLabel="Collection state"
          @update:model-value="recordCollectionEvent('default', 'update:modelValue', $event)"
          @change="recordCollectionEvent('default', 'change', $event)"
        />
        <output hidden>{{ collectionResult('default', collectionActive) }}</output>
      </div>
      <div class="segmented-fixture-row" data-segmented-variant="collection-six">
        <ElSegmentedControl
          v-model="collectionSixActive"
          :items="collectionSixItems"
          ariaLabel="Collection period"
        />
      </div>
      <div class="segmented-fixture-row" data-segmented-variant="collection-mixed">
        <ElSegmentedControl
          v-model="collectionMixedActive"
          :items="collectionDisabledItems"
          ariaLabel="Collection with disabled item"
          @update:model-value="recordCollectionEvent('mixed', 'update:modelValue', $event)"
          @change="recordCollectionEvent('mixed', 'change', $event)"
        />
        <output hidden>{{ collectionResult('mixed', collectionMixedActive) }}</output>
      </div>
      <div
        class="segmented-fixture-row"
        data-segmented-variant="collection-disabled-selected"
        tabindex="-1"
      >
        <ElSegmentedControl
          v-model="collectionDisabledActive"
          :items="collectionDisabledItems"
          ariaLabel="Collection with disabled selection"
          @update:model-value="recordCollectionEvent('disabled-selected', 'update:modelValue', $event)"
          @change="recordCollectionEvent('disabled-selected', 'change', $event)"
        />
        <output hidden>{{ collectionResult('disabled-selected', collectionDisabledActive) }}</output>
      </div>
      <div class="segmented-fixture-row" data-segmented-variant="collection-values">
        <ElSegmentedControl
          v-model="collectionValueActive"
          :items="collectionValueItems"
          ariaLabel="Collection typed values"
          @update:model-value="recordCollectionEvent('values', 'update:modelValue', $event)"
          @change="recordCollectionEvent('values', 'change', $event)"
        />
        <output hidden>{{ collectionResult('values', collectionValueActive) }}</output>
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
import { ElSegmentedControl } from '../../../element-plus'
import type { SegmentedControlItem, SegmentedControlValue } from '../../../element-plus'
import type { CheckboxGroupValueType } from '@element-plus/components/checkbox'

const radio1 = ref<string | number | boolean>('a')
const radio2 = ref<string | number | boolean>('a')
const radio3 = ref<string | number | boolean>('a')
const radio4 = ref<string | number | boolean>('zh')
const radio5 = ref<string | number | boolean>('a')

const checkbox1 = ref<CheckboxGroupValueType>(['a'])
const checkbox2 = ref<CheckboxGroupValueType>(['a'])
const checkbox3 = ref<CheckboxGroupValueType>(['a', 'c'])

// Use the same public local entry as the demo's element-plus Vite alias.
// No private component import or hand-authored radio/tab DOM is used here.
const collectionActive = ref<SegmentedControlValue>('all')
const collectionItems: SegmentedControlItem[] = [
  { label: '全部', value: 'all' },
  { label: '进行中', value: 'open' },
  { label: '已完成', value: 'closed' },
]
const collectionSixActive = ref<SegmentedControlValue>('day')
const collectionSixItems: SegmentedControlItem[] = [
  { label: '日', value: 'day' },
  { label: '周', value: 'week' },
  { label: '月', value: 'month' },
  { label: '季', value: 'quarter' },
  { label: '半年', value: 'half-year' },
  { label: '年', value: 'year' },
]
const collectionMixedActive = ref<SegmentedControlValue>('all')
const collectionDisabledActive = ref<SegmentedControlValue>('open')
const collectionDisabledItems: SegmentedControlItem[] = [
  { label: '全部', value: 'all' },
  { label: '进行中', value: 'open', disabled: true },
  { label: '已完成', value: 'closed' },
]
const collectionValueActive = ref<SegmentedControlValue>(false)
const collectionValueItems: SegmentedControlItem[] = [
  { label: '关闭', value: false },
  { label: '零', value: 0 },
  { label: '字符串零', value: '0' },
  { label: '启用', value: true },
]

type CollectionEvent = ['update:modelValue' | 'change', SegmentedControlValue]
const collectionEvents = ref<Record<string, CollectionEvent[]>>({})
const recordCollectionEvent = (
  variant: string,
  event: CollectionEvent[0],
  value: SegmentedControlValue,
) => {
  ;(collectionEvents.value[variant] ??= []).push([event, value])
}
const collectionResult = (variant: string, value: SegmentedControlValue) =>
  JSON.stringify({ value, events: collectionEvents.value[variant] ?? [] })
</script>
