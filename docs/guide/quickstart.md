# Quickstart

This guide shows how to use FsusUI in a Vue project. See
[Installation](./installation.md) for prerequisites and package setup.

## Full import

Use the full import when bundle size is not a concern:

```ts
// main.ts
import { createApp } from 'vue'
import FsusUI from '@ozwasyd/element-plus'
import '@ozwasyd/element-plus/dist/fsus.css'
import App from './App.vue'

const app = createApp(App)
app.use(FsusUI)
app.mount('#app')
```

### Volar global types

With Volar, add the global component declarations to
`compilerOptions.types` in `vue/tsconfig.json`:

```json
{
  "compilerOptions": {
    "types": ["@ozwasyd/element-plus/global"]
  }
}
```

## On-demand imports (recommended)

On-demand imports reduce bundle size. FsusUI is an ES module and supports tree
shaking.

### Automatic imports

Install the import plugins:

```bash
pnpm install -D unplugin-vue-components unplugin-auto-import
```

Configure them in `vite.config.ts`:

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'

export default defineConfig({
  plugins: [
    AutoImport({
      resolvers: [ElementPlusResolver()],
    }),
    Components({
      resolvers: [ElementPlusResolver()],
    }),
  ],
})
```

Components and APIs are then imported when used.

### Manual imports

Use [unplugin-element-plus](https://github.com/element-plus/unplugin-element-plus)
to load component styles on demand:

```vue
<!-- App.vue -->
<template>
  <el-button>按钮</el-button>
</template>

<script setup lang="ts">
import { ElButton } from '@ozwasyd/element-plus'
</script>
```

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import ElementPlus from 'unplugin-element-plus/vite'

export default defineConfig({
  plugins: [ElementPlus()],
})
```

---

## Global configuration

Pass global component `size`, overlay `zIndex`, and document-level `themeMode`
when installing FsusUI.

Full import:

```ts
// main.ts
import { createApp } from 'vue'
import FsusUI from '@ozwasyd/element-plus'
import App from './App.vue'

const app = createApp(App)
app.use(FsusUI, { size: 'small', zIndex: 3000 })
```

Add `themeMode` when the application must follow the system or force a mode:

```ts
app.use(FsusUI, {
  size: 'small',
  zIndex: 3000,
  themeMode: 'system',
})
```

On-demand setup with `ConfigProvider`:

```vue
<!-- App.vue -->
<template>
  <el-config-provider :size="size" :z-index="zIndex" :theme-mode="themeMode">
    <app />
  </el-config-provider>
</template>

<script setup lang="ts">
import { ElConfigProvider } from '@ozwasyd/element-plus'

const zIndex = 3000
const size = 'small'
const themeMode = 'system'
</script>
```

`themeMode` accepts `'light' | 'dark' | 'system'`. See [Dark mode](./dark-mode.md)
for behavior and SSR setup.

## Run the local demo

Every component has a runnable demo in the monorepo:

```bash
pnpm dev
```

Open `http://localhost:5173` to inspect the interactive examples.

## Next steps

- [Theme customization](./theming.md) — Override public color and style variables.
- [Dark mode](./dark-mode.md) — Configure `themeMode` and SSR first paint.
- [Internationalization](./i18n.md) — Configure locale support.
- [Component docs](../components/overview.md) — Browse component APIs.
