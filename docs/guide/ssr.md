# Server-side rendering (SSR)

FsusUI SSR integrations must preserve the server/client identities and
Teleport targets used during hydration.

## Markdown first-paint result

`ElMarkdownRenderer` accepts only the runtime-produced
`MarkdownSafeRenderResult` for its server-rendered first paint:

```vue
<el-markdown-renderer :content="content" :initial-render="serverRender" />
```

The client verifies the runtime authority, `rendererVersion`, normalized source,
and `sourceIdentity`. A mismatch is discarded rather than passed to `v-html`;
the current runtime renders again. The old string-first prop and HTML sanitizing
switch are not public API.

## Inject the ID sequence

Server and client must share the generated IDs used by accessibility attributes;
provide `ID_INJECTION_KEY` at the application root:

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

## Inject the z-index sequence

The auto-incrementing `z-index` also needs a shared initial value:

```ts
// main.ts
import { createApp } from 'vue'
import { ZINDEX_INJECTION_KEY } from '@ozwasyd/element-plus'
import App from './App.vue'

const app = createApp(App)
app.provide(ZINDEX_INJECTION_KEY, { current: 0 })
```

## Handle Teleport

`ElDialog`, `ElDrawer`, `ElTooltip`, `ElDropdown`, `ElSelect`, and `ElDatePicker`
use Vue [Teleport](https://vuejs.org/guide/scaling-up/ssr.html#teleports). Use
one of these approaches:

### 1. Render after client mount

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

### 2. Add Teleport markers to the HTML template

Place the marker near `<body>`:

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

Extract matching Teleports in `entry-server.js`:

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

Insert both rendered regions in `server.js`:

```js
// server.js
const [appHtml, teleports] = await render(url, manifest)
const html = template
  .replace('<!--app-html-->', appHtml)
  .replace(/(\n|\r\n)\s*<!--app-teleports-->/, teleports)
```

If the [namespace](./namespace.md) changes, update the
`#el-popper-container-` selector prefix as well.
