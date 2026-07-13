# Icon 图标

FsusUI 图标系统通过 `@ozwasyd/element-plus/icons-vue` 暴露 SVG 图标组件。导入、生成和命名稳定性策略见 [图标系统](../icons.md)。

生成的 FsusUI 线性图标在 SVG 源中携带 `stroke-linejoin="round"`、
`stroke-linecap="round"` 与 token 化描边宽度。基础样式不会修改裸 `svg`；自定义
线性图标需要通过 `<el-icon variant="linear">` 显式启用 scoped cap/join recipe。

> 💡 **运行示例**：启动 demo-app（`pnpm dev`，端口 5173）查看所有可用图标。

---

## 安装

图标包已内置于 FsusUI 主包，通常无需额外安装。

若在独立项目中使用：

```bash
pnpm install @ozwasyd/element-plus
```

## 全量注册图标

```ts
// main.ts
import * as FsusIconsVue from '@ozwasyd/element-plus/icons-vue'

const app = createApp(App)
for (const [key, component] of Object.entries(FsusIconsVue)) {
  app.component(key, component)
}
```

> **注意**：HTML 原生标签 `<menu>` 与图标名 `Menu` 冲突，注册后需使用别名。

---

## 基础用法

使用 `<el-icon>` 包裹 SVG 图标组件，可以统一控制大小和颜色：

```vue
<template>
  <el-icon :size="20" color="#2A599C">
    <Edit />
  </el-icon>
  <!-- 也可直接使用 SVG 图标，不继承父级属性 -->
  <Edit style="width: 1em; height: 1em;" />
</template>

<script setup lang="ts">
import { Edit } from '@ozwasyd/element-plus/icons-vue'
</script>
```

## 加载动画

为 `<el-icon>` 添加 `is-loading` class，图标会自动 360° 旋转：

```vue
<template>
  <el-icon class="is-loading">
    <Loading />
  </el-icon>
</template>
```

---

## API

### Attributes

| 属性名 | 说明                     | 类型               | 默认值                 |
| ------ | ------------------------ | ------------------ | ---------------------- |
| color  | SVG 图标的 fill 颜色     | `string`           | 继承自父元素 color     |
| size   | SVG 图标大小（宽高相等） | `number \| string` | 继承自父元素 font-size |
| variant | SVG paint geometry scope | `'inherit' \| 'linear'` | `'inherit'` |

### Slots

| 插槽名  | 说明          |
| ------- | ------------- |
| default | 图标 SVG 组件 |
