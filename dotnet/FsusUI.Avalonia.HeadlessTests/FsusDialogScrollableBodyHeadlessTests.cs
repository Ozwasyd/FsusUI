using System.Security.Cryptography;
using System.Text.Json;
using Avalonia;
using Avalonia.Automation;
using Avalonia.Controls;
using Avalonia.Controls.Primitives;
using Avalonia.Controls.Presenters;
using Avalonia.Headless;
using Avalonia.Headless.XUnit;
using Avalonia.Input;
using Avalonia.Layout;
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

namespace FsusUI.Avalonia.HeadlessTests;

public class FsusDialogScrollableBodyHeadlessTests
{
  [AvaloniaFact]
  public void TwentyFieldsRemainReachableThroughRealTabAndPageKeysIn480HeightWindow()
  {
    var fixture = BuildDialogWindow(
      isScrollable: true,
      windowHeight: 480,
      FsusThemeVariant.Light,
      FlowDirection.LeftToRight,
      FsusMotionMode.Reduced);
    fixture.Window.Show();
    Dispatcher.UIThread.RunJobs();
    fixture.Window.UpdateLayout();

    var scrollViewer =
      RequirePart<ScrollViewer>(fixture.Dialog, "PART_BodyScrollViewer");
    Assert.True(fixture.Dialog.Bounds.Height <= 480);
    Assert.True(scrollViewer.Extent.Height > scrollViewer.Viewport.Height);

    var initialFooterPoint =
      fixture.Footer.TranslatePoint(new Point(), fixture.Window);
    Assert.NotNull(initialFooterPoint);
    Assert.InRange(initialFooterPoint.Value.Y, 0, 480);

    Assert.True(fixture.Fields[0].Focus());
    Assert.True(fixture.Fields[0].IsFocused);
    Assert.Equal(0, scrollViewer.Offset.Y);

    fixture.Window.KeyPress(
      Key.PageDown,
      RawInputModifiers.None,
      PhysicalKey.PageDown,
      null);
    Dispatcher.UIThread.RunJobs();
    Assert.True(scrollViewer.Offset.Y > 0);
    Assert.True(fixture.Fields[0].IsFocused);

    var afterPageDown = scrollViewer.Offset.Y;
    fixture.Window.KeyPress(
      Key.PageUp,
      RawInputModifiers.None,
      PhysicalKey.PageUp,
      null);
    Dispatcher.UIThread.RunJobs();
    Assert.True(scrollViewer.Offset.Y < afterPageDown);
    Assert.True(fixture.Fields[0].IsFocused);

    for (var index = 1; index < fixture.Fields.Count; index++)
    {
      fixture.Window.KeyPress(
        Key.Tab,
        RawInputModifiers.None,
        PhysicalKey.Tab,
        "\t");
      Dispatcher.UIThread.RunJobs();
      fixture.Window.UpdateLayout();
      Assert.True(
        fixture.Fields[index].IsFocused,
        $"Tab {index} should focus field {index + 1}.");
    }

    Assert.True(scrollViewer.Offset.Y > 0);
    AssertFullyVisible(fixture.Fields[^1], scrollViewer);

    var finalFooterPoint =
      fixture.Footer.TranslatePoint(new Point(), fixture.Window);
    Assert.NotNull(finalFooterPoint);
    Assert.Equal(initialFooterPoint.Value.Y, finalFooterPoint.Value.Y);
    fixture.Window.Close();
  }

