using Avalonia;
using Avalonia.Automation;
using Avalonia.Automation.Peers;
using Avalonia.Controls;
using Avalonia.Controls.Templates;
using Avalonia.Input;
using Avalonia.Interactivity;
using Avalonia.Threading;
using Avalonia.VisualTree;
using FsusUI.Avalonia.Overlay;
using System.Collections.ObjectModel;
using System.Globalization;

namespace FsusUI.Avalonia.Controls;

public partial class FsusTree : ContentControl
{
  private readonly List<FsusTreeNodeView> flattenedNodes = [];
  private readonly HashSet<string> expandedKeys = new(StringComparer.Ordinal);
  private readonly HashSet<string> selectedKeys = new(StringComparer.Ordinal);
  private readonly HashSet<string> checkedKeys = new(StringComparer.Ordinal);
  private readonly EventHandler nodePresentationHandler;
  private readonly HashSet<FsusTreeNode> presentationSubscriptions = [];
  private readonly HashSet<FsusTreeNode> currentPresentationNodes = [];
  private readonly List<FsusTreeNode> removedPresentationNodes = [];
  private readonly Dictionary<string, Border> renderedRows = new(StringComparer.Ordinal);
  private readonly Dictionary<string, FsusTreeLazyLoadState> lazyLoadStates = new(StringComparer.Ordinal);
  private readonly StackPanel rowsPanel = new();
  private readonly ObservableCollection<Control> virtualRows = [];
  private FsusTreeViewportItems? viewportItems;
  private bool usingViewport;
  private bool boundedViewport;
  private bool requireLegacyRowGeometry;
  private bool fullEffectiveViewport;
  private bool viewportDetached;
  private int detachVersion;
  private Size? lastAvailableSize;
  private ViewportAncestorStamp[] verifiedAncestors = [];
  private sealed record ViewportAncestorStamp(Visual Visual, Rect Bounds, object? Clip,
    bool ClipToBounds, Matrix Transform, RelativePoint Origin, double Width, double Height,
    double MinWidth, double MinHeight, double MaxWidth, double MaxHeight, Thickness Margin);
  // Read geometry without creating or applying a transform.
  private static Matrix ReadVisualTransform(Visual visual) =>
    visual.GetValue(Visual.RenderTransformProperty)?.Value ?? Matrix.Identity;
  private ViewportAncestorStamp[] CaptureAncestorStamp() => this.GetVisualAncestors().Select(v =>
  {
    var l = v as global::Avalonia.Layout.Layoutable;
    return new ViewportAncestorStamp(v, v.Bounds, v.Clip, v.ClipToBounds,
      ReadVisualTransform(v), v.RenderTransformOrigin,
      l?.Width ?? double.NaN, l?.Height ?? double.NaN,
      l?.MinWidth ?? 0, l?.MinHeight ?? 0, l?.MaxWidth ?? double.PositiveInfinity,
      l?.MaxHeight ?? double.PositiveInfinity, l?.Margin ?? default);
  }).ToArray();
  private bool HasSimpleViewportGeometry() => this.GetVisualAncestors().Prepend(this).All(v =>
    v.Clip is null && ReadVisualTransform(v) == Matrix.Identity);
  // A same-turn remount can retain the viewport proof only when the current
  // ancestry and clipping still contain the full control.
  private bool RevalidateTranslatedAncestorStamp()
  {
    var current = CaptureAncestorStamp();
    if (!fullEffectiveViewport || !boundedViewport || current.Length == 0 || current.Length != verifiedAncestors.Length ||
        Clip is not null || ReadVisualTransform(this) != Matrix.Identity) return false;
    for (var i = 0; i < current.Length; i++)
    {
      var old = verifiedAncestors[i]; var next = current[i];
      if (old.Bounds.Size != next.Bounds.Size || old with { Bounds = next.Bounds } != next ||
          next.Clip is not null || next.Transform != Matrix.Identity || next.Visual is ScrollViewer) return false;
    }
    var transformed = this.GetTransformedBounds();
    if (transformed is not { } actual || Bounds.Width <= 0 || Bounds.Height <= 0 ||
        !actual.Clip.Inflate(0.001).Contains(actual.Bounds.TransformToAABB(actual.Transform))) return false;
    verifiedAncestors = current;
    return true;
  }
  private Rect lastEffectiveViewport;
  private bool viewportCheckQueued;
  private void QueueViewportCheck()
  {
    if (viewportCheckQueued) return;
    viewportCheckQueued = true;
    Dispatcher.UIThread.Post(() =>
    {
      viewportCheckQueued = false;
      if (TopLevel.GetTopLevel(this) is null) return;
      var own = new Rect(Bounds.Size);
      var contains = ClipToBounds && HasSimpleViewportGeometry() && own.Width > 0 && own.Height > 0 &&
        lastEffectiveViewport.Inflate(0.001).Contains(own);
      if (contains) verifiedAncestors = CaptureAncestorStamp();
      if (contains == fullEffectiveViewport) return;
      fullEffectiveViewport = contains;
      RefreshRows(); InvalidateMeasure();
    }, DispatcherPriority.Render);
  }
  protected override Size MeasureOverride(Size availableSize)
  {
    if (lastAvailableSize is { } previousSize && previousSize != availableSize)
    {
      fullEffectiveViewport = false;
      RefreshRows();
      QueueViewportCheck();
    }
    lastAvailableSize = availableSize;
    var bounded = double.IsFinite(availableSize.Width) && availableSize.Width > 0 &&
      HorizontalAlignment == global::Avalonia.Layout.HorizontalAlignment.Stretch &&
      double.IsFinite(availableSize.Height) && availableSize.Height > 0 &&
      !this.GetVisualAncestors().Any(x => x is ScrollViewer);
    if (bounded != boundedViewport) { boundedViewport = bounded; RefreshRows(); }
    return base.MeasureOverride(availableSize);
  }
  private IList<Control> RowChildren => usingViewport ? virtualRows : rowsPanel.Children;

