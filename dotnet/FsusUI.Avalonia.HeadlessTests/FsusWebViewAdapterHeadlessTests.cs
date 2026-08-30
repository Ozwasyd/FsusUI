using Avalonia;
using Avalonia.Automation;
using Avalonia.Automation.Peers;
using Avalonia.Controls;
using Avalonia.Headless;
using Avalonia.Headless.XUnit;
using Avalonia.Markup.Xaml.Styling;
using Avalonia.Media;
using Avalonia.Media.Imaging;
using FsusUI.Avalonia.Controls;
using FsusUI.Avalonia.Overlay;
using FsusUI.Avalonia.Themes;
using System.Security.Cryptography;
using System.Text.Json;

namespace FsusUI.Avalonia.HeadlessTests;

public class FsusWebViewAdapterHeadlessTests
{
  [AvaloniaFact]
  public void ProductionContextMenuFixtureRendersThemeViewportZoomAndAutomationMatrix()
  {
    EnsureFullTheme();
    var repositoryRoot = FindRepositoryRoot();
    var outputRoot = HeadlessVisualEvidenceOutput.ResolveOutputRoot(
      repositoryRoot,
      "issue-652-672-webview-adapter");
    var captures = new List<object>();

    foreach (var scenario in new[]
    {
      new Scenario("light-wide-pointer", FsusThemeVariant.Light, 900, 520, 100,
        FsusWebViewContextMenuOrigin.Pointer),
      new Scenario("dark-wide-keyboard", FsusThemeVariant.Dark, 900, 520, 100,
        FsusWebViewContextMenuOrigin.Keyboard),
      new Scenario("light-narrow-pointer", FsusThemeVariant.Light, 520, 520, 100,
        FsusWebViewContextMenuOrigin.Pointer),
      new Scenario("dark-zoom-equivalent-200", FsusThemeVariant.Dark, 450, 360, 200,
        FsusWebViewContextMenuOrigin.Keyboard),
    })
    {
      var fixture = CreateFixture(scenario);
      fixture.Window.Show();
      Arrange(fixture.Root, scenario.Width, scenario.Height);
      var request = CreateRequest(scenario.Origin);
      fixture.Adapter.OpenContextMenu(
        fixture.Host,
        fixture.Menu,
        request,
        fixture.Invoker,
        scenario.Name.Contains("narrow", StringComparison.Ordinal)
          ? new FsusWebViewContextMenuLabels
          {
            AccessibleName = "编辑器操作",
            Cut = "剪切",
            Copy = "复制",
            Paste = "粘贴",
            AddToDictionary = "添加到词典",
          }
          : null);
      Arrange(fixture.Root, scenario.Width, scenario.Height);

      Assert.True(fixture.Menu.IsOpen);
      Assert.Equal("fsus-webview:replace:0", fixture.Menu.FocusedKey);
      Assert.Same(fixture.Invoker, fixture.Menu.Invoker);
      Assert.Equal(AutomationControlType.Menu,
        AutomationProperties.GetControlTypeOverride(fixture.Menu));
      Assert.All(fixture.Menu.Items.OfType<FsusContextMenuItem>(), item =>
      {
        Assert.True(item.Bounds.Height >= 40);
        Assert.False(string.IsNullOrWhiteSpace(AutomationProperties.GetName(item)));
        Assert.Equal(AutomationControlType.MenuItem,
          AutomationProperties.GetControlTypeOverride(item));
        Assert.NotNull(ControlAutomationPeer.CreatePeerForElement(item));
      });
      Assert.True(fixture.Menu.Bounds.Right <= scenario.Width);
      Assert.True(
        fixture.Menu.Bounds.Bottom <= scenario.Height,
        $"{scenario.Name}: menu bounds {fixture.Menu.Bounds} exceed height {scenario.Height}.");

      var scale = scenario.Zoom / 100d;
      var fileName = $"webview-context-{scenario.Name}.png";
      var outputPath = Path.Combine(outputRoot, fileName);
      using (var bitmap = new RenderTargetBitmap(
        new PixelSize(
          Math.Max(1, (int)(scenario.Width * scale)),
          Math.Max(1, (int)(scenario.Height * scale))),
        new Vector(96 * scale, 96 * scale)))
      {
        bitmap.Render(fixture.Root);
        using var stream = File.Create(outputPath);
        bitmap.Save(stream);
      }

      var itemEvidence = fixture.Menu.Items.OfType<FsusContextMenuItem>()
        .Select(item => new
        {
          item.Key,
          name = AutomationProperties.GetName(item),
          status = AutomationProperties.GetItemStatus(item),
          bounds = item.Bounds,
        })
        .ToArray();
      Assert.True(fixture.Menu.CloseAsync().AsTask().GetAwaiter().GetResult());
      Assert.Same(fixture.Invoker, fixture.Host.LastRestoredFocus);
      captures.Add(new
      {
        scenario.Name,
        theme = scenario.Theme.ToString().ToLowerInvariant(),
        viewport = $"{scenario.Width}x{scenario.Height}",
        zoomPercent = scenario.Zoom,
        input = scenario.Origin.ToString().ToLowerInvariant(),
        artifact = HeadlessVisualEvidenceOutput.RecordPath(repositoryRoot, outputPath),
        sha256 = Convert.ToHexStringLower(SHA256.HashData(File.ReadAllBytes(outputPath))),
        menuBounds = fixture.Menu.Bounds,
        itemEvidence,
        focusRestored = ReferenceEquals(fixture.Invoker, fixture.Host.LastRestoredFocus),
      });
      fixture.Adapter.Dispose();
      fixture.Window.Close();
    }

    var automationPath = Path.Combine(outputRoot, "automation-report.json");
    File.WriteAllText(
      automationPath,
      JsonSerializer.Serialize(
        new
        {
          evidenceClass = "local-avalonia-automation-simulation",
          limitation =
            "AutomationPeer and AutomationProperties inspection; not a real OS screen-reader or external WebView run.",
          menuRole = "Menu",
          itemRole = "MenuItem",
          pointerAndKeyboardOrigins = true,
          escapeAndCloseRestoreInvokerFocus = true,
        },
        new JsonSerializerOptions { WriteIndented = true }) + "\n");

    var manifestPath = Path.Combine(outputRoot, "manifest.json");
    File.WriteAllText(
      manifestPath,
      JsonSerializer.Serialize(
        new
        {
          schemaVersion = 1,
          issues = new[] { 652, 672 },
          candidateSha = Environment.GetEnvironmentVariable("FSUS_WEBVIEW_CANDIDATE_SHA")
            ?? "working-tree-candidate",
          fixtureClass = "production",
          evidenceClass = "local-headless-skia-and-adapter-simulation",
          simulation =
            "The real FsusContextMenu, theme, overlay, focus and automation paths are rendered. Embedded-browser and PDF engines are deterministic adapters, not external engine execution.",
          captures,
          automation = new
          {
            path = HeadlessVisualEvidenceOutput.RecordPath(repositoryRoot, automationPath),
            sha256 = Convert.ToHexStringLower(
              SHA256.HashData(File.ReadAllBytes(automationPath))),
          },
        },
        new JsonSerializerOptions { WriteIndented = true }) + "\n");

    Assert.Equal(4, captures.Count);
    Assert.True(new FileInfo(manifestPath).Length > 1_000);
  }

