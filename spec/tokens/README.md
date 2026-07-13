# Token Schema

Tokens use platform-neutral names and mechanical platform mappings. Token v2
adds source layers and mode dimensions so Web and Avalonia can be generated from
one registry without hand-authored value drift.

```txt
category.group.name.variant
```

Examples:

```txt
color.action.primary
radius.control.md
space.3
motion.control.fast
```

## Source Layers

| Layer             | Purpose                                            |
| ----------------- | -------------------------------------------------- |
| `primitive`       | Raw color and measurement decisions                |
| `semantic`        | Product-neutral roles such as text, surface, z     |
| `component`       | Component-level defaults such as padding/radius    |
| `component-state` | State-specific component tokens such as hover fill |

## Mode Dimensions

| Dimension | Required Values            |
| --------- | -------------------------- |
| theme     | light, dark, high-contrast |
| density   | compact, default, spacious |
| motion    | full, reduced, disabled    |

## Required Categories

| Category     | Purpose                                         | Example                        |
| ------------ | ----------------------------------------------- | ------------------------------ |
| `color`      | raw color decisions                             | `color.action.primary`         |
| `brush`      | paint aliases that map to colors                | `brush.surface.base`           |
| `typography` | font size, line height, weight, family          | `typography.body.md.size`      |
| `space`      | layout spacing scale                            | `space.3`                      |
| `thickness`  | border, divider, and outline thickness          | `thickness.focus.md`           |
| `radius`     | corner radius scale                             | `radius.control.md`            |
| `border`     | semantic border aliases                         | `border.control.default`       |
| `shadow`     | elevation and shadow semantics                  | `shadow.overlay.md`            |
| `opacity`    | disabled, muted, overlay, and state opacity     | `opacity.disabled.content`     |
| `z`          | z-index and layer names                         | `z.overlay.dialog`             |
| `motion`     | duration, easing, distance, intensity, stagger  | `motion.duration.control.fast` |
| `density`    | compact, default, and spacious layout modifiers | `density.control.default.y`    |
| `icon`       | icon size, stroke, fill, and semantic treatment | `icon.size.md`                 |

## Token Record

Each token record includes:

| Field             | Required | Description                                     |
| ----------------- | -------- | ----------------------------------------------- |
| `name`            | yes      | platform-neutral dotted token name              |
| `type`            | yes      | token type, such as `color`, `duration`, `size` |
| `value`           | yes      | canonical source value                          |
| `description`     | yes      | intended usage                                  |
| `platforms`       | yes      | supported outputs such as `web` and `avalonia`  |
| `aliases`         | no       | public compatibility aliases                    |
| `modeValues`      | no       | mode-specific value plus fallback token         |
| `semanticMeaning` | no       | unique semantic meaning guard for aliases       |

## Platform Mapping

Mappings are generated mechanically:

| Platform | Example output                          |
| -------- | --------------------------------------- |
| Web CSS  | `--fsus-color-action-primary`           |
| Web SCSS | `$fsus-color-action-primary` or map key |
| JSON     | `{ "color.action.primary": "#2A599C" }` |
| Avalonia | `FsusColorActionPrimary` resource key   |
| C#       | `FsusTokens.ColorActionPrimary`         |

Compatibility aliases such as `--el-color-primary` are allowed only when they
point back to platform-neutral source tokens.

## Source Precedence

1. `spec/tokens/tokens.json` is the canonical platform-neutral source.
2. `docs/design.md` and `docs/theme/tokens.md` are checked human-readable contracts.
3. Web CSS/SCSS/JSON, Avalonia XAML/C#, generated docs, and hashes are generated artifacts.
4. `spec/platform-overrides/*.yaml` may record only unavoidable differences and must include reason, owner, test policy, and review date.
5. Platform adapters and compatibility aliases consume the preceding layers; they never redefine them.

Typography availability is canonical in `spec/typography/baseline.json`.
Stable component styles may use only its `fontWeights.stable` values unless a
declared variable font supplies the requested axis.
