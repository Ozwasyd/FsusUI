using Avalonia;
using Avalonia.Automation;
using Avalonia.Automation.Peers;
using Avalonia.Controls;
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

  [Fact]
  public async Task ImageViewerRendersActiveSourceThroughImageLoaderAndUpdatesOnIndexChange()
  {
    var viewer = new FsusImageViewer
    {
      Sources = { "cat.png", "dog.svg", "data:image/png;base64,AAA" },
      ImageLoader = (source, _) => Task.FromResult<object?>(new TextBlock { Text = $"rendered:{source}" }),
    };

    Assert.Equal("cat.png", viewer.ActiveSource);
    Assert.True(await viewer.LoadActiveSourceAsync());
    Assert.Equal(FsusImageStatus.Loaded, viewer.Status);
    Assert.Contains("fsus-loaded", viewer.Classes);
    var content1 = Assert.IsType<TextBlock>(viewer.Content);
    Assert.Equal("rendered:cat.png", content1.Text);
    Assert.Same(content1, viewer.LoadedContent);

    viewer.ActiveIndex = 1;
    Assert.Equal("dog.svg", viewer.ActiveSource);
    Assert.NotNull(viewer.CurrentLoadTask);
    Assert.True(await viewer.CurrentLoadTask!);
    Assert.Equal(FsusImageStatus.Loaded, viewer.Status);
    var content2 = Assert.IsType<TextBlock>(viewer.Content);
    Assert.Equal("rendered:dog.svg", content2.Text);

    viewer.ActiveIndex = 2;
    Assert.Equal("data:image/png;base64,AAA", viewer.ActiveSource);
    Assert.NotNull(viewer.CurrentLoadTask);
    Assert.True(await viewer.CurrentLoadTask!);
    var content3 = Assert.IsType<TextBlock>(viewer.Content);
    Assert.Equal("rendered:data:image/png;base64,AAA", content3.Text);
  }

  [Fact]
  public async Task ImageViewerExposesLoadingLoadedAndErrorStatesWithClassNames()
  {
    var tcs = new TaskCompletionSource<object?>(TaskCreationOptions.RunContinuationsAsynchronously);
    var viewer = new FsusImageViewer
    {
      Sources = { "pending.png" },
      ImageLoader = (_, _) => tcs.Task,
    };

    var loadTask = viewer.LoadActiveSourceAsync();
    Assert.Equal(FsusImageStatus.Loading, viewer.Status);
    Assert.Contains("fsus-loading", viewer.Classes);
    Assert.DoesNotContain("fsus-loaded", viewer.Classes);
    Assert.DoesNotContain("fsus-error", viewer.Classes);
    Assert.DoesNotContain("fsus-idle", viewer.Classes);

    tcs.SetResult(new TextBlock { Text = "done" });
    Assert.True(await loadTask);
    Assert.Equal(FsusImageStatus.Loaded, viewer.Status);
    Assert.Contains("fsus-loaded", viewer.Classes);
    Assert.DoesNotContain("fsus-loading", viewer.Classes);
    Assert.Null(viewer.ErrorMessage);

    viewer.ImageLoader = (_, _) => throw new InvalidOperationException("Failed to decode image stream.");
    Assert.False(await viewer.RefreshAsync());
    Assert.Equal(FsusImageStatus.Error, viewer.Status);
    Assert.Contains("fsus-error", viewer.Classes);
    Assert.DoesNotContain("fsus-loading", viewer.Classes);
    Assert.DoesNotContain("fsus-loaded", viewer.Classes);
    Assert.Equal("Failed to decode image stream.", viewer.ErrorMessage);
    Assert.Null(viewer.LoadedContent);
  }

  [Fact]
  public async Task ImageViewerCancelsStaleInFlightLoadsAndDisposesReplacedContent()
  {
    var disposable1 = new DisposableControl("first");
    var disposable2 = new DisposableControl("second");
    var disposableStale = new DisposableControl("stale");

    var viewer = new FsusImageViewer
    {
      Sources = { "first.png", "second.png", "slow.png", "fast.png" },
    };

    viewer.ImageLoader = (source, _) =>
    {
      return source switch
      {
        "first.png" => Task.FromResult<object?>(disposable1),
        "second.png" => Task.FromResult<object?>(disposable2),
        _ => Task.FromResult<object?>(null),
      };
    };

    Assert.True(await viewer.LoadActiveSourceAsync());
    Assert.Same(disposable1, viewer.LoadedContent);
    Assert.False(disposable1.IsDisposed);

    // Navigating to second replaces and disposes first
    viewer.ActiveIndex = 1;
    Assert.True(await viewer.CurrentLoadTask!);
    Assert.Same(disposable2, viewer.LoadedContent);
    Assert.True(disposable1.IsDisposed, "Replaced content must be disposed.");
    Assert.False(disposable2.IsDisposed);

    // Stale in-flight load cancellation:
    var slowStarted = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
    var slowTcs = new TaskCompletionSource<object?>(TaskCreationOptions.RunContinuationsAsynchronously);
    CancellationToken observedToken = default;

    viewer.ImageLoader = (source, token) =>
    {
      if (source == "slow.png")
      {
        observedToken = token;
        slowStarted.SetResult(true);
        return slowTcs.Task;
      }

      return Task.FromResult<object?>(new TextBlock { Text = source });
    };

    viewer.ActiveIndex = 2; // slow.png
    await slowStarted.Task;
    Assert.False(observedToken.IsCancellationRequested);
    var slowTask = viewer.CurrentLoadTask;

    // Immediately switch to fast.png before slow completes
    viewer.ActiveIndex = 3; // fast.png
    Assert.True(observedToken.IsCancellationRequested, "Stale load token must be cancelled.");
    Assert.True(await viewer.CurrentLoadTask!);
    var fastContent = Assert.IsType<TextBlock>(viewer.LoadedContent);
    Assert.Equal("fast.png", fastContent.Text);
    Assert.True(disposable2.IsDisposed, "Replaced second item must be disposed.");

    // Even if the stale task finishes afterwards, its disposable content must be disposed and not applied
    slowTcs.SetResult(disposableStale);
    if (slowTask is not null)
    {
      await slowTask;
    }
    Assert.True(disposableStale.IsDisposed, "Cancelled in-flight result must be disposed.");
    Assert.Same(fastContent, viewer.LoadedContent);

    // Explicit Dispose on viewer disposes active content
    var disposableFinal = new DisposableControl("final");
    viewer.ImageLoader = (_, _) => Task.FromResult<object?>(disposableFinal);
    Assert.True(await viewer.RefreshAsync());
    Assert.Same(disposableFinal, viewer.LoadedContent);
    Assert.False(disposableFinal.IsDisposed);

    viewer.Dispose();
    Assert.True(disposableFinal.IsDisposed, "Viewer Dispose must dispose active content.");
    Assert.Null(viewer.LoadedContent);
  }

  [Fact]
  public async Task ImageViewerPreservesNavigationFocusRestorationAndAccessibilityState()
  {
    var host = new FsusOverlayHost();
    var restoreTarget = new Button { Content = "Trigger button" };
    var events = new List<(string Source, int Index)>();

    var viewer = new KeyboardImageViewer
    {
      AccessibleName = "Document gallery",
      Sources = { "doc1.png", "doc2.png", "doc3.png" },
      ImageLoader = (source, _) => Task.FromResult<object?>(new TextBlock { Text = source }),
    };
    viewer.ActiveSourceChanged += (_, e) => events.Add((e.Source, e.Index));

    var entry = viewer.Open(host, restoreTarget);
    Assert.Same(entry, viewer.OverlayEntry);
    Assert.True(viewer.IsOpen);
    Assert.Contains("fsus-open", viewer.Classes);
    Assert.Equal("Document gallery", AutomationProperties.GetName(viewer));
    Assert.Equal(AutomationControlType.Image, AutomationProperties.GetControlTypeOverride(viewer));
    Assert.Equal("image 1 of 3", AutomationProperties.GetItemStatus(viewer));

    // Right navigation
    Assert.True(await viewer.PressAsync(Key.Right));
    Assert.Equal(1, viewer.ActiveIndex);
    Assert.Equal("doc2.png", viewer.ActiveSource);
    Assert.Equal("image 2 of 3", AutomationProperties.GetItemStatus(viewer));

    // Left navigation
    Assert.True(await viewer.PressAsync(Key.Left));
    Assert.Equal(0, viewer.ActiveIndex);
    Assert.Equal("doc1.png", viewer.ActiveSource);
    Assert.Equal("image 1 of 3", AutomationProperties.GetItemStatus(viewer));

    // Escape closes overlay and restores focus
    Assert.True(await viewer.PressAsync(Key.Escape));
    Assert.False(viewer.IsOpen);
    Assert.DoesNotContain("fsus-open", viewer.Classes);
    Assert.Empty(host.OpenOverlays);
    Assert.Same(restoreTarget, host.LastRestoredFocus);

    // Verify ActiveSourceChanged fired for each navigation
    Assert.Equal(2, events.Count);
    Assert.Equal(("doc2.png", 1), events[0]);
    Assert.Equal(("doc1.png", 0), events[1]);
  }

  [Fact]
  public async Task ImageViewerSupportsCustomSourceLoaderAndImageOpenPreviewIntegration()
  {
    var customLoader = new CustomImageLoader();
    var viewer = new FsusImageViewer
    {
      Sources = { "vector.svg", "encoded.data", "normal.png" },
      SourceLoader = customLoader,
    };

    Assert.True(await viewer.LoadActiveSourceAsync());
    var svg = Assert.IsType<Border>(viewer.LoadedContent);
    Assert.Equal("svg-vector", svg.Tag);

    viewer.ActiveIndex = 1;
    Assert.True(await viewer.CurrentLoadTask!);
    var data = Assert.IsType<TextBlock>(viewer.LoadedContent);
    Assert.Equal("data-decoded:encoded.data", data.Text);

    // Test ContentFactory fallback
    var factoryViewer = new FsusImageViewer
    {
      Sources = { "factory-item" },
      ContentFactory = src => new TextBlock { Text = $"factory:{src}" },
    };
    Assert.True(await factoryViewer.LoadActiveSourceAsync());
    var factoryContent = Assert.IsType<TextBlock>(factoryViewer.LoadedContent);
    Assert.Equal("factory:factory-item", factoryContent.Text);

    // Test FsusImage.OpenPreview with PreviewLoader
    var host = new FsusOverlayHost();
    var image = new FsusImage
    {
      Source = "preview-target.png",
      PreviewLoader = (src, _) => Task.FromResult<object?>(new TextBlock { Text = $"preview:{src}" }),
    };

    var previewViewer = image.OpenPreview(host);
    Assert.NotNull(previewViewer);
    Assert.NotNull(previewViewer!.ImageLoader);
    Assert.True(await previewViewer.CurrentLoadTask!);
    var previewContent = Assert.IsType<TextBlock>(previewViewer.LoadedContent);
    Assert.Equal("preview:preview-target.png", previewContent.Text);
  }

  private sealed class DisposableControl(string tag) : Control, IDisposable
  {
    public string TagName { get; } = tag;
    public bool IsDisposed { get; private set; }
    public void Dispose() => IsDisposed = true;
  }

  private sealed class CustomImageLoader : IFsusImageLoader
  {
    public Task<object?> LoadAsync(string source, CancellationToken cancellationToken)
    {
      if (source.EndsWith(".svg", StringComparison.Ordinal))
      {
        return Task.FromResult<object?>(new Border { Tag = "svg-vector" });
      }

      if (source.EndsWith(".data", StringComparison.Ordinal))
      {
        return Task.FromResult<object?>(new TextBlock { Text = $"data-decoded:{source}" });
      }

      return Task.FromResult<object?>(new TextBlock { Text = $"raster:{source}" });
    }
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
