# PageHeader 页头

如果页面路径较为简单，可以使用页头代替面包屑。

> 💡 **运行示例**：启动 demo-app（`pnpm dev`，端口 5173）查看交互效果。

---

## 基础用法

```vue
<el-page-header title="返回" content="页面标题" @back="goBack" />
```

## 自定义图标

通过 `icon` 属性自定义返回图标；传入空字符串 `""` 可隐藏图标。

## 组合用法

通过各插槽组合使用面包屑、标题、内容、附加操作和主体内容。

```
第一行：breadcrumb 插槽
第二行：icon / title / content / extra 插槽
第三行及以下：default 插槽
```

---

## API

### Attributes

| 属性名 | 说明 | 类型 | 默认值 |
|--------|------|------|--------|
| icon | 图标 | `string \| Component` | `Back` |
| title | 主标题（兼顾无障碍，默认为"返回"） | `string` | `''` |
| content | 内容 | `string` | `''` |

### Events

| 事件名 | 说明 | 回调参数 |
|--------|------|---------|
| back | 点击返回区域时触发 | `() => void` |

### Slots

| 插槽名 | 说明 |
|--------|------|
| icon | 自定义图标 |
| title | 自定义标题 |
| content | 自定义内容区 |
| extra | 自定义右侧附加操作区 |
| breadcrumb | 面包屑导航 |
| default | 主体内容 |
