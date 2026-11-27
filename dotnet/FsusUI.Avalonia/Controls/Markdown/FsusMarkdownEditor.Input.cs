using Avalonia;
using Avalonia.Automation;
using Avalonia.Automation.Peers;
using Avalonia.Automation.Provider;
using Avalonia.Controls;
using Avalonia.Controls.Primitives;
using Avalonia.Controls.Presenters;
using Avalonia.Input;
using Avalonia.Input.Platform;
using Avalonia.Input.TextInput;
using Avalonia.Interactivity;
using Avalonia.Media;
using Avalonia.Threading;
using Avalonia.VisualTree;

namespace FsusUI.Avalonia.Controls;

public partial class FsusMarkdownEditor
{
  private void OnSelfGotFocus(object? sender, FocusChangedEventArgs args)
  {
    if (inputOwner is null || !ReferenceEquals(args.Source, this))
    {
      return;
    }
    // Shell focus (programmatic Focus, tab navigation, chrome clicks) must
    // land in the native input owner or the text pipeline never runs.
    inputOwner.Focus();
  }

  private void OnInputTextChanged(object? sender, TextChangedEventArgs args)
  {
    if (synchronizingInput || inputOwner is null)
    {
      return;
    }
    var next = inputOwner.Text ?? string.Empty;
    if (next == store.Value)
    {
      return;
    }
    var previous = store.Value;
    var prefix = 0;
    while (prefix < previous.Length &&
      prefix < next.Length &&
      previous[prefix] == next[prefix])
    {
      prefix += 1;
    }
    var oldSuffix = previous.Length;
    var newSuffix = next.Length;
    while (oldSuffix > prefix &&
      newSuffix > prefix &&
      previous[oldSuffix - 1] == next[newSuffix - 1])
    {
      oldSuffix -= 1;
      newSuffix -= 1;
    }
    var selection = new FsusMarkdownEditorSelection(
      inputOwner.SelectionStart,
      inputOwner.SelectionEnd);
    var inserted = next[prefix..newSuffix];
    var plan = ApplyNativeEvent(
      FsusMarkdownNativeEventKind.Input, inserted, "insertText",
      value: next, previousValue: previous, selection: selection);
    if (plan.Action is not (FsusMarkdownNativeAction.Dispatch or FsusMarkdownNativeAction.Commit))
    {
      // Dedup, freeze, and rejections never dispatch: one pipeline, one
      // transaction per commit, stale commits rejected above the store.
      return;
    }
    var transaction = new FsusMarkdownEditorTransaction(
      [new(prefix, oldSuffix, inserted)],
      History: plan.History,
      Origin: plan.Origin,
      Selection: selection,
      DocumentIdentity: store.Identity);
    _ = Execute(transaction, () => store.Dispatch(transaction));
    NotifyWritingAidsInteraction(FsusMarkdownWritingAidsInteraction.Input);
  }

  private void OnInputSelectionChanged(object? sender, RoutedEventArgs args)
  {
    if (synchronizingInput || inputOwner is null)
    {
      return;
    }
    var previous = store.Selection;
    var next = new FsusMarkdownEditorSelection(
      inputOwner.SelectionStart,
      inputOwner.SelectionEnd);
    if (store.SetSelection(next) && store.Selection != previous)
    {
      SelectionChange?.Invoke(this, new(store.Revision, store.Selection));
      UpdateProjectionSelection();
      RequestWritingAidsSnapshot();
      SyncAutomationState();
      InvalidateAutomationChildren();
    }
  }

  private void OnInputKeyDown(object? sender, KeyEventArgs args)
  {
    if (!args.KeyModifiers.HasFlag(KeyModifiers.Control))
    {
      return;
    }
    if (args.Key == Key.Z)
    {
      _ = args.KeyModifiers.HasFlag(KeyModifiers.Shift) ? Redo() : Undo();
      args.Handled = true;
    }
    else if (args.Key == Key.Y)
    {
      _ = Redo();
      args.Handled = true;
    }
  }

  private void OnInputMethodClientRequested(object? sender, TextInputMethodClientRequestedEventArgs args)
  {
    if (args.Client is null || args.Client is FsusMarkdownEditorTextInputMethodClient)
    {
      return;
    }
    imeClient = new FsusMarkdownEditorTextInputMethodClient(args.Client);
    imeClient.PreeditTextChanged += OnPreeditTextChanged;
    args.Client = imeClient;
  }

