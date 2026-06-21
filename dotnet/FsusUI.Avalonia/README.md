# FsusUI.Avalonia

`FsusUI.Avalonia` contains the shared Avalonia control wrappers and constants
used by the preview Avalonia packages.

This package is generated and tested as part of the cross-platform FsusUI
workspace. It does not expose Web DOM structure, Element Plus internals, or
product-specific FsusPanel/FsusBlog contracts.

## Overlay Host

`FsusOverlayHost` provides the shared host for stable overlay surfaces. It
tracks deterministic z-order, modal stack state, pointer/keyboard dismissal,
focus containment, focus restoration, and viewport-aware placement. Use
`FsusOverlayHostService` to keep one host per window or top-level surface.

See `docs/avalonia/overlay-host.md` for host setup and close-policy details.
