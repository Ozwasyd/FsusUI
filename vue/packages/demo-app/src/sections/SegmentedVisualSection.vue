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
        <fsus-radio-group v-model="radio1">
          <fsus-radio-button value="a">选项 A</fsus-radio-button>
          <fsus-radio-button value="b">选项 B</fsus-radio-button>
          <fsus-radio-button value="c">选项 C</fsus-radio-button>
        </fsus-radio-group>
      </div>
      <div class="segmented-fixture-row" data-segmented-variant="radio-disabled">
        <fsus-radio-group v-model="radio2" disabled>
          <fsus-radio-button value="a">选项 A</fsus-radio-button>
          <fsus-radio-button value="b">选项 B</fsus-radio-button>
          <fsus-radio-button value="c">选项 C</fsus-radio-button>
        </fsus-radio-group>
      </div>
      <div class="segmented-fixture-row" data-segmented-variant="radio-six">
        <fsus-radio-group v-model="radio3">
          <fsus-radio-button value="a">选项 A</fsus-radio-button>
          <fsus-radio-button value="b">选项 B</fsus-radio-button>
          <fsus-radio-button value="c">选项 C</fsus-radio-button>
          <fsus-radio-button value="d">选项 D</fsus-radio-button>
          <fsus-radio-button value="e">选项 E</fsus-radio-button>
          <fsus-radio-button value="f">选项 F</fsus-radio-button>
        </fsus-radio-group>
      </div>
      <div class="segmented-fixture-row" data-segmented-variant="radio-cjk">
        <fsus-radio-group v-model="radio4">
          <fsus-radio-button value="zh">简体中文</fsus-radio-button>
          <fsus-radio-button value="ja">日本語</fsus-radio-button>
          <fsus-radio-button value="ko">한국어</fsus-radio-button>
        </fsus-radio-group>
      </div>
      <div class="segmented-fixture-row" data-segmented-variant="radio-rtl" dir="rtl">
        <fsus-radio-group v-model="radio5">
          <fsus-radio-button value="a">אופציה א</fsus-radio-button>
          <fsus-radio-button value="b">אופציה ב</fsus-radio-button>
          <fsus-radio-button value="c">אופציה ג</fsus-radio-button>
        </fsus-radio-group>
      </div>
    </div>

    <!-- CheckboxButton -->
    <div class="demo-block" data-segmented-fixture="checkbox-button">
      <h3>CheckboxButton</h3>
      <div class="segmented-fixture-row" data-segmented-variant="checkbox-default">
        <fsus-checkbox-group v-model="checkbox1">
          <fsus-checkbox-button value="a">标签 A</fsus-checkbox-button>
          <fsus-checkbox-button value="b">标签 B</fsus-checkbox-button>
          <fsus-checkbox-button value="c">标签 C</fsus-checkbox-button>
        </fsus-checkbox-group>
      </div>
      <div class="segmented-fixture-row" data-segmented-variant="checkbox-disabled">
        <fsus-checkbox-group v-model="checkbox2" disabled>
          <fsus-checkbox-button value="a">标签 A</fsus-checkbox-button>
          <fsus-checkbox-button value="b">标签 B</fsus-checkbox-button>
        </fsus-checkbox-group>
      </div>
      <div class="segmented-fixture-row" data-segmented-variant="checkbox-multi">
        <fsus-checkbox-group v-model="checkbox3">
          <fsus-checkbox-button value="a">标签 A</fsus-checkbox-button>
          <fsus-checkbox-button value="b">标签 B</fsus-checkbox-button>
          <fsus-checkbox-button value="c">标签 C</fsus-checkbox-button>
          <fsus-checkbox-button value="d">标签 D</fsus-checkbox-button>
        </fsus-checkbox-group>
      </div>
    </div>

    <!-- ThemeModeToggle -->
    <div class="demo-block" data-segmented-fixture="theme-toggle">
      <h3>ThemeModeToggle</h3>
      <div class="segmented-fixture-row" data-segmented-variant="toggle-default">
        <fsus-theme-mode-toggle visibility="desktop" compact />
      </div>
      <div class="segmented-fixture-row" data-segmented-variant="toggle-menu">
        <fsus-theme-mode-toggle visibility="always" variant="menu-button" />
      </div>
    </div>

    <!-- Collection segmented -->
    <div class="demo-block" data-segmented-fixture="collection">
      <h3>Collection Segmented</h3>
      <div class="segmented-fixture-row" data-segmented-variant="collection-default">
        <FsusSegmentedControl
          v-model="collectionActive"
          :options="collectionItems"
          ariaLabel="Collection state"
          @update:model-value="recordCollectionEvent('default', 'update:modelValue', $event)"
          @change="recordCollectionEvent('default', 'change', $event)"
        />
        <output hidden>{{ collectionResult('default', collectionActive) }}</output>
      </div>
      <div class="segmented-fixture-row" data-segmented-variant="collection-six">
        <FsusSegmentedControl
          v-model="collectionSixActive"
          :options="collectionSixItems"
          ariaLabel="Collection period"
        />
      </div>
      <div class="segmented-fixture-row" data-segmented-variant="collection-mixed">
        <FsusSegmentedControl
          v-model="collectionMixedActive"
          :options="collectionDisabledItems"
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
        <FsusSegmentedControl
          v-model="collectionDisabledActive"
          :options="collectionDisabledItems"
          ariaLabel="Collection with disabled selection"
          @update:model-value="recordCollectionEvent('disabled-selected', 'update:modelValue', $event)"
          @change="recordCollectionEvent('disabled-selected', 'change', $event)"
        />
        <output hidden>{{ collectionResult('disabled-selected', collectionDisabledActive) }}</output>
      </div>
      <div class="segmented-fixture-row" data-segmented-variant="collection-values">
        <FsusSegmentedControl
          v-model="collectionValueActive"
          :options="collectionValueItems"
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
import { FsusSegmentedControl } from '@ozwasyd/fsusui'
import type {
  SegmentedControlItem,
  SegmentedControlValue,
} from '@ozwasyd/fsusui'
import type { CheckboxGroupValueType } from '@ozwasyd/fsusui'

const radio1 = ref<string | number | boolean>('a')
const radio2 = ref<string | number | boolean>('a')
const radio3 = ref<string | number | boolean>('a')
const radio4 = ref<string | number | boolean>('zh')
const radio5 = ref<string | number | boolean>('a')

const checkbox1 = ref<CheckboxGroupValueType>(['a'])
const checkbox2 = ref<CheckboxGroupValueType>(['a'])
const checkbox3 = ref<CheckboxGroupValueType>(['a', 'c'])

// Use the same public local entry as the demo's @ozwasyd/fsusui Vite alias.
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
