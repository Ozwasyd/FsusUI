using System.Text.Json;
using System.Text.Json.Serialization;
using System.Security.Cryptography;
using System.Diagnostics;
using Avalonia;
using Avalonia.Automation;
using Avalonia.Automation.Peers;
using Avalonia.Automation.Provider;
using Avalonia.Controls;
using Avalonia.Controls.ApplicationLifetimes;
using Avalonia.Input;
using Avalonia.Logging;
using Avalonia.Markup.Xaml;
using Avalonia.Media;
using Avalonia.Markup.Xaml.Styling;
using Avalonia.Platform;
using Avalonia.Threading;
using Avalonia.VisualTree;
using FsusUI.Avalonia.Controls;
using FsusUI.Avalonia.Icons;
using FsusUI.Avalonia.Localization;
using FsusUI.Avalonia.Overlay;
using FsusUI.Avalonia.Themes;

internal static class Program
{
  private static SmokeOptions options = new();
  private static SmokeReport report = new();
  private static readonly List<string> nativeLogErrors = [];

  [STAThread]
  public static int Main(string[] args)
  {
    try
    {
      options = SmokeOptions.Parse(args);
      report = new SmokeReport
      {
        SchemaVersion = "fsusui.avalonia-aot-smoke-report.v1",
        SmokeRequested = options.Smoke,
        CommitSha = options.CommitSha,
        PackageVersion = options.PackageVersion,
        CandidateSha256 = options.CandidateSha256,
        Rid = options.Rid,
        OperatingSystem = System.Runtime.InteropServices.RuntimeInformation.OSDescription,
        ProcessArchitecture = System.Runtime.InteropServices.RuntimeInformation.ProcessArchitecture.ToString(),
        DotnetVersion = Environment.Version.ToString(),
        AvaloniaVersion = typeof(Application).Assembly.GetName().Version?.ToString(),
        NativeBinaryName = Path.GetFileName(Environment.ProcessPath),
        NativeBinaryPath = $"publish/{Path.GetFileName(Environment.ProcessPath)}",
        NativeBinaryFormat = "ELF",
        NativeBinaryBytes = Environment.ProcessPath is { } processPath ? new FileInfo(processPath).Length : 0,
        NativeBinarySha256 = Environment.ProcessPath is { } binaryPath
          ? Convert.ToHexString(SHA256.HashData(File.ReadAllBytes(binaryPath))).ToLowerInvariant()
          : "",
        NativeDependencies = options.NativeDependencies,
        PackageDigests = options.PackageDigests,
        PartialCapabilities = ["FsusMarkdownEditor:required-after-issue-343"],
        RuntimeIndependent = true,
        StartedAtUtc = DateTimeOffset.UtcNow,
      };
      if (!options.Smoke || options.ReportPath is null)
      {
        throw new ArgumentException("Usage: --smoke --report <path>");
      }

      BuildAvaloniaApp().StartWithClassicDesktopLifetime(
        args,
        ShutdownMode.OnExplicitShutdown
      );
      return report.ExitCode;
    }
    catch (Exception error)
    {
      if (report.FailureKind is not null)
      {
        return report.ExitCode;
      }
      return Fail("loader", error);
    }
  }

  private static AppBuilder BuildAvaloniaApp() =>
    AppBuilder
      .Configure<SmokeApplication>()
      .UsePlatformDetect()
      .LogToDelegate(
        message =>
        {
          if (SanitizeLogArea(message) is { } area) nativeLogErrors.Add(area);
        },
        LogEventLevel.Warning
      );

