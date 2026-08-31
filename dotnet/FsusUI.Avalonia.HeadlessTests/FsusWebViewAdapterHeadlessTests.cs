using Avalonia;
using Avalonia.Automation;
using Avalonia.Automation.Peers;
using Avalonia.Controls;
using Avalonia.Headless;
using Avalonia.Headless.XUnit;
using Avalonia.Input;
using Avalonia.Markup.Xaml.Styling;
using Avalonia.Media;
using Avalonia.Media.Imaging;
using FsusUI.Avalonia.Controls;
using FsusUI.Avalonia.Overlay;
using FsusUI.Avalonia.TestFixtures;
using FsusUI.Avalonia.Themes;
using System.Diagnostics;
using System.Security.Cryptography;
using System.Text.Json;

namespace FsusUI.Avalonia.HeadlessTests;

public class FsusWebViewAdapterHeadlessTests
{
  [AvaloniaFact]
  public async Task ProductionContextMenuFixtureRendersThemeViewportZoomAndAutomationMatrix()
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
      new Scenario("light-native-fallback", FsusThemeVariant.Light, 900, 520, 100,
        FsusWebViewContextMenuOrigin.Keyboard, true),
    })
    {
      var fixture = CreateFixture(scenario);
      fixture.Window.Show();
      Arrange(fixture.Root, scenario.Width, scenario.Height);
      var request = CreateRequest(scenario.Origin, scenario.NativeFallback);
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
      Assert.Equal(
        scenario.NativeFallback ? "fsus-webview:add-to-dictionary" : "fsus-webview:replace:0",
        fixture.Menu.FocusedKey);
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
      Assert.Equal(
        scenario.NativeFallback,
        fixture.Menu.Items.OfType<FsusContextMenuItem>()
          .Any(item => item.Key == "fsus-webview:native-menu"));

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
      var completion = new TaskCompletionSource<FsusWebViewCommandResult>(
        TaskCreationOptions.RunContinuationsAsynchronously);
      fixture.Adapter.ContextCommandCompleted +=
        (_, result) => completion.TrySetResult(result);
      Assert.True(RaiseKeyDown(
        fixture.Menu,
        scenario.NativeFallback ? Key.End : Key.Down));
      Assert.Equal(
        scenario.NativeFallback ? "fsus-webview:native-menu" : "fsus-webview:replace:1",
        fixture.Menu.FocusedKey);
      Assert.True(RaiseKeyDown(fixture.Menu, Key.Enter));
      var commandResult = await completion.Task.WaitAsync(TimeSpan.FromSeconds(2));
      Assert.True(commandResult.Succeeded);
      Assert.False(fixture.Menu.IsOpen);
      Assert.Equal(
        scenario.NativeFallback
          ? FsusWebViewContextCommand.UseNativeMenu
          : FsusWebViewContextCommand.ReplaceWord,
        fixture.Backend.LastCommand?.Command);
      Assert.Equal(scenario.NativeFallback ? null : "tech", fixture.Backend.LastCommand?.Replacement);
      Assert.Same(fixture.Invoker, fixture.Host.LastRestoredFocus);

      fixture.Adapter.OpenContextMenu(
        fixture.Host,
        fixture.Menu,
        request,
        fixture.Invoker);
      Assert.True(RaiseKeyDown(fixture.Menu, Key.Escape));
      Assert.False(fixture.Menu.IsOpen);
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
        keyboard = new
        {
          arrowFocused = scenario.NativeFallback
            ? "fsus-webview:native-menu"
            : "fsus-webview:replace:1",
          enterCommand = fixture.Backend.LastCommand?.Command.ToString(),
          enterReplacement = fixture.Backend.LastCommand?.Replacement,
          escapeClosed = !fixture.Menu.IsOpen,
        },
        focusRestored = ReferenceEquals(fixture.Invoker, fixture.Host.LastRestoredFocus),
      });
      fixture.Adapter.Dispose();
      fixture.Window.Close();
    }

    var pdfCaptures = new List<object>();
    foreach (var theme in new[] { FsusWebViewPrintTheme.Light, FsusWebViewPrintTheme.Dark })
    {
      var backend = new VisualBackend();
      using var adapter = new FsusWebViewAdapter(backend);
      var themeName = theme.ToString().ToLowerInvariant();
      var pdfPath = Path.Combine(outputRoot, $"webview-print-{themeName}.pdf");
      await using (var destination = File.Create(pdfPath))
      {
        var result = await adapter.ExportPdfAsync(
          new FsusWebViewPdfExportOptions
          {
            GenerateTaggedPdf = true,
            GenerateDocumentOutline = true,
            Theme = theme,
            PrintBackgrounds = true,
          },
          destination);
        Assert.Equal(FsusWebViewCommandStatus.Succeeded, result.Status);
        Assert.Equal(4, result.Outline.SelectMany(FlattenOutline).Count());
      }

      var pdfInfo = RunTool("pdfinfo", pdfPath);
      Assert.Matches(@"(?m)^Pages:\s+2\s*$", pdfInfo);
      var pdfInfoPath = Path.Combine(outputRoot, $"webview-print-{themeName}-pdfinfo.txt");
      File.WriteAllText(pdfInfoPath, pdfInfo);
      var textPath = Path.Combine(outputRoot, $"webview-print-{themeName}.txt");
      RunTool("pdftotext", pdfPath, textPath);
      var extractedText = File.ReadAllText(textPath);
      Assert.Contains("Article", extractedText);
      Assert.Contains("Methods", extractedText);
      Assert.Contains("Inputs", extractedText);
      Assert.Contains("Results", extractedText);
      var renderPrefix = Path.Combine(outputRoot, $"webview-print-{themeName}");
      RunTool("pdftoppm", "-png", "-r", "96", pdfPath, renderPrefix);
      var renderedPages = new[] { $"{renderPrefix}-1.png", $"{renderPrefix}-2.png" };
      Assert.All(renderedPages, path => Assert.True(File.Exists(path), path));
      pdfCaptures.Add(new
      {
        theme = themeName,
        pdf = EvidenceFile(repositoryRoot, pdfPath),
        parser = EvidenceFile(repositoryRoot, pdfInfoPath),
        text = EvidenceFile(repositoryRoot, textPath),
        renderedPages = renderedPages.Select(path => EvidenceFile(repositoryRoot, path)).ToArray(),
      });
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
          routedKeyDownPipeline = true,
          nativeFallbackWithUnusableSuggestions = true,
          escapeAndCloseRestoreInvokerFocus = true,
          parsedAndRenderedLightAndDarkPdf = true,
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
          candidateSha = RequireCandidateSha(),
          fixtureClass = "production",
          evidenceClass = "local-headless-skia-and-adapter-simulation",
          simulation =
            "The real FsusContextMenu, theme, overlay, focus and automation paths are rendered. Embedded-browser and PDF engines are deterministic adapters, not external engine execution.",
          captures,
          pdfCaptures,
          automation = new
          {
            path = HeadlessVisualEvidenceOutput.RecordPath(repositoryRoot, automationPath),
            sha256 = Convert.ToHexStringLower(
              SHA256.HashData(File.ReadAllBytes(automationPath))),
          },
        },
        new JsonSerializerOptions { WriteIndented = true }) + "\n");

    Assert.Equal(5, captures.Count);
    Assert.Equal(2, pdfCaptures.Count);
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
      OverlaySize = new Size(280, scenario.NativeFallback ? 440 : 280),
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
    var backend = new VisualBackend();
    return new Fixture(
      window,
      root,
      host,
      menu,
      invoker,
      new FsusWebViewAdapter(backend),
      backend);
  }

  private static FsusWebViewContextMenuRequest CreateRequest(
    FsusWebViewContextMenuOrigin origin,
    bool nativeFallback) => new()
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
      SpellingSuggestions = nativeFallback
        ?
        [
          new FsusWebViewSpellingSuggestion(" ", "blank replacement"),
          new FsusWebViewSpellingSuggestion("", "empty replacement"),
        ]
        :
        [
          new FsusWebViewSpellingSuggestion("the", "the"),
          new FsusWebViewSpellingSuggestion("tech", "tech"),
        ],
      NativeMenuFallbackAvailable = true,
    };

  private static bool RaiseKeyDown(FsusContextMenu menu, Key key)
  {
    var args = new KeyEventArgs
    {
      RoutedEvent = InputElement.KeyDownEvent,
      Source = menu,
      Key = key,
    };
    menu.RaiseEvent(args);
    return args.Handled;
  }

  private static string RequireCandidateSha()
  {
    var candidate = Environment.GetEnvironmentVariable("FSUS_WEBVIEW_CANDIDATE_SHA");
    Assert.Matches("^[a-f0-9]{40}$", candidate ?? string.Empty);
    return candidate!;
  }

  private static IEnumerable<FsusWebViewDocumentOutlineNode> FlattenOutline(
    FsusWebViewDocumentOutlineNode node)
  {
    yield return node;
    foreach (var child in node.Children.SelectMany(FlattenOutline))
    {
      yield return child;
    }
  }

  private static object EvidenceFile(string repositoryRoot, string path) => new
  {
    path = HeadlessVisualEvidenceOutput.RecordPath(repositoryRoot, path),
    sha256 = Convert.ToHexStringLower(SHA256.HashData(File.ReadAllBytes(path))),
  };

  private static string RunTool(string fileName, params string[] arguments)
  {
    var startInfo = new ProcessStartInfo(fileName)
    {
      RedirectStandardOutput = true,
      RedirectStandardError = true,
      UseShellExecute = false,
    };
    foreach (var argument in arguments)
    {
      startInfo.ArgumentList.Add(argument);
    }
    using var process = Process.Start(startInfo)
      ?? throw new InvalidOperationException($"Could not start {fileName}.");
    var stdout = process.StandardOutput.ReadToEnd();
    var stderr = process.StandardError.ReadToEnd();
    process.WaitForExit();
    Assert.True(process.ExitCode == 0, $"{fileName} failed: {stderr}");
    return stdout;
  }

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

    public FsusWebViewContextCommandRequest? LastCommand { get; private set; }

    public event EventHandler<FsusWebViewContextMenuRequestedEventArgs>? ContextMenuRequested
    {
      add { }
      remove { }
    }

    public ValueTask<FsusWebViewCommandResult> ExecuteContextCommandAsync(
      FsusWebViewContextCommandRequest request,
      CancellationToken cancellationToken = default)
    {
      cancellationToken.ThrowIfCancellationRequested();
      LastCommand = request;
      return ValueTask.FromResult(new FsusWebViewCommandResult(
        FsusWebViewCommandStatus.Succeeded));
    }

    public async ValueTask<FsusWebViewPdfExportResult> ExportPdfAsync(
      FsusWebViewPdfExportOptions options,
      Stream destination,
      CancellationToken cancellationToken = default)
    {
      var bytes = TestWebViewPdfDocument.Create(
        options.Theme == FsusWebViewPrintTheme.Dark,
        options.GenerateTaggedPdf,
        options.GenerateDocumentOutline);
      await destination.WriteAsync(bytes, cancellationToken);
      return new FsusWebViewPdfExportResult
      {
        Status = FsusWebViewCommandStatus.Succeeded,
        TaggedPdfApplied = options.GenerateTaggedPdf,
        DocumentOutlineApplied = options.GenerateDocumentOutline,
        DestinationLeftOpen = destination.CanWrite,
        BytesWritten = bytes.Length,
        Outline = options.GenerateDocumentOutline
          ? TestWebViewPdfDocument.CreateOutline()
          : Array.Empty<FsusWebViewDocumentOutlineNode>(),
      };
    }
  }

  private sealed record Scenario(
    string Name,
    FsusThemeVariant Theme,
    int Width,
    int Height,
    int Zoom,
    FsusWebViewContextMenuOrigin Origin,
    bool NativeFallback = false);

  private sealed record Fixture(
    Window Window,
    Grid Root,
    FsusOverlayHost Host,
    FsusContextMenu Menu,
    Button Invoker,
    FsusWebViewAdapter Adapter,
    VisualBackend Backend);
}
