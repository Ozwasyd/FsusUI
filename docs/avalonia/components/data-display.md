# Data display

Component ID: `data-display`

## Avalonia API

Use `FsusPagination`, `FsusPaginationBar`, `FsusDescriptions`,
`FsusDescriptionsItem`, `FsusTimeline`, `FsusTimelineItem`, `FsusStatistic`,
and `FsusCountdown`.

## Vue Contract Mapping

Vue pagination, descriptions, timeline, statistic, and countdown contracts map
to page values, item collections, placement/status enums, and content controls.

## Supported Platform Differences

Text baseline and keyboard focus behavior follow
`docs/avalonia/platform-differences.md`.

## Theme Tokens

Data display controls use text, muted text, surface, border, focus, density,
and motion resources.

## Minimal Avalonia Example

```csharp
using FsusUI.Avalonia.Controls;

var pagination = new FsusPagination
{
  Page = 1,
  PageSize = 20,
  Total = 240,
};
```

## Known Limitations

Countdown timing display is presentation-only; product apps own durable timer
state.
