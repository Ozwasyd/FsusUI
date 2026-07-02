# Button

Component ID: `button`

## Avalonia API

Use `FsusButton`, `FsusButtonGroup`, and `FsusIconButton` for command surfaces,
grouped actions, and icon-only actions with stable automation names.

## Vue Contract Mapping

Maps the Vue button contract to `Content`, `Command`, `Activated`, `Variant`,
`Size`, loading, disabled, text/link/plain/round/circle, and icon placement.

## Supported Platform Differences

Native templates, focus visuals, and accessible names follow the accepted
overrides in `docs/avalonia/platform-differences.md`.

## Theme Tokens

Consume `FsusThemeResourceKeys.FocusBrush`, density resources, danger brushes,
disabled opacity, and motion resources through `FsusUI.Avalonia.Themes`.

## Minimal Avalonia Example

```csharp
using FsusUI.Avalonia.Controls;

var save = new FsusButton
{
  Content = "Save settings",
  AccessibleName = "Save settings",
  Variant = FsusComponentVariant.Primary,
  Size = FsusComponentSize.Md,
};
```

## Known Limitations

Icon graphics come from the icon package; the button family does not resolve
raw SVG strings or Web class selectors.
