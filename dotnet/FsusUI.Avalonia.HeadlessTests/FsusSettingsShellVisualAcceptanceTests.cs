using Avalonia;
using Avalonia.Automation;
using Avalonia.Automation.Peers;
using Avalonia.Automation.Provider;
using Avalonia.Controls;
using Avalonia.Controls.Primitives;
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
using FsusUI.Avalonia.Themes;
using System.Security.Cryptography;
using System.Text.Json;

namespace FsusUI.Avalonia.HeadlessTests;

public class FsusSettingsShellVisualAcceptanceTests
{
  [AvaloniaFact]
  public void RealHeadlessSkiaRenderProducesSettingsShellEvidenceMatrix()
  {
    var outputRoot = Path.Combine(
      FindRepositoryRoot(),
      "dotnet",
      "FsusUI.Avalonia.HeadlessTests",
      "TestResults",
      "issue-653-settings-shell");
    Directory.CreateDirectory(outputRoot);

    var scenarios = new[]
    {
      new RenderScenario("light-wide", FsusThemeVariant.Light, false, 950, 650, false, false, "general"),
      new RenderScenario("dark-long-content", FsusThemeVariant.Dark, false, 950, 650, false, false, "privacy"),
      new RenderScenario("high-contrast-focus", FsusThemeVariant.Dark, true, 950, 650, false, false, "appearance"),
      new RenderScenario("light-narrow", FsusThemeVariant.Light, false, 620, 650, false, false, "notifications"),
      new RenderScenario("dark-narrow-rtl", FsusThemeVariant.Dark, false, 620, 650, true, false, "network"),
      new RenderScenario("light-zoom-equivalent-200", FsusThemeVariant.Light, false, 475, 325, false, false, "advanced"),
      new RenderScenario("light-empty", FsusThemeVariant.Light, false, 620, 650, false, true, string.Empty),
    };

    var captures = scenarios.Select((scenario) => Render(outputRoot, scenario)).ToArray();

    Assert.Equal(7, captures.Length);
    Assert.All(captures, capture =>
    {
      Assert.Equal(64, capture.Sha256.Length);
      Assert.True(capture.PixelSize.Width > 0);
      Assert.True(capture.PixelSize.Height > 0);
      Assert.True(File.Exists(Path.Combine(FindRepositoryRoot(), capture.File)));
    });

    var manifestPath = Path.Combine(outputRoot, "settings-shell-render-manifest.json");
    File.WriteAllText(
      manifestPath,
      JsonSerializer.Serialize(
        new
        {
          schemaVersion = 1,
          issue = 653,
          generatedBy =
            "FsusSettingsShellVisualAcceptanceTests.RealHeadlessSkiaRenderProducesSettingsShellEvidenceMatrix",
          fixtureClass = "production",
          renderer = new
          {
            platform = "avalonia",
            runner = "headless-skia",
            drawingBackend = "Skia",
            avaloniaVersion = typeof(Application).Assembly.GetName().Version?.ToString(),
          },
          simulation =
            "Local deterministic Headless Skia simulation; no external hardware or CI service is represented.",
          captures,
        },
        new JsonSerializerOptions
        {
          WriteIndented = true,
          PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        }) + "\n");

    Assert.True(File.Exists(manifestPath));
    Assert.True(new FileInfo(manifestPath).Length > 1_000);
  }