  private void OnPreeditTextChanged(string? text, int? cursorPos)
  {
    if (string.IsNullOrEmpty(text))
    {
      // Preedit cleared: the committed text arrives in the same input turn.
      // The end event is applied when that commit lands
      // (OnInputPreviewTextInput), or flushed as a cancel on the next
      // observed input event. No timers: the contract forbids timeout dedup.
      // A composition that was aborted by a document switch also keeps the
      // pending end so its late commit is rejected as orphaned.
      if (nativeMachine.Composing)
      {
        ApplyNativeEvent(FsusMarkdownNativeEventKind.CompositionEnd);
        pendingCompositionEnd = true;
      }
      else if (nativeMachine.Phase is FsusMarkdownNativePhase.Aborted or FsusMarkdownNativePhase.Draining)
      {
        pendingCompositionEnd = true;
      }
      return;
    }
    if (!nativeMachine.Composing)
    {
      ApplyNativeEvent(FsusMarkdownNativeEventKind.CompositionStart, text);
    }
    ApplyNativeEvent(FsusMarkdownNativeEventKind.CompositionUpdate, text);
  }

  private FsusMarkdownNativeEventPlan ApplyNativeEvent(
    FsusMarkdownNativeEventKind kind,
    string? data = null,
    string? inputType = null,
    string? value = null,
    string? previousValue = null,
    int? revision = null,
    FsusMarkdownEditorSelection? selection = null,
    string? clipboardIdentity = null,
    string? origin = null) =>
    nativeMachine.Apply(new()
    {
      Kind = kind,
      Data = data,
      InputType = inputType,
      Value = value ?? store.Value,
      PreviousValue = kind == FsusMarkdownNativeEventKind.DocumentSwitch ? null : previousValue ?? store.Value,
      Revision = revision ?? store.Revision,
      Selection = selection ?? store.Selection,
      ClipboardIdentity = clipboardIdentity,
      Origin = origin,
      DocumentIdentity = store.Identity,
      CurrentIdentity = store.Identity,
    });

  private void FlushPendingCompositionEnd()
  {
    if (!pendingCompositionEnd)
    {
      return;
    }
    pendingCompositionEnd = false;
    if (nativeMachine.Composing)
    {
      ApplyNativeEvent(FsusMarkdownNativeEventKind.CompositionEnd);
    }
    if (nativeMachine.Phase == FsusMarkdownNativePhase.Committing)
    {
      ApplyNativeEvent(FsusMarkdownNativeEventKind.Input, inputType: "insertCompositionText");
    }
  }

  private void OnInputPreviewKeyDown(object? sender, KeyEventArgs args)
  {
    if (inputOwner is null)
    {
      return;
    }
    FlushPendingCompositionEnd();
    if ((args.Key == Key.V || args.Key == Key.Insert) &&
      args.KeyModifiers.HasFlag(KeyModifiers.Control))
    {
      args.Handled = true;
      _ = HandlePasteAsync("paste");
      return;
    }
    if (nativeMachine.FreezeSmartInput)
    {
      // Composition active: freeze editor structural transforms while leaving
      // every key unhandled for the platform IME's candidate/preedit logic.
      return;
    }
    var key = MapBlockInputKey(args.Key, args.KeyModifiers);
    if (key is null || Mode == FsusMarkdownEditorMode.Preview || IsReadOnly)
    {
      return;
    }
    var plan = FsusMarkdownEditorBlockInput.Resolve(new FsusMarkdownBlockInputContext(
      key,
      store.Selection,
      store.Value,
      false,
      CurrentBlockInputNodes()));
    if (plan.Rejected is not null)
    {
      args.Handled = true;
      return;
    }
    if (plan.Transaction is not null)
    {
      var transaction = plan.Transaction;
      _ = Execute(transaction, () => store.Dispatch(transaction));
      args.Handled = true;
    }
    // Null-transaction plans (passthrough-tab, table-hook, document-boundary
    // merges) fall through to the native text box, whose text-changed
    // pipeline produces the same raw source transaction.
  }