  [AvaloniaFact]
  public void NonScrollableModePreservesLegacyContentTemplateAndAutomation()
  {
    var legacyContent = new Border
    {
      Name = "LegacyContent",
      Child = new TextBlock { Text = "Existing dialog composition" },
    };
    var body = new StackPanel
    {
      Name = "OptInBody",
      Children = { new TextBox { Text = "New body" } },
    };
    var footer = new StackPanel
    {
      Name = "OptInFooter",
      Children = { new FsusButton { Content = "Save" } },
    };
    var dialog = new FsusDialog
    {
      Title = "Preferences",
      Content = legacyContent,
      BodyContent = body,
      FooterContent = footer,
      IsBodyScrollable = false,
    };
    var initialStatus = AutomationProperties.GetItemStatus(dialog);
    var initialName = AutomationProperties.GetName(dialog);
    var initialClass = AutomationProperties.GetClassNameOverride(dialog);
    var window = CreateStyledWindow(
      600,
      480,
      FsusThemeVariant.Light,
      FlowDirection.LeftToRight,
      FsusMotionMode.Reduced);
    window.Content = dialog;
    window.Show();
    Dispatcher.UIThread.RunJobs();
    window.UpdateLayout();

    Assert.Contains(legacyContent, dialog.GetVisualDescendants());
    Assert.DoesNotContain(body, dialog.GetVisualDescendants());
    Assert.DoesNotContain(footer, dialog.GetVisualDescendants());
    Assert.DoesNotContain(
      dialog.GetVisualDescendants(),
      control => control.Name == "PART_BodyScrollViewer");
    Assert.Equal(initialStatus, AutomationProperties.GetItemStatus(dialog));
    Assert.Equal(initialName, AutomationProperties.GetName(dialog));
    Assert.Equal(initialClass, AutomationProperties.GetClassNameOverride(dialog));

    dialog.IsBodyScrollable = true;
    Dispatcher.UIThread.RunJobs();
    window.UpdateLayout();
    Assert.NotNull(RequirePart<ScrollViewer>(dialog, "PART_BodyScrollViewer"));
    Assert.Contains(body, dialog.GetVisualDescendants());
    Assert.Contains(footer, dialog.GetVisualDescendants());
    Assert.DoesNotContain(legacyContent, dialog.GetVisualDescendants());
    Assert.Equal(initialStatus, AutomationProperties.GetItemStatus(dialog));
    Assert.Equal(initialName, AutomationProperties.GetName(dialog));
    Assert.Equal(initialClass, AutomationProperties.GetClassNameOverride(dialog));

    dialog.IsBodyScrollable = false;
    Dispatcher.UIThread.RunJobs();
    window.UpdateLayout();
    Assert.Contains(legacyContent, dialog.GetVisualDescendants());
    Assert.DoesNotContain(
      dialog.GetVisualDescendants(),
      control => control.Name == "PART_BodyScrollViewer");
    Assert.Equal(initialStatus, AutomationProperties.GetItemStatus(dialog));
    Assert.Equal(initialName, AutomationProperties.GetName(dialog));
    Assert.Equal(initialClass, AutomationProperties.GetClassNameOverride(dialog));
    window.Close();
  }

  [AvaloniaFact]
  public void OverlayViewportAndOptionalBodyMaximumConstrainTheScrollableRegion()
  {
    var form = new StackPanel { Spacing = 10 };
    for (var index = 1; index <= 20; index++)
    {
      form.Children.Add(new TextBox
      {
        Text = $"Overlay preference {index}",
        Height = 44,
      });
    }
    var footer = new TextBlock { Text = "Fixed actions" };
    var dialog = new FsusDialog
    {
      Width = 520,
      Title = "Overlay preferences",
      BodyContent = form,
      FooterContent = footer,
      IsBodyScrollable = true,
      VerticalAlignment = VerticalAlignment.Center,
    };
    var host = new FsusOverlayHost();
    var window = CreateStyledWindow(
      800,
      700,
      FsusThemeVariant.Light,
      FlowDirection.LeftToRight,
      FsusMotionMode.Reduced);
    window.Content = host;
    var entry = dialog.Open(
      host,
      new FsusOverlayOptions
      {
        ViewportBounds = new Rect(0, 0, 600, 420),
        OverlaySize = new Size(520, 420),
      });
    window.Show();
    Dispatcher.UIThread.RunJobs();
    window.UpdateLayout();

    var scrollViewer =
      RequirePart<ScrollViewer>(dialog, "PART_BodyScrollViewer");
    Assert.Same(entry, dialog.OverlayEntry);
    Assert.Equal(420, entry.Options.ViewportBounds.Height);
    Assert.True(
      dialog.Bounds.Height <= 420,
      $"Dialog height {dialog.Bounds.Height} exceeds the simulated overlay viewport.");
    Assert.True(scrollViewer.Extent.Height > scrollViewer.Viewport.Height);
    var viewportBeforeMaximum = scrollViewer.Viewport.Height;

    dialog.MaxBodyHeight = 180;
    Dispatcher.UIThread.RunJobs();
    window.UpdateLayout();

    Assert.Equal(180, scrollViewer.MaxHeight);
    Assert.True(scrollViewer.Viewport.Height <= 180);
    Assert.True(scrollViewer.Viewport.Height < viewportBeforeMaximum);
    var footerPoint = footer.TranslatePoint(new Point(), dialog);
    Assert.NotNull(footerPoint);
    Assert.InRange(
      footerPoint.Value.Y,
      0,
      dialog.Bounds.Height - footer.Bounds.Height + 1);
    window.Close();
  }