  private static SettingsShellCapture Render(string outputRoot, RenderScenario scenario)
  {
    var window = new Window
    {
      Width = scenario.Width,
      Height = scenario.Height,
      ShowInTaskbar = false,
      FlowDirection = FlowDirection.LeftToRight,
    };
    window.Styles.Add(new FluentTheme());
    window.Styles.Add(new StyleInclude(new Uri("avares://FsusUI.Avalonia.HeadlessTests"))
    {
      Source = new Uri("avares://FsusUI.Avalonia.Themes/Themes/FsusTheme.axaml"),
    });
    new FsusThemeManager().Apply(
      window.Resources,
      new FsusThemeOptions
      {
        Variant = scenario.Variant,
        HighContrast = scenario.HighContrast,
        Density = FsusDensity.Default,
        MotionMode = FsusMotionMode.Reduced,
      });
    window.RequestedThemeVariant = scenario.Variant == FsusThemeVariant.Dark
      ? ThemeVariant.Dark
      : ThemeVariant.Light;

    var shell = BuildShell(scenario.Empty);
    shell.FlowDirection = scenario.RightToLeft
      ? FlowDirection.RightToLeft
      : FlowDirection.LeftToRight;
    var surface = new Border
    {
      Width = scenario.Width,
      Height = scenario.Height,
      Background = Assert.IsAssignableFrom<IBrush>(
        window.Resources[FsusThemeResourceKeys.BackgroundBrush]),
      Child = shell,
    };
    window.Content = surface;
    window.Show();
    Dispatcher.UIThread.RunJobs();

    if (scenario.RightToLeft)
    {
      // This fixture uses English task copy inside an RTL shell. Mark each
      // English run as an explicit LTR bidi island while keeping the shell,
      // rail placement, and source-order semantics RTL.
      foreach (var control in shell.GetVisualDescendants().OfType<Control>())
      {
        if (control is TextBlock or TextBox or Button or CheckBox or FsusSettingsCategory)
        {
          control.FlowDirection = FlowDirection.LeftToRight;
        }
      }
    }

    if (!scenario.Empty)
    {
      shell.SelectKey(scenario.SelectedKey);
      var focused = Assert.Single(
        shell.Categories,
        (category) => category.Key == scenario.SelectedKey);
      Assert.True(focused.Focus(NavigationMethod.Tab));
      if (scenario.Name == "dark-long-content")
      {
        shell.SetContentScrollOffset(new Vector(0, 280));
      }
    }

    window.Measure(new Size(scenario.Width, scenario.Height));
    window.Arrange(new Rect(0, 0, scenario.Width, scenario.Height));
    surface.Measure(new Size(scenario.Width, scenario.Height));
    surface.Arrange(new Rect(0, 0, scenario.Width, scenario.Height));
    Dispatcher.UIThread.RunJobs();

    Assert.Equal(scenario.Empty ? 0 : 7, shell.Categories.Count);
    Assert.Equal(scenario.Empty ? 0 : 1, shell.Categories.Count((category) => category.IsSelected));
    Assert.Equal(scenario.Width < shell.NarrowBreakpointWidth, shell.IsNarrow);
    Assert.Equal(
      ScrollBarVisibility.Disabled,
      shell.ContentScrollViewer.HorizontalScrollBarVisibility);

    var rail = Assert.Single(
      shell.GetVisualDescendants().OfType<Border>(),
      (border) => border.Classes.Contains("fsus-settings-rail"));
    var actions = Assert.Single(
      shell.GetVisualDescendants().OfType<Border>(),
      (border) => border.Classes.Contains("fsus-settings-actions"));
    Assert.Equal(
      shell.IsNarrow ? shell.NarrowRailWidth : shell.RailWidth,
      rail.Bounds.Width);
    Assert.True(actions.Bounds.Height > 0);
    Assert.True(shell.ContentScrollViewer.Bounds.Height > 0);
    var layoutRoot = Assert.IsType<Grid>(rail.Parent);
    var railOrigin = Assert.NotNull(rail.TranslatePoint(default, layoutRoot));
    var actionsOrigin = Assert.NotNull(actions.TranslatePoint(default, layoutRoot));
    if (scenario.RightToLeft)
    {
      Assert.True(
        railOrigin.X > actionsOrigin.X,
        $"RTL rail origin {railOrigin.X} must be right of actions origin {actionsOrigin.X}.");
    }
    else
    {
      Assert.True(
        railOrigin.X < actionsOrigin.X,
        $"LTR rail origin {railOrigin.X} must be left of actions origin {actionsOrigin.X}.");
    }

    var pixelWidth = Math.Max(1, (int)Math.Ceiling(scenario.Width));
    var pixelHeight = Math.Max(1, (int)Math.Ceiling(scenario.Height));
    using var bitmap = new RenderTargetBitmap(
      new PixelSize(pixelWidth, pixelHeight),
      new Vector(96, 96));
    bitmap.Render(surface);
    var fileName = $"settings-shell-{scenario.Name}.png";
    var outputPath = Path.Combine(outputRoot, fileName);
    using (var stream = File.Create(outputPath))
    {
      bitmap.Save(stream);
    }

    var automationPath = Path.Combine(
      outputRoot,
      $"settings-shell-{scenario.Name}-automation.json");
    var shellProvider = Assert.IsAssignableFrom<ISelectionProvider>(
      ControlAutomationPeer.CreatePeerForElement(shell));
    File.WriteAllText(
      automationPath,
      JsonSerializer.Serialize(
        new
        {
          shellName = AutomationProperties.GetName(shell),
          shellStatus = AutomationProperties.GetItemStatus(shell),
          canSelectMultiple = shellProvider.CanSelectMultiple,
          isSelectionRequired = shellProvider.IsSelectionRequired,
          selectedCount = shellProvider.GetSelection().Count,
          categories = shell.Categories.Select((category) =>
          {
            var provider = Assert.IsAssignableFrom<ISelectionItemProvider>(
              ControlAutomationPeer.CreatePeerForElement(category));
            return new
            {
              category.Key,
              name = AutomationProperties.GetName(category),
              status = AutomationProperties.GetItemStatus(category),
              provider.IsSelected,
              category.IsEnabled,
              positionInSet = AutomationProperties.GetPositionInSet(category),
              sizeOfSet = AutomationProperties.GetSizeOfSet(category),
            };
          }),
        },
        new JsonSerializerOptions
        {
          WriteIndented = true,
          PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        }) + "\n");

    window.Close();

    return new SettingsShellCapture(
      Path.GetRelativePath(FindRepositoryRoot(), outputPath).Replace('\\', '/'),
      Convert.ToHexStringLower(SHA256.HashData(File.ReadAllBytes(outputPath))),
      Path.GetRelativePath(FindRepositoryRoot(), automationPath).Replace('\\', '/'),
      Convert.ToHexStringLower(SHA256.HashData(File.ReadAllBytes(automationPath))),
      new PixelDimension(bitmap.PixelSize.Width, bitmap.PixelSize.Height),
      scenario.Name,
      scenario.Variant.ToString(),
      scenario.HighContrast,
      scenario.RightToLeft,
      scenario.RightToLeft ? "english-ltr-bidi-islands-in-rtl-shell" : null,
      scenario.Width,
      scenario.Height,
      scenario.Name.Contains("zoom-equivalent", StringComparison.Ordinal)
        ? "200-percent-logical-viewport-equivalent"
        : null,
      scenario.Empty ? "empty" : scenario.SelectedKey,
      scenario.Empty ? 0 : 7);
  }