  internal static void RunSmoke(IClassicDesktopStyleApplicationLifetime desktop)
  {
    try
    {
      if (options.Failure == "resource")
      {
        using var _ = AssetLoader.Open(
          new Uri("avares://FsusUI.Avalonia.Themes/Themes/Controls/DefinitelyMissing.axaml")
        );
      }
      if (options.Failure == "ignored-log")
      {
        nativeLogErrors.Add("binding");
      }

      var button = new FsusButton { Content = "Native AOT smoke", AccessibleName = "Native AOT smoke" };
      var icon = new FsusIcon
      {
        IconKey = FsusIconKeys.Settings,
        IsDecorative = true,
      };
      var command = new FsusPlatformCommand("workspace.publish", "Publish workspace")
      {
        Description = "Build and publish the active workspace",
        Category = "Workspace",
        Gesture = new FsusShortcutGesture(Key.P, KeyModifiers.Control | KeyModifiers.Shift),
        ExecuteAsyncAction = (_, _) => ValueTask.CompletedTask,
      };
      var commandPalette = new FsusCommandPalette
      {
        CommandTree = [FsusNativeMenuItemModel.Action(command)],
      };
      var codeEditor = new FsusCodeEditor
      {
        AccessibleName = "Native AOT Markdown source",
        WordWrap = true,
        ShowLineNumbers = true,
      };
      codeEditor.LoadDocument(
        new FsusMarkdownDocumentIdentity("native-aot", 1),
        "# AOT\n\n- Native editor");
      _ = codeEditor.FindNext("Native");
      var projectionIdentity = new FsusMarkdownDocumentIdentity(
        "native-aot-projection",
        1);
      var markdownEditor = new FsusMarkdownEditor
      {
        Document = "# AOT\n\n[widget]",
        DocumentIdentity = projectionIdentity,
        Mode = FsusMarkdownEditorMode.Live,
        Height = 140,
      };
      var webViewAdapterReady = ExerciseWebViewAdapter();
      var documents = new FsusDocumentTabs();
      documents.AddDocument(new FsusDocumentTab
      {
        Key = "aot-document",
        Header = "Native AOT document",
        Content = "Native AOT document content",
      });
      var activityShell = new FsusActivityRailShell
      {
        MainContent = documents,
      };
      activityShell.Sections.Add(new FsusActivityRailSection
      {
        Key = "explorer",
        Header = "Explorer",
        Content = "Native AOT contextual pane",
      });
      var titleBar = new FsusNativeTitleBar
      {
        DocumentTitle = "Native AOT shell",
        Status = "Ready",
      };
      var largeMarkdownSource = string.Join(
        "\n",
        Enumerable.Range(0, 10_000).Select(index =>
          index % 10 == 0
            ? $"# Heading {index:D5} {new string('界', 180)}"
            : $"# Heading {index:D5} content"));
      var largeMarkdownEditor = new FsusMarkdownEditor
      {
        Document = largeMarkdownSource,
        DocumentIdentity = new FsusMarkdownDocumentIdentity("native-aot-large", 1),
        Mode = FsusMarkdownEditorMode.Source,
        Height = 180,
      };
      var panel = new StackPanel();
      var scenarios = CreateStableScenarios(
        button,
        icon,
        activityShell,
        documents,
        titleBar);
      foreach (var scenario in scenarios)
      {
        panel.Children.Add(scenario.Control);
      }
      panel.Children.Add(commandPalette);
      panel.Children.Add(titleBar);
      panel.Children.Add(activityShell);
      panel.Children.Add(codeEditor);
      panel.Children.Add(markdownEditor);
      panel.Children.Add(largeMarkdownEditor);

      var window = new Window
      {
        Width = 320,
        Height = 720,
        ShowInTaskbar = false,
        Content = panel,
      };
      desktop.MainWindow = window;
      window.Opened += (_, _) =>
        Dispatcher.UIThread.Post(
          () =>
          {
            try
            {
              var markdownProbeStarted = Stopwatch.GetTimestamp();
              var markdownMemoryBefore = GC.GetTotalMemory(false);
              report.TopLevelCreated = window is TopLevel;
              report.DispatcherReached = Dispatcher.UIThread.CheckAccess();
              report.PlatformHandleCreated = window.TryGetPlatformHandle() is not null;
              report.PackageControlCount = panel.Children.Count;
              foreach (var scenario in scenarios)
              {
                try
                {
                  var passed = scenario.Verify();
                  report.Scenarios.Add(
                    new SmokeScenarioResult(
                      scenario.Id,
                      scenario.Control.GetType().FullName ?? scenario.Control.GetType().Name,
                      "packaged-template",
                      "behavior",
                      passed,
                      passed ? null : "behavior assertion failed",
                      null
                    )
                  );
                }
                catch (Exception error)
                {
                  report.Scenarios.Add(
                    new SmokeScenarioResult(
                      scenario.Id,
                      scenario.Control.GetType().FullName ?? scenario.Control.GetType().Name,
                      "packaged-template",
                      "behavior",
                      false,
                      error.Message,
                      error.GetType().FullName
                    )
                  );
                }
              }
              report.NativeLogErrorCount = nativeLogErrors.Count;
              report.NativeLogAreas = nativeLogErrors.Distinct(StringComparer.Ordinal).Order().ToArray();
              report.StdoutSummary = "native smoke completed";
              report.StderrSummary = nativeLogErrors.Count == 0 ? "no Avalonia warnings or errors" : "Avalonia warning/error captured";
              report.CommandPaletteTreeCount = commandPalette.CommandTree?.Count() ?? 0;
              report.CodeEditorReady =
                codeEditor.Selection == new FsusCodeEditorSelection(9, 15) &&
                codeEditor.HighlightSpans.Count > 0;
              var projectionRequest = new FsusMarkdownProjectionRequestedEventArgs(
                projectionIdentity,
                markdownEditor.TransactionStore.Revision,
                markdownEditor.Document,
                markdownEditor.ProjectionFeatureRevision,
                markdownEditor.SourceCoordinateMap);
              var projectionCommit = FsusMarkdownProjectionProducerContract
                .ProduceAndCommitAsync(
                  markdownEditor,
                  new AotProjectionProducer(projectionIdentity),
                  projectionRequest)
                .AsTask()
                .GetAwaiter()
                .GetResult();
              report.MarkdownProjectionProducerReady =
                projectionCommit.Accepted &&
                markdownEditor.CapabilityState == "aligned";
              var markdownPeer =
                ControlAutomationPeer.CreatePeerForElement(markdownEditor);
              var markdownAtomicNodes = markdownPeer.GetChildren() ?? [];
              var markdownAtomicNode = markdownAtomicNodes.SingleOrDefault();
              var markdownAtomicActions = markdownAtomicNode?.GetChildren() ?? [];
              report.MarkdownAutomationNodeCount = markdownAtomicNodes.Count;
              report.MarkdownAutomationReady =
                markdownPeer.GetAutomationControlType() == AutomationControlType.Edit &&
                markdownPeer.GetProvider<IValueProvider>()?.Value == markdownEditor.Document &&
                (markdownPeer.GetItemStatus() ?? string.Empty)
                  .Contains("multiline=true", StringComparison.Ordinal) &&
                markdownAtomicNode is not null &&
                markdownAtomicNode.GetAutomationControlType() == AutomationControlType.Group &&
                markdownAtomicNode.GetProvider<IValueProvider>()?.Value == "Widget" &&
                markdownAtomicActions.Count == 6 &&
                markdownAtomicActions.Any(action =>
                  action.GetName() == "copy") &&
                markdownAtomicActions.Any(action =>
                  action.GetName() == "delete") &&
                markdownAtomicActions.All(action =>
                  action.GetProvider<IInvokeProvider>() is not null &&
                  !action.IsKeyboardFocusable());
              var largeVisuals = largeMarkdownEditor.GetVisualDescendants().ToArray();
              var largeInput = largeVisuals.OfType<TextBox>().SingleOrDefault();
              var largeScroll = largeVisuals.OfType<ScrollViewer>()
                .SingleOrDefault(candidate => candidate.Name == "PART_Scroll");
              report.MarkdownDocumentCharacters = largeMarkdownSource.Length;
              report.MarkdownBlockCount = 10_000;
              report.MarkdownHeadingCount = 10_000;
              report.MarkdownVisualCount = largeVisuals.Length;
              report.MarkdownVirtualizationReady =
                largeMarkdownSource.Length >= 100_000 &&
                largeVisuals.Length < 64 &&
                largeInput is not null &&
                largeInput.Bounds.Height <= largeMarkdownEditor.Height &&
                largeScroll is not null &&
                largeScroll.Extent.Height > largeMarkdownEditor.Height;
              report.MarkdownLayoutMilliseconds =
                Stopwatch.GetElapsedTime(markdownProbeStarted).TotalMilliseconds;
              report.MarkdownManagedBytesDelta =
                Math.Max(0, GC.GetTotalMemory(false) - markdownMemoryBefore);
              report.RenderScaling = window.RenderScaling;
              report.WebViewAdapterReady = webViewAdapterReady;
              report.ActivitySectionCount = activityShell.Sections.Count;
              report.DocumentCount = documents.Documents.Count;
              report.TitleBarPlatform = titleBar.EffectivePlatform.ToString();
              report.ExitCode =
                report.TopLevelCreated &&
                report.DispatcherReached &&
                report.PlatformHandleCreated &&
                report.Scenarios.Count == options.ExpectedScenarios.Count &&
                report.Scenarios.All(item => item.Passed) &&
                report.NativeLogErrorCount == 0 &&
                report.CommandPaletteTreeCount == 1 &&
                report.ActivitySectionCount == 1 &&
                report.DocumentCount == 1 &&
                report.CodeEditorReady &&
                report.MarkdownProjectionProducerReady &&
                report.MarkdownAutomationReady &&
                report.MarkdownVirtualizationReady &&
                report.WebViewAdapterReady
                  ? 0
                  : 1;
              if (report.ExitCode != 0)
              {
                report.FailureKind = "top-level";
                report.Error = "Avalonia top-level or dispatcher initialization was incomplete.";
              }
              WriteReport();
            }
            catch (Exception error)
            {
              report.ExitCode = 1;
              report.FailureKind = "report";
              report.Error = error.ToString();
              WriteReport();
            }
            finally
            {
              window.Close();
              desktop.Shutdown(report.ExitCode);
            }
          },
          DispatcherPriority.Loaded
        );
      window.Show();
    }
    catch (Exception error)
    {
      Fail("resource", error);
      desktop.Shutdown(report.ExitCode);
    }
  }

