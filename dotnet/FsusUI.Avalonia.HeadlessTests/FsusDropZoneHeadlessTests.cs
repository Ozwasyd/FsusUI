using Avalonia;
using Avalonia.Automation;
using Avalonia.Automation.Peers;
using Avalonia.Controls;
using Avalonia.Controls.Primitives;
using Avalonia.Headless.XUnit;
using Avalonia.Input;
using Avalonia.Markup.Xaml.Styling;
using Avalonia.Media;
using Avalonia.Media.Imaging;
using Avalonia.Themes.Fluent;
using Avalonia.Threading;
using FsusUI.Avalonia.Controls;
using FsusUI.Avalonia.Themes;
using System.Security.Cryptography;
using System.Text.Json;
using System.Windows.Input;

namespace FsusUI.Avalonia.HeadlessTests;

public class FsusDropZoneHeadlessTests
{
  public static IEnumerable<object[]> ThemeAndDirectionVariants()
  {
    yield return new object[] { nameof(FsusThemeVariant.Light), false, FlowDirection.LeftToRight, 96.0 };
    yield return new object[] { nameof(FsusThemeVariant.Dark), false, FlowDirection.LeftToRight, 96.0 };
    yield return new object[] { "HighContrast", true, FlowDirection.LeftToRight, 96.0 };
    yield return new object[] { nameof(FsusThemeVariant.Light), false, FlowDirection.RightToLeft, 96.0 };
    yield return new object[] { nameof(FsusThemeVariant.Light), false, FlowDirection.LeftToRight, 144.0 }; // 150%
    yield return new object[] { nameof(FsusThemeVariant.Dark), false, FlowDirection.LeftToRight, 192.0 }; // 200%
  }

  [AvaloniaTheory]
  [MemberData(nameof(ThemeAndDirectionVariants))]
  public void DropZoneMountsAndRendersUnderThemesRtlAndScales(
    string themeName,
    bool highContrast,
    FlowDirection flowDirection,
    double dpi)
  {
    var dropZone = new FsusDropZone
    {
      Width = 380,
      Height = 120,
      AccessibleName = "Contract upload zone",
      Instruction = "Drop contracts here or click to browse",
      HelpText = "PDF or PNG format up to 25MB",
      FlowDirection = flowDirection,
    };

    var window = CreateStyledWindow();
    ApplyTheme(window, themeName, highContrast);

    var container = new Border
    {
      Width = 440,
      Height = 180,
      Padding = new Thickness(24),
      Child = dropZone,
      FlowDirection = flowDirection,
    };

    window.Content = container;
    window.Show();
    Dispatcher.UIThread.RunJobs();

    Assert.True(dropZone.IsVisible);
    Assert.Equal("Contract upload zone", AutomationProperties.GetName(dropZone));
    Assert.Equal("PDF or PNG format up to 25MB", AutomationProperties.GetHelpText(dropZone));
    Assert.Equal("ready", AutomationProperties.GetItemStatus(dropZone));

    // Render verification under specified DPI scaling
    var pixelScale = dpi / 96.0;
    var pixelWidth = (int)Math.Round(440 * pixelScale);
    var pixelHeight = (int)Math.Round(180 * pixelScale);

    using var bitmap = new RenderTargetBitmap(
      new PixelSize(pixelWidth, pixelHeight),
      new Vector(dpi, dpi));
    bitmap.Render(container);

    Assert.Equal(pixelWidth, bitmap.PixelSize.Width);
    Assert.Equal(pixelHeight, bitmap.PixelSize.Height);

    window.Close();
  }

