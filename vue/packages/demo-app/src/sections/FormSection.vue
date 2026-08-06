<template>
  <div id="form" class="demo-section" data-testid="section-form">
    <h2>Form</h2>
    <div
      class="demo-block production-form-fixtures"
      data-testid="production-form-fixtures"
      v-bind="{ 'data-form-language': productionLocale }"
    >
      <header class="production-form-fixtures__header">
        <h3>{{ copy.title }}</h3>
        <p>{{ copy.introduction }}</p>
        <div
          class="production-form-fixtures__language"
          aria-label="Fixture language"
        >
          <button
            type="button"
            data-testid="form-language-en"
            :aria-pressed="productionLocale === 'en'"
            @click="productionLocale = 'en'"
          >
            English
          </button>
          <button
            type="button"
            data-testid="form-language-zh-CN"
            :aria-pressed="productionLocale === 'zh-CN'"
            @click="productionLocale = 'zh-CN'"
          >
            简体中文
          </button>
        </div>
      </header>

      <el-form
        class="task-form-fixture"
        :model="productionForm"
        label-position="top"
      >
        <!-- @vue-ignore custom test contract attribute -->
        <section class="task-form-section" data-form-fixture="full-width">
          <h4>{{ copy.releaseDetails }}</h4>
          <el-form-item :label="copy.publicTitle">
            <el-input
              v-model="productionForm.title"
              v-bind="{ 'data-form-state': 'empty' }"
              :placeholder="copy.publicTitlePlaceholder"
            />
            <p class="task-field-message">{{ copy.publicTitleHelper }}</p>
          </el-form-item>
          <el-form-item :label="copy.audience">
            <el-select
              v-model="productionForm.audience"
              v-bind="{ 'data-form-state': 'empty' }"
              :placeholder="copy.audiencePlaceholder"
            >
              <el-option :label="copy.audiencePublic" value="public" />
              <el-option :label="copy.audienceMembers" value="members" />
            </el-select>
            <p class="task-field-message">{{ copy.audienceHelper }}</p>
          </el-form-item>
          <el-form-item class="is-error">
            <template #label>
              <span class="task-copy-stress--long-label">
                {{ copy.releaseSummary }}
              </span>
            </template>
            <el-input
              v-model="productionForm.summary"
              v-bind="{ 'data-form-state': 'empty' }"
              type="textarea"
              :placeholder="copy.releaseSummaryPlaceholder"
            />
            <p
              class="task-field-message task-field-message--error task-copy-stress--error"
            >
              {{ copy.releaseSummaryError }}
            </p>
            <p class="task-field-message task-copy-stress--long-helper">
              {{ copy.releaseSummaryHelper }}
            </p>
          </el-form-item>
        </section>

        <!-- @vue-ignore custom test contract attribute -->
        <section class="task-form-section" data-form-fixture="short-values">
          <h4>{{ copy.schedule }}</h4>
          <div class="task-short-fields">
            <el-form-item class="task-field--number" :label="copy.reviewLimit">
              <el-input-number
                :model-value="productionForm.reviewLimit"
                :min="1"
                :max="30"
                @update:model-value="productionForm.reviewLimit = $event ?? 1"
              />
              <p class="task-field-message">{{ copy.reviewLimitHelper }}</p>
            </el-form-item>
            <el-form-item class="task-field--date" :label="copy.publishDate">
              <el-date-picker
                v-model="productionForm.publishDate"
                type="date"
                :placeholder="copy.publishDatePlaceholder"
              />
              <p class="task-field-message">{{ copy.publishDateHelper }}</p>
            </el-form-item>
            <el-form-item class="task-field--timezone" :label="copy.timezone">
              <el-select
                v-model="productionForm.timezone"
                :placeholder="copy.timezonePlaceholder"
              >
                <el-option
                  :label="copy.timezoneShanghai"
                  value="Asia/Shanghai"
                />
                <el-option :label="copy.timezoneUtc" value="UTC" />
              </el-select>
              <p class="task-field-message">{{ copy.timezoneHelper }}</p>
            </el-form-item>
          </div>
        </section>

        <!-- @vue-ignore custom test contract attribute -->
        <section class="task-form-section" data-form-fixture="inline-pair">
          <h4>{{ copy.reviewWindow }}</h4>
          <el-button
            v-bind="{ 'data-testid': 'form-validation-toggle' }"
            @click="
              productionForm.showInlineError = !productionForm.showInlineError
            "
          >
            {{ copy.validationToggle }}
          </el-button>
          <div class="task-inline-pair">
            <el-form-item
              :class="{ 'is-error': productionForm.showInlineError }"
              :label="copy.starts"
            >
              <el-date-picker
                v-model="productionForm.reviewStart"
                type="date"
                :placeholder="copy.startPlaceholder"
              />
              <p
                v-if="productionForm.showInlineError"
                class="task-field-message task-field-message--error"
              >
                {{ copy.startError }}
              </p>
              <p v-else class="task-field-message">{{ copy.startHelper }}</p>
            </el-form-item>
            <el-form-item :label="copy.ends">
              <el-date-picker
                v-model="productionForm.reviewEnd"
                type="date"
                :placeholder="copy.endPlaceholder"
              />
              <p class="task-field-message">{{ copy.endHelper }}</p>
            </el-form-item>
          </div>
        </section>

        <!-- @vue-ignore custom test contract attribute -->
        <section class="task-form-section" data-form-fixture="upload">
          <h4>{{ copy.coverAsset }}</h4>
          <el-form-item :label="copy.coverImage">
            <el-upload
              class="task-upload-field"
              drag
              action="#"
              :auto-upload="false"
              :limit="3"
            >
              <div class="el-upload__text">{{ copy.uploadAction }}</div>
              <p data-upload-help>{{ copy.uploadHelper }}</p>
              <template #tip>
                <p class="task-field-message task-field-message--error">
                  {{ copy.uploadError }}
                </p>
              </template>
            </el-upload>
          </el-form-item>
        </section>

        <!-- @vue-ignore custom test contract attribute -->
        <section class="task-form-section" data-form-fixture="states">
          <h4>{{ copy.states }}</h4>
          <el-form-item :label="copy.releaseOwner">
            <el-input
              :model-value="copy.releaseOwnerValue"
              v-bind="{ 'data-form-state': 'disabled' }"
              disabled
            />
            <p class="task-field-message">{{ copy.releaseOwnerHelper }}</p>
          </el-form-item>
          <el-form-item
            class="task-approval-controls"
            :label="copy.approvalControls"
          >
            <el-checkbox
              :model-value="productionForm.requiresApproval"
              @update:model-value="
                productionForm.requiresApproval = Boolean($event)
              "
            >
              {{ copy.requireApproval }}
            </el-checkbox>
            <el-switch
              :model-value="productionForm.notifyReviewers"
              :active-text="copy.notifyReviewers"
              :inactive-text="copy.doNotNotify"
              @update:model-value="
                productionForm.notifyReviewers = Boolean($event)
              "
            />
            <el-radio-group
              :model-value="productionForm.reviewMode"
              @update:model-value="productionForm.reviewMode = String($event)"
            >
              <el-radio value="required">{{ copy.approvalRequired }}</el-radio>
              <el-radio value="advisory">{{ copy.advisoryReview }}</el-radio>
            </el-radio-group>
          </el-form-item>
          <el-button
            type="primary"
            v-bind="{ 'data-form-state': 'loading' }"
            loading
          >
            {{ copy.loading }}
          </el-button>
        </section>
      </el-form>
    </div>
    <div
      class="demo-block dark-form-authority-matrix"
      data-testid="dark-form-authority-matrix"
    >
      <header class="dark-form-authority-matrix__header">
        <h3>Dark form state authority matrix</h3>
        <p>
          Compare readable guidance, secondary state text, and structural
          borders without changing control geometry.
        </p>
      </header>

      <div class="dark-form-authority-matrix__controls">
        <!-- @vue-ignore custom visual contract attribute -->
        <section
          v-for="control in darkFormControls"
          :key="control.id"
          class="dark-form-control-group"
          :data-control-group="control.id"
        >
          <h4>{{ control.label }}</h4>
          <div class="dark-form-control-group__states">
            <!-- @vue-ignore custom visual contract attributes -->
            <div
              v-for="state in darkFormStates"
              :key="state"
              class="dark-form-contract-cell"
              data-dark-form-cell
              :data-control="control.id"
              :data-state="state"
            >
              <!-- @vue-ignore custom visual contract attribute -->
              <span data-dark-form-label>
                {{ control.label }} · {{ state }}
              </span>

              <el-input
                v-if="control.id === 'input'"
                :model-value="
                  darkFormIsFilled(state) ? 'Release brief ready' : ''
                "
                :placeholder="darkFormPlaceholder(state, 'Enter release brief')"
                :disabled="state === 'disabled'"
              />
              <el-input
                v-else-if="control.id === 'textarea'"
                type="textarea"
                :model-value="
                  darkFormIsFilled(state)
                    ? 'Explain the reader-facing change.'
                    : ''
                "
                :placeholder="
                  darkFormPlaceholder(state, 'Add release guidance')
                "
                :disabled="state === 'disabled'"
              />
              <el-select
                v-else-if="control.id === 'select'"
                :model-value="darkFormIsFilled(state) ? 'members' : ''"
                :placeholder="darkFormPlaceholder(state, 'Choose an audience')"
                :disabled="state === 'disabled'"
              >
                <el-option label="Signed-in members" value="members" />
              </el-select>
              <el-select-v2
                v-else-if="control.id === 'select-v2'"
                :model-value="darkFormIsFilled(state) ? 'approval' : ''"
                :options="darkFormSelectOptions"
                :placeholder="darkFormPlaceholder(state, 'Choose a workflow')"
                :disabled="state === 'disabled'"
              />
              <el-date-picker
                v-else-if="control.id === 'date-picker'"
                :model-value="
                  darkFormIsFilled(state) ? darkFormDate : undefined
                "
                type="date"
                :placeholder="darkFormPlaceholder(state, 'Choose a date')"
                :disabled="state === 'disabled'"
              />
              <el-time-picker
                v-else-if="control.id === 'time-picker'"
                :model-value="
                  darkFormIsFilled(state) ? darkFormDate : undefined
                "
                :placeholder="darkFormPlaceholder(state, 'Choose a time')"
                :disabled="state === 'disabled'"
              />
              <el-time-select
                v-else-if="control.id === 'time-select'"
                :model-value="darkFormIsFilled(state) ? '09:00' : ''"
                start="08:00"
                step="00:30"
                end="18:00"
                :placeholder="
                  darkFormPlaceholder(state, 'Choose a release slot')
                "
                :disabled="state === 'disabled'"
              />
              <el-input-number
                v-else-if="control.id === 'input-number'"
                :model-value="darkFormIsFilled(state) ? 7 : undefined"
                :placeholder="darkFormPlaceholder(state, 'Set review days')"
                :disabled="state === 'disabled'"
              />
              <el-cascader
                v-else-if="control.id === 'cascader'"
                :model-value="
                  darkFormIsFilled(state) ? ['editorial', 'release'] : []
                "
                :options="darkFormCascaderOptions"
                :placeholder="
                  darkFormPlaceholder(state, 'Choose a release category')
                "
                :disabled="state === 'disabled'"
              />
              <el-upload
                v-else
                drag
                action="#"
                :auto-upload="false"
                :disabled="state === 'disabled'"
              >
                <p>
                  {{
                    darkFormIsFilled(state)
                      ? 'approved-cover.png'
                      : state === 'placeholder'
                        ? 'Choose an approved cover'
                        : 'Drop a cover or browse'
                  }}
                </p>
              </el-upload>

              <!-- @vue-ignore custom visual contract attribute -->
              <p
                data-dark-form-helper
                :class="{ 'is-invalid': state === 'invalid' }"
              >
                {{
                  state === 'invalid'
                    ? 'Resolve this value before publishing.'
                    : 'Required release guidance remains readable.'
                }}
              </p>
            </div>
          </div>
        </section>
      </div>
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
    <div
      class="demo-block"
      data-testid="input-number-hit-fixtures"
      data-input-number-hit-fixtures
    >
      <h3>InputNumber</h3>
      <el-space wrap :size="16">
        <el-input-number
          v-model="inputNumber"
          :min="1"
          :max="10"
          data-input-number-case="default-sides"
        />
        <el-input-number
          v-model="inputNumber"
          size="small"
          :min="1"
          :max="10"
          data-input-number-case="small-sides"
        />
        <el-input-number
          v-model="inputNumber"
          size="large"
          :min="1"
          :max="10"
          data-input-number-case="large-sides"
        />
        <el-input-number
          v-model="inputNumber"
          controls-position="right"
          :min="1"
          :max="10"
          data-input-number-case="default-right"
        />
        <el-input-number
          v-model="inputNumber"
          size="small"
          controls-position="right"
          :min="1"
          :max="10"
          data-input-number-case="small-right"
        />
        <el-input-number
          v-model="inputNumber"
          size="large"
          controls-position="right"
          :min="1"
          :max="10"
          data-input-number-case="large-right"
        />
        <el-input-number
          v-model="inputNumber"
          :min="1"
          :max="10"
          disabled
          data-input-number-case="disabled-sides"
        />
      </el-space>
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
import { computed, reactive, ref } from 'vue'
import { useDemoState } from '../demo-state'

