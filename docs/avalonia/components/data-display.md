# Data display

Component ID: `data-display`

## Avalonia API

Use `FsusPagination`, `FsusPaginationBar`, `FsusDescriptions`,
`FsusDescriptionsItem`, `FsusTimeline`, `FsusTimelineItem`, `FsusStatistic`,
`FsusCountdown`, and `FsusAvatar` for bounded data display. `FsusAvatar`
renders a source image or fallback content in a clipped circle or square.

## Vue Contract Mapping

Vue pagination, descriptions, timeline, statistic, countdown, avatar, and
collapse contracts map to page values, item collections, placement/status
enums, content controls, `FsusAvatarShape`, and `FsusCollapse`
`Accordion`/`ActiveNames` state.

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