  [AvaloniaFact]
  public void DropZoneMaintainsZeroLayoutShiftAcrossPointerDragDropAndFocusStates()
  {
    var dropZone = new FsusDropZone
    {
      Width = 360,
      Height = 110,
      Instruction = "Drop files here",
      HelpText = "All formats accepted",
    };

    var window = CreateStyledWindow();
    ApplyTheme(window, nameof(FsusThemeVariant.Light), false);

    var panel = new StackPanel
    {
      Children = { dropZone },
    };

    window.Content = panel;
    window.Show();
    Dispatcher.UIThread.RunJobs();

    // 1. Initial baseline bounds
    var baseBounds = dropZone.Bounds;
    Assert.True(baseBounds.Width > 0);
    Assert.True(baseBounds.Height > 0);
    var expectedWidth = baseBounds.Width;
    var expectedHeight = baseBounds.Height;

    // 2. Focus state
    Assert.True(dropZone.Focus(), "DropZone should accept keyboard focus");
    Dispatcher.UIThread.RunJobs();
    Assert.True(dropZone.IsFocused);
    Assert.Equal(expectedWidth, dropZone.Bounds.Width);
    Assert.Equal(expectedHeight, dropZone.Bounds.Height);

    // 3. Pointerover / Hover state
    dropZone.Classes.Add("fsus-pointerover");
    Dispatcher.UIThread.RunJobs();
    Assert.Equal(expectedWidth, dropZone.Bounds.Width);
    Assert.Equal(expectedHeight, dropZone.Bounds.Height);
    dropZone.Classes.Remove("fsus-pointerover");

    // 4. DragOver state
    dropZone.Classes.Add("fsus-dragover");
    Dispatcher.UIThread.RunJobs();
    Assert.Equal(expectedWidth, dropZone.Bounds.Width);
    Assert.Equal(expectedHeight, dropZone.Bounds.Height);

    // 5. Drop handling
    dropZone.HandleDrop(new[] { "payload.json" });
    Dispatcher.UIThread.RunJobs();
    Assert.Equal(expectedWidth, dropZone.Bounds.Width);
    Assert.Equal(expectedHeight, dropZone.Bounds.Height);

    // 6. Filter error state
    dropZone.Accepts = ".png";
    dropZone.HandleDrop(new[] { "payload.json" });
    Dispatcher.UIThread.RunJobs();
    Assert.True(dropZone.HasFilterError);
    Assert.Equal(expectedWidth, dropZone.Bounds.Width);
    Assert.Equal(expectedHeight, dropZone.Bounds.Height);

    // 7. Loading state
    dropZone.IsLoading = true;
    Dispatcher.UIThread.RunJobs();
    Assert.Equal(expectedWidth, dropZone.Bounds.Width);
    Assert.Equal(expectedHeight, dropZone.Bounds.Height);

    // 8. Disabled state
    dropZone.IsLoading = false;
    dropZone.IsDisabled = true;
    Dispatcher.UIThread.RunJobs();
    Assert.Equal(expectedWidth, dropZone.Bounds.Width);
    Assert.Equal(expectedHeight, dropZone.Bounds.Height);

    window.Close();
  }

  [AvaloniaFact]
  public void KeyboardActivationTriggersConsumerSpecifiedBrowseAction()
  {
    var browseRequestedCount = 0;
    var commandExecutedCount = 0;
    var command = new TestCommand(_ => commandExecutedCount++);

    var dropZone = new FsusDropZone
    {
      Width = 320,
      Height = 100,
      BrowseCommand = command,
      BrowseCommandParameter = "select-docs",
    };
    dropZone.BrowseRequested += (_, _) => browseRequestedCount++;

    var window = CreateStyledWindow();
    ApplyTheme(window, nameof(FsusThemeVariant.Light), false);
    window.Content = dropZone;
    window.Show();
    Dispatcher.UIThread.RunJobs();

    Assert.True(dropZone.Focus());
    Dispatcher.UIThread.RunJobs();
    Assert.True(dropZone.IsFocused);

    // Trigger Enter key
    var enterArgs = new KeyEventArgs
    {
      RoutedEvent = InputElement.KeyDownEvent,
      Key = Key.Enter,
      Source = dropZone,
    };
    dropZone.RaiseEvent(enterArgs);
    Dispatcher.UIThread.RunJobs();

    Assert.Equal(1, browseRequestedCount);
    Assert.Equal(1, commandExecutedCount);
    Assert.True(enterArgs.Handled);

    // Trigger Space key
    var spaceArgs = new KeyEventArgs
    {
      RoutedEvent = InputElement.KeyDownEvent,
      Key = Key.Space,
      Source = dropZone,
    };
    dropZone.RaiseEvent(spaceArgs);
    Dispatcher.UIThread.RunJobs();

    Assert.Equal(2, browseRequestedCount);
    Assert.Equal(2, commandExecutedCount);
    Assert.True(spaceArgs.Handled);

    // Non-activation key (e.g. Tab or Escape) does not trigger browse
    var tabArgs = new KeyEventArgs
    {
      RoutedEvent = InputElement.KeyDownEvent,
      Key = Key.Tab,
      Source = dropZone,
    };
    dropZone.RaiseEvent(tabArgs);
    Dispatcher.UIThread.RunJobs();

    Assert.Equal(2, browseRequestedCount);
    Assert.Equal(2, commandExecutedCount);

    window.Close();
  }

