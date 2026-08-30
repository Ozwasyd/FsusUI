using Avalonia;
using Avalonia.Automation;
using Avalonia.Automation.Peers;
using Avalonia.Controls;
using Avalonia.Interactivity;
using Avalonia.LogicalTree;
using Avalonia.Media;
using Avalonia.Media.Imaging;
using Avalonia.Headless.XUnit;
using FsusUI.Avalonia.Controls;
using FsusUI.Avalonia.Themes;
using System.Security.Cryptography;
using System.Runtime.InteropServices;
using System.Text.Json;

namespace FsusUI.Avalonia.HeadlessTests;

public class FsusPerceptionCharacterChallengeHeadlessTests
{
  [Fact]
  public void InstantiatedCharacterChallengeExposesAutomationAndUserInitiatedAlternative()
  {
    using var challenge = CreateChallenge();
    var audioRequests = 0;
    challenge.AudioRequested += (_, _) => audioRequests++;
    var controls = challenge.GetLogicalDescendants().OfType<Control>().ToList();
    var label = Find(controls, "character-response-label");
    var response = Find(controls, "character-response");
    var status = Find(controls, "character-status");
    var error = Find(controls, "character-error");
    var alternative = Assert.IsType<Button>(Find(controls, "character-audio-alternative"));

    Assert.Equal(0, audioRequests);
    Assert.Same(label, AutomationProperties.GetLabeledBy(response));
    Assert.Equal("Use the replacement image", AutomationProperties.GetHelpText(response));
    Assert.Equal(AutomationLiveSetting.Polite, AutomationProperties.GetLiveSetting(status));
    Assert.Equal(AutomationLiveSetting.Assertive, AutomationProperties.GetLiveSetting(error));
    var focusOrder = controls
      .Where(control => control.Focusable && control.IsVisible && control.IsEffectivelyEnabled)
      .Select(AutomationProperties.GetAutomationId)
      .Where(id => !string.IsNullOrEmpty(id))
      .Select(id => id!)
      .ToArray();
    Assert.Equal(
      ["character-audio-alternative", "character-refresh", "character-response", "character-submit", "character-retry"],
      focusOrder);

    alternative.RaiseEvent(new RoutedEventArgs(Button.ClickEvent));

    Assert.Equal(1, audioRequests);
    Assert.Equal(FsusPerceptionCharacterMode.Audio, challenge.ActiveMode);
  }

  [Theory]
  [InlineData(320)]
  [InlineData(160)]
  public void CharacterChallengeMeasuresAndArrangesAtZoomEquivalentWidths(double width)
  {
    using var challenge = CreateChallenge();

    challenge.Measure(new Size(width, double.PositiveInfinity));
    challenge.Arrange(new Rect(0, 0, width, challenge.DesiredSize.Height));

    Assert.True(challenge.DesiredSize.Width <= width);
    Assert.Equal(width, challenge.Bounds.Width);
    var visibleIds = challenge.GetLogicalDescendants()
      .OfType<Control>()
      .Where(control => control.IsVisible)
      .Select(AutomationProperties.GetAutomationId)
      .Where(id => !string.IsNullOrEmpty(id))
      .Select(id => id!)
      .ToHashSet(StringComparer.Ordinal);
    Assert.Subset(
      new HashSet<string>(
        [
          "character-prompt",
          "character-status",
          "character-error",
          "character-audio-alternative",
          "character-refresh",
          "character-response-label",
          "character-response",
          "character-submit",
          "character-retry",
        ],
        StringComparer.Ordinal),
      visibleIds);
    Assert.All(
      challenge.GetLogicalDescendants().OfType<WrapPanel>(),
      panel => Assert.True(panel.DesiredSize.Width <= width));
  }

  [AvaloniaFact]
  public void DisabledStateIsDisabledForAutomation()
  {
    using var challenge = CreateChallenge();
    challenge.State = FsusPerceptionChallengeState.Disabled;
    var window = new Window { Content = challenge, Width = 420, Height = 640 };
    window.Show();
    var peer = Assert.IsAssignableFrom<AutomationPeer>(ControlAutomationPeer.CreatePeerForElement(challenge));

    Assert.Contains("PerceptionChallengeAutomationPeer", peer.GetType().FullName);
    Assert.False(challenge.IsEffectivelyEnabled);
    Assert.False(peer.IsEnabled());
    Assert.Equal("disabled, character, disabled, retries 0", AutomationProperties.GetItemStatus(challenge));
    window.Close();
  }

