# PublicShell

`ElPublicShell` provides a base shell layout for public sites. FsusUI owns the desktop nav, explicit mobile navigation, primary row, brand/nav/action spacing, mobile primary actions, search width, and reduced-motion baseline.

`active-nav-motion="indicator"` enables the component-owned active indicator for desktop nav. The default `none` preserves the existing static active color and underline; when enabled, the indicator writes CSS variables from internal measurement, so consumers need not override internal classes with `:deep()`, and movement is canceled under `prefers-reduced-motion: reduce`. Mobile shape is chosen explicitly with `mobile-nav-mode`; only `bottom` uses the fixed-bottom active indicator from `FsuBottomTabBar`.

Consumers with strict `style-src-attr 'none'` can enable `csp-safe`. This mode emits no inline layout variables, uses static default tokens, and degrades the active indicator to the existing static underline. Menu enter/leave uses Transition classes and search visibility uses CSS classes, avoiding hydration writes of `style="display:none"`.

`mobile-nav-mode="menu"` retains the no-JavaScript expand behavior of native `<details>/<summary>` and uses interruptible built-in enter/leave motion. On close, the panel completes a lightweight opacity/vertical transition before `open` is cleared; Escape restores summary focus after closing. Under `prefers-reduced-motion: reduce`, state completes immediately with no displacement. Consumers must not override these internal states through `:deep(.el-public-shell__*)` or copy the motion preset.

Consumers that measure the sticky header should use the stable `[data-public-shell-header]` hook;
internal BEM classes such as `.el-public-shell__header` are not application runtime APIs.

When both `auth-label` and `auth-href` are provided, `ElPublicShell` renders an account entry in desktop actions and retains `data-public-nav="auth"`. Default `menu` mode places the mobile account entry in the menu panel, reachable in one step after opening Menu; other mobile modes keep it in the primary row. To fully customize the mobile account entry, leave `auth-label` or `auth-href` empty and take over through a slot.

Desktop search is selected explicitly by `desktop-search-mode`. Default `inline` retains the existing persistent input; `trigger` emits a native link to `search-action` and the component owns the adjacent panel, focus transfer, Escape restoration, outside-pointer close, and reduced-motion behavior; `none` emits no default desktop search. Mobile search remains independently selected by `mobile-search-mode`; the two modes do not open or close each other.

## Critical CSS

When SSR, AOT, or first paint needs a stable shell layout, import the critical artifact separately:

```ts
import '@ozwasyd/element-plus/dist/public-shell-critical.css'
```

The full runtime styles still come from the main CSS:

```ts
import '@ozwasyd/element-plus/dist/fsus.css'
```

## Basic Usage

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

| 属性名                       | 说明                                                       | 类型                                       | 默认值               |
| ---------------------------- | ---------------------------------------------------------- | ------------------------------------------ | -------------------- |
| brand                        | 品牌文本                                                   | `string`                                   | `''`                 |
| brand-href                   | 品牌链接                                                   | `string`                                   | `/`                  |
| nav-items                    | 导航项                                                     | `PublicShellNavItem[]`                     | `[]`                 |
| mobile-nav-mode              | mobile 导航形态                                            | `'inline' \| 'menu' \| 'bottom' \| 'none'` | `menu`               |
| mobile-nav-label             | mobile navigation landmark 名称                            | `string`                                   | `Primary navigation` |
| mobile-nav-menu-label        | `menu` 模式的 summary 文本                                 | `string`                                   | `Menu`               |
| active-nav                   | 当前导航 key                                               | `string`                                   | `''`                 |
| active-nav-motion            | active nav 运动形态                                        | `'none' \| 'indicator'`                    | `none`               |
| auth-label                   | 账户入口文本                                               | `string`                                   | `''`                 |
| auth-href                    | 账户入口链接                                               | `string`                                   | `''`                 |
| search-action                | 搜索表单 action                                            | `string`                                   | `/search`            |
| search-name                  | 搜索字段名                                                 | `string`                                   | `q`                  |
| search-query                 | 搜索值                                                     | `string`                                   | `''`                 |
| search-placeholder           | 搜索占位文本                                               | `string`                                   | `Search`             |
| search-aria-label            | 搜索 aria label                                            | `string`                                   | `Search`             |
| show-search                  | 是否渲染搜索控件                                           | `boolean`                                  | `true`               |
| desktop-search-mode          | desktop 搜索形态                                           | `'inline' \| 'trigger' \| 'none'`          | `inline`             |
| desktop-search-trigger-label | desktop trigger 文本；为空时使用 `search-aria-label`       | `string`                                   | `''`                 |
| mobile-search-mode           | mobile 搜索形态                                            | `'inline' \| 'trigger' \| 'none'`          | `inline`             |
| mobile-search-trigger-label  | trigger 关闭前的按钮文本；为空时使用 `search-aria-label`   | `string`                                   | `''`                 |
| mobile-search-cancel-label   | trigger 展开后的关闭按钮文本                               | `string`                                   | `Cancel`             |
| spa-search                   | 是否用事件接管搜索提交                                     | `boolean`                                  | `false`              |
| sticky                       | header 是否 sticky                                         | `boolean`                                  | `true`               |
| max-width                    | shell 最大宽度                                             | `string`                                   | `64rem`              |
| content-flow                 | 主内容高度策略                                             | `'viewport-stable' \| 'content-driven'`    | `viewport-stable`    |
| nav-gap                      | desktop brand/nav gap                                      | `string`                                   | `2rem`               |
| mobile-nav-gap               | `inline` mobile nav 项目间距                               | `string`                                   | `1.5rem`             |
| mobile-search-width          | mobile search width                                        | `string`                                   | `7rem`               |
| csp-safe                     | 禁止 inline style，使用静态 token 与 class motion fallback | `boolean`                                  | `false`              |