  private void SelectRowHost()
  {
    if (!ReferenceEquals(Content, rowsPanel) &&
        (viewportItems is null || !ReferenceEquals(Content, viewportItems))) return;
    var eligible = HorizontalAlignment == global::Avalonia.Layout.HorizontalAlignment.Stretch && ClipToBounds && HasSimpleViewportGeometry() && !viewportDetached && !requireLegacyRowGeometry && boundedViewport && fullEffectiveViewport && GetType() == typeof(FsusTree) && flattenedNodes.Count >= 250 &&
      RowPresenter is null && ActiveInlineEdit is null && Filter is null && ChildrenLoader is null;
    if (eligible == usingViewport) return;
    RowChildren.Clear();
    renderedRows.Clear();
    expansionRowContexts = null;
    usingViewport = eligible;
    if (eligible)
    {
      viewportItems ??= new FsusTreeViewportItems(virtualRows, this);
      Content = viewportItems;
    }
    else Content = rowsPanel;
  }
  private Dictionary<string, FsusTreeRowContext>? expansionRowContexts;
  private CancellationTokenSource? loadCancellation;
  private TextBox? inlineEditor;
  private TopLevel? inlineEditTopLevel;
  private FsusTreeRowPresenter? rowPresenter;
  private double? rowMinHeight;
  private Thickness? rowPadding;
  private int loadVersion;

  public FsusTree()
  {
    nodePresentationHandler = new NodePresentationSubscription(this).OnInvalidated;
    FsusComponentClasses.SetBaseClasses(this, "fsus-tree");
    Focusable = true;
    Content = rowsPanel;
    PropertyChanged += (_, e) => { if (e.Property == BoundsProperty || e.Property == ClipToBoundsProperty) QueueViewportCheck(); };
    EffectiveViewportChanged += (_, e) => { lastEffectiveViewport = e.EffectiveViewport; QueueViewportCheck(); };
    SyncState();
  }

