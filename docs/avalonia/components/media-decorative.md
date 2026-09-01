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
  MinimumZoom = 0.1,
  MaximumZoom = 10,
  ZoomFactor = 1.1,
  Sources = { "invoice-1.png", "diagram.svg" },
  ImageLoader = async (source, cancellationToken) =>
  {
    // App-provided loader renders raster images, SVGs, data URIs, or custom controls
    return new TextBlock { Text = $"Preview: {source}" };
  },
};

viewer.TransformChanged += (_, args) =>
  Console.WriteLine($"Zoom {args.Zoom:P0}, pan {args.Translation}");
viewer.ResetTransform();
```

## Viewer interaction

`FsusImageViewer` zooms decoded content with the pointer wheel by multiplying or
dividing `Zoom` by `ZoomFactor`, clamped to `MinimumZoom` and `MaximumZoom`.
Primary-pointer drag captures the pointer until release or cancellation and
updates `Translation`; `Zoom`, `Translation`, `IsPanning`, and
`TransformChanged` expose the current interaction state. `ResetTransform()`
restores the bounded 1x state and zero translation.

Changing `ActiveSource` resets the transform by default. Set
`PreserveTransformOnSourceChange` to retain it deliberately. Transformed
content remains clipped to the viewer viewport. These interactions do not
change app ownership of decoded content through `ImageLoader`,
`IFsusImageLoader`, or `ContentFactory`, and they preserve Escape dismissal,
Left/Right navigation, opener focus restoration, and image status automation.

## Known Limitations

Remote image fetching and cache policy are app concerns.
