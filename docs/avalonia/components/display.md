# Display

Component ID: `display`

## Avalonia API

Use `FsusProgress`, `FsusSkeleton`, `FsusEmpty`, `FsusResult`, and `FsusAlert`
for progress, loading placeholders, empty states, and result feedback.

## Vue Contract Mapping

Vue display props map to `Value`, `Maximum`, `Title`, `Description`,
`AccessibleName`, animation policy, and content properties.

## Supported Platform Differences

Animation reduction and text measurement follow
`docs/avalonia/platform-differences.md`.

## Theme Tokens

Display controls use text, muted text, loading, disabled, danger, surface,
border, density, and motion tokens.

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