  private static IReadOnlyList<SmokeScenario> CreateStableScenarios(
    FsusButton button,
    FsusIcon icon,
    FsusActivityRailShell activityShell,
    FsusDocumentTabs documents,
    FsusNativeTitleBar titleBar)
  {
    AutomationProperties.SetName(button, "Native AOT smoke");
    AutomationProperties.SetName(icon, "Settings icon");
    var input = new FsusInput { AccessibleName = "AOT input", Text = "CJK 漢字 emoji 🚀" };
    var checkbox = new FsusCheckbox { AccessibleName = "AOT selection", IsChecked = true };
    checkbox.ToggleValue();
    checkbox.ToggleValue();
    var form = new FsusForm();
    var generatedInput = new FsusInput { Text = "generated-adapter" };
    var generatedItem = new FsusFormItem { FieldName = "generated", Content = generatedInput };
    var thirdPartyInput = new TextBox { Text = "third-party-adapter" };
    FsusFormFieldAdapter.SetAdapter(thirdPartyInput, new ThirdPartyTextAdapter(thirdPartyInput));
    var thirdPartyItem = new FsusFormItem { FieldName = "third-party", Content = thirdPartyInput };
    form.Children.Add(generatedItem);
    form.Children.Add(thirdPartyItem);
    form.RefreshFormState();
    generatedInput.Text = "changed";
    thirdPartyInput.Text = "changed";
    generatedItem.ResetField();
    thirdPartyItem.ResetField();

    var themeSurface = Named(new Border(), "AOT theme surface");
    var themeMutedText = new FsusText { Text = "AOT muted shell status" };
    titleBar.Status = themeMutedText;
    var themeResources = new ResourceDictionary();
    var themeManager = new FsusThemeManager();
    themeManager.Apply(themeResources, new FsusThemeOptions { Variant = FsusThemeVariant.Light });
    var lightBackground = ((SolidColorBrush)themeResources[FsusThemeResourceKeys.BackgroundBrush]!).Color;
    themeManager.Apply(themeResources, new FsusThemeOptions { Variant = FsusThemeVariant.Dark });
    var darkBackground = ((SolidColorBrush)themeResources[FsusThemeResourceKeys.BackgroundBrush]!).Color;
    var resolvedTheme = themeManager.Apply(
      themeResources,
      new FsusThemeOptions
      {
        Variant = FsusThemeVariant.Dark,
        HighContrast = true,
        Density = FsusDensity.Compact,
        Palette = new FsusThemePaletteOptions
        {
          Background = new SolidColorBrush(Color.Parse("#010203")),
          Surface = new SolidColorBrush(Color.Parse("#102030")),
          SurfaceRaised = new SolidColorBrush(Color.Parse("#203040")),
          Text = new SolidColorBrush(Color.Parse("#F0E0D0")),
          MutedText = new SolidColorBrush(Color.Parse("#C0B0A0")),
          Border = new SolidColorBrush(Color.Parse("#405060")),
          Icon = new SolidColorBrush(Color.Parse("#ABCDEF")),
        },
      }
    );
    var highContrastBackground = ((SolidColorBrush)themeResources[FsusThemeResourceKeys.BackgroundBrush]!).Color;
    if (
      BrushColor(themeResources, FsusThemeResourceKeys.BackgroundBrush) != Color.Parse("#000000") ||
      BrushColor(themeResources, FsusThemeResourceKeys.SurfaceBrush) != Color.Parse("#000000") ||
      BrushColor(themeResources, FsusThemeResourceKeys.SurfaceRaisedBrush) != Color.Parse("#111827") ||
      BrushColor(themeResources, FsusThemeResourceKeys.TextBrush) != Color.Parse("#FFFFFF") ||
      BrushColor(themeResources, FsusThemeResourceKeys.MutedTextBrush) != Color.Parse("#FDE68A") ||
      BrushColor(themeResources, FsusThemeResourceKeys.BorderBrush) != Color.Parse("#FFFFFF") ||
      BrushColor(themeResources, FsusThemeResourceKeys.IconBrush) != Color.Parse("#FFFFFF") ||
      BrushColor(themeResources, "FsusThemeTreeSurfaceBrush") != Color.Parse("#000000") ||
      BrushColor(themeResources, "FsusThemePickerSurfaceBrush") != Color.Parse("#000000") ||
      BrushColor(themeResources, "FsusThemePublicShellSurfaceBrush") != Color.Parse("#000000") ||
      BrushColor(themeResources, FsusThemeResourceKeys.TextEditorSurfaceBrush) != Color.Parse("#000000") ||
      BrushColor(themeResources, FsusThemeResourceKeys.ValuePickerTrackBrush) != Color.Parse("#1F2937"))
    {
      throw new InvalidOperationException("AOT high-contrast theme precedence did not apply.");
    }

    themeManager.Apply(
      themeResources,
      new FsusThemeOptions
      {
        Variant = FsusThemeVariant.Dark,
        Palette = new FsusThemePaletteOptions
        {
          Background = new SolidColorBrush(Color.Parse("#010203")),
          Surface = new SolidColorBrush(Color.Parse("#102030")),
          SurfaceRaised = new SolidColorBrush(Color.Parse("#203040")),
          Text = new SolidColorBrush(Color.Parse("#F0E0D0")),
          MutedText = new SolidColorBrush(Color.Parse("#C0B0A0")),
          Border = new SolidColorBrush(Color.Parse("#405060")),
          Icon = new SolidColorBrush(Color.Parse("#ABCDEF")),
        },
      });
    if (
      BrushColor(themeResources, FsusThemeResourceKeys.BackgroundBrush) != Color.Parse("#010203") ||
      BrushColor(themeResources, FsusThemeResourceKeys.SurfaceBrush) != Color.Parse("#102030") ||
      BrushColor(themeResources, FsusThemeResourceKeys.SurfaceRaisedBrush) != Color.Parse("#203040") ||
      BrushColor(themeResources, FsusThemeResourceKeys.TextBrush) != Color.Parse("#F0E0D0") ||
      BrushColor(themeResources, FsusThemeResourceKeys.MutedTextBrush) != Color.Parse("#C0B0A0") ||
      BrushColor(themeResources, FsusThemeResourceKeys.BorderBrush) != Color.Parse("#405060") ||
      BrushColor(themeResources, FsusThemeResourceKeys.IconBrush) != Color.Parse("#ABCDEF") ||
      BrushColor(themeResources, "FsusThemeTreeSurfaceBrush") != Color.Parse("#102030") ||
      BrushColor(themeResources, "FsusThemePickerSurfaceBrush") != Color.Parse("#102030") ||
      BrushColor(themeResources, "FsusThemePublicShellSurfaceBrush") != Color.Parse("#102030") ||
      BrushColor(themeResources, FsusThemeResourceKeys.TextEditorSurfaceBrush) != Color.Parse("#102030") ||
      BrushColor(themeResources, FsusThemeResourceKeys.ValuePickerTrackBrush) != Color.Parse("#203040"))
    {
      throw new InvalidOperationException("AOT theme palette overrides did not reach shell aliases.");
    }
    themeSurface.Background = ThemeBrush(themeResources, FsusThemeResourceKeys.SurfaceBrush);
    activityShell.Background = ThemeBrush(themeResources, FsusThemeResourceKeys.BackgroundBrush);
    activityShell.Foreground = ThemeBrush(themeResources, FsusThemeResourceKeys.TextBrush);
    documents.Background = ThemeBrush(themeResources, FsusThemeResourceKeys.BackgroundBrush);
    titleBar.Background = ThemeBrush(themeResources, FsusThemeResourceKeys.SurfaceRaisedBrush);
    titleBar.Foreground = ThemeBrush(themeResources, FsusThemeResourceKeys.TextBrush);
    titleBar.BorderBrush = ThemeBrush(themeResources, FsusThemeResourceKeys.BorderBrush);
    themeMutedText.Foreground = ThemeBrush(themeResources, FsusThemeResourceKeys.MutedTextBrush);
    icon.Fill = ThemeBrush(themeResources, FsusThemeResourceKeys.IconBrush);
    report.ThemeVariant = resolvedTheme.Variant.ToString();
    report.ThemeDensity = resolvedTheme.Density.ToString();
    report.ThemeHighContrast = resolvedTheme.HighContrast;

    var modalHost = new FsusOverlayHost();
    var modalFocus = Named(new FsusButton { Content = "Confirm" }, "Confirm dialog");
    var restoreFocus = Named(new FsusButton { Content = "Open dialog" }, "Open dialog");
    var dialog = new FsusDialog { Content = modalFocus };
    var modalEntry = modalHost.OpenDialog(
      dialog,
      new FsusOverlayOptions
      {
        RestoreFocusTo = restoreFocus,
        FocusScope = [modalFocus],
      }
    );

    var anchoredHost = new FsusOverlayHost();
    var popover = new FsusPopover
    {
      Content = "Anchored content",
      AnchorBounds = new Rect(20, 20, 40, 20),
      OverlaySize = new Size(120, 80),
      ViewportBounds = new Rect(0, 0, 320, 240),
    };
    var anchoredEntry = popover.Open(anchoredHost);

    var textViewer = new FsusTextViewer { AccessibleName = "AOT viewer" };
    textViewer.Blocks.Add(new FsusTextContentBlock(FsusTextBlockKind.Paragraph, "Hello 漢字 🚀"));
    _ = textViewer.RenderAsync().GetAwaiter().GetResult();
    var textEditor = new FsusTextEditor { AccessibleName = "AOT editor" };
    textEditor.SetText("hello");
    textEditor.Select(5, 0);
    textEditor.TypeText(" world");
    var virtualList = new FsusVirtualList { AccessibleName = "AOT virtual list", ItemCount = 100, ItemProvider = index => $"Row {index}" };
    virtualList.ScrollToIndex(50);
    var tree = new FsusTree { AccessibleName = "AOT tree" };
    var treeRoot = new FsusTreeNode("root", "Root");
    treeRoot.Children.Add(new FsusTreeNode("child", "Child"));
    tree.Nodes.Add(treeRoot);
    tree.RefreshView();
    tree.Expand("root");
    tree.ToggleSelection("child");

    var calendar = new FsusCalendar { AccessibleName = "AOT calendar", Locale = "zh-CN" };
    calendar.SelectDate(new DateOnly(2026, 8, 29));
    var upload = new FsusUpload { AccessibleName = "AOT upload" };
    var uploadItem = upload.AddItem("proof.txt", 5, "text/plain");
    if (uploadItem is not null) upload.SetProgress(uploadItem.Id, 1);
    var locale = FsusAvaloniaLocaleProvider.CreateDefault();
    locale.SetCulture("zh-cn");

    var progress = new FsusProgress { Value = 50 };
    var space = new FsusSpace { Spacing = 8 };
    var tabs = Named(new FsusTabs(), "AOT tabs");
    var loading = new FsusLoadingIndicator { AccessibleName = "AOT loading", IsActive = true };
    var select = new FsusSelect { AccessibleName = "AOT picker" };
    select.ItemsSource = new[] { new FsusOption { Label = "One", Value = "one" } };
    var slider = new FsusSlider { Value = 25 };
    var pagination = new FsusPagination { Total = 20, PageSize = 10 };
    var image = Named(new FsusImage(), "AOT image");
    var table = Named(new FsusDataTable(), "AOT table");
    var shell = Named(new FsusPublicShell(), "AOT public shell");
    var settingsHeader = Named(new FsusSettingsSectionHeader { Content = "Settings" }, "AOT settings");
    var challenge = Named(new FsusTextTaskChallenge(), "AOT challenge");
    var localeText = new FsusText { Text = $"{locale.T("el.messagebox.confirm")} {locale.FormatNumber(1234.5m, "N1")}" };
    var stable = new Dictionary<string, SmokeScenario>(StringComparer.Ordinal)
    {
      ["button"] = new("button", button, () => button.IsEnabled && AutomationProperties.GetName(button) == "Native AOT smoke"),
      ["icon-text"] = new("icon-text", themeSurface, () => icon.IconKey == FsusIconKeys.Settings && icon.IsDecorative && AutomationProperties.GetName(icon) == "Settings icon" && lightBackground != darkBackground && highContrastBackground != darkBackground && resolvedTheme.HighContrast && resolvedTheme.Density == FsusDensity.Compact && BrushColor(activityShell.Background, "activity shell background") == Color.Parse("#010203") && BrushColor(themeSurface.Background, "theme surface") == Color.Parse("#102030") && BrushColor(titleBar.Background, "title bar background") == Color.Parse("#203040") && BrushColor(activityShell.Foreground, "activity shell foreground") == Color.Parse("#F0E0D0") && BrushColor(themeMutedText.Foreground, "muted shell status") == Color.Parse("#C0B0A0") && BrushColor(titleBar.BorderBrush, "title bar border") == Color.Parse("#405060") && BrushColor(icon.Fill, "icon fill") == Color.Parse("#ABCDEF")),
      ["input"] = new("input", input, () => input.Text?.Contains("CJK 漢字 emoji 🚀", StringComparison.Ordinal) is true && AutomationProperties.GetName(input) == "AOT input"),
      ["selection"] = new("selection", checkbox, () => checkbox.IsChecked == true),
      ["form"] = new("form", form, () => form.Children.Count == 2 && generatedItem.FieldAdapterError is null && thirdPartyItem.FieldAdapterError is null && generatedInput.Text == "generated-adapter" && thirdPartyInput.Text == "third-party-adapter"),
      ["display"] = new("display", progress, () => progress.Value == 50 && progress.ProgressText == "50%"),
      ["layout"] = new("layout", space, () => space.Spacing == 8),
      ["navigation"] = new("navigation", tabs, () => AutomationProperties.GetName(tabs) == "AOT tabs"),
      ["modal-panel"] = new("modal-panel", modalHost, () => modalHost.MoveFocus(FsusFocusNavigationDirection.Next) && modalHost.DismissKeyboardAsync().AsTask().GetAwaiter().GetResult() && modalEntry.IsClosed && ReferenceEquals(modalHost.LastRestoredFocus, restoreFocus) && modalHost.Children.Count == 0),
      ["anchored-overlay"] = new("anchored-overlay", anchoredHost, () => anchoredHost.DismissPointerOutsideAsync(new Point(319, 239)).AsTask().GetAwaiter().GetResult() && anchoredEntry.IsClosed && !popover.IsOpen && anchoredHost.Children.Count == 0),
      ["service-helper"] = new("service-helper", loading, () => loading.IsActive && loading.AccessibleName == "AOT loading"),
      ["picker"] = new("picker", select, () => select.SelectValue("one") && Equals(select.SelectedValue, "one")),
      ["date-time"] = new("date-time", calendar, () => calendar.SelectedDate == new DateOnly(2026, 8, 29) && calendar.DisplayText == "2026-08-29"),
      ["value-picker"] = new("value-picker", slider, () => slider.Value == 25),
      ["upload-transfer"] = new("upload-transfer", upload, () => upload.Items.Count == 1 && upload.Items[0].Status == FsusUploadItemStatus.Success),
      ["data-display"] = new("data-display", pagination, () => pagination.Total == 20 && pagination.PageCount == 2),
      ["media-decorative"] = new("media-decorative", image, () => AutomationProperties.GetName(image) == "AOT image"),
      ["data-table"] = new("data-table", table, () => AutomationProperties.GetName(table) == "AOT table"),
      ["virtualization"] = new("virtualization", virtualList, () => virtualList.ItemCount == 100 && virtualList.FocusedIndex == 50 && virtualList.RealizedContainerCount < virtualList.ItemCount),
      ["tree"] = new("tree", tree, () => tree.ExpandedKeys.Contains("root") && tree.SelectedKeys.Contains("child")),
      ["text-viewer"] = new("text-viewer", textViewer, () => textViewer.RenderedBlocks.Count == 1 && textViewer.HasMixedLanguage),
      ["text-editor"] = new("text-editor", textEditor, () => textEditor.Text == "hello world" && textEditor.UndoDepth == 1 && textEditor.Undo() && textEditor.Text == "hello" && textEditor.RedoDepth == 1),
      ["public-shell"] = new("public-shell", shell, () => AutomationProperties.GetName(shell) == "AOT public shell"),
      ["product-primitives"] = new("product-primitives", settingsHeader, () => AutomationProperties.GetName(settingsHeader) == "AOT settings"),
      ["perception-challenge"] = new("perception-challenge", challenge, () => AutomationProperties.GetName(challenge) == "AOT challenge"),
      ["locale-formatting"] = new("locale-formatting", localeText, () => locale.CurrentLocale.Name == "zh-cn" && localeText.Text?.Contains("确定", StringComparison.Ordinal) == true),
    };
    var missing = options.ExpectedScenarios.Where(id => !stable.ContainsKey(id)).ToArray();
    if (missing.Length > 0)
    {
      throw new InvalidOperationException($"Stable AOT scenario binding missing: {string.Join(", ", missing)}");
    }
    return options.ExpectedScenarios.Select(id => stable[id]).ToArray();
  }

