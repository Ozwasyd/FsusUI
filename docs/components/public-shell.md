# PublicShell 公共页面外壳

`ElPublicShell` 提供面向公开站点的基础 shell 布局：desktop/mobile nav 显隐、primary row、brand/nav/actions 间距、mobile primary actions、mobile nav 横向滚动、search 宽度与 reduced-motion 基线都由 FsusUI 维护。

`active-nav-motion="indicator"` 可为 desktop/mobile nav 启用组件自有的 active indicator。默认 `none` 保持原有静态 active 颜色和下划线；启用后 indicator 通过组件内部测量写入 CSS 变量，不要求业务侧使用 `:deep()` 覆盖内部 class，并在 `prefers-reduced-motion: reduce` 下取消移动过渡。

当同时传入 `auth-label` 与 `auth-href` 时，`ElPublicShell` 会在 desktop actions 与 mobile primary actions 中各渲染一份默认账户入口，并保留 `data-public-nav="auth"`。如果业务完全自定义移动端账户入口，可将 `auth-label` 或 `auth-href` 置空并通过 slot 接管。

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

| 属性名                      | 说明                                                     | 类型                              | 默认值    |
| --------------------------- | -------------------------------------------------------- | --------------------------------- | --------- |
| brand                       | 品牌文本                                                 | `string`                          | `''`      |
| brand-href                  | 品牌链接                                                 | `string`                          | `/`       |
| nav-items                   | 导航项                                                   | `PublicShellNavItem[]`            | `[]`      |
| active-nav                  | 当前导航 key                                             | `string`                          | `''`      |
| active-nav-motion           | active nav 运动形态                                      | `'none' \| 'indicator'`           | `none`    |
| auth-label                  | 账户入口文本                                             | `string`                          | `''`      |
| auth-href                   | 账户入口链接                                             | `string`                          | `''`      |
| search-action               | 搜索表单 action                                          | `string`                          | `/search` |
| search-name                 | 搜索字段名                                               | `string`                          | `q`       |
| search-query                | 搜索值                                                   | `string`                          | `''`      |
| search-placeholder          | 搜索占位文本                                             | `string`                          | `Search`  |
| search-aria-label           | 搜索 aria label                                          | `string`                          | `Search`  |
| show-search                 | 是否渲染搜索控件                                         | `boolean`                         | `true`    |
| mobile-search-mode          | mobile 搜索形态                                          | `'inline' \| 'trigger' \| 'none'` | `inline`  |
| mobile-search-trigger-label | trigger 关闭前的按钮文本；为空时使用 `search-aria-label` | `string`                          | `''`      |
| mobile-search-cancel-label  | trigger 展开后的关闭按钮文本                             | `string`                          | `Cancel`  |
| spa-search                  | 是否用事件接管搜索提交                                   | `boolean`                         | `false`   |
| sticky                      | header 是否 sticky                                       | `boolean`                         | `true`    |
| max-width                   | shell 最大宽度                                           | `string`                          | `64rem`   |
| nav-gap                     | desktop brand/nav gap                                    | `string`                          | `2rem`    |
| mobile-nav-gap              | mobile nav item gap                                      | `string`                          | `1.5rem`  |
| mobile-search-width         | mobile search width                                      | `string`                          | `7rem`    |

## Slots

| 插槽名                 | 说明                                                                         |
| ---------------------- | ---------------------------------------------------------------------------- |
| default                | 主内容                                                                       |
| brand                  | 品牌区域，替换 `brand` 文本                                                  |
| desktop-search         | desktop 搜索区域                                                             |
| desktop-actions        | desktop 右侧工具区                                                           |
| mobile-primary-actions | mobile 第一行高频工具区，位于品牌右侧，适合 search trigger / theme           |
| mobile-search          | mobile 搜索内容；`inline` 时位于 nav 下方，`trigger` 时位于 primary row 下方 |
| mobile-actions         | legacy mobile 次级工具区，保留兼容；渲染在 mobile nav 下方                   |
| footer                 | 页脚                                                                         |
| footer-brand           | 页脚品牌                                                                     |
