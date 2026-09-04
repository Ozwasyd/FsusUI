using Avalonia;
using Avalonia.Automation;
using Avalonia.Automation.Peers;
using Avalonia.Automation.Provider;
using Avalonia.Controls;
using Avalonia.Controls.Primitives;
using Avalonia.Controls.Presenters;
using Avalonia.Input;
using Avalonia.Input.TextInput;
using Avalonia.Interactivity;
using Avalonia.Media;
using Avalonia.Threading;

namespace FsusUI.Avalonia.Controls;

public enum FsusMarkdownEditorMode
{
  Source,
  Live,
  Split,
  Preview,
}

public enum FsusMarkdownEditorChrome
{
  Framed,
  Embedded,
  Minimal,
}

public enum FsusMarkdownEditorStatusDensity
{
  None,
  Minimal,
  Detailed,
}

public sealed record FsusMarkdownDocumentIdentity(string Id, int Epoch);

public class FsusMarkdownEditor : TemplatedControl
{
  public static readonly StyledProperty<string> DocumentProperty =
    AvaloniaProperty.Register<FsusMarkdownEditor, string>(nameof(Document), string.Empty);

  public static readonly StyledProperty<FsusMarkdownDocumentIdentity?> DocumentIdentityProperty =
    AvaloniaProperty.Register<FsusMarkdownEditor, FsusMarkdownDocumentIdentity?>(nameof(DocumentIdentity));

  public static readonly StyledProperty<FsusMarkdownEditorMode> ModeProperty =
    AvaloniaProperty.Register<FsusMarkdownEditor, FsusMarkdownEditorMode>(
      nameof(Mode),
      FsusMarkdownEditorMode.Source);

  public static readonly StyledProperty<bool> IsReadOnlyProperty =
    AvaloniaProperty.Register<FsusMarkdownEditor, bool>(nameof(IsReadOnly));

  public static readonly StyledProperty<string> ProfileProperty =
    AvaloniaProperty.Register<FsusMarkdownEditor, string>(nameof(Profile), "markdown");

  public static readonly StyledProperty<FsusMarkdownEditorChrome> ChromeProperty =
    AvaloniaProperty.Register<FsusMarkdownEditor, FsusMarkdownEditorChrome>(
      nameof(Chrome),
      FsusMarkdownEditorChrome.Framed);

  public static readonly StyledProperty<string?> LocaleProperty =
    AvaloniaProperty.Register<FsusMarkdownEditor, string?>(nameof(Locale));

  public static readonly StyledProperty<FsusMarkdownEditorStatusDensity> StatusDensityProperty =
    AvaloniaProperty.Register<FsusMarkdownEditor, FsusMarkdownEditorStatusDensity>(
      nameof(StatusDensity),
      FsusMarkdownEditorStatusDensity.Minimal);

  public static readonly StyledProperty<string> CapabilityStateProperty =
    AvaloniaProperty.Register<FsusMarkdownEditor, string>(nameof(CapabilityState), "partial");

  public static readonly StyledProperty<long> ProjectionFeatureRevisionProperty =
    AvaloniaProperty.Register<FsusMarkdownEditor, long>(nameof(ProjectionFeatureRevision));

  /// <summary>
  /// Extra scrollable content floor below the editor surface, in DIPs. When
  /// greater than zero the content area stretches to at least viewport height
  /// plus this floor, so a short document still scrolls like an editor page.
  /// Zero keeps the plain extent of the content.
  /// </summary>
  public static readonly StyledProperty<double> ScrollContentFloorProperty =
    AvaloniaProperty.Register<FsusMarkdownEditor, double>(nameof(ScrollContentFloor));

  /// <summary>
  /// Maximum number of per-document histories retained while a host switches
  /// documents on one editor instance. The least recently used archive is
  /// evicted first; each archive obeys the same history budget as a live
  /// store.
  /// </summary>
  public const int MaxRetainedDocumentHistories = 8;

