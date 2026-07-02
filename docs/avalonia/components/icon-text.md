# Icon and text

Component ID: `icon-text`

## Avalonia API

Use `FsusIcon`, `FsusText`, and `FsusLink` for generated icon resources,
token-backed text variants, and command-capable text links.

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
