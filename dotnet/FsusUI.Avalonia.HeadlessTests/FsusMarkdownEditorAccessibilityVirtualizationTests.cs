using System.Runtime.CompilerServices;
using System.Security.Cryptography;
using System.Text.Json;
using Avalonia;
using Avalonia.Automation;
using Avalonia.Automation.Peers;
using Avalonia.Automation.Provider;
using Avalonia.Controls;
using Avalonia.Headless.XUnit;
using Avalonia.Markup.Xaml.Styling;
using Avalonia.Media;
using Avalonia.Media.Imaging;
using Avalonia.Styling;
using Avalonia.Threading;
using Avalonia.VisualTree;
using FsusUI.Avalonia.Controls;
using FsusUI.Avalonia.Themes;

namespace FsusUI.Avalonia.HeadlessTests;

public class FsusMarkdownEditorAccessibilityVirtualizationTests
{
  [AvaloniaFact]
  public void AutomationTreeRejectsMetadataOnlyParagraphTabsLiveRegionsAndUnboundedAtoms()
  {
    var source = string.Join(
      "\n",
      Enumerable.Range(0, 120).Select(index => $"![Diagram {index}](diagram-{index}.png)"));
    var identity = new FsusMarkdownDocumentIdentity("automation-tree", 1);
    var spans = new List<FsusMarkdownProjectionSpan>();
    var cursor = 0;
    for (var index = 0; index < 120; index += 1)
    {
      var end = source.IndexOf('\n', cursor);
      if (end < 0)
      {
        end = source.Length;
      }
      spans.Add(new(
        $"atomic-{index}",
        new(cursor, end),
        FsusMarkdownProjectionSpanKind.Atomic,
        $"Diagram {index}",
        "image"));
      cursor = Math.Min(source.Length, end + 1);
    }

    var editor = new FsusMarkdownEditor
    {
      Width = 480,
      Height = 220,
      Document = source,
      DocumentIdentity = identity,
      Mode = FsusMarkdownEditorMode.Live,
    };
    var window = CreateWindow(editor, FsusThemeVariant.Light, false);
    window.Show();
    Dispatcher.UIThread.RunJobs();
    Assert.True(editor.CommitProjection(new(
      identity,
      0,
      source,
      spans)).Accepted);
    Dispatcher.UIThread.RunJobs();
    Arrange(window, editor);

    var peer = ControlAutomationPeer.CreatePeerForElement(editor);
    var snapshot = Capture(peer, editor);
    var atomicNodes = peer.GetChildren()!;
    Assert.InRange(atomicNodes.Count, 1, 63);
    Assert.Equal("Diagram 0", atomicNodes[0].GetProvider<IValueProvider>()?.Value);
    var atomicActions = atomicNodes[0].GetChildren()!;
    Assert.True(IsAccepted(snapshot));
    Assert.Equal(
      ["enter-before", "enter-after", "edit-source", "select-source", "copy", "delete"],
      atomicActions.Select(action => action.GetName()).ToArray());
    Assert.All(atomicActions, action =>
    {
      Assert.False(action.IsKeyboardFocusable());
      Assert.NotNull(action.GetProvider<IInvokeProvider>());
    });
    Assert.False(IsAccepted(snapshot with { HasValueProvider = false }));
    Assert.False(IsAccepted(snapshot with { ParagraphTabStops = 1 }));
    Assert.False(IsAccepted(snapshot with { LiveSetting = AutomationLiveSetting.Polite }));
    Assert.False(IsAccepted(snapshot with { AtomicNodeCount = 65 }));

    var scroll = Assert.Single(
      editor.GetVisualDescendants().OfType<ScrollViewer>(),
      candidate => candidate.Name == "PART_Scroll");
    scroll.Offset = new Vector(0, scroll.Extent.Height);
    Dispatcher.UIThread.RunJobs();
    Arrange(window, editor);
    var laterNodes = peer.GetChildren()!;
    Assert.InRange(laterNodes.Count, 1, 63);
    Assert.DoesNotContain(
      laterNodes,
      node => node.GetProvider<IValueProvider>()?.Value == "Diagram 0");
    Assert.Contains(
      laterNodes,
      node => node.GetProvider<IValueProvider>()?.Value == "Diagram 119");

    window.Close();
  }

