# Icon

FsusUI exposes SVG icon components through `@ozwasyd/element-plus/icons-vue`. See the [icon system](../icons.md) for import, generation, and naming stability rules.

Generated FsusUI linear icons carry `stroke-linejoin="round"`,
`stroke-linecap="round"`, and a tokenized stroke width in their SVG source. Base
styles do not modify bare `svg`; custom linear icons must explicitly opt into the
scoped cap/join recipe with `<el-icon variant="linear">`.

> See the [Playground](../playground.md) for runnable icon examples.

---

## Installation

The icon package is bundled with the FsusUI main package, so no extra installation is usually needed.

For use in a standalone project:

```bash
pnpm install @ozwasyd/element-plus
```

## Register All Icons

```ts
// main.ts
import * as FsusIconsVue from '@ozwasyd/element-plus/icons-vue'

const app = createApp(App)
for (const [key, component] of Object.entries(FsusIconsVue)) {
  app.component(key, component)
}
```

> **Note:** The native HTML `<menu>` element conflicts with the `Menu` icon name; use an alias after registration.

---

## Basic Usage

Wrap an SVG icon component in `<el-icon>` to control size and color consistently:

```vue
<template>
  <el-icon :size="20" color="var(--fsus-scholarly-blue)">
    <Edit />
  </el-icon>
  <!-- 也可直接使用 SVG 图标，不继承父级属性 -->
  <Edit style="width: 1em; height: 1em;" />
</template>

<script setup lang="ts">
import { Edit } from '@ozwasyd/element-plus/icons-vue'
</script>
```

## Loading Animation

Add the `is-loading` class to `<el-icon>` for an automatic 360° rotation:

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
