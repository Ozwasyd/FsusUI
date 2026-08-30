using Avalonia;
using Avalonia.Automation;
using Avalonia.Automation.Peers;
using Avalonia.Automation.Provider;
using Avalonia.Controls;
using Avalonia.Headless;
using Avalonia.Headless.XUnit;
using Avalonia.Input;
using Avalonia.Markup.Xaml.Styling;
using Avalonia.Media;
using Avalonia.Media.Imaging;
using Avalonia.Threading;
using Avalonia.VisualTree;
using FsusUI.Avalonia.Controls;
using FsusUI.Avalonia.Themes;
using System.Security.Cryptography;
using System.Text.Json;

namespace FsusUI.Avalonia.HeadlessTests;

public class FsusSliderHeadlessTests
{
  [AvaloniaFact]
  public void PointerPressDragReleaseUsesCaptureAndCommitsOnce()
  {
    var commits = new List<FsusNumericValueChangedEventArgs>();
    var slider = new FsusSlider
    {
      AccessibleName = "Editor font size",
      Min = 12,
      Max = 32,
      Step = 1,
      Value = 20,
      Width = 420,
    };
    slider.ValueCommitted += (_, args) => commits.Add(args);
    var window = MountSingle(slider, FsusThemeVariant.Light);
    window.Show();
    Arrange(window, 520, 160);

    var center = slider.TranslatePoint(
      new Point(slider.Bounds.Width * 0.25, slider.Bounds.Height / 2),
      window) ?? throw new InvalidOperationException("Slider is not attached.");
    window.MouseDown(center, MouseButton.Left);

    Assert.Contains("fsus-dragging", slider.Classes);
    Assert.Contains("fsus-focus-visible", slider.Classes);
    Assert.InRange(slider.Value, 16, 18);

    // The pointer leaves the control while pressed. The value continues to update,
    // proving that the production control owns pointer capture for the gesture.
    var outside = new Point(510, center.Y);
    window.MouseMove(outside);
    Assert.Equal(32, slider.Value);
    Assert.Contains("fsus-dragging", slider.Classes);

    window.MouseUp(outside, MouseButton.Left);
    Assert.DoesNotContain("fsus-dragging", slider.Classes);
    var commit = Assert.Single(commits);
    Assert.Equal(20, commit.OldValue);
    Assert.Equal(32, commit.NewValue);
    window.Close();
  }

  [AvaloniaFact]
  public void KeyboardFocusDisabledAndRangeAutomationUseProductionSemantics()
  {
    var slider = new FsusSlider
    {
      AccessibleName = "Auto-save delay",
      AccessibleValueText = "2 seconds",
      Min = 1,
      Max = 10,
      Step = 1,
      Value = 2,
      Width = 420,
    };
    var commits = 0;
    slider.ValueCommitted += (_, _) => commits++;
    var window = MountSingle(slider, FsusThemeVariant.Dark);
    window.Show();
    Arrange(window, 520, 160);

    Assert.True(slider.Focus());
    window.KeyPress(Key.PageUp, RawInputModifiers.None, PhysicalKey.PageUp, null);
    Assert.Equal(10, slider.Value);
    window.KeyPress(Key.Home, RawInputModifiers.None, PhysicalKey.Home, null);
    Assert.Equal(1, slider.Value);
    window.KeyPress(Key.End, RawInputModifiers.None, PhysicalKey.End, null);
    Assert.Equal(10, slider.Value);
    Assert.Equal(3, commits);

    var peer = ControlAutomationPeer.CreatePeerForElement(slider);
    var range = Assert.IsAssignableFrom<IRangeValueProvider>(peer);
    Assert.Equal(1, range.Minimum);
    Assert.Equal(10, range.Maximum);
    Assert.Equal(1, range.SmallChange);
    Assert.Equal(9, range.LargeChange);
    Assert.Equal("Auto-save delay", AutomationProperties.GetName(slider));
    Assert.Equal("2 seconds", AutomationProperties.GetItemStatus(slider));

    slider.IsDisabled = true;
    Assert.False(slider.IsEffectivelyEnabled);
    Assert.True(range.IsReadOnly);
    Assert.Contains("fsus-disabled", slider.Classes);
    var disabledValue = slider.Value;
    window.KeyPress(Key.Left, RawInputModifiers.None, PhysicalKey.ArrowLeft, null);
    range.SetValue(5);
    Assert.Equal(disabledValue, slider.Value);
    window.Close();
  }

