# Loading 加载

加载数据时显示动画，提升用户体验。

> 💡 **运行示例**：启动 demo-app（`pnpm dev`，端口 5173）查看交互效果。

---

## 容器内加载

在容器元素上使用 `v-loading` 指令，绑定布尔值控制显示。

```vue
<div v-loading="loading" style="height: 200px">数据内容</div>
```

## 全屏加载

添加 `.fullscreen` 修饰符实现全屏加载；添加 `.lock` 修饰符禁用 body 滚动。

```vue
<div v-loading.fullscreen.lock="loading"></div>
```

## 自定义内容

通过 `element-loading-text`、`element-loading-background`、`element-loading-spinner`/`element-loading-svg` 等属性自定义加载样式。

## 服务方式调用

```ts
import { ElLoading } from 'element-plus'

const loadingInstance = ElLoading.service({
  target: '#my-container',
  text: '加载中...',
  background: 'rgba(0, 0, 0, 0.7)',
})

// 关闭
loadingInstance.close()
```

全屏 Loading 是单例，同时调用多次返回同一实例。

---

## API

### Options（服务调用参数）

| 选项名 | 说明 | 类型 | 默认值 |
|--------|------|------|--------|
| target | 需要覆盖的 DOM 节点（字符串时传入 querySelector 选择器） | `string \| HTMLElement` | `document.body` |
| body | 同 `v-loading` 的 `body` 修饰符 | `boolean` | `false` |
| fullscreen | 是否全屏 | `boolean` | `true` |
| lock | 是否禁止 body 滚动 | `boolean` | `false` |
| text | 加载文字（显示在动画下方） | `string \| VNode \| VNode[]` | — |
| spinner | 自定义 spinner 图标 class | `string` | — |
| background | 遮罩背景颜色 | `string` | — |
| customClass | 自定义 class | `string` | — |
| svg | 自定义 SVG 图标字符串 | `string` | — |
| svgViewBox | SVG viewBox 属性 | `string` | — |
| beforeClose | 关闭前的钩子，返回 false 阻止关闭 | `() => boolean` | — |
| closed | 完全关闭后的回调 | `() => void` | — |

### Directives（指令）

| 指令名 | 说明 | 类型 |
|--------|------|------|
| v-loading | 是否显示加载动画 | `boolean \| LoadingOptions` |
| element-loading-text | 加载文字 | `string` |
| element-loading-spinner | 自定义 spinner class | `string` |
| element-loading-svg | 自定义 SVG 图标 | `string` |
| element-loading-svg-view-box | SVG viewBox | `string` |
| element-loading-background | 遮罩背景色 | `string` |
| element-loading-custom-class | 自定义 class | `string` |
