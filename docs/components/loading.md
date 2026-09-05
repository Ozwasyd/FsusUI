# Loading

Shows an animation while data loads to provide feedback.

## Public Preview

This preview directive and service follows [API stability](../api-stability.md#stability-levels)
and the shared [theme and motion contracts](../theme/tokens.md). Supply
readable `text`; full-screen loading must keep focus out of blocked content.
Full-screen Loading is a singleton, and the service API requires browser DOM,
so SSR callers must defer it to the client.

> See the [Playground](../playground.md) for runnable component examples.

---

## Container Loading

Use `v-loading` on a container and bind a Boolean to control visibility.

```vue
<div v-loading="loading" style="height: 200px">数据内容</div>
```

## Full-Screen Loading

Add the `.fullscreen` modifier for full-screen loading and `.lock` to disable body scrolling.

```vue
<div v-loading.fullscreen.lock="loading"></div>
```

## Custom Content

Customize loading with `element-loading-text`, `element-loading-background`, `element-loading-spinner` / `element-loading-svg`, and related attributes.

## Service Invocation

```ts
import { ElLoading } from '@ozwasyd/element-plus'

const loadingInstance = ElLoading.service({
  target: '#my-container',
  text: '加载中...',
  background: 'rgba(0, 0, 0, 0.7)',
})

// 关闭
loadingInstance.close()
```

Full-screen Loading is a singleton; repeated calls return the same instance.

---

## API

### Options (Service Parameters)

| 选项名      | 说明                                                     | 类型                         | 默认值          |
| ----------- | -------------------------------------------------------- | ---------------------------- | --------------- |
| target      | 需要覆盖的 DOM 节点（字符串时传入 querySelector 选择器） | `string \| HTMLElement`      | `document.body` |
| body        | 同 `v-loading` 的 `body` 修饰符                          | `boolean`                    | `false`         |
| fullscreen  | 是否全屏                                                 | `boolean`                    | `true`          |
| lock        | 是否禁止 body 滚动                                       | `boolean`                    | `false`         |
| text        | 加载文字（显示在动画下方）                               | `string \| VNode \| VNode[]` | —               |
| spinner     | 自定义 spinner 图标 class                                | `string`                     | —               |
| background  | 遮罩背景颜色                                             | `string`                     | —               |
| customClass | 自定义 class                                             | `string`                     | —               |
| svg         | 自定义 SVG 图标字符串                                    | `string`                     | —               |
| svgViewBox  | SVG viewBox 属性                                         | `string`                     | —               |
| beforeClose | 关闭前的钩子，返回 false 阻止关闭                        | `() => boolean`              | —               |
| closed      | 完全关闭后的回调                                         | `() => void`                 | —               |

### Directives (Directive Options)

| 指令名                       | 说明                 | 类型                        |
| ---------------------------- | -------------------- | --------------------------- |
| v-loading                    | 是否显示加载动画     | `boolean \| LoadingOptions` |
| element-loading-text         | 加载文字             | `string`                    |
| element-loading-spinner      | 自定义 spinner class | `string`                    |
| element-loading-svg          | 自定义 SVG 图标      | `string`                    |
| element-loading-svg-view-box | SVG viewBox          | `string`                    |
| element-loading-background   | 遮罩背景色           | `string`                    |
| element-loading-custom-class | 自定义 class         | `string`                    |
