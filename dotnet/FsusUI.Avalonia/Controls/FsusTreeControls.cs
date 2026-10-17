using Avalonia;
using Avalonia.Automation;
using Avalonia.Automation.Peers;
using Avalonia.Controls;
using Avalonia.Input;
using Avalonia.Interactivity;
using Avalonia.LogicalTree;
using Avalonia.Media;
using Avalonia.Media.TextFormatting;
using Avalonia.Threading;
using Avalonia.VisualTree;
using FsusUI.Avalonia.Overlay;
using System.Collections.ObjectModel;
using System.Globalization;

namespace FsusUI.Avalonia.Controls;

public enum FsusTreeSelectionMode
{
  Single,
  Multiple,
}

public sealed class FsusTreeNode
{
  private string label;
  private bool isDisabled;
  private bool hasLazyChildren;
  private object? payload;

  public FsusTreeNode(string key, string label)
  {
    Key = key;
    this.label = label;
  }

  internal event EventHandler? PresentationInvalidated;

  public string Key { get; }
  public string Label
  {
    get => label;
    set
    {
      if (label == value)
      {
        return;
      }

      label = value;
      InvalidatePresentation();
    }
  }
  public bool IsDisabled
  {
    get => isDisabled;
    set
    {
      if (isDisabled == value)
      {
        return;
      }

      isDisabled = value;
      InvalidatePresentation();
    }
  }
  public bool HasLazyChildren
  {
    get => hasLazyChildren;
    set
    {
      if (hasLazyChildren == value)
      {
        return;
      }

      hasLazyChildren = value;
      InvalidatePresentation();
    }
  }
  public object? Payload
  {
    get => payload;
    set
    {
      if (ReferenceEquals(payload, value))
      {
        return;
      }

      payload = value;
      InvalidatePresentation();
    }
  }
  public Collection<FsusTreeNode> Children { get; } = [];

  public void InvalidatePresentation() => PresentationInvalidated?.Invoke(this, EventArgs.Empty);
}

public sealed record FsusTreeNodeView(
  FsusTreeNode Node,
  int Level,
  int Position,
  int SetSize);

public sealed record FsusTreeNodeState(
  string Key,
  bool Selected,
  bool Checked,
  string ExpandedState,
  int Level,
  int Position,
  int SetSize);

public sealed record FsusTreeRowContext(
  string Key,
  FsusTreeNode Node,
  object? Payload,
  int Level,
  int Position,
  int SetSize,
  bool IsDisabled,
  bool IsSelected,
  bool IsChecked,
  bool IsFocused,
  bool IsExpanded,
  bool IsExpandable,
  FsusTreeLazyLoadState? LazyLoadState);

public delegate Control FsusTreeRowPresenter(FsusTreeRowContext context);

public sealed record FsusTreeVirtualizationBudget(
  int RealizedRows,
  int RetainedNodes,
  int MaxDepth,
  double LazyLoadLatencyMs,
  double MemoryKb);

public sealed record FsusTreeBudgetResult(
  int RealizedRows,
  int RetainedNodes,
  int MaxDepth,
  FsusTreeVirtualizationBudget Budget)
{
  public bool WithinBudget =>
    RealizedRows <= Budget.RealizedRows &&
    RetainedNodes <= Budget.RetainedNodes &&
    MaxDepth <= Budget.MaxDepth;
}

public sealed record FsusTreeTableBudget(
  int RealizedRows,
  int RealizedColumns,
  int RealizedCells,
  double MemoryKb);

public sealed record FsusTreeTableBudgetResult(
  int RealizedRows,
  int RealizedColumns,
  int RealizedCells,
  FsusTreeTableBudget Budget)
{
  public bool WithinBudget =>
    RealizedRows <= Budget.RealizedRows &&
    RealizedColumns <= Budget.RealizedColumns &&
    RealizedCells <= Budget.RealizedCells;
}

public delegate ValueTask<IReadOnlyList<FsusTreeNode>> FsusTreeChildrenLoader(
  FsusTreeNode node,
  CancellationToken cancellationToken);

public enum FsusTreeInteractionSource
{
  Pointer,
  Keyboard,
}

public enum FsusTreeLazyLoadState
{
  Started,
  Completed,
  Canceled,
  Failed,
}

public enum FsusTreeInlineEditKind
{
  Rename,
  Create,
}

public enum FsusTreeInlineEditCancelReason
{
  Programmatic,
  Escape,
  PointerOutside,
}

public sealed class FsusTreeInlineEditState(
  FsusTreeInlineEditKind kind,
  string key,
  string? parentKey,
  string text)
{
  public FsusTreeInlineEditKind Kind { get; } = kind;
  public string Key { get; } = key;
  public string? ParentKey { get; } = parentKey;
  public string Text { get; internal set; } = text;
  public string? ValidationError { get; internal set; }
  internal string PreviousFocusedKey { get; set; } = string.Empty;
  internal bool SelectAllOnFocus { get; set; } = kind == FsusTreeInlineEditKind.Rename;
}

public sealed class FsusTreeInlineEditCommitEventArgs(
  FsusTreeInlineEditKind kind,
  string key,
  string? parentKey,
  string text) : EventArgs
{
  public FsusTreeInlineEditKind Kind { get; } = kind;
  public string Key { get; } = key;
  public string? ParentKey { get; } = parentKey;
  public string Text { get; } = text;
  public string? ValidationError { get; set; }
}

