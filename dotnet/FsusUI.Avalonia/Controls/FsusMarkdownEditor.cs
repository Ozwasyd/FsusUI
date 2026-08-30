using Avalonia;
using Avalonia.Automation;
using Avalonia.Automation.Peers;
using Avalonia.Automation.Provider;
using Avalonia.Controls;
using Avalonia.Controls.Primitives;
using Avalonia.Controls.Presenters;
using Avalonia.Input;
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

  private FsusMarkdownEditorTransactionStore store =
    new(new FsusMarkdownDocumentIdentity("doc", 0));
  private FsusMarkdownSourceCoordinateMap sourceCoordinates =
    FsusMarkdownSourceCoordinateMap.Create(string.Empty);
  private FsusMarkdownProjectionMap sourceProjectionMap =
    new(string.Empty, []);
  private readonly FsusMarkdownEditorProjectionState projection = new();
  private ContentPresenter? contentPresenter;
  private ScrollViewer? scrollViewer;
  private Grid? nativeSurface;
  private TextBox? inputOwner;
  private FsusMarkdownEditorProjectionView? projectionView;
  private bool synchronizingDocument;
  private bool synchronizingInput;
  private string? lastProjectionRequestKey;
  private int? livePointerAnchor;
  private long scrollRestoreGeneration;

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
    contentPresenter = e.NameScope.Find<ContentPresenter>("PART_Content");
    scrollViewer = e.NameScope.Find<ScrollViewer>("PART_Scroll");
    if (previousPresenter is not null &&
      previousPresenter != contentPresenter &&
      ReferenceEquals(previousPresenter.Content, nativeSurface))
    {
      previousPresenter.Content = null;
    }
    BuildNativeSurface();
    UpdateNativeSurface();
  }

  protected override void OnPropertyChanged(AvaloniaPropertyChangedEventArgs change)
  {
    base.OnPropertyChanged(change);
    if (change.Property == DocumentIdentityProperty)
    {
      var identity = DocumentIdentity ?? new FsusMarkdownDocumentIdentity("doc", 0);
      store = new FsusMarkdownEditorTransactionStore(identity, Document);
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
      store = new FsusMarkdownEditorTransactionStore(identity, Document);
      sourceCoordinates = FsusMarkdownSourceCoordinateMap.Create(Document);
      sourceProjectionMap = new(Document, []);
    }
  }

  private FsusMarkdownEditorDispatchResult Execute(
    FsusMarkdownEditorTransaction transaction,
    Func<FsusMarkdownEditorDispatchResult> operation)
  {
    var previousValue = store.Value;
    var previousSelection = store.Selection;
    var previousHistory = store.History;
    var result = operation();
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
    if (Mode == FsusMarkdownEditorMode.Live && projection.RequiresRefresh)
    {
      var requestKey =
        $"{store.Identity.Id}\u001F{store.Identity.Epoch}\u001F{store.Revision}" +
        $"\u001F{ProjectionFeatureRevision}\u001F{store.Value}";
      if (!string.Equals(lastProjectionRequestKey, requestKey, StringComparison.Ordinal))
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
      store.Selection);
    RestoreViewportSourceAnchor(sourceAnchor, preservedHorizontalOffset);
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
        expectedProjection.GetVisualLineTopForSource(anchor));
    }

    Restore();
    Dispatcher.UIThread.Post(Restore);
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
    var prefix = 0;
    while (prefix < store.Value.Length &&
      prefix < next.Length &&
      store.Value[prefix] == next[prefix])
    {
      prefix += 1;
    }
    var oldSuffix = store.Value.Length;
    var newSuffix = next.Length;
    while (oldSuffix > prefix &&
      newSuffix > prefix &&
      store.Value[oldSuffix - 1] == next[newSuffix - 1])
    {
      oldSuffix -= 1;
      newSuffix -= 1;
    }
    var selection = new FsusMarkdownEditorSelection(
      inputOwner.SelectionStart,
      inputOwner.SelectionEnd);
    var transaction = new FsusMarkdownEditorTransaction(
      [new(prefix, oldSuffix, next[prefix..newSuffix])],
      History: "merge",
      Origin: "input",
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
      store.Selection);
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
  }
}