  [AvaloniaFact]
  public void RealHeadlessSkiaRenderProducesEightStateContrastAndZoomEvidence()
  {
    GenerateRealHeadlessSkiaEvidence();
  }

  private static void GenerateRealHeadlessSkiaEvidence()
  {
    var repositoryRoot = FindRepositoryRoot();
    var outputRoot = HeadlessVisualEvidenceOutput.ResolveOutputRoot(
      repositoryRoot,
      "perception-character-challenge");

    var captures = new List<RenderCapture>
    {
      RenderStateOverview(outputRoot, highContrast: false),
      RenderStateOverview(outputRoot, highContrast: true),
      RenderNarrowWidth(outputRoot, 380, 200),
      RenderNarrowWidth(outputRoot, 190, 400),
    };

    Assert.All(captures, capture =>
    {
      Assert.True(File.Exists(
        HeadlessVisualEvidenceOutput.ResolveRecordedPath(repositoryRoot, capture.File)));
      Assert.True(capture.PixelSize.Width > 0);
      Assert.True(capture.PixelSize.Height > 0);
      Assert.Equal(64, capture.Sha256.Length);
      Assert.True(capture.NonBackgroundPixelRatio > 0.01);
      Assert.All(capture.ControlRegionNonBackgroundRatios, ratio => Assert.True(ratio > 0.002));
      Assert.All(capture.ControlBorderNonBackgroundRatios, ratio => Assert.True(ratio > 0.01));
      Assert.All(capture.CriticalControls, control =>
      {
        Assert.True(control.RegionNonBackgroundRatio > 0.01);
        Assert.True(control.BorderNonBackgroundRatio > 0.01);
        if (control.AutomationId == "character-raster")
        {
          Assert.True(control.QuantizedColorCount >= 2);
          Assert.True(control.MinorityColorPixelRatio > 0.05);
        }
      });
      Assert.All(capture.ControlBounds, bounds =>
      {
        Assert.True(bounds.Width > 0);
        Assert.True(bounds.Height > 0);
        Assert.True(bounds.Right <= capture.LogicalViewport.Width + 0.01);
      });
    });
    Assert.Equal(ExpectedStates, captures[0].States);
    Assert.Equal(ExpectedStates, captures[1].States);
    Assert.Equal(13, captures[0].CriticalControls.Count);
    Assert.Equal(13, captures[1].CriticalControls.Count);

    var webPath = Path.Combine(
      FindRepositoryRoot(),
      "tests",
      "conformance",
      "visual",
      "artifacts",
      "screenshots",
      "web",
      "perception-character-challenge-conformance.png");
    Assert.True(File.Exists(webPath));
    using var webBitmap = new Bitmap(webPath);
    var webPixels = AnalyzePixels(webBitmap, []);
    var webBaseline = new WebBaselineEvidence(
      "tests/conformance/visual/artifacts/screenshots/web/perception-character-challenge-conformance.png",
      Convert.ToHexStringLower(SHA256.HashData(File.ReadAllBytes(webPath))),
      new Dimension(webBitmap.PixelSize.Width, webBitmap.PixelSize.Height),
      webPixels.NonBackgroundPixelRatio,
      "playwright desktop-light character-challenge-conformance fixture");
    Assert.Equal(new Dimension(1440, 1600), webBaseline.PixelSize);
    Assert.True(webBaseline.NonBackgroundPixelRatio > 0.01);

    var manifestPath = Path.Combine(
      outputRoot,
      "perception-character-challenge-render-manifest.json");
    var manifest = new
    {
      schemaVersion = 1,
      generatedBy = "FsusPerceptionCharacterChallengeHeadlessTests.RealHeadlessSkiaRenderProducesEightStateContrastAndZoomEvidence",
      outputRoot = HeadlessVisualEvidenceOutput.RecordPath(repositoryRoot, outputRoot),
      manifestPath = HeadlessVisualEvidenceOutput.RecordPath(repositoryRoot, manifestPath),
      renderer = new
      {
        platform = "avalonia",
        runner = "headless-skia",
        drawingBackend = "Skia",
        control = nameof(FsusPerceptionCharacterChallenge),
        avaloniaVersion = typeof(Application).Assembly.GetName().Version?.ToString(),
      },
      webBaseline,
      captures,
    };
    File.WriteAllText(
      manifestPath,
      JsonSerializer.Serialize(manifest, new JsonSerializerOptions { WriteIndented = true }) + "\n");
    Assert.True(File.Exists(manifestPath));
  }

