# Text viewer

Component ID: `text-viewer`

## Avalonia API

Use `FsusTextViewer`, `FsusTextContentBlock`, `FsusTextBlockKind`, and text
viewer budget records for large read-only content.

## Vue Contract Mapping

Vue markdown or article viewer concepts map to a sanitized block model,
heading levels, copied text, search highlights, and render budgets.

## Supported Platform Differences

See [`docs/avalonia/platform-differences.md`](../platform-differences.md) for text measurement, wrapping, and baseline thresholds.

## Theme Tokens

Use text, muted-text, surface, border, focus, and density resources from [Application Setup](../installation.md#application-setup); motion behavior is defined in [Avalonia Motion Runtime](../motion-runtime.md).

## Accessibility

The production document automation metadata exposes an item-status summary of
the current rendered block count, mixed-language state, and keyboard focus
position without claiming an editable value pattern. Up and Down keys move the
block focus used by that summary.

## Minimal Avalonia Example

```csharp
using FsusUI.Avalonia.Controls;

var viewer = new FsusTextViewer { AccessibleName = "Release notes" };
viewer.Blocks.Add(new FsusTextContentBlock(FsusTextBlockKind.Heading, "Changes", 1));
```

## Known Limitations

Parsing untrusted markdown is not included; pass sanitized blocks.
