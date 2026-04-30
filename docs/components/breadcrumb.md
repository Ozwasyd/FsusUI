# Breadcrumb 面包屑

显示当前页面的路径，方便用户浏览返回。

> 💡 **运行示例**：启动 demo-app（`pnpm dev`，端口 5173）查看交互效果。

---

## 基础用法

```vue
<el-breadcrumb separator="/">
  <el-breadcrumb-item :to="{ path: '/' }">首页</el-breadcrumb-item>
  <el-breadcrumb-item>活动管理</el-breadcrumb-item>
  <el-breadcrumb-item>活动列表</el-breadcrumb-item>
  <el-breadcrumb-item>活动详情</el-breadcrumb-item>
</el-breadcrumb>
```

## 图标分隔符

通过 `separator-icon` 使用 SVG 图标作为分隔符（会覆盖 `separator`）。

---

## Breadcrumb API

### Breadcrumb Attributes

| 属性名 | 说明 | 类型 | 默认值 |
|--------|------|------|--------|
| separator | 分隔符字符 | `string` | `/` |
| separator-icon | 图标分隔符 | `string \| Component` | — |

### Breadcrumb Slots

| 插槽名 | 说明 | 子组件 |
|--------|------|--------|
| default | 面包屑内容 | `BreadcrumbItem` |

---

## BreadcrumbItem API

### BreadcrumbItem Attributes

| 属性名 | 说明 | 类型 | 默认值 |
|--------|------|------|--------|
| to | 链接目标路由（与 `vue-router` 的 `to` 一致） | `string \| RouteLocationRaw` | `''` |
| replace | 是否不留下历史记录 | `boolean` | `false` |

### BreadcrumbItem Slots

| 插槽名 | 说明 |
|--------|------|
| default | 自定义内容 |
