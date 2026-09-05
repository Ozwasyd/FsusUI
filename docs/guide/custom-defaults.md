# Custom Defaults

FsusUI can set component prop defaults globally to remove repeated template
attributes.

## Usage

Call the component's static `setPropsDefaults` method before the component is
first rendered. Defaults apply globally and cannot be changed after that
component has rendered; this API applies to declarative components only.

```ts
// main.ts
import { ElButton } from '@ozwasyd/element-plus'

ElButton.setPropsDefaults({
  type: 'primary',
  size: 'small',
})
```

After configuration, these two forms are equivalent:

```vue
<template>
  <!-- 实际上等同于下面带 props 的写法 -->
  <el-button>确认</el-button>
  <el-button type="primary" size="small">确认</el-button>
</template>
```

## Cautions

Do not set defaults on foundation components used internally by other
components, such as `ElInput`; doing so can change their consumers' behavior.
For example, `ElInput.setPropsDefaults({ maxlength: 1 })` can break
`el-autocomplete`.

## Good fits

- Set a consistent default `size` for project buttons.
- Set a shared `label-width` for form components.
- Disable a specific feature across a component family.