  public string? AccessibleName { get; set; }
  public Collection<FsusTreeNode> Nodes { get; } = [];
  public FsusTreeSelectionMode SelectionMode { get; set; } = FsusTreeSelectionMode.Single;
  public bool Checkable { get; set; }
  public Func<FsusTreeNode, bool>? Filter { get; set; }
  public FsusTreeChildrenLoader? ChildrenLoader { get; set; }
  public Func<string, Rect>? NodeAnchorBoundsResolver { get; set; }
  public FsusTreeRowPresenter? RowPresenter
  {
    get => rowPresenter;
    set
    {
      if (ReferenceEquals(rowPresenter, value))
      {
        return;
      }

      rowPresenter = value;
      RefreshRows();
      SyncState();
    }
  }
  public double? RowMinHeight
  {
    get => rowMinHeight;
    set
    {
      if (rowMinHeight == value)
      {
        return;
      }

      if (value is < 0)
      {
        throw new ArgumentOutOfRangeException(nameof(value), "RowMinHeight cannot be negative.");
      }

      rowMinHeight = value;
      RefreshRows();
      SyncState();
    }
  }
  public Thickness? RowPadding
  {
    get => rowPadding;
    set
    {
      if (rowPadding == value)
      {
        return;
      }

      rowPadding = value;
      RefreshRows();
      SyncState();
    }
  }
  public string FocusedKey { get; private set; } = string.Empty;
  public bool LastLoadCanceled { get; private set; }
  public IReadOnlyList<FsusTreeNodeView> FlattenedNodes => flattenedNodes.AsReadOnly();
  public IReadOnlySet<string> ExpandedKeys => expandedKeys;
  public IReadOnlySet<string> SelectedKeys => selectedKeys;
  public IReadOnlySet<string> CheckedKeys => checkedKeys;
  public FsusTreeInlineEditState? ActiveInlineEdit { get; private set; }

  public event EventHandler<FsusTreeNodeActivatedEventArgs>? NodeActivated;
  public event EventHandler<FsusTreeSelectionChangedEventArgs>? SelectionChanged;
  public event EventHandler<FsusTreeExpansionChangedEventArgs>? ExpansionChanged;
  public event EventHandler<FsusTreeLazyLoadEventArgs>? LazyLoadStateChanged;
  public event EventHandler<FsusTreeInlineEditCommitEventArgs>? InlineEditCommitRequested;
  public event EventHandler<FsusTreeInlineEditCanceledEventArgs>? InlineEditCanceled;

  public static readonly RoutedEvent<FsusTreeNodeContextEventArgs> NodeContextRequestedEvent =
    RoutedEvent.Register<FsusTree, FsusTreeNodeContextEventArgs>(
      nameof(NodeContextRequested),
      RoutingStrategies.Bubble);

  public event EventHandler<FsusTreeNodeContextEventArgs>? NodeContextRequested
  {
    add => AddHandler(NodeContextRequestedEvent, value);
    remove => RemoveHandler(NodeContextRequestedEvent, value);
  }

  public virtual void RefreshView()
  {
    SyncPresentationSubscriptions();
    flattenedNodes.Clear();
    if (Filter is null)
    {
      AddVisibleNodes(Nodes, 1);
    }
    else
    {
      AddFilteredNodes(Nodes, 1);
    }

    if (
      flattenedNodes.Count > 0 &&
      !flattenedNodes.Any(node => node.Node.Key == FocusedKey) &&
      ActiveInlineEdit?.Key != FocusedKey)
    {
      FocusedKey = flattenedNodes[0].Node.Key;
    }

    RefreshRows();
    SyncState();
  }

  public bool RefreshNodePresentation(string key)
  {
    var view = flattenedNodes.FirstOrDefault(candidate => candidate.Node.Key == key);
    if (view is null || !renderedRows.TryGetValue(key, out var row))
    {
      return false;
    }

    var context = CreateRowContext(view);
    ApplyRowState(row, context);
    if (
      ActiveInlineEdit is
      {
        Kind: FsusTreeInlineEditKind.Rename,
        Key: var editKey,
      } && editKey == key)
    {
      return true;
    }

    row.Child = BuildNodeContent(view, context);
    return true;
  }

  public bool Expand(string key)
  {
    var node = FindNode(key);
    if (node is null || (node.Children.Count == 0 && !node.HasLazyChildren))
    {
      return false;
    }

    RefreshExpansion(key, expanded: true);
    return true;
  }

  public bool Collapse(string key)
  {
    if (!expandedKeys.Contains(key))
    {
      return false;
    }

    RefreshExpansion(key, expanded: false);
    return true;
  }

