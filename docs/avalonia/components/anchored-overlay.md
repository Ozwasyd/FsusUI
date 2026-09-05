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

See [`docs/avalonia/platform-differences.md`](../platform-differences.md) for placement, dismissal, and focus-restoration boundaries.

## Theme Tokens

Use overlay, raised-surface, border, focus, text, and density resources from [Application Setup](../installation.md#application-setup); motion behavior is defined in [Avalonia Motion Runtime](../motion-runtime.md).

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
