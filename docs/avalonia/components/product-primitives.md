# Product primitives

Component ID: `product-primitives`

## Avalonia API

Use settings primitives, metric primitives, and inbox primitives such as
`FsusSettingsSection`, `FsusDangerZone`, `FsusMetricList`,
`FsusStatusSummary`, `FsusCopyableDetail`, `FsusInboxLayout`, and
`FsusThreadPanel`. `FsusCopyableDetail.IsDisabled` maps to the native Avalonia
disabled state and prevents `Copy()` from returning the protected value.

## Vue Contract Mapping

Vue product slots map to typed records and content controls for settings,
danger actions, metrics, key/value data, diagnostics, conversations, and
reply composition.

## Supported Platform Differences

See [`docs/avalonia/platform-differences.md`](../platform-differences.md) for dense layout, text
metrics, and keyboard focus.

## Theme Tokens

Product primitives use surface, border, text, muted-text, danger, focus, and
density resources from [Application Setup](../installation.md#application-setup);
see [Avalonia Motion Runtime](../motion-runtime.md) for motion. Copyable detail
targets are at least 40px on desktop and 44px on mobile; disabled styling keeps
full control opacity and the standard 2px focus border remains visible for
enabled keyboard users.

## Minimal Avalonia Example

```csharp
using FsusUI.Avalonia.Controls;

var metrics = new FsusMetricList { AccessibleName = "Usage metrics" };
metrics.Items.Add(new FsusMetricItem("Requests", "12,430", "Last hour", "Stable"));
```

## Known Limitations

Product primitives are layout and interaction shells; business data loading
stays in the app.
