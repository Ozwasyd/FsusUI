using Avalonia;
using Avalonia.Automation;
using Avalonia.Automation.Peers;
using Avalonia.Controls;
using Avalonia.Controls.Presenters;
using Avalonia.Headless;
using Avalonia.Headless.XUnit;
using Avalonia.Input;
using Avalonia.Markup.Xaml.Styling;
using Avalonia.Media;
using Avalonia.Media.Imaging;
using Avalonia.Styling;
using Avalonia.Themes.Fluent;
using Avalonia.Threading;
using Avalonia.VisualTree;
using FsusUI.Avalonia.Controls;
using FsusUI.Avalonia.Overlay;
using FsusUI.Avalonia.Themes;
using System.Security.Cryptography;
using System.Text.Json;
using Xunit;

namespace FsusUI.Avalonia.HeadlessTests;

public class FsusImageViewerHeadlessTests
{
  [AvaloniaFact]
  public async Task ImageViewerHeadlessRendersActiveSourceAndSwitchesIndexInMountedWindow()
  {
    var window = CreateStyledWindow();
    var host = new FsusOverlayHost();
    window.Content = host;
    window.Show();

    var viewer = new FsusImageViewer
    {
      AccessibleName = "Mounted gallery",
      Sources = { "source-1.png", "source-2.png" },
      ImageLoader = (src, _) => Task.FromResult<object?>(new Border
      {
        Width = 200,
        Height = 150,
        Child = new TextBlock { Text = $"content:{src}" },
      }),
    };

    var entry = viewer.Open(host);
    Assert.True(viewer.IsOpen);
    Assert.Single(host.OpenOverlays);

    Assert.True(await viewer.LoadActiveSourceAsync());
    Dispatcher.UIThread.RunJobs();

    Assert.Equal(FsusImageStatus.Loaded, viewer.Status);
    Assert.Contains("fsus-loaded", viewer.Classes);
    var border1 = Assert.IsType<Border>(viewer.Content);
    var text1 = Assert.IsType<TextBlock>(border1.Child);
    Assert.Equal("content:source-1.png", text1.Text);

    // Layout completes
    Assert.True(viewer.IsMeasureValid);
    Assert.True(viewer.IsArrangeValid);
    Assert.True(viewer.Bounds.Width > 0);
    Assert.True(viewer.Bounds.Height > 0);

    // Switch index
    Assert.True(await viewer.NextAsync());
    Dispatcher.UIThread.RunJobs();

    Assert.Equal(1, viewer.ActiveIndex);
    Assert.Equal("source-2.png", viewer.ActiveSource);
    var border2 = Assert.IsType<Border>(viewer.Content);
    var text2 = Assert.IsType<TextBlock>(border2.Child);
    Assert.Equal("content:source-2.png", text2.Text);

    await viewer.CloseAsync();
    window.Close();
  }

  [AvaloniaFact]
  public async Task ImageViewerHeadlessExposesLoadingLoadedAndErrorThemeClasses()
  {
    var window = CreateStyledWindow();
    var host = new FsusOverlayHost();
    window.Content = host;
    window.Show();

    var tcs = new TaskCompletionSource<object?>(TaskCreationOptions.RunContinuationsAsynchronously);
    var viewer = new FsusImageViewer
    {
      AccessibleName = "State gallery",
      Sources = { "deferred.png" },
      ImageLoader = (_, _) => tcs.Task,
    };

    viewer.Open(host);
    var loadTask = viewer.LoadActiveSourceAsync();
    Dispatcher.UIThread.RunJobs();

    Assert.Equal(FsusImageStatus.Loading, viewer.Status);
    Assert.Contains("fsus-loading", viewer.Classes);
    Assert.DoesNotContain("fsus-loaded", viewer.Classes);
    Assert.DoesNotContain("fsus-error", viewer.Classes);

    tcs.SetResult(new TextBlock { Text = "resolved" });
    Assert.True(await loadTask);
    Dispatcher.UIThread.RunJobs();

    Assert.Equal(FsusImageStatus.Loaded, viewer.Status);
    Assert.Contains("fsus-loaded", viewer.Classes);
    Assert.DoesNotContain("fsus-loading", viewer.Classes);

    viewer.ImageLoader = (_, _) => throw new InvalidOperationException("Failed to decode vector asset.");
    Assert.False(await viewer.RefreshAsync());
    Dispatcher.UIThread.RunJobs();

    Assert.Equal(FsusImageStatus.Error, viewer.Status);
    Assert.Contains("fsus-error", viewer.Classes);
    Assert.DoesNotContain("fsus-loaded", viewer.Classes);
    Assert.Equal("Failed to decode vector asset.", viewer.ErrorMessage);
    Assert.Null(viewer.Content);

    await viewer.CloseAsync();
    window.Close();
  }

