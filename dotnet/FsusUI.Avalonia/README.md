# FsusUI.Avalonia

`FsusUI.Avalonia` contains the shared Avalonia control wrappers and constants
used by the preview Avalonia packages.

This package is generated and tested as part of the cross-platform FsusUI
workspace. It does not expose Web DOM structure, Element Plus internals, or
product-specific FsusPanel/FsusBlog contracts.

## Button Controls

`FsusButton` is the stable command control for Avalonia. It exposes typed
variant, size, loading, text/link/plain/round/circle, inline action, icon
placement, custom brush, automation name, command, and routed activation
semantics. Loading buttons suppress `Click`, `Command`, and `Activated` output
until loading clears.

`FsusButtonGroup` groups `FsusButton` children with shared size/variant,
deterministic first/middle/last membership classes, collapsed borders, and
disabled-state propagation that restores each child to its prior enabled state.

## Overlay Host

`FsusOverlayHost` provides the shared host for stable overlay surfaces. It
tracks deterministic z-order, modal stack state, pointer/keyboard dismissal,
focus containment, focus restoration, and viewport-aware placement. Use
`FsusOverlayHostService` to keep one host per window or top-level surface.

See `docs/avalonia/overlay-host.md` for host setup and close-policy details.