public sealed class FsusTreeInlineEditCanceledEventArgs(
  FsusTreeInlineEditKind kind,
  string key,
  string? parentKey,
  string text,
  FsusTreeInlineEditCancelReason reason) : EventArgs
{
  public FsusTreeInlineEditKind Kind { get; } = kind;
  public string Key { get; } = key;
  public string? ParentKey { get; } = parentKey;
  public string Text { get; } = text;
  public FsusTreeInlineEditCancelReason Reason { get; } = reason;
}

public sealed class FsusTreeNodeActivatedEventArgs(
  string key,
  FsusTreeInteractionSource source) : EventArgs
{
  public string Key { get; } = key;
  public FsusTreeInteractionSource Source { get; } = source;
  public bool Handled { get; set; }
}

public sealed class FsusTreeSelectionChangedEventArgs(
  IReadOnlyList<string> addedKeys,
  IReadOnlyList<string> removedKeys,
  IReadOnlySet<string> selectedKeys) : EventArgs
{
  public IReadOnlyList<string> AddedKeys { get; } = addedKeys;
  public IReadOnlyList<string> RemovedKeys { get; } = removedKeys;
  public IReadOnlySet<string> SelectedKeys { get; } = selectedKeys;
}

public sealed class FsusTreeExpansionChangedEventArgs(
  string key,
  bool isExpanded,
  FsusTreeInteractionSource source) : EventArgs
{
  public string Key { get; } = key;
  public bool IsExpanded { get; } = isExpanded;
  public FsusTreeInteractionSource Source { get; } = source;
}

public sealed class FsusTreeLazyLoadEventArgs(
  string key,
  FsusTreeLazyLoadState state,
  Exception? exception = null) : EventArgs
{
  public string Key { get; } = key;
  public FsusTreeLazyLoadState State { get; } = state;
  public Exception? Exception { get; } = exception;
}

public sealed class FsusTreeNodeContextEventArgs(
  string key,
  FsusTreeNode node,
  FsusTreeInteractionSource source,
  Rect anchorBounds) : RoutedEventArgs(FsusTree.NodeContextRequestedEvent)
{
  public string Key { get; } = key;
  public FsusTreeNode Node { get; } = node;
  public FsusTreeInteractionSource InteractionSource { get; } = source;
  public Rect AnchorBounds { get; } = anchorBounds;
}

public class FsusTree : ContentControl
{
  private readonly List<FsusTreeNodeView> flattenedNodes = [];
  private readonly HashSet<string> expandedKeys = new(StringComparer.Ordinal);
  private readonly HashSet<string> selectedKeys = new(StringComparer.Ordinal);
  private readonly HashSet<string> checkedKeys = new(StringComparer.Ordinal);
  private readonly HashSet<FsusTreeNode> presentationSubscriptions = [];
  private sealed record RenderedTreeRow(FsusTreeNode? Node, Border Row);

  private readonly Dictionary<string, RenderedTreeRow> renderedRows = new(StringComparer.Ordinal);
  private readonly Dictionary<string, FsusTreeLazyLoadState> lazyLoadStates = new(StringComparer.Ordinal);
  private readonly StackPanel rowsPanel = new();
  private CancellationTokenSource? loadCancellation;
  private TextBox? inlineEditor;
  private TopLevel? inlineEditTopLevel;
  private FsusTreeRowPresenter? rowPresenter;
  private FsusTreeRowPresenter? renderedPresenter;
  private double? rowMinHeight;
  private Thickness? rowPadding;
  private int loadVersion;
  private int textCacheAttachmentVersion;
  private TopLevel? textCacheTopLevel;
  private Dictionary<Typeface, GlyphTypeface>? layoutGlyphTypefaces;

