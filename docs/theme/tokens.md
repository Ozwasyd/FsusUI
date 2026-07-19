# Theme Token Stability

This document defines the public-preview stability level for theme tokens.
FsusUI keeps Element Plus CSS variables as the compatibility base and layers
FsusUI semantic aliases on top.

## Stability Levels

| Level                | Meaning                                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------- |
| Preview public token | Documented token intended for app-level overrides during public preview.                    |
| Experimental token   | Documented token for early integration work. Values and names can change in minor releases. |
| Internal token       | Component-private or undocumented token. Do not rely on it from an app stylesheet.          |

## Preview Public Tokens

| Token                              | Purpose                                                                               |
| ---------------------------------- | ------------------------------------------------------------------------------------- |
| `--el-color-primary`               | Element Plus interaction primary mapped to Scholarly Blue.                            |
| `--fsus-scholarly-blue`            | Accent for links, active states, focus rings, and selection.                          |
| `--fsus-button-primary-bg`         | Primary button background mapped to Ink independently from the interaction primary.   |
| `--fsus-button-primary-text`       | Primary button text mapped to Paper for light/dark contrast.                          |
| `--el-bg-color`                    | Main surface background.                                                              |
| `--el-bg-color-page`               | Page background.                                                                      |
| `--el-text-color-primary`          | Primary text.                                                                         |
| `--el-text-color-secondary`        | Secondary text.                                                                       |
| `--fsus-color-text-quiet`          | Readable low-emphasis text; `#71717A` in light mode and `#A1A1AA` in dark mode.       |
| `--fsus-color-text-decorative`     | Non-essential ornamental marks; switches from `#A1A1AA` to `#71717A` in dark mode.    |
| `--fsus-color-surface-raised`      | Raised and inline-code surfaces; switches from `#F7F7F8` to `#1A1A1E` in dark mode.   |
| `--fsus-dot-gray`                  | Compatibility alias for `--fsus-color-text-decorative`; also feeds `--el-color-info`. |
| `--el-border-color`                | Default border color.                                                                 |
| `--fsus-border-light`              | Light border step mapped to the canonical `color.border.light` token.                 |
| `--fsus-border-lighter`            | Lighter border step mapped to the canonical `color.border.lighter` token.             |
| `--fsus-border-extra-light`        | Extra-light border step mapped to the canonical `color.border.extra.light` token.     |
| `--fsus-surface-overlay`           | Opaque overlay content surface; distinct from the backdrop scrim.                     |
| `--el-border-radius-small`         | Small radius token.                                                                   |
| `--el-border-radius-base`          | Base radius token.                                                                    |
| `--el-border-radius-large`         | Large radius token.                                                                   |
| `--el-border-radius-round`         | Fully rounded token for circular controls.                                            |
| `--el-box-shadow`                  | Border-first panel shadow, defaulting to `none`.                                      |
| `--el-box-shadow-light`            | Opt-in low elevation shadow.                                                          |
| `--fsus-shadow-panel-light`        | Canonical low-elevation panel and compact-message shadow.                             |
| `--fsus-motion-distance-sm`        | Small motion distance alias (`8px`).                                                  |
| `--fsus-motion-distance-md`        | Medium motion distance alias (`14px`).                                                |
| `--fsus-motion-distance-lg`        | Large motion distance alias (`20px`).                                                 |
| `--fsus-motion-intensity-standard` | Standard motion intensity (`0.96`).                                                   |
| `--fsus-motion-intensity-subtle`   | Subtle motion intensity (`0.98`).                                                     |
| `--fsus-backdrop-blur`             | Opt-in backdrop blur amount, defaulting to `0px`.                                     |

### Spacing Tokens

| Token            | Value  | Purpose                         |
| ---------------- | ------ | ------------------------------- |
| `--fsus-space-1` | `4px`  | Tight inline spacing.           |
| `--fsus-space-2` | `8px`  | Compact control spacing.        |
| `--fsus-space-3` | `12px` | Small group spacing.            |
| `--fsus-space-4` | `16px` | Default section rhythm.         |
| `--fsus-space-5` | `20px` | Medium panel rhythm.            |
| `--fsus-space-6` | `24px` | Large panel rhythm.             |
| `--fsus-space-8` | `32px` | Page and modal outer breathing. |

