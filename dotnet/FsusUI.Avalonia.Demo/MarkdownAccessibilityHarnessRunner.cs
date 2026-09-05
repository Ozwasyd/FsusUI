using System.Runtime.InteropServices;
using System.Text.Json;
using Avalonia;
using Avalonia.Automation;
using Avalonia.Automation.Peers;
using Avalonia.Automation.Provider;
using Avalonia.Controls;
using Avalonia.Controls.ApplicationLifetimes;
using Avalonia.Input.Platform;
using Avalonia.Threading;
using Avalonia.VisualTree;
using FsusUI.Avalonia.Controls;

namespace FsusUI.Avalonia.Demo;

/// <summary>
/// Creates a real desktop window and exercises the Markdown editor's actual
/// AutomationPeer tree. The resulting local X display evidence is a
/// simulation of an assistive-technology client, not a claim that a physical
/// DPI device or human-operated screen reader was used.
/// </summary>
internal static class MarkdownAccessibilityHarnessRunner
{
  private static readonly JsonSerializerOptions JsonOptions = new()
  {
    PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    WriteIndented = true,
  };

  private static string outputPath =
    Path.Combine(".tmp", "accessibility", "markdown-editor.json");
  private static string candidate = "unknown";

  public static bool IsConfigured { get; private set; }

  public static void Configure(string[] args)
  {
    IsConfigured = true;
    outputPath = ReadArgument(args, "--output") ?? outputPath;
    candidate = ReadArgument(args, "--candidate") ?? candidate;
  }

  public static Window CreateWindow(IClassicDesktopStyleApplicationLifetime lifetime)
  {
    var editor = new FsusMarkdownEditor
    {
      Width = 520,
      Height = 280,
      Mode = FsusMarkdownEditorMode.Live,
    };
    var window = new Window
    {
      Width = 560,
      Height = 340,
      Content = editor,
      Title = "FsusUI Markdown accessibility harness",
      ShowInTaskbar = false,
    };
    window.Opened += async (_, _) =>
    {
      var evidence = await RunAsync(window, editor);
      WriteEvidence(evidence);
      Console.WriteLine(
        $"Markdown accessibility harness finished: allPassed={evidence.AllPassed} " +
        $"checks={evidence.Checks.Count} output={outputPath}");
      foreach (var check in evidence.Checks)
      {
        Console.WriteLine($"  {check.Key}: {check.Value}");
      }
      Dispatcher.UIThread.Post(() => lifetime.Shutdown(evidence.AllPassed ? 0 : 1));
    };
    return window;
  }