  [AvaloniaFact]
  public async Task ImageViewerHeadlessCancelsStaleInFlightLoadsAndDisposesReplacedContent()
  {
    var window = CreateStyledWindow();
    var host = new FsusOverlayHost();
    window.Content = host;
    window.Show();

    var disposable1 = new DisposableControl("first");
    var disposable2 = new DisposableControl("second");
    var slowDisposable = new DisposableControl("slow-stale");

    var viewer = new FsusImageViewer
    {
      Sources = { "first.png", "second.png", "slow.png", "fast.png" },
      ImageLoader = (src, _) =>
      {
        return src switch
        {
          "first.png" => Task.FromResult<object?>(disposable1),
          "second.png" => Task.FromResult<object?>(disposable2),
          _ => Task.FromResult<object?>(null),
        };
      },
    };

    viewer.Open(host);
    Assert.True(await viewer.LoadActiveSourceAsync());
    Dispatcher.UIThread.RunJobs();
    Assert.False(disposable1.IsDisposed);

    // Change to index 1: disposable1 must be replaced and disposed
    viewer.ActiveIndex = 1;
    Assert.True(await viewer.CurrentLoadTask!);
    Dispatcher.UIThread.RunJobs();

    Assert.True(disposable1.IsDisposed);
    Assert.False(disposable2.IsDisposed);

    // Stale cancellation: slow load started, then rapidly switched to fast
    var slowStarted = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
    var slowTcs = new TaskCompletionSource<object?>(TaskCreationOptions.RunContinuationsAsynchronously);
    CancellationToken observedToken = default;

    viewer.ImageLoader = (src, token) =>
    {
      if (src == "slow.png")
      {
        observedToken = token;
        slowStarted.SetResult(true);
        return slowTcs.Task;
      }

      return Task.FromResult<object?>(new TextBlock { Text = src });
    };

    viewer.ActiveIndex = 2; // slow
    await slowStarted.Task;
    Assert.False(observedToken.IsCancellationRequested);
    var slowTask = viewer.CurrentLoadTask;

    viewer.ActiveIndex = 3; // fast
    Assert.True(observedToken.IsCancellationRequested);
    Assert.True(await viewer.CurrentLoadTask!);
    Dispatcher.UIThread.RunJobs();

    Assert.True(disposable2.IsDisposed);
    var fastContent = Assert.IsType<TextBlock>(viewer.LoadedContent);
    Assert.Equal("fast.png", fastContent.Text);

    slowTcs.SetResult(slowDisposable);
    if (slowTask is not null)
    {
      await slowTask;
    }
    Dispatcher.UIThread.RunJobs();
    Assert.True(slowDisposable.IsDisposed);
    Assert.Same(fastContent, viewer.LoadedContent);

    await viewer.CloseAsync();
    viewer.Dispose();
    window.Close();
  }

