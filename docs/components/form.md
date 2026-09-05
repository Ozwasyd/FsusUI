# Form

Combines inputs, radios, checkboxes, selects, and other controls for data collection, validation, and submission.

> **Tip:** In a form with one single-line text input, browsers treat Enter as submission. Add `@submit.prevent` to `<el-form>` to prevent this behavior.

> See the [Playground](../playground.md) for runnable component examples.

---

## Basic Form

Use different form controls inside `form-item` containers.

## Inline Form

Set `inline` to `true` for an inline form when vertical space is limited.

## Alignment

Set label alignment with `label-position`: `left`, `right` (default), or `top`.

## Form Validation

Pass validation rules through `rules` on `el-form` and set `prop` on `el-form-item` to the matching rule key. Validation uses [async-validator](https://github.com/yiminghe/async-validator).

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

`validate()` and `validateField()` return `Promise<FsusResult<boolean>>`. Validation failure returns `ok: false` with `error.code: 'validation'`; the original `ValidateFieldsError` is in `error.cause`. Ordinary validation failure is no longer represented by a rejected Promise.

## Custom Validation Rules

Custom validators must call `callback`. Set `status-icon` to show a validation-result icon.

## Dynamic Form Items

Add or remove `el-form-item` dynamically and update validation rules immediately.

## Size Control

Form's `size` is inherited by all direct FormItem children; a FormItem can override it with its own `size`.

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
