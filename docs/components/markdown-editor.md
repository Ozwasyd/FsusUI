# MarkdownEditor Markdown 编辑器

`ElMarkdownEditor` 提供通用 Markdown 编辑外壳：toolbar command model、selection helpers、write/split/preview 三种模式、状态栏，以及保存/提交/上传图片事件。业务项目只需要处理上传、保存草稿、发布等业务 glue。

## 基础用法

```vue
<template>
  <el-markdown-editor
    v-model="content"
    default-mode="split"
    @save="saveDraft"
    @submit="publishArticle"
    @upload-image="openAssetPicker"
  />
</template>
```

## Public primitives

基础 selection 能力也可直接从组件入口复用：

```ts
import {
  applyMarkdownEditorCommand,
  defaultMarkdownEditorCommands,
} from '@ozwasyd/element-plus'
```

## API

### Attributes

| 属性名            | 说明                                        | 类型                                      | 默认值   |
| ----------------- | ------------------------------------------- | ----------------------------------------- | -------- |
| model-value       | Markdown 内容                               | `string`                                  | `''`     |
| default-mode      | 初始编辑模式                                | `'write' \| 'split' \| 'preview'`         | `write`  |
| placeholder       | 文本域占位文本                              | `string`                                  | `''`     |
| commands          | toolbar command model                       | `MarkdownEditorCommand[]`                 | 内置命令 |
| preview-base-url  | preview renderer 的基础 URL                 | `string \| null`                          | `null`   |
| preview-csp-nonce | preview renderer 的 CSP nonce               | `string \| null`                          | `null`   |
| preview-features  | preview renderer 的 feature activation 开关 | `MarkdownFeatureActivationFeatureOptions` | —        |
| allow-html        | preview 是否允许 raw HTML                   | `boolean`                                 | `false`  |
| sanitize-html     | preview DOM 提交前是否 sanitize             | `boolean`                                 | `true`   |
| min-rows          | 编辑区最小行数                              | `number`                                  | `12`     |

### Events

| 事件名             | 说明                            |
| ------------------ | ------------------------------- |
| update:modelValue  | 内容更新                        |
| change             | 内容更新                        |
| command            | toolbar command 被执行          |
| mode-change        | 编辑模式切换                    |
| save               | 保存事件                        |
| submit             | 提交事件                        |
| upload-image       | 上传图片事件                    |
| render-complete    | preview renderer 完成           |
| render-error       | preview renderer 失败           |
| features-activated | preview feature activation 完成 |
