# Service helper

Component ID: `service-helper`

## Avalonia API

Use `FsusMessageService`, `FsusNotificationService`, `FsusLoadingService`,
`FsusMessageToast`, `FsusNotification`, `FsusLoadingOverlay`,
`FsusLoadingIndicator`, `FsusAffix`, and `FsusBacktop`.

`FsusLoadingIndicator` is a standalone compact loading primitive for
16-24 px surfaces such as search fields and command palettes. `IsActive`
shows or hides it, `IsIndeterminate` switches between an indeterminate arc
and a `Value`-driven determinate stroke, sizes come from the control's own
width and height, and colors resolve through theme tokens. It exposes the
progress-bar control type with a stable accessible name and `loading`/`idle`
item status instead of announcing animation frames, and it honors reduced
motion through the `FsusMotionModeCurrent` theme resource or its own
`ReducedMotion` flag.

`FsusNotification` renders `Title` and `Message` from `FsusNotificationOptions`
through its theme template, exposes a dismiss control, and supports one
optional action: set `ActionLabel` plus an `ActionCommand` and observe
activation through the command or the control's `ActionActivated` event.
Activation stays distinct from dismissal, so timeouts, the dismiss control,
`CloseOnClick`, and programmatic `CloseAsync` never invoke the action. By
default a notification stays open until it is dismissed or closed; set
`Duration` to opt into auto-close after the given span. Pointer presence pauses
the pending timer, and pointer exit restarts a fresh full-duration interval.

## Vue Contract Mapping

Vue message, notification, loading, affix, and backtop helpers map to explicit
service objects, options records, handles, and content controls.

## Supported Platform Differences

See [`docs/avalonia/platform-differences.md`](../platform-differences.md) for overlay-host lifecycle and scroll-measurement boundaries.

## Theme Tokens

Use surface, border, text, danger, loading, focus, and density resources from [Application Setup](../installation.md#application-setup); motion behavior is defined in [Avalonia Motion Runtime](../motion-runtime.md).

## Minimal Avalonia Example

```csharp
using FsusUI.Avalonia.Controls;

var toast = new FsusMessageToast
{
  Content = "Saved",
  ServiceType = FsusServiceType.Success,
};
```

## Known Limitations

Service helpers need an Avalonia host context; they do not inject browser
directives into arbitrary markup.
