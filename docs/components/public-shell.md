# PublicShell 公共页面外壳

`ElPublicShell` 提供面向公开站点的基础 shell 布局：desktop nav、显式 mobile navigation、primary row、brand/nav/actions 间距、mobile primary actions、search 宽度与 reduced-motion 基线都由 FsusUI 维护。

`active-nav-motion="indicator"` 可为 desktop nav 启用组件自有的 active indicator。默认 `none` 保持原有静态 active 颜色和下划线；启用后 indicator 通过组件内部测量写入 CSS 变量，不要求业务侧使用 `:deep()` 覆盖内部 class，并在 `prefers-reduced-motion: reduce` 下取消移动过渡。移动端由 `mobile-nav-mode` 显式选择形态；只有 `bottom` 使用 `FsuBottomTabBar` 的固定底部 active indicator。

需要测量 sticky header 的 consumer 使用稳定的 `[data-public-shell-header]` hook；
不得把 `.el-public-shell__header` 等内部 BEM class 当成应用运行时 API。

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
    mobile-nav-mode="menu"
    mobile-nav-label="主导航"
    mobile-nav-menu-label="菜单"
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
| mobile-nav-mode             | mobile 导航形态                                          | `'inline' \| 'menu' \| 'bottom' \| 'none'` | `menu` |
| mobile-nav-label            | mobile navigation landmark 名称                          | `string`                          | `Primary navigation` |
| mobile-nav-menu-label       | `menu` 模式的 summary 文本                               | `string`                          | `Menu`    |
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
| mobile-nav-gap              | `inline` mobile nav 项目间距                             | `string`                          | `1.5rem`  |
| mobile-search-width         | mobile search width                                      | `string`                          | `7rem`    |

## Slots

| 插槽名                 | 说明                                                                         |
| ---------------------- | ---------------------------------------------------------------------------- |
| default                | 主内容                                                                       |
| brand                  | 品牌区域，替换 `brand` 文本                                                  |
| desktop-search         | desktop 搜索区域                                                             |
| desktop-actions        | desktop 右侧工具区                                                           |
| mobile-primary-actions | mobile 第一行高频工具区，位于品牌右侧，适合 search trigger / theme           |
| mobile-menu-actions    | `menu` 导航面板内的 consumer 次级工具区；组件库不写入业务文案              |
| mobile-search          | mobile 搜索内容；`inline` 时位于 toolbar 内，`trigger` 时位于 primary row 下方 |
| mobile-actions         | legacy mobile 次级工具区，保留兼容                                       |
| footer                 | 页脚                                                                         |
| footer-brand           | 页脚品牌                                                                     |

## Mobile navigation 策略

| 模式 | 输出 | 适用场景 |
| --- | --- | --- |
| `menu` | header 内原生 `details/summary` 菜单；无 JavaScript 也可展开 | 编辑型站点、文档站、文章站；默认 |
| `inline` | header 次级行中的横向链接导航 | 项目少且需要持续可见的移动导航 |
| `bottom` | 固定 `FsuBottomTabBar` | 明确采用 app-like consumer navigation 的 3–5 项主导航 |
| `none` | 不输出 mobile navigation | consumer 完全接管或页面无需移动导航 |

所有模式都保留 desktop navigation。`menu` 与 `inline` 为 active link 写入
`aria-current="page"`，菜单使用原生 summary 键盘语义，并支持 Escape
关闭后把焦点还给 summary。`bottom` 才给 shell 增加
`--fsus-bottom-tab-height + env(safe-area-inset-bottom)` 的底部留白；其他模式
不会为不存在的 fixed dock 预留空间。footer 在窄屏仍保留底部 safe-area。

`mobile-search-mode="trigger"` 使用指向 `search-action` 的原生链接作为触发器：
有 JavaScript 时普通点击按需展开搜索行并把焦点移入输入框，Escape/再次点击关闭并
恢复焦点；无 JavaScript 或修饰键点击时保留原生搜索页导航。折叠状态会显式标记
toolbar 为 `is-collapsed`，不会留下空白次级行。

同一页面不得同时启用 `mobile-nav-mode="bottom"` 和页面级 reading dock。
组件库不猜测 consumer 是否存在另一个 dock；consumer 必须在页面装配层把
两者约束为互斥状态。

## 从旧默认行为迁移

旧版本只要 `nav-items` 非空就会隐式渲染固定 BottomTabBar。现在默认改为
`menu`，这是有意的视觉行为变更：公共文章站不再被默认塑造成 app shell。

- 需要保留旧行为：显式添加 `mobile-nav-mode="bottom"`。
- 需要编辑型移动导航：采用默认 `menu`，并按 consumer 文案传入
  `mobile-nav-label` 与 `mobile-nav-menu-label`。
- 已有自定义移动导航：使用 `mobile-nav-mode="none"`，避免两个全局导航并存。
- 使用 `bottom` 的 consumer 应检查 safe-area、主内容底部留白、active key，
  并确认页面没有 reading dock。

该变更应进入下一个带迁移说明的组件库版本；发布前 consumer 可以通过本地
workspace alias 验证源码，但不得假定未发布 npm 包已经包含新 prop。