const productionCopy = {
  en: {
    advisoryReview: 'Advisory review',
    approvalControls: 'Approval controls',
    approvalRequired: 'Approval required',
    audience: 'Audience',
    audienceHelper: 'This setting also controls search indexing.',
    audienceMembers: 'Signed-in members',
    audiencePlaceholder: 'Choose who can read this update',
    audiencePublic: 'All readers',
    coverAsset: 'Approved cover asset',
    coverImage: 'Cover image',
    doNotNotify: 'Do not notify',
    ends: 'Ends',
    endHelper: 'Open feedback becomes read-only.',
    endPlaceholder: 'End date',
    introduction:
      'Complete the release details, review validation guidance, and attach the approved cover asset.',
    loading: 'Checking release policy',
    notifyReviewers: 'Notify reviewers',
    publicTitle: 'Public title',
    publicTitleHelper: 'Use the same title shown in the release timeline.',
    publicTitlePlaceholder: 'Summarize the update for readers',
    publishDate: 'Publish date',
    publishDateHelper: 'Displayed in Asia/Shanghai.',
    publishDatePlaceholder: 'Choose a date',
    releaseDetails: 'Release details',
    releaseOwner: 'Release owner',
    releaseOwnerHelper: 'Ownership changes require administrator approval.',
    releaseOwnerValue: 'Editorial operations',
    releaseSummary:
      'Release summary for readers, reviewers, and support responders',
    releaseSummaryError: 'Add a concrete next step before requesting approval.',
    releaseSummaryHelper:
      'Explain the customer impact, the rollout boundary, and the exact recovery action a reader should take if the updated workflow is unavailable.',
    releaseSummaryPlaceholder:
      'Explain what changed and what readers should do next',
    requireApproval: 'Require editor approval before publishing',
    reviewLimit: 'Review limit',
    reviewLimitHelper: 'Days before review expires.',
    reviewWindow: 'Review window',
    schedule: 'Schedule',
    startError: 'Choose a start date before opening review.',
    startHelper: 'Reviewers receive access.',
    startPlaceholder: 'Start date',
    starts: 'Starts',
    states: 'Read-only and processing states',
    timezone: 'Time zone',
    timezoneHelper: 'Used by scheduled publishing.',
    timezonePlaceholder: 'Choose a time zone',
    timezoneShanghai: 'Asia/Shanghai (UTC+8)',
    timezoneUtc: 'UTC',
    title: 'Publish an editorial update',
    uploadAction: 'Drop the approved image here or choose a local file.',
    uploadError: 'The current draft still needs an approved cover image.',
    uploadHelper: 'PNG or JPEG, up to 2 MB. The editorial crop is 16:9.',
    validationToggle: 'Toggle start-date validation example',
  },
  'zh-CN': {
    advisoryReview: '建议性复核',
    approvalControls: '审批控制',
    approvalRequired: '必须审批',
    audience: '读者范围',
    audienceHelper: '此设置也会决定内容是否进入搜索索引。',
    audienceMembers: '已登录成员',
    audiencePlaceholder: '选择哪些读者可以查看本次更新',
    audiencePublic: '所有读者',
    coverAsset: '已批准的封面素材',
    coverImage: '封面图片',
    doNotNotify: '不通知',
    ends: '结束日期',
    endHelper: '到期后，已有反馈将变为只读。',
    endPlaceholder: '选择结束日期',
    introduction:
      '填写发布信息，核对审批提示，并附上已经通过编辑审核的封面素材。',
    loading: '正在核对发布策略',
    notifyReviewers: '通知复核人',
    publicTitle: '公开标题',
    publicTitleHelper: '请使用与发布记录中完全一致的标题。',
    publicTitlePlaceholder: '概括这次面向读者的更新',
    publishDate: '发布日期',
    publishDateHelper: '日期将按 Asia/Shanghai 时区展示。',
    publishDatePlaceholder: '选择日期',
    releaseDetails: '发布信息',
    releaseOwner: '发布负责人',
    releaseOwnerHelper: '负责人变更必须经过管理员审批。',
    releaseOwnerValue: '内容运营团队',
    releaseSummary: '供读者、复核人和支持团队共同使用的发布摘要',
    releaseSummaryError: '发起审批前，请补充一个读者可以执行的明确下一步。',
    releaseSummaryHelper:
      '请完整说明对读者的影响、发布边界，以及更新后的流程不可用时应采取的准确恢复操作，避免只写内部实现细节。',
    releaseSummaryPlaceholder: '说明发生了什么变化，以及读者接下来应该做什么',
    requireApproval: '发布前必须由编辑审批',
    reviewLimit: '复核有效期',
    reviewLimitHelper: '超过此天数后复核将失效。',
    reviewWindow: '复核时间窗',
    schedule: '发布时间',
    startError: '开启复核前必须选择开始日期。',
    startHelper: '到达此日期后，复核人将获得访问权限。',
    startPlaceholder: '选择开始日期',
    starts: '开始日期',
    states: '只读与处理中状态',
    timezone: '发布时区',
    timezoneHelper: '定时发布任务将使用此时区。',
    timezonePlaceholder: '选择发布时区',
    timezoneShanghai: '亚洲/上海（UTC+8）',
    timezoneUtc: '协调世界时（UTC）',
    title: '发布一条编辑更新',
    uploadAction: '将已批准的图片拖到此处，或选择本地文件。',
    uploadError: '当前草稿仍缺少通过审批的封面图片。',
    uploadHelper: '支持 PNG 或 JPEG，最大 2 MB，编辑裁切比例为 16:9。',
    validationToggle: '切换开始日期校验示例',
  },
} as const