  [AvaloniaFact]
  public void LargeWrappedDocumentUsesBoundedViewportAcrossThemeDpiAndLifecycleChanges()
  {
    var source = string.Join(
      "\n",
      Enumerable.Range(0, 10_000).Select(index =>
        index % 10 == 0
          ? $"# Heading {index:D5} {new string('界', 180)}"
          : $"# Heading {index:D5} content"));
    Assert.True(source.Length >= 100_000);
    var editor = new FsusMarkdownEditor
    {
      Width = 460,
      Height = 260,
      Document = source,
      DocumentIdentity = new("large-markdown", 1),
      Mode = FsusMarkdownEditorMode.Source,
      Locale = "zh-CN",
      StatusDensity = FsusMarkdownEditorStatusDensity.Detailed,
    };
    var surface = new Border
    {
      Width = 520,
      Height = 320,
      Padding = new Thickness(30),
      Child = editor,
    };
    var window = CreateWindow(surface, FsusThemeVariant.Light, false);
    window.Show();
    Dispatcher.UIThread.RunJobs();
    Arrange(window, surface);

    var view = Assert.Single(
      editor.GetVisualDescendants().OfType<FsusMarkdownEditorProjectionView>());
    var scroll = Assert.Single(
      editor.GetVisualDescendants().OfType<ScrollViewer>(),
      candidate => candidate.Name == "PART_Scroll");
    var input = Assert.Single(editor.GetVisualDescendants().OfType<TextBox>());
    var initial = view.ViewportDiagnostics;
    Assert.True(initial.IsVirtualized);
    Assert.Equal(10_000, initial.TotalLogicalLines);
    Assert.True(initial.RealizedLogicalLines < 100);
    Assert.True(initial.RealizedVisualLines > initial.RealizedLogicalLines);
    Assert.True(initial.RealizedCharacterCount < source.Length / 4);
    Assert.Equal(1, initial.RetainedLayoutCount);
    Assert.True(initial.EstimatedExtentHeight > initial.TotalLogicalLines * editor.FontSize);
    Assert.InRange(input.Bounds.Height, editor.FontSize, editor.Height);
    Assert.True(editor.GetVisualDescendants().Count() < 64);

    scroll.Offset = new Vector(0, initial.EstimatedExtentHeight * 0.8);
    Dispatcher.UIThread.RunJobs();
    Arrange(window, surface);
    var scrolled = view.ViewportDiagnostics;
    Assert.True(scrolled.RealizedLogicalLines < 100);
    Assert.True(scrolled.RealizedCharacterCount < source.Length / 4);

    var fullBuilds = scrolled.FullIndexBuildCount;
    var incrementalBuilds = scrolled.IncrementalIndexUpdateCount;
    var changed = editor.DispatchTransaction(new(
      [new(source.Length, source.Length, "\nTail edit")],
      Origin: "programmatic",
      Selection: new(source.Length + 10, source.Length + 10),
      DocumentIdentity: editor.DocumentIdentity));
    Assert.True(changed.Accepted);
    Dispatcher.UIThread.RunJobs();
    Arrange(window, surface);
    view.Measure(new Size(460, double.PositiveInfinity));
    var edited = view.ViewportDiagnostics;
    Assert.Equal(fullBuilds, edited.FullIndexBuildCount);
    Assert.True(edited.IncrementalIndexUpdateCount > incrementalBuilds);
    Assert.Equal(1, edited.RetainedLayoutCount);

    var repositoryRoot = FindRepositoryRoot();
    var outputRoot = HeadlessVisualEvidenceOutput.ResolveOutputRoot(
      repositoryRoot,
      "issue-342-markdown-accessibility-virtualization");
    var captures = new List<object>();
    foreach (var cell in new[]
      {
        (Name: "light-100", Variant: FsusThemeVariant.Light, HighContrast: false, Dpi: 96),
        (Name: "dark-150", Variant: FsusThemeVariant.Dark, HighContrast: false, Dpi: 144),
        (Name: "high-contrast-200", Variant: FsusThemeVariant.Light, HighContrast: true, Dpi: 192),
      })
    {
      ApplyTheme(window, cell.Variant, cell.HighContrast);
      editor.Locale = cell.Name == "dark-150" ? "en-US" : "zh-CN";
      editor.StatusDensity = cell.Name == "high-contrast-200"
        ? FsusMarkdownEditorStatusDensity.Minimal
        : FsusMarkdownEditorStatusDensity.Detailed;
      Dispatcher.UIThread.RunJobs();
      Arrange(window, surface);
      var file = Path.Combine(outputRoot, $"{cell.Name}.png");
      using var bitmap = new RenderTargetBitmap(
        new PixelSize(
          (int)Math.Round(surface.Width * cell.Dpi / 96d),
          (int)Math.Round(surface.Height * cell.Dpi / 96d)),
        new Vector(cell.Dpi, cell.Dpi));
      bitmap.Render(surface);
      bitmap.Save(file);
      var bytes = File.ReadAllBytes(file);
      captures.Add(new
      {
        cell.Name,
        cell.Dpi,
        theme = cell.HighContrast ? "high-contrast" : cell.Variant.ToString().ToLowerInvariant(),
        file = HeadlessVisualEvidenceOutput.RecordPath(repositoryRoot, file),
        sha256 = Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant(),
        pixelWidth = bitmap.PixelSize.Width,
        pixelHeight = bitmap.PixelSize.Height,
      });
      Assert.True(bytes.Length > 1_000);
      Assert.True(view.ViewportDiagnostics.RealizedLogicalLines < 100);
    }

    var manifest = Path.Combine(outputRoot, "manifest.json");
    File.WriteAllText(
      manifest,
      JsonSerializer.Serialize(
        new
        {
          schemaVersion = 1,
          issue = 342,
          generatedBy =
            "FsusMarkdownEditorAccessibilityVirtualizationTests.LargeWrappedDocumentUsesBoundedViewportAcrossThemeDpiAndLifecycleChanges",
          renderer = new
          {
            platform = "avalonia",
            runner = "headless-skia",
            productionFixture = true,
            limitation =
              "Local deterministic DPI render simulation; no physical display or operating-system screen reader is claimed.",
          },
          document = new
          {
            characters = source.Length,
            blocks = 10_000,
            headings = 10_000,
          },
          captures,
        },
        new JsonSerializerOptions { WriteIndented = true }) + "\n");

    window.Close();
    Assert.Equal(0, view.ViewportDiagnostics.RetainedLayoutCount);
  }

