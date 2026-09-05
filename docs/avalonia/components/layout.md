# Layout

Component ID: `layout`

## Avalonia API

Use `FsusSpace`, `FsusRow`, `FsusCol`, `FsusContainer`, `FsusHeader`,
`FsusAside`, `FsusMain`, `FsusFooter`, `FsusScrollbar`, and `FsusVisualHidden`.

## Vue Contract Mapping

Vue space, row, column, container, scrollbar, and screen-reader-only contracts
map to Avalonia panels, content controls, and explicit scroll state.
`FsusDivider` renders the Web authority presentation: a zero-margin block with
an optional 13px/500 title row above a 1px `color.border.lighter` rule.
`FsusCol` exposes `WidthRatio` for its `Span`; the host applies the ratio
because Avalonia panels have no automatic 24-column distribution.

## Supported Platform Differences

See [`docs/avalonia/platform-differences.md`](../platform-differences.md) for layout measurement and scroll-chrome boundaries.

## Theme Tokens

Use gap, density, border, surface, focus, and text resources from [Application Setup](../installation.md#application-setup); motion behavior is defined in [Avalonia Motion Runtime](../motion-runtime.md).

## Minimal Avalonia Example

```csharp
using FsusUI.Avalonia.Controls;

var row = new FsusRow { Gap = FsusLayoutGap.Md };
row.Children.Add(new FsusCol { Span = 12, Content = new FsusText { Text = "Left" } });
row.Children.Add(new FsusCol { Span = 12, Content = new FsusText { Text = "Right" } });
```

## Known Limitations

CSS flex and grid selectors are not supported; use the public layout controls.
