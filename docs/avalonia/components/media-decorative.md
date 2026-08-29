# Media and decorative

Component ID: `media-decorative`

## Avalonia API

Use `FsusImage`, `FsusImageViewer`, `FsusCarousel`, `FsusCarouselItem`, and
`FsusWatermark` for image state, preview surfaces, carousel content, and
decorative watermark overlays.

## Vue Contract Mapping

Vue image fit, load state, preview, carousel item, and watermark props map to
typed Avalonia control properties and overlay lifecycle.

## Supported Platform Differences

Image decoding, overlay focus, and text watermark rendering follow
`docs/avalonia/platform-differences.md`.

## Theme Tokens

Media controls use surface, border, text, muted text, focus, density, and
motion resources.

## Minimal Avalonia Example

```csharp
using System.Threading;
using System.Threading.Tasks;
using Avalonia.Controls;
using FsusUI.Avalonia.Controls;

var viewer = new FsusImageViewer
{
  AccessibleName = "Document gallery",
  Sources = { "invoice-1.png", "diagram.svg" },
  ImageLoader = async (source, cancellationToken) =>
  {
    // App-provided loader renders raster images, SVGs, data URIs, or custom controls
    return new TextBlock { Text = $"Preview: {source}" };
  },
};
```

## Known Limitations

Remote image fetching and cache policy are app concerns.