  private void RefreshExpansion(string key, bool expanded)
  {
    var previousContexts = expansionRowContexts;
    expansionRowContexts = null;
    if (ActiveInlineEdit is null && Filter is null)
    {
      var contexts = new Dictionary<string, FsusTreeRowContext>(StringComparer.Ordinal);
      foreach (var view in flattenedNodes)
      {
        if (!contexts.TryAdd(view.Node.Key, CreateRowContext(view)))
        {
          contexts = null;
          break;
        }
      }
      expansionRowContexts = contexts;
    }
    try
    {
      if (expanded) expandedKeys.Add(key);
      else expandedKeys.Remove(key);
      FocusedKey = key;
      RefreshView();
    }
    finally
    {
      expansionRowContexts = previousContexts;
    }
  }

  public bool ToggleSelection(string key)
  {
    var node = FindNode(key);
    if (node is null || node.IsDisabled)
    {
      return false;
    }

    var wasSelected = selectedKeys.Contains(key);
    var added = new List<string>();
    var removed = new List<string>();

    if (SelectionMode == FsusTreeSelectionMode.Single)
    {
      removed.AddRange(selectedKeys.Where(existing => existing != key));
      selectedKeys.Clear();
      selectedKeys.Add(key);
      if (!wasSelected)
      {
        added.Add(key);
      }
    }
    else if (selectedKeys.Add(key))
    {
      added.Add(key);
    }
    else
    {
      selectedKeys.Remove(key);
      removed.Add(key);
    }

    FocusedKey = key;
    RefreshRows();
    SyncState();
    RaiseSelectionChanged(added, removed);
    return true;
  }

  public bool ToggleCheck(string key)
  {
    if (!Checkable || FindNode(key) is null)
    {
      return false;
    }

    if (!checkedKeys.Add(key))
    {
      checkedKeys.Remove(key);
    }

    FocusedKey = key;
    RefreshRows();
    SyncState();
    return true;
  }

  public bool FocusNode(string key)
  {
    if (FindNode(key) is null)
    {
      return false;
    }

    if (FocusedKey != key)
    {
      var previousKey = FocusedKey;
      FocusedKey = key;
      RefreshNodePresentation(previousKey);
      RefreshNodePresentation(key);
    }
    SyncState();
    return true;
  }

  public bool Activate(string key, FsusTreeInteractionSource source)
  {
    var node = FindNode(key);
    if (node is null || node.IsDisabled)
    {
      return false;
    }

    FocusedKey = key;
    RefreshRows();
    SyncState();
    var activation = new FsusTreeNodeActivatedEventArgs(key, source);
    NodeActivated?.Invoke(this, activation);
    return true;
  }

  public bool RequestNodeContext(string key, FsusTreeInteractionSource source)
  {
    return RequestNodeContext(key, source, anchorBounds: null);
  }

  public bool StartRename(string key, string initialValue)
  {
    var node = FindNode(key);
    if (
      ActiveInlineEdit is not null ||
      node is null ||
      node.IsDisabled ||
      string.IsNullOrEmpty(key))
    {
      return false;
    }

    ActiveInlineEdit = new FsusTreeInlineEditState(
      FsusTreeInlineEditKind.Rename,
      key,
      parentKey: null,
      initialValue)
    {
      PreviousFocusedKey = FocusedKey,
    };
    FocusedKey = key;
    RefreshRows();
    SyncState();
    AttachInlineEditPointerGuard();
    return true;
  }

  public bool StartCreate(string key, string? parentKey = null)
  {
    if (
      ActiveInlineEdit is not null ||
      string.IsNullOrEmpty(key) ||
      FindNode(key) is not null ||
      (parentKey is not null && FindNode(parentKey) is not { IsDisabled: false }))
    {
      return false;
    }

    var previousFocusedKey = FocusedKey;
    if (parentKey is not null)
    {
      expandedKeys.Add(parentKey);
    }

    ActiveInlineEdit = new FsusTreeInlineEditState(
      FsusTreeInlineEditKind.Create,
      key,
      parentKey,
      string.Empty)
    {
      PreviousFocusedKey = previousFocusedKey,
    };
    FocusedKey = key;
    RefreshView();
    AttachInlineEditPointerGuard();
    return true;
  }