  public FsusTree()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-tree");
    Focusable = true;
    Content = rowsPanel;
    SyncState();
  }

  protected override Size MeasureOverride(Size availableSize)
  {
    var previous = layoutGlyphTypefaces;
    layoutGlyphTypefaces = [];
    try
    {
      return base.MeasureOverride(availableSize);
    }
    finally
    {
      layoutGlyphTypefaces = previous;
    }
  }

  protected override Size ArrangeOverride(Size finalSize)
  {
    var previous = layoutGlyphTypefaces;
    layoutGlyphTypefaces = [];
    try
    {
      return base.ArrangeOverride(finalSize);
    }
    finally
    {
      layoutGlyphTypefaces = previous;
    }
  }

  internal GlyphTypeface ResolveLayoutGlyphTypeface(Typeface typeface)
  {
    // Sibling labels share effective fonts. Resolve once within this layout
    // pass, then query the provider afresh on the next pass or standalone label.
    if (layoutGlyphTypefaces is null)
      return typeface.GlyphTypeface;
    if (!layoutGlyphTypefaces.TryGetValue(typeface, out var glyphTypeface))
      layoutGlyphTypefaces[typeface] = glyphTypeface = typeface.GlyphTypeface;
    return glyphTypeface;
  }

  internal void InvalidateLayoutGlyphTypefaces() => layoutGlyphTypefaces?.Clear();

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
    if (view is null || !renderedRows.TryGetValue(key, out var rendered))
    {
      return false;
    }

    if (
      ActiveInlineEdit is
      {
        Kind: FsusTreeInlineEditKind.Rename,
        Key: var editKey,
      } && editKey == key)
    {
      return true;
    }

    var context = CreateRowContext(view);
    var row = rendered.Row;
    ApplyRowState(row, context);
    ReleaseRowTextCache(row);
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

    expandedKeys.Add(key);
    FocusedKey = key;
    RefreshView();
    return true;
  }

  public bool Collapse(string key)
  {
    if (!expandedKeys.Remove(key))
    {
      return false;
    }

    FocusedKey = key;
    RefreshView();
    return true;
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

    FocusedKey = key;
    RefreshRows();
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
    textCacheAttachmentVersion++;
    var topLevel = TopLevel.GetTopLevel(this);
    if (!ReferenceEquals(textCacheTopLevel, topLevel))
    {
      if (textCacheTopLevel is not null)
        textCacheTopLevel.Closed -= OnTextCacheTopLevelClosed;
      textCacheTopLevel = topLevel;
      if (textCacheTopLevel is not null)
        textCacheTopLevel.Closed += OnTextCacheTopLevelClosed;
    }
    AttachInlineEditPointerGuard();
  }

  protected override void OnDetachedFromVisualTree(VisualTreeAttachmentEventArgs e)
  {
    DetachInlineEditPointerGuard();
    base.OnDetachedFromVisualTree(e);
    var version = ++textCacheAttachmentVersion;
    // A synchronous reparent can reuse shaped text. A real unload releases it
    // at the end of this UI turn, or immediately when the owning window closes.
    Dispatcher.UIThread.Post(() =>
    {
      if (version == textCacheAttachmentVersion && !this.IsAttachedToVisualTree())
        ReleaseTextCaches();
    }, DispatcherPriority.Normal);
  }

  private void OnTextCacheTopLevelClosed(object? sender, EventArgs e) => ReleaseTextCaches();

  private void ReleaseTextCaches()
  {
    foreach (var rendered in renderedRows.Values)
      ReleaseRowTextCache(rendered.Row);
    if (textCacheTopLevel is not null)
      textCacheTopLevel.Closed -= OnTextCacheTopLevelClosed;
    textCacheTopLevel = null;
  }

  private static void ReleaseRowTextCache(Border row)
  {
    if (row.Child is FsusTreeDefaultLabel label)
      label.ReleaseShapingCache();
  }

  private Rect ResolveNodeAnchorBounds(string key) =>
    NodeAnchorBoundsResolver?.Invoke(key) ??
    (renderedRows.TryGetValue(key, out var rendered)
      ? new Rect(rendered.Row.TranslatePoint(default, this) ?? default, rendered.Row.Bounds.Size)
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

  private void RefreshRows()
  {
    var previousRows = new Dictionary<string, RenderedTreeRow>(renderedRows, StringComparer.Ordinal);
    var desiredRows = new List<Control>();
    renderedRows.Clear();
    foreach (var view in flattenedNodes)
    {
      var node = view.Node;
      var context = CreateRowContext(view);
      Border row;
      if (previousRows.Remove(node.Key, out var previous) && ReferenceEquals(previous.Node, node))
      {
        row = previous.Row;
      }
      else
      {
        if (previous is not null)
          ReleaseRowTextCache(previous.Row);
        row = new Border { Focusable = false };
        FsusComponentClasses.SetBaseClasses(row, "fsus-tree-row");
        row.PointerPressed += (_, e) => HandleRowPointerPressed(node, row, e);
      }

      // Keep unchanged text layouts and attached rows through expansion/focus
      // updates. Custom presenters and editors still rebuild their content.
      if (RowPresenter is null && renderedPresenter is null &&
          ActiveInlineEdit?.Key != node.Key && row.Child is TextBlock label)
      {
        label.Text = GetDefaultNodeText(context);
      }
      else
      {
        ReleaseRowTextCache(row);
        row.Child = BuildNodeContent(view, context);
      }
      row.Margin = new Thickness(
        Math.Max(0, view.Level - 1) *
        global::FsusUI.Avalonia.FsusTokens.Space5Thickness.Left,
        0,
        0,
        0);
      ApplyRowState(row, context);
      renderedRows[node.Key] = new RenderedTreeRow(node, row);
      desiredRows.Add(row);

      if (
        ActiveInlineEdit is
        {
          Kind: FsusTreeInlineEditKind.Create,
          ParentKey: var parentKey,
        } && parentKey == node.Key)
      {
        desiredRows.Add(BuildTransientInlineEditRow(view.Level + 1));
      }
    }

    if (ActiveInlineEdit is { Kind: FsusTreeInlineEditKind.Create, ParentKey: null })
    {
      desiredRows.Add(BuildTransientInlineEditRow(1));
    }

    var retained = new HashSet<Control>(desiredRows);
    foreach (var removed in previousRows.Values)
      ReleaseRowTextCache(removed.Row);
    foreach (var removed in rowsPanel.Children.Where(child => !retained.Contains(child)).ToArray())
    {
      rowsPanel.Children.Remove(removed);
    }
    for (var index = 0; index < desiredRows.Count; index++)
    {
      var row = desiredRows[index];
      if (index < rowsPanel.Children.Count && ReferenceEquals(rowsPanel.Children[index], row))
      {
        continue;
      }

      if (ReferenceEquals(row.Parent, rowsPanel))
      {
        rowsPanel.Children.Remove(row);
      }
      rowsPanel.Children.Insert(index, row);
    }
    renderedPresenter = RowPresenter;
  }

  private Control BuildNodeContent(FsusTreeNodeView view, FsusTreeRowContext context)
  {
    if (
      ActiveInlineEdit is
      {
        Kind: FsusTreeInlineEditKind.Rename,
        Key: var editKey,
      } && editKey == view.Node.Key)
    {
      return BuildInlineEditContent(view.Node.Label);
    }

    if (RowPresenter is not null)
    {
      return RowPresenter(context);
    }

    return new FsusTreeDefaultLabel(this)
    {
      Text = GetDefaultNodeText(context),
      VerticalAlignment = global::Avalonia.Layout.VerticalAlignment.Center,
      TextTrimming = global::Avalonia.Media.TextTrimming.CharacterEllipsis,
    };
  }

  private static string GetDefaultNodeText(FsusTreeRowContext context)
  {
    var statePrefix = context.IsExpandable
      ? context.IsExpanded ? "▾" : "▸"
      : " ";
    return $"{statePrefix} {context.Node.Label}";
  }

  private FsusTreeRowContext CreateRowContext(FsusTreeNodeView view)
  {
    var node = view.Node;
    var expandable = IsExpandable(node);
    return new FsusTreeRowContext(
      node.Key,
      node,
      node.Payload,
      view.Level,
      view.Position,
      view.SetSize,
      node.IsDisabled,
      selectedKeys.Contains(node.Key),
      checkedKeys.Contains(node.Key),
      FocusedKey == node.Key,
      expandable && expandedKeys.Contains(node.Key),
      expandable,
      lazyLoadStates.TryGetValue(node.Key, out var lazyLoadState) ? lazyLoadState : null);
  }

  private void ApplyRowState(Border row, FsusTreeRowContext context)
  {
    row.MinHeight = ResolveRowMinHeight();
    row.Padding = RowPadding ?? global::FsusUI.Avalonia.FsusTokens.Space2Thickness;
    row.IsEnabled = !context.IsDisabled;
    FsusComponentClasses.Ensure(row, "fsus-selected", context.IsSelected);
    FsusComponentClasses.Ensure(row, "fsus-focused", context.IsFocused);
    FsusComponentClasses.Ensure(row, "fsus-disabled", context.IsDisabled);
    FsusComponentClasses.Ensure(row, "fsus-expandable", context.IsExpandable);
    AutomationProperties.SetAutomationId(row, $"fsus-tree-node-{context.Key}");
    AutomationProperties.SetName(row, context.Node.Label);
    AutomationProperties.SetControlTypeOverride(row, AutomationControlType.TreeItem);
    AutomationProperties.SetPositionInSet(row, context.Position);
    AutomationProperties.SetSizeOfSet(row, context.SetSize);
    AutomationProperties.SetLiveSetting(row, AutomationLiveSetting.Polite);
    var loadState = context.LazyLoadState?.ToString().ToLowerInvariant() ?? "idle";
    AutomationProperties.SetItemStatus(
      row,
      $"{(context.IsSelected ? "selected" : "not selected")}, " +
      $"{(context.IsExpandable ? context.IsExpanded ? "expanded" : "collapsed" : "leaf")}, " +
      $"{loadState}, level {context.Level.ToString(CultureInfo.InvariantCulture)}");
  }

  private double ResolveRowMinHeight() =>
    RowMinHeight ??
    (Application.Current?.Resources[
      global::FsusUI.Avalonia.FsusTokens.DensityControlDefaultYResourceKey] is double
      currentDensityHeight
        ? currentDensityHeight
        : global::FsusUI.Avalonia.FsusTokens.DensityControlDefaultYDouble);

  private Border BuildTransientInlineEditRow(int level)
  {
    var edit = ActiveInlineEdit!;
    var row = new Border
    {
      Child = BuildInlineEditContent("New item"),
      MinHeight = global::FsusUI.Avalonia.FsusTokens.DensityControlDefaultYDouble,
      Padding = global::FsusUI.Avalonia.FsusTokens.Space2Thickness,
      Margin = new Thickness(
        Math.Max(0, level - 1) *
        global::FsusUI.Avalonia.FsusTokens.Space5Thickness.Left,
        0,
        0,
        0),
      Focusable = false,
    };
    FsusComponentClasses.SetBaseClasses(row, "fsus-tree-row");
    FsusComponentClasses.Ensure(row, "fsus-focused", true);
    FsusComponentClasses.Ensure(row, "fsus-tree-inline-create", true);
    AutomationProperties.SetAutomationId(row, $"fsus-tree-node-{edit.Key}");
    AutomationProperties.SetName(row, "New item");
    AutomationProperties.SetControlTypeOverride(row, AutomationControlType.TreeItem);
    AutomationProperties.SetLiveSetting(row, AutomationLiveSetting.Polite);
    AutomationProperties.SetItemStatus(
      row,
      string.IsNullOrWhiteSpace(edit.ValidationError)
        ? $"editing create, level {level.ToString(CultureInfo.InvariantCulture)}"
        : $"editing create, invalid, level {level.ToString(CultureInfo.InvariantCulture)}");
    renderedRows[edit.Key] = new RenderedTreeRow(null, row);
    return row;
  }

  private Control BuildInlineEditContent(string accessibleTargetName)
  {
    var edit = ActiveInlineEdit!;
    var editor = new TextBox
    {
      Text = edit.Text,
      HorizontalAlignment = global::Avalonia.Layout.HorizontalAlignment.Stretch,
    };
    FsusComponentClasses.Ensure(editor, "fsus-tree-inline-editor", true);
    FsusComponentClasses.Ensure(
      editor,
      "fsus-invalid",
      !string.IsNullOrWhiteSpace(edit.ValidationError));
    AutomationProperties.SetAutomationId(editor, $"fsus-tree-inline-editor-{edit.Key}");
    AutomationProperties.SetName(
      editor,
      edit.Kind == FsusTreeInlineEditKind.Rename
        ? $"Rename {accessibleTargetName}"
        : "New item name");
    AutomationProperties.SetHelpText(editor, edit.ValidationError ?? string.Empty);
    AutomationProperties.SetItemStatus(
      editor,
      string.IsNullOrWhiteSpace(edit.ValidationError)
        ? $"editing {edit.Kind.ToString().ToLowerInvariant()}"
        : $"editing {edit.Kind.ToString().ToLowerInvariant()}, invalid");
    editor.PropertyChanged += (_, args) =>
    {
      if (
        args.Property == TextBox.TextProperty &&
        ReferenceEquals(ActiveInlineEdit, edit) &&
        ReferenceEquals(inlineEditor, editor))
      {
        edit.Text = editor.Text ?? string.Empty;
        if (edit.ValidationError is not null)
        {
          edit.ValidationError = null;
          FsusComponentClasses.Ensure(editor, "fsus-invalid", false);
          AutomationProperties.SetHelpText(editor, string.Empty);
          AutomationProperties.SetItemStatus(
            editor,
            $"editing {edit.Kind.ToString().ToLowerInvariant()}");
        }
      }
    };
    editor.KeyDown += (_, e) =>
    {
      if (e.Handled)
      {
        return;
      }

      if (e.Key == Key.Enter)
      {
        CommitInlineEdit();
        e.Handled = true;
      }
      else if (e.Key == Key.Escape)
      {
        CancelInlineEdit(FsusTreeInlineEditCancelReason.Escape);
        e.Handled = true;
      }
    };
    inlineEditor = editor;
    FocusInlineEditor(editor, edit);

    if (string.IsNullOrWhiteSpace(edit.ValidationError))
    {
      return editor;
    }

    var error = new TextBlock
    {
      Text = edit.ValidationError,
      TextWrapping = global::Avalonia.Media.TextWrapping.Wrap,
    };
    FsusComponentClasses.SetBaseClasses(error, "fsus-tree-inline-error");
    return new StackPanel
    {
      Spacing = global::FsusUI.Avalonia.FsusTokens.Space1Thickness.Left,
      Children = { editor, error },
    };
  }

  private void FocusInlineEditor(
    TextBox editor,
    FsusTreeInlineEditState edit)
  {
    Dispatcher.UIThread.Post(() =>
    {
      if (!ReferenceEquals(ActiveInlineEdit, edit) || !ReferenceEquals(inlineEditor, editor))
      {
        return;
      }

      editor.Focus();
      if (edit.SelectAllOnFocus)
      {
        editor.SelectAll();
        edit.SelectAllOnFocus = false;
      }
      else
      {
        editor.CaretIndex = editor.Text?.Length ?? 0;
      }
    });
  }

  private bool CancelInlineEdit(FsusTreeInlineEditCancelReason reason)
  {
    var edit = ActiveInlineEdit;
    if (edit is null)
    {
      return false;
    }

    ActiveInlineEdit = null;
    DetachInlineEditPointerGuard();
    FocusedKey = ResolveInlineEditReturnFocus(edit);
    RefreshView();
    InlineEditCanceled?.Invoke(this, new FsusTreeInlineEditCanceledEventArgs(
      edit.Kind,
      edit.Key,
      edit.ParentKey,
      edit.Text,
      reason));
    return true;
  }

  private string ResolveInlineEditReturnFocus(FsusTreeInlineEditState edit)
  {
    if (FindNode(edit.PreviousFocusedKey) is not null)
    {
      return edit.PreviousFocusedKey;
    }

    if (edit.ParentKey is not null && FindNode(edit.ParentKey) is not null)
    {
      return edit.ParentKey;
    }

    return flattenedNodes.FirstOrDefault()?.Node.Key ?? string.Empty;
  }

  private void AttachInlineEditPointerGuard()
  {
    if (
      ActiveInlineEdit is null ||
      inlineEditTopLevel is not null ||
      TopLevel.GetTopLevel(this) is not { } topLevel)
    {
      return;
    }

    inlineEditTopLevel = topLevel;
    topLevel.AddHandler(
      InputElement.PointerPressedEvent,
      OnTopLevelPointerPressed,
      RoutingStrategies.Tunnel,
      handledEventsToo: true);
  }

  private void DetachInlineEditPointerGuard()
  {
    inlineEditTopLevel?.RemoveHandler(
      InputElement.PointerPressedEvent,
      OnTopLevelPointerPressed);
    inlineEditTopLevel = null;
    inlineEditor = null;
  }

  private void OnTopLevelPointerPressed(object? sender, PointerPressedEventArgs e)
  {
    if (
      ActiveInlineEdit is null ||
      inlineEditor is null ||
      e.Source is Visual source &&
      (ReferenceEquals(source, inlineEditor) || inlineEditor.IsVisualAncestorOf(source)))
    {
      return;
    }

    if (CancelInlineEdit(FsusTreeInlineEditCancelReason.PointerOutside))
    {
      e.Handled = true;
    }
  }

  private void HandleRowPointerPressed(
    FsusTreeNode node,
    Border row,
    PointerPressedEventArgs e)
  {
    if (e.Handled || node.IsDisabled)
    {
      return;
    }

    var point = e.GetCurrentPoint(row);
    if (point.Properties.IsRightButtonPressed)
    {
      var rowAnchor = ResolveNodeAnchorBounds(node.Key);
      var pointerAnchor = new Rect(
        rowAnchor.X + point.Position.X,
        rowAnchor.Y + point.Position.Y,
        1,
        1);
      Focus();
      if (RequestNodeContext(
        node.Key,
        FsusTreeInteractionSource.Pointer,
        pointerAnchor))
      {
        e.Handled = true;
      }
      return;
    }

    if (!point.Properties.IsLeftButtonPressed)
    {
      return;
    }

    Focus();
    var expandable = IsExpandable(node);
    if (
      expandable &&
      point.Position.X <= global::FsusUI.Avalonia.FsusTokens.Space6Thickness.Left)
    {
      e.Handled = GestureToggleExpansion(
        node.Key,
        FsusTreeInteractionSource.Pointer);
      return;
    }

    if (!selectedKeys.Contains(node.Key))
    {
      ToggleSelection(node.Key);
    }
    e.Handled = Activate(node.Key, FsusTreeInteractionSource.Pointer);
  }

  private void RaiseSelectionChanged(IReadOnlyList<string> added, IReadOnlyList<string> removed)
  {
    if (added.Count == 0 && removed.Count == 0)
    {
      return;
    }

    SelectionChanged?.Invoke(this, new FsusTreeSelectionChangedEventArgs(
      added,
      removed,
      new HashSet<string>(selectedKeys, StringComparer.Ordinal)));
  }

  private void RaiseLazyLoadState(
    string key,
    FsusTreeLazyLoadState state,
    Exception? exception = null)
  {
    lazyLoadStates[key] = state;
    RefreshRows();
    SyncState();
    LazyLoadStateChanged?.Invoke(this, new FsusTreeLazyLoadEventArgs(key, state, exception));
  }

  private void SyncPresentationSubscriptions()
  {
    var currentNodes = new HashSet<FsusTreeNode>();
    CollectNodes(Nodes, currentNodes);

    foreach (var node in presentationSubscriptions.Except(currentNodes).ToArray())
    {
      node.PresentationInvalidated -= OnNodePresentationInvalidated;
      presentationSubscriptions.Remove(node);
    }

    foreach (var node in currentNodes.Except(presentationSubscriptions))
    {
      node.PresentationInvalidated += OnNodePresentationInvalidated;
      presentationSubscriptions.Add(node);
    }
  }

  private static void CollectNodes(
    IEnumerable<FsusTreeNode> nodes,
    ISet<FsusTreeNode> destination)
  {
    foreach (var node in nodes)
    {
      if (!destination.Add(node))
      {
        continue;
      }

      CollectNodes(node.Children, destination);
    }
  }

  private void OnNodePresentationInvalidated(object? sender, EventArgs e)
  {
    if (sender is not FsusTreeNode node)
    {
      return;
    }

    if (Dispatcher.UIThread.CheckAccess())
    {
      RefreshNodePresentation(node.Key);
      SyncState();
      return;
    }

    Dispatcher.UIThread.Post(() =>
    {
      RefreshNodePresentation(node.Key);
      SyncState();
    });
  }

  private FsusTreeNode? FindNode(IEnumerable<FsusTreeNode> nodes, string key)
  {
    foreach (var node in nodes)
    {
      if (node.Key == key)
      {
        return node;
      }

      var child = FindNode(node.Children, key);
      if (child is not null)
      {
        return child;
      }
    }

    return null;
  }

  private void AddVisibleNodes(IReadOnlyList<FsusTreeNode> nodes, int level)
  {
    for (var index = 0; index < nodes.Count; index++)
    {
      var node = nodes[index];
      flattenedNodes.Add(new FsusTreeNodeView(node, level, index + 1, nodes.Count));
      if (expandedKeys.Contains(node.Key))
      {
        AddVisibleNodes(node.Children, level + 1);
      }
    }
  }

  private void AddFilteredNodes(IReadOnlyList<FsusTreeNode> nodes, int level)
  {
    foreach (var node in nodes)
    {
      if (Filter?.Invoke(node) == true)
      {
        flattenedNodes.Add(new FsusTreeNodeView(node, level, flattenedNodes.Count + 1, flattenedNodes.Count + 1));
      }

      AddFilteredNodes(node.Children, level + 1);
    }
  }

  protected virtual void SyncState()
  {
    FsusComponentClasses.Ensure(this, "fsus-checkable", Checkable);
    FsusComponentClasses.Ensure(this, "fsus-multiple", SelectionMode == FsusTreeSelectionMode.Multiple);
    FsusComponentClasses.Ensure(this, "fsus-empty", flattenedNodes.Count == 0);
    AutomationProperties.SetName(this, FsusComponentClasses.ResolveName(AccessibleName, FocusedKey));
    AutomationProperties.SetControlTypeOverride(this, AutomationControlType.Tree);
    AutomationProperties.SetItemStatus(
      this,
      $"{flattenedNodes.Count.ToString(CultureInfo.InvariantCulture)} nodes, {selectedKeys.Count.ToString(CultureInfo.InvariantCulture)} selected");
  }
}

