# PageHeader

For a simple page path, use a page header instead of breadcrumbs.

> See the [Playground](../playground.md) for runnable component examples.

---

## Basic Usage

```vue
<el-page-header title="返回" content="页面标题" @back="goBack" />
```

## Custom Icons

Use `icon` to customize the back icon; pass an empty string `""` to hide it.

## Composed Usage

Use the slots to combine breadcrumbs, a title, content, extra actions, and the main body.

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
