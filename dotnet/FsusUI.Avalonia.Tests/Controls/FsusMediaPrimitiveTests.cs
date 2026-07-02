using Avalonia;
using Avalonia.Automation;
using Avalonia.Automation.Peers;
using Avalonia.Input;
using FsusUI.Avalonia.Controls;
using FsusUI.Avalonia.Overlay;
using System.Runtime.CompilerServices;

namespace FsusUI.Avalonia.Tests.Controls;

public class FsusMediaPrimitiveTests
{
  [Fact]
  public async Task ImageUsesAdapterSuccessErrorFallbackAndPreviewOverlayRestoresFocus()
  {
    var host = new FsusOverlayHost();
    var image = new FsusImage
    {
      AccessibleName = "Release screenshot",
      Source = "release.png",
      Fit = FsusImageFit.Cover,
      Loader = (source, _) => ValueTask.FromResult(FsusImageLoadResult.Success(source, new Size(640, 360))),
    };

    Assert.True(await image.LoadAsync());

    Assert.Equal(FsusImageStatus.Loaded, image.Status);
    Assert.Equal(new Size(640, 360), image.NaturalSize);
    Assert.Contains("fsus-loaded", image.Classes);

    var viewer = image.OpenPreview(host);

    Assert.NotNull(viewer);
    Assert.True(viewer!.IsOpen);
    Assert.Single(host.OpenOverlays);
    Assert.Equal("release.png", viewer.ActiveSource);

    Assert.True(await viewer.CloseAsync());
    Assert.Empty(host.OpenOverlays);
    Assert.Equal(image, host.LastRestoredFocus);

    var error = new FsusImage
    {
      AccessibleName = "Broken image",
      Source = "missing.png",
      FallbackText = "Image unavailable",
      Loader = (_, _) => ValueTask.FromResult(FsusImageLoadResult.Failure("404")),
    };

    Assert.False(await error.LoadAsync());
    Assert.Equal(FsusImageStatus.Error, error.Status);
    Assert.Equal("404", error.ErrorMessage);
    Assert.Equal("Image unavailable", error.DisplayText);
    Assert.Contains("fsus-error", error.Classes);
    Assert.Equal(AutomationControlType.Image, AutomationProperties.GetControlTypeOverride(error));
  }

  [Fact]
  public async Task ImageViewerSupportsGalleryKeyboardNavigationAndEscapeClose()
  {
    var host = new FsusOverlayHost();
    var viewer = new KeyboardImageViewer
    {
      AccessibleName = "Gallery",
      Sources = { "one.png", "two.png", "three.png" },
      ActiveIndex = 0,
    };

    viewer.Open(host);

    Assert.True(viewer.IsOpen);
    Assert.Equal("one.png", viewer.ActiveSource);

    Assert.True(await viewer.PressAsync(Key.Right));
    Assert.Equal(1, viewer.ActiveIndex);
    Assert.Equal("two.png", viewer.ActiveSource);

    Assert.True(await viewer.PressAsync(Key.Left));
    Assert.Equal(0, viewer.ActiveIndex);

    Assert.True(await viewer.PressAsync(Key.Escape));
    Assert.False(viewer.IsOpen);
    Assert.Empty(host.OpenOverlays);
    Assert.Equal(AutomationControlType.Image, AutomationProperties.GetControlTypeOverride(viewer));
  }

  [Fact]
  public void CarouselNavigatesAndDisablesAutoplayWhenReducedMotion()
  {
    var carousel = new FsusCarousel
    {
      AccessibleName = "Launch carousel",
      Autoplay = true,
      ReducedMotion = true,
    };
    carousel.Items.Add(new FsusCarouselItem("One"));
    carousel.Items.Add(new FsusCarouselItem("Two"));
    carousel.Items.Add(new FsusCarouselItem("Three"));
    carousel.RefreshItems();

    Assert.Equal(0, carousel.ActiveIndex);
    Assert.True(carousel.Next());
    Assert.Equal(1, carousel.ActiveIndex);
    Assert.True(carousel.Previous());
    Assert.Equal(0, carousel.ActiveIndex);

    Assert.False(carousel.AdvanceAutoplayTick());
    Assert.Contains("fsus-motion-reduced", carousel.Classes);

    carousel.ReducedMotion = false;

    Assert.True(carousel.AdvanceAutoplayTick());
    Assert.Equal(1, carousel.ActiveIndex);
    Assert.Equal(AutomationControlType.Group, AutomationProperties.GetControlTypeOverride(carousel));
    Assert.Equal("slide 2 of 3", AutomationProperties.GetItemStatus(carousel));
  }

  [Fact]
  public void WatermarkComputesDeterministicTilesAndThemeVisualAccessibilityBaselines()
  {
    var watermark = new FsusWatermark
    {
      AccessibleName = "Draft watermark",
      ContentText = "DRAFT",
      Gap = new Size(120, 80),
      Offset = new Point(20, 10),
      Viewport = new Size(360, 220),
      Rotate = -22,
    };

    watermark.RefreshTiles();

    Assert.Equal(12, watermark.Tiles.Count);
    Assert.Equal(new Point(20, 10), watermark.Tiles[0].Origin);
    Assert.Contains("fsus-watermark", watermark.Classes);
    Assert.Equal(AutomationControlType.Group, AutomationProperties.GetControlTypeOverride(watermark));

    var media = ReadControlTheme("Media.axaml");
    foreach (var selector in new[]
    {
      "fsus|FsusImage",
      "fsus|FsusImageViewer",
      "fsus|FsusCarousel",
      "fsus|FsusCarouselItem",
      "fsus|FsusWatermark",
    })
    {
      Assert.Contains(selector, media);
    }

    Assert.Contains("FsusThemeMediaSurfaceBrush", media);
    Assert.Contains("FsusMotionDurationEffective", media);

    var visualFixture = File.ReadAllText(Path.Combine(
      RepositoryRoot(),
      "tests",
      "conformance",
      "visual",
      "fixtures",
      "visual-comparisons.json"));
    Assert.Contains("media-decorative-stable32-web-avalonia", visualFixture);

    var accessibilityEvidence = File.ReadAllText(Path.Combine(
      RepositoryRoot(),
      "tests",
      "conformance",
      "accessibility",
      "automation-snapshots.json"));
    Assert.Contains("media-decorative-stable32", accessibilityEvidence);
  }

  private sealed class KeyboardImageViewer : FsusImageViewer
  {
    public ValueTask<bool> PressAsync(Key key) => HandleKeyAsync(key);
  }

  private static string ReadControlTheme(string fileName) =>
    File.ReadAllText(Path.Combine(
      RepositoryRoot(),
      "dotnet",
      "FsusUI.Avalonia.Themes",
      "Themes",
      "Controls",
      fileName));

  private static string RepositoryRoot([CallerFilePath] string sourceFile = "")
  {
    var candidates = new[]
    {
      Path.GetDirectoryName(sourceFile) ?? string.Empty,
      Directory.GetCurrentDirectory(),
      AppContext.BaseDirectory,
      Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "..")),
    };

    foreach (var candidate in candidates)
    {
      var directory = new DirectoryInfo(candidate);
      while (directory is not null)
      {
        if (
          Directory.Exists(Path.Combine(directory.FullName, ".git")) ||
          File.Exists(Path.Combine(directory.FullName, "dotnet", "FsusUI.Avalonia.slnx")))
        {
          return directory.FullName;
        }

        directory = directory.Parent;
      }
    }

    throw new InvalidOperationException("Could not locate repository root.");
  }
}