// TextBlock owns and disposes every returned layout. This pinned Avalonia
// preview cache owns separate references to immutable shaped runs, not layouts.
internal sealed class FsusTreeDefaultLabel : TextBlock
{
  private readonly FsusTree owner;
  private static readonly char[] ParagraphBreaks = ['\r', '\n', '\v', '\f', '\u0085', '\u2028', '\u2029'];
  private TextRunCache? shapingCache;
  private ShapingInputs? shapingInputs;
  private GenericTextRunProperties? shapingProperties;

  private sealed record ShapingInputs(
    string? Text,
    Typeface Typeface,
    GlyphTypeface GlyphTypeface,
    double FontSize,
    IBrush? Foreground,
    Color? Color,
    double? Opacity,
    Matrix? BrushTransform,
    RelativePoint? BrushTransformOrigin,
    FlowDirection FlowDirection,
    double LetterSpacing,
    double Scaling,
    TopLevel? ResourceRoot,
    object Theme);

  internal FsusTreeDefaultLabel(FsusTree owner)
  {
    this.owner = owner;
    AutomationProperties.SetClassNameOverride(this, nameof(TextBlock));
    ResourcesChanged += (_, _) =>
    {
      // Attachment notifications are covered by the effective input key.
      // Actual resource changes in a live tree require fresh shaped data.
      if (owner.Parent is not null && owner.IsAttachedToVisualTree() &&
          ((ILogical)owner).IsAttachedToLogicalTree && this.IsAttachedToVisualTree() &&
          ((ILogical)this).IsAttachedToLogicalTree)
      {
        owner.InvalidateLayoutGlyphTypefaces();
        ReleaseShapingCache();
        InvalidateTextLayout();
      }
    };
  }