  private static readonly string[] ExpectedStates =
  [
    "loading",
    "ready",
    "verifying",
    "retryable",
    "reissue",
    "expired",
    "unavailable",
    "disabled",
  ];

  private static RenderCapture RenderStateOverview(string outputRoot, bool highContrast)
  {
    ApplyTheme(highContrast);
    var stateValues = new[]
    {
      FsusPerceptionChallengeState.Loading,
      FsusPerceptionChallengeState.Ready,
      FsusPerceptionChallengeState.Verifying,
      FsusPerceptionChallengeState.Retryable,
      FsusPerceptionChallengeState.Reissue,
      FsusPerceptionChallengeState.Expired,
      FsusPerceptionChallengeState.Unavailable,
      FsusPerceptionChallengeState.Disabled,
    };
    var controls = stateValues.Select(CreateChallenge).ToArray();
    var panel = new StackPanel { Spacing = 16 };
    foreach (var control in controls)
    {
      panel.Children.Add(control);
    }

    var fileName = highContrast
      ? "perception-character-challenge-high-contrast.png"
      : "perception-character-challenge-conformance.png";
    var capture = Render(
      panel,
      Path.Combine(outputRoot, fileName),
      760,
      highContrast,
      null,
      controls);
    Assert.Equal(stateValues, controls.Select(control => control.State));
    Assert.Equal(8, controls.Length);
    return capture with { States = ExpectedStates };
  }

  private static RenderCapture RenderNarrowWidth(string outputRoot, int width, int zoomPercent)
  {
    ApplyTheme(highContrast: false);
    var challenge = CreateChallenge(FsusPerceptionChallengeState.Retryable);
    var fileName = $"perception-character-challenge-zoom-{zoomPercent}.png";
    var capture = Render(
      challenge,
      Path.Combine(outputRoot, fileName),
      width,
      false,
      zoomPercent,
      [challenge]);
    Assert.True(challenge.DesiredSize.Width <= width);
    Assert.All(
      challenge.GetLogicalDescendants().OfType<WrapPanel>(),
      panel => Assert.True(panel.DesiredSize.Width <= width));
    Assert.All(
      challenge.GetLogicalDescendants().OfType<Button>().Where(button => button.IsVisible),
      button =>
      {
        var label = Assert.IsType<TextBlock>(button.Content);
        var origin = label.TranslatePoint(new Point(0, 0), button) ?? default;
        Assert.False(string.IsNullOrWhiteSpace(label.Text));
        Assert.Equal(TextWrapping.Wrap, label.TextWrapping);
        Assert.True(label.Bounds.Width > 0);
        Assert.True(label.Bounds.Height > 0);
        Assert.True(origin.X + label.Bounds.Width <= button.Bounds.Width + 0.01);
        Assert.True(origin.Y + label.Bounds.Height <= button.Bounds.Height + 0.01);
      });
    return capture with { States = ["retryable"] };
  }

