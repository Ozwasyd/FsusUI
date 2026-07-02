# Service helper

Component ID: `service-helper`

## Avalonia API

Use `FsusMessageService`, `FsusNotificationService`, `FsusLoadingService`,
`FsusMessageToast`, `FsusNotification`, `FsusLoadingOverlay`, `FsusAffix`, and
`FsusBacktop`.

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