  private FsusMarkdownEditorTransactionStore store =
    new(new FsusMarkdownDocumentIdentity("doc", 0));
  private readonly Dictionary<FsusMarkdownDocumentIdentity, FsusMarkdownEditorHistorySnapshot> archivedHistories = new();
  private readonly List<FsusMarkdownDocumentIdentity> archivedHistoryOrder = [];
  private FsusMarkdownSourceCoordinateMap sourceCoordinates =
    FsusMarkdownSourceCoordinateMap.Create(string.Empty);
  private FsusMarkdownProjectionMap sourceProjectionMap =
    new(string.Empty, []);
  private readonly FsusMarkdownEditorProjectionState projection = new();
  private ContentPresenter? contentPresenter;
  private ScrollViewer? scrollViewer;
  private Grid? nativeSurface;
  internal TextBox? inputOwner;
  private FsusMarkdownEditorProjectionView? projectionView;
  private bool synchronizingDocument;
  private bool synchronizingInput;
  private double lastAppliedContentFloor = double.NaN;
  private string? lastProjectionRequestKey;
  private int? livePointerAnchor;
  private long scrollRestoreGeneration;
  private FsusMarkdownNativeEventMachine nativeMachine = new();
  private FsusMarkdownEditorTextInputMethodClient? imeClient;
  private bool pendingCompositionEnd;