  [AvaloniaFact]
  public void FilterFailureDisabledErrorAndLoadingStatesAreClearlyDistinguishable()
  {
    var dropZone = new FsusDropZone
    {
      Width = 340,
      Height = 100,
    };

    var window = CreateStyledWindow();
    ApplyTheme(window, nameof(FsusThemeVariant.Light), false);
    window.Content = dropZone;
    window.Show();
    Dispatcher.UIThread.RunJobs();

    // 1. Ready state
    Assert.Equal("ready", AutomationProperties.GetItemStatus(dropZone));
    Assert.Contains("fsus-multiple", dropZone.Classes);

    // 2. Disabled state
    dropZone.IsDisabled = true;
    Dispatcher.UIThread.RunJobs();
    Assert.Equal("disabled", AutomationProperties.GetItemStatus(dropZone));
    Assert.Contains("fsus-disabled", dropZone.Classes);
    Assert.False(dropZone.Focusable);

    // 3. Loading state
    dropZone.IsDisabled = false;
    dropZone.IsLoading = true;
    Dispatcher.UIThread.RunJobs();
    Assert.Equal("loading", AutomationProperties.GetItemStatus(dropZone));
    Assert.Contains("fsus-loading", dropZone.Classes);

    // 4. Custom Error state
    dropZone.IsLoading = false;
    dropZone.IsError = true;
    dropZone.ErrorMessage = "Cloud sync failed";
    Dispatcher.UIThread.RunJobs();
    Assert.Equal("error: Cloud sync failed", AutomationProperties.GetItemStatus(dropZone));
    Assert.Contains("fsus-has-error", dropZone.Classes);

    // 5. Filter Failure state
    dropZone.IsError = false;
    dropZone.ErrorMessage = null;
    dropZone.Accepts = ".png, .jpg";
    dropZone.HandleDrop(new[] { "manual.docx" });
    Dispatcher.UIThread.RunJobs();
    Assert.True(dropZone.HasFilterError);
    Assert.Contains("fsus-filter-error", dropZone.Classes);
    Assert.StartsWith("rejected:", AutomationProperties.GetItemStatus(dropZone));

    // Confirm that each state maps to distinct status identifiers
    var stateStatuses = new[]
    {
      "ready",
      "disabled",
      "loading",
      "error: Cloud sync failed",
      AutomationProperties.GetItemStatus(dropZone),
    };
    Assert.Equal(5, stateStatuses.Distinct().Count());

    window.Close();
  }

  [AvaloniaFact]
  public void RealHeadlessSkiaRendersDropZoneVisualStatesAndSavesArtifacts()
  {
    var outputRoot = Path.Combine(
      FindRepositoryRoot(),
      "tests",
      "conformance",
      "visual",
      "artifacts",
      "screenshots",
      "avalonia");
    Directory.CreateDirectory(outputRoot);

    var captures = new List<DropZoneRenderCapture>();

    foreach (var (themeName, highContrast) in new[]
      {
        (Theme: "Light", HighContrast: false),
        (Theme: "Dark", HighContrast: false),
        (Theme: "HighContrast", HighContrast: true),
      })
    {
      foreach (var state in new[] { "ready", "dragover", "focus", "loading", "error", "rejected" })
      {
        captures.Add(RenderDropZoneState(outputRoot, themeName, highContrast, state));
      }
    }

    Assert.Equal(18, captures.Count);
    Assert.All(captures, capture =>
    {
      Assert.Equal(64, capture.Sha256.Length);
      Assert.True(capture.PixelSize.Width > 0);
      Assert.True(capture.PixelSize.Height > 0);
      Assert.True(File.Exists(Path.Combine(FindRepositoryRoot(), capture.File)));
    });

    var manifestPath = Path.Combine(
      FindRepositoryRoot(),
      "tests",
      "conformance",
      "visual",
      "artifacts",
      "issue-655-avalonia-drop-zone-render-manifest.json");
    File.WriteAllText(
      manifestPath,
      JsonSerializer.Serialize(
        new
        {
          schemaVersion = 1,
          generatedBy =
            "FsusDropZoneHeadlessTests.RealHeadlessSkiaRendersDropZoneVisualStatesAndSavesArtifacts",
          renderer = new
          {
            platform = "avalonia",
            runner = "headless-skia",
            drawingBackend = "Skia",
            avaloniaVersion = typeof(Application).Assembly.GetName().Version?.ToString(),
          },
          issue = 655,
          captures,
        },
        new JsonSerializerOptions { WriteIndented = true }) + "\n");
  }