  private void OnInputPreviewTextInput(object? sender, TextInputEventArgs args)
  {
    if (inputOwner is null || args.Text is not { Length: > 0 } inserted)
    {
      return;
    }
    if (pendingCompositionEnd ||
      nativeMachine.Phase is FsusMarkdownNativePhase.Composing or
        FsusMarkdownNativePhase.Committing or FsusMarkdownNativePhase.Aborted or
        FsusMarkdownNativePhase.Draining)
    {
      // The IME cleared the preedit and the commit text follows in the same
      // turn — unless the composition was aborted by a document switch, in
      // which case the late commit is orphaned and must be dropped.
      pendingCompositionEnd = false;
      if (nativeMachine.Phase is FsusMarkdownNativePhase.Aborted or FsusMarkdownNativePhase.Draining)
      {
        ApplyNativeEvent(FsusMarkdownNativeEventKind.CompositionEnd, inserted);
        ApplyNativeEvent(FsusMarkdownNativeEventKind.Input, inputType: "insertCompositionText");
        args.Handled = true;
        return;
      }
      var endPlan = ApplyNativeEvent(FsusMarkdownNativeEventKind.CompositionEnd, inserted);
      // Avalonia's TextBox selection can temporarily include the native
      // preedit span even though that span is not part of the source document.
      // The transaction must use the frozen source selection captured by the
      // store, otherwise a multi-code-unit preedit can index past store.Value.
      var caretStart = Math.Min(store.Selection.Start, store.Selection.End);
      var caretEnd = Math.Max(store.Selection.Start, store.Selection.End);
      var postValue = store.Value[..caretStart] + inserted + store.Value[caretEnd..];
      var postSelection = new FsusMarkdownEditorSelection(
        caretStart + inserted.Length,
        caretStart + inserted.Length);
      ApplyNativeEvent(
        FsusMarkdownNativeEventKind.Input, inserted, "insertCompositionText",
        value: postValue, selection: postSelection);
      if (endPlan.Action is FsusMarkdownNativeAction.Commit or FsusMarkdownNativeAction.Ignore &&
        !IsReadOnly &&
        Mode != FsusMarkdownEditorMode.Preview)
      {
        var transaction = new FsusMarkdownEditorTransaction(
          [new(caretStart, caretEnd, inserted)],
          History: "separate",
          Origin: "input",
          Selection: postSelection,
          DocumentIdentity: store.Identity);
        _ = Execute(transaction, () => store.Dispatch(transaction));
      }
      args.Handled = true;
      return;
    }
    if (nativeMachine.FreezeSmartInput || Mode == FsusMarkdownEditorMode.Preview || IsReadOnly)
    {
      return;
    }
    var pairPlan = FsusMarkdownEditorPairInput.Resolve(new FsusMarkdownPairInputContext(
      Source: store.Value,
      Selection: store.Selection,
      Inserted: inserted,
      Composing: false,
      Readonly: IsReadOnly,
      Mode: ModeString()));
    if (pairPlan.Rejected is not null)
    {
      args.Handled = true;
      return;
    }
    if (pairPlan.Transaction is not null)
    {
      var transaction = pairPlan.Transaction;
      _ = Execute(transaction, () => store.Dispatch(transaction));
      args.Handled = true;
    }
    // Null-transaction plans pass through to the native insertion, whose
    // text-changed pipeline dispatches the raw source transaction.
  }

  private async Task HandlePasteAsync(string origin) =>
    await HandlePasteCoreAsync(origin);

  internal async Task HandlePasteCoreAsync(string origin)
  {
    var topLevel = TopLevel.GetTopLevel(this);
    if (topLevel?.Clipboard is null)
    {
      return;
    }
    await HandlePasteCoreAsync(
      origin,
      async () => await topLevel.Clipboard.TryGetDataAsync());
  }

  internal async Task HandlePasteCoreAsync(
    string origin,
    Func<Task<IAsyncDataTransfer?>> readClipboardAsync)
  {
    var snapshot = new FsusMarkdownPasteSnapshot(
      store.Value,
      store.Selection,
      store.Revision,
      store.Identity);
    var dataTransfer = await readClipboardAsync();
    if (dataTransfer is null)
    {
      return;
    }
    using (dataTransfer)
    {
      await ReadPastePayloadAsync(dataTransfer, origin, snapshot);
    }
  }