  private static async Task<AccessibilityEvidence> RunAsync(
    Window window,
    FsusMarkdownEditor editor)
  {
    var evidence = new AccessibilityEvidence
    {
      Candidate = candidate,
      Platform = RuntimeInformation.OSDescription,
      Display = Environment.GetEnvironmentVariable("DISPLAY") ?? string.Empty,
      RenderScaling = window.RenderScaling,
    };
    try
    {
      var (source, spans) = AtomicDocument();
      var identity = new FsusMarkdownDocumentIdentity("accessibility-harness", 1);
      editor.DocumentIdentity = identity;
      editor.Document = source;
      editor.TransactionStore.SetSelection(new(0, 0));
      editor.Mode = FsusMarkdownEditorMode.Source;
      editor.Mode = FsusMarkdownEditorMode.Live;
      editor.ScrollPosition = default;
      await Settle();
      Check(evidence, "projection-accepted", editor.CommitProjection(new(
        identity,
        editor.TransactionStore.Revision,
        source,
        spans)).Accepted);
      await Settle();

      var peer = ControlAutomationPeer.CreatePeerForElement(editor);
      var initialSelection = editor.TransactionStore.Selection;
      var status = peer.GetItemStatus() ?? string.Empty;
      Check(evidence, "role-edit",
        peer.GetAutomationControlType() == AutomationControlType.Edit);
      Check(evidence, "name", peer.GetName() == "Markdown editor");
      Check(evidence, "value", peer.GetProvider<IValueProvider>()?.Value == source);
      Check(evidence, "selection-and-caret",
        status.Contains(
          $"selection={initialSelection.Start}:{initialSelection.End}",
          StringComparison.Ordinal) &&
        status.Contains($"caret={initialSelection.End}", StringComparison.Ordinal));
      Check(evidence, "dynamic-state",
        status.Contains("readonly=false", StringComparison.Ordinal) &&
        status.Contains("disabled=false", StringComparison.Ordinal) &&
        status.Contains("invalid=false", StringComparison.Ordinal));
      Check(evidence, "mode-and-capability",
        status.Contains("mode=live", StringComparison.Ordinal) &&
        status.Contains("capability=aligned", StringComparison.Ordinal));
      Check(evidence, "whole-document-live-off",
        AutomationProperties.GetLiveSetting(editor) == AutomationLiveSetting.Off);

      var atoms = peer.GetChildren() ?? [];
      Check(evidence, "viewport-bounded-atomic-tree", atoms.Count is > 0 and < 64);
      var first = atoms.FirstOrDefault(node =>
        node.GetProvider<IValueProvider>()?.Value == "Diagram 0");
      Check(evidence, "atomic-name-value-status",
        first?.GetAutomationControlType() == AutomationControlType.Group &&
        first.GetName() == "image" &&
        first.GetProvider<IValueProvider>()?.Value == "Diagram 0" &&
        (first.GetItemStatus() ?? string.Empty).Contains("source=0:", StringComparison.Ordinal));
      if (first is null)
      {
        throw new InvalidOperationException("The first viewport did not expose Diagram 0.");
      }

      var actions = first.GetChildren() ?? [];
      Check(evidence, "atomic-actions",
        actions.Select(action => action.GetName()).SequenceEqual(
          ["enter-before", "enter-after", "edit-source", "select-source", "copy", "delete"]));
      Check(evidence, "no-tab-trap", actions.All(action => !action.IsKeyboardFocusable()));

      Invoke(actions, "enter-after");
      Check(evidence, "enter-after",
        editor.TransactionStore.Selection ==
        new FsusMarkdownEditorSelection(spans[0].SourceRange.End, spans[0].SourceRange.End));
      Invoke(actions, "enter-before");
      Check(evidence, "enter-before",
        editor.TransactionStore.Selection == new FsusMarkdownEditorSelection(0, 0));
      Invoke(actions, "edit-source");
      Check(evidence, "edit-source", editor.Mode == FsusMarkdownEditorMode.Source);
      editor.Mode = FsusMarkdownEditorMode.Live;
      Invoke(actions, "select-source");
      Check(evidence, "select-source",
        editor.TransactionStore.Selection ==
        new FsusMarkdownEditorSelection(0, spans[0].SourceRange.End));
      Invoke(actions, "copy");
      var copyError = await editor.PendingAtomicCopy;
      var copied = window.Clipboard is null
        ? null
        : await window.Clipboard.TryGetTextAsync();
      Check(evidence, "copy-source",
        copyError is null && copied == source[..spans[0].SourceRange.End]);

      editor.IsReadOnly = true;
      await Settle();
      Check(evidence, "readonly",
        peer.GetProvider<IValueProvider>()?.IsReadOnly == true &&
        (peer.GetItemStatus() ?? string.Empty).Contains("readonly=true", StringComparison.Ordinal));
      editor.IsReadOnly = false;
      editor.IsEnabled = false;
      await Settle();
      Check(evidence, "disabled",
        !peer.IsEnabled() &&
        (peer.GetItemStatus() ?? string.Empty).Contains("disabled=true", StringComparison.Ordinal));
      editor.IsEnabled = true;
      DataValidationErrors.SetError(editor, new InvalidOperationException("invalid"));
      editor.CapabilityState = "source-fallback";
      await Settle();
      status = peer.GetItemStatus() ?? string.Empty;
      Check(evidence, "invalid", status.Contains("invalid=true", StringComparison.Ordinal));
      Check(evidence, "capability-transition",
        status.Contains("capability=source-fallback", StringComparison.Ordinal));
      DataValidationErrors.ClearErrors(editor);
      editor.CapabilityState = "aligned";

      editor.ScrollPosition = new Vector(0, editor.ScrollExtentHeight);
      await Settle();
      var laterAtoms = peer.GetChildren() ?? [];
      Check(evidence, "later-atoms-reachable",
        laterAtoms.All(node => node.GetProvider<IValueProvider>()?.Value != "Diagram 0") &&
        laterAtoms.Any(node => node.GetProvider<IValueProvider>()?.Value == "Diagram 119"));

      editor.ScrollPosition = default;
      await Settle();
      first = (peer.GetChildren() ?? []).First(node =>
        node.GetProvider<IValueProvider>()?.Value == "Diagram 0");
      Invoke(first.GetChildren() ?? [], "delete");
      Check(evidence, "delete-source",
        !editor.Document.StartsWith("![Diagram 0]", StringComparison.Ordinal));

      var largeDocument = string.Join(
        "\n",
        Enumerable.Range(0, 3_001).Select(index =>
          $"## H {index:D5} xxxxxxxxxxxxxxxxxxxxxxxxxxxxx"));
      editor.Mode = FsusMarkdownEditorMode.Source;
      editor.DocumentIdentity = new("accessibility-large", 2);
      editor.Document = largeDocument;
      editor.ScrollPosition = default;
      await Settle();
      var view = editor.GetVisualDescendants().OfType<FsusMarkdownEditorProjectionView>().Single();
      var diagnostics = view.ViewportDiagnostics;
      Check(evidence, "large-document-virtualized",
        diagnostics.IsVirtualized &&
        diagnostics.TotalLogicalLines >= 3_001 &&
        diagnostics.RealizedLogicalLines < diagnostics.TotalLogicalLines &&
        diagnostics.RealizedCharacterCount < largeDocument.Length / 4 &&
        diagnostics.RetainedLayoutCount == 1);
      evidence.Observations["totalLogicalLines"] = diagnostics.TotalLogicalLines.ToString();
      evidence.Observations["realizedLogicalLines"] = diagnostics.RealizedLogicalLines.ToString();
      evidence.Observations["realizedCharacters"] = diagnostics.RealizedCharacterCount.ToString();
      evidence.Observations["documentCharacters"] = largeDocument.Length.ToString();
    }
    catch (Exception exception)
    {
      evidence.Fatal = exception.ToString();
    }
    evidence.AllPassed =
      evidence.Fatal is null &&
      evidence.Checks.Count >= 20 &&
      evidence.Checks.Values.All(value => value);
    return evidence;
  }