  private static RenderCapture Render(
    Control content,
    string outputPath,
    int width,
    bool highContrast,
    int? zoomEquivalentPercent,
    IReadOnlyList<FsusPerceptionCharacterChallenge> controls)
  {
    var surface = new Border
    {
      Width = width,
      Padding = new Thickness(16),
      Background = ResolveBrush(FsusThemeResourceKeys.BackgroundBrush),
      Child = content,
    };
    var window = new Window
    {
      Width = width,
      Height = 4096,
      Content = surface,
      ShowInTaskbar = false,
    };
    window.Show();
    surface.Measure(new Size(width, double.PositiveInfinity));
    var height = Math.Max(1, (int)Math.Ceiling(surface.DesiredSize.Height));
    window.Height = height;
    window.Measure(new Size(width, height));
    window.Arrange(new Rect(0, 0, width, height));
    surface.Arrange(new Rect(0, 0, width, height));

    using var bitmap = new RenderTargetBitmap(new PixelSize(width, height), new Vector(96, 96));
    bitmap.Render(surface);
    var bounds = controls.Select(control => CaptureBounds(control, surface)).ToArray();
    var criticalCandidates = controls
      .SelectMany(control => control.GetLogicalDescendants()
        .OfType<Control>()
        .Where(candidate => candidate.IsVisible)
        .Select(candidate => new
        {
          State = control.StateName,
          AutomationId = candidate is Image
            ? "character-raster"
            : AutomationProperties.GetAutomationId(candidate),
          Control = candidate,
        }))
      .Where(candidate => candidate.AutomationId is
        "character-audio-alternative" or
        "character-refresh" or
        "character-response" or
        "character-submit" or
        "character-retry" or
        "character-raster")
      .Where(candidate =>
        candidate.AutomationId == "character-raster" ||
        candidate.State is "ready" or "retryable")
      .ToArray();
    var criticalBounds = criticalCandidates
      .Select(candidate => CaptureBounds(candidate.Control, surface))
      .ToArray();
    var pixelEvidence = AnalyzePixels(bitmap, [.. bounds, .. criticalBounds]);
    var criticalControls = criticalCandidates.Select((candidate, index) =>
      new CriticalControlEvidence(
        candidate.State,
        candidate.AutomationId!,
        criticalBounds[index],
        pixelEvidence.ControlRegionNonBackgroundRatios[bounds.Length + index],
        pixelEvidence.ControlBorderNonBackgroundRatios[bounds.Length + index],
        pixelEvidence.ControlRegionQuantizedColorCounts[bounds.Length + index],
        pixelEvidence.ControlRegionMinorityColorRatios[bounds.Length + index])).ToArray();
    using (var stream = File.Create(outputPath))
    {
      bitmap.Save(stream);
    }
    window.Close();

    var repositoryRoot = FindRepositoryRoot();
    var relativePath = HeadlessVisualEvidenceOutput.RecordPath(repositoryRoot, outputPath);
    return new RenderCapture(
      Path.GetFileNameWithoutExtension(outputPath),
      relativePath,
      Convert.ToHexStringLower(SHA256.HashData(File.ReadAllBytes(outputPath))),
      new Dimension(width, height),
      new Dimension(bitmap.PixelSize.Width, bitmap.PixelSize.Height),
      highContrast,
      zoomEquivalentPercent,
      [],
      bounds,
      pixelEvidence.NonBackgroundPixelRatio,
      pixelEvidence.ControlRegionNonBackgroundRatios.Take(bounds.Length).ToArray(),
      pixelEvidence.ControlBorderNonBackgroundRatios.Take(bounds.Length).ToArray(),
      criticalControls);
  }

  private static BoundsEvidence CaptureBounds(Control control, Visual relativeTo)
  {
    var origin = control.TranslatePoint(new Point(0, 0), relativeTo) ?? default;
    return new BoundsEvidence(
      Math.Round(origin.X, 2),
      Math.Round(origin.Y, 2),
      Math.Round(control.Bounds.Width, 2),
      Math.Round(control.Bounds.Height, 2),
      Math.Round(origin.X + control.Bounds.Width, 2));
  }

