# 暗色模式

FsusUI 支持暗色模式，通过 CSS 变量实现，与亮色模式完全解耦。

---

## 如何启用

### 方式一：静态启用

在 HTML 根元素添加 `dark` class：

```html
<html class="dark">
  <head></head>
  <body></body>
</html>
```

### 方式二：动态切换（推荐）

推荐使用 [useDark | VueUse](https://vueuse.org/core/useDark/) 实现响应式切换：

```ts
import { useDark, useToggle } from '@vueuse/core'

const isDark = useDark()
const toggleDark = useToggle(isDark)
```

### 引入暗色样式

无论哪种方式，都需要在入口文件中引入暗色 CSS：

```ts
// main.ts
import 'element-plus/theme-chalk/dark/css-vars.css'
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
