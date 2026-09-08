# Icons

FsusUI exposes icon components through the public package entry
`@ozwasyd/element-plus/icons-vue`.

## Importing Icons

Import only the icons you use:

```ts
import { Search, Edit, Delete } from '@ozwasyd/element-plus/icons-vue'
```

Use `ElIcon` when you need consistent size, color, loading state, or inline alignment:

```vue
<template>
  <el-icon :size="18" color="var(--el-color-primary)">
    <Search />
  </el-icon>
</template>
```

FsusUI never applies stroke or fill rules to a bare `svg`; generated line icons
carry that contract in their SVG source. For a consumer-owned line icon, opt
into the scoped cap/join recipe on its `ElIcon` container; solid and third-party
icons should omit the attribute.

```vue
<el-icon variant="linear">
  <CustomLineIcon />
</el-icon>
```

`variant="inherit"` is the default and leaves slotted SVG paint geometry
untouched. Icon-only buttons must provide an accessible name:

```vue
<el-button :icon="Search" aria-label="搜索" circle />
```

## Available Icon Packages

| Package or path | Audience | Stability |
| --- | --- | --- |
| `@ozwasyd/element-plus/icons-vue` | External consumers | Preview public API |
| `vue/packages/icons-svg` | Repository maintainers | Internal source of truth |
| `vue/packages/icons-vue` | Maintainers and build pipeline | Internal workspace package |

Workspace package names retain Element Plus naming for source compatibility;
external consumers should use the `@ozwasyd/element-plus` path.

## Cross-Platform Registry

The platform-neutral icon registry is [`spec/icons/registry.yaml`](../spec/icons/registry.yaml). It defines semantic ids, source SVGs, Avalonia path data, tokenized size/stroke/fill names, aliases, and decorative-vs-semantic accessibility defaults.

Generated outputs are:

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

`FsusUI.Avalonia.Icons` ships `FsusFileTypeIcon`, which maps a file name or
extension to a semantic key: `FsusIconFileText`, `FsusIconFileMarkdown`,
`FsusIconFileCode`, `FsusIconFileData`, `FsusIconFileImage`,
`FsusIconFileArchive`, or `FsusIconFileDocument`. Unknown types use the stable
`FsusIconFile` fallback. Tree rows should keep the visible file name as the
accessible name and treat the resolved icon as decorative; icons inherit row
foreground in light, dark, and high-contrast themes.

## Desktop Shell Actions (Avalonia)

Use these semantic keys for native desktop shell actions:

| Action | Avalonia key | Intended sizes |
| --- | --- | --- |
| Add a document or tab | `FsusIconKeys.AddDocument` | 16, 20, 24 DIP |
| Application menu | `FsusIconKeys.ApplicationMenu` | 16, 20, 24 DIP |
| Close a surface | `FsusIconKeys.Close` | 16, 20, 24 DIP |
| Refresh or replace | `FsusIconKeys.RefreshReplace` | 16, 20, 24 DIP |
| Search/filter | `FsusIconKeys.SearchFilter` | 16, 20, 24 DIP |

`FsusIcon` supplies the theme-aware 16 DIP default and inherits the host
foreground in light, dark, and high-contrast themes. Set explicit `Width` and
`Height` when 20 or 24 DIP presentation is required. Keep these icons
decorative beside a visible label; for an icon-only action, put the stable
accessible name on the host control, such as `FsusIconButton.AccessibleName`.

## Generation Workflow

SVG sources live in `vue/packages/icons-svg/*.svg`; Vue components are generated
into `vue/packages/icons-vue/src/components`. The Web generator reads the
registry for semantic aliases such as `ChevronRight` while preserving existing
file-name exports.

Use the root guard when you only need to ensure fresh artifacts:

```bash
pnpm run ensure:icons
```

Use the icon package generator when adding or reviewing SVG changes:

```bash
pnpm -C vue/packages/icons-vue build:generate
```

The generator enforces:

- one root `<svg>` element;
- `viewBox="0 0 1024 1024"`;
- `stroke="currentColor"` and `fill="currentColor"`;
- `stroke-linejoin="round"` and `stroke-linecap="round"`;
- `stroke-width="112"` for line icons, derived from `icon.stroke.md` /
  `icon.size.md` with `1.75 * 1024 / 16`.

Solid `*-filled` icons keep `fill="currentColor"` and do not inherit line-icon
stroke attributes.

## SVG Review Expectations

- Keep icon names stable and kebab-case in `vue/packages/icons-svg`.
- Review the rendered Vue component, not only the raw SVG path.
- Do not include private logos, customer artwork, tracking pixels, or external image references.
- Prefer currentColor-driven icons so themes can control color.
- Run visual checks when an icon appears in public component demos.

## Icon Name Stability

Icon component names generated from existing SVG filenames are preview public API
when exported through `@ozwasyd/element-plus/icons-vue`. Renaming or removing
an exported icon requires release notes and a migration note during public
preview.

New icon names become preview public after generation, export, and reference by
docs or demos.