  [AvaloniaTheory]
  [InlineData(FsusThemeVariant.Light, FlowDirection.LeftToRight, 1d)]
  [InlineData(FsusThemeVariant.Dark, FlowDirection.RightToLeft, 1d)]
  [InlineData(FsusThemeVariant.Light, FlowDirection.LeftToRight, 2d)]
  [InlineData(FsusThemeVariant.Dark, FlowDirection.RightToLeft, 2d)]
  public void ProductionThemeRenderCoversThemeRtlZoomAndFixedFooter(
    FsusThemeVariant theme,
    FlowDirection flowDirection,
    double renderScaling)
  {
    var fixture = BuildDialogWindow(
      isScrollable: true,
      windowHeight: 480,
      theme,
      flowDirection,
      FsusMotionMode.Reduced);
    fixture.Window.Show();
    Assert.True(fixture.Fields[^1].Focus());
    Dispatcher.UIThread.RunJobs();
    fixture.Window.UpdateLayout();

    var scrollViewer =
      RequirePart<ScrollViewer>(fixture.Dialog, "PART_BodyScrollViewer");
    var bodyPresenter =
      RequirePart<ContentPresenter>(fixture.Dialog, "PART_BodyPresenter");
    Assert.True(bodyPresenter.IsVisible);
    Assert.True(bodyPresenter.Bounds.Height > scrollViewer.Viewport.Height);
    Assert.True(fixture.Fields[0].IsVisible);
    Assert.True(fixture.Fields[^1].IsVisible);
    AssertFullyVisible(fixture.Fields[^1], scrollViewer);
    var footerPoint = fixture.Footer.TranslatePoint(new Point(), fixture.Window);
    Assert.NotNull(footerPoint);
    Assert.InRange(footerPoint.Value.Y, 0, 480);
    Assert.Equal(flowDirection, fixture.Dialog.FlowDirection);
    Assert.Equal("Preferences", AutomationProperties.GetName(fixture.Dialog));
    Assert.Equal("Dialog", AutomationProperties.GetClassNameOverride(fixture.Dialog));
    Assert.Equal(
      "reduced",
      fixture.Window.Resources[FsusThemeResourceKeys.MotionModeCurrent]);
    Assert.Equal(
      TimeSpan.FromMilliseconds(1),
      fixture.Window.Resources[FsusThemeResourceKeys.MotionDurationEffective]);

    scrollViewer.Offset = new Vector(scrollViewer.Offset.X, 0);
    Dispatcher.UIThread.RunJobs();
    fixture.Window.UpdateLayout();

    var pixelWidth = checked((int)(600 * renderScaling));
    var pixelHeight = checked((int)(480 * renderScaling));
    using var bitmap = new RenderTargetBitmap(
      new PixelSize(pixelWidth, pixelHeight),
      new Vector(96 * renderScaling, 96 * renderScaling));
    bitmap.Render(fixture.Window);
    using var stream = new MemoryStream();
    bitmap.Save(stream);
    var bytes = stream.ToArray();
    Assert.True(bytes.Length > 8);
    Assert.Equal(
      new byte[] { 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a },
      bytes[..8]);

    var outputRoot =
      Environment.GetEnvironmentVariable("FSUS_ISSUE_644_EVIDENCE_DIR");
    if (!string.IsNullOrWhiteSpace(outputRoot))
    {
      Directory.CreateDirectory(outputRoot);
      var direction = flowDirection == FlowDirection.RightToLeft ? "rtl" : "ltr";
      var zoom = $"{renderScaling * 100:0}";
      var fileName =
        $"issue-644-after-{theme.ToString().ToLowerInvariant()}-{direction}-{zoom}.png";
      var outputPath = Path.Combine(outputRoot, fileName);
      File.WriteAllBytes(outputPath, bytes);
      WriteCapture(
        outputRoot,
        new RenderCapture(
          fileName,
          Convert.ToHexStringLower(SHA256.HashData(bytes)),
          pixelWidth,
          pixelHeight,
          600,
          480,
          renderScaling,
          theme.ToString(),
          direction,
          scrollViewer.Offset.Y,
          footerPoint.Value.Y,
          AutomationProperties.GetName(fixture.Dialog) ?? string.Empty,
          AutomationProperties.GetClassNameOverride(fixture.Dialog) ?? string.Empty,
          "local-headless-automation-simulation"));
      WriteAutomationTree(
        outputRoot,
        fileName,
        theme,
        direction,
        renderScaling,
        fixture);
    }

    fixture.Window.Close();
  }

