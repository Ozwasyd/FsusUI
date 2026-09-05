# Theme Customization

Use runtime CSS variables for reversible, scoped overrides; use SCSS variables
when values must be replaced at build time. The canonical public names,
stability levels, and current values live in [`tokens.md`](./tokens.md); this
guide keeps only the consumer workflow.

## Public token roles

| Token | Role |
| --- | --- |
| `--el-color-primary` | Primary action and focus color; preserve contrast for text, focus rings, selected states, and icon-only buttons. |
| `--fsus-scholarly-blue` | FsusUI accent alias for links, active states, focus rings, and selection. |
| `--el-bg-color` / `--el-bg-color-page` | Main surface and page backgrounds. |
| `--el-text-color-primary` / `--el-text-color-secondary` | Primary and secondary text; required labels must remain readable. |
| `--el-border-color` | Default border; keep it visible against page and surface backgrounds. |

The public spacing ladder is `--fsus-space-1` (`4px`),
`--fsus-space-2` (`8px`), `--fsus-space-3` (`12px`),
`--fsus-space-4` (`16px`), `--fsus-space-5` (`20px`),
`--fsus-space-6` (`24px`), and `--fsus-space-8` (`32px`). Component-private
spacing remains internal unless listed in [`tokens.md`](./tokens.md).

Supported radius roles are `--el-border-radius-small`,
`--el-border-radius-base`, `--el-border-radius-large`, and
`--el-border-radius-round`. Supported shadow aliases include
`--el-box-shadow`, `--el-box-shadow-light`, `--el-box-shadow-lighter`,
`--el-box-shadow-dark`, and `--fsus-backdrop-blur`.

## Runtime CSS overrides

Prefer a product shell or feature root; use `:root` only for app-wide changes:

```css
.admin-workbench {
  --el-color-primary: #2a599c;
  --el-border-radius-base: 6px;
  --fsus-space-4: 16px;
  --el-box-shadow-light: 0 12px 32px rgba(15, 23, 42, 0.1);
}
```

```css
:root {
  --el-bg-color: #ffffff;
  --el-bg-color-page: #f7f7f8;
  --el-text-color-primary: #0f0f11;
}
```

Load the built stylesheet first:

```ts
import '@ozwasyd/element-plus/dist/fsus.css'
```

Keep focus, hover, active, disabled, and selected states testable in both light
and dark themes after changing semantic colors.

## Build-time SCSS overrides

SCSS source imports are public-preview paths. Use them for compile-time variable
replacement:

```scss
@forward '@ozwasyd/element-plus/theme-chalk/src/common/var.scss' with (
  $colors: (
    'primary': (
      'base': #2a599c,
    ),
  )
);
```

## Safe customization rules

- Prefer the Element Plus-compatible `--el-*` variable when it serves the same
  purpose; add a `--fsus-*` alias only for a durable semantic layer.
- Scope product aliases in the product stylesheet; do not introduce new
  FsusUI contract tokens there. Add public tokens to `spec/tokens/tokens.json`,
  then run `pnpm run tokens:generate`.
- Override public tokens rather than component class internals or private
  variables; do not rewrite component DOM or selectors to create a variant.
- Paper/document material is the default: border-first panels and `0px`
  backdrop blur. Opt into glass with `.is-glass` or
  `[data-fsus-material='glass']`; mark article/Markdown surfaces with
  `[data-fsus-surface='reading']` when they must suppress blur, glow, and trails.
- `--fsus-scholarly-blue` is functional feedback, not decoration; avoid
  gradients and neon colors.

See [`tokens.md`](./tokens.md) for generated cross-platform output and
[`../design.md`](../design.md) for the visual contract.
