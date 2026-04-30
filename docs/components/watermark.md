# Watermark 水印

在页面或容器上添加特定文字或图案水印。

> 💡 **运行示例**：启动 demo-app（`pnpm dev`，端口 5173）查看交互效果。

---

## 基础用法

```vue
<el-watermark content="FsusUI">
  <div style="height: 400px"></div>
</el-watermark>
```

## 多行水印

`content` 传入字符串数组即可实现多行文字水印。

## 图片水印

通过 `image` 设置图片水印。建议使用 2x/3x 分辨率图片，并指定 `width`/`height` 防止拉伸。

---

## API

### Attributes

| 属性名 | 说明 | 类型 | 默认值 |
|--------|------|------|--------|
| width | 水印宽度（`content` 时默认为文字宽度） | `number` | `120` |
| height | 水印高度（`content` 时默认为文字高度） | `number` | `64` |
| rotate | 水印旋转角度（°） | `number` | `-22` |
| z-index | 水印元素层级 | `number` | `9` |
| image | 图片水印地址（优先于 `content`） | `string` | — |
| content | 文字水印内容（支持字符串或字符串数组） | `string \| string[]` | `Element Plus` |
| font | 文字样式配置 | `Font` | 见下表 |
| gap | 水印间距 `[水平, 垂直]` | `[number, number]` | `[100, 100]` |
| offset | 水印偏移量（默认为 `gap/2`） | `[number, number]` | `[gap[0]/2, gap[1]/2]` |

### Font（字体配置）

| 属性名 | 说明 | 类型 | 默认值 |
|--------|------|------|--------|
| color | 字体颜色 | `string` | `rgba(0,0,0,.15)` |
| fontSize | 字体大小 | `number \| string` | `16` |
| fontWeight | 字体粗细 | `'normal' \| 'bold' \| 'lighter' \| 'bolder' \| number` | `normal` |
| fontFamily | 字体族 | `string` | `sans-serif` |
| fontStyle | 字体样式 | `'none' \| 'normal' \| 'italic' \| 'oblique'` | `normal` |
| textAlign | 文字对齐 | `'left' \| 'right' \| 'center' \| 'start' \| 'end'` | `center` |
| textBaseline | 文字基线 | `'top' \| 'hanging' \| 'middle' \| 'alphabetic' \| 'ideographic' \| 'bottom'` | `hanging` |

### Slots

| 插槽名 | 说明 |
|--------|------|
| default | 需要添加水印的容器内容 |
