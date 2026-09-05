# SiteHeader

`ElSiteHeader` is a slot-driven site chrome primitive for reusing one header visual and responsive rule set across public sites, authentication pages, and account workspaces.

The component owns structure, styling, focus ring, desktop/mobile regions, and sticky/max-width layout behavior. Consumers provide brand content, navigation, account actions, theme switching, search, and mobile menus through slots.

## Basic Usage

```vue
<template>
  <el-site-header max-width="64rem">
    <template #brand>
      <a href="/">Fsus</a>
    </template>

    <template #desktop-nav>
      <a href="/">首页</a>
      <a href="/archive">归档</a>
    </template>

    <template #desktop-actions>
      <ThemeModeToggle />
    </template>

    <template #mobile-primary-actions>
      <ThemeModeToggle variant="menu-button" />
    </template>
  </el-site-header>
</template>
```

## API

| 属性名         | 说明                  | 类型      | 默认值               |
| -------------- | --------------------- | --------- | -------------------- |
| aria-label     | header landmark label | `string`  | `Site header`        |
| nav-aria-label | desktop nav label     | `string`  | `Primary navigation` |
| sticky         | header 是否 sticky    | `boolean` | `true`               |
| max-width      | header 内容最大宽度   | `string`  | `64rem`              |
| csp-safe       | 禁止 inline max-width 变量并使用静态默认 token | `boolean` | `false` |

## Slots

| 插槽名                   | 说明                                |
| ------------------------ | ----------------------------------- |
| brand                    | 品牌区域                            |
| desktop-nav              | desktop 导航区域                    |
| desktop-actions          | desktop 右侧动作区域                |
| mobile-primary-actions   | mobile 第一行高频动作区域           |
| mobile-overflow-trigger  | mobile 抽屉 / overflow trigger 区域 |
| mobile-secondary-actions | mobile 第二行动作或导航区域         |