These tokens are safe for application-level overrides when the value type stays
compatible with CSS usage in the component styles.

## Generated Cross-Platform Tokens

The platform-neutral token source is
[`spec/tokens/tokens.json`](../../spec/tokens/tokens.json). Run
`pnpm run tokens:generate` after changing that source. The generator emits:

- Web CSS variables, SCSS maps, and JSON metadata under
  `vue/packages/theme-chalk/src/generated/`
- Avalonia resources under `dotnet/FsusUI.Avalonia.Themes/Generated/`
- C# token constants under `dotnet/FsusUI.Avalonia/Generated/`
- generated token documentation at
  [`docs/theme/generated/tokens.md`](./generated/tokens.md)
- checksums at `generated/tokens.hash.json`

`pnpm run tokens:check` fails when any generated artifact is stale, and
`pnpm run tokens:lint` validates naming, required platform mappings,
references, aliases, and generated-file metadata. Web and Avalonia consumers
must use the generated artifacts rather than manually mirroring token values.

The precedence is canonical spec → checked design documentation → generated
Web/Avalonia output → registered platform override → compatibility adapter.
Generated files never become a source of truth. Every platform difference must
be recorded under `spec/platform-overrides/` with a reason, owner, test policy,
and review date.

Stable typography uses only the bundled `400`, `500`, and `700` faces declared
in `spec/typography/baseline.json`. The demo loads those exact weights for both
Google Sans and Noto Sans SC; stable component CSS may not request an
undeclared weight or rely on browser synthesis.

```css
:root {
  --el-color-primary: var(--fsus-scholarly-blue);
  --fsus-scholarly-blue: #2a599c;
  --fsus-button-primary-bg: var(--fsus-ink);
  --fsus-button-primary-text: var(--fsus-paper);
  --fsus-radius-control: 6px;
  --fsus-radius-control-small: 4px;
  --fsus-radius-panel: 12px;
  --el-border-radius-base: 6px;
  --fsus-backdrop-blur: 0px;
  --fsus-shadow-panel: var(--fsus-shadow-overlay-md);
}
```

## Experimental Tokens

Component-specific `--fsus-*` tokens that control a single component's timing,
spacing, emphasis, or state treatment are experimental until promoted here.
Examples include:

- `--fsus-calendar-cell-duration`
- `--fsus-calendar-view-duration`
- component-private density or surface tokens
- Markdown renderer internal syntax and code block tokens

Experimental tokens can be useful for FsusBlog or product-specific integration
work, but they require release-note review before public npm promotion.

## Internal Tokens

The following are internal unless another guide explicitly documents them:

- Sass map keys and mixin implementation details.
- Component-private CSS variables not listed in this file.
- Unlisted `--fsus-*` tokens.
- Generated theme metadata.
- Selector structure inside component styles.

ColorPicker chrome aliases such as `--fsus-color-picker-thumb-bg`,
`--fsus-color-picker-thumb-border`, and `--fsus-color-picker-thumb-shadow` are
intentionally internal. They remain available to component styles, but their
fallbacks must reference registered canonical surface, border, and shadow
tokens rather than introducing a second value source.

FsusUI generates only the canonical `light` and `dark` Web theme presets.
Operating-system high-contrast support remains a platform accessibility
override and must not become a third canonical token mode.

## Element Plus Variable Compatibility

Element Plus-compatible `--el-*` variables remain the preferred customization
path for shared component behavior. FsusUI may add semantic aliases, but those
aliases should point back to documented `--el-*` variables or be listed here
before they are used in external apps.

## FsusBlog Semantic Aliases

FsusBlog and other product integrations can define product-level aliases such
as `--blog-reading-surface` or `--blog-accent`. Keep those aliases in the
product stylesheet and map them to FsusUI public-preview tokens rather than
depending on component-private variables.

> **Material default:** Backdrops default to `0px` blur. Use `.is-glass` or
> `[data-fsus-material='glass']` when a surface intentionally needs glass
> material. Reading surfaces can use `[data-fsus-surface='reading']` to disable
> blur, glow, and motion trails.
