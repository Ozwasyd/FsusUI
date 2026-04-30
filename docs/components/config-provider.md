# ConfigProvider 全局配置

用于提供全局配置，使整个应用可统一访问这些配置项。

> 💡 **运行示例**：启动 demo-app（`pnpm dev`，端口 5173）查看交互效果。

---

## 基础用法

在应用根组件使用 `el-config-provider` 包裹，通过 `locale`、`size` 等属性提供全局配置。

```vue
<el-config-provider :locale="zhCn" size="large">
  <App />
</el-config-provider>
```

## 国际化配置

通过 `locale` 属性提供语言包，详见[国际化指南](../guide/i18n.md)。

## 按钮配置

通过 `button` 属性统一配置按钮组件的默认行为（如是否在双汉字间插入空格）。

## 消息配置

通过 `message` 属性统一配置 Message 组件的行为（如最大显示数量）。

## 空值配置

通过 `empty-values` 设置哪些值视为空值（默认 `['', null, undefined]`）；通过 `value-on-clear` 设置清空时的返回值。

---

## API

### Attributes

| 属性名 | 说明 | 类型 | 默认值 |
|--------|------|------|--------|
| locale | 语言对象 | `{ name: string, el: TranslatePair }` | `en` |
| size | 全局组件尺寸 | `'large' \| 'default' \| 'small'` | `default` |
| z-index | 全局初始层级 | `number` | — |
| namespace | 全局组件 class 前缀（配合主题 CSS 变量） | `string` | `el` |
| button | 按钮组件全局配置，见下表 | `object` | 见下表 |
| link | 链接组件全局配置，见下表 | `object` | 见下表 |
| dialog | 对话框全局配置，见下表 | `object` | 见下表 |
| message | 消息全局配置，见下表 | `object` | 见下表 |
| table | 表格全局配置，见下表 | `object` | 见下表 |
| empty-values | 全局空值列表 | `array` | — |
| value-on-clear | 清空时的返回值 | `string \| number \| boolean \| Function` | — |

### Button 配置

| 属性名 | 说明 | 类型 | 默认值 |
|--------|------|------|--------|
| autoInsertSpace | 两个中文字符之间是否自动插入空格 | `boolean` | `false` |
| type | 默认按钮类型 | `'primary' \| 'success' \| 'warning' \| 'danger' \| 'info'` | — |
| plain | 是否为朴素按钮 | `boolean` | `false` |
| text | 是否为文字按钮 | `boolean` | `false` |
| round | 是否为圆角按钮 | `boolean` | `false` |
| dashed | 是否为虚线按钮 | `boolean` | `false` |

### Link 配置

| 属性名 | 说明 | 类型 | 默认值 |
|--------|------|------|--------|
| type | 链接类型 | `'primary' \| 'success' \| 'warning' \| 'danger' \| 'info' \| 'default'` | `default` |
| underline | 下划线显示时机 | `'always' \| 'hover' \| 'never' \| boolean` | `hover` |

### Dialog 配置

| 属性名 | 说明 | 类型 | 默认值 |
|--------|------|------|--------|
| align-center | 是否水平垂直居中 | `boolean` | `false` |
| draggable | 是否可拖拽 | `boolean` | `false` |
| overflow | 是否允许拖拽超出视口 | `boolean` | `false` |
| transition | 动画过渡配置 | `string \| TransitionProps` | — |

### Message 配置

| 属性名 | 说明 | 类型 | 默认值 |
|--------|------|------|--------|
| max | 同时显示的最大数量 | `number` | — |
| grouping | 相同内容的消息是否合并 | `boolean` | — |
| duration | 显示时长（ms），0 不自动关闭 | `number` | — |
| showClose | 是否显示关闭按钮 | `boolean` | — |
| offset | 距视口顶部的距离 | `number` | — |
| placement | 消息显示位置 | `'top' \| 'top-left' \| 'top-right' \| 'bottom' \| 'bottom-left' \| 'bottom-right'` | — |

### Table 配置

| 属性名 | 说明 | 类型 | 默认值 |
|--------|------|------|--------|
| show-overflow-tooltip | 是否用 tooltip 展示溢出内容 | `boolean \| object` | — |
| tooltip-effect | tooltip 主题 | `'dark' \| 'light'` | `dark` |
| tooltip-options | tooltip 配置项 | `object` | — |
| tooltip-formatter | 自定义 tooltip 内容 | `Function` | — |

### Slots

| 插槽名 | 说明 | 参数 |
|--------|------|------|
| default | 应用内容 | 继承的全局配置对象 |