  public FsusMarkdownEditor()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-markdown-editor");
    Focusable = true;
    SetCurrentValue(CapabilityStateProperty, "aligned");
    AutomationProperties.SetAccessibilityView(this, AccessibilityView.Control);
    AutomationProperties.SetControlTypeOverride(this, AutomationControlType.Edit);
    AutomationProperties.SetLiveSetting(this, AutomationLiveSetting.Off);
  }

  protected override AutomationPeer OnCreateAutomationPeer() =>
    new MarkdownEditorAutomationPeer(this);

  public FsusMarkdownEditorTransactionStore TransactionStore => store;

  public FsusMarkdownSourceCoordinateMap SourceCoordinateMap => sourceCoordinates;

  public FsusMarkdownProjectionMap? ProjectionMap => projection.Map;

  public IReadOnlyList<string> RetainedProjectionNodeIds => projection.RetainedNodeIds;

  public event EventHandler<FsusMarkdownEditorTransactionEventArgs>? Transaction;

  public event EventHandler<FsusMarkdownEditorSelectionChangedEventArgs>? SelectionChange;

  public event EventHandler<FsusMarkdownEditorHistoryChangedEventArgs>? HistoryChange;

  public event EventHandler<FsusMarkdownProjectionRequestedEventArgs>? ProjectionRequested;

  public FsusMarkdownProjectionCommitResult CommitProjection(
    FsusMarkdownProjectionSnapshot snapshot)
  {
    EnsureStore();
    var result = projection.Commit(
      snapshot,
      store.Identity,
      store.Revision,
      store.Value,
      ProjectionFeatureRevision);
    if (result.Accepted)
    {
      lastProjectionRequestKey = null;
      UpdateNativeSurface();
    }
    return result;
  }

  public FsusMarkdownEditorDispatchResult DispatchTransaction(
    FsusMarkdownEditorTransaction transaction)
  {
    EnsureStore();
    var bound = transaction.DocumentIdentity is null
      ? transaction with { DocumentIdentity = store.Identity }
      : transaction;
    return Execute(bound, () => store.Dispatch(bound));
  }

  public FsusMarkdownEditorDispatchResult Dispatch(FsusMarkdownEditorTransaction transaction)
  {
    return DispatchTransaction(transaction);
  }

  public FsusMarkdownEditorDispatchResult Undo()
  {
    EnsureStore();
    var transaction = OperationTransaction("undo");
    return Execute(transaction, store.Undo);
  }

  public FsusMarkdownEditorDispatchResult UndoDocument()
  {
    return Undo();
  }

  public FsusMarkdownEditorDispatchResult Redo()
  {
    EnsureStore();
    var transaction = OperationTransaction("redo");
    return Execute(transaction, store.Redo);
  }

  public FsusMarkdownEditorDispatchResult RedoDocument()
  {
    return Redo();
  }

  protected override void OnApplyTemplate(TemplateAppliedEventArgs e)
  {
    base.OnApplyTemplate(e);
    var previousPresenter = contentPresenter;
    var previousScrollViewer = scrollViewer;
    contentPresenter = e.NameScope.Find<ContentPresenter>("PART_Content");
    scrollViewer = e.NameScope.Find<ScrollViewer>("PART_Scroll");
    if (previousPresenter is not null &&
      previousPresenter != contentPresenter &&
      ReferenceEquals(previousPresenter.Content, nativeSurface))
    {
      previousPresenter.Content = null;
    }
    if (previousScrollViewer is not null && previousScrollViewer != scrollViewer)
    {
      previousScrollViewer.LayoutUpdated -= OnScrollLayoutUpdated;
    }
    if (scrollViewer is not null)
    {
      scrollViewer.LayoutUpdated -= OnScrollLayoutUpdated;
      scrollViewer.LayoutUpdated += OnScrollLayoutUpdated;
    }
    lastAppliedContentFloor = double.NaN;
    BuildNativeSurface();
    UpdateScrollContentFloor();
    UpdateNativeSurface();
  }

  protected override void OnPropertyChanged(AvaloniaPropertyChangedEventArgs change)
  {
    base.OnPropertyChanged(change);
    if (change.Property == DocumentIdentityProperty)
    {
      var identity = DocumentIdentity ?? new FsusMarkdownDocumentIdentity("doc", 0);
      SwitchStore(identity);
      sourceCoordinates = FsusMarkdownSourceCoordinateMap.Create(Document);
      sourceProjectionMap = new(Document, []);
      projection.Reset();
      lastProjectionRequestKey = null;
      UpdateNativeSurface();
    }
    else if (change.Property == DocumentProperty && !synchronizingDocument && store.Value != Document)
    {
      EnsureStore();
      var transaction = new FsusMarkdownEditorTransaction(
        [new FsusMarkdownEditorChange(0, store.Value.Length, Document)],
        History: "skip",
        Origin: "external",
        DocumentIdentity: store.Identity,
        ExternalUpdate: "reset");
      _ = Execute(transaction, () => store.Dispatch(transaction));
    }
    else if (change.Property == ModeProperty)
    {
      store.BreakMergeGroup();
      UpdateNativeSurface();
    }
    else if (change.Property == ProjectionFeatureRevisionProperty)
    {
      projection.Reset();
      lastProjectionRequestKey = null;
      UpdateNativeSurface();
    }
    else if (change.Property == ScrollContentFloorProperty)
    {
      lastAppliedContentFloor = double.NaN;
      UpdateScrollContentFloor();
    }
    else if (change.Property == IsReadOnlyProperty ||
      change.Property == ForegroundProperty ||
      change.Property == FontFamilyProperty ||
      change.Property == FontSizeProperty ||
      change.Property == FontStyleProperty ||
      change.Property == FontWeightProperty ||
      change.Property == FontStretchProperty)
    {
      UpdateNativeSurface();
    }
  }

  private void EnsureStore()
  {
    var identity = DocumentIdentity ?? new FsusMarkdownDocumentIdentity("doc", 0);
    if (!store.Identity.Equals(identity))
    {
      SwitchStore(identity);
      sourceCoordinates = FsusMarkdownSourceCoordinateMap.Create(Document);
      sourceProjectionMap = new(Document, []);
    }
  }

  /// <summary>
  /// Archives the current document history and swaps to the store for the
  /// requested identity, restoring an archived history when the incoming
  /// document content is unchanged since it was archived. A mismatched value
  /// drops the archived chain: stale undo entries must never act on a new
  /// external value.
  /// </summary>
  private void SwitchStore(FsusMarkdownDocumentIdentity identity)
  {
    if (store.History.UndoDepth > 0 || store.History.RedoDepth > 0)
    {
      archivedHistories[store.Identity] = store.CaptureHistory();
      archivedHistoryOrder.Remove(store.Identity);
      archivedHistoryOrder.Add(store.Identity);
      while (archivedHistoryOrder.Count > MaxRetainedDocumentHistories)
      {
        var evicted = archivedHistoryOrder[0];
        archivedHistoryOrder.RemoveAt(0);
        _ = archivedHistories.Remove(evicted);
      }
    }
    else
    {
      _ = archivedHistories.Remove(store.Identity);
      archivedHistoryOrder.Remove(store.Identity);
    }

    var next = new FsusMarkdownEditorTransactionStore(identity, Document);
    if (archivedHistories.TryGetValue(identity, out var snapshot) &&
      snapshot.Value == Document &&
      next.TryRestoreHistory(snapshot))
    {
      // Content-first host flow: the document value already matches the
      // archived one, so the history becomes live immediately.
      _ = archivedHistories.Remove(identity);
      archivedHistoryOrder.Remove(identity);
    }
    store = next;
    nativeMachine.Apply(new FsusMarkdownNativeEventInput
    {
      Kind = FsusMarkdownNativeEventKind.DocumentSwitch,
      DocumentIdentity = identity,
      CurrentIdentity = identity,
      Revision = store.Revision,
      Value = store.Value,
      Selection = store.Selection,
    });
    imeClient?.RequestImeReset();
  }

  private FsusMarkdownEditorDispatchResult Execute(
    FsusMarkdownEditorTransaction transaction,
    Func<FsusMarkdownEditorDispatchResult> operation)
  {
    var previousValue = store.Value;
    var previousSelection = store.Selection;
    var previousHistory = store.History;
    var result = operation();
    if (result.Accepted && transaction.Origin == "external" && transaction.ExternalUpdate == "reset")
    {
      // An external hard reset terminates the live undo chain. When the reset
      // re-presents the archived content of the same identity (host flow:
      // identity first, then document value), it is a document re-selection
      // and the archived history goes live; any other value is a genuine hard
      // reset and must also invalidate the archived chain for the identity.
      if (archivedHistories.TryGetValue(store.Identity, out var archived) &&
        archived.Value == result.Value &&
        store.TryRestoreHistory(archived))
      {
        _ = archivedHistories.Remove(store.Identity);
        archivedHistoryOrder.Remove(store.Identity);
      }
      else
      {
        _ = archivedHistories.Remove(store.Identity);
        archivedHistoryOrder.Remove(store.Identity);
      }
    }
    if (result.Accepted && result.Value != previousValue)
    {
      sourceCoordinates = FsusMarkdownSourceCoordinateMap.Create(result.Value);
      sourceProjectionMap = new(result.Value, []);
      if (transaction.Origin == "external" && transaction.ExternalUpdate == "reset")
      {
        projection.Reset();
      }
      else
      {
        projection.Advance(previousValue, result.Value, result.Revision, result.PositionMap);
      }
    }
    if (result.Accepted && result.Value != Document)
    {
      synchronizingDocument = true;
      try
      {
        SetValue(DocumentProperty, result.Value);
      }
      finally
      {
        synchronizingDocument = false;
      }
    }

    Transaction?.Invoke(this, new(transaction, result));
    if (result.Accepted && result.Selection != previousSelection)
    {
      SelectionChange?.Invoke(this, new(result.Revision, result.Selection));
    }
    if (result.Accepted && result.History != previousHistory)
    {
      HistoryChange?.Invoke(this, new(result.History));
    }
    if (result.Accepted)
    {
      UpdateNativeSurface();
    }
    return result;
  }

  private void BuildNativeSurface()
  {
    if (contentPresenter is null)
    {
      return;
    }
    if (inputOwner is not null &&
      projectionView is not null &&
      nativeSurface is not null)
    {
      contentPresenter.Content = nativeSurface;
      return;
    }

    inputOwner = new TextBox
    {
      AcceptsReturn = true,
      AcceptsTab = true,
      Background = Brushes.Transparent,
      BorderThickness = new Thickness(0),
      Padding = new Thickness(0),
      HorizontalAlignment = global::Avalonia.Layout.HorizontalAlignment.Stretch,
      VerticalAlignment = global::Avalonia.Layout.VerticalAlignment.Stretch,
      TextWrapping = TextWrapping.Wrap,
      IsUndoEnabled = false,
      UndoLimit = 0,
    };
    ScrollViewer.SetHorizontalScrollBarVisibility(
      inputOwner,
      ScrollBarVisibility.Disabled);
    ScrollViewer.SetVerticalScrollBarVisibility(
      inputOwner,
      ScrollBarVisibility.Disabled);
    projectionView = new FsusMarkdownEditorProjectionView
    {
      IsHitTestVisible = false,
      HorizontalAlignment = global::Avalonia.Layout.HorizontalAlignment.Stretch,
      VerticalAlignment = global::Avalonia.Layout.VerticalAlignment.Stretch,
    };
    inputOwner.TextChanged += OnInputTextChanged;
    inputOwner.KeyDown += OnInputKeyDown;
    inputOwner.KeyUp += OnInputSelectionChanged;
    inputOwner.PointerPressed += OnInputPointerPressed;
    inputOwner.PointerMoved += OnInputPointerMoved;
    inputOwner.PointerReleased += OnInputPointerReleased;
    this.AddHandler(
      InputElement.GotFocusEvent,
      OnSelfGotFocus,
      RoutingStrategies.Bubble);
    AddHandler(
      TextInputMethodClientRequestedEvent,
      OnInputMethodClientRequested,
      RoutingStrategies.Bubble,
      handledEventsToo: true);
    inputOwner.AddHandler(
      InputElement.KeyDownEvent,
      OnInputPreviewKeyDown,
      RoutingStrategies.Tunnel);
    inputOwner.AddHandler(
      InputElement.TextInputEvent,
      OnInputPreviewTextInput,
      RoutingStrategies.Tunnel);

    nativeSurface = new Grid();
    nativeSurface.Children.Add(inputOwner);
    nativeSurface.Children.Add(projectionView);
    FsusMarkdownProjectionArchitecture.EnsureSupported(
      nativeSurface.Children,
      projection);
    contentPresenter.Content = nativeSurface;
  }

  private void UpdateNativeSurface()
  {
    var sourceAnchor = CaptureViewportSourceAnchor();
    var preservedHorizontalOffset = scrollViewer?.Offset.X ?? 0;
    var capability = Mode switch
    {
      FsusMarkdownEditorMode.Source => "aligned",
      FsusMarkdownEditorMode.Live when !projection.RequiresRefresh => "aligned",
      FsusMarkdownEditorMode.Live => "source-fallback",
      _ => "partial",
    };
    if (CapabilityState != capability)
    {
      SetCurrentValue(CapabilityStateProperty, capability);
    }
    if (Mode != FsusMarkdownEditorMode.Preview && projection.RequiresRefresh)
    {
      var requestKey =
        $"{store.Identity.Id}\u001F{store.Identity.Epoch}\u001F{store.Revision}" +
        $"\u001F{ProjectionFeatureRevision}\u001F{store.Value}";
      if (!string.Equals(lastProjectionRequestKey, requestKey, StringComparison.Ordinal) &&
        !nativeMachine.FreezeSmartInput)
      {
        lastProjectionRequestKey = requestKey;
        ProjectionRequested?.Invoke(
          this,
          new(
            store.Identity,
            store.Revision,
            store.Value,
            ProjectionFeatureRevision,
            sourceCoordinates));
      }
    }

    if (inputOwner is null || projectionView is null)
    {
      return;
    }

    if (!nativeMachine.FreezeSmartInput)
    {
      synchronizingInput = true;
      try
      {
        inputOwner.Text = store.Value;
        inputOwner.SelectionStart = store.Selection.Start;
        inputOwner.SelectionEnd = store.Selection.End;
      }
      finally
      {
        synchronizingInput = false;
      }
    }

    inputOwner.IsReadOnly = IsReadOnly;
    inputOwner.FontFamily = FontFamily;
    inputOwner.FontSize = FontSize;
    inputOwner.FontStyle = FontStyle;
    inputOwner.FontWeight = FontWeight;
    inputOwner.FontStretch = FontStretch;
    projectionView.FontFamily = FontFamily;
    projectionView.FontSize = FontSize;
    projectionView.FontStyle = FontStyle;
    projectionView.FontWeight = FontWeight;
    projectionView.FontStretch = FontStretch;
    projectionView.Foreground = Foreground;

    var live = Mode == FsusMarkdownEditorMode.Live;
    var nativeProjectionMode =
      Mode is FsusMarkdownEditorMode.Source or FsusMarkdownEditorMode.Live;
    projectionView.IsVisible = nativeProjectionMode;
    inputOwner.Foreground = nativeProjectionMode ? Brushes.Transparent : Foreground;
    inputOwner.CaretBrush = nativeProjectionMode ? Brushes.Transparent : Foreground;
    inputOwner.SelectionBrush = nativeProjectionMode ? Brushes.Transparent : null;
    inputOwner.SelectionForegroundBrush = nativeProjectionMode ? Brushes.Transparent : null;
    inputOwner.Background = Brushes.Transparent;
    var presentationText =
      live && projection.Snapshot is not null
        ? projection.DisplayText
        : store.Value;
    var presentationMap =
      live && projection.Map is not null
        ? projection.Map
        : sourceProjectionMap;
    projectionView.Update(
      presentationText,
      presentationMap,
      store.Selection,
      live ? projection.Snapshot?.Spans : null);
    RestoreViewportSourceAnchor(sourceAnchor, preservedHorizontalOffset);
  }

  private void OnScrollLayoutUpdated(object? sender, EventArgs args)
  {
    UpdateScrollContentFloor();
  }

  private void UpdateScrollContentFloor()
  {
    if (contentPresenter is null || scrollViewer is null)
    {
      return;
    }
    if (ScrollContentFloor <= 0)
    {
      if (!double.IsNaN(lastAppliedContentFloor))
      {
        contentPresenter.MinHeight = double.NaN;
        lastAppliedContentFloor = double.NaN;
      }
      return;
    }
    var viewportHeight = scrollViewer.Viewport.Height;
    if (viewportHeight <= 0)
    {
      viewportHeight = scrollViewer.Bounds.Height;
    }
    if (viewportHeight <= 0)
    {
      return;
    }
    var floor = viewportHeight + ScrollContentFloor;
    if (double.IsNaN(lastAppliedContentFloor) ||
      Math.Abs(floor - lastAppliedContentFloor) > 0.5)
    {
      contentPresenter.MinHeight = floor;
      lastAppliedContentFloor = floor;
    }
  }

  /// <summary>
  /// Programmatic scroll position of the editor page. The setter applies the
  /// offset immediately when the template is applied and cancels pending
  /// viewport-anchor restores so host-driven scrolling and the internal
  /// anchor restore cooperate instead of fighting.
  /// </summary>
  public Vector ScrollPosition
  {
    get => scrollViewer?.Offset ?? default;
    set
    {
      if (scrollViewer is not null)
      {
        scrollRestoreGeneration++;
        scrollViewer.Offset = value;
      }
    }
  }

  public double ScrollViewportHeight => scrollViewer?.Viewport.Height ?? 0;

  public double ScrollExtentHeight => scrollViewer?.Extent.Height ?? 0;

  /// <summary>
  /// Scrolls the editor page so the first visual line containing the requested
  /// source offset sits at the viewport top. Returns false when the projection
  /// surface is not ready; the caller can retry after the projection commits.
  /// </summary>
  public bool ScrollToSourceLine(int sourceOffset)
  {
    if (projectionView is null || scrollViewer is null)
    {
      return false;
    }
    var top = projectionView.GetVisualLineTopForSource(sourceOffset);
    scrollRestoreGeneration++;
    scrollViewer.Offset = new Vector(scrollViewer.Offset.X, top);
    return true;
  }

  private int? CaptureViewportSourceAnchor()
  {
    if (projectionView is null || scrollViewer is null)
    {
      return null;
    }
    return projectionView.GetSourceLineAnchor(scrollViewer.Offset.Y);
  }

  private void RestoreViewportSourceAnchor(
    int? sourceAnchor,
    double horizontalOffset)
  {
    if (sourceAnchor is not int anchor ||
      projectionView is null ||
      scrollViewer is null)
    {
      return;
    }

    var expectedProjection = projectionView;
    var expectedScroll = scrollViewer;
    var boundedAnchor = Math.Clamp(anchor, 0, store.Value.Length);
    var generation = ++scrollRestoreGeneration;
    void Restore()
    {
      if (generation != scrollRestoreGeneration ||
        !ReferenceEquals(projectionView, expectedProjection) ||
        !ReferenceEquals(scrollViewer, expectedScroll))
      {
        return;
      }
      expectedScroll.Offset = new Vector(
        horizontalOffset,
        expectedProjection.GetVisualLineTopForSource(boundedAnchor));
    }

    Restore();
    Dispatcher.UIThread.Post(Restore);
  }

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
    var plan = nativeMachine.Apply(new FsusMarkdownNativeEventInput
    {
      Kind = FsusMarkdownNativeEventKind.Input,
      InputType = "insertText",
      Data = inserted,
      Value = next,
      PreviousValue = previous,
      Revision = store.Revision,
      Selection = selection,
      DocumentIdentity = store.Identity,
      CurrentIdentity = store.Identity,
    });
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
        ApplyNativeEvent(FsusMarkdownNativeEventKind.CompositionEnd, null);
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

  private void ApplyNativeEvent(FsusMarkdownNativeEventKind kind, string? data)
  {
    nativeMachine.Apply(new FsusMarkdownNativeEventInput
    {
      Kind = kind,
      Data = data,
      Value = store.Value,
      PreviousValue = store.Value,
      Revision = store.Revision,
      Selection = store.Selection,
      DocumentIdentity = store.Identity,
      CurrentIdentity = store.Identity,
    });
  }

  private void FlushPendingCompositionEnd()
  {
    if (!pendingCompositionEnd)
    {
      return;
    }
    pendingCompositionEnd = false;
    if (nativeMachine.Composing)
    {
      ApplyNativeEvent(FsusMarkdownNativeEventKind.CompositionEnd, null);
    }
    if (nativeMachine.Phase == FsusMarkdownNativePhase.Committing)
    {
      _ = nativeMachine.Apply(new FsusMarkdownNativeEventInput
      {
        Kind = FsusMarkdownNativeEventKind.Input,
        InputType = "insertCompositionText",
        Value = store.Value,
        PreviousValue = store.Value,
        Revision = store.Revision,
        Selection = store.Selection,
        DocumentIdentity = store.Identity,
        CurrentIdentity = store.Identity,
      });
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
        nativeMachine.Apply(new FsusMarkdownNativeEventInput
        {
          Kind = FsusMarkdownNativeEventKind.CompositionEnd,
          Data = inserted,
          Value = store.Value,
          PreviousValue = store.Value,
          Revision = store.Revision,
          Selection = store.Selection,
          DocumentIdentity = store.Identity,
          CurrentIdentity = store.Identity,
        });
        _ = nativeMachine.Apply(new FsusMarkdownNativeEventInput
        {
          Kind = FsusMarkdownNativeEventKind.Input,
          InputType = "insertCompositionText",
          Value = store.Value,
          PreviousValue = store.Value,
          Revision = store.Revision,
          Selection = store.Selection,
          DocumentIdentity = store.Identity,
          CurrentIdentity = store.Identity,
        });
        args.Handled = true;
        return;
      }
      var endPlan = nativeMachine.Apply(new FsusMarkdownNativeEventInput
      {
        Kind = FsusMarkdownNativeEventKind.CompositionEnd,
        Data = inserted,
        Value = store.Value,
        PreviousValue = store.Value,
        Revision = store.Revision,
        Selection = store.Selection,
        DocumentIdentity = store.Identity,
        CurrentIdentity = store.Identity,
      });
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
      _ = nativeMachine.Apply(new FsusMarkdownNativeEventInput
      {
        Kind = FsusMarkdownNativeEventKind.Input,
        InputType = "insertCompositionText",
        Data = inserted,
        Value = postValue,
        PreviousValue = store.Value,
        Revision = store.Revision,
        Selection = postSelection,
        DocumentIdentity = store.Identity,
        CurrentIdentity = store.Identity,
      });
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
    var dataTransfer = await topLevel.Clipboard.TryGetDataAsync();
    if (dataTransfer is null)
    {
      return;
    }
    using (dataTransfer)
    {
      await ReadPastePayloadAsync(dataTransfer, origin);
    }
  }

  private async Task ReadPastePayloadAsync(IAsyncDataTransfer dataTransfer, string origin)
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
    var plan = FsusMarkdownEditorClipboardInput.Resolve(new FsusMarkdownClipboardPasteContext(
      Source: store.Value,
      Selection: store.Selection,
      Items: items,
      Files: files,
      Origin: origin,
      Composing: nativeMachine.FreezeSmartInput,
      Readonly: IsReadOnly,
      Disabled: !IsEnabled,
      Mode: Mode,
      Revision: store.Revision,
      CurrentIdentity: store.Identity));
    nativeMachine.Apply(new FsusMarkdownNativeEventInput
    {
      Kind = origin == "drop" ? FsusMarkdownNativeEventKind.Drop : FsusMarkdownNativeEventKind.Paste,
      ClipboardIdentity = plan.Identity,
      Origin = origin,
      Value = store.Value,
      PreviousValue = store.Value,
      Revision = store.Revision,
      Selection = store.Selection,
      DocumentIdentity = store.Identity,
      CurrentIdentity = store.Identity,
    });
    if (plan.Rejected is not null || plan.Transaction is null)
    {
      return;
    }
    var transaction = plan.Transaction;
    var previousValue = store.Value;
    var result = Execute(transaction, () => store.Dispatch(transaction));
    if (result.Accepted)
    {
      nativeMachine.Apply(new FsusMarkdownNativeEventInput
      {
        Kind = FsusMarkdownNativeEventKind.Input,
        InputType = origin == "drop" ? "insertFromDrop" : "insertFromPaste",
        Data = plan.Insert,
        Value = result.Value,
        PreviousValue = previousValue,
        Revision = result.Revision,
        Selection = result.Selection,
        Origin = origin,
        DocumentIdentity = store.Identity,
        CurrentIdentity = store.Identity,
      });
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
      return;
    }
    OnInputSelectionChanged(sender, args);
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
  }

  private FsusMarkdownEditorTransaction OperationTransaction(string operation) =>
    new(
      [],
      History: "skip",
      Origin: "command",
      DocumentIdentity: store.Identity,
      Metadata: new Dictionary<string, object?> { ["action"] = operation });

  public string Document
  {
    get => GetValue(DocumentProperty);
    set => SetValue(DocumentProperty, value);
  }

  public FsusMarkdownDocumentIdentity? DocumentIdentity
  {
    get => GetValue(DocumentIdentityProperty);
    set => SetValue(DocumentIdentityProperty, value);
  }

  public FsusMarkdownEditorMode Mode
  {
    get => GetValue(ModeProperty);
    set => SetValue(ModeProperty, value);
  }

  public bool IsReadOnly
  {
    get => GetValue(IsReadOnlyProperty);
    set => SetValue(IsReadOnlyProperty, value);
  }

  public string Profile
  {
    get => GetValue(ProfileProperty);
    set => SetValue(ProfileProperty, value);
  }

  public FsusMarkdownEditorChrome Chrome
  {
    get => GetValue(ChromeProperty);
    set => SetValue(ChromeProperty, value);
  }

  public string? Locale
  {
    get => GetValue(LocaleProperty);
    set => SetValue(LocaleProperty, value);
  }

  public FsusMarkdownEditorStatusDensity StatusDensity
  {
    get => GetValue(StatusDensityProperty);
    set => SetValue(StatusDensityProperty, value);
  }

  public string CapabilityState
  {
    get => GetValue(CapabilityStateProperty);
    set => SetValue(CapabilityStateProperty, value);
  }

  public long ProjectionFeatureRevision
  {
    get => GetValue(ProjectionFeatureRevisionProperty);
    set => SetValue(ProjectionFeatureRevisionProperty, value);
  }

  public double ScrollContentFloor
  {
    get => GetValue(ScrollContentFloorProperty);
    set => SetValue(ScrollContentFloorProperty, value);
  }

  public bool TryRunCommand(string commandKey)
  {
    return !string.IsNullOrWhiteSpace(commandKey) && !IsReadOnly && IsEnabled;
  }

  private sealed class MarkdownEditorAutomationPeer(FsusMarkdownEditor owner)
    : ControlAutomationPeer(owner), IValueProvider
  {
    private FsusMarkdownEditor Editor => (FsusMarkdownEditor)Owner;

    public bool IsReadOnly => Editor.IsReadOnly;

    public string Value => Editor.Document;

    public void SetValue(string? value)
    {
      if (Editor.IsReadOnly || !Editor.IsEnabled)
      {
        throw new InvalidOperationException("The Markdown editor cannot accept edits.");
      }
      Editor.Document = value ?? string.Empty;
    }

    protected override IReadOnlyList<AutomationPeer>? GetChildrenCore()
    {
      var atomicSpans = Editor.projection.Snapshot?.Spans
        .Where(span => span.Kind == FsusMarkdownProjectionSpanKind.Atomic)
        .ToArray() ?? [];
      if (atomicSpans.Length == 0)
      {
        return null;
      }

      var peers = new List<AutomationPeer>(atomicSpans.Length * 3);
      foreach (var span in atomicSpans)
      {
        peers.Add(AtomicActionPeer(span, "enter-before", span.SourceRange.Start));
        peers.Add(AtomicActionPeer(span, "enter-after", span.SourceRange.End));
        peers.Add(AtomicActionPeer(span, "edit-source", span.SourceRange.Start));
      }
      return peers;
    }

    private AutomationPeer AtomicActionPeer(
      FsusMarkdownProjectionSpan span,
      string action,
      int sourceOffset)
    {
      var control = new AtomicActionControl(Editor, sourceOffset)
      {
        Focusable = false,
        IsHitTestVisible = false,
      };
      AutomationProperties.SetAccessibilityView(control, AccessibilityView.Control);
      AutomationProperties.SetControlTypeOverride(control, AutomationControlType.Button);
      AutomationProperties.SetName(
        control,
        $"{span.SemanticKind ?? "atomic"} {action}");
      AutomationProperties.SetHelpText(control, span.DisplayText);
      AutomationProperties.SetItemStatus(control, action);
      return new AtomicActionAutomationPeer(control, span.DisplayText);
    }
  }

  private sealed class AtomicActionControl(
    FsusMarkdownEditor editor,
    int sourceOffset) : Control
  {
    public void Invoke()
    {
      var previous = editor.store.Selection;
      var next = new FsusMarkdownEditorSelection(sourceOffset, sourceOffset);
      if (editor.store.SetSelection(next) && editor.store.Selection != previous)
      {
        editor.SelectionChange?.Invoke(editor, new(editor.store.Revision, editor.store.Selection));
        editor.UpdateProjectionSelection();
      }
      _ = editor.Focus();
    }
  }

  private sealed class AtomicActionAutomationPeer(
    AtomicActionControl owner,
    string value) : ControlAutomationPeer(owner), IInvokeProvider, IValueProvider
  {
    public bool IsReadOnly => true;

    public string Value => value;

    public void Invoke() => owner.Invoke();

    public void SetValue(string? value) =>
      throw new InvalidOperationException("Atomic Markdown actions are read-only.");
  }
}