  private static T Named<T>(T control, string name) where T : Control
  {
    AutomationProperties.SetName(control, name);
    return control;
  }

  private static bool ExerciseWebViewAdapter()
  {
    var backend = new AotWebViewBackend();
    using var adapter = new FsusWebViewAdapter(backend);
    var host = new FsusOverlayHost();
    var menu = new FsusContextMenu
    {
      OverlaySize = new Size(240, 280),
      ViewportBounds = new Rect(0, 0, 320, 480),
    };
    var invoker = new Button { Content = "Native AOT WebView" };
    FsusWebViewContextMenuRequest? observed = null;
    adapter.ContextMenuRequested += (_, args) => observed = args.Request;
    var contextRequest = new FsusWebViewContextMenuRequest
    {
      Origin = FsusWebViewContextMenuOrigin.Keyboard,
      ViewportPoint = new FsusWebViewViewportPoint(24, 48),
      IsEditable = true,
      HasSelection = true,
      EditCapabilities = FsusWebViewEditCapabilities.Copy |
        FsusWebViewEditCapabilities.RichCopy,
      MisspelledWord = "teh",
      SpellingSuggestions =
      [
        new FsusWebViewSpellingSuggestion("the", "Replace with the"),
      ],
      NativeMenuFallbackAvailable = true,
    };
    backend.RaiseContextMenu(contextRequest);
    adapter.OpenContextMenu(host, menu, contextRequest, invoker);
    var spellingComposed = menu.Items.OfType<FsusContextMenuItem>()
      .Any(item => item.Key == "fsus-webview:replace:0" && Equals(item.Header, "Replace with the"));
    var spellingChosen = menu.ChooseAsync("fsus-webview:replace:0")
      .AsTask()
      .GetAwaiter()
      .GetResult();
    var fallbackRequest = contextRequest with
    {
      SpellingSuggestions =
      [
        new FsusWebViewSpellingSuggestion(" ", "blank"),
        new FsusWebViewSpellingSuggestion("", "empty"),
      ],
    };
    adapter.OpenContextMenu(host, menu, fallbackRequest, invoker);
    var fallbackComposed = menu.Items.OfType<FsusContextMenuItem>()
      .Any(item => item.Key == "fsus-webview:native-menu") &&
      !menu.Items.OfType<FsusContextMenuItem>()
        .Any(item => item.Key.StartsWith("fsus-webview:replace:", StringComparison.Ordinal));
    var fallbackChosen = menu.ChooseAsync("fsus-webview:native-menu")
      .AsTask()
      .GetAwaiter()
      .GetResult();
    var developerTools = adapter.OpenDeveloperToolsAsync()
      .AsTask()
      .GetAwaiter()
      .GetResult();
    using var destination = new MemoryStream();
    var pdf = adapter.ExportPdfAsync(
        new FsusWebViewPdfExportOptions
        {
          GenerateTaggedPdf = true,
          GenerateDocumentOutline = true,
          Theme = FsusWebViewPrintTheme.Dark,
        },
        destination)
      .AsTask()
      .GetAwaiter()
      .GetResult();
    return ReferenceEquals(observed, contextRequest) &&
      spellingComposed &&
      spellingChosen &&
      fallbackComposed &&
      fallbackChosen &&
      developerTools.Status == FsusWebViewCommandStatus.Unsupported &&
      backend.DeveloperToolsCalls == 0 &&
      backend.ContextCommands is
      [
        { Command: FsusWebViewContextCommand.ReplaceWord, Replacement: "the" },
        { Command: FsusWebViewContextCommand.UseNativeMenu },
      ] &&
      pdf.Status == FsusWebViewCommandStatus.Succeeded &&
      pdf.TaggedPdfApplied &&
      pdf.DocumentOutlineApplied &&
      pdf.DestinationLeftOpen &&
      destination.CanWrite &&
      destination.Length == pdf.BytesWritten &&
      pdf.Outline is [{ HeadingLevel: 1, Destination: "heading-aot" }];
  }
  private static Color BrushColor(IResourceDictionary resources, string key) =>
    BrushColor((IBrush?)resources[key]);

