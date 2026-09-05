# Link

A text hyperlink.

> Validate and filter untrusted URLs before passing `href`; it is rendered
> directly on `<a>` and can otherwise enable XSS or open redirects. See the
> [Security Policy](../../SECURITY.md).
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

> See the [Playground](../playground.md) for runnable component examples.

---

## Basic Usage

A basic text link.

## Disabled State

The disabled link state.

## Underline

Use `underline` to show the underline `always`, on `hover` (default), or `never`.

## Links with Icons

Add an icon prefix with the `icon` prop or slot.

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
