using Avalonia;
using Avalonia.Automation;
using Avalonia.Automation.Peers;
using Avalonia.Controls;
using Avalonia.Input;
using System.Globalization;
using System.Windows.Input;

namespace FsusUI.Avalonia.Controls;

public sealed record FsusTextSelection(int Start, int Length)
{
  public int End => Start + Length;

  public bool IsCollapsed => Length == 0;
}

public sealed record FsusTextEditorBudget(
  int DocumentChars,
  int UndoStackEntries,
  int PreviewRetainedBlocks,
  double PreviewUpdateMs,
  double MemoryKb);

public sealed record FsusTextEditorBudgetResult(
  int DocumentChars,
  int UndoDepth,
  int PreviewRetainedBlocks,
  FsusTextEditorBudget Budget)
{
  public bool WithinBudget =>
    DocumentChars <= Budget.DocumentChars &&
    UndoDepth <= Budget.UndoStackEntries &&
    PreviewRetainedBlocks <= Budget.PreviewRetainedBlocks;
}

public class FsusTextEditor : ContentControl
{
  private readonly List<FsusTextEditorSnapshot> undoStack = [];
  private readonly List<FsusTextEditorSnapshot> redoStack = [];
  private string text = string.Empty;
  private string? accessibleName;
  private bool isReadOnly;
  private bool splitPreviewEnabled;
  private bool isPreviewVisible = true;
  private bool isComposing;
  private bool isPreviewUpdatePending;
  private bool isSyncingScroll;
  private int previewRequestVersion;
  private FsusTextEditorSnapshot? compositionBaseline;
  private FsusTextEditorBudget budget = new(
    DocumentChars: 1_000_000,
    UndoStackEntries: 128,
    PreviewRetainedBlocks: 128,
    PreviewUpdateMs: 12d,
    MemoryKb: 512d);

