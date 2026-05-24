# 自定义命名空间

FsusUI 的组件 CSS 类名默认以 `el` 为前缀（如 `el-button`、`el-input`）。在特殊场景下（如与其他组件库共存、需要样式隔离），可以自定义命名空间。

---

## 配置命名空间

必须**同时**修改以下两处，否则 CSS 与组件逻辑会不匹配：

### 第一步：配置 `ElConfigProvider`

```vue
<!-- App.vue -->
<template>
  <el-config-provider namespace="ep">
    <!-- 你的应用 -->
  </el-config-provider>
</template>
```

### 第二步：配置 SCSS 变量

创建 `styles/element/index.scss`：

```scss
/* styles/element/index.scss */
@forward '@ozwasyd/element-plus/theme-chalk/src/mixins/config.scss' with (
  $namespace: 'ep'
);
```

在 `vite.config.ts` 中引入：

```ts
// vite.config.ts
export default defineConfig({
  css: {
    preprocessorOptions: {
      scss: {
        api: 'modern-compiler',
        additionalData: `@use "~/styles/element/index.scss" as *;`,
      },
    },
  },
})
```

完成后，所有组件的 CSS 类名前缀将从 `el-` 变为 `ep-`。

---

## 注意事项

- 修改命名空间后，如果使用了 `append-to` 属性，需要相应调整 `#el-popper-container-` 选择器。详见 [SSR 文档](./ssr.md)。
- 命名空间配置必须在 SCSS **构建阶段**完成，不支持运行时动态修改。
