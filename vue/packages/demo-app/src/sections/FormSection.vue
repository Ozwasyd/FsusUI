<template>
  <div id="form" class="demo-section" data-testid="section-form">
    <h2>Form</h2>
    <div
      class="demo-block production-form-fixtures"
      data-testid="production-form-fixtures"
    >
      <header class="production-form-fixtures__header">
        <h3>Publish an editorial update</h3>
        <p>
          Complete the release details, review validation guidance, and attach
          the approved cover asset.
        </p>
      </header>

      <el-form
        class="task-form-fixture"
        :model="productionForm"
        label-position="top"
      >
        <section class="task-form-section" data-form-fixture="full-width">
          <h4>Release details</h4>
          <el-form-item label="Public title">
            <el-input
              v-model="productionForm.title"
              placeholder="Summarize the update for readers"
            />
            <p class="task-field-message">
              Use the same title shown in the release timeline.
            </p>
          </el-form-item>
          <el-form-item label="Audience">
            <el-select
              v-model="productionForm.audience"
              placeholder="Choose who can read this update"
            >
              <el-option label="All readers" value="public" />
              <el-option label="Signed-in members" value="members" />
            </el-select>
            <p class="task-field-message">
              This setting also controls search indexing.
            </p>
          </el-form-item>
          <el-form-item class="is-error" label="Release summary">
            <el-input
              v-model="productionForm.summary"
              type="textarea"
              placeholder="Explain what changed and what readers should do next"
            />
            <p class="task-field-message task-field-message--error">
              Add a concrete next step before requesting approval.
            </p>
          </el-form-item>
        </section>

        <section class="task-form-section" data-form-fixture="short-values">
          <h4>Schedule</h4>
          <div class="task-short-fields">
            <el-form-item class="task-field--number" label="Review limit">
              <el-input-number
                v-model="productionForm.reviewLimit"
                :min="1"
                :max="30"
              />
              <p class="task-field-message">Days before review expires.</p>
            </el-form-item>
            <el-form-item class="task-field--date" label="Publish date">
              <el-date-picker
                v-model="productionForm.publishDate"
                type="date"
                placeholder="Choose a date"
              />
              <p class="task-field-message">Displayed in Asia/Shanghai.</p>
            </el-form-item>
            <el-form-item class="task-field--timezone" label="Time zone">
              <el-select
                v-model="productionForm.timezone"
                placeholder="Choose a time zone"
              >
                <el-option
                  label="Asia/Shanghai (UTC+8)"
                  value="Asia/Shanghai"
                />
                <el-option label="UTC" value="UTC" />
              </el-select>
              <p class="task-field-message">Used by scheduled publishing.</p>
            </el-form-item>
          </div>
        </section>

        <section class="task-form-section" data-form-fixture="inline-pair">
          <h4>Review window</h4>
          <div class="task-inline-pair">
            <el-form-item label="Starts">
              <el-date-picker
                v-model="productionForm.reviewStart"
                type="date"
                placeholder="Start date"
              />
              <p class="task-field-message">Reviewers receive access.</p>
            </el-form-item>
            <el-form-item label="Ends">
              <el-date-picker
                v-model="productionForm.reviewEnd"
                type="date"
                placeholder="End date"
              />
              <p class="task-field-message">Open feedback becomes read-only.</p>
            </el-form-item>
          </div>
        </section>

        <section class="task-form-section" data-form-fixture="upload">
          <h4>Approved cover asset</h4>
          <el-form-item label="Cover image">
            <el-upload
              class="task-upload-field"
              drag
              action="#"
              :auto-upload="false"
              :limit="3"
            >
              <p>Drop the approved image here or choose a local file.</p>
              <template #tip>
                <p class="task-field-message">
                  PNG or JPEG, up to 2 MB. The editorial crop is 16:9.
                </p>
                <p class="task-field-message task-field-message--error">
                  The current draft still needs an approved cover image.
                </p>
              </template>
            </el-upload>
          </el-form-item>
        </section>

        <section class="task-form-section" data-form-fixture="states">
          <h4>Read-only and processing states</h4>
          <el-form-item label="Release owner">
            <el-input model-value="Editorial operations" disabled />
            <p class="task-field-message">
              Ownership changes require administrator approval.
            </p>
          </el-form-item>
          <el-button type="primary" loading>Checking release policy</el-button>
        </section>
      </el-form>
    </div>
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
          <div class="el-upload__tip">支持 jpg/png，单个文件 ≤ 500KB</div>
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
import { reactive } from 'vue'
import { useDemoState } from '../demo-state'

const productionForm = reactive({
  audience: '',
  publishDate: new Date(),
  reviewEnd: new Date(Date.now() + 86_400_000),
  reviewLimit: 5,
  reviewStart: new Date(),
  summary: '',
  timezone: 'Asia/Shanghai',
  title: '',
})

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
.production-form-fixtures {
  width: 100%;
  overflow: hidden;
}

.production-form-fixtures__header,
.task-form-fixture {
  width: 100%;
  max-width: 640px;
}

.production-form-fixtures__header {
  margin-bottom: 24px;
}

.production-form-fixtures__header h3,
.production-form-fixtures__header p,
.task-form-section h4,
.task-field-message {
  margin: 0;
}

.production-form-fixtures__header p {
  margin-top: 8px;
  color: var(--fsus-color-text-quiet);
  font-size: 14px;
  line-height: 1.57;
}

.task-form-section + .task-form-section {
  margin-top: 28px;
}

.task-form-section h4 {
  margin-bottom: 16px;
  font-size: 16px;
  line-height: 1.4;
}

.task-form-fixture :deep(.el-form-item) {
  width: 100%;
  margin-bottom: 16px;
}

.task-form-fixture :deep(.el-form-item__label) {
  margin-bottom: 8px;
  color: var(--fsus-color-text-quiet);
  font-size: 14px;
  font-weight: 500;
  line-height: 1.5;
}

.task-form-fixture :deep(.el-form-item__content),
.task-form-fixture :deep(.el-input),
.task-form-fixture :deep(.el-select),
.task-form-fixture :deep(.el-date-editor),
.task-upload-field {
  width: 100%;
  min-width: 0;
}

.task-field-message {
  width: 100%;
  min-height: 18px;
  margin-top: 6px;
  color: var(--fsus-color-text-quiet);
  font-size: 12px;
  line-height: 1.5;
}

.task-field-message--error {
  color: var(--el-color-danger);
}

.task-short-fields,
.task-inline-pair {
  display: grid;
  align-items: start;
  gap: 16px;
}

.task-short-fields {
  grid-template-columns: minmax(160px, 180px) minmax(220px, 240px);
}

.task-field--number {
  max-width: 180px;
}

.task-field--date,
.task-field--timezone {
  max-width: 240px;
}

.task-inline-pair {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.task-upload-field {
  text-align: left;
}

.task-upload-field :deep(.el-upload),
.task-upload-field :deep(.el-upload-dragger) {
  width: 100%;
}

@media (max-width: 479px) {
  .production-form-fixtures__header,
  .task-form-fixture,
  .task-field--number,
  .task-field--date,
  .task-field--timezone {
    width: 100%;
    max-width: none;
  }

  .task-short-fields,
  .task-inline-pair {
    grid-template-columns: minmax(0, 1fr);
    gap: 0;
  }
}

.tree-select-demo-block {
  padding-bottom: 104px;
}
</style>
