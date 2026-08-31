# Icon and text

Component ID: `icon-text`

## Avalonia API

Use `FsusIcon`, `FsusText`, and `FsusLink` for generated icon resources,
token-backed text variants, and command-capable text links. `FsusLink` renders
the Web `el-link` type authority: the default label uses the muted text color,
and `Primary`/`Success`/`Warning`/`Danger`/`Info` variants tint the label with
the corresponding action color while keeping a text surface (no fill, no
border, 4px inline padding, weight 500).

## Vue Contract Mapping

Vue icon components map to `FsusIconKeys` plus `FsusIcon`. Text and link
contracts map to `Text`, `Content`, `NavigateUri`, `Activated`, and
`AccessibleName`.

## Supported Platform Differences

Icon geometry and text baselines follow `docs/avalonia/platform-differences.md`.

## Theme Tokens

Use icon size, stroke, fill, text brush, muted text brush, focus, and density
resources from the theme package.

## Minimal Avalonia Example

```csharp
using FsusUI.Avalonia.Controls;
using FsusUI.Avalonia.Icons;

var icon = new FsusIcon
{
  IconKey = FsusIconKeys.Search,
  IsDecorative = true,
};
var label = new FsusText { Text = "Search" };
```

## Known Limitations

SVG component slots are not public Avalonia API; use generated geometry
resources instead.
