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

See [`docs/avalonia/platform-differences.md`](../platform-differences.md) for text baselines and
keyboard focus. `FsusTag` and `FsusBadge` follow the Web authority: the tag
renders an 11px/700 label in the quiet primary mix (`#596986`) on the
near-paper fill with a 1px light outline, and the `is-dot` badge paints a 10px
danger dot with a 2px surface ring overhanging the host's top-right corner.
Cross-platform element-crop evidence is registered in
`tests/conformance/visual/fixtures/visual-comparisons.json`
(`tag-vue-parity-web-avalonia`, `badge-vue-parity-web-avalonia`). `FsusCollapse`/`FsusCollapseItem` retain the Web geometry: 52px
headers with 13px/500 captions, a 48px expanded area with 20px inline and 25px
bottom padding, and `color.border.subtle` separators under expanded content
and each collapsed header; the active header has no bottom border.

## Theme Tokens

Use text, muted-text, surface, border, focus, and density resources from
[Application Setup](../installation.md#application-setup); motion behavior is
defined in [Avalonia Motion Runtime](../motion-runtime.md).

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
