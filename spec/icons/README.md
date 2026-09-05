# Icon Registry Schema

Icon specs define meaning, size, stroke, fill, and pairing behavior without
binding the contract to a renderer. `registry.yaml` is the platform-neutral
source for Web metadata and Avalonia resource generation.

## Required Fields

| Field                 | Description                                               |
| --------------------- | --------------------------------------------------------- |
| `id`                  | stable semantic icon id                                   |
| `displayName`         | human-readable name used by docs and generated metadata   |
| `category`            | action, status, navigation, or object                     |
| `source`              | source SVG path used by Web generation                    |
| `path`                | source SVG path data used by Avalonia generation          |
| `defaultSize`         | token reference such as `icon.size.md`                    |
| `stroke`              | token reference for stroke weight                         |
| `fill`                | token reference or semantic fill token                    |
| `mode`                | stroke or fill rendering mode                             |
| `decorativeByDefault` | whether the icon is hidden from assistive tech by default |
| `aliases`             | stable compatibility or semantic alias ids                |

The icon pipeline validates `path`, viewport, stroke, fill, and Vue component
name against `source`; entries drift when a source SVG or Vue component changes
without regenerating Avalonia artifacts.

Icons used as the only visible command label require an accessible name from
the consuming component or pattern. Decorative icons must be explicitly marked
decorative when they would otherwise be the only visible glyph.

## Generated Artifacts

After changing the registry, run `pnpm run icons:generate`. CI runs
`pnpm run icons:check` and `pnpm run icons:lint` to ensure artifacts are current.

| Artifact | Path |
| --- | --- |
| Web metadata | `vue/packages/icons-vue/generated/icon-metadata.json` |
| Avalonia resources | `dotnet/FsusUI.Avalonia.Icons/Generated/FsusIcons.axaml` |
| C# lookup keys | `dotnet/FsusUI.Avalonia.Icons/Generated/FsusIconKeys.g.cs` |
| Stable inventory | `docs/icons/generated/stable-icons.md` |
| Visual baseline | `tests/conformance/visual/icon-baselines.json` |

Web Vue components remain generated from `vue/packages/icons-svg`; the Web step
reads this registry to add semantic aliases such as `ChevronRight` and catch
missing source SVG mappings.
