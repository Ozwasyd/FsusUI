# Data display

Component ID: `data-display`

## Avalonia API

Use `FsusPagination`, `FsusPaginationBar`, `FsusDescriptions`,
`FsusDescriptionsItem`, `FsusTimeline`, `FsusTimelineItem`, `FsusStatistic`,
`FsusCountdown`, and `FsusAvatar` for bounded data display. `FsusAvatar`
renders a source image or fallback content in a clipped circle or square. The
rendered surface follows the Web authority (`fsus-theme.scss` `.el-avatar`):
`color.fill.base` surface, a 1px `color.border.subtle` outline, and
`color.text.primary` foreground; the circle shape uses a full round clip and
the square shape uses the 6px control radius.

## Vue Contract Mapping

Vue pagination, descriptions, timeline, statistic, countdown, avatar, and
collapse contracts map to page values, item collections, placement/status
enums, content controls, `FsusAvatarShape`, and `FsusCollapse`
`Accordion`/`ActiveNames` state.

## Supported Platform Differences

Text baseline and keyboard focus behavior follow
`docs/avalonia/platform-differences.md`. `FsusCollapse`/`FsusCollapseItem`
follow the Web authority geometry: 52px headers with the 13px caption size at
weight 500, a 48px expanded content area with 20px inline and 25px bottom
padding, and `color.border.subtle` separators under the expanded content and
each collapsed header; the active header itself carries no bottom border.

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
