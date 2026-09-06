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

`FsusProgress` renders the Web thin-bar contract: a 4px-high track on
`color.fill.base` with a full-round 2px radius, no border, and the indicator
in `color.action.primary` (`#16A34A` for `fsus-success`, `#DC2626` for
`fsus-danger`); the percentage text stays hidden unless `ShowText` is set.
`FsusSkeleton` fills with `color.fill.base` at a 2px radius without an
outline. `FsusAlert` follows the Web `is-light` authority: transparent
surface, a full-height 4px semantic stripe (`#166534`, `#92400E`, `#991B1B`,
or scholarly primary), a 500-weight title, and a description row revealed only
when `Description` is set (`fsus-has-description`). Cross-platform
element-crop evidence is registered in
`tests/conformance/visual/fixtures/visual-comparisons.json`
(`alert-vue-parity-web-avalonia`, `progress-vue-parity-web-avalonia`,
`skeleton-vue-parity-web-avalonia`, `empty-vue-parity-web-avalonia`).

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