  private static IBrush ThemeBrush(IResourceDictionary resources, string key) =>
    (IBrush?)resources[key]
      ?? throw new InvalidOperationException($"Expected theme brush resource {key}.");

  private static Color BrushColor(IBrush? brush) =>
    brush is SolidColorBrush solid
      ? solid.Color
      : throw new InvalidOperationException("Expected a solid theme brush.");

  private static Color BrushColor(IBrush? brush, string role) =>
    brush is SolidColorBrush solid
      ? solid.Color
      : throw new InvalidOperationException($"Expected a solid theme brush for {role}.");

  private static int Fail(string kind, Exception error)
  {
    report.ExitCode = 1;
    report.FailureKind = kind;
    report.Error = error.ToString();
    Console.Error.WriteLine($"FsusUI Native AOT smoke {kind} failure: {error}");
    WriteReport();
    return report.ExitCode;
  }

  private static string? SanitizeLogArea(string message)
  {
    var normalized = message.ToLowerInvariant();
    if (normalized.Contains("session_manager environment variable not defined", StringComparison.Ordinal)) return null;
    if (normalized.Contains("binding", StringComparison.Ordinal)) return "binding";
    if (normalized.Contains("resource", StringComparison.Ordinal)) return "resource";
    if (normalized.Contains("automation", StringComparison.Ordinal)) return "automation";
    if (normalized.Contains("loader", StringComparison.Ordinal)) return "loader";
    if (normalized.Contains("template", StringComparison.Ordinal)) return "template";
    if (normalized.Contains("error", StringComparison.Ordinal) || normalized.Contains("exception", StringComparison.Ordinal)) return "avalonia";
    return null;
  }

