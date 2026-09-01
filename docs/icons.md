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

FsusUI never applies stroke or fill rules to a bare `svg`. Generated line icons
carry their stroke contract in the SVG source. For a consumer-owned line icon,
opt into the scoped cap/join recipe on the `ElIcon` container; solid and
third-party icons should omit the attribute.

```vue
<el-icon variant="linear">
  <CustomLineIcon />
</el-icon>
```

`variant="inherit"` is the default and leaves a slotted SVG's paint geometry
untouched.

Icon-only buttons must provide an accessible name:

```vue
<el-button :icon="Search" aria-label="搜索" circle />
```

## Available Icon Packages

| Package or path                   | Audience                                  | Stability                  |
| --------------------------------- | ----------------------------------------- | -------------------------- |
| `@ozwasyd/element-plus/icons-vue` | External consumers                        | Preview public API         |
| `vue/packages/icons-svg`              | Repository maintainers                    | Internal source of truth   |
| `vue/packages/icons-vue`              | Repository maintainers and build pipeline | Internal workspace package |

The workspace package names still include Element Plus naming for source
compatibility. External consumers should use the `@ozwasyd/element-plus`
package path.

## Cross-Platform Registry

The platform-neutral icon registry lives in `spec/icons/registry.yaml`.
It defines stable semantic ids, source SVGs, Avalonia path data, tokenized
size/stroke/fill names, aliases, and decorative-vs-semantic accessibility
defaults.

Generated registry outputs:

- `vue/packages/icons-vue/generated/icon-metadata.json`
- `dotnet/FsusUI.Avalonia.Icons/Generated/FsusIcons.axaml`
- `dotnet/FsusUI.Avalonia.Icons/Generated/FsusIconKeys.g.cs`

Run:

```bash
pnpm run icons:generate
pnpm run icons:check
pnpm run icons:lint
```

## File Type Resolution (Avalonia)

`FsusUI.Avalonia.Icons` ships `FsusFileTypeIcon`, an Avalonia resolver that
maps a file name or extension to a semantic file icon key
(`FsusIconFileText`, `FsusIconFileMarkdown`, `FsusIconFileCode`,
`FsusIconFileData`, `FsusIconFileImage`, `FsusIconFileArchive`,
`FsusIconFileDocument`) with a stable `FsusIconFile` fallback for unknown
types. Tree rows should keep the visible file name as the accessible name and
treat the resolved icon as decorative; icons inherit the row foreground in
light, dark, and high-contrast themes.

## Generation Workflow

SVG source files live in `vue/packages/icons-svg/*.svg`. Vue icon components are
generated into `vue/packages/icons-vue/src/components`; the Web generator reads the
registry to add semantic aliases such as `ChevronRight` while preserving
existing file-name exports.

Use the root guard when you only need to ensure artifacts are fresh:

```bash
pnpm run ensure:icons
```

Use the icon package generator when adding or reviewing SVG changes:

```bash
pnpm -C vue/packages/icons-vue build:generate
```

The generator enforces the FsusUI icon contract:

- one root `<svg>` element
- `viewBox="0 0 1024 1024"`
- `stroke="currentColor"`
- `fill="currentColor"`
- `stroke-linejoin="round"`
- `stroke-linecap="round"`
- `stroke-width="112"` for line icons, derived from
  `icon.stroke.md` / `icon.size.md` with `1.75 * 1024 / 16`

Solid `*-filled` icons keep `fill="currentColor"` and do not inherit line icon
stroke attributes.

## SVG Review Expectations

- Keep icon names stable and kebab-case in `vue/packages/icons-svg`.
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