  private static Window CreateWindow(
    Control content,
    FsusThemeVariant variant,
    bool highContrast)
  {
    var window = new Window
    {
      Width = 520,
      Height = 320,
      ShowInTaskbar = false,
      Content = content,
    };
    window.Styles.Add(
      new StyleInclude(new Uri("avares://FsusUI.Avalonia.HeadlessTests"))
      {
        Source = new Uri("avares://FsusUI.Avalonia.Themes/Themes/FsusTheme.axaml"),
      });
    ApplyTheme(window, variant, highContrast);
    return window;
  }

  private static void ApplyTheme(
    Window window,
    FsusThemeVariant variant,
    bool highContrast)
  {
    var resources = new ResourceDictionary();
    new FsusThemeManager().Apply(resources, new()
    {
      Variant = variant,
      HighContrast = highContrast,
      MotionMode = FsusMotionMode.Reduced,
    });
    window.Resources.MergedDictionaries.Clear();
    window.Resources.MergedDictionaries.Add(resources);
    window.Resources.MergedDictionaries.Add(
      new ResourceInclude(new Uri("avares://FsusUI.Avalonia.Themes"))
      {
        Source = new Uri(
          highContrast
            ? "avares://FsusUI.Avalonia.Themes/Themes/FsusHighContrast.axaml"
            : $"avares://FsusUI.Avalonia.Themes/Themes/Fsus{variant}.axaml"),
      });
    window.RequestedThemeVariant = variant == FsusThemeVariant.Dark
      ? ThemeVariant.Dark
      : ThemeVariant.Light;
  }

  private static void Arrange(Window window, Control surface)
  {
    window.Measure(new Size(520, 320));
    window.Arrange(new Rect(0, 0, 520, 320));
    surface.Arrange(new Rect(0, 0, 520, 320));
  }

  private static AccessibilitySnapshot Capture(
    AutomationPeer peer,
    FsusMarkdownEditor editor)
  {
    var children = peer.GetChildren() ?? [];
    return new(
      peer.GetAutomationControlType(),
      peer.GetProvider<IValueProvider>() is not null,
      AutomationProperties.GetLiveSetting(editor),
      children.Count,
      children.Count(child => child.IsKeyboardFocusable()));
  }

  private static bool IsAccepted(AccessibilitySnapshot snapshot) =>
    snapshot.Role == AutomationControlType.Edit &&
    snapshot.HasValueProvider &&
    snapshot.LiveSetting == AutomationLiveSetting.Off &&
    snapshot.AtomicNodeCount <= 64 &&
    snapshot.ParagraphTabStops == 0;

  private static string FindRepositoryRoot(
    [CallerFilePath] string sourceFile = "")
  {
    foreach (var start in new[]
      {
        Path.GetDirectoryName(sourceFile) ?? string.Empty,
        Environment.CurrentDirectory,
        AppContext.BaseDirectory,
      }.Where(start => !string.IsNullOrWhiteSpace(start))
        .Distinct(StringComparer.Ordinal))
    {
      for (var directory = new DirectoryInfo(start);
        directory is not null;
        directory = directory.Parent)
      {
        if (File.Exists(Path.Combine(directory.FullName, "pnpm-workspace.yaml")))
        {
          return directory.FullName;
        }
      }
    }
    throw new InvalidOperationException("Could not find repository root.");
  }

  private sealed record AccessibilitySnapshot(
    AutomationControlType Role,
    bool HasValueProvider,
    AutomationLiveSetting LiveSetting,
    int AtomicNodeCount,
    int ParagraphTabStops);
}
