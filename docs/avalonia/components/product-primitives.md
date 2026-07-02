# Product primitives

Component ID: `product-primitives`

## Avalonia API

Use settings primitives, metric primitives, and inbox primitives such as
`FsusSettingsSection`, `FsusDangerZone`, `FsusMetricList`,
`FsusStatusSummary`, `FsusInboxLayout`, and `FsusThreadPanel`.

## Vue Contract Mapping

Vue product slots map to typed records and content controls for settings,
danger actions, metrics, key/value data, diagnostics, conversations, and
reply composition.

## Supported Platform Differences

Dense product layout, text metrics, and keyboard focus follow
`docs/avalonia/platform-differences.md`.

## Theme Tokens

Product primitives use surface, border, text, muted text, danger, focus,
density, and motion resources.

## Minimal Avalonia Example

```csharp
using FsusUI.Avalonia.Controls;

var metrics = new FsusMetricList { AccessibleName = "Usage metrics" };
metrics.Items.Add(new FsusMetricItem("Requests", "12,430", "Last hour", "Stable"));
```

## Known Limitations

Product primitives are layout and interaction shells; business data loading
stays in the app.
