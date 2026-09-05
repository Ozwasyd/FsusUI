# Token Schema

Tokens use platform-neutral names and mechanical platform mappings. Token v2
adds source layers and mode dimensions so Web and Avalonia are generated from
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
| theme     | light, dark                |
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

Traceability defaults live once in the root `traceability` registry. The
generator expands them onto every token record, exposing in generated JSON and
docs the canonical name, every runtime alias, resolved light/dark values, usage
surface, owner, consumer-use flag, generated outputs, documentation, fixture,
status, and migration status. A token may override `owner`, `usageSurface`,
`consumerUse`, `status`, or `migrationStatus` only when its lifecycle differs
from the layer default.

Aliases make a token consumer-usable even when its layer is internal by
default. Consumer-owned aliases remain outside this registry: FsusBlog defines
`--fsusblog-*` in its stylesheet and maps those names to public `--fsus-*` or
`--el-*` tokens.

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

Canonical eight-digit colors use CSS ordering, `#RRGGBBAA`; Web outputs preserve
it, while Avalonia outputs mechanically convert the same color to `#AARRGGBB`.
Platform files must not hand-author a second value.

High-contrast behavior is not a canonical theme dimension. Operating-system
accessibility behavior is registered as a reviewed platform override under
`spec/platform-overrides/` instead of being emitted as a third Web theme preset.

## Source Precedence

1. `spec/tokens/tokens.json` is the canonical platform-neutral source.
2. `docs/design.md` and `docs/theme/tokens.md` are checked human-readable contracts.
3. Web CSS/SCSS/JSON, Avalonia XAML/C#, generated docs, and hashes are generated artifacts.
4. `spec/platform-overrides/*.yaml` may record only unavoidable differences and must include reason, owner, test policy, and review date.
5. Platform adapters and compatibility aliases consume the preceding layers; they never redefine them.

Typography availability is canonical in `spec/typography/baseline.json`.
Stable component styles may use only its `fontWeights.stable` values unless a
declared variable font supplies the requested axis.

## Web Radius Usage

Literal fallbacks for `var(--fsus-radius-*, <fallback>)` in
`vue/packages/theme-chalk/src` must use the canonical radius scale:
`4px`, `6px`, `10px`, `12px`, `24px`, or `999px`. Token-to-token and SCSS
fallback expressions remain valid because their resolved value is governed by
the token pipeline. The obsolete naked declaration `border-radius: 8px` is also
rejected: component surfaces must select the matching
`--fsus-radius-*` role instead of recreating the removed intermediate radius.
Comments are excluded from this check.
`pnpm tokens:lint` enforces both rules.

The same lint command rejects literal visual truth for stable spacing, radius,
control-height, material, and interaction-state declarations in
`common/fsus-tokens.scss`. Register or reuse a canonical token, regenerate, and
reference the generated SCSS variable instead.