  private static void WriteReport()
  {
    if (options.ReportPath is null)
    {
      return;
    }
    var parent = Path.GetDirectoryName(Path.GetFullPath(options.ReportPath));
    if (parent is not null)
    {
      Directory.CreateDirectory(parent);
    }
    report.EndedAtUtc = DateTimeOffset.UtcNow;
    File.WriteAllText(
      options.ReportPath,
      JsonSerializer.Serialize(report, SmokeJsonContext.Default.SmokeReport)
    );
  }
}

internal sealed partial class SmokeApplication : Application
{
  public override void Initialize()
  {
    AvaloniaXamlLoader.Load(this);
    new FsusThemeManager().Apply(Resources, new()
    {
      Variant = FsusThemeVariant.Light,
      MotionMode = FsusMotionMode.Reduced,
    });
  }

  public override void OnFrameworkInitializationCompleted()
  {
    if (ApplicationLifetime is IClassicDesktopStyleApplicationLifetime desktop)
    {
      Program.RunSmoke(desktop);
    }
    base.OnFrameworkInitializationCompleted();
  }
}

internal sealed record SmokeOptions
{
  public bool Smoke { get; init; }
  public string? ReportPath { get; init; }
  public string? Failure { get; init; }
  public string CommitSha { get; init; } = "";
  public string PackageVersion { get; init; } = "";
  public string CandidateSha256 { get; init; } = "";
  public string Rid { get; init; } = "";
  public IReadOnlyList<string> ExpectedScenarios { get; init; } = [];
  public IReadOnlyList<string> NativeDependencies { get; init; } = [];
  public IReadOnlyList<string> PackageDigests { get; init; } = [];