  [AvaloniaFact]
  public void ThemeDensityMotionAndHighContrastResolveForTrackFillThumbAndFocus()
  {
    foreach (var (variant, highContrast, density, expectedHeight, expectedThumb) in new[]
      {
        (FsusThemeVariant.Light, false, FsusDensity.Compact, 36d, 16d),
        (FsusThemeVariant.Dark, false, FsusDensity.Default, 44d, 20d),
        (FsusThemeVariant.Dark, true, FsusDensity.Spacious, 48d, 24d),
      })
    {
      var slider = new FsusSlider
      {
        AccessibleName = "Code font size",
        Min = 10,
        Max = 30,
        Step = 1,
        Value = 18,
        Width = 420,
        Size = density switch
        {
          FsusDensity.Compact => FsusComponentSize.Sm,
          FsusDensity.Spacious => FsusComponentSize.Lg,
          _ => FsusComponentSize.Md,
        },
      };
      var window = MountSingle(
        slider,
        variant,
        highContrast,
        density,
        FsusMotionMode.Reduced);
      window.Show();
      Arrange(window, 520, 160);
      Assert.True(slider.Focus());
      Dispatcher.UIThread.RunJobs();
      Arrange(window, 520, 160);

      var track = RequirePart<Border>(slider, FsusSlider.TrackPartName);
      var fill = RequirePart<Border>(slider, FsusSlider.FillPartName);
      var thumb = RequirePart<Border>(slider, FsusSlider.ThumbPartName);
      var focusRing = RequirePart<Border>(slider, "PART_FocusRing");
      Assert.Equal(expectedHeight, slider.MinHeight);
      Assert.Equal(expectedThumb, thumb.Bounds.Width);
      Assert.Equal(4, track.Bounds.Height);
      var fillTargetWidth = fill.GetBaseValue(Control.WidthProperty).Value;
      Assert.True(
        fillTargetWidth > 0,
        $"{variant}/{density}/highContrast={highContrast}: fill={fillTargetWidth}, track={track.Width}, slider={slider.Bounds.Width}");
      Assert.True(
        fillTargetWidth < track.Width,
        $"{variant}/{density}/highContrast={highContrast}: fill={fillTargetWidth}, track={track.Width}, slider={slider.Bounds.Width}");
      Assert.NotEqual(track.Background, fill.Background);
      Assert.Equal(
        window.Resources[FsusThemeResourceKeys.FocusBrush],
        thumb.BorderBrush);
      Assert.Equal(
        window.Resources[FsusThemeResourceKeys.FocusBrush],
        focusRing.BorderBrush);
      Assert.Equal(1, focusRing.GetBaseValue(Visual.OpacityProperty).Value);
      Assert.True(focusRing.Bounds.Width > thumb.Bounds.Width);
      Assert.Equal(
        TimeSpan.FromMilliseconds(1),
        window.Resources[FsusThemeResourceKeys.MotionDurationEffective]);
      if (highContrast)
      {
        Assert.Equal(3, thumb.BorderThickness.Left);
        Assert.Equal(
          Color.Parse("#FFFF00"),
          Assert.IsType<SolidColorBrush>(fill.Background).Color);
      }

      window.Close();
    }
  }

