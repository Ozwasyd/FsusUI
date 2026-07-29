# 服务端渲染 (SSR)

在 SSR 场景下使用 FsusUI 需要进行特殊处理，以避免水合（Hydrate）错误。

---

## Markdown 首屏结果

`ElMarkdownRenderer` 的服务端首屏只接受 runtime 产出的
`MarkdownSafeRenderResult`：

```vue
<el-markdown-renderer :content="content" :initial-render="serverRender" />
```

客户端会核对 runtime authority、`rendererVersion`、规范化源文和
`sourceIdentity`。不匹配的结果不会进入 `v-html`，而是被丢弃并由当前 runtime
重新渲染。旧的字符串首显 prop 和 HTML 清洗开关不再属于公开契约。

---

## 注入唯一 ID

FsusUI 内部使用自增 ID 管理无障碍属性。在 SSR 中，服务端与客户端生成的 ID 必须保持一致，否则会产生水合错误。

在入口文件中注入 `ID_INJECTION_KEY`：

```ts
// main.ts
import { createApp } from 'vue'
import { ID_INJECTION_KEY } from '@ozwasyd/element-plus'
import App from './App.vue'

const app = createApp(App)
app.provide(ID_INJECTION_KEY, {
  prefix: 1024,
  current: 0,
})
```

---

## 注入 ZIndex

同理，`z-index` 自增也可能导致水合错误，建议注入初始值：

```ts
// main.ts
import { createApp } from 'vue'
import { ZINDEX_INJECTION_KEY } from '@ozwasyd/element-plus'
import App from './App.vue'

const app = createApp(App)
app.provide(ZINDEX_INJECTION_KEY, { current: 0 })
```

---

## Teleport 处理

FsusUI 的 `ElDialog`、`ElDrawer`、`ElTooltip`、`ElDropdown`、`ElSelect`、`ElDatePicker` 等组件内部使用了 Vue 的 [Teleport](https://vuejs.org/guide/scaling-up/ssr.html#teleports)，在 SSR 中需要特殊处理。

### 方式一：在客户端挂载后再渲染

```vue
<script setup>
import { ref, onMounted } from 'vue'

const isClient = ref(false)
onMounted(() => { isClient.value = true })
</script>

<template>
  <el-tooltip v-if="isClient" content="提示内容">
    <el-button>按钮</el-button>
  </el-tooltip>
</template>
```

### 方式二：在 HTML 中注入 Teleport 标记

将 teleport 标记注入到 `<body>` 附近：

```html
<!-- index.html -->
<!DOCTYPE html>
<html lang="zh-CN">
  <head><title>FsusUI App</title></head>
  <body>
    <!--app-teleports-->
    <div id="app"><!--app-html--></div>
    <script type="module" src="/src/entry-client.js"></script>
  </body>
</html>
```

在 `entry-server.js` 中提取 teleport 内容：

```js
// entry-server.js
import { renderToString } from 'vue/server-renderer'
import { createApp } from './main'

export async function render(url, manifest) {
  const { app } = createApp()
  const ctx = {}
  const html = await renderToString(app, ctx)
  const teleports = renderTeleports(ctx.teleports)
  return [html, teleports]
}

function renderTeleports(teleports) {
  if (!teleports) return ''
  return Object.entries(teleports).reduce((all, [key, value]) => {
    if (key.startsWith('#el-popper-container-')) {
      return `${all}<div id="${key.slice(1)}">${value}</div>`
    }
    return all
  }, teleports.body || '')
}
```

```js
// server.js
const [appHtml, teleports] = await render(url, manifest)
const html = template
  .replace('<!--app-html-->', appHtml)
  .replace(/(\n|\r\n)\s*<!--app-teleports-->/, teleports)
```

> **注意**：如果修改了[命名空间](./namespace.md)，需要相应调整 `#el-popper-container-` 选择器前缀。