  public static SmokeOptions Parse(string[] arguments)
  {
    string? ValueAfter(string name)
    {
      var index = Array.IndexOf(arguments, name);
      return index >= 0 && index + 1 < arguments.Length
        ? arguments[index + 1]
        : null;
    }

    return new SmokeOptions
    {
      Smoke = arguments.Contains("--smoke", StringComparer.Ordinal),
      ReportPath = ValueAfter("--report"),
      Failure = ValueAfter("--fail"),
      CommitSha = ValueAfter("--commit-sha") ?? "",
      PackageVersion = ValueAfter("--package-version") ?? "",
      CandidateSha256 = ValueAfter("--candidate-digest") ?? "",
      Rid = ValueAfter("--rid") ?? "",
      ExpectedScenarios = (ValueAfter("--scenarios") ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries),
      NativeDependencies = (ValueAfter("--native-dependencies") ?? "").Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries),
      PackageDigests = (ValueAfter("--package-digests") ?? "").Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries),
    };
  }
}

internal sealed record SmokeScenario(string Id, Control Control, Func<bool> Verify);
internal sealed record SmokeScenarioResult(
  string Id,
  string Component,
  string Resource,
  string Stage,
  bool Passed,
  string? Error,
  string? Exception
);

internal sealed class AotProjectionProducer(
  FsusMarkdownDocumentIdentity identity) : IFsusMarkdownProjectionProducer
{
  public ValueTask<FsusMarkdownProjectionProduction> ProduceAsync(
    FsusMarkdownProjectionRequestedEventArgs request,
    CancellationToken cancellationToken = default)
  {
    cancellationToken.ThrowIfCancellationRequested();
    return ValueTask.FromResult(new FsusMarkdownProjectionProduction(
      new(
        FsusMarkdownProjectionProducerContract.Version,
        FsusMarkdownProjectionProducerKind.InterimHostBridge,
        "native-aot-canonical-runtime-bridge",
        "1.0.0",
        FsusMarkdownProjectionProducerContract.CanonicalRuntimeIdentity,
        "native-aot-runtime"),
      new(
        identity,
        request.Revision,
        request.Source,
        [
          new(
            "heading",
            new(0, 2),
            FsusMarkdownProjectionSpanKind.HiddenMarker,
            ""),
          new(
            "heading",
            new(2, 5),
            FsusMarkdownProjectionSpanKind.Text,
            "AOT",
            "heading"),
          new(
            "widget",
            new(7, 15),
            FsusMarkdownProjectionSpanKind.Atomic,
            "Widget",
            "embedded-widget"),
        ],
        request.FeatureRevision),
      []));
  }
}

internal sealed class AotWebViewBackend : IFsusWebViewBackendAdapter
{
  public FsusWebViewCapabilities Capabilities { get; } = new()
  {
    Platform = FsusWebViewPlatform.Linux,
    SpellingSuggestions = true,
    ReplaceWord = true,
    AddToDictionary = true,
    NativeContextMenu = true,
    DeveloperTools = false,
    TaggedPdf = true,
    DocumentOutline = true,
  };

  public event EventHandler<FsusWebViewContextMenuRequestedEventArgs>? ContextMenuRequested;
  public FsusWebViewContextCommandRequest? LastCommand { get; private set; }
  public List<FsusWebViewContextCommandRequest> ContextCommands { get; } = [];
  public int DeveloperToolsCalls { get; private set; }

  public void RaiseContextMenu(FsusWebViewContextMenuRequest request) =>
    ContextMenuRequested?.Invoke(
      this,
      new FsusWebViewContextMenuRequestedEventArgs(request));

  public ValueTask<FsusWebViewCommandResult> ExecuteContextCommandAsync(
    FsusWebViewContextCommandRequest request,
    CancellationToken cancellationToken = default)
  {
    cancellationToken.ThrowIfCancellationRequested();
    LastCommand = request;
    ContextCommands.Add(request);
    return ValueTask.FromResult(new FsusWebViewCommandResult(
      FsusWebViewCommandStatus.Succeeded));
  }

