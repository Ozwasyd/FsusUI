# Upload 上传

通过点击或拖拽上传文件。

> 💡 **运行示例**：启动 demo-app（`pnpm dev`，端口 5173）查看交互效果。

---

## 基础用法

通过 `slot` 自定义上传按钮类型和文字。使用 `limit` 和 `on-exceed` 限制最大上传数量，通过 `before-remove` 钩子中止删除。

## 覆盖前一个文件

设置 `limit` 和 `on-exceed` 实现选择新文件时自动替换旧文件。

## 照片墙

通过 `list-type` 设置文件列表样式（`text`、`picture`、`picture-card`）。

## 拖拽上传

设置 `drag` 为 `true` 启用拖拽上传。

## 上传目录

设置 `directory` 为 `true` 支持上传整个文件夹（文件夹内文件会被展开为扁平列表）。

## 手动上传

设置 `auto-upload` 为 `false` 禁用自动上传，通过 `submit` 方法手动触发。

---

## API

### Attributes

| 属性名 | 说明 | 类型 | 默认值 |
|--------|------|------|--------|
| action（必填） | 上传请求 URL | `string` | `#` |
| headers | 请求头 | `Headers \| Record<string, any>` | — |
| method | 上传请求方式 | `string` | `post` |
| multiple | 是否支持多选文件 | `boolean` | `false` |
| data | 上传附带的额外参数 | `Record<string, any> \| (rawFile: UploadRawFile) => Record<string, any>` | `{}` |
| name | 上传文件字段名 | `string` | `file` |
| with-credentials | 是否携带 cookie | `boolean` | `false` |
| show-file-list | 是否显示已上传文件列表 | `boolean` | `true` |
| drag | 是否开启拖拽上传 | `boolean` | `false` |
| accept | 接受的文件类型（MIME / 扩展名） | `string` | `''` |
| on-preview | 点击已上传文件时的钩子 | `(uploadFile: UploadFile) => void` | — |
| on-remove | 文件被移除时的钩子 | `(uploadFile: UploadFile, uploadFiles: UploadFiles) => void` | — |
| on-success | 文件上传成功时的钩子 | `(response: any, uploadFile: UploadFile, uploadFiles: UploadFiles) => void` | — |
| on-error | 文件上传失败时的钩子 | `(error: Error, uploadFile: UploadFile, uploadFiles: UploadFiles) => void` | — |
| on-progress | 文件上传进度变化时的钩子 | `(evt: UploadProgressEvent, uploadFile: UploadFile, uploadFiles: UploadFiles) => void` | — |
| on-change | 文件状态改变时的钩子（选取、上传成功、失败均会触发） | `(uploadFile: UploadFile, uploadFiles: UploadFiles) => void` | — |
| on-exceed | 文件数超出 `limit` 时的钩子 | `(files: File[], uploadFiles: UploadUserFile[]) => void` | — |
| before-upload | 上传前钩子，返回 `false` 或 rejected Promise 时中止上传；内部按 Result Mode 归一为可恢复失败，不向外抛出 | `(rawFile: UploadRawFile) => Awaitable<void \| boolean \| File \| Blob>` | — |
| before-remove | 移除前钩子，返回 `false` 或 rejected Promise 时中止删除；内部按 Result Mode 归一为可恢复失败，不向外抛出 | `(uploadFile: UploadFile, uploadFiles: UploadFiles) => Awaitable<boolean>` | — |
| file-list / v-model:file-list | 已上传的文件列表 | `UploadUserFile[]` | `[]` |
| list-type | 文件列表类型 | `'text' \| 'picture' \| 'picture-card'` | `text` |
| auto-upload | 是否自动上传 | `boolean` | `true` |
| http-request | 覆盖默认上传行为 | `(options: UploadRequestOptions) => XMLHttpRequest \| Promise<unknown>` | — |
| disabled | 是否禁用上传 | `boolean` | `false` |
| limit | 允许上传的最大数量 | `number` | — |
| directory | 是否支持上传文件夹 | `boolean` | `false` |

### Slots

| 插槽名 | 说明 |
|--------|------|
| default | 自定义默认内容 |
| trigger | 触发文件选择框的内容 |
| tip | 提示说明内容 |
| file | 缩略图模板的内容 |

### Exposes

| 名称 | 说明 | 类型 |
|------|------|------|
| abort | 取消上传请求（不指定 file 时取消所有进行中的上传） | `(file?: UploadFile) => void` |
| submit | 手动触发上传（需 `auto-upload` 为 false） | `() => void` |
| clearFiles | 清空已上传文件列表 | `(status?: UploadStatus[]) => void` |
| handleStart | 手动选择文件 | `(rawFile: UploadRawFile) => void` |
| handleRemove | 手动移除文件 | `(file: UploadFile) => void` |