  private static (string Source, IReadOnlyList<FsusMarkdownProjectionSpan> Spans)
    AtomicDocument()
  {
    var source = string.Join(
      "\n",
      Enumerable.Range(0, 120).Select(index => $"![Diagram {index}](diagram-{index}.png)"));
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
    return (source, spans);
  }

  private static void Invoke(IReadOnlyList<AutomationPeer> actions, string name) =>
    actions.Single(action => action.GetName() == name)
      .GetProvider<IInvokeProvider>()!
      .Invoke();

  private static void Check(
    AccessibilityEvidence evidence,
    string id,
    bool passed)
  {
    evidence.Checks[id] = passed;
    Console.WriteLine($"  {id}: {passed}");
  }

  private static async Task Settle()
  {
    await Dispatcher.UIThread.InvokeAsync(
      () => { },
      DispatcherPriority.Background);
    await Task.Delay(80);
  }

  private static void WriteEvidence(AccessibilityEvidence evidence)
  {
    var fullPath = Path.GetFullPath(outputPath);
    Directory.CreateDirectory(Path.GetDirectoryName(fullPath)!);
    File.WriteAllText(fullPath, JsonSerializer.Serialize(evidence, JsonOptions));
  }

  private static string? ReadArgument(string[] args, string name)
  {
    var index = Array.FindIndex(
      args,
      value => string.Equals(value, name, StringComparison.OrdinalIgnoreCase));
    return index >= 0 && index + 1 < args.Length ? args[index + 1] : null;
  }

  private sealed class AccessibilityEvidence
  {
    public string Schema { get; init; } =
      "fsusui.markdown-editor-accessibility-evidence.v1";
    public string Candidate { get; init; } = string.Empty;
    public string Platform { get; init; } = string.Empty;
    public string Display { get; init; } = string.Empty;
    public double RenderScaling { get; init; }
    public string EvidenceKind { get; init; } =
      "local-real-window-automationpeer-simulation";
    public string Limitation { get; init; } =
      "No physical DPI device or human-operated screen reader is claimed.";
    public Dictionary<string, bool> Checks { get; } = new(StringComparer.Ordinal);
    public Dictionary<string, string> Observations { get; } = new(StringComparer.Ordinal);
    public bool AllPassed { get; set; }
    public string? Fatal { get; set; }
  }
}
