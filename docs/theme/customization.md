# Theme Customization

FsusUI supports runtime CSS variable overrides and build-time SCSS overrides.
Runtime CSS variables are the default recommendation for public-preview
consumers because they are easy to scope, test, and revert.

## Core Color Tokens

| Token                       | Default role                   | Override guidance                                                                   |
| --------------------------- | ------------------------------ | ----------------------------------------------------------------------------------- |
| `--el-color-primary`        | Primary action and focus color | Keep enough contrast for text, focus rings, selected states, and icon-only buttons. |
| `--fsus-scholarly-blue`     | FsusUI semantic accent alias   | Use as a semantic alias when product copy refers to the FsusUI accent.              |
| `--el-bg-color`             | Main surface background        | Keep paired with text and border tokens.                                            |
| `--el-bg-color-page`        | Page background                | Use for app shells and full-page surfaces.                                          |
| `--el-text-color-primary`   | Main text                      | Must remain readable on `--el-bg-color`.                                            |
| `--el-text-color-secondary` | Secondary text                 | Avoid using it for required form labels when contrast becomes weak.                 |
| `--el-border-color`         | Default border                 | Keep visible against both page and surface backgrounds.                             |

## Radius Tokens

| Token                      | Default role                                       |
| -------------------------- | -------------------------------------------------- |
| `--el-border-radius-small` | Compact controls and small affordances.            |
| `--el-border-radius-base`  | Buttons, inputs, and ordinary controls.            |
| `--el-border-radius-large` | Larger panels when documented by a component.      |
| `--el-border-radius-round` | Circular buttons, pills, badges, and rounded tags. |

## Spacing Tokens

FsusUI exposes a small spacing ladder for product-level layout alignment:

| Token            | Value  |
| ---------------- | ------ |
| `--fsus-space-1` | `4px`  |
| `--fsus-space-2` | `8px`  |
| `--fsus-space-3` | `12px` |
| `--fsus-space-4` | `16px` |
| `--fsus-space-5` | `20px` |
| `--fsus-space-6` | `24px` |
| `--fsus-space-8` | `32px` |

Treat component-private spacing variables as internal unless they are listed in
[`tokens.md`](./tokens.md).

## Shadow And Overlay Tokens

| Token                     | Default role                                                           |
| ------------------------- | ---------------------------------------------------------------------- |
| `--el-box-shadow`         | Panel elevation.                                                       |
| `--el-box-shadow-light`   | Low elevation and small floating surfaces.                             |
| `--el-box-shadow-lighter` | Subtle elevation.                                                      |
| `--el-box-shadow-dark`    | Stronger elevation.                                                    |
| `--fsus-backdrop-blur`    | Dialog, Drawer, Select dropdown, and other supported overlay surfaces. |

## CSS Variable Overrides

Prefer scoping overrides to a product shell or feature root:

```css
.admin-workbench {
  --el-color-primary: #2a599c;
  --el-border-radius-base: 6px;
  --fsus-space-4: 16px;
  --el-box-shadow-light: 0 12px 32px rgba(15, 23, 42, 0.1);
}
```

Global overrides are acceptable for app-wide theming:

```css
:root {
  --el-bg-color: #ffffff;
  --el-bg-color-page: #f7f7f8;
  --el-text-color-primary: #0f0f11;
}
```

## Theme-Chalk Imports

Application installs should import the built CSS:

```ts
import '@ozwasyd/element-plus/dist/index.css'
```

SCSS source imports are public preview only for documented theme-chalk paths.
Use them when your build needs compile-time variable replacement:

```scss
@forward '@ozwasyd/element-plus/theme-chalk/src/common/var.scss' with (
  $colors: (
    'primary': (
      'base': #2a599c,
    ),
  )
);
```

## Safe Override Patterns

- Override public tokens, not component class internals.
- Scope product-specific aliases in the product stylesheet.
- Keep focus, hover, active, disabled, and selected states testable after each
  token change.
- Verify both light and dark themes when changing semantic colors.
- Avoid rewriting component DOM or CSS selectors to create a theme variant.

## Element Plus Variable Compatibility

Element Plus-compatible `--el-*` variables remain the safest compatibility
surface. FsusUI-specific aliases such as `--fsus-scholarly-blue` and
`--fsus-space-*` are public preview tokens only when documented in
[`tokens.md`](./tokens.md).

If an Element Plus variable exists and works for the same purpose, prefer the
Element Plus variable. Add FsusUI aliases only when the product needs a semantic
layer that can survive future visual changes.
> **Material customization:** The default FsusUI material is
> paper/document-first: no backdrop blur, lower surface radii, and border-first
> panels. Opt into glass with `.is-glass` or `[data-fsus-material='glass']`;
> use `[data-fsus-surface='reading']` for article and Markdown surfaces that
> should suppress glow, blur, and trails.