  private static PixelEvidence AnalyzePixels(Bitmap bitmap, IReadOnlyList<BoundsEvidence> bounds)
  {
    using var buffer = new WriteableBitmap(
      bitmap.PixelSize,
      new Vector(96, 96),
      global::Avalonia.Platform.PixelFormat.Bgra8888,
      global::Avalonia.Platform.AlphaFormat.Premul);
    using var framebuffer = buffer.Lock();
    bitmap.CopyPixels(framebuffer);
    var pixels = new byte[framebuffer.RowBytes * bitmap.PixelSize.Height];
    Marshal.Copy(framebuffer.Address, pixels, 0, pixels.Length);
    var background = new[] { pixels[0], pixels[1], pixels[2] };
    bool IsNonBackground(int x, int y)
    {
      var offset = y * framebuffer.RowBytes + x * 4;
      return Math.Abs(pixels[offset] - background[0]) +
        Math.Abs(pixels[offset + 1] - background[1]) +
        Math.Abs(pixels[offset + 2] - background[2]) > 24;
    }

    var nonBackground = 0L;
    for (var y = 0; y < bitmap.PixelSize.Height; y++)
    for (var x = 0; x < bitmap.PixelSize.Width; x++)
    {
      if (IsNonBackground(x, y)) nonBackground++;
    }

    var regionRatios = new List<double>(bounds.Count);
    var borderRatios = new List<double>(bounds.Count);
    var quantizedColorCounts = new List<int>(bounds.Count);
    var minorityColorRatios = new List<double>(bounds.Count);
    foreach (var item in bounds)
    {
      var left = Math.Clamp((int)Math.Floor(item.X), 0, bitmap.PixelSize.Width - 1);
      var top = Math.Clamp((int)Math.Floor(item.Y), 0, bitmap.PixelSize.Height - 1);
      var right = Math.Clamp((int)Math.Ceiling(item.Right) - 1, left, bitmap.PixelSize.Width - 1);
      var bottom = Math.Clamp((int)Math.Ceiling(item.Y + item.Height) - 1, top, bitmap.PixelSize.Height - 1);
      var regionCount = 0L;
      var regionNonBackground = 0L;
      var colors = new Dictionary<int, long>();
      for (var y = top; y <= bottom; y++)
      for (var x = left; x <= right; x++)
      {
        regionCount++;
        var offset = y * framebuffer.RowBytes + x * 4;
        var colorKey = (pixels[offset] >> 3) |
          ((pixels[offset + 1] >> 3) << 5) |
          ((pixels[offset + 2] >> 3) << 10);
        colors[colorKey] = colors.GetValueOrDefault(colorKey) + 1;
        if (IsNonBackground(x, y)) regionNonBackground++;
      }

      var borderCount = 0L;
      var borderNonBackground = 0L;
      for (var x = left; x <= right; x++)
      {
        borderCount += 2;
        if (IsNonBackground(x, top)) borderNonBackground++;
        if (IsNonBackground(x, bottom)) borderNonBackground++;
      }
      for (var y = top + 1; y < bottom; y++)
      {
        borderCount += 2;
        if (IsNonBackground(left, y)) borderNonBackground++;
        if (IsNonBackground(right, y)) borderNonBackground++;
      }

      regionRatios.Add(Math.Round((double)regionNonBackground / regionCount, 6));
      borderRatios.Add(Math.Round((double)borderNonBackground / borderCount, 6));
      quantizedColorCounts.Add(colors.Count);
      minorityColorRatios.Add(Math.Round(1d - (double)colors.Values.Max() / regionCount, 6));
    }

    return new PixelEvidence(
      Math.Round((double)nonBackground / (bitmap.PixelSize.Width * (long)bitmap.PixelSize.Height), 6),
      regionRatios,
      borderRatios,
      quantizedColorCounts,
      minorityColorRatios);
  }

  private static void ApplyTheme(bool highContrast)
  {
    var application = Assert.IsType<HeadlessTestApplication>(Application.Current);
    new FsusThemeManager().Apply(
      application,
      new FsusThemeOptions
      {
        Variant = highContrast ? FsusThemeVariant.Dark : FsusThemeVariant.Light,
        HighContrast = highContrast,
        Density = FsusDensity.Default,
        MotionMode = FsusMotionMode.Reduced,
      });
    application.Resources["FsusThemePerceptionChallengeSurfaceBrush"] = highContrast
      ? new SolidColorBrush(Colors.Black)
      : new SolidColorBrush(Colors.White);
  }

  private static IBrush ResolveBrush(string key) =>
    Assert.IsAssignableFrom<IBrush>(Application.Current!.Resources[key]);

  private static FsusPerceptionCharacterChallenge CreateChallenge()
  {
    var challenge = new FsusPerceptionCharacterChallenge
    {
      ChallengeId = "character-headless",
      Prompt = "Type the characters shown — 输入图中的字符",
      Description = "Case does not matter. 大小写均可。",
      State = FsusPerceptionChallengeState.Retryable,
      Media = new FsusPerceptionCharacterMedia(
        new FsusPerceptionCharacterRasterMedia(new DrawingImage(), 240, 80, "Characters to transcribe"),
        new FsusPerceptionCharacterAudioMedia(new Uri("https://example.invalid/final.mp3"), "Hear the characters")),
    };
    challenge.ErrorMessage = "Use the replacement image";
    challenge.SetResponse("K7D2");
    return challenge;
  }

