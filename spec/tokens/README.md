# Token Schema

Tokens use platform-neutral names and mechanical platform mappings.

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

| Field         | Required | Description                                     |
| ------------- | -------- | ----------------------------------------------- |
| `name`        | yes      | platform-neutral dotted token name              |
| `type`        | yes      | token type, such as `color`, `duration`, `size` |
| `value`       | yes      | canonical source value                          |
| `description` | yes      | intended usage                                  |
| `platforms`   | yes      | supported outputs such as `web` and `avalonia`  |
| `aliases`     | no       | public compatibility aliases                    |
| `mode`        | no       | light, dark, compact, reduced, or disabled mode |

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