  public bool CommitInlineEdit()
  {
    var edit = ActiveInlineEdit;
    if (edit is null)
    {
      return false;
    }

    var args = new FsusTreeInlineEditCommitEventArgs(
      edit.Kind,
      edit.Key,
      edit.ParentKey,
      edit.Text);
    InlineEditCommitRequested?.Invoke(this, args);
    if (!string.IsNullOrWhiteSpace(args.ValidationError))
    {
      edit.ValidationError = args.ValidationError;
      edit.SelectAllOnFocus = false;
      RefreshRows();
      SyncState();
      return false;
    }

    ActiveInlineEdit = null;
    DetachInlineEditPointerGuard();
    FocusedKey = FindNode(edit.Key) is not null
      ? edit.Key
      : ResolveInlineEditReturnFocus(edit);
    RefreshView();
    return true;
  }

  public bool CancelInlineEdit() =>
    CancelInlineEdit(FsusTreeInlineEditCancelReason.Programmatic);

  private bool RequestNodeContext(
    string key,
    FsusTreeInteractionSource source,
    Rect? anchorBounds)
  {
    var node = FindNode(key);
    if (node is null || node.IsDisabled)
    {
      return false;
    }

    if (usingViewport && anchorBounds is null && NodeAnchorBoundsResolver is null &&
        renderedRows.TryGetValue(key, out var anchorRow) && !anchorRow.GetVisualAncestors().Contains(this))
    {
      requireLegacyRowGeometry = true;
      RefreshRows();
      UpdateLayout();
    }
    var resolvedAnchorBounds = anchorBounds ?? ResolveNodeAnchorBounds(key);
    FocusNode(key);
    if (!selectedKeys.Contains(key))
    {
      ToggleSelection(key);
    }

    RaiseEvent(new FsusTreeNodeContextEventArgs(
      key,
      node,
      source,
      resolvedAnchorBounds));
    return true;
  }

  public async ValueTask<bool> LoadChildrenAsync(string key)
  {
    if (ChildrenLoader is null)
    {
      return false;
    }

    var node = FindNode(key);
    if (node is null)
    {
      return false;
    }

    if (loadCancellation is not null)
    {
      LastLoadCanceled = true;
      loadCancellation.Cancel();
    }

    using var cancellation = new CancellationTokenSource();
    loadCancellation = cancellation;
    var version = ++loadVersion;

    RaiseLazyLoadState(key, FsusTreeLazyLoadState.Started);
    try
    {
      var children = await ChildrenLoader(node, cancellation.Token);
      if (cancellation.IsCancellationRequested || version != loadVersion)
      {
        RaiseLazyLoadState(key, FsusTreeLazyLoadState.Canceled);
        return false;
      }

      node.Children.Clear();
      foreach (var child in children)
      {
        node.Children.Add(child);
      }

      node.HasLazyChildren = false;
      expandedKeys.Add(node.Key);
      RefreshView();
      RaiseLazyLoadState(key, FsusTreeLazyLoadState.Completed);
      return true;
    }
    catch (OperationCanceledException)
    {
      RaiseLazyLoadState(key, FsusTreeLazyLoadState.Canceled);
      return false;
    }
    catch (Exception exception)
    {
      RaiseLazyLoadState(key, FsusTreeLazyLoadState.Failed, exception);
      throw;
    }
    finally
    {
      if (ReferenceEquals(loadCancellation, cancellation))
      {
        loadCancellation = null;
      }
    }
  }

  public FsusTreeNodeState GetNodeState(string key)
  {
    var view = flattenedNodes.FirstOrDefault(node => node.Node.Key == key);
    var node = view?.Node ?? FindNode(key);
    var expandedState = node is null || (node.Children.Count == 0 && !node.HasLazyChildren)
      ? "leaf"
      : expandedKeys.Contains(key)
        ? "expanded"
        : "collapsed";
    return new FsusTreeNodeState(
      key,
      selectedKeys.Contains(key),
      checkedKeys.Contains(key),
      expandedState,
      view is null ? 0 : view.Level,
      view is null ? 0 : view.Position,
      view is null ? 0 : view.SetSize);
  }