  [AvaloniaFact]
  public void RealHeadlessSkiaRendersIssue659ProductionStateMatrix()
  {
    var repositoryRoot = FindRepositoryRoot();
    var outputRoot = HeadlessVisualEvidenceOutput.ResolveOutputRoot(
      repositoryRoot,
      "issue-659-slider-render");
    var captures = new List<SliderRenderCapture>();
    foreach (var (name, variant, highContrast) in new[]
      {
        ("light", FsusThemeVariant.Light, false),
        ("dark", FsusThemeVariant.Dark, false),
        ("highcontrast", FsusThemeVariant.Dark, true),
      })
    {
      captures.Add(RenderMatrix(outputRoot, name, variant, highContrast));
    }

    Assert.Equal(3, captures.Count);
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
      "issue-659-avalonia-slider-render-manifest.json");
    File.WriteAllText(
      manifestPath,
      JsonSerializer.Serialize(
        new
        {
          schemaVersion = 1,
          issue = 659,
          generatedBy =
            "FsusSliderHeadlessTests.RealHeadlessSkiaRendersIssue659ProductionStateMatrix",
          outputRoot = HeadlessVisualEvidenceOutput.RecordPath(repositoryRoot, outputRoot),
          manifestPath = HeadlessVisualEvidenceOutput.RecordPath(repositoryRoot, manifestPath),
          renderer = new
          {
            platform = "avalonia",
            runner = "headless-skia",
            drawingBackend = "Skia",
            avaloniaVersion = typeof(Application).Assembly.GetName().Version?.ToString(),
            productionFixture = true,
            limitations =
              "Local deterministic headless rendering; no physical display or operating-system assistive technology is claimed.",
          },
          states = new[]
          {
            "default", "changed", "keyboard-focus", "disabled",
            "compact-density", "spacious-density", "reversed-bounds",
          },
          motionMode = "reduced",
          captures,
        },
        new JsonSerializerOptions { WriteIndented = true }) + "\n");
    Assert.True(File.Exists(manifestPath));
  }

  [AvaloniaFact]
  public void LocalAutomationSimulationWritesInspectableRangeReceipt()
  {
    var enabled = new FsusSlider
    {
      AccessibleName = "Editor line height",
      AccessibleValueText = "1.6 lines",
      Min = 1,
      Max = 2,
      Step = 0.1,
      Value = 1.6,
    };
    var disabled = new FsusSlider
    {
      AccessibleName = "Locked code font size",
      AccessibleValueText = "14 pixels",
      Min = 10,
      Max = 24,
      Step = 1,
      Value = 14,
      IsDisabled = true,
    };
    var enabledRange = Assert.IsAssignableFrom<IRangeValueProvider>(
      ControlAutomationPeer.CreatePeerForElement(enabled));
    var disabledRange = Assert.IsAssignableFrom<IRangeValueProvider>(
      ControlAutomationPeer.CreatePeerForElement(disabled));

    var reportPath = Path.Combine(
      FindRepositoryRoot(),
      "tests", "conformance", "visual", "artifacts",
      "issue-659-avalonia-slider-automation-report.json");
    File.WriteAllText(
      reportPath,
      JsonSerializer.Serialize(
        new
        {
          schemaVersion = 1,
          issue = 659,
          generatedBy =
            "FsusSliderHeadlessTests.LocalAutomationSimulationWritesInspectableRangeReceipt",
          evidenceClass = "local-headless-automation-simulation",
          notRealOsScreenReader = true,
          controlType = AutomationProperties.GetControlTypeOverride(enabled).ToString(),
          pattern = "RangeValue",
          states = new[]
          {
            new
            {
              state = "enabled",
              name = AutomationProperties.GetName(enabled),
              valueText = AutomationProperties.GetItemStatus(enabled),
              enabledRange.Minimum,
              enabledRange.Maximum,
              enabledRange.Value,
              enabledRange.SmallChange,
              enabledRange.LargeChange,
              enabledRange.IsReadOnly,
            },
            new
            {
              state = "disabled",
              name = AutomationProperties.GetName(disabled),
              valueText = AutomationProperties.GetItemStatus(disabled),
              disabledRange.Minimum,
              disabledRange.Maximum,
              disabledRange.Value,
              disabledRange.SmallChange,
              disabledRange.LargeChange,
              disabledRange.IsReadOnly,
            },
          },
          relatedInteractionTests = new[]
          {
            "PointerPressDragReleaseUsesCaptureAndCommitsOnce",
            "KeyboardFocusDisabledAndRangeAutomationUseProductionSemantics",
          },
          limitations =
            "Inspects Avalonia automation properties and the production RangeValue provider in the headless backend; no Windows UIA, macOS VoiceOver, or Linux AT-SPI session is claimed.",
        },
        new JsonSerializerOptions { WriteIndented = true }) + "\n");

    Assert.True(File.Exists(reportPath));
  }

  private static SliderRenderCapture RenderMatrix(
    string outputRoot,
    string themeName,
    FsusThemeVariant variant,
    bool highContrast)
  {
    var window = CreateWindow(
      760,
      600,
      variant,
      highContrast,
      FsusDensity.Default,
      FsusMotionMode.Reduced);
    var brush = Assert.IsAssignableFrom<IBrush>(
      window.Resources[FsusThemeResourceKeys.TextBrush]);
    var stack = new StackPanel { Spacing = 10 };
    var states = new (string Label, FsusSlider Slider)[]
    {
      ("Default · editor font size 20 px", Slider(20)),
      ("Changed · editor font size 28 px", Slider(28)),
      ("Keyboard focus · line height 1.6", new FsusSlider
      {
        AccessibleName = "Editor line height",
        AccessibleValueText = "1.6 lines",
        Min = 1,
        Max = 2,
        Step = 0.1,
        Value = 1.6,
        Width = 600,
      }),
      ("Disabled · locked code font 14 px", new FsusSlider
      {
        AccessibleName = "Locked code font size",
        Min = 10,
        Max = 24,
        Step = 1,
        Value = 14,
        IsDisabled = true,
        Width = 600,
      }),
      ("Compact density · auto-save 3 s", Slider(30, FsusComponentSize.Sm)),
      ("Spacious density · auto-save 8 s", Slider(80, FsusComponentSize.Lg)),
      ("Reversed bounds · 70", new FsusSlider
      {
        AccessibleName = "Reversed preference",
        Min = 100,
        Max = 0,
        Step = 10,
        Value = 70,
        Width = 600,
      }),
    };
    foreach (var (label, slider) in states)
    {
      stack.Children.Add(new TextBlock
      {
        Text = label,
        Foreground = brush,
        FontSize = 12,
      });
      stack.Children.Add(slider);
    }

    var surface = new Border
    {
      Width = 760,
      Height = 600,
      Padding = new Thickness(40, 24),
      Background = Assert.IsAssignableFrom<IBrush>(
        window.Resources[FsusThemeResourceKeys.BackgroundBrush]),
      Child = stack,
    };
    window.Content = surface;
    window.Show();
    Arrange(window, 760, 600);
    Assert.True(states[2].Slider.Focus());
    Dispatcher.UIThread.RunJobs();
    Arrange(window, 760, 600);

    var output = Path.Combine(
      outputRoot,
      $"issue-659-slider-{themeName}.png");
    using var bitmap = new RenderTargetBitmap(new PixelSize(760, 600), new Vector(96, 96));
    bitmap.Render(surface);
    using (var stream = File.Create(output))
    {
      bitmap.Save(stream);
    }

    window.Close();
    return new SliderRenderCapture(
      HeadlessVisualEvidenceOutput.RecordPath(FindRepositoryRoot(), output),
      Convert.ToHexStringLower(SHA256.HashData(File.ReadAllBytes(output))),
      new PixelDimension(bitmap.PixelSize.Width, bitmap.PixelSize.Height),
      themeName,
      highContrast,
      "default-changed-focused-disabled-density-reversed");
  }

  private static FsusSlider Slider(
    double value,
    FsusComponentSize size = FsusComponentSize.Md) =>
    new()
    {
      AccessibleName = "Editor font size",
      Min = 0,
      Max = 100,
      Step = 5,
      Value = value,
      Width = 600,
      Size = size,
    };

  private static Window MountSingle(
    FsusSlider slider,
    FsusThemeVariant variant,
    bool highContrast = false,
    FsusDensity density = FsusDensity.Default,
    FsusMotionMode motionMode = FsusMotionMode.Reduced)
  {
    var window = CreateWindow(520, 160, variant, highContrast, density, motionMode);
    window.Content = new Border
    {
      Width = 520,
      Height = 160,
      Padding = new Thickness(50),
      Background = Assert.IsAssignableFrom<IBrush>(
        window.Resources[FsusThemeResourceKeys.BackgroundBrush]),
      Child = slider,
    };
    return window;
  }

  private static Window CreateWindow(
    double width,
    double height,
    FsusThemeVariant variant,
    bool highContrast,
    FsusDensity density,
    FsusMotionMode motionMode)
  {
    var window = new Window
    {
      Width = width,
      Height = height,
      ShowInTaskbar = false,
    };
    window.Styles.Add(new StyleInclude(new Uri("avares://FsusUI.Avalonia.Themes"))
    {
      Source = new Uri("avares://FsusUI.Avalonia.Themes/Themes/FsusTheme.axaml"),
    });
    new FsusThemeManager().Apply(window.Resources, new FsusThemeOptions
    {
      Variant = variant,
      HighContrast = highContrast,
      Density = density,
      MotionMode = motionMode,
    });
    return window;
  }

  private static void Arrange(Window window, double width, double height)
  {
    window.Measure(new Size(width, height));
    window.Arrange(new Rect(0, 0, width, height));
    Dispatcher.UIThread.RunJobs();
  }

  private static T RequirePart<T>(Control control, string name)
    where T : class
  {
    foreach (var descendant in control.GetVisualDescendants())
    {
      if (descendant.Name == name && descendant is T typed)
      {
        return typed;
      }
    }

    throw new Xunit.Sdk.XunitException(
      $"Template part '{name}' was not found for '{control.Name}'.");
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

  private sealed record SliderRenderCapture(
    string File,
    string Sha256,
    PixelDimension PixelSize,
    string Theme,
    bool HighContrast,
    string State);
}