  public FsusTextEditor()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-text-editor");
    Focusable = true;
    SyncPreviewBudget();
    UndoCommand = new RelayCommand(_ => Undo(), _ => CanUndo);
    RedoCommand = new RelayCommand(_ => Redo(), _ => CanRedo);
    PasteCommand = new RelayCommand(
      parameter => Paste(parameter?.ToString() ?? string.Empty),
      _ => CanEdit);
    SyncState();
  }

  public ICommand UndoCommand { get; }

  public ICommand RedoCommand { get; }

  public ICommand PasteCommand { get; }

  public FsusTextViewer Preview { get; } = new()
  {
    AccessibleName = "Editor preview",
  };

  public FsusTextEditorBudget Budget
  {
    get => budget;
    set
    {
      budget = value;
      TrimStack(undoStack, budget.UndoStackEntries);
      TrimStack(redoStack, budget.UndoStackEntries);
      SyncPreviewBudget();
      SyncState();
    }
  }

  public TimeSpan PreviewDebounce { get; set; } = TimeSpan.FromMilliseconds(120);

  public string Text
  {
    get => text;
    set => SetDocument(value ?? string.Empty);
  }

  public string? AccessibleName
  {
    get => accessibleName;
    set
    {
      accessibleName = value;
      SyncState();
    }
  }

  public bool IsReadOnly
  {
    get => isReadOnly;
    set
    {
      isReadOnly = value;
      SyncState();
    }
  }

  public bool SplitPreviewEnabled
  {
    get => splitPreviewEnabled;
    set
    {
      splitPreviewEnabled = value;
      SyncState();
    }
  }

  public bool IsPreviewVisible
  {
    get => isPreviewVisible;
    set
    {
      isPreviewVisible = value;
      SyncState();
    }
  }

  public FsusTextSelection Selection { get; private set; } = new(0, 0);

  public bool IsComposing => isComposing;

  public bool IsPreviewUpdatePending => isPreviewUpdatePending;

  public bool LastPreviewCanceled { get; private set; }

  public string PreviewStateName { get; private set; } = "ready";

  public int PreviewUpdateCount { get; private set; }

  public int EditorScrollBlockIndex { get; private set; }

  public int SuppressedPreviewFeedbackLoopCount { get; private set; }

  public int UndoDepth => undoStack.Count;

  public int RedoDepth => redoStack.Count;

  public bool CanUndo => CanEdit && undoStack.Count > 0;

  public bool CanRedo => CanEdit && redoStack.Count > 0;

  public void SetText(string? value, bool resetHistory = true)
  {
    text = value ?? string.Empty;
    Selection = new FsusTextSelection(text.Length, 0);

    if (resetHistory)
    {
      undoStack.Clear();
      redoStack.Clear();
    }

    MarkPreviewPending();
    SyncState();
  }

  public void Select(int start, int length)
  {
    Selection = ClampSelection(new FsusTextSelection(start, length), text);
    SyncState();
  }

  public void TypeText(string? value) => ReplaceSelection(value ?? string.Empty);

  public void Paste(string? value) => ReplaceSelection(value ?? string.Empty);

  public void BeginComposition()
  {
    if (!CanEdit)
    {
      return;
    }

    compositionBaseline = Snapshot();
    isComposing = true;
    SyncState();
  }

  public void UpdateComposition(string? value)
  {
    if (!CanEdit)
    {
      return;
    }

    if (!isComposing)
    {
      BeginComposition();
    }

    if (compositionBaseline is null)
    {
      return;
    }

    var replacement = value ?? string.Empty;
    ApplyTextFromBaseline(compositionBaseline, replacement);
    MarkPreviewPending();
    SyncState();
  }

  public void CommitComposition(string? value)
  {
    if (!CanEdit)
    {
      return;
    }

    if (!isComposing)
    {
      BeginComposition();
    }

    if (compositionBaseline is null)
    {
      return;
    }

    var baseline = compositionBaseline;
    var replacement = value ?? string.Empty;
    var next = TextAfterReplacement(baseline.Text, baseline.Selection, replacement);
    var nextSelection = new FsusTextSelection(
      baseline.Selection.Start + replacement.Length,
      0);

    isComposing = false;
    compositionBaseline = null;

    if (text != next || Selection != nextSelection)
    {
      PushUndoSnapshot(baseline, clearRedo: true);
      text = next;
      Selection = nextSelection;
      MarkPreviewPending();
    }

    SyncState();
  }

  public bool Undo()
  {
    if (!CanUndo)
    {
      return false;
    }

    var current = Snapshot();
    var previous = undoStack[^1];
    undoStack.RemoveAt(undoStack.Count - 1);
    PushRedoSnapshot(current);
    ApplySnapshot(previous);
    return true;
  }

  public bool Redo()
  {
    if (!CanRedo)
    {
      return false;
    }

    var current = Snapshot();
    var next = redoStack[^1];
    redoStack.RemoveAt(redoStack.Count - 1);
    PushUndoSnapshot(current, clearRedo: false);
    ApplySnapshot(next);
    return true;
  }

  public async ValueTask<bool> SyncPreviewAsync(CancellationToken cancellationToken = default)
  {
    if (!isPreviewUpdatePending)
    {
      return true;
    }

    var targetVersion = previewRequestVersion;
    LastPreviewCanceled = false;
    PreviewStateName = "syncing";
    SyncState();

    try
    {
      if (PreviewDebounce > TimeSpan.Zero)
      {
        await Task.Delay(PreviewDebounce, cancellationToken);
      }

      cancellationToken.ThrowIfCancellationRequested();
      var blocks = ParseBlocks(text, cancellationToken);
      cancellationToken.ThrowIfCancellationRequested();

      Preview.Blocks.Clear();
      foreach (var block in blocks)
      {
        Preview.Blocks.Add(block);
      }

      if (!await Preview.RenderAsync(cancellationToken))
      {
        LastPreviewCanceled = true;
        PreviewStateName = "canceled";
        SyncState();
        return false;
      }

      PreviewUpdateCount++;
      PreviewStateName = "ready";
      isPreviewUpdatePending = targetVersion != previewRequestVersion;
      SyncState();
      return !isPreviewUpdatePending;
    }
    catch (OperationCanceledException)
    {
      LastPreviewCanceled = true;
      PreviewStateName = "canceled";
      SyncState();
      return false;
    }
  }

  public void ScrollEditorToBlock(int blockIndex)
  {
    if (isSyncingScroll)
    {
      return;
    }

    try
    {
      isSyncingScroll = true;
      Preview.ScrollToBlock(blockIndex);
      EditorScrollBlockIndex = Preview.VisibleBlockStartIndex;
    }
    finally
    {
      isSyncingScroll = false;
    }

    SyncState();
  }

  public void ScrollPreviewToBlock(int blockIndex)
  {
    if (isSyncingScroll)
    {
      SuppressedPreviewFeedbackLoopCount++;
      return;
    }

    try
    {
      isSyncingScroll = true;
      Preview.ScrollToBlock(blockIndex);
      EditorScrollBlockIndex = Preview.VisibleBlockStartIndex;
      SuppressedPreviewFeedbackLoopCount++;
    }
    finally
    {
      isSyncingScroll = false;
    }

    SyncState();
  }

  public FsusTextEditorBudgetResult EvaluateBudget() =>
    new(
      text.Length,
      undoStack.Count,
      Preview.EstimatedRetainedBlockCount,
      Budget);

  protected ValueTask<bool> HandleKeyAsync(
    Key key,
    KeyModifiers modifiers = KeyModifiers.None)
  {
    if (!IsEnabled)
    {
      return ValueTask.FromResult(false);
    }

    var hasControl = modifiers.HasFlag(KeyModifiers.Control);
    var hasShift = modifiers.HasFlag(KeyModifiers.Shift);

    if (hasControl && key == Key.Z && hasShift)
    {
      return ValueTask.FromResult(Redo());
    }

    if (hasControl && key == Key.Z)
    {
      return ValueTask.FromResult(Undo());
    }

    if (hasControl && key == Key.Y)
    {
      return ValueTask.FromResult(Redo());
    }

    if (hasControl)
    {
      return ValueTask.FromResult(false);
    }

    if (key == Key.Left)
    {
      Selection = new FsusTextSelection(
        Math.Max(0, Selection.IsCollapsed ? Selection.Start - 1 : Selection.Start),
        0);
      SyncState();
      return ValueTask.FromResult(true);
    }

    if (key == Key.Right)
    {
      Selection = new FsusTextSelection(
        Math.Min(text.Length, Selection.IsCollapsed ? Selection.Start + 1 : Selection.End),
        0);
      SyncState();
      return ValueTask.FromResult(true);
    }

    if (key == Key.Home)
    {
      Selection = new FsusTextSelection(0, 0);
      SyncState();
      return ValueTask.FromResult(true);
    }

    if (key == Key.End)
    {
      Selection = new FsusTextSelection(text.Length, 0);
      SyncState();
      return ValueTask.FromResult(true);
    }

    return ValueTask.FromResult(false);
  }

  protected override void OnPropertyChanged(AvaloniaPropertyChangedEventArgs change)
  {
    base.OnPropertyChanged(change);

    if (change.Property == IsEnabledProperty)
    {
      SyncState();
    }
  }

  private bool CanEdit => IsEnabled && !isReadOnly;

  private void SetDocument(string value)
  {
    text = value;
    Selection = new FsusTextSelection(text.Length, 0);
    undoStack.Clear();
    redoStack.Clear();
    MarkPreviewPending();
    SyncState();
  }

  private void ReplaceSelection(string replacement)
  {
    if (!CanEdit)
    {
      return;
    }

    var selection = ClampSelection(Selection, text);
    var next = TextAfterReplacement(text, selection, replacement);
    var nextSelection = new FsusTextSelection(selection.Start + replacement.Length, 0);

    if (next == text && nextSelection == Selection)
    {
      return;
    }

    PushUndoSnapshot(Snapshot(), clearRedo: true);
    text = next;
    Selection = nextSelection;
    MarkPreviewPending();
    SyncState();
  }

  private void ApplyTextFromBaseline(
    FsusTextEditorSnapshot baseline,
    string replacement)
  {
    var next = TextAfterReplacement(baseline.Text, baseline.Selection, replacement);
    text = next;
    Selection = new FsusTextSelection(
      baseline.Selection.Start + replacement.Length,
      0);
  }

  private void ApplySnapshot(FsusTextEditorSnapshot snapshot)
  {
    text = snapshot.Text;
    Selection = ClampSelection(snapshot.Selection, text);
    isComposing = false;
    compositionBaseline = null;
    MarkPreviewPending();
    SyncState();
  }

  private void PushUndoSnapshot(
    FsusTextEditorSnapshot snapshot,
    bool clearRedo)
  {
    if (undoStack.Count > 0 && undoStack[^1] == snapshot)
    {
      if (clearRedo)
      {
        redoStack.Clear();
      }

      return;
    }

    undoStack.Add(snapshot);
    TrimStack(undoStack, Budget.UndoStackEntries);

    if (clearRedo)
    {
      redoStack.Clear();
    }
  }

  private void PushRedoSnapshot(FsusTextEditorSnapshot snapshot)
  {
    redoStack.Add(snapshot);
    TrimStack(redoStack, Budget.UndoStackEntries);
  }

  private void MarkPreviewPending()
  {
    isPreviewUpdatePending = true;
    previewRequestVersion++;
  }

  private void SyncPreviewBudget()
  {
    Preview.RenderBudget = new FsusTextViewerRenderBudget(
      budget.PreviewRetainedBlocks,
      budget.PreviewUpdateMs,
      budget.MemoryKb);
  }

  private FsusTextEditorSnapshot Snapshot() => new(text, Selection);

  private void SyncState()
  {
    FsusComponentClasses.Ensure(this, "fsus-readonly", isReadOnly);
    FsusComponentClasses.Ensure(this, "fsus-disabled", !IsEnabled);
    FsusComponentClasses.Ensure(this, "fsus-composing", isComposing);
    FsusComponentClasses.Ensure(this, "fsus-preview-visible", isPreviewVisible);
    FsusComponentClasses.Ensure(this, "fsus-split-preview", splitPreviewEnabled);
    FsusComponentClasses.Ensure(this, "fsus-preview-pending", isPreviewUpdatePending);
    FsusComponentClasses.Ensure(this, "fsus-preview-canceled", LastPreviewCanceled);
    AutomationProperties.SetName(this, FsusComponentClasses.ResolveName(accessibleName, "Text editor"));
    AutomationProperties.SetControlTypeOverride(this, AutomationControlType.Edit);
    AutomationProperties.SetItemStatus(
      this,
      $"{PreviewStateName}, {text.Length.ToString(CultureInfo.InvariantCulture)} chars, selection {Selection.Start.ToString(CultureInfo.InvariantCulture)}-{Selection.End.ToString(CultureInfo.InvariantCulture)}, {PreviewStatus()}");
  }

  private string PreviewStatus()
  {
    if (isPreviewUpdatePending)
    {
      return LastPreviewCanceled ? "preview canceled" : "preview pending";
    }

    return "preview synced";
  }

  private static List<FsusTextContentBlock> ParseBlocks(
    string source,
    CancellationToken cancellationToken)
  {
    var blocks = new List<FsusTextContentBlock>();
    var normalized = source.Replace("\r\n", "\n", StringComparison.Ordinal)
      .Replace('\r', '\n');
    var lines = normalized.Split('\n');

    foreach (var rawLine in lines)
    {
      cancellationToken.ThrowIfCancellationRequested();

      var line = rawLine.TrimEnd();
      if (line.Length == 0)
      {
        continue;
      }

      blocks.Add(ParseBlock(line));
    }

    if (blocks.Count == 0)
    {
      blocks.Add(new FsusTextContentBlock(FsusTextBlockKind.Paragraph, string.Empty));
    }

    return blocks;
  }

  private static FsusTextContentBlock ParseBlock(string line)
  {
    if (line.StartsWith("#", StringComparison.Ordinal))
    {
      var level = Math.Min(6, line.TakeWhile(character => character == '#').Count());
      if (line.Length > level && char.IsWhiteSpace(line[level]))
      {
        return new FsusTextContentBlock(
          FsusTextBlockKind.Heading,
          line[level..].TrimStart(),
          level);
      }
    }

    if (line.StartsWith("- ", StringComparison.Ordinal) ||
      line.StartsWith("* ", StringComparison.Ordinal))
    {
      return new FsusTextContentBlock(FsusTextBlockKind.ListItem, line[2..]);
    }

    if (line.StartsWith("> ", StringComparison.Ordinal))
    {
      return new FsusTextContentBlock(FsusTextBlockKind.Quote, line[2..]);
    }

    if (line.StartsWith("    ", StringComparison.Ordinal) ||
      line.StartsWith('\t'))
    {
      return new FsusTextContentBlock(
        FsusTextBlockKind.Code,
        line.TrimStart());
    }

    return new FsusTextContentBlock(FsusTextBlockKind.Paragraph, line);
  }

  private static string TextAfterReplacement(
    string source,
    FsusTextSelection selection,
    string replacement)
  {
    var normalized = ClampSelection(selection, source);
    return source
      .Remove(normalized.Start, normalized.Length)
      .Insert(normalized.Start, replacement);
  }

  private static FsusTextSelection ClampSelection(
    FsusTextSelection selection,
    string source)
  {
    var start = Math.Clamp(selection.Start, 0, source.Length);
    var length = Math.Clamp(selection.Length, 0, source.Length - start);
    return new FsusTextSelection(start, length);
  }

  private static void TrimStack(
    List<FsusTextEditorSnapshot> stack,
    int maxDepth)
  {
    var depth = Math.Max(1, maxDepth);
    while (stack.Count > depth)
    {
      stack.RemoveAt(0);
    }
  }

  private sealed record FsusTextEditorSnapshot(
    string Text,
    FsusTextSelection Selection);

  private sealed class RelayCommand(
    Action<object?> execute,
    Predicate<object?> canExecute) : ICommand
  {
    public event EventHandler? CanExecuteChanged
    {
      add { }
      remove { }
    }

    public bool CanExecute(object? parameter) => canExecute(parameter);

    public void Execute(object? parameter) => execute(parameter);
  }
}