## Slots

| 插槽名                 | 说明                                                                           |
| ---------------------- | ------------------------------------------------------------------------------ |
| default                | 主内容                                                                         |
| brand                  | 品牌区域，替换 `brand` 文本                                                    |
| desktop-search         | desktop 搜索区域                                                               |
| desktop-actions        | desktop 右侧工具区                                                             |
| mobile-primary-actions | mobile 高频工具兼容入口；`menu` 模式自动收纳进 panel，其他模式位于品牌右侧     |
| mobile-menu-actions    | `menu` 导航面板内的 consumer 次级工具区；组件库不写入业务文案                  |
| mobile-search          | mobile 搜索内容；`inline` 时位于 toolbar 内，`trigger` 时位于 primary row 下方 |
| mobile-actions         | legacy mobile 次级工具区，保留兼容                                             |
| footer                 | 页脚                                                                           |
| footer-brand           | 页脚品牌                                                                       |

## Desktop Search Strategy

| 模式      | 输出                                 | 适用场景                         |
| --------- | ------------------------------------ | -------------------------------- |
| `inline`  | header actions 中持续显示 input      | 兼容现有 consumer；默认          |
| `trigger` | 原生搜索链接 + 相邻 disclosure panel | 低噪声公共阅读 shell             |
| `none`    | 不输出默认 desktop search            | 页面无需搜索或 consumer 完全接管 |

The `desktop-search-mode="trigger"` link still navigates to `search-action` without JavaScript, on a modified click, or when activated in a new window. A normal primary-button activation prevents that navigation, opens the panel, and focuses the input; Escape closes it and returns focus to the trigger. Clicking outside the disclosure only closes the panel and does not steal focus from the pointer target. `aria-expanded` and `aria-controls` always reflect current state.

`search-query`, `update:search-query`, `search`, and `spa-search` share one contract across inline and trigger modes. A non-empty controlled query opens the trigger panel so the existing query remains visible. With strict CSP, `csp-safe` manages the closed state with a class and `inert` without writing inline styles. Trigger panel placement, padding, border, radius, shadow, and transition are internal implementation details; consumers must not depend on BEM selectors such as `.el-public-shell__search*`.

The `desktop-search` slot remains a fully custom compatibility entry point. Once provided, the consumer owns its markup/state and `desktop-search-mode` controls only the default content. New migrations should prefer `trigger` instead of copying the disclosure state machine. The component has no separate desktop cancel label: trigger text remains stable and expand/collapse semantics are expressed by `aria-expanded`.

## Main content flow

`content-flow="viewport-stable"` is the default: shell content fills the available viewport and retains the bottom rhythm. Short content-driven pages such as article details and empty states can explicitly use `content-flow="content-driven"`. The component writes `data-content-flow` on its own `main`, while the full/critical theme synchronizes flex and bottom padding.

Consumers must not rewrite shell content layout through `:deep()`, `:has()`, or internal BEM selectors such as `.el-public-shell__main`. Business content may still use its own stable data attributes for page-level minimum-height semantics.

## Mobile Navigation Strategy

| 模式     | 输出                                                         | 适用场景                                              |
| -------- | ------------------------------------------------------------ | ----------------------------------------------------- |
| `menu`   | header 内原生 `details/summary` 菜单；无 JavaScript 也可展开 | 编辑型站点、文档站、文章站；默认                      |
| `inline` | header 次级行中的横向链接导航                                | 项目少且需要持续可见的移动导航                        |
| `bottom` | 固定 `FsuBottomTabBar`                                       | 明确采用 app-like consumer navigation 的 3–5 项主导航 |
| `none`   | 不输出 mobile navigation                                     | consumer 完全接管或页面无需移动导航                   |

All modes retain desktop navigation. `menu` and `inline` set `aria-current="page"` on the active link; the menu uses native summary keyboard semantics and returns focus to summary after Escape closes it. Only `bottom` adds bottom padding of `--fsus-bottom-tab-height + var(--fsus-safe-area-inset-bottom)`; other modes do not reserve space for a nonexistent fixed dock. The footer retains bottom safe-area padding on narrow screens (`max(40px, 24px + var(--fsus-safe-area-inset-bottom))`). The sole source for safe-area and dynamic viewport values is [`docs/theme/tokens.md`](../theme/tokens.md); consumers own document-level `viewport-fit=cover` and must not write `env(safe-area-inset-*)` inside the component.

