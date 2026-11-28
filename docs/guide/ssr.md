# Server-side rendering (SSR)

FsusUI 2.0 is pure ESM and supports Vue 3.5+ server-side rendering (`vue/server-renderer`), deterministic hydration, and strict Content Security Policy (`style-src-attr 'none'`).

## Markdown first-paint result

`FsusMarkdownRenderer` (from `@ozwasyd/fsusui/markdown`) accepts only a runtime-produced `MarkdownSafeRenderResult` for server-rendered first paint:

```vue
<script setup lang="ts">
import { FsusMarkdownRenderer } from '@ozwasyd/fsusui/markdown'
import type { MarkdownSafeRenderResult } from '@ozwasyd/fsusui/wasm'

defineProps<{
  content: string
  serverRender: MarkdownSafeRenderResult
}>()
</script>

<template>
  <FsusMarkdownRenderer :content="content" :initial-render="serverRender" />
</template>
```

The client verifies runtime authority, `rendererVersion`, normalized source, and `sourceIdentity`. Any mismatch is discarded rather than passed to `v-html`, and the client runtime re-renders safely.

## Deterministic IDs and z-index during hydration

FsusUI 2.0 generates hydration-safe component IDs using Vue 3.5's native `useId()` inside `useFsusId()`, and scopes theme/locale/z-index context through `FsusConfigProvider`:

```vue
<script setup lang="ts">
import { FsusConfigProvider } from '@ozwasyd/fsusui'
import { zhCN } from '@ozwasyd/fsusui/locale'
</script>

<template>
  <FsusConfigProvider :locale="zhCN" theme-mode="light" :z-index="2000">
    <slot />
  </FsusConfigProvider>
</template>
```

Because `useFsusId()` delegates to Vue's built-in `useId()`, server and client automatically produce matching `id`, `for`, `aria-controls`, and `aria-labelledby` attributes without manually providing legacy Element Plus injection keys.

## Handling Teleport in SSR

Overlay and popper components (`FsusDialog`, `FsusDrawer`, `FsusTooltip`, `FsusPopover`, `FsusDropdown`, `FsusSelect`, `FsusCascader`, `FsusImageViewer`) render floating content via Vue [Teleport](https://vuejs.org/guide/scaling-up/ssr.html#teleports) to `body` only when open (closed controls omit the teleported overlay during SSR).

### 1. Keep overlays closed on initial SSR (default)

Closed `FsusSelect`, `FsusCascader`, `FsusDropdown`, `FsusDialog`, and `FsusDrawer` components render cleanly during `renderToString` without emitting empty Teleports or requiring client-only wrappers.

### 2. Extract Teleports when an overlay starts open during SSR

Add a placeholder near `<body>` in your HTML shell:

```html
<!DOCTYPE html>
<html lang="zh-CN">
  <head><title>FsusUI App</title></head>
  <body>
    <!--app-teleports-->
    <div id="app"><!--app-html--></div>
    <script type="module" src="/src/entry-client.ts"></script>
  </body>
</html>
```

Collect `ctx.teleports.body` during `renderToString`:

```ts
import { renderToString } from 'vue/server-renderer'
import { createApp } from './main'

export async function render() {
  const { app } = createApp()
  const ctx: { teleports?: Record<string, string> } = {}
  const html = await renderToString(app, ctx)
  const teleports = ctx.teleports?.body ?? ''
  return { html, teleports }
}
```

Or pass `:teleported="false"` on components that support inline rendering when you want the overlay rendered in place without teleporting to `body`.