  private static FsusSettingsShell BuildShell(bool empty)
  {
    var shell = new FsusSettingsShell
    {
      AccessibleName = "Application settings",
      SearchSlot = CreateSearchBox(),
      ActionsSlot = new WrapPanel
      {
        Orientation = Orientation.Horizontal,
        ItemSpacing = 8,
        Children =
        {
          new Button { Content = "Cancel" },
          new Button { Content = "Save changes" },
        },
      },
      RailHeader = new TextBlock
      {
        Text = "Settings",
        FontWeight = FontWeight.Bold,
      },
      RailFooter = new TextBlock
      {
        Text = "Changes stay local until saved.",
        TextWrapping = TextWrapping.Wrap,
      },
    };

    if (empty)
    {
      return shell;
    }

    var categories = new[]
    {
      ("general", "General", "GE", false),
      ("appearance", "Appearance", "AP", false),
      ("notifications", "Notifications", "NO", false),
      ("privacy", "Privacy & Security", "PS", false),
      ("network", "Network and proxy", "NW", false),
      ("accessibility", "Accessibility", "AC", true),
      ("advanced", "Advanced diagnostics and developer options", null, false),
    };
    foreach (var (key, label, icon, disabled) in categories)
    {
      shell.Categories.Add(new FsusSettingsCategory
      {
        Key = key,
        Header = label,
        Icon = icon is null ? null : new TextBlock { Text = icon, FontWeight = FontWeight.Bold },
        AccessibleName = label,
        IsEnabled = !disabled,
        Content = BuildCategoryContent(label),
      });
    }
    return shell;
  }

  private static TextBox CreateSearchBox()
  {
    var search = new TextBox
    {
      PlaceholderText = "Search settings",
      Text = string.Empty,
    };
    AutomationProperties.SetName(search, "Search settings");
    return search;
  }

  private static Control BuildCategoryContent(string category)
  {
    var content = new StackPanel { Spacing = 16 };
    content.Children.Add(new TextBlock
    {
      Text = category,
      FontSize = 20,
      FontWeight = FontWeight.Bold,
      TextWrapping = TextWrapping.Wrap,
    });
    content.Children.Add(new TextBlock
    {
      Text =
        $"Configure {category.ToLowerInvariant()} preferences for this application. " +
        "Settings remain on this device until the host saves them.",
      TextWrapping = TextWrapping.Wrap,
    });
    for (var index = 0; index < 14; index++)
    {
      content.Children.Add(new CheckBox
      {
        Content =
          $"{category} preference {index + 1}: preserve the current workspace behavior",
        IsChecked = index % 3 == 0,
      });
    }
    return content;
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

  private sealed record RenderScenario(
    string Name,
    FsusThemeVariant Variant,
    bool HighContrast,
    double Width,
    double Height,
    bool RightToLeft,
    bool Empty,
    string SelectedKey);

  private sealed record PixelDimension(int Width, int Height);

  private sealed record SettingsShellCapture(
    string File,
    string Sha256,
    string AutomationFile,
    string AutomationSha256,
    PixelDimension PixelSize,
    string Scenario,
    string Theme,
    bool HighContrast,
    bool RightToLeft,
    string? BidiContentMode,
    double WidthDip,
    double HeightDip,
    string? ZoomSimulation,
    string State,
    int CategoryCount);
}
