# 暗色模式

FsusUI 当前主题入口 `@ozwasyd/element-plus/theme-chalk` 已内置明暗双套 token，并默认包含基于 `prefers-color-scheme` 的系统级自适应。

如果你的应用只需要“跟随系统”，引入主题 CSS 就够了；如果你需要持久化用户选择、SSR 首帧一致性、或显式强制 `light`/`dark`，请使用本页的 `themeMode` / `syncThemeMode` 接入方式。

---

## 默认行为

只要引入主题样式，组件会自动跟随系统主题：

```ts
import ElementPlus from '@ozwasyd/element-plus'
import '@ozwasyd/element-plus/dist/index.css'
```

内置规则位于 `packages/theme-chalk/src/fsus-theme.scss`：

- `html.dark`：强制暗色
- `html.light`：强制亮色
- `@media (prefers-color-scheme: dark) { html:not(.light) { ... } }`：系统自适应

这意味着调用端不写任何 JS，也能获得基础的 dark mode。

---

## 推荐接入方式

### 方式一：安装时声明 `themeMode`

适合业务应用根入口。

```ts
import { createApp } from 'vue'
import ElementPlus from '@ozwasyd/element-plus'
import '@ozwasyd/element-plus/dist/index.css'
import App from './App.vue'

const app = createApp(App)

app.use(ElementPlus, {
  themeMode: 'system',
})

app.mount('#app')
```

`themeMode` 支持三种值：

- `system`：跟随系统主题，不强制写入 `.dark` / `.light`
- `dark`：强制暗色
- `light`：强制亮色

### 方式二：在根 `ConfigProvider` 中声明

适合应用运行时会切换主题模式的场景。

```vue
<template>
  <el-config-provider :theme-mode="themeMode">
    <App />
  </el-config-provider>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const themeMode = ref<'light' | 'dark' | 'system'>('system')
</script>
```

### 方式三：在挂载前直接同步

适合你要在 Vue 启动前先应用本地持久化主题，避免首帧闪烁。

```ts
import { syncThemeMode } from '@ozwasyd/element-plus'

const storedThemeMode = localStorage.getItem('theme-mode')
syncThemeMode(
  storedThemeMode === 'dark' || storedThemeMode === 'light'
    ? storedThemeMode
    : 'system',
)
```

`syncThemeMode()` 会同步这些状态到 `<html>`：

- `class="dark"` 或 `class="light"`（仅显式模式）
- `data-theme-mode="light|dark|system"`
- `data-theme-resolved="light|dark"`
- `style.colorScheme`

---

## 调用端自定义暗色变量

### CSS 变量覆盖

如果你要覆盖“暗色态”变量，**不要只写 `html.dark`**。在 `system` 模式下，FsusUI 不会强制添加 `.dark`，而是通过媒体查询切换 token。

推荐同时覆盖显式暗色与系统解析后的暗色态：

```css
html.dark,
html[data-theme-resolved='dark'] {
  --el-bg-color: #121214;
  --el-bg-color-page: #09090b;
  --el-bg-color-overlay: rgba(18, 18, 20, 0.88);
  --el-text-color-primary: #f0f0f4;
  --el-text-color-secondary: #a1a1aa;
  --el-border-color: #27272a;
  --el-border-color-light: #3f3f46;
}
```

入口只需要继续引入主主题样式：

```ts
import '@ozwasyd/element-plus/dist/index.css'
import './styles/dark.css'
```

### SCSS 变量覆盖

构建期定制请继续走 `theme-chalk/src/common/var.scss`，直接覆盖 dark map：

```scss
@forward '@ozwasyd/element-plus/theme-chalk/src/common/var.scss' with (
  $colors-dark: (
    'primary': (
      'base': #4b79cc,
    ),
  ),
  $bg-color-dark: (
    'page': #09090b,
    '': #121214,
    'overlay': #16161a,
  ),
  $text-color-dark: (
    'primary': #f0f0f4,
    'regular': #a1a1aa,
    'secondary': #8b8b95,
  )
);
```

然后在你的主题入口中先引入这个变量文件，再引入 FsusUI。

---

## SSR 与首帧一致性

如果你的站点会持久化用户主题选择，推荐：

1. 服务端直接输出 `<html class="dark">` 或 `<html class="light">`
2. 客户端在挂载前调用 `syncThemeMode(storedThemeMode)`
3. Vue 根部再用 `themeMode` 保持运行时状态一致

## 测试与截图脚本

Playwright、人工截图或下游 AGENTS 工具需要强制主题时，不要直接改
`document.documentElement.classList`。使用 FsusUI 提供的测试 helper：

```ts
import { installThemeModeTestHelper } from '@ozwasyd/element-plus'

installThemeModeTestHelper({
  persist: true,
  storageKey: 'fsus.ui.themeMode',
})
```

安装后浏览器脚本可以调用：

```ts
await page.evaluate(() => {
  window.__fsusUiThemeMode?.set('dark')
})
```

helper 会复用 `syncThemeMode()`，同步 `<html>` 的 class、`data-theme-mode`、
`data-theme-resolved` 和 `color-scheme`，并按需写入指定 storage key。

这样可以避免“用户已选亮色，但系统是暗色，首帧仍短暂闪黑”的问题。

---

## 设计基线

FsusUI 暗色模式仍遵循 [design.md](../design.md) 的同一套视觉语言：

- 背景基线：`#121214` / `#09090B`
- 主文本：`#F0F0F4`
- 次文本：`#A1A1AA`
- 强调色：学术蓝在暗色下提升为 `#4B79CC`
- 浮层：深色半透明背景配合 `backdrop-filter: blur(40px)`
