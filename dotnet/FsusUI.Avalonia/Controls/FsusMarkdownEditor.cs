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

public partial class FsusMarkdownEditor : TemplatedControl
{
  private const int AutomationAtomicNodeBudget = 64;

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

  private sealed record FsusMarkdownPasteSnapshot(
    string Source,
    FsusMarkdownEditorSelection Selection,
    int Revision,
    FsusMarkdownDocumentIdentity DocumentIdentity);

  public FsusMarkdownEditor()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-markdown-editor");
    Focusable = true;
    SetCurrentValue(CapabilityStateProperty, "aligned");
    AutomationProperties.SetAccessibilityView(this, AccessibilityView.Control);
    AutomationProperties.SetControlTypeOverride(this, AutomationControlType.Edit);
    AutomationProperties.SetLiveSetting(this, AutomationLiveSetting.Off);
    AutomationProperties.SetName(this, "Markdown editor");
    SyncAutomationState();
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
      RequestWritingAidsSnapshot();
      InvalidateAutomationChildren();
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
      previousScrollViewer.ScrollChanged -= OnScrollChanged;
    }
    if (scrollViewer is not null)
    {
      scrollViewer.LayoutUpdated -= OnScrollLayoutUpdated;
      scrollViewer.LayoutUpdated += OnScrollLayoutUpdated;
      scrollViewer.ScrollChanged -= OnScrollChanged;
      scrollViewer.ScrollChanged += OnScrollChanged;
    }
    lastAppliedContentFloor = double.NaN;
    BuildNativeSurface();
    UpdateScrollContentFloor();
    UpdateNativeSurface();
    SyncAutomationState();
  }

  protected override void OnAttachedToVisualTree(VisualTreeAttachmentEventArgs e)
  {
    base.OnAttachedToVisualTree(e);
    if (contentPresenter is not null && nativeSurface is null)
    {
      BuildNativeSurface();
      UpdateNativeSurface();
    }
  }

  protected override void OnDetachedFromVisualTree(VisualTreeAttachmentEventArgs e)
  {
    ReleaseNativeSurface();
    base.OnDetachedFromVisualTree(e);
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
      ResetAdjacentState(preserveSearchQuery: false);
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
      RequestWritingAidsSnapshot();
    }
    else if (change.Property == ProjectionFeatureRevisionProperty)
    {
      projection.Reset();
      lastProjectionRequestKey = null;
      writingAidsSnapshot = null;
      UpdateNativeSurface();
    }
    else if (change.Property == ScrollContentFloorProperty)
    {
      lastAppliedContentFloor = double.NaN;
      UpdateScrollContentFloor();
    }
    else if (change.Property == FocusWritingAidEnabledProperty ||
      change.Property == TypewriterWritingAidEnabledProperty ||
      change.Property == TypewriterAnchorProperty ||
      change.Property == ProfileProperty)
    {
      UpdateAdjacentPresentation();
      RequestWritingAidsSnapshot();
    }
    else if (change.Property == IsReadOnlyProperty ||
      change.Property == IsEnabledProperty ||
      change.Property == ForegroundProperty ||
      change.Property == FontFamilyProperty ||
      change.Property == FontSizeProperty ||
      change.Property == FontStyleProperty ||
      change.Property == FontWeightProperty ||
      change.Property == FontStretchProperty)
    {
      UpdateNativeSurface();
    }
    SyncAutomationState();
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
      RefreshAdjacentStateAfterTransaction();
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
      SyncAutomationState();
      InvalidateAutomationChildren();
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
    inputOwner.PointerWheelChanged += OnInputPointerWheelChanged;

    nativeSurface = new Grid();
    nativeSurface.Children.Add(inputOwner);
    nativeSurface.Children.Add(projectionView);
    FsusMarkdownProjectionArchitecture.EnsureSupported(
      nativeSurface.Children,
      projection);
    contentPresenter.Content = nativeSurface;
    UpdateInputOwnerViewport();
  }

  private void UpdateInputOwnerViewport()
  {
    if (inputOwner is null || projectionView is null)
    {
      return;
    }
    var diagnostics = projectionView.ViewportDiagnostics;
    if (!diagnostics.IsVirtualized)
    {
      inputOwner.Height = double.NaN;
      return;
    }
    var viewport = scrollViewer?.Viewport.Height ?? Bounds.Height;
    inputOwner.Height = Math.Max(FontSize * 1.5, viewport);
    inputOwner.VerticalAlignment =
      global::Avalonia.Layout.VerticalAlignment.Top;
  }

  private void ReleaseNativeSurface()
  {
    if (scrollViewer is not null)
    {
      scrollViewer.LayoutUpdated -= OnScrollLayoutUpdated;
      scrollViewer.ScrollChanged -= OnScrollChanged;
    }
    if (inputOwner is not null)
    {
      inputOwner.TextChanged -= OnInputTextChanged;
      inputOwner.KeyDown -= OnInputKeyDown;
      inputOwner.KeyUp -= OnInputSelectionChanged;
      inputOwner.PointerPressed -= OnInputPointerPressed;
      inputOwner.PointerMoved -= OnInputPointerMoved;
      inputOwner.PointerReleased -= OnInputPointerReleased;
      inputOwner.PointerWheelChanged -= OnInputPointerWheelChanged;
    }
    projectionView?.ReleaseRetainedState();
    if (contentPresenter is not null &&
      ReferenceEquals(contentPresenter.Content, nativeSurface))
    {
      contentPresenter.Content = null;
    }
    inputOwner = null;
    projectionView = null;
    nativeSurface = null;
  }

  private void SyncAutomationState()
  {
    var selection = store.Selection;
    var state = string.Join(
      "; ",
      $"mode={Mode.ToString().ToLowerInvariant()}",
      $"capability={CapabilityState}",
      $"selection={selection.Start}:{selection.End}",
      $"caret={selection.End}",
      IsReadOnly ? "readonly=true" : "readonly=false",
      IsEnabled ? "disabled=false" : "disabled=true",
      DataValidationErrors.GetHasErrors(this) ? "invalid=true" : "invalid=false",
      "multiline=true");
    AutomationProperties.SetItemStatus(this, state);
    AutomationProperties.SetHelpText(
      this,
      IsReadOnly
        ? "Read-only multi-line Markdown text."
        : "Editable multi-line Markdown text.");
  }

  private void InvalidateAutomationChildren()
  {
    if (ControlAutomationPeer.FromElement(this) is MarkdownEditorAutomationPeer peer)
    {
      peer.RefreshChildren();
    }
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
    projectionView.UpdateViewport(
      scrollViewer?.Offset.Y ?? 0,
      scrollViewer?.Viewport.Height ?? Bounds.Height);
    UpdateInputOwnerViewport();
    UpdateAdjacentPresentation();
    RestoreViewportSourceAnchor(sourceAnchor, preservedHorizontalOffset);
    SyncAutomationState();
  }

  private void OnScrollLayoutUpdated(object? sender, EventArgs args)
  {
    UpdateScrollContentFloor();
    projectionView?.UpdateViewport(
      scrollViewer?.Offset.Y ?? 0,
      scrollViewer?.Viewport.Height ?? Bounds.Height);
    UpdateInputOwnerViewport();
    InvalidateAutomationChildren();
  }

  private void OnScrollChanged(object? sender, ScrollChangedEventArgs args) =>
    OnScrollLayoutUpdated(sender, args);

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
}