  private static Fixture CreateFixture(Scenario scenario)
  {
    var application = Assert.IsAssignableFrom<Application>(Application.Current);
    new FsusThemeManager().Apply(application, new FsusThemeOptions
    {
      Variant = scenario.Theme,
      Density = FsusDensity.Default,
      MotionMode = FsusMotionMode.Reduced,
    });
    var invoker = new Button
    {
      Content = "Editable article preview",
      HorizontalAlignment = global::Avalonia.Layout.HorizontalAlignment.Left,
      VerticalAlignment = global::Avalonia.Layout.VerticalAlignment.Top,
      Margin = new Thickness(24),
    };
    AutomationProperties.SetName(invoker, "Editable article preview");
    var content = new Border
    {
      Background = Assert.IsAssignableFrom<IBrush>(
        application.Resources[FsusThemeResourceKeys.BackgroundBrush]),
      Child = invoker,
    };
    var host = new FsusOverlayHost
    {
      Width = scenario.Width,
      Height = scenario.Height,
      Background = Brushes.Transparent,
      IsHitTestVisible = false,
    };
    var root = new Grid
    {
      Width = scenario.Width,
      Height = scenario.Height,
      Background = Assert.IsAssignableFrom<IBrush>(
        application.Resources[FsusThemeResourceKeys.BackgroundBrush]),
    };
    root.Children.Add(content);
    root.Children.Add(host);
    var menu = new FsusContextMenu
    {
      OverlaySize = new Size(280, 280),
      ViewportBounds = new Rect(0, 0, scenario.Width, scenario.Height),
    };
    var window = new Window
    {
      Width = scenario.Width,
      Height = scenario.Height,
      ShowInTaskbar = false,
      Content = root,
      RequestedThemeVariant = scenario.Theme == FsusThemeVariant.Dark
        ? global::Avalonia.Styling.ThemeVariant.Dark
        : global::Avalonia.Styling.ThemeVariant.Light,
    };
    return new Fixture(
      window,
      root,
      host,
      menu,
      invoker,
      new FsusWebViewAdapter(new VisualBackend()));
  }

