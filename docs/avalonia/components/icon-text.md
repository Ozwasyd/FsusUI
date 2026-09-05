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

See [`docs/avalonia/platform-differences.md`](../platform-differences.md) for icon geometry and text-baseline boundaries.

## Theme Tokens

Use icon size, stroke, fill, text, muted-text, focus, and density resources from [Application Setup](../installation.md#application-setup); motion behavior is defined in [Avalonia Motion Runtime](../motion-runtime.md).

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