  internal long ShapingBuildCount { get; private set; }
  internal bool HoldsShapingCache => shapingCache is not null;
  protected override Type StyleKeyOverride => typeof(TextBlock);

  internal void ReleaseShapingCache()
  {
    shapingCache?.Dispose();
    shapingCache = null;
    shapingInputs = null;
    shapingProperties = null;
  }

  protected override TextLayout CreateTextLayout(string? text)
  {
    // Mutable rich formatting and multi-paragraph content retain the complete
    // base behavior. The default plain label keeps only one shaping entry.
    if (Inlines is { Count: > 0 } || TextDecorations is not null ||
        FontFeatures is not null || TextWrapping != TextWrapping.NoWrap || LineSpacing != 0 ||
        TextAlignment == TextAlignment.Justify ||
        text?.IndexOfAny(ParagraphBreaks) >= 0 ||
        Foreground is not null and not ISolidColorBrush)
    {
      ReleaseShapingCache();
      return base.CreateTextLayout(text);
    }

    var typeface = new Typeface(FontFamily, FontStyle, FontWeight, FontStretch);
    var brush = Foreground as ISolidColorBrush;
    var inputs = new ShapingInputs(text, typeface, owner.ResolveLayoutGlyphTypeface(typeface),
      FontSize, Foreground, brush?.Color, brush?.Opacity,
      brush?.Transform?.Value, brush?.TransformOrigin,
      FlowDirection, LetterSpacing, TopLevel.GetTopLevel(this)?.RenderScaling ?? 1,
      TopLevel.GetTopLevel(this),
      ActualThemeVariant);
    if (inputs != shapingInputs ||
        !ReferenceEquals(inputs.Foreground, shapingInputs?.Foreground) ||
        !ReferenceEquals(inputs.GlyphTypeface, shapingInputs?.GlyphTypeface) ||
        !ReferenceEquals(inputs.ResourceRoot, shapingInputs?.ResourceRoot))
    {
      ReleaseShapingCache();
      shapingInputs = inputs;
      shapingCache = new TextRunCache();
      // Line metrics resolve the glyph typeface through these properties.
      // Keep their lazy resolution with the shaped runs across fresh layouts.
      shapingProperties = new GenericTextRunProperties(typeface, FontSize,
        TextDecorations, Foreground, fontFeatures: FontFeatures);
      ShapingBuildCount++;
    }

    var properties = shapingProperties!;
    var paragraph = new GenericTextParagraphProperties(FlowDirection,
      IsMeasureValid ? TextAlignment : TextAlignment.Left, true, false,
      properties, TextWrapping, LineHeight, 0, LetterSpacing);
    var constraint = GetMaxSizeFromConstraint();
    return new TextLayout(new SimpleTextSource(text ?? string.Empty, properties),
      paragraph, TextTrimming, constraint.Width, constraint.Height, MaxLines,
      shapingCache);
  }
}

