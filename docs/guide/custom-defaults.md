# 自定义默认值

FsusUI 允许在全局层面预设组件 props 的默认值，减少模板中的重复声明。

---

## 基本用法

通过组件的静态方法 `setPropsDefaults` 设置默认值。

> **注意**：默认值设置**仅对声明式组件**生效，且必须在**组件首次渲染前**调用。设置后为全局生效，且组件一旦渲染就不可再更改默认值。

```ts
// main.ts
import { ElButton } from '@ozwasyd/element-plus'

ElButton.setPropsDefaults({
  type: 'primary',
  size: 'small',
})
```

配置后，以下两种写法等价：

```vue
<template>
  <!-- 实际上等同于下面带 props 的写法 -->
  <el-button>确认</el-button>
  <el-button type="primary" size="small">确认</el-button>
</template>
```

---

## 注意事项

> **警告**：不建议对被其他组件内部依赖的基础组件（如 `ElInput`）设置默认值，否则可能影响依赖它的上层组件行为。
>
> 例如，以下配置会导致 `el-autocomplete` 的行为异常：
>
> ```ts
> // ❌ 不推荐
> ElInput.setPropsDefaults({ maxlength: 1 })
> ```

---

## 适用场景

- 统一项目中所有按钮的默认 `size`
- 为表单组件设置统一的 `label-width`
- 全局禁用某类组件的特定功能