  private async Task ReadPastePayloadAsync(
    IAsyncDataTransfer dataTransfer,
    string origin,
    FsusMarkdownPasteSnapshot snapshot)
  {
    var markdownFormat = DataFormat.CreateStringPlatformFormat("text/markdown");
    var htmlFormat = DataFormat.CreateStringPlatformFormat("text/html");
    FsusMarkdownClipboardItem? markdownItem = null;
    FsusMarkdownClipboardItem? htmlItem = null;
    FsusMarkdownClipboardItem? plainItem = null;
    var files = new List<FsusMarkdownClipboardFileRef>();
    foreach (var item in dataTransfer.Items)
    {
      if (item.Contains(DataFormat.File))
      {
        var file = await item.TryGetFileAsync();
        if (file is not null)
        {
          files.Add(new FsusMarkdownClipboardFileRef(
            file.Name,
            0,
            Path.GetExtension(file.Name).TrimStart('.')));
        }
      }
      if (markdownItem is null && item.Contains(markdownFormat))
      {
        markdownItem = new FsusMarkdownClipboardItem(
          "text/markdown",
          await item.TryGetValueAsync(markdownFormat));
      }
      if (htmlItem is null && item.Contains(htmlFormat))
      {
        htmlItem = new FsusMarkdownClipboardItem(
          "text/html",
          await item.TryGetValueAsync(htmlFormat));
      }
      if (plainItem is null && item.Contains(DataFormat.Text))
      {
        plainItem = new FsusMarkdownClipboardItem(
          "text/plain",
          await item.TryGetTextAsync());
      }
    }
    var items = new List<FsusMarkdownClipboardItem>(3);
    if (markdownItem is not null)
    {
      items.Add(markdownItem);
    }
    if (htmlItem is not null)
    {
      items.Add(htmlItem);
    }
    if (plainItem is not null)
    {
      items.Add(plainItem);
    }
    if (items.Count == 0 && files.Count == 0)
    {
      return;
    }
    if (snapshot.Selection != store.Selection)
    {
      return;
    }
    var plan = FsusMarkdownEditorClipboardInput.Resolve(new FsusMarkdownClipboardPasteContext(
      Source: snapshot.Source,
      Selection: snapshot.Selection,
      Items: items,
      Files: files,
      Origin: origin,
      Composing: nativeMachine.FreezeSmartInput,
      Readonly: IsReadOnly,
      Disabled: !IsEnabled,
      Mode: Mode,
      Revision: store.Revision,
      ExpectedRevision: snapshot.Revision,
      CurrentIdentity: store.Identity,
      DocumentIdentity: snapshot.DocumentIdentity));
    ApplyNativeEvent(
      origin == "drop" ? FsusMarkdownNativeEventKind.Drop : FsusMarkdownNativeEventKind.Paste,
      clipboardIdentity: plan.Identity, origin: origin);
    if (plan.Rejected is not null || plan.Transaction is null)
    {
      return;
    }
    var transaction = plan.Transaction;
    var previousValue = store.Value;
    var result = Execute(transaction, () => store.Dispatch(transaction));
    if (result.Accepted)
    {
      ApplyNativeEvent(
        FsusMarkdownNativeEventKind.Input,
        plan.Insert,
        origin == "drop" ? "insertFromDrop" : "insertFromPaste",
        value: result.Value, previousValue: previousValue,
        revision: result.Revision, selection: result.Selection, origin: origin);
    }
  }

  private static string? MapBlockInputKey(Key key, KeyModifiers modifiers) => key switch
  {
    Key.Enter => modifiers.HasFlag(KeyModifiers.Shift) ? "shift-enter" : "enter",
    Key.Back => "backspace",
    Key.Delete => "delete",
    Key.Tab => modifiers.HasFlag(KeyModifiers.Shift) ? "shift-tab" : "tab",
    _ => null,
  };

  private IReadOnlyList<FsusMarkdownBlockInputNode> CurrentBlockInputNodes()
  {
    var snapshot = projection.Snapshot;
    if (snapshot is null)
    {
      return [];
    }
    var nodes = new List<FsusMarkdownBlockInputNode>(snapshot.Spans.Count);
    foreach (var span in snapshot.Spans)
    {
      if (span.SemanticKind is not null)
      {
        nodes.Add(new FsusMarkdownBlockInputNode(
          span.NodeId,
          span.SemanticKind,
          span.SourceRange.Start,
          span.SourceRange.End));
      }
    }
    return nodes;
  }

  private string ModeString() => Mode switch
  {
    FsusMarkdownEditorMode.Source => "source",
    FsusMarkdownEditorMode.Live => "live",
    FsusMarkdownEditorMode.Split => "split",
    _ => "preview",
  };

  /// <summary>
  /// Structured trace of the shared native input event machine for the Linux
  /// IME evidence harness. The trace entries and plans are byte-identical to
  /// the Web machine's output for identical event sequences.
  /// </summary>
  public IReadOnlyList<FsusMarkdownNativeTraceEntry> NativeTrace => nativeMachine.Trace;

  public string NativePhase => FsusMarkdownNativeEventMachine.PhaseToken(nativeMachine.Phase);

  /// <summary>
  /// Candidate-window anchor reported by the native text-input owner, in the
  /// coordinate space of <see cref="NativeCandidateCaretVisual"/>. Avalonia's
  /// platform IME transforms this rectangle through the current window scale
  /// and viewport offset; FsusUI never computes a parallel caret position.
  /// </summary>
  internal Rect NativeCandidateCaretRect => imeClient?.CursorRectangle ?? default;

