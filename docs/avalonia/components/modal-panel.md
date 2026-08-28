# Modal panel

Component ID: `modal-panel`

## Avalonia API

Use `FsusDialog`, `FsusDrawer`, `FsusMessageBox`, `FsusMessageBoxService`,
and `FsusOverlayHost` for modal surfaces, close policy, focus containment, and
message-box flows. For long forms, enable `IsBodyScrollable` on `FsusDialog` to
provide a scrollable content area with fixed title and action footer, bounded by
the owner or overlay viewport and, when set, `MaxBodyHeight`. The opt-in mode
supports `PageUp`/`PageDown` and scrolls newly focused body controls into view;
the default dialog composition remains unchanged.

## Vue Contract Mapping

Vue dialog, drawer, and message-box props map to public content, title, close
policy, placement, service options, and close events.

## Supported Platform Differences

Window shadows, focus containment, and overlay host behavior follow
`docs/avalonia/platform-differences.md`.

## Theme Tokens

Modal panels use overlay, surface, border, focus, danger, density, and motion
resources.

## Minimal Avalonia Example

```csharp
using FsusUI.Avalonia.Controls;

var dialog = new FsusDialog
{
  Title = "Discard changes",
  Content = "Unsaved edits will be lost.",
};
```

## Known Limitations

The service requires an app-owned overlay host; it does not create an implicit
global DOM-style overlay root.
