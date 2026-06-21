# Avalonia Overlay Host

`FsusOverlayHost` is the shared infrastructure for stable Avalonia overlay
components. It owns overlay ordering, modal stack state, close policy, focus
containment, focus restoration, and viewport-aware placement.

## Host Setup

Applications create one host per window or top-level surface. Use
`FsusOverlayHostService` to register and retrieve hosts by window key:

```csharp
var overlays = new FsusOverlayHostService();
var host = overlays.GetOrCreateHost(window);
```

The service keeps hosts isolated so multi-window applications do not share
modal stacks or z-order state.

## Opening Overlays

Use `Open` for generic overlay content and `OpenDialog` for `FsusDialog`
surfaces:

```csharp
var entry = host.OpenDialog(
  dialog,
  new FsusOverlayOptions
  {
    RestoreFocusTo = triggerButton,
    FocusScope = [primaryAction, cancelAction],
  });
```

Each entry records deterministic `ZIndex`, `Bounds`, `Placement`, and
`RenderScaling`. Placement flips from bottom to top when the requested overlay
would exceed the viewport boundary.

## Close And Focus Policy

`CloseAsync` is cancellation-aware through `FsusOverlayOptions.Closing`.
Keyboard and pointer dismissal use the same close pipeline:

- `DismissKeyboardAsync` closes the top overlay when `CloseOnEscape` is true.
- `DismissPointerOutsideAsync` closes the top overlay only when the pointer is
  outside the resolved bounds and `CloseOnPointerOutside` is true.
- `MoveFocus` cycles inside the top modal overlay focus scope.
- Closed overlays restore focus to `RestoreFocusTo` or the host's
  `LastFocusedElement`.

The host removes closed overlay content from `Children` and `OpenOverlays`, so
repeated open/close cycles do not retain overlay instances.
