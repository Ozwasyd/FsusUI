# 暗色模式

FsusUI 2026 版内置了两种暗色模式的支持方式：**自动系统级自适应**和**手动切换**。

---

## 如何启用

### 方式一：自动适应系统偏好 (Auto-Adaptation)

**这是最推荐也是最省心的方式。**

从 `v2.0-REWRITE` 开始，FsusUI 默认内置了基于 CSS 媒体查询 `@media (prefers-color-scheme: dark)` 的暗色模式支持。

这意味着：**只要你引入了 FsusUI 的主题 CSS，调用端无需编写任何额外的 JavaScript 代码，组件库即可自动根据用户的操作系统或浏览器的偏好设置，无缝切换明暗模式。**

为了防止自动切换与手动强制覆盖冲突，自动切换仅在 `<html>` 标签上**没有** `.light` 类时生效。

### 方式二：手动切换 (Manual Toggle)

如果你的应用需要提供一个显式的切换开关（例如顶部的明暗模式切换按钮），你可以继续使用手动模式，或者结合 [useDark | VueUse](https://vueuse.org/core/useDark/) 实现。

手动模式的优先级高于系统自适应。在 HTML 根元素添加 `dark` class 强制暗色，或添加 `light` class 强制亮色：

```ts
import { useDark, useToggle } from '@vueuse/core'

// 强制模式切换逻辑
// 注意：使用 useDark 时，它会自动在 html 上添加 'dark' class。
// 如果要彻底覆盖默认系统行为，你可能还需要在关闭暗色时显式添加 'light' class。
const isDark = useDark()
const toggleDark = useToggle(isDark)
```

---

## 自定义暗色变量

### 通过 CSS 覆盖

新建 `styles/dark/css-vars.css`：

```css
html.dark {
  /* 背景 */
  --el-bg-color: #0F0F11;
  --el-bg-color-page: #0A0A0C;
  --el-bg-color-overlay: #1A1A1E;

  /* 文本 */
  --el-text-color-primary: #FCFCFC;
  --el-text-color-secondary: #A1A1AA;

  /* 边框 */
  --el-border-color: #27272A;
  --el-border-color-light: #3F3F46;
}
```

在入口文件中，**在 element-plus 暗色样式之后**引入：

```ts
// main.ts
import 'element-plus/theme-chalk/dark/css-vars.css'
import './styles/dark/css-vars.css'
```

### 通过 SCSS 覆盖

```scss
/* styles/element/index.scss */
@forward 'element-plus/theme-chalk/src/dark/var.scss' with (
  $bg-color: (
    'page': #0A0A0C,
    '': #0F0F11,
    'overlay': #1A1A1E,
  )
);
```

```ts
// main.ts
import './styles/element/index.scss'
```

---

## FsusUI 暗色设计规范

FsusUI 暗色模式遵循与亮色相同的「高智感极简主义」原则：

- **背景**：使用 `#0F0F11`（极深微暖黑），避免纯 `#000000`
- **文本**：主文本使用 `#FCFCFC`，次要文本使用 `#A1A1AA`
- **强调色**：学术蓝 `#2A599C` 在暗色模式下适当调亮至 `#3B6FC2`，维持对比度
- **毛玻璃**：暗色下浮动层使用 `rgba(15, 15, 17, 0.85)` + `backdrop-filter: blur(40px)`

> 详细设计规范见 [design.md](../design.md)。