  private static DialogFixture BuildDialogWindow(
    bool isScrollable,
    double windowHeight,
    FsusThemeVariant theme,
    FlowDirection flowDirection,
    FsusMotionMode motionMode)
  {
    var fields = new List<TextBox>();
    var form = new StackPanel { Spacing = 10 };
    for (var index = 1; index <= 20; index++)
    {
      var field = new TextBox
      {
        Text = $"Preference value {index}",
        PlaceholderText = $"Preference field {index}",
        Height = 44,
      };
      AutomationProperties.SetName(field, $"Preference field {index}");
      fields.Add(field);
      form.Children.Add(field);
    }

    var footer = new StackPanel
    {
      Orientation = Orientation.Horizontal,
      Spacing = 8,
      HorizontalAlignment = HorizontalAlignment.Right,
      Children =
      {
        new FsusButton { Content = "Cancel" },
        new FsusButton { Content = "Save" },
      },
    };
    var dialog = new FsusDialog
    {
      Width = 520,
      Title = "Preferences",
      IsBodyScrollable = isScrollable,
      BodyContent = form,
      FooterContent = footer,
      HorizontalAlignment = HorizontalAlignment.Center,
      VerticalAlignment = VerticalAlignment.Center,
    };
    var window = CreateStyledWindow(
      600,
      windowHeight,
      theme,
      flowDirection,
      motionMode);
    var surface = new Border
    {
      Width = 600,
      Height = windowHeight,
      Padding = new Thickness(16),
      ClipToBounds = true,
      Background = Assert.IsAssignableFrom<IBrush>(
        window.Resources[FsusThemeResourceKeys.BackgroundBrush]),
      Child = dialog,
    };
    window.Content = surface;
    return new DialogFixture(window, surface, dialog, fields, footer);
  }

  private static Window CreateStyledWindow(
    double width,
    double height,
    FsusThemeVariant theme,
    FlowDirection flowDirection,
    FsusMotionMode motionMode)
  {
    var window = new Window
    {
      Width = width,
      Height = height,
      FlowDirection = flowDirection,
      ShowInTaskbar = false,
    };
    window.Styles.Add(new FluentTheme());
    window.Styles.Add(new StyleInclude(new Uri("avares://FsusUI.Avalonia.Themes"))
    {
      Source = new Uri("avares://FsusUI.Avalonia.Themes/Themes/FsusTheme.axaml"),
    });
    new FsusThemeManager().Apply(
      window.Resources,
      new FsusThemeOptions
      {
        Variant = theme,
        Density = FsusDensity.Default,
        MotionMode = motionMode,
      });
    return window;
  }