  [AvaloniaFact]
  public async Task ImageViewerHeadlessKeyboardNavigationEscapeAndFocusRestoration()
  {
    var window = CreateStyledWindow();
    var host = new FsusOverlayHost();
    var triggerButton = new Button { Content = "Open Viewer" };
    var layout = new StackPanel { Children = { triggerButton, host } };
    window.Content = layout;
    window.Show();

    Assert.True(triggerButton.Focus());
    Dispatcher.UIThread.RunJobs();
    Assert.True(triggerButton.IsFocused);

    var viewer = new KeyboardImageViewer
    {
      AccessibleName = "Headless gallery",
      Sources = { "pic-1.png", "pic-2.png", "pic-3.png" },
      ImageLoader = (src, _) => Task.FromResult<object?>(new TextBlock { Text = src }),
    };

    viewer.Open(host, triggerButton);
    Assert.True(viewer.IsOpen);
    Dispatcher.UIThread.RunJobs();

    Assert.Equal("Headless gallery", AutomationProperties.GetName(viewer));
    Assert.Equal(AutomationControlType.Image, AutomationProperties.GetControlTypeOverride(viewer));
    Assert.Equal("image 1 of 3", AutomationProperties.GetItemStatus(viewer));

    // Right key
    Assert.True(await viewer.PressAsync(Key.Right));
    Dispatcher.UIThread.RunJobs();
    Assert.Equal(1, viewer.ActiveIndex);
    Assert.Equal("pic-2.png", viewer.ActiveSource);
    Assert.Equal("image 2 of 3", AutomationProperties.GetItemStatus(viewer));

    // Left key
    Assert.True(await viewer.PressAsync(Key.Left));
    Dispatcher.UIThread.RunJobs();
    Assert.Equal(0, viewer.ActiveIndex);
    Assert.Equal("pic-1.png", viewer.ActiveSource);
    Assert.Equal("image 1 of 3", AutomationProperties.GetItemStatus(viewer));

    // Escape closes viewer and restores focus
    Assert.True(await viewer.PressAsync(Key.Escape));
    Dispatcher.UIThread.RunJobs();
    Assert.False(viewer.IsOpen);
    Assert.Empty(host.OpenOverlays);
    Assert.Same(triggerButton, host.LastRestoredFocus);

    window.Close();
  }

