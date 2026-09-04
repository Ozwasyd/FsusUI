using System.Runtime.CompilerServices;
using System.Security.Cryptography;
using System.Text.Json;
using Avalonia;
using Avalonia.Automation;
using Avalonia.Automation.Peers;
using Avalonia.Automation.Provider;
using Avalonia.Controls;
using Avalonia.Headless.XUnit;
using Avalonia.Input.Platform;
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
  public async Task AutomationTreeExposesDynamicStateAndInvokableAtomicActions()
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
    var initialSelection = editor.TransactionStore.Selection;
    Assert.InRange(atomicNodes.Count, 1, 63);
    Assert.Equal("Markdown editor", snapshot.Name);
    Assert.Equal(source, snapshot.Value);
    Assert.Contains(
      $"selection={initialSelection.Start}:{initialSelection.End}",
      snapshot.ItemStatus);
    Assert.Contains($"caret={initialSelection.End}", snapshot.ItemStatus);
    Assert.Contains("readonly=false", snapshot.ItemStatus);
    Assert.Contains("disabled=false", snapshot.ItemStatus);
    Assert.Contains("invalid=false", snapshot.ItemStatus);
    Assert.Contains("mode=live", snapshot.ItemStatus);
    Assert.Contains("capability=aligned", snapshot.ItemStatus);
    Assert.Equal("Diagram 0", atomicNodes[0].GetProvider<IValueProvider>()?.Value);
    Assert.Equal("image", atomicNodes[0].GetName());
    Assert.Contains(
      $"source=0:{spans[0].SourceRange.End}",
      atomicNodes[0].GetItemStatus());
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

    Invoke(atomicActions, "enter-after");
    Assert.Equal(
      new FsusMarkdownEditorSelection(
        spans[0].SourceRange.End,
        spans[0].SourceRange.End),
      editor.TransactionStore.Selection);
    Assert.Contains(
      $"selection={spans[0].SourceRange.End}:{spans[0].SourceRange.End}",
      peer.GetItemStatus());
    Assert.Contains($"caret={spans[0].SourceRange.End}", peer.GetItemStatus());
    Invoke(atomicActions, "enter-before");
    Assert.Equal(new FsusMarkdownEditorSelection(0, 0), editor.TransactionStore.Selection);
    Invoke(atomicActions, "edit-source");
    Assert.Equal(FsusMarkdownEditorMode.Source, editor.Mode);
    Assert.Contains("mode=source", peer.GetItemStatus());

    editor.Mode = FsusMarkdownEditorMode.Live;
    Invoke(atomicActions, "select-source");
    Assert.Equal(
      new FsusMarkdownEditorSelection(0, spans[0].SourceRange.End),
      editor.TransactionStore.Selection);
    Invoke(atomicActions, "copy");
    Assert.Null(await editor.PendingAtomicCopy);
    Assert.Equal(
      source[..spans[0].SourceRange.End],
      await window.Clipboard!.TryGetTextAsync());

    editor.IsReadOnly = true;
    Dispatcher.UIThread.RunJobs();
    snapshot = Capture(peer, editor);
    Assert.True(snapshot.IsReadOnly);
    Assert.Contains("readonly=true", snapshot.ItemStatus);
    Assert.Contains("Read-only", snapshot.HelpText);
    Assert.Throws<InvalidOperationException>(() =>
      peer.GetProvider<IValueProvider>()!.SetValue("forbidden"));
    editor.IsReadOnly = false;
    editor.IsEnabled = false;
    Dispatcher.UIThread.RunJobs();
    Assert.Contains("disabled=true", peer.GetItemStatus());
    Assert.False(peer.IsEnabled());
    editor.IsEnabled = true;
    DataValidationErrors.SetError(editor, new InvalidOperationException("invalid"));
    editor.CapabilityState = "source-fallback";
    Dispatcher.UIThread.RunJobs();
    Assert.Contains("invalid=true", peer.GetItemStatus());
    Assert.Contains("capability=source-fallback", peer.GetItemStatus());
    DataValidationErrors.ClearErrors(editor);

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

    scroll.Offset = default;
    Dispatcher.UIThread.RunJobs();
    Arrange(window, editor);
    atomicNodes = peer.GetChildren()!;
    atomicActions = Assert.Single(
      atomicNodes,
      node => node.GetProvider<IValueProvider>()?.Value == "Diagram 0")
      .GetChildren()!;
    Invoke(atomicActions, "delete");
    Assert.False(editor.Document.StartsWith("![Diagram 0]", StringComparison.Ordinal));

    window.Close();
  }

  [AvaloniaFact]
  public async Task AtomicCopyIsBoundedWhenClipboardIsUnavailableOrFails()
  {
    const string source = "`code`";
    var identity = new FsusMarkdownDocumentIdentity("automation-copy", 1);
    var editor = new FsusMarkdownEditor
    {
      Document = source,
      DocumentIdentity = identity,
      Mode = FsusMarkdownEditorMode.Live,
    };
    Assert.True(editor.CommitProjection(new(
      identity,
      0,
      source,
      [new(
        "atomic-code",
        new(0, source.Length),
        FsusMarkdownProjectionSpanKind.Atomic,
        "code",
        "inline-code")])).Accepted);
    var peer = ControlAutomationPeer.CreatePeerForElement(editor);
    var atomic = Assert.Single(peer.GetChildren()!);

    Invoke(atomic.GetChildren()!, "copy");
    Assert.Null(await editor.PendingAtomicCopy);
    Assert.Equal(new FsusMarkdownEditorSelection(0, source.Length), editor.TransactionStore.Selection);

    var error = await FsusMarkdownEditor.TrySetAtomicClipboardTextAsync(
      _ => Task.FromException(new InvalidOperationException("clipboard failed")),
      source);
    Assert.IsType<InvalidOperationException>(error);
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
    Assert.True(IsViewportAccepted(ToViewportSnapshot(edited, source.Length)));
    Assert.False(IsViewportAccepted(
      ToViewportSnapshot(edited, source.Length) with
      {
        RealizedCharacterCount = source.Length,
      }));
    Assert.False(IsViewportAccepted(
      ToViewportSnapshot(edited, source.Length) with
      {
        RealizedLogicalLines = edited.TotalLogicalLines,
      }));
    Assert.False(IsViewportAccepted(
      ToViewportSnapshot(edited, source.Length) with
      {
        FullIndexBuildCount = edited.FullIndexBuildCount + 1,
      }));
    Assert.False(IsViewportAccepted(
      ToViewportSnapshot(edited, source.Length) with
      {
        RetainedLayoutCount = 2,
      }));

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
    var value = peer.GetProvider<IValueProvider>();
    return new(
      peer.GetAutomationControlType(),
      peer.GetName(),
      value?.Value,
      peer.GetHelpText(),
      peer.GetItemStatus() ?? string.Empty,
      value is not null,
      value?.IsReadOnly ?? true,
      AutomationProperties.GetLiveSetting(editor),
      children.Count,
      children.Count(child => child.IsKeyboardFocusable()));
  }

  private static bool IsAccepted(AccessibilitySnapshot snapshot) =>
    snapshot.Role == AutomationControlType.Edit &&
    snapshot.Name == "Markdown editor" &&
    snapshot.Value is not null &&
    snapshot.ItemStatus.Contains("selection=", StringComparison.Ordinal) &&
    snapshot.ItemStatus.Contains("caret=", StringComparison.Ordinal) &&
    snapshot.ItemStatus.Contains("readonly=", StringComparison.Ordinal) &&
    snapshot.ItemStatus.Contains("disabled=", StringComparison.Ordinal) &&
    snapshot.ItemStatus.Contains("invalid=", StringComparison.Ordinal) &&
    snapshot.ItemStatus.Contains("mode=", StringComparison.Ordinal) &&
    snapshot.ItemStatus.Contains("capability=", StringComparison.Ordinal) &&
    snapshot.HasValueProvider &&
    snapshot.LiveSetting == AutomationLiveSetting.Off &&
    snapshot.AtomicNodeCount <= 64 &&
    snapshot.ParagraphTabStops == 0;

  private static void Invoke(
    IReadOnlyList<AutomationPeer> actions,
    string name) =>
    Assert.Single(actions, action => action.GetName() == name)
      .GetProvider<IInvokeProvider>()!
      .Invoke();

  private static ViewportSnapshot ToViewportSnapshot(
    FsusMarkdownViewportDiagnostics diagnostics,
    int documentCharacters) =>
    new(
      diagnostics.IsVirtualized,
      diagnostics.TotalLogicalLines,
      diagnostics.RealizedLogicalLines,
      diagnostics.RealizedCharacterCount,
      diagnostics.RetainedLayoutCount,
      diagnostics.FullIndexBuildCount,
      documentCharacters);

  private static bool IsViewportAccepted(ViewportSnapshot snapshot) =>
    snapshot.IsVirtualized &&
    snapshot.RealizedLogicalLines < snapshot.TotalLogicalLines &&
    snapshot.RealizedCharacterCount < snapshot.DocumentCharacters / 4 &&
    snapshot.RetainedLayoutCount == 1 &&
    snapshot.FullIndexBuildCount == 1;

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
    string? Name,
    string? Value,
    string? HelpText,
    string ItemStatus,
    bool HasValueProvider,
    bool IsReadOnly,
    AutomationLiveSetting LiveSetting,
    int AtomicNodeCount,
    int ParagraphTabStops);

  private sealed record ViewportSnapshot(
    bool IsVirtualized,
    int TotalLogicalLines,
    int RealizedLogicalLines,
    int RealizedCharacterCount,
    int RetainedLayoutCount,
    int FullIndexBuildCount,
    int DocumentCharacters);
}
