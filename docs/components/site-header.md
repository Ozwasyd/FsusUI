# SiteHeader 站点头部

`ElSiteHeader` 是 slot 驱动的通用站点 chrome primitive，用于在公开站点、公开认证页、账户工作台等布局中复用同一套 header 视觉与响应式规则。

组件只负责结构、样式、focus ring、desktop/mobile 区域切换和 sticky/max-width 等布局能力；品牌内容、导航、账户动作、主题切换、搜索入口和移动菜单都由调用方通过 slot 提供。

## 基础用法

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