public class FsusTreeV2 : FsusTree
{
  private readonly List<FsusTreeNodeView> visibleNodes = [];
  private int virtualizedStartIndex;

  public FsusTreeV2()
  {
    FsusComponentClasses.Ensure(this, "fsus-tree-v2", true);
  }

  public int VirtualizationThreshold { get; set; } = 250;
  public int VisibleRowLimit { get; set; } = 40;
  public FsusTreeVirtualizationBudget VirtualizationBudget { get; set; } = new(
    RealizedRows: 64,
    RetainedNodes: 100_000,
    MaxDepth: 16,
    LazyLoadLatencyMs: 12d,
    MemoryKb: 1024d);
  public IReadOnlyList<FsusTreeNodeView> VisibleNodes => visibleNodes.AsReadOnly();
  public int RealizedRowCount => visibleNodes.Count;
  public bool IsVirtualized => FlattenedNodes.Count > VirtualizationThreshold;
  public int VirtualizedStartIndex => virtualizedStartIndex;

  public override void RefreshView()
  {
    base.RefreshView();
    RebuildVisibleNodes();
    SyncState();
  }

  public void ScrollToIndex(int startIndex)
  {
    virtualizedStartIndex = Math.Clamp(startIndex, 0, Math.Max(0, FlattenedNodes.Count - Math.Max(1, VisibleRowLimit)));
    RebuildVisibleNodes();
    SyncState();
  }

