# 快速开始

本节介绍如何在你的项目中使用 FsusUI。

安装方式请参阅 [安装文档](./installation.md)。

---

## 全量引入

如果不在意打包体积，全量引入是最简便的方式。

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

### Volar 类型提示支持

使用 Volar 时，在 `vue/tsconfig.json` 的 `compilerOptions.types` 中添加全局组件类型定义：

```json
{
  "compilerOptions": {
    "types": ["@ozwasyd/element-plus/global"]
  }
}
```

---

## 按需引入（推荐）

按需引入可以显著减小打包体积。FsusUI 基于 ES Module 原生支持 Tree Shaking。

### 自动按需导入

安装插件：

```bash
pnpm install -D unplugin-vue-components unplugin-auto-import
```

在 `vite.config.ts` 中配置：

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

配置完成后，组件和 API 会在使用时自动导入，无需手动引入。

### 手动按需导入

FsusUI 支持通过 [unplugin-element-plus](https://github.com/element-plus/unplugin-element-plus) 按需加载样式。

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

## 全局配置

注册 FsusUI 时，可以传入全局配置对象，设置组件默认 `size`、弹出层 `zIndex`，以及文档级 `themeMode`。

**全量引入方式：**

```ts
// main.ts
import { createApp } from 'vue'
import FsusUI from '@ozwasyd/element-plus'
import App from './App.vue'

const app = createApp(App)
app.use(FsusUI, { size: 'small', zIndex: 3000 })
```

如果你希望主题稳定跟随系统或支持显式强制模式，直接在这里加上 `themeMode`：

```ts
app.use(FsusUI, {
  size: 'small',
  zIndex: 3000,
  themeMode: 'system',
})
```

**按需引入方式（通过 ConfigProvider）：**

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

`themeMode` 支持 `'light' | 'dark' | 'system'`。完整行为和 SSR 接入方式见 [暗色模式](./dark-mode.md)。

---

## 本地运行示例

在 monorepo 中，所有组件都有可运行的 Demo：

```bash
pnpm dev
```

启动后访问 `http://localhost:5173`，即可查看各组件的交互效果。

---

## 下一步

- [主题定制](./theming.md) — 了解如何修改 FsusUI 的色彩与样式变量
- [暗色模式](./dark-mode.md) — 接入 `themeMode`、跟随系统主题、处理 SSR 首帧
- [国际化](./i18n.md) — 配置多语言支持
- [组件文档](../components/overview.md) — 查阅各组件的完整 API
  > **Name note:** FsusUI is the recommended public-facing name. The current npm
  > public-preview package remains `@ozwasyd/element-plus`; it is the FsusUI
  > Element Plus compatibility build, not the upstream Element Plus package.
