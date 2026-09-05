# Display

Component ID: `display`

## Avalonia API

Use `FsusProgress`, `FsusSkeleton`, `FsusEmpty`, `FsusResult`, and `FsusAlert`
for progress, loading placeholders, empty states, and result feedback.

## Vue Contract Mapping

Vue display props map to `Value`, `Maximum`, `Title`, `Description`,
`AccessibleName`, animation policy, and content properties.

## Supported Platform Differences

See [`docs/avalonia/platform-differences.md`](../platform-differences.md) for animation reduction and text-measurement boundaries.

## Theme Tokens

Use text, muted-text, loading, disabled, danger, surface, border, and density resources from [Application Setup](../installation.md#application-setup); motion behavior is defined in [Avalonia Motion Runtime](../motion-runtime.md).

## Accessibility

`FsusAlert` exposes an assertive live-region alert role. Its accessible name
comes from the current title or content, so assistive technology observes the
same message that the control presents without an editable value pattern.

## Minimal Avalonia Example

```csharp
using FsusUI.Avalonia.Controls;

var empty = new FsusEmpty
{
  Title = "No invoices",
  Description = "Create an invoice to start billing.",
};
```

## Known Limitations

Illustration slots do not load remote Web assets automatically.
