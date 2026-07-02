# Layout

Component ID: `layout`

## Avalonia API

Use `FsusSpace`, `FsusRow`, `FsusCol`, `FsusContainer`, `FsusHeader`,
`FsusAside`, `FsusMain`, `FsusFooter`, `FsusScrollbar`, and `FsusVisualHidden`.

## Vue Contract Mapping

Vue space, row, column, container, scrollbar, and screen-reader-only contracts
map to Avalonia panels, content controls, and explicit scroll state.

## Supported Platform Differences

Layout measurement and scroll chrome follow `docs/avalonia/platform-differences.md`.

## Theme Tokens

Layout uses gap, density, border, surface, focus, and text resources.

## Minimal Avalonia Example

```csharp
using FsusUI.Avalonia.Controls;

var row = new FsusRow { Gap = FsusLayoutGap.Md };
row.Children.Add(new FsusCol { Span = 12, Content = new FsusText { Text = "Left" } });
row.Children.Add(new FsusCol { Span = 12, Content = new FsusText { Text = "Right" } });
```

## Known Limitations

CSS flex and grid selectors are not supported; use the public layout controls.