const productionLocale = ref<keyof typeof productionCopy>('en')
const copy = computed(() => productionCopy[productionLocale.value])

const darkFormStates = [
  'default',
  'hover',
  'focus',
  'filled',
  'placeholder',
  'disabled',
  'invalid',
] as const

const darkFormControls = [
  { id: 'input', label: 'Input' },
  { id: 'textarea', label: 'Textarea' },
  { id: 'select', label: 'Select' },
  { id: 'select-v2', label: 'Select V2' },
  { id: 'date-picker', label: 'Date Picker' },
  { id: 'time-picker', label: 'Time Picker' },
  { id: 'time-select', label: 'Time Select' },
  { id: 'input-number', label: 'Input Number' },
  { id: 'cascader', label: 'Cascader' },
  { id: 'upload', label: 'Upload' },
] as const

const darkFormDate = new Date(2026, 6, 24, 9, 0, 0)
const darkFormSelectOptions = [
  { label: 'Editorial approval', value: 'approval' },
]
const darkFormCascaderOptions = [
  {
    label: 'Editorial',
    value: 'editorial',
    children: [{ label: 'Release', value: 'release' }],
  },
]
const darkFormIsFilled = (state: (typeof darkFormStates)[number]) =>
  state === 'filled' || state === 'disabled'
