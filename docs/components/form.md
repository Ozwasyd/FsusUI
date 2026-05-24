# Form 表单

由输入框、单选框、复选框、选择器等控件组成，用于数据收集、校验和提交。

> **提示**：在只有一个单行文本输入框的表单中，浏览器会将按下 Enter 视为提交。为防止此行为，在 `<el-form>` 上添加 `@submit.prevent`。

> 💡 **运行示例**：启动 demo-app（`pnpm dev`，端口 5173）查看交互效果。

---

## 基础表单

包含各种类型的表单控件，每个 `form-item` 作为容器包裹表单项。

## 行内表单

设置 `inline` 为 `true` 实现行内表单（适用于垂直空间有限的场景）。

## 对齐方式

通过 `label-position` 设置标签对齐方式：`left`（左对齐）、`right`（右对齐，默认）、`top`（顶部对齐）。

## 表单校验

在 `el-form` 上通过 `rules` 属性传入校验规则，在 `el-form-item` 上设置 `prop` 属性对应规则的 key。底层使用 [async-validator](https://github.com/yiminghe/async-validator)。

```vue
<template>
  <el-form :model="form" :rules="rules" ref="formRef">
    <el-form-item label="用户名" prop="username">
      <el-input v-model="form.username" />
    </el-form-item>
    <el-form-item>
      <el-button type="primary" @click="submit">提交</el-button>
    </el-form-item>
  </el-form>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { FormInstance, FormRules } from '@ozwasyd/element-plus'

const formRef = ref<FormInstance>()
const form = ref({ username: '' })
const rules: FormRules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
}

const submit = async () => {
  const result = await formRef.value?.validate()
  if (!result?.ok || !result.value) return
  // 校验通过，执行提交
}
</script>
```

`validate()` 与 `validateField()` 返回 `Promise<FsusResult<boolean>>`。校验失败时返回 `ok: false`，`error.code` 为 `validation`，原始 `ValidateFieldsError` 保存在 `error.cause`；不再用 rejected Promise 表示普通校验失败。

## 自定义校验规则

使用自定义校验函数时，必须调用 `callback`。使用 `status-icon` 可显示校验结果图标。

## 动态增减表单项

可以动态添加/删除 `el-form-item` 并即时更新校验规则。

## 尺寸控制

Form 的 `size` 属性会被所有直接子 FormItem 继承；FormItem 也可以单独设置 `size` 覆盖。

---

## Form API

### Form Attributes

| 属性名 | 说明 | 类型 | 默认值 |
|--------|------|------|--------|
| model | 表单数据对象 | `Record<string, any>` | — |
| rules | 表单校验规则 | `FormRules` | — |
| inline | 是否行内表单 | `boolean` | `false` |
| label-position | 标签位置 | `'left' \| 'right' \| 'top'` | `right` |
| label-width | 标签宽度（支持 `auto`） | `string \| number` | `''` |
| label-suffix | 标签后缀文字 | `string` | `''` |
| hide-required-asterisk | 是否隐藏必填星号 | `boolean` | `false` |
| require-asterisk-position | 必填星号位置 | `'left' \| 'right'` | `left` |
| show-message | 是否显示校验错误信息 | `boolean` | `true` |
| inline-message | 是否以行内方式显示校验信息 | `boolean` | `false` |
| status-icon | 是否显示校验结果图标 | `boolean` | `false` |
| validate-on-rule-change | `rules` 改变时是否触发校验 | `boolean` | `true` |
| size | 控制该表单内所有组件的尺寸 | `'' \| 'large' \| 'default' \| 'small'` | — |
| disabled | 是否禁用该表单内所有组件 | `boolean` | `false` |
| scroll-to-error | 校验失败时是否滚动到第一个错误表单项 | `boolean` | `false` |
| scroll-into-view-options | 滚动行为配置 | `ScrollIntoViewOptions \| boolean` | `true` |

### Form Events

| 事件名 | 说明 | 回调参数 |
|--------|------|---------|
| validate | 某个表单项校验完成后触发 | `(prop: FormItemProp, isValid: boolean, message: string) => void` |

### Form Slots

| 插槽名 | 说明 | 子标签 |
|--------|------|--------|
| default | 表单内容 | FormItem |

### Form Exposes

| 名称 | 说明 | 类型 |
|------|------|------|
| validate | 校验整个表单，返回 Promise | `(callback?: FormValidateCallback) => Promise<void>` |
| validateField | 校验指定字段 | `(props?: FormItemProp[], callback?: FormValidateCallback) => FormValidationResult` |
| resetFields | 重置指定字段并清除校验结果 | `(props?: FormItemProp[]) => void` |
| scrollToField | 滚动到指定字段 | `(prop: FormItemProp) => void` |
| clearValidate | 清除指定字段的校验结果 | `(props?: FormItemProp[]) => void` |
| fields | 获取所有字段上下文 | `FormItemContext[]` |

---

## FormItem API

### FormItem Attributes

| 属性名 | 说明 | 类型 | 默认值 |
|--------|------|------|--------|
| prop | `model` 的字段 key（用于 validate 和 resetFields） | `string \| string[]` | — |
| label | 标签文本 | `string` | — |
| label-position | 标签位置（继承自 Form） | `'left' \| 'right' \| 'top'` | `''` |
| label-width | 标签宽度（支持 `auto`） | `string \| number` | — |
| required | 是否必填（不填则根据 rules 自动判断） | `boolean` | — |
| rules | 该字段的校验规则 | `Arrayable<FormItemRule>` | — |
| error | 手动设置错误信息（立即触发错误状态） | `string` | — |
| show-message | 是否显示校验错误信息 | `boolean` | `true` |
| inline-message | 是否行内显示校验信息 | `boolean` | `false` |
| size | 该字段内组件的尺寸 | `'' \| 'large' \| 'default' \| 'small'` | — |

#### FormItemRule

| 名称 | 说明 | 类型 | 默认值 |
|------|------|------|--------|
| trigger | 触发校验时机 | `'blur' \| 'change'` | — |

### FormItem Slots

| 插槽名 | 说明 |
|--------|------|
| default | 表单项内容 |
| label | 自定义标签内容 |
| error | 自定义错误信息 |

### FormItem Exposes

| 名称 | 说明 | 类型 |
|------|------|------|
| size | 表单项尺寸 | `ComputedRef<'' \| 'large' \| 'default' \| 'small'>` |
| validateMessage | 校验信息 | `Ref<string>` |
| validateState | 校验状态 | `Ref<'' \| 'error' \| 'validating' \| 'success'>` |
| validate | 触发表单项校验 | `(trigger: string, callback?) => FormValidationResult` |
| resetField | 重置该字段 | `() => void` |
| clearValidate | 清除该字段的校验状态 | `() => void` |