  /// <summary>
  /// Visual that owns <see cref="NativeCandidateCaretRect"/>. Harnesses use
  /// this with Avalonia's visual transform to verify DPI and scrolled viewport
  /// placement without replacing the platform text-input client.
  /// </summary>
  internal Visual? NativeCandidateCaretVisual => imeClient?.TextViewVisual;

  internal Task<Exception?> PendingAtomicCopy { get; private set; } =
    Task.FromResult<Exception?>(null);

  internal static async Task<Exception?> TrySetAtomicClipboardTextAsync(
    Func<string, Task>? writeTextAsync,
    string text)
  {
    if (writeTextAsync is null)
    {
      return null;
    }
    try
    {
      await writeTextAsync(text);
      return null;
    }
    catch (Exception exception)
    {
      return exception;
    }
  }

  /// <summary>
  /// Provenance of the captured native input evidence. The default marks
  /// headless runs as synthetic; only the real Linux IME harness (X11/ibus or
  /// Wayland text-input) may overwrite it, and alignment evidence produced
  /// from synthetic runs must never be presented as real IME evidence.
  /// </summary>
  public string NativeInputProvenance { get; set; } = "headless-synthetic";

  internal FsusMarkdownEditorTransactionStore Store => store;

  private void OnInputPointerPressed(object? sender, PointerPressedEventArgs args)
  {
    NotifyWritingAidsInteraction(FsusMarkdownWritingAidsInteraction.SelectionDragStart);
    if (Mode != FsusMarkdownEditorMode.Live ||
      projectionView is null ||
      inputOwner is null)
    {
      return;
    }
    var sourceOffset = projectionView.HitTestSource(args.GetPosition(projectionView));
    livePointerAnchor = sourceOffset;
    args.Pointer.Capture(inputOwner);
    SetNativeSelection(new(sourceOffset, sourceOffset));
    args.Handled = true;
  }

  private void OnInputPointerMoved(object? sender, PointerEventArgs args)
  {
    if (Mode != FsusMarkdownEditorMode.Live ||
      livePointerAnchor is not int anchor ||
      projectionView is null ||
      inputOwner is null ||
      !args.GetCurrentPoint(inputOwner).Properties.IsLeftButtonPressed)
    {
      return;
    }
    var sourceOffset = projectionView.HitTestSource(args.GetPosition(projectionView));
    SetNativeSelection(new(
      Math.Min(anchor, sourceOffset),
      Math.Max(anchor, sourceOffset),
      sourceOffset < anchor ? "backward" : sourceOffset > anchor ? "forward" : "none"));
    args.Handled = true;
  }

  private void OnInputPointerReleased(object? sender, PointerReleasedEventArgs args)
  {
    if (livePointerAnchor is not null)
    {
      livePointerAnchor = null;
      args.Pointer.Capture(null);
      args.Handled = true;
      NotifyWritingAidsInteraction(FsusMarkdownWritingAidsInteraction.SelectionDragEnd);
      return;
    }
    OnInputSelectionChanged(sender, args);
    NotifyWritingAidsInteraction(FsusMarkdownWritingAidsInteraction.SelectionDragEnd);
  }

  private void OnInputPointerWheelChanged(object? sender, PointerWheelEventArgs args)
  {
    NotifyWritingAidsInteraction(FsusMarkdownWritingAidsInteraction.UserScroll);
  }

  private void SetNativeSelection(FsusMarkdownEditorSelection selection)
  {
    if (inputOwner is null)
    {
      return;
    }
    synchronizingInput = true;
    try
    {
      inputOwner.SelectionStart = selection.Start;
      inputOwner.SelectionEnd = selection.End;
    }
    finally
    {
      synchronizingInput = false;
    }
    var previous = store.Selection;
    if (store.SetSelection(selection) && store.Selection != previous)
    {
      SelectionChange?.Invoke(this, new(store.Revision, store.Selection));
      RequestWritingAidsSnapshot();
    }
    UpdateProjectionSelection();
  }

  private void UpdateProjectionSelection()
  {
    if (projectionView is null)
    {
      return;
    }
    var live = Mode == FsusMarkdownEditorMode.Live;
    projectionView.Update(
      live && projection.Snapshot is not null
        ? projection.DisplayText
        : store.Value,
      live && projection.Map is not null
        ? projection.Map
        : sourceProjectionMap,
      store.Selection,
      live ? projection.Snapshot?.Spans : null);
    UpdateAdjacentPresentation();
  }

  private FsusMarkdownEditorTransaction OperationTransaction(string operation) =>
    new(
      [],
      History: "skip",
      Origin: "command",
      DocumentIdentity: store.Identity,
      Metadata: new Dictionary<string, object?> { ["action"] = operation });
}
