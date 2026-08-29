# Service helper

Component ID: `service-helper`

## Avalonia API

Use `FsusMessageService`, `FsusNotificationService`, `FsusLoadingService`,
`FsusMessageToast`, `FsusNotification`, `FsusLoadingOverlay`, `FsusAffix`, and
`FsusBacktop`.

`FsusNotification` renders `Title` and `Message` from `FsusNotificationOptions`
through its theme template, exposes a dismiss control, and supports one
optional action: set `ActionLabel` plus an `ActionCommand` and observe
activation through the command or the control's `ActionActivated` event.
Activation stays distinct from dismissal, so timeouts, the dismiss control,
`CloseOnClick`, and programmatic `CloseAsync` never invoke the action. By
default a notification stays open until it is dismissed or closed; set
`Duration` to opt into auto-close after the given span.

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
