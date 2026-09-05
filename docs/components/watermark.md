# Watermark

Adds a text or image watermark to a page or container.

> See the [Playground](../playground.md) for runnable component examples.

---

## Basic Usage

```vue
<el-watermark content="FsusUI">
  <div style="height: 400px"></div>
</el-watermark>
```

## Multi-Line Watermark

Pass an array of strings to `content` for a multi-line text watermark.

## Image Watermark

Set an image watermark with `image`. Use a 2x/3x asset and specify `width` / `height` to prevent stretching.

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

### Font (Font Options)

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
