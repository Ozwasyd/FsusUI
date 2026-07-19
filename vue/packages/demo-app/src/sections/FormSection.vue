<template>
  <div id="form" class="demo-section" data-testid="section-form">
    <h2>Form</h2>
    <div class="demo-block">
      <h3>Radio & RadioButton</h3>
      <el-space direction="vertical" alignment="flex-start">
        <el-radio-group v-model="radio">
          <el-radio label="1">公开</el-radio>
          <el-radio label="2">仅自己可见</el-radio>
        </el-radio-group>
        <el-radio-group v-model="radio">
          <el-radio-button label="1">公开</el-radio-button>
          <el-radio-button label="2">仅自己可见</el-radio-button>
        </el-radio-group>
      </el-space>
    </div>
    <div class="demo-block">
      <h3>Checkbox & CheckboxButton</h3>
      <el-space direction="vertical" alignment="flex-start">
        <el-checkbox v-model="checkbox">Checkbox</el-checkbox>
        <el-checkbox-group v-model="checkboxGroup">
          <el-checkbox label="A">推送到首页</el-checkbox>
          <el-checkbox label="B">保持普通</el-checkbox>
        </el-checkbox-group>
        <el-checkbox-group v-model="checkboxGroup">
          <el-checkbox-button label="A">推送到首页</el-checkbox-button>
          <el-checkbox-button label="B">保持普通</el-checkbox-button>
        </el-checkbox-group>
      </el-space>
    </div>
    <div class="demo-block">
      <h3>Input</h3>
      <el-space direction="vertical" style="width: 100%">
        <el-input v-model="input" placeholder="输入文章标题" clearable />
        <el-input
          v-model="input"
          type="textarea"
          placeholder="写下摘要或更新说明"
        />
      </el-space>
    </div>
    <div class="demo-block">
      <h3>InputNumber</h3>
      <el-input-number v-model="inputNumber" :min="1" :max="10" />
    </div>
    <div class="demo-block">
      <h3>Select & Option & OptionGroup</h3>
      <el-select v-model="select" placeholder="选择可见范围">
        <el-option-group label="发布范围">
          <el-option label="公开" value="1" />
          <el-option label="仅自己可见" value="2" />
        </el-option-group>
      </el-select>
    </div>
    <div class="demo-block">
      <h3>SelectV2</h3>
      <el-select-v2
        v-model="select"
        :options="selectV2Options"
        placeholder="选择工作流"
      />
    </div>
    <div class="demo-block">
      <h3>Cascader & CascaderPanel</h3>
      <el-space wrap>
        <el-cascader :options="cascaderOptions" placeholder="选择分类" />
        <el-cascader-panel :options="cascaderOptions" />
      </el-space>
    </div>
    <div class="demo-block">
      <h3>Switch</h3>
      <el-switch
        v-model="switchValue"
        active-text="Open"
        inactive-text="Close"
      />
    </div>
    <div class="demo-block">
      <h3>Slider</h3>
      <el-slider v-model="slider" />
    </div>
    <div class="demo-block">
      <h3>TimePicker / TimeSelect</h3>
      <el-space wrap>
        <el-time-picker v-model="time" placeholder="选择发布时间" />
        <el-time-select
          v-model="timeSelect"
          start="08:30"
          step="00:15"
          end="18:30"
          placeholder="选择推送时段"
        />
      </el-space>
    </div>
    <div class="demo-block">
      <h3>DatePicker</h3>
      <el-space direction="vertical">
        <el-date-picker v-model="date" type="date" placeholder="选择日期" />
        <el-date-picker
          v-model="dateRange"
          type="daterange"
          range-separator="至"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
        />
      </el-space>
    </div>
    <div class="demo-block">
      <h3>Upload</h3>
      <el-upload action="#" multiple :limit="3">
        <el-button type="primary">上传封面</el-button>
        <template #tip>
          <div class="el-upload__tip">
            支持 jpg/png，单个文件 ≤ 500KB
          </div>
        </template>
      </el-upload>
    </div>
    <div class="demo-block">
      <h3>Rate</h3>
      <el-rate v-model="rate" allow-half />
    </div>
    <div class="demo-block">
      <h3>ColorPicker</h3>
      <el-color-picker
        :model-value="color"
        @update:model-value="color = $event || ''"
      />
    </div>
    <div class="demo-block">
      <h3>Transfer</h3>
      <el-transfer v-model="transferValue" :data="transferData" />
    </div>
    <div class="demo-block">
      <h3>Form & FormItem</h3>
      <el-form :model="formModel" label-width="120px">
        <el-form-item label="文章标题">
          <el-input v-model="formModel.name" />
        </el-form-item>
        <el-form-item label="可见范围">
          <div data-testid="activity-zone-select-wrapper">
            <el-select
              v-model="formModel.region"
              placeholder="选择可见范围"
              :teleported="false"
            >
              <el-option label="公开" value="shanghai" />
              <el-option label="仅自己可见" value="beijing" />
            </el-select>
          </div>
        </el-form-item>
      </el-form>
    </div>
    <div class="demo-block">
      <h3>Autocomplete</h3>
      <el-autocomplete v-model="input" :fetch-suggestions="querySearch" />
    </div>
    <div class="demo-block tree-select-demo-block">
      <h3>TreeSelect</h3>
      <div class="tree-select-test-wrapper" data-testid="unique-tree-select">
        <el-tree-select
          v-model="treeSelectValue"
          :data="treeData"
          :teleported="false"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useDemoState } from '../demo-state'

const {
  cascaderOptions,
  checkbox,
  checkboxGroup,
  color,
  date,
  dateRange,
  formModel,
  input,
  inputNumber,
  querySearch,
  radio,
  rate,
  select,
  selectV2Options,
  slider,
  switchValue,
  time,
  timeSelect,
  transferData,
  transferValue,
  treeData,
  treeSelectValue,
} = useDemoState()
</script>

<style scoped>
.tree-select-demo-block {
  padding-bottom: 104px;
}
</style>
