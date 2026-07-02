# Anchored overlay

Component ID: `anchored-overlay`

## Avalonia API

Use `FsusTooltip`, `FsusPopover`, `FsusPopconfirm`, `FsusDropdown`,
`FsusDropdownMenu`, and `FsusDropdownItem` for anchored transient surfaces.

## Vue Contract Mapping

Vue reference slots and trigger props map to public target content, placement,
trigger mode, open state, and lifecycle events.

## Supported Platform Differences

Viewport placement, dismissal, and focus restoration follow
`docs/avalonia/platform-differences.md`.

## Theme Tokens

Anchored overlays use overlay, surface raised, border, focus, text, density,
and motion resources.

## Minimal Avalonia Example

```csharp
using FsusUI.Avalonia.Controls;

var tooltip = new FsusTooltip
{
  Content = "Copy API key",
  Placement = FsusAnchoredPlacement.Top,
};
```

## Known Limitations

Browser popper modifiers are not public API; use the supported placement enum.
