# Virtualization

Component ID: `virtualization`

## Avalonia API

Use `FsusVirtualList`, `FsusVirtualListItem`, `FsusVirtualWindow`,
`FsusVirtualAnchor`, `FsusAutoResizer`, and `FsusTableV2` for bounded realized
content.

## Vue Contract Mapping

Vue virtual list and table-v2 contracts map to item identity, realized windows,
anchor correction, table budgets, and scroll-to-index behavior.

## Supported Platform Differences

Scroll anchoring and presenter offset correction follow
`docs/avalonia/platform-differences.md`.

## Theme Tokens

Virtualized surfaces use surface, border, focus, text, density, and motion
resources.

## Minimal Avalonia Example

```csharp
using FsusUI.Avalonia.Controls;

var list = new FsusVirtualList { AccessibleName = "Events" };
list.Items.Add(new FsusVirtualListItem(0, "event-0", "Started"));
```

## Known Limitations

Variable-height estimation needs stable product item keys.