const darkFormPlaceholder = (
  state: (typeof darkFormStates)[number],
  value: string,
) => (state === 'placeholder' ? value : '')

const productionForm = reactive({
  audience: '',
  notifyReviewers: true,
  publishDate: new Date(),
  requiresApproval: true,
  reviewMode: 'required',
  reviewEnd: new Date(Date.now() + 86_400_000),
  reviewLimit: 5,
  reviewStart: new Date(),
  showInlineError: false,
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

.dark-form-authority-matrix {
  width: 100%;
  overflow: visible;
}

.dark-form-authority-matrix__header {
  margin-bottom: 24px;
}

.dark-form-authority-matrix__header h3,
.dark-form-authority-matrix__header p,
.dark-form-control-group h4,
.dark-form-contract-cell > p {
  margin: 0;
}

.dark-form-authority-matrix__header p {
  max-width: 680px;
  margin-top: 8px;
  color: var(--fsus-form-readable-text);
  font-size: 14px;
  line-height: 1.57;
}

.dark-form-authority-matrix__controls {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px;
}

.dark-form-control-group {
  min-width: 0;
}

.dark-form-control-group h4 {
  margin-bottom: 12px;
  color: var(--el-text-color-primary);
  font-size: 15px;
  line-height: 1.4;
}

.dark-form-control-group__states {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.dark-form-contract-cell {
  min-width: 0;
  padding: 12px;
  border: 1px solid var(--fsus-border);
  border-radius: 8px;
  background: var(--fsus-paper);
}

.dark-form-contract-cell > [data-dark-form-label],
.dark-form-contract-cell > [data-dark-form-helper] {
  display: block;
  color: var(--fsus-form-readable-text);
  font-size: 12px;
  line-height: 1.5;
}

.dark-form-contract-cell > [data-dark-form-label] {
  margin-bottom: 6px;
  font-weight: 500;
}

.dark-form-contract-cell > [data-dark-form-helper] {
  min-height: 18px;
  margin-top: 6px;
}

.dark-form-contract-cell > [data-dark-form-helper].is-invalid {
  color: var(--el-color-danger);
}

.dark-form-contract-cell[data-state='placeholder'] :deep(.el-upload-dragger p),
.dark-form-contract-cell[data-state='disabled'] :deep(.el-upload-dragger p) {
  color: var(--fsus-form-state-text);
}

.dark-form-contract-cell :deep(.el-input),
.dark-form-contract-cell :deep(.el-select),
.dark-form-contract-cell :deep(.el-date-editor),
.dark-form-contract-cell :deep(.el-input-number),
.dark-form-contract-cell :deep(.el-cascader),
.dark-form-contract-cell :deep(.el-upload),
.dark-form-contract-cell :deep(.el-upload-dragger) {
  width: 100%;
  min-width: 0;
}

.dark-form-contract-cell[data-state='hover']
  :deep(
    .el-input__wrapper,
    .el-textarea__inner,
    .el-select__wrapper,
    .el-date-editor.el-input__wrapper,
    .el-input-number,
    .el-upload-dragger
  ) {
  background: var(--el-bg-color);
  border-color: var(--fsus-scholarly-blue);
}

.dark-form-contract-cell[data-state='focus']
  :deep(
    .el-input__wrapper,
    .el-textarea__inner,
    .el-select__wrapper,
    .el-date-editor.el-input__wrapper,
    .el-input-number,
    .el-upload-dragger
  ) {
  background: var(--el-bg-color);
  border-color: var(--fsus-scholarly-blue);
  box-shadow: inset 0 0 0 var(--fsus-focus-ring-width, 2px)
    var(--fsus-scholarly-blue) !important;
}

.dark-form-contract-cell[data-state='invalid']
  :deep(
    .el-input__wrapper,
    .el-textarea__inner,
    .el-select__wrapper,
    .el-date-editor.el-input__wrapper,
    .el-input-number,
    .el-upload-dragger
  ) {
  border-color: var(--el-color-danger);
  box-shadow: inset 0 0 0 1px var(--el-color-danger) !important;
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

.production-form-fixtures__language {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 16px;
}

.production-form-fixtures__language button {
  min-height: 44px;
  padding: 0 14px;
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  color: var(--el-text-color-regular);
  background: var(--el-fill-color-blank);
  font: inherit;
  cursor: pointer;
}

.production-form-fixtures__language button[aria-pressed='true'] {
  border-color: var(--el-color-primary);
  color: var(--el-color-primary);
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
.task-form-fixture :deep(.el-input-number),
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

.task-field--timezone {
  grid-column: 1 / -1;
}

.task-inline-pair {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

[data-form-fixture='inline-pair'] > .el-button {
  margin-bottom: 16px;
}

.task-upload-field {
  text-align: left;
}

.task-upload-field :deep(.el-upload),
.task-upload-field :deep(.el-upload-dragger) {
  width: 100%;
}

.task-form-fixture :deep(.task-approval-controls .el-form-item__content) {
  gap: 12px 16px;
}

.task-form-fixture :deep(.task-approval-controls .el-checkbox),
.task-form-fixture :deep(.task-approval-controls .el-radio) {
  max-width: 100%;
  height: auto;
  min-width: 0;
  align-items: flex-start;
  white-space: normal;
}

.task-form-fixture :deep(.task-approval-controls .el-checkbox__label),
.task-form-fixture :deep(.task-approval-controls .el-radio__label) {
  min-width: 0;
  overflow-wrap: anywhere;
  white-space: normal;
}

@media (max-width: 479px) {
  .dark-form-authority-matrix__controls,
  .dark-form-control-group__states {
    grid-template-columns: minmax(0, 1fr);
  }

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

  :deep(.el-space--vertical),
  :deep(.el-space--vertical > .el-space__item),
  :deep(.el-date-editor--daterange) {
    width: 100% !important;
    min-width: 0;
    max-width: 100%;
  }
}

.tree-select-demo-block {
  padding-bottom: 104px;
}
</style>
