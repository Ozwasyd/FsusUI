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

## Vue Contract Mapping

Vue message, notification, loading, affix, and backtop helpers map to explicit
service objects, options records, handles, and content controls.

## Supported Platform Differences

Overlay host lifecycle and scroll measurement follow
`docs/avalonia/platform-differences.md`.

## Theme Tokens

Service helpers use surface, border, text, danger, loading, focus, density, and
motion resources.

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
