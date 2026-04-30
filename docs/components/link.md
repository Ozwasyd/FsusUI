# Link 链接

文字超链接。

> **安全提示**：`href` 属性会直接渲染为 `<a>` 标签的 href。使用前务必对 URL 进行校验与过滤，防止 XSS 或开放重定向漏洞。
>
> ```js
> function sanitizeUrl(url) {
>   const allowedProtocols = ['http:', 'https:']
>   try {
>     const parsed = new URL(url, window.location.origin)
>     return allowedProtocols.includes(parsed.protocol) ? parsed.href : '#'
>   } catch {
>     return '#'
>   }
> }
> ```

> 💡 **运行示例**：启动 demo-app（`pnpm dev`，端口 5173）查看交互效果。

---

## 基础用法

基础的文字链接。

## 禁用状态

链接的禁用状态。

## 下划线控制

通过 `underline` 属性控制下划线的显示时机：`'always'`（始终）、`'hover'`（悬停时，默认）、`'never'`（从不）。

## 带图标的链接

通过 `icon` 属性或 `icon` 插槽为链接添加图标前缀。

---

## API

### Attributes

| 属性名 | 说明 | 类型 | 默认值 |
|--------|------|------|--------|
| type | 类型 | `'primary' \| 'success' \| 'warning' \| 'danger' \| 'info' \| 'default'` | `default` |
| underline | 下划线显示时机 | `'always' \| 'hover' \| 'never'` | `hover` |
| disabled | 是否禁用 | `boolean` | `false` |
| href | 原生 `href` 属性 | `string` | — |
| target | 原生 `target` 属性 | `'_blank' \| '_parent' \| '_self' \| '_top'` | `_self` |
| icon | 图标组件 | `string \| Component` | — |

### Slots

| 插槽名 | 说明 |
|--------|------|
| default | 自定义默认内容 |
| icon | 自定义图标 |