  private static FsusWebViewContextMenuRequest CreateRequest(
    FsusWebViewContextMenuOrigin origin) => new()
    {
      Origin = origin,
      ViewportPoint = new FsusWebViewViewportPoint(190, 52),
      IsEditable = true,
      HasSelection = true,
      IsImageContent = true,
      EditCapabilities =
      FsusWebViewEditCapabilities.Cut |
      FsusWebViewEditCapabilities.Copy |
      FsusWebViewEditCapabilities.Paste |
      FsusWebViewEditCapabilities.RichEdit,
      MisspelledWord = "teh",
      SpellingSuggestions =
    [
      new FsusWebViewSpellingSuggestion("the", "the"),
      new FsusWebViewSpellingSuggestion("tech", "tech"),
    ],
      NativeMenuFallbackAvailable = true,
    };

  private static void Arrange(Control root, double width, double height)
  {
    root.InvalidateMeasure();
    root.InvalidateArrange();
    root.Measure(new Size(width, height));
    root.Arrange(new Rect(0, 0, width, height));
    AvaloniaHeadlessPlatform.ForceRenderTimerTick();
  }

  private static void EnsureFullTheme()
  {
    var application = Assert.IsAssignableFrom<Application>(Application.Current);
    application.Styles.Add(new StyleInclude(
      new Uri("avares://FsusUI.Avalonia.HeadlessTests"))
    {
      Source = new Uri("avares://FsusUI.Avalonia.Themes/Themes/FsusTheme.axaml"),
    });
  }

  private static string FindRepositoryRoot()
  {
    var current = new DirectoryInfo(AppContext.BaseDirectory);
    while (current is not null)
    {
      if (File.Exists(Path.Combine(current.FullName, "pnpm-workspace.yaml")))
      {
        return current.FullName;
      }

      current = current.Parent;
    }

    throw new DirectoryNotFoundException("Could not find the repository root.");
  }

  private sealed class VisualBackend : IFsusWebViewBackendAdapter
  {
    public FsusWebViewCapabilities Capabilities { get; } = new()
    {
      Platform = FsusWebViewPlatform.Linux,
      SpellingSuggestions = true,
      ReplaceWord = true,
      AddToDictionary = true,
      NativeContextMenu = true,
      TaggedPdf = true,
      DocumentOutline = true,
    };

    public event EventHandler<FsusWebViewContextMenuRequestedEventArgs>? ContextMenuRequested
    {
      add { }
      remove { }
    }

    public ValueTask<FsusWebViewCommandResult> ExecuteContextCommandAsync(
      FsusWebViewContextCommandRequest request,
      CancellationToken cancellationToken = default) =>
      ValueTask.FromResult(new FsusWebViewCommandResult(
        FsusWebViewCommandStatus.Succeeded));

    public ValueTask<FsusWebViewCommandResult> OpenDeveloperToolsAsync(
      CancellationToken cancellationToken = default) =>
      ValueTask.FromResult(FsusWebViewCommandResult.Unsupported("Not used by fixture."));

    public ValueTask<FsusWebViewPdfExportResult> ExportPdfAsync(
      FsusWebViewPdfExportOptions options,
      Stream destination,
      CancellationToken cancellationToken = default) =>
      ValueTask.FromResult(new FsusWebViewPdfExportResult
      {
        Status = FsusWebViewCommandStatus.Unsupported,
        Detail = "Not used by rendered context-menu fixture.",
      });
  }

  private sealed record Scenario(
    string Name,
    FsusThemeVariant Theme,
    int Width,
    int Height,
    int Zoom,
    FsusWebViewContextMenuOrigin Origin);

  private sealed record Fixture(
    Window Window,
    Grid Root,
    FsusOverlayHost Host,
    FsusContextMenu Menu,
    Button Invoker,
    FsusWebViewAdapter Adapter);
}
