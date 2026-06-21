# Token v2 Migration

Token v2 keeps `spec/tokens/tokens.json` as the source of truth and adds
explicit layers, mode dimensions, fixture validation, output snapshots, and
stable component hard-code guards.

## What Changed

| Area    | Migration rule                                                                                                                                                                |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Layers  | New tokens must fall under `primitive`, `semantic`, `component`, or `component-state`.                                                                                        |
| Modes   | Theme, density, and motion variants use `modeValues` with a fallback token.                                                                                                   |
| Types   | Use typed values for color, brush, dimension, thickness, radius, typography, font family, font weight, opacity, z-index, duration, easing, shadow, density, and icon metrics. |
| Aliases | Existing Web CSS aliases remain allowed only when they point back to registered source tokens.                                                                                |
| Output  | Run `pnpm run tokens:generate` after source changes and commit CSS, SCSS, JSON, Avalonia XAML, C#, docs, hash, and snapshot updates together.                                 |

## Authoring Flow

1. Add primitive values only when no existing primitive can express the value.
2. Add semantic tokens for reusable meaning across components.
3. Add component tokens for stable component layout or sizing defaults.
4. Add component-state tokens for specific state surfaces.
5. Run `pnpm run tokens:lint` before `pnpm run tokens:generate`; lint catches unresolved references, cycles, unsupported units, missing platform declarations, missing fallback tokens, type mismatches, duplicate semantic meanings, stale snapshots, and stable component hard-codes.

Stable Avalonia component themes must consume generated resources such as
`FsusComponentDialogPadding` instead of hard-coded color, spacing, radius,
typography, duration, easing, or shadow values.
