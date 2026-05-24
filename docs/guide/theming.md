# 主题定制

FsusUI 采用 **"The Intellectual Minimalist（高智感极简主义）"** 设计语言。完整设计规范见 [design.md](../design.md)。

我们支持两种方式定制主题：**CSS 变量覆盖** 和 **SCSS 变量覆盖**。

---

## FsusUI 设计规范色彩

在覆盖前，请了解 FsusUI 的核心调色板：

| 色彩 | 变量 | Hex | 用途 |
|------|------|-----|------|
| 核心黑（墨） | `--el-color-black` | `#0F0F11` | 主要文本、主色按钮 |
| 核心白（纸） | `--el-bg-color` | `#FCFCFC` | 主背景 |
| 浅灰背景 | `--el-bg-color-page` | `#F7F7F8` | 页面级背景 |
| 品牌灰（点） | `--el-text-color-secondary` | `#A1A1AA` | 次要文本、禁用状态 |
| **强调色（学术蓝）** | `--el-color-primary` | `#2A599C` | 链接、焦点环、激活 Tab、按钮 Hover |
| 边框 | `--el-border-color` | `#E4E4E7` | 输入框、卡片边框 |

> **重要设计约束**：强调色 `#2A599C` 仅限用于功能性 UX 反馈（链接、焦点环、激活状态），**禁止用于纯装饰**。高饱和度颜色、渐变霓虹色在 FsusUI 中明确禁止。详见 [设计规范](../design.md)。

---

## 通过 CSS 变量覆盖（推荐）

CSS 变量方式不需要重新编译，可在运行时动态切换。

### 全局覆盖

```css
:root {
  --el-color-primary: #2A599C;
  --el-bg-color: #FCFCFC;
  --el-bg-color-page: #F7F7F8;
  --el-border-radius-base: 8px;
  --el-border-radius-large: 24px;
}
```

### 局部覆盖（推荐方式，性能更佳）

```css
.my-container {
  --el-color-primary: #2A599C;
  --el-border-radius-base: 8px;
}
```

### 通过脚本动态修改

```ts
const el = document.documentElement
// 读取 CSS 变量
getComputedStyle(el).getPropertyValue('--el-color-primary')
// 修改 CSS 变量
el.style.setProperty('--el-color-primary', '#2A599C')
```

或使用 VueUse 的 [`useCssVar`](https://vueuse.org/core/usecssvar/)。

---

## 通过 SCSS 变量覆盖

SCSS 变量在**构建阶段**生效，适合需要深度定制的场景。

SCSS 变量文件路径：`packages/theme-chalk/src/common/var.scss`

### 步骤 1：创建自定义变量文件

```scss
/* styles/element/index.scss */
@forward '@ozwasyd/element-plus/theme-chalk/src/common/var.scss' with (
  $colors: (
    'primary': (
      'base': #2A599C,  /* FsusUI 学术蓝 */
    ),
  )
);
```

### 步骤 2：在入口文件中引入

```ts
// main.ts
import { createApp } from 'vue'
import './styles/element/index.scss'  /* 放在 @ozwasyd/element-plus 之前 */
import ElementPlus from '@ozwasyd/element-plus'
import App from './App.vue'

const app = createApp(App)
app.use(ElementPlus)
```

### 步骤 3（按需引入时）：配置 Vite

```ts
// vite.config.ts
import path from 'path'
import { defineConfig } from 'vite'
import ElementPlus from 'unplugin-element-plus/vite'

export default defineConfig({
  resolve: {
    alias: { '~/': `${path.resolve(__dirname, 'src')}/` },
  },
  css: {
    preprocessorOptions: {
      scss: {
        api: 'modern-compiler',
        additionalData: `@use "~/styles/element/index.scss" as *;`,
      },
    },
  },
  plugins: [
    ElementPlus({ useSource: true }),
  ],
})
```

> **提示**：将 `styles/element/index.scss`（变量文件）与组件自身 SCSS 分开存放，避免热更新时重复编译大量 SCSS 文件导致速度下降。

---

## FsusUI 核心设计 Token 参考

以下为 FsusUI 覆写的主要 CSS 变量（对照 element-plus 原始值）：

### 圆角体系

| 变量 | FsusUI 值 | 用途 |
|------|-----------|------|
| `--el-border-radius-small` | `6px` | Checkbox、小型控件 |
| `--el-border-radius-base` | `8px` | 输入框、按钮 |
| `--el-border-radius-large` | `24px` | Dialog、Card、Drawer、Popover |
| `--el-border-radius-round` | `999px` | Badge、胶囊型标签 |

### 阴影体系

```css
:root {
  /* 微阴影：带顶部内反光 */
  --el-box-shadow-light: 0 32px 64px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.8);
  /* 浮动面板阴影 */
  --el-box-shadow: 0 16px 48px rgba(0, 0, 0, 0.10), inset 0 1px 0 rgba(255, 255, 255, 0.8);
}
```

### 毛玻璃（浮动层）

FsusUI 的 Dialog、Drawer、Select Dropdown 均使用毛玻璃效果：

```css
/* backdrop-filter 需在浮动容器上应用 */
backdrop-filter: blur(40px) saturate(120%);
background: rgba(255, 255, 255, 0.75);
```

---

## 更多资源

- [暗色模式](./dark-mode.md) — 暗色变量覆盖
- [自定义命名空间](./namespace.md) — 修改 CSS 类名前缀
- [设计规范](../design.md) — 完整的 FsusUI 设计语言文档
