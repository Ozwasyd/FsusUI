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

When the legacy `Content` is not assigned, `FsusDialog` renders its semantic
slots from the public properties: `Title`, `BodyContent`, `FooterContent`, and
the optional `ConfirmContent`/`CancelContent` each map to a template slot and
collapse when unset. Assigning `Content` keeps the legacy self-composed
presentation and suppresses the semantic template. `OpenDialog` centers the
surface in the overlay viewport, and every modal entry renders a scrim behind
the content.

## Automation

`FsusDialog`, `FsusDrawer`, and `FsusMessageBox` expose an automation window
role while they are mounted in the overlay host. Their expand/collapse provider
reports the live `IsOpen` state and routes collapse and reopen requests through
the same host lifecycle, close policy, and `BeforeClose` guard as public
application actions.

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

var semanticDialog = new FsusDialog
{
  Title = "Delete file",
  BodyContent = new TextBlock { Text = "This cannot be undone." },
  ConfirmContent = new FsusButton { Content = "Delete" },
};
```

## Known Limitations

The service requires an app-owned overlay host; it does not create an implicit
global DOM-style overlay root. An automation peer cannot reopen a surface after
its lifecycle host has been collected.
