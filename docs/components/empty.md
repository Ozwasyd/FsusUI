# Empty 空状态

`ElEmpty` 用于没有数据、没有匹配结果或尚未创建内容的状态。空状态首先要回答两件事：

1. 为什么这里没有内容；
2. 用户接下来可以做什么。

默认插画是安静的单色文档结构，只作位置提示。它不承担状态含义，也不应替代明确的
说明和下一步操作。

> 💡 **运行示例**：启动 demo-app（`pnpm dev`，端口 5173）查看交互效果。

## 基础用法

```vue
<el-empty description="当前筛选条件没有匹配结果，请调整筛选条件。">
  <el-button>清除筛选</el-button>
</el-empty>
```

避免只写“暂无数据”。说明原因，并在用户能继续操作时提供一个明确动作；如果没有可执行
动作，应在描述中解释原因，不要用大插画填补空间。

## 何时不用插画

紧凑列表、表格、抽屉和局部筛选结果优先使用
[`FsusEmptyState size="inline"`](./empty-state.md)，其默认不显示插画。页面标题、说明和
周边结构已经足够明确时，也应避免额外插画。

`ElEmpty` 的默认图形无渐变、无动画、无品牌色发光，并设置 `aria-hidden="true"`；状态
含义始终由文本表达。

## 自定义图片

通过 `image` 属性设置自定义图片 URL，`image-size` 控制图片宽度（px）。属性图片按装饰
内容处理，渲染为 `alt=""` 和 `aria-hidden="true"`。需要自行控制可访问语义或使用自定义
结构时，改用 `image` slot。

```vue
<el-empty
  image="/images/archive-empty.svg"
  :image-size="96"
  description="归档中还没有文档，请先导入一个文件。"
>
  <el-button>导入文档</el-button>
</el-empty>
```

## 自定义插槽

`image`、`description` 和默认 slot 均保持可用。自定义装饰图同样应设置
`aria-hidden="true"`，附近的文本负责解释状态。

```vue
<el-empty>
  <template #image>
    <span class="archive-mark" aria-hidden="true" />
  </template>
  <template #description>
    尚未创建归档。创建后可在这里集中查看历史文档。
  </template>
  <el-button type="primary">创建归档</el-button>
</el-empty>
```

## API

### Attributes

| 属性名 | 说明 | 类型 | 默认值 |
|--------|------|------|--------|
| image | 装饰图片 URL | `string` | `''` |
| image-size | 图片宽度（px） | `number` | — |
| description | 说明原因与下一步的文字 | `string` | `''` |
| description-layout | 说明区域宽度预设 | `'default' \| 'narrow' \| 'wide'` | `'default'` |
| description-width | 自定义说明区域最大宽度 | `string \| number` | — |

### Slots

| 插槽名 | 说明 |
|--------|------|
| default | 底部操作区域 |
| image | 自定义装饰或图片区域 |
| description | 自定义说明文字 |

## 视觉与回归契约

- 默认 `ElEmpty` 使用单色文档结构，不包含 orbit、node、glow、渐变或动画。
- `FsusEmptyState` 的 inline / compact 默认无插画；page 默认仅显示小型文档标记。
- `empty-illustration.spec.ts` 对 default / inline / compact / page 分别保存 Light 与 Dark
  快照，并核验装饰语义。
- 组件测试锁定自定义图片、`image-size`、`image` / `description` / default slots API。