  [AvaloniaFact]
  public async Task ImageViewerRealPointerWheelDragCaptureCancelAndSourceSwitchContract()
  {
    var window = CreateStyledWindow();
    var viewer = new FsusImageViewer
    {
      Width = 320,
      Height = 220,
      AccessibleName = "Pointer gallery",
      MinimumZoom = 0.5,
      MaximumZoom = 2,
      ZoomFactor = 2,
      Sources = { "diagram-1.png", "diagram-2.png", "diagram-3.png" },
      ImageLoader = (source, _) => Task.FromResult<object?>(new Border
      {
        Width = 280,
        Height = 180,
        Background = Brushes.CornflowerBlue,
        Child = new TextBlock { Text = source },
      }),
    };
    var root = new Border
    {
      Width = 600,
      Height = 400,
      Padding = new Thickness(40),
      Child = viewer,
    };
    window.Content = root;
    window.Show();
    Assert.True(await viewer.LoadActiveSourceAsync());
    Arrange(window);

    var center = viewer.TranslatePoint(
      new Point(viewer.Bounds.Width / 2, viewer.Bounds.Height / 2),
      window) ?? throw new InvalidOperationException("Viewer is not attached.");

    window.MouseWheel(center, new Vector(0, 1));
    Assert.Equal(2, viewer.Zoom);
    Assert.Contains("zoom 200%", AutomationProperties.GetItemStatus(viewer));
    var zoomStatus = AutomationProperties.GetItemStatus(viewer);
    window.MouseWheel(center, new Vector(0, 1));
    Assert.Equal(2, viewer.Zoom);
    window.MouseWheel(center, new Vector(0, -1));
    window.MouseWheel(center, new Vector(0, -1));
    window.MouseWheel(center, new Vector(0, -1));
    Assert.Equal(0.5, viewer.Zoom);

    viewer.ResetTransform();
    Assert.Equal("Hand", viewer.Cursor?.ToString());
    var loadedCursor = viewer.Cursor!.ToString();
    window.MouseDown(center, MouseButton.Left);
    Assert.True(viewer.IsPanning);
    Assert.Contains("fsus-panning", viewer.Classes);
    Assert.Equal("SizeAll", viewer.Cursor?.ToString());
    var panningCursor = viewer.Cursor!.ToString();

    var outsideViewer = new Point(560, 360);
    window.MouseMove(outsideViewer, RawInputModifiers.LeftMouseButton);
    Assert.True(viewer.IsPanning);
    Assert.NotEqual(default, viewer.Translation);
    var pannedStatus = AutomationProperties.GetItemStatus(viewer);
    Assert.Contains("pan", pannedStatus);
    var capturedTranslation = viewer.Translation;

    viewer.ActiveIndex = 1;
    Assert.False(viewer.IsPanning);
    Assert.DoesNotContain("fsus-panning", viewer.Classes);
    Assert.Equal(1, viewer.Zoom);
    Assert.Equal(default, viewer.Translation);
    Assert.True(await viewer.CurrentLoadTask!);

    window.MouseWheel(center, new Vector(0, 1));
    window.MouseDown(center, MouseButton.Left);
    window.MouseMove(new Point(center.X + 24, center.Y + 18), RawInputModifiers.LeftMouseButton);
    window.MouseUp(new Point(center.X + 24, center.Y + 18), MouseButton.Left);
    Assert.False(viewer.IsPanning);
    Assert.NotEqual(default, viewer.Translation);
    viewer.PreserveTransformOnSourceChange = true;
    var preservedZoom = viewer.Zoom;
    var preservedTranslation = viewer.Translation;
    viewer.ActiveIndex = 2;
    Assert.True(await viewer.CurrentLoadTask!);
    Assert.Equal(preservedZoom, viewer.Zoom);
    Assert.Equal(preservedTranslation, viewer.Translation);

    viewer.PreserveTransformOnSourceChange = false;
    viewer.Sources[2] = "diagram-4.png";
    Assert.True(await viewer.CurrentLoadTask!);
    Assert.Equal("diagram-4.png", viewer.ActiveSource);
    Assert.Equal(1, viewer.Zoom);
    Assert.Equal(default, viewer.Translation);

    viewer.ResetTransform();
    Assert.Equal(1, viewer.Zoom);
    Assert.Equal(default, viewer.Translation);
    Assert.Equal("image 3 of 3", AutomationProperties.GetItemStatus(viewer));
    Assert.True(viewer.ClipToBounds);
    Assert.NotEqual(capturedTranslation, viewer.Translation);

    var reportPath = Path.Combine(
      FindRepositoryRoot(),
      "tests", "conformance", "visual", "artifacts",
      "issue-699-avalonia-image-viewer-automation-report.json");
    File.WriteAllText(
      reportPath,
      JsonSerializer.Serialize(
        new
        {
          schemaVersion = 1,
          issue = 699,
          generatedBy =
            "FsusImageViewerHeadlessTests.ImageViewerRealPointerWheelDragCaptureCancelAndSourceSwitchContract",
          evidenceClass = "local-headless-automation-simulation",
          notRealOsScreenReader = true,
          controlType = AutomationProperties.GetControlTypeOverride(viewer).ToString(),
          name = AutomationProperties.GetName(viewer),
          statuses = new
          {
            zoomed = zoomStatus,
            panned = pannedStatus,
            sourceReset = AutomationProperties.GetItemStatus(viewer),
          },
          preservedKeyboard = new[] { "ArrowLeft", "ArrowRight", "Escape" },
          cursors = new
          {
            loaded = loadedCursor,
            capturedDrag = panningCursor,
          },
          preservedFocusRestorationTest =
            "ImageViewerHeadlessKeyboardNavigationEscapeAndFocusRestoration",
          limitations =
            "Inspects production Avalonia automation properties under the local headless backend; no Windows UIA, macOS VoiceOver, or Linux AT-SPI session is claimed.",
        },
        new JsonSerializerOptions { WriteIndented = true }) + "\n");
    Assert.True(File.Exists(reportPath));
    window.Close();
  }

