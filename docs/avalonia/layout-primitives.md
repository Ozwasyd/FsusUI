# Avalonia Layout Primitives

FsusUI Avalonia layout primitives provide the stable layout layer used by demos
and product integrations. They intentionally map Web flex/grid behavior to
Avalonia layout panels instead of exposing DOM-specific structure.

## Web flex/grid behavior vs Avalonia layout panels

Web `Space`, `Row`, and `Col` rely on flex and grid algorithms that can wrap,
shrink, and distribute columns from CSS media queries. Avalonia uses panel
measure and arrange passes, so `FsusSpace`, `FsusRow`, and `FsusCol` expose the
contract as explicit gap, wrap, breakpoint, and span properties. Consumers
should depend on those properties and not on Web class names or DOM order.

`FsusRow.RefreshResponsiveColumns(viewportWidth)` resolves the active breakpoint
and applies each `FsusCol` responsive span. The default grid remains 24 columns
to match the Web contract, while actual pixel measurement can differ by platform
font, density, and host window constraints.

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
