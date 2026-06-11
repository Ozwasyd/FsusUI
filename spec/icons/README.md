# Icon Registry Schema

Icon specs define meaning, size, stroke, fill, and pairing behavior without
tying the contract to a specific icon renderer. `registry.yaml` is the
platform-neutral source consumed by Web metadata generation and Avalonia
resource generation.

## Required Fields

| Field                 | Description                                               |
| --------------------- | --------------------------------------------------------- |
| `id`                  | stable semantic icon id                                   |
| `displayName`         | human-readable name used by docs and generated metadata   |
| `category`            | action, status, navigation, or object                     |
| `source`              | source SVG path used by Web generation                    |
| `path`                | platform-neutral path data used by Avalonia generation    |
| `defaultSize`         | token reference such as `icon.size.md`                    |
| `stroke`              | token reference for stroke weight                         |
| `fill`                | token reference or semantic fill token                    |
| `mode`                | stroke or fill rendering mode                             |
| `decorativeByDefault` | whether the icon is hidden from assistive tech by default |
| `aliases`             | stable compatibility or semantic alias ids                |

Icons used as the only visible command label require an accessible name from
the consuming component or pattern.

## Generated Artifacts

Run `pnpm run icons:generate` after changing the registry. CI uses
`pnpm run icons:check` and `pnpm run icons:lint` to ensure generated artifacts
are current.

- Web metadata: `packages/icons-vue/generated/icon-metadata.json`
- Avalonia resources:
  `dotnet/FsusUI.Avalonia.Icons/Generated/FsusIcons.axaml`
- C# lookup keys: `dotnet/FsusUI.Avalonia.Icons/Generated/FsusIconKeys.g.cs`

Web Vue components remain generated from `packages/icons-svg`, but the Web
generation step reads this registry to add semantic aliases such as
`ChevronRight` and to catch missing source SVG mappings.