  [AvaloniaFact]
  public void ImageViewerRejectsInvalidZoomConfiguration()
  {
    var viewer = new FsusImageViewer();
    Assert.Throws<ArgumentOutOfRangeException>(() => viewer.MinimumZoom = 0);
    Assert.Throws<ArgumentOutOfRangeException>(() => viewer.MaximumZoom = 0.05);
    Assert.Throws<ArgumentOutOfRangeException>(() => viewer.ZoomFactor = 1);
    Assert.Throws<ArgumentOutOfRangeException>(() => viewer.ZoomFactor = double.NaN);
  }

  [AvaloniaFact]
  public async Task ImageViewerRealHeadlessSkiaRendersLightDarkDpiAndZoomStates()
  {
    var repositoryRoot = FindRepositoryRoot();
    var outputRoot = HeadlessVisualEvidenceOutput.ResolveOutputRoot(
      repositoryRoot,
      "issue-699-image-viewer-render");
    var captures = new List<ImageViewerRenderCapture>();
    foreach (var (theme, variant) in new[]
      {
        ("light", FsusThemeVariant.Light),
        ("dark", FsusThemeVariant.Dark),
      })
    {
      foreach (var dpi in new[] { 96, 144 })
      {
        captures.Add(await RenderStateMatrixAsync(
          repositoryRoot,
          outputRoot,
          theme,
          variant,
          dpi));
      }
    }

    Assert.Equal(4, captures.Count);
    Assert.All(captures, capture =>
    {
      Assert.Equal(64, capture.Sha256.Length);
      Assert.True(capture.PixelSize.Width > 0);
      Assert.True(capture.PixelSize.Height > 0);
      Assert.True(File.Exists(
        HeadlessVisualEvidenceOutput.ResolveRecordedPath(repositoryRoot, capture.File)));
    });

    var manifestPath = Path.Combine(
      outputRoot,
      "issue-699-avalonia-image-viewer-render-manifest.json");
    File.WriteAllText(
      manifestPath,
      JsonSerializer.Serialize(
        new
        {
          schemaVersion = 1,
          issue = 699,
          generatedBy =
            "FsusImageViewerHeadlessTests.ImageViewerRealHeadlessSkiaRendersLightDarkDpiAndZoomStates",
          outputRoot = HeadlessVisualEvidenceOutput.RecordPath(repositoryRoot, outputRoot),
          renderer = new
          {
            platform = "avalonia",
            runner = "headless-skia",
            drawingBackend = "Skia",
            productionFixture = true,
            limitations =
              "Local deterministic headless rendering; no physical display or operating-system assistive technology is claimed.",
          },
          states = new[]
          {
            "default-loaded", "wheel-zoomed", "drag-panning-captured-size-all-cursor",
            "source-reset", "viewport-clipped",
          },
          themes = new[] { "light", "dark" },
          dpi = new[] { 96, 144 },
          captures,
        },
        new JsonSerializerOptions { WriteIndented = true }) + "\n");
    Assert.True(File.Exists(manifestPath));
  }

  private static Window CreateStyledWindow()
  {
    var window = new Window
    {
      Width = 600,
      Height = 400,
      ShowInTaskbar = false,
    };
    window.Styles.Add(new FluentTheme());
    window.Styles.Add(new StyleInclude(new Uri("avares://FsusUI.Avalonia.Themes"))
    {
      Source = new Uri("avares://FsusUI.Avalonia.Themes/Themes/FsusTheme.axaml"),
    });
    return window;
  }