  public FsusTreeBudgetResult EvaluateBudget() =>
    new(RealizedRowCount, FlattenedNodes.Count, FlattenedNodes.Select(node => node.Level).DefaultIfEmpty(0).Max(), VirtualizationBudget);

  protected override void SyncState()
  {
    base.SyncState();
    FsusComponentClasses.Ensure(this, "fsus-virtualized", IsVirtualized);
  }

  private void RebuildVisibleNodes()
  {
    visibleNodes.Clear();
    visibleNodes.AddRange(IsVirtualized
      ? FlattenedNodes.Skip(virtualizedStartIndex).Take(Math.Max(1, VisibleRowLimit))
      : FlattenedNodes);
  }
}

public class FsusTreeSelect : ContentControl, IFsusOverlayLifecycle
{
  private FsusOverlayHost? overlayHost;

  public FsusTreeSelect()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-tree-select");
    Focusable = true;
    SyncState();
  }

  public string? AccessibleName { get; set; }
  public FsusTreeV2? Tree { get; set; }
  public string SelectedKey { get; private set; } = string.Empty;
  public bool IsOpen { get; private set; }
  public FsusOverlayEntry? OverlayEntry { get; private set; }

  public FsusOverlayEntry Open(FsusOverlayHost host)
  {
    ArgumentNullException.ThrowIfNull(host);
    Tree?.RefreshView();
    return IsOpen && OverlayEntry is not null
      ? OverlayEntry
      : host.Open(this, new FsusOverlayOptions
      {
        IsModal = false,
        CloseOnEscape = true,
        CloseOnPointerOutside = true,
        RestoreFocusTo = this,
      });
  }

  public ValueTask<bool> CloseAsync() =>
    OverlayEntry is null || overlayHost is null
      ? ValueTask.FromResult(false)
      : overlayHost.CloseAsync(OverlayEntry);

  public bool SelectNode(string key)
  {
    if (Tree?.FocusNode(key) != true)
    {
      return false;
    }

    SelectedKey = key;
    Tree.ToggleSelection(key);
    SyncState();
    return true;
  }

  public void OnOverlayOpened(FsusOverlayEntry entry)
  {
    OverlayEntry = entry;
    overlayHost = entry.Content.Parent as FsusOverlayHost;
    IsOpen = true;
    SyncState();
  }

  public void OnOverlayClosed(FsusOverlayCloseReason reason)
  {
    OverlayEntry = null;
    overlayHost = null;
    IsOpen = false;
    SyncState();
  }

  private void SyncState()
  {
    FsusComponentClasses.Ensure(this, "fsus-open", IsOpen);
    FsusComponentClasses.Ensure(this, "fsus-selected", !string.IsNullOrWhiteSpace(SelectedKey));
    AutomationProperties.SetName(this, FsusComponentClasses.ResolveName(AccessibleName, SelectedKey));
    AutomationProperties.SetControlTypeOverride(this, AutomationControlType.ComboBox);
    AutomationProperties.SetItemStatus(this, IsOpen ? "open tree" : "closed tree");
  }
}

