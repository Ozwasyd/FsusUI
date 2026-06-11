# Icons

FsusUI exposes icon components through the public package entry
`@ozwasyd/element-plus/icons-vue`.

## Importing Icons

Import only the icons you use:

```ts
import { Search, Edit, Delete } from '@ozwasyd/element-plus/icons-vue'
```

Use icons with `ElIcon` when you need a consistent size, color, loading state,
or inline alignment:

```vue
<template>
  <el-icon :size="18" color="var(--el-color-primary)">
    <Search />
  </el-icon>
</template>
```

Icon-only buttons must provide an accessible name:

```vue
<el-button :icon="Search" aria-label="搜索" circle />
```

## Available Icon Packages

| Package or path                   | Audience                                  | Stability                  |
| --------------------------------- | ----------------------------------------- | -------------------------- |
| `@ozwasyd/element-plus/icons-vue` | External consumers                        | Preview public API         |
| `packages/icons-svg`              | Repository maintainers                    | Internal source of truth   |
| `packages/icons-vue`              | Repository maintainers and build pipeline | Internal workspace package |

The workspace package names still include Element Plus naming for source
compatibility. External consumers should use the `@ozwasyd/element-plus`
package path.

## Cross-Platform Registry

The platform-neutral icon registry lives in `spec/icons/registry.yaml`.
It defines stable semantic ids, source SVGs, Avalonia path data, tokenized
size/stroke/fill names, aliases, and decorative-vs-semantic accessibility
defaults.

Generated registry outputs:

- `packages/icons-vue/generated/icon-metadata.json`
- `dotnet/FsusUI.Avalonia.Icons/Generated/FsusIcons.axaml`
- `dotnet/FsusUI.Avalonia.Icons/Generated/FsusIconKeys.g.cs`

Run:

```bash
pnpm run icons:generate
pnpm run icons:check
pnpm run icons:lint
```

## Generation Workflow

SVG source files live in `packages/icons-svg/*.svg`. Vue icon components are
generated into `packages/icons-vue/src/components`; the Web generator reads the
registry to add semantic aliases such as `ChevronRight` while preserving
existing file-name exports.

Use the root guard when you only need to ensure artifacts are fresh:

```bash
pnpm run ensure:icons
```

Use the icon package generator when adding or reviewing SVG changes:

```bash
pnpm -C packages/icons-vue build:generate
```

The generator enforces the FsusUI icon contract:

- one root `<svg>` element
- `viewBox="0 0 1024 1024"`
- `stroke="currentColor"`
- `fill="currentColor"`
- `stroke-linejoin="round"`
- `stroke-linecap="round"`
- `stroke-width="32"`

## SVG Review Expectations

- Keep icon names stable and kebab-case in `packages/icons-svg`.
- Review the rendered Vue component, not only the raw SVG path.
- Do not include private logos, customer artwork, tracking pixels, or external
  image references.
- Prefer currentColor-driven icons so themes can control color.
- Run visual checks when an icon appears in public component demos.

## Icon Name Stability

Icon component names generated from existing SVG filenames are preview public
API when exported through `@ozwasyd/element-plus/icons-vue`. Renaming or
removing an exported icon requires release notes and a migration note during
public preview.

New icon names remain preview public after they are generated, exported, and
referenced by docs or demos.
