# Navigation

Component ID: `navigation`

## Avalonia API

Use `FsusTabs`, `FsusTabPane`, `FsusMenu`, `FsusMenuItem`, `FsusSubMenu`,
`FsusMenuItemGroup`, `FsusBreadcrumb`, `FsusBreadcrumbItem`, `FsusPageHeader`,
`FsusSteps`, and `FsusStep`.

## Vue Contract Mapping

Vue active keys, tab panes, menu item groups, breadcrumbs, page header actions,
and step status map to typed controls, selected keys, and activation events.

## Supported Platform Differences

Keyboard navigation and focus rings follow `docs/avalonia/platform-differences.md`.

## Theme Tokens

Navigation controls use focus, surface, border, text, muted text, density, and
motion resources.

## Minimal Avalonia Example

```csharp
using FsusUI.Avalonia.Controls;

var tabs = new FsusTabs();
tabs.Items.Add(new FsusTabPane { Header = "Overview", Content = "Ready" });
```

## Known Limitations

Router integration belongs to the app shell; navigation controls do not own URL
mutation.