public class FsusTreeTable : ContentControl
{
  private readonly List<FsusDataTableColumn> visibleColumns = [];

  public FsusTreeTable()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-tree-table");
    SyncState();
  }

  public string? AccessibleName { get; set; }
  public FsusTreeV2? Tree { get; set; }
  public Collection<FsusDataTableColumn> Columns { get; } = [];
  public int VisibleColumnLimit { get; set; } = 8;
  public FsusTreeTableBudget VirtualizationBudget { get; set; } = new(
    RealizedRows: 64,
    RealizedColumns: 12,
    RealizedCells: 768,
    MemoryKb: 1024d);
  public IReadOnlyList<FsusDataTableColumn> VisibleColumns => visibleColumns.AsReadOnly();
  public int RealizedRowCount => Tree?.RealizedRowCount ?? 0;
  public int RealizedColumnCount => visibleColumns.Count;
  public int RealizedCellCount => RealizedRowCount * RealizedColumnCount;
  public bool IsVirtualized =>
    Tree?.IsVirtualized == true || Columns.Count > VisibleColumnLimit;

  public void RefreshView()
  {
    Tree?.RefreshView();
    visibleColumns.Clear();
    visibleColumns.AddRange(Columns.Take(Math.Max(1, VisibleColumnLimit)));
    SyncState();
  }

  public FsusTreeTableBudgetResult EvaluateBudget() =>
    new(RealizedRowCount, RealizedColumnCount, RealizedCellCount, VirtualizationBudget);

  private void SyncState()
  {
    FsusComponentClasses.Ensure(this, "fsus-virtualized", IsVirtualized);
    AutomationProperties.SetName(this, FsusComponentClasses.ResolveName(AccessibleName, RealizedRowCount));
    AutomationProperties.SetControlTypeOverride(this, AutomationControlType.DataGrid);
    AutomationProperties.SetItemStatus(
      this,
      $"{RealizedRowCount.ToString(CultureInfo.InvariantCulture)} tree rows, {RealizedColumnCount.ToString(CultureInfo.InvariantCulture)} columns");
  }
}
