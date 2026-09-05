# Avalonia Layout Primitives

FsusUI Avalonia layout primitives map the stable Web flex/grid contract to
Avalonia layout panels without exposing DOM-specific structure.

## Web flex/grid behavior vs Avalonia layout panels

Web `Space`, `Row`, and `Col` can wrap, shrink, and distribute columns through
CSS media queries. Avalonia uses panel measure/arrange passes, so
`FsusSpace`, `FsusRow`, and `FsusCol` expose explicit gap, wrap, breakpoint, and
span properties. Consumers should depend on those properties, not Web class
names or DOM order.

`FsusRow.RefreshResponsiveColumns(viewportWidth)` resolves the active
breakpoint and applies each `FsusCol` responsive span. The default grid remains
24 columns to match Web; pixel measurement can differ by platform font, density,
and host-window constraints.

## Container regions

`FsusContainer` hosts `FsusHeader`, `FsusAside`, `FsusMain`, and `FsusFooter`.
These regions expose group automation metadata and stable region class names.
Nested containers are supported, but product-specific shell composition remains
outside the primitive contract.

## Scrollbar behavior

`FsusScrollbar` exposes token-backed styling plus deterministic keyboard and
pointer scroll behavior. Arrow keys move by `KeyboardScrollStep`; page keys move
by two keyboard steps; pointer deltas move by `PointerScrollStep`.

## VisualHidden

`FsusVisualHidden` is screen-reader-only content. It remains in the accessibility
tree, keeps a 1px visual footprint, has zero opacity, and does not participate
in hit testing. Use it for labels or helper text that must be announced without
changing visual layout.