  private static void AssertFullyVisible(Control control, ScrollViewer scrollViewer)
  {
    var transform = control.TransformToVisual(scrollViewer);
    Assert.True(transform.HasValue);
    var bounds = new Rect(
      0,
      0,
      control.Bounds.Width,
      control.Bounds.Height).TransformToAABB(transform.Value);
    Assert.True(bounds.Top >= -1, $"Control top {bounds.Top} must be visible.");
    Assert.True(
      bounds.Bottom <= scrollViewer.Viewport.Height + 1,
      $"Control bottom {bounds.Bottom} exceeds viewport {scrollViewer.Viewport.Height}.");
  }

  private static T RequirePart<T>(Control control, string name)
    where T : Control
  {
    var part = control
      .GetVisualDescendants()
      .OfType<T>()
      .SingleOrDefault(candidate => candidate.Name == name);
    return Assert.IsType<T>(part);
  }

  private static void WriteCapture(string outputRoot, RenderCapture capture)
  {
    var capturePath = Path.Combine(
      outputRoot,
      $"{Path.GetFileNameWithoutExtension(capture.File)}.json");
    File.WriteAllText(
      capturePath,
      JsonSerializer.Serialize(
        new
        {
          schemaVersion = 1,
          generatedBy =
            "FsusDialogScrollableBodyHeadlessTests.ProductionThemeRenderCoversThemeRtlZoomAndFixedFooter",
          repository = "Ozwasyd/FsusUI",
          renderer = "avalonia-headless-skia",
          productionControl = nameof(FsusDialog),
          fixtureClass = "production",
          issue = 644,
          capture,
        },
        new JsonSerializerOptions { WriteIndented = true }) + "\n");
  }

  private static void WriteAutomationTree(
    string outputRoot,
    string screenshotFile,
    FsusThemeVariant theme,
    string direction,
    double renderScaling,
    DialogFixture fixture)
  {
    var outputPath = Path.Combine(
      outputRoot,
      $"{Path.GetFileNameWithoutExtension(screenshotFile)}-automation-tree-simulation.json");
    File.WriteAllText(
      outputPath,
      JsonSerializer.Serialize(
        new
        {
          schemaVersion = 1,
          generatedBy =
            "FsusDialogScrollableBodyHeadlessTests.ProductionThemeRenderCoversThemeRtlZoomAndFixedFooter",
          evidenceClass = "local-headless-automation-tree-simulation",
          hardwareScreenReaderExecuted = false,
          repository = "Ozwasyd/FsusUI",
          issue = 644,
          theme = theme.ToString(),
          flowDirection = direction,
          renderScaling,
          dialog = new
          {
            automationName =
              AutomationProperties.GetName(fixture.Dialog) ?? string.Empty,
            automationClass =
              AutomationProperties.GetClassNameOverride(fixture.Dialog) ??
              string.Empty,
            automationStatus =
              AutomationProperties.GetItemStatus(fixture.Dialog) ?? string.Empty,
          },
          bodyFields = fixture.Fields.Select((field, index) => new
          {
            index = index + 1,
            role = nameof(TextBox),
            automationName =
              AutomationProperties.GetName(field) ?? string.Empty,
            isEnabled = field.IsEnabled,
            isVisible = field.IsVisible,
          }),
          footerActions = fixture.Footer.Children
            .OfType<FsusButton>()
            .Select(button => new
            {
              role = nameof(FsusButton),
              name = button.Content?.ToString() ?? string.Empty,
              isEnabled = button.IsEnabled,
              isVisible = button.IsVisible,
            }),
        },
        new JsonSerializerOptions { WriteIndented = true }) + "\n");
  }

  private sealed record DialogFixture(
    Window Window,
    Border Surface,
    FsusDialog Dialog,
    List<TextBox> Fields,
    StackPanel Footer);

  private sealed record RenderCapture(
    string File,
    string Sha256,
    int PixelWidth,
    int PixelHeight,
    double ViewportWidth,
    double ViewportHeight,
    double RenderScaling,
    string Theme,
    string FlowDirection,
    double BodyOffset,
    double FooterTop,
    string AutomationName,
    string AutomationClass,
    string AutomationEvidenceClass);
}
