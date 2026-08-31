# Virtualization

Component ID: `virtualization`

## Avalonia API

Use `FsusVirtualList`, `FsusVirtualListItem`, `FsusVirtualWindow`,
`FsusVirtualAnchor`, `FsusAutoResizer`, and `FsusTableV2` for bounded realized
content. `FsusVirtualListItemContainer` and `FsusTableV2CellContainer` are the
recyclable visual containers used by those controls; applications normally set
`ItemProvider`/`CellProvider` and templates instead of constructing containers.
Realized list containers fill the current viewport width, including after the
list is first realized before its final mounted width is known.
`FsusInfiniteScroll` is a non-rendering behavior helper that observes an owned
or ancestor `ScrollViewer` and raises `Loaded` when scrolling reaches the
configured bottom distance.
`FsusAutoResizer` observes its arranged viewport, exposes it through `Viewport`,
invokes `OnResize`, and preserves an axis when `DisableWidth` or `DisableHeight`
is set.

## Realization and recycling

`FsusVirtualList` owns a `ScrollViewer` and a canvas-backed visual host. Only
the viewport plus overscan is materialized. Containers leaving the window have
content, templates, automation metadata and item references cleared before
entering the bounded pool. Fixed-height offset/index lookup is O(1). Variable
height uses a Fenwick size index for O(log N) updates and lookups while the
measurement cache remains capped by `VirtualizationBudget.RetainedMeasurements`.

`FsusTableV2` applies the same model on both axes. Its desired-cell set is the
union of the visible row/column window and frozen axes, so a 100K × 80 source
does not create a source-sized visual tree. `ContainerPoolLimit`,
`LoadedWindowLimit`, and `LoadedRowIndexLimit` are explicit hard limits.

Measurement corrections before the active anchor adjust the scroll offset so
the same logical item remains visually stable. `NotifyItemsInserted` preserves
that anchor when data is inserted before it.

## Background work and accessibility

`LoadWindowAsync` and `UpdateRowIndexAsync` cancel superseded work, reject stale
versions and dispatch the final visual-tree update to the Avalonia UI thread.
Providers should perform sorting, filtering or I/O before returning their
bounded result window; they must not mutate controls from a worker thread.

Automation name, control type and item-status properties are updated only when
their semantic value changes. Recycled containers receive fresh list-item or
data-cell metadata when rebound. Keyboard focus follows the logical row/cell
through a scroll operation rather than the previous container identity.

## Vue Contract Mapping

Vue virtual list, table-v2, and infinite-scroll contracts map to item identity,
realized windows, anchor correction, table budgets, scroll-to-index behavior,
and scroll-bound `Loaded` callbacks.

## Supported Platform Differences

Scroll anchoring and presenter offset correction follow
`docs/avalonia/platform-differences.md`.

## Theme Tokens

Virtualized surfaces use surface, border, focus, text, density, and motion
resources.

## Minimal Avalonia Example

```csharp
using FsusUI.Avalonia.Controls;

var list = new FsusVirtualList
{
  AccessibleName = "Events",
  ItemCount = 100_000,
  ItemProvider = index => $"Event {index}",
  FixedItemSize = 32,
  ViewportSize = 640,
};
list.RefreshWindow();
```

## Known Limitations

Variable-height estimation needs stable product item keys. Products that change
item height must call `SetMeasuredSize`; the control does not infer the final
height from arbitrary descendant layout changes.
