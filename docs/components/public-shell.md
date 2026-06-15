# PublicShell 公共页面外壳

`ElPublicShell` 提供面向公开站点的基础 shell 布局：desktop/mobile nav 显隐、primary row、brand/nav/actions 间距、mobile primary actions、mobile nav 横向滚动、search 宽度与 reduced-motion 基线都由 FsusUI 维护。

## Critical CSS

SSR、AOT 或首帧需要稳定 shell 布局时，可以单独引入 critical artifact：

```ts
import '@ozwasyd/element-plus/dist/public-shell-critical.css'
```

完整运行时样式仍来自主 CSS：

```ts
import '@ozwasyd/element-plus/dist/index.css'
```

## 基础用法

```vue
<template>
  <el-public-shell
    brand="FsusBlog"
    max-width="64rem"
    mobile-search-width="7rem"
    nav-gap="2rem"
    mobile-nav-gap="1.5rem"
    :nav-items="navItems"
  >
    <router-view />
  </el-public-shell>
</template>
```

## API

| 属性名              | 说明                   | 类型                   | 默认值    |
| ------------------- | ---------------------- | ---------------------- | --------- |
| brand               | 品牌文本               | `string`               | `''`      |
| brand-href          | 品牌链接               | `string`               | `/`       |
| nav-items           | 导航项                 | `PublicShellNavItem[]` | `[]`      |
| active-nav          | 当前导航 key           | `string`               | `''`      |
| auth-label          | 账户入口文本           | `string`               | `''`      |
| auth-href           | 账户入口链接           | `string`               | `''`      |
| search-action       | 搜索表单 action        | `string`               | `/search` |
| search-name         | 搜索字段名             | `string`               | `q`       |
| search-query        | 搜索值                 | `string`               | `''`      |
| search-placeholder  | 搜索占位文本           | `string`               | `Search`  |
| search-aria-label   | 搜索 aria label        | `string`               | `Search`  |
| show-search         | 是否渲染搜索控件       | `boolean`              | `true`    |
| spa-search          | 是否用事件接管搜索提交 | `boolean`              | `false`   |
| sticky              | header 是否 sticky     | `boolean`              | `true`    |
| max-width           | shell 最大宽度         | `string`               | `64rem`   |
| nav-gap             | desktop brand/nav gap  | `string`               | `2rem`    |
| mobile-nav-gap      | mobile nav item gap    | `string`               | `1.5rem`  |
| mobile-search-width | mobile search width    | `string`               | `7rem`    |

## Slots

| 插槽名                 | 说明                                                                 |
| ---------------------- | -------------------------------------------------------------------- |
| default                | 主内容                                                               |
| brand                  | 品牌区域，替换 `brand` 文本                                          |
| desktop-search         | desktop 搜索区域                                                     |
| desktop-actions        | desktop 右侧工具区                                                   |
| mobile-primary-actions | mobile 第一行高频工具区，位于品牌右侧，适合 search trigger / theme   |
| mobile-search          | legacy mobile 搜索区域，保留兼容；新公共阅读页优先用 trigger 形态    |
| mobile-actions         | legacy mobile 次级工具区，保留兼容；渲染在 mobile nav 下方           |
| footer                 | 页脚                                                                 |
| footer-brand           | 页脚品牌                                                             |