The default `menu` mode fixes the first row as truncatable brand + Search + Menu. Search and Menu use `--fsus-public-shell-mobile-action-height: 44px`, `12px` horizontal padding, `8px` gap, and `14px / 500` text. The account entry, `mobile-menu-actions`, and compatible `mobile-primary-actions` content all move into the panel; panel actions are at least `44px` high with `16px` horizontal padding. This prevents theme, language, and authentication from becoming three unequal bordered buttons and keeps the brand on one line at 320px or high zoom.

Short landscape viewports (`height <= 520px` and `width > height`) use the existing mobile header regions, including the selected `mobile-nav-mode` and `mobile-search-mode`. The header removes vertical padding and lets the primary and secondary regions share a horizontal row while preserving 44px action targets. Expanded search and explicit inline navigation remain present, with native horizontal navigation scrolling; regions wrap when their actual minimum widths cannot fit. In the compact row, inline links retain their natural widths and can wrap their original labels when constrained; long account labels can also wrap. Search reserves the existing action-width minimum plus its input padding so the native input retains usable content width. Native inline scrolling retains end padding so fractional scroll rounding does not clip the last action target. Desktop links no longer overlap the brand at 150%/200% CSS zoom. Bottom navigation retains its 56px minimum; padding is included in its item box rather than added to that minimum. The 34% chrome criterion can conflict with these minimum targets at sufficiently low heights or when both top and bottom chrome are required. Consumers must measure every selected mode and disclosure state; no state receives a budget exemption. The explicit bottom-tab mode follows the same compact breakpoint; footer safe-area behavior retains its narrow-width contract.

Consumers may override the public `--fsus-public-shell-mobile-action-height`, but not below `44px`, and must not override `.el-public-shell__*` internal BEM selectors. Explicit `inline` mode still uses the shared height; icon-only actions must be at least that token wide, and the account entry remains a text link rather than a segmented-control item.

`mobile-search-mode="trigger"` uses a native link to `search-action` as its trigger. With JavaScript, a normal click expands the search row on demand and focuses the input; Escape or another click closes it and restores focus. Without JavaScript or on a modified click, native search-page navigation is preserved. The collapsed state explicitly marks the toolbar `is-collapsed` and leaves no empty secondary row.

The same page must not enable `mobile-nav-mode="bottom"` and a page-level reading dock together. The library does not guess whether another dock exists; the consumer must enforce mutual exclusion at page assembly.

## Migration from the Previous Default

Existing desktop consumers need no changes; `desktop-search-mode` remains `inline` by default. When migrating a custom low-noise trigger, remove the consumer's open/close state, document pointer listener, Escape/focus restoration, panel markup, transition class, and internal-BEM CSS. Keep only search route/name/query/label and SPA submit semantics. The visible change should be limited to a persistent input becoming a low-noise trigger and the component-owned panel's consistent layout and motion; do not use this migration to change brand, navigation, auth, header height, footer, or result pages.

Previous versions implicitly rendered a fixed BottomTabBar whenever `nav-items` was non-empty. The default is now `menu`, an intentional visual behavior change: public article sites are no longer shaped as app shells by default.

- To retain the old behavior, explicitly add `mobile-nav-mode="bottom"`.
- For an editor-style mobile navigation, use the default `menu` and pass consumer copy through `mobile-nav-label` and `mobile-nav-menu-label`.
- When `menu` is closed, the menu panel and its actions leave the layout and reachable-control set; they appear only after `<details>` opens. This prevents closed content from overflowing at narrow widths or high zoom.
- For an existing custom mobile navigation, use `mobile-nav-mode="none"` to avoid two global navigations.
- Consumers using `bottom` should check safe-area, main-content bottom padding, and active key, and confirm that the page has no reading dock.

This change belongs in the next library version with migration notes. Before release, consumers may verify source through a local workspace alias, but must not assume an unpublished npm package contains the new prop.

## Verification Contract

Component tests lock the desktop `inline | trigger | none` native fallback, modified clicks, controlled query, CSP-safe mode, outside pointer, Escape, and focus restoration. They also lock the DOM/active state of all four mobile navigation strategies and confirm desktop nav is unchanged when the strategy switches.
`public-shell-desktop-search.spec.ts` covers desktop Light/Dark inline/trigger/none and trigger open/closed. `public-shell-mobile-nav.spec.ts` saves independent mobile snapshots for `menu | inline | bottom | none` and verifies native summary keyboard order, the navigation landmark, `aria-current="page"`, BottomTabBar fixed/safe-area/content padding, and that `none` leaves no duplicate navigation landmark. The suite also uses real fixtures for anonymous/authenticated states, long brands, Chinese/English/long-language copy, 320/375/390/768px, Light/Dark, and 150%/200% zoom, measuring 44px hit rectangles, panel padding, optical alignment, horizontal overflow, and the Brand → Search → Menu → panel keyboard order.
