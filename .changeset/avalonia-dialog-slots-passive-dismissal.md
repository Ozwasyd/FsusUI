---
'element-plus': patch
---

Complete the Avalonia `FsusDialog` semantic slots and wire passive dismissal in `FsusOverlayHost`. A dialog that only sets `Title`, `BodyContent`, `FooterContent`, and optional `ConfirmContent`/`CancelContent` now renders through a default theme template (assigning legacy `Content` keeps the previous self-composed presentation). `OpenDialog` centers the surface in the overlay viewport, modal entries render a scrim, Escape and pointer-outside presses invoke keyboard and pointer dismissal for the topmost overlay honoring `ClosePolicy`, `CloseOnEscape`, `CloseOnPointerOutside`, and `BeforeClose`, and focus enters the modal after load and is restored on close.