  private static FsusPerceptionCharacterChallenge CreateChallenge(FsusPerceptionChallengeState state)
  {
    var challenge = new FsusPerceptionCharacterChallenge
    {
      ChallengeId = $"character-render-{state.ToString().ToLowerInvariant()}",
      Prompt = "请输入图像中显示的字符 / Enter the visible characters",
      Description = "Audio is available only after user activation. Long CJK + Latin copy must remain readable without horizontal loss.",
      State = state,
    };
    if (state != FsusPerceptionChallengeState.Unavailable)
    {
      challenge.Media = CreateMedia();
    }
    if (state == FsusPerceptionChallengeState.Retryable)
    {
      challenge.ErrorMessage = "That response was not accepted. 请重试。";
      challenge.SetResponse("K7D2");
    }
    return challenge;
  }

  private static FsusPerceptionCharacterMedia CreateMedia()
  {
    var drawing = new DrawingGroup();
    drawing.Children.Add(new GeometryDrawing
    {
      Brush = new SolidColorBrush(Color.Parse("#172033")),
      Geometry = new RectangleGeometry(new Rect(0, 0, 240, 80)),
    });
    drawing.Children.Add(new GeometryDrawing
    {
      Brush = new SolidColorBrush(Color.Parse("#EAF2FF")),
      Geometry = Geometry.Parse("M24,18 L52,18 52,62 24,62 Z M72,18 L100,18 86,40 104,62 74,62 60,40 Z M124,18 L152,18 152,62 124,62 Z M172,18 L216,18 216,30 188,30 188,36 210,36 210,48 188,48 188,62 172,62 Z"),
    });
    return new FsusPerceptionCharacterMedia(
      new FsusPerceptionCharacterRasterMedia(
        new DrawingImage { Drawing = drawing },
        240,
        80,
        "Characters to transcribe"),
      new FsusPerceptionCharacterAudioMedia(
        new Uri("https://example.invalid/final.mp3"),
        "Hear the characters"));
  }

  private static Control Find(IEnumerable<Control> controls, string automationId) =>
    Assert.Single(controls, control => AutomationProperties.GetAutomationId(control) == automationId);

  private static string FindRepositoryRoot()
  {
    for (var directory = new DirectoryInfo(AppContext.BaseDirectory); directory is not null; directory = directory.Parent)
    {
      if (File.Exists(Path.Combine(directory.FullName, "pnpm-workspace.yaml")))
      {
        return directory.FullName;
      }
    }

    throw new DirectoryNotFoundException("Could not locate the FsusUI repository root.");
  }

  private sealed record Dimension(int Width, int Height);

  private sealed record BoundsEvidence(double X, double Y, double Width, double Height, double Right);

  private sealed record WebBaselineEvidence(
    string File,
    string Sha256,
    Dimension PixelSize,
    double NonBackgroundPixelRatio,
    string Source);

  private sealed record CriticalControlEvidence(
    string State,
    string AutomationId,
    BoundsEvidence Bounds,
    double RegionNonBackgroundRatio,
    double BorderNonBackgroundRatio,
    int QuantizedColorCount,
    double MinorityColorPixelRatio);

  private sealed record PixelEvidence(
    double NonBackgroundPixelRatio,
    IReadOnlyList<double> ControlRegionNonBackgroundRatios,
    IReadOnlyList<double> ControlBorderNonBackgroundRatios,
    IReadOnlyList<int> ControlRegionQuantizedColorCounts,
    IReadOnlyList<double> ControlRegionMinorityColorRatios);

  private sealed record RenderCapture(
    string Id,
    string File,
    string Sha256,
    Dimension LogicalViewport,
    Dimension PixelSize,
    bool HighContrast,
    int? ZoomEquivalentPercent,
    IReadOnlyList<string> States,
    IReadOnlyList<BoundsEvidence> ControlBounds,
    double NonBackgroundPixelRatio,
    IReadOnlyList<double> ControlRegionNonBackgroundRatios,
    IReadOnlyList<double> ControlBorderNonBackgroundRatios,
    IReadOnlyList<CriticalControlEvidence> CriticalControls);
}
