# Anchored overlay

Component ID: `anchored-overlay`

## Avalonia API

Use `FsusTooltip`, `FsusPopover`, `FsusPopconfirm`, `FsusDropdown`,
`FsusDropdownMenu`, and `FsusDropdownItem` for anchored transient surfaces.

## Automation

`FsusTooltip` exposes the native automation tooltip role. `FsusPopover` and
`FsusPopconfirm` expose an automation window role for their dialog-like
surfaces. Their expand/collapse provider reports the live `IsOpen` state and
uses the same overlay host lifecycle as pointer, keyboard, and public API
actions; disabled surfaces cannot be reopened through automation.

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
An automation peer cannot reopen an anchored surface after its lifecycle host
has been collected.
