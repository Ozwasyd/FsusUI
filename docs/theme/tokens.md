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

| Token                       | Purpose                                                          |
| --------------------------- | ---------------------------------------------------------------- |
| `--el-color-primary`        | Primary action and emphasis color.                               |
| `--fsus-scholarly-blue`     | FsusUI semantic primary alias used by docs and product examples. |
| `--el-bg-color`             | Main surface background.                                         |
| `--el-bg-color-page`        | Page background.                                                 |
| `--el-text-color-primary`   | Primary text.                                                    |
| `--el-text-color-secondary` | Secondary text.                                                  |
| `--el-border-color`         | Default border color.                                            |
| `--el-border-radius-small`  | Small radius token.                                              |
| `--el-border-radius-base`   | Base radius token.                                               |
| `--el-border-radius-large`  | Large radius token.                                              |
| `--el-border-radius-round`  | Fully rounded token for circular controls.                       |
| `--el-box-shadow`           | Default elevation shadow.                                        |
| `--el-box-shadow-light`     | Low elevation shadow.                                            |
| `--fsus-backdrop-blur`      | FsusUI backdrop blur amount for supported overlay surfaces.      |

These tokens are safe for application-level overrides when the value type stays
compatible with CSS usage in the component styles.

```css
:root {
  --el-color-primary: #2a599c;
  --fsus-scholarly-blue: #2a599c;
  --el-border-radius-base: 6px;
  --fsus-backdrop-blur: 12px;
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