  private static async Task<ImageViewerRenderCapture> RenderStateMatrixAsync(
    string repositoryRoot,
    string outputRoot,
    string theme,
    FsusThemeVariant variant,
    int dpi)
  {
    var window = CreateStyledWindow();
    window.Width = 640;
    window.Height = 680;
    window.RequestedThemeVariant = variant == FsusThemeVariant.Dark
      ? ThemeVariant.Dark
      : ThemeVariant.Light;
    new FsusThemeManager().Apply(window.Resources, new FsusThemeOptions
    {
      Variant = variant,
      Density = FsusDensity.Default,
      MotionMode = FsusMotionMode.Reduced,
    });
    FsusImageViewer Viewer(string name) => new()
    {
      Width = 560,
      Height = 180,
      AccessibleName = name,
      MinimumZoom = 0.5,
      MaximumZoom = 3,
      ZoomFactor = 1.5,
      Sources = { "architecture-overview.png", "dependency-map.png" },
      ImageLoader = (source, _) => Task.FromResult<object?>(new Border
      {
        Width = 500,
        Height = 150,
        Background = variant == FsusThemeVariant.Dark
          ? new SolidColorBrush(Color.Parse("#242A35"))
          : new SolidColorBrush(Color.Parse("#E7EDF6")),
        BorderBrush = variant == FsusThemeVariant.Dark ? Brushes.LightSteelBlue : Brushes.SteelBlue,
        BorderThickness = new Thickness(2),
        Child = new TextBlock
        {
          Text = source == "architecture-overview.png"
            ? "Architecture overview · API → loader → decoded content"
            : "Dependency map · source switch reset",
          HorizontalAlignment = global::Avalonia.Layout.HorizontalAlignment.Center,
          VerticalAlignment = global::Avalonia.Layout.VerticalAlignment.Center,
          TextWrapping = TextWrapping.Wrap,
        },
      }),
    };
    var defaultViewer = Viewer("Default loaded gallery");
    var transformedViewer = Viewer("Zoomed and panned gallery");
    var resetViewer = Viewer("Source reset gallery");
    var labelBrush = Assert.IsAssignableFrom<IBrush>(
      window.Resources[FsusThemeResourceKeys.TextBrush]);
    var matrix = new StackPanel { Spacing = 8 };
    foreach (var (label, viewer) in new[]
      {
        ("Default loaded · 100% · zero translation", defaultViewer),
        ("Wheel zoom + captured drag · 150% · clipped", transformedViewer),
        ("Source switch · reset to 100% · zero translation", resetViewer),
      })
    {
      matrix.Children.Add(new TextBlock
      {
        Text = label,
        Foreground = labelBrush,
        FontSize = 12,
      });
      matrix.Children.Add(viewer);
    }
    var surface = new Border
    {
      Width = 640,
      Height = 680,
      Padding = new Thickness(40, 20),
      Background = Assert.IsAssignableFrom<IBrush>(
        window.Resources[FsusThemeResourceKeys.BackgroundBrush]),
      Child = matrix,
    };
    window.Content = surface;
    window.Show();
    Assert.True(await defaultViewer.LoadActiveSourceAsync());
    Assert.True(await transformedViewer.LoadActiveSourceAsync());
    Assert.True(await resetViewer.LoadActiveSourceAsync());
    Arrange(window);

    var center = transformedViewer.TranslatePoint(
      new Point(transformedViewer.Bounds.Width / 2, transformedViewer.Bounds.Height / 2),
      window) ?? throw new InvalidOperationException("Viewer is not attached.");
    window.MouseWheel(center, new Vector(0, 1));
    window.MouseDown(center, MouseButton.Left);
    window.MouseMove(new Point(center.X + 72, center.Y + 48), RawInputModifiers.LeftMouseButton);
    window.MouseUp(new Point(center.X + 72, center.Y + 48), MouseButton.Left);
    Assert.Equal(1.5, transformedViewer.Zoom);
    Assert.NotEqual(default, transformedViewer.Translation);
    Assert.True(transformedViewer.ClipToBounds);
    var presenter = transformedViewer
      .GetVisualDescendants()
      .OfType<ContentPresenter>()
      .Single(candidate => candidate.Name == FsusImageViewer.ContentPresenterPartName);
    Assert.IsType<MatrixTransform>(presenter.RenderTransform);

    var resetCenter = resetViewer.TranslatePoint(
      new Point(resetViewer.Bounds.Width / 2, resetViewer.Bounds.Height / 2),
      window) ?? throw new InvalidOperationException("Reset viewer is not attached.");
    window.MouseWheel(resetCenter, new Vector(0, 1));
    Assert.Equal(1.5, resetViewer.Zoom);
    resetViewer.ActiveIndex = 1;
    Assert.True(await resetViewer.CurrentLoadTask!);
    Assert.Equal(1, resetViewer.Zoom);
    Assert.Equal(default, resetViewer.Translation);
    Arrange(window);

    window.MouseDown(center, MouseButton.Left);
    window.MouseMove(new Point(center.X + 32, center.Y + 20), RawInputModifiers.LeftMouseButton);
    Assert.True(transformedViewer.IsPanning);
    Assert.Contains("fsus-panning", transformedViewer.Classes);
    Assert.Equal("SizeAll", transformedViewer.Cursor?.ToString());

    var pixelSize = new PixelSize(640 * dpi / 96, 680 * dpi / 96);
    var output = Path.Combine(outputRoot, $"issue-699-image-viewer-{theme}-{dpi}dpi.png");
    using var bitmap = new RenderTargetBitmap(pixelSize, new Vector(dpi, dpi));
    bitmap.Render(surface);
    using (var stream = File.Create(output))
    {
      bitmap.Save(stream);
    }
    window.MouseUp(new Point(center.X + 32, center.Y + 20), MouseButton.Left);
    Assert.False(transformedViewer.IsPanning);
    window.Close();

    return new ImageViewerRenderCapture(
      HeadlessVisualEvidenceOutput.RecordPath(repositoryRoot, output),
      Convert.ToHexStringLower(SHA256.HashData(File.ReadAllBytes(output))),
      new PixelDimension(pixelSize.Width, pixelSize.Height),
      theme,
      dpi,
      "default-wheel-zoomed-drag-captured-size-all-source-reset-viewport-clipped");
  }

  private static void Arrange(Window window)
  {
    window.Measure(new Size(window.Width, window.Height));
    window.Arrange(new Rect(0, 0, window.Width, window.Height));
    Dispatcher.UIThread.RunJobs();
  }

  private static string FindRepositoryRoot()
  {
    for (var directory = new DirectoryInfo(AppContext.BaseDirectory);
      directory is not null;
      directory = directory.Parent)
    {
      if (File.Exists(Path.Combine(directory.FullName, "pnpm-workspace.yaml")))
      {
        return directory.FullName;
      }
    }

    throw new DirectoryNotFoundException("Could not locate the FsusUI repository root.");
  }

  private sealed record PixelDimension(int Width, int Height);

  private sealed record ImageViewerRenderCapture(
    string File,
    string Sha256,
    PixelDimension PixelSize,
    string Theme,
    int Dpi,
    string State);

  private sealed class DisposableControl(string name) : Control, IDisposable
  {
    public string NameTag { get; } = name;
    public bool IsDisposed { get; private set; }
    public void Dispose() => IsDisposed = true;
  }

  private sealed class KeyboardImageViewer : FsusImageViewer
  {
    public ValueTask<bool> PressAsync(Key key) => HandleKeyAsync(key);
  }
}