  private static DropZoneRenderCapture RenderDropZoneState(
    string outputRoot,
    string themeName,
    bool highContrast,
    string state)
  {
    var dropZone = new FsusDropZone
    {
      Width = 400,
      Height = 110,
      Instruction = "Drag files here or click to browse",
      HelpText = "Supported formats: PDF, PNG, CSV up to 15MB",
    };

    switch (state)
    {
      case "dragover":
        dropZone.Classes.Add("fsus-dragover");
        break;
      case "loading":
        dropZone.IsLoading = true;
        break;
      case "error":
        dropZone.IsError = true;
        dropZone.ErrorMessage = "Storage volume unavailable";
        break;
      case "rejected":
        dropZone.Accepts = ".pdf";
        dropZone.HandleDrop(new[] { "script.sh" });
        break;
    }

    var window = CreateStyledWindow();
    window.Width = 480;
    window.Height = 160;
    ApplyTheme(window, themeName, highContrast);

    var surfaceRoot = new Border
    {
      Width = 480,
      Height = 160,
      Padding = new Thickness(24),
      Background = Assert.IsAssignableFrom<IBrush>(
        window.Resources[FsusThemeResourceKeys.BackgroundBrush]),
      Child = dropZone,
    };

    window.Content = surfaceRoot;
    window.Show();

    if (state == "focus")
    {
      dropZone.Focus();
    }

    Dispatcher.UIThread.RunJobs();

    window.Measure(new Size(480, 160));
    window.Arrange(new Rect(0, 0, 480, 160));
    surfaceRoot.Measure(new Size(480, 160));
    surfaceRoot.Arrange(new Rect(0, 0, 480, 160));

    using var bitmap = new RenderTargetBitmap(new PixelSize(480, 160), new Vector(96, 96));
    bitmap.Render(surfaceRoot);

    var fileName = $"issue-655-dropzone-{themeName.ToLowerInvariant()}-{state}.png";
    var outputPath = Path.Combine(outputRoot, fileName);
    using (var stream = File.Create(outputPath))
    {
      bitmap.Save(stream);
    }

    window.Close();

    return new DropZoneRenderCapture(
      Path.GetRelativePath(FindRepositoryRoot(), outputPath).Replace('\\', '/'),
      Convert.ToHexStringLower(SHA256.HashData(File.ReadAllBytes(outputPath))),
      new PixelDimension(bitmap.PixelSize.Width, bitmap.PixelSize.Height),
      themeName,
      state);
  }

  private static Window CreateStyledWindow()
  {
    var window = new Window
    {
      Width = 480,
      Height = 240,
      ShowInTaskbar = false,
    };
    window.Styles.Add(new FluentTheme());
    window.Styles.Add(new StyleInclude(new Uri("avares://FsusUI.Avalonia.Themes"))
    {
      Source = new Uri("avares://FsusUI.Avalonia.Themes/Themes/FsusTheme.axaml"),
    });
    return window;
  }

  private static void ApplyTheme(Window window, string themeName, bool highContrast)
  {
    new FsusThemeManager().Apply(
      window.Resources,
      new FsusThemeOptions
      {
        Variant = highContrast
          ? FsusThemeVariant.Dark
          : Enum.Parse<FsusThemeVariant>(themeName),
        HighContrast = highContrast,
        Density = FsusDensity.Default,
        MotionMode = FsusMotionMode.Reduced,
      });
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

  private sealed class TestCommand(Action<object?> execute) : ICommand
  {
    public event EventHandler? CanExecuteChanged
    {
      add { }
      remove { }
    }

    public bool CanExecute(object? parameter) => true;
    public void Execute(object? parameter) => execute(parameter);
  }

  private sealed record PixelDimension(int Width, int Height);

  private sealed record DropZoneRenderCapture(
    string File,
    string Sha256,
    PixelDimension PixelSize,
    string Theme,
    string State);
}