  protected ValueTask<bool> HandleKeyAsync(Key key)
  {
    if (flattenedNodes.Count == 0)
    {
      return ValueTask.FromResult(false);
    }

    var index = Math.Max(0, flattenedNodes.FindIndex(node => node.Node.Key == FocusedKey));
    switch (key)
    {
      case Key.Down:
        FocusedKey = flattenedNodes[Math.Min(flattenedNodes.Count - 1, index + 1)].Node.Key;
        RefreshRows();
        SyncState();
        return ValueTask.FromResult(true);
      case Key.Up:
        FocusedKey = flattenedNodes[Math.Max(0, index - 1)].Node.Key;
        RefreshRows();
        SyncState();
        return ValueTask.FromResult(true);
      case Key.Enter:
        return ValueTask.FromResult(Activate(FocusedKey, FsusTreeInteractionSource.Keyboard));
      case Key.Right:
        return ValueTask.FromResult(GestureExpand(
          FocusedKey,
          FsusTreeInteractionSource.Keyboard));
      case Key.Left:
        return ValueTask.FromResult(GestureCollapse(
          FocusedKey,
          FsusTreeInteractionSource.Keyboard));
      case Key.Space:
        return ValueTask.FromResult(ToggleSelection(FocusedKey));
      default:
        return ValueTask.FromResult(false);
    }
  }

  protected FsusTreeNode? FindNode(string key) => FindNode(Nodes, key);

  protected override void OnKeyDown(KeyEventArgs e)
  {
    base.OnKeyDown(e);
    if (e.Handled || flattenedNodes.Count == 0)
    {
      return;
    }

    var contextRequested = e.Key switch
    {
      Key.F10 when e.KeyModifiers.HasFlag(KeyModifiers.Shift) => true,
      Key.Apps => true,
      _ => false,
    };

    if (contextRequested &&
      RequestNodeContext(FocusedKey, FsusTreeInteractionSource.Keyboard))
    {
      e.Handled = true;
      return;
    }

    e.Handled = HandleKeyAsync(e.Key).GetAwaiter().GetResult();
  }

  protected override void OnAttachedToVisualTree(VisualTreeAttachmentEventArgs e)
  {
    base.OnAttachedToVisualTree(e);
    if (viewportDetached && !verifiedAncestors.SequenceEqual(CaptureAncestorStamp()) && !RevalidateTranslatedAncestorStamp())
    {
      fullEffectiveViewport = false;
      boundedViewport = false;
      lastEffectiveViewport = default;
      verifiedAncestors = [];
    }
    viewportDetached = false;
    AttachInlineEditPointerGuard();
    InvalidateMeasure();
  }

  protected override void OnDetachedFromVisualTree(VisualTreeAttachmentEventArgs e)
  {
    DetachInlineEditPointerGuard();
    viewportDetached = true;
    var version = ++detachVersion;
    Dispatcher.UIThread.Post(() =>
    {
      if (viewportDetached && version == detachVersion)
      {
        fullEffectiveViewport = false;
        boundedViewport = false;
        lastEffectiveViewport = default;
        verifiedAncestors = [];
      }
    }, DispatcherPriority.Loaded);
    base.OnDetachedFromVisualTree(e);
  }

  private Rect ResolveNodeAnchorBounds(string key) =>
    NodeAnchorBoundsResolver?.Invoke(key) ??
    (renderedRows.TryGetValue(key, out var row)
      ? new Rect(row.TranslatePoint(default, this) ?? default, row.Bounds.Size)
      : new Rect(0, 0, 0, 0));

  private bool GestureExpand(string key, FsusTreeInteractionSource source)
  {
    if (!Expand(key))
    {
      return false;
    }

    ExpansionChanged?.Invoke(this, new FsusTreeExpansionChangedEventArgs(
      key,
      true,
      source));
    return true;
  }

  private bool GestureCollapse(string key, FsusTreeInteractionSource source)
  {
    if (!Collapse(key))
    {
      return false;
    }

    ExpansionChanged?.Invoke(this, new FsusTreeExpansionChangedEventArgs(
      key,
      false,
      source));
    return true;
  }

  private bool GestureToggleExpansion(string key, FsusTreeInteractionSource source) =>
    expandedKeys.Contains(key)
      ? GestureCollapse(key, source)
      : GestureExpand(key, source);

  private bool IsExpandable(FsusTreeNode node) =>
    node.Children.Count > 0 ||
    node.HasLazyChildren ||
    ActiveInlineEdit is
    {
      Kind: FsusTreeInlineEditKind.Create,
      ParentKey: var parentKey,
    } && parentKey == node.Key;
}