  public ValueTask<FsusWebViewCommandResult> OpenDeveloperToolsAsync(
    CancellationToken cancellationToken = default)
  {
    cancellationToken.ThrowIfCancellationRequested();
    DeveloperToolsCalls++;
    return ValueTask.FromResult(new FsusWebViewCommandResult(
      FsusWebViewCommandStatus.Succeeded));
  }

  public async ValueTask<FsusWebViewPdfExportResult> ExportPdfAsync(
    FsusWebViewPdfExportOptions options,
    Stream destination,
    CancellationToken cancellationToken = default)
  {
    cancellationToken.ThrowIfCancellationRequested();
    var bytes = AotWebViewPdfDocument.Create();
    await destination.WriteAsync(bytes, cancellationToken);
    return new FsusWebViewPdfExportResult
    {
      Status = FsusWebViewCommandStatus.Succeeded,
      TaggedPdfApplied = options.GenerateTaggedPdf,
      DocumentOutlineApplied = options.GenerateDocumentOutline,
      DestinationLeftOpen = destination.CanWrite,
      BytesWritten = bytes.Length,
      Outline =
      [
        new FsusWebViewDocumentOutlineNode
        {
          Title = "AOT",
          HeadingLevel = 1,
          Destination = "heading-aot",
        },
      ],
    };
  }
}

internal sealed class ThirdPartyTextAdapter(TextBox control) : IFsusFormFieldAdapter
{
  public FsusFormFieldAdapterCapabilities Capabilities =>
    FsusFormFieldAdapterCapabilities.ReadValue |
    FsusFormFieldAdapterCapabilities.WriteValue |
    FsusFormFieldAdapterCapabilities.ResetValue;

  public FsusFormFieldReadResult ReadValue() => FsusFormFieldReadResult.Success(control.Text);

  public FsusFormFieldAdapterResult TryWriteValue(object? value) => TryResetValue(value);

  public FsusFormFieldAdapterResult TryResetValue(object? initialValue)
  {
    if (initialValue is not null && initialValue is not string)
    {
      return FsusFormFieldAdapterResult.Failure(
        new FsusFormFieldAdapterError(
          FsusFormFieldAdapterErrorKind.TypeMismatch,
          "Expected string value.",
          typeof(TextBox),
          nameof(TextBox.Text)
        )
      );
    }
    control.Text = (string?)initialValue;
    return FsusFormFieldAdapterResult.Success;
  }

  public FsusFormFieldAdapterResult TryApplySize(FsusComponentSize size) =>
    FsusFormFieldAdapterResult.Success;

  public FsusFormFieldAdapterResult TryApplyInvalidState(bool isInvalid) =>
    FsusFormFieldAdapterResult.Success;
}

internal sealed record SmokeReport
{
  public string SchemaVersion { get; init; } = "";
  public bool SmokeRequested { get; init; }
  public string CommitSha { get; init; } = "";
  public string PackageVersion { get; init; } = "";
  public string CandidateSha256 { get; init; } = "";
  public string Rid { get; init; } = "";
  public string? OperatingSystem { get; init; }
  public string? DotnetVersion { get; init; }
  public string? AvaloniaVersion { get; init; }
  public string? NativeBinaryName { get; init; }
  public string? NativeBinaryPath { get; init; }
  public string? NativeBinaryFormat { get; init; }
  public long NativeBinaryBytes { get; init; }
  public string NativeBinarySha256 { get; init; } = "";
  public IReadOnlyList<string> NativeDependencies { get; init; } = [];
  public IReadOnlyList<string> PackageDigests { get; init; } = [];
  public IReadOnlyList<string> PartialCapabilities { get; init; } = [];
  public bool RuntimeIndependent { get; init; }
  public DateTimeOffset StartedAtUtc { get; init; }
  public DateTimeOffset EndedAtUtc { get; set; }
  public List<SmokeScenarioResult> Scenarios { get; init; } = [];
  public int ScenarioCount => Scenarios.Count;
  public int ScenarioPassed => Scenarios.Count(item => item.Passed);
  public int ScenarioFailed => Scenarios.Count(item => !item.Passed);
  public int ScenarioSkipped => 0;
  public int NativeLogErrorCount { get; set; }
  public IReadOnlyList<string> NativeLogAreas { get; set; } = [];
  public string StdoutSummary { get; set; } = "not-started";
  public string StderrSummary { get; set; } = "not-started";
  public bool TopLevelCreated { get; set; }
  public bool DispatcherReached { get; set; }
  public bool PlatformHandleCreated { get; set; }
  public int PackageControlCount { get; set; }
  public int CommandPaletteTreeCount { get; set; }
  public bool CodeEditorReady { get; set; }
  public bool MarkdownProjectionProducerReady { get; set; }
  public bool MarkdownAutomationReady { get; set; }
  public bool MarkdownVirtualizationReady { get; set; }
  public int MarkdownDocumentCharacters { get; set; }
  public int MarkdownBlockCount { get; set; }
  public int MarkdownHeadingCount { get; set; }
  public int MarkdownAutomationNodeCount { get; set; }
  public int MarkdownVisualCount { get; set; }
  public double MarkdownLayoutMilliseconds { get; set; }
  public long MarkdownManagedBytesDelta { get; set; }
  public double RenderScaling { get; set; }
  public bool WebViewAdapterReady { get; set; }
  public int ActivitySectionCount { get; set; }
  public int DocumentCount { get; set; }
  public string? TitleBarPlatform { get; set; }
  public string? ThemeDensity { get; set; }
  public string? ThemeVariant { get; set; }
  public bool ThemeHighContrast { get; set; }
  public string? ProcessArchitecture { get; init; }
  public int ExitCode { get; set; } = 1;
  public string? FailureKind { get; set; }
  public string? Error { get; set; }
}

[JsonSerializable(typeof(SmokeReport))]
internal sealed partial class SmokeJsonContext : JsonSerializerContext;
