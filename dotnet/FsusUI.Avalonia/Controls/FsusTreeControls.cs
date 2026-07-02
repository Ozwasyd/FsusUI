using Avalonia.Automation;
using Avalonia.Automation.Peers;
using Avalonia.Controls;
using Avalonia.Input;
using FsusUI.Avalonia.Overlay;
using System.Collections.ObjectModel;
using System.Globalization;

namespace FsusUI.Avalonia.Controls;

public enum FsusTreeSelectionMode
{
  Single,
  Multiple,
}

public sealed class FsusTreeNode(string key, string label)
{
  public string Key { get; } = key;
  public string Label { get; set; } = label;
  public bool IsDisabled { get; set; }
  public bool HasLazyChildren { get; set; }
  public Collection<FsusTreeNode> Children { get; } = [];
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

public class FsusTree : ContentControl
{
  private readonly List<FsusTreeNodeView> flattenedNodes = [];
  private readonly HashSet<string> expandedKeys = new(StringComparer.Ordinal);
  private readonly HashSet<string> selectedKeys = new(StringComparer.Ordinal);
  private readonly HashSet<string> checkedKeys = new(StringComparer.Ordinal);
  private CancellationTokenSource? loadCancellation;
  private int loadVersion;

  public FsusTree()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-tree");
    Focusable = true;
    SyncState();
  }

  public string? AccessibleName { get; set; }
  public Collection<FsusTreeNode> Nodes { get; } = [];
  public FsusTreeSelectionMode SelectionMode { get; set; } = FsusTreeSelectionMode.Single;
  public bool Checkable { get; set; }
  public Func<FsusTreeNode, bool>? Filter { get; set; }
  public FsusTreeChildrenLoader? ChildrenLoader { get; set; }
  public string FocusedKey { get; private set; } = string.Empty;
  public bool LastLoadCanceled { get; private set; }
  public IReadOnlyList<FsusTreeNodeView> FlattenedNodes => flattenedNodes.AsReadOnly();
  public IReadOnlySet<string> ExpandedKeys => expandedKeys;
  public IReadOnlySet<string> SelectedKeys => selectedKeys;
  public IReadOnlySet<string> CheckedKeys => checkedKeys;

  public virtual void RefreshView()
  {
    flattenedNodes.Clear();
    if (Filter is null)
    {
      AddVisibleNodes(Nodes, 1);
    }
    else
    {
      AddFilteredNodes(Nodes, 1);
    }

    if (flattenedNodes.Count > 0 && !flattenedNodes.Any(node => node.Node.Key == FocusedKey))
    {
      FocusedKey = flattenedNodes[0].Node.Key;
    }

    SyncState();
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

    if (SelectionMode == FsusTreeSelectionMode.Single)
    {
      selectedKeys.Clear();
      selectedKeys.Add(key);
    }
    else if (!selectedKeys.Add(key))
    {
      selectedKeys.Remove(key);
    }

    FocusedKey = key;
    SyncState();
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
    SyncState();
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

    try
    {
      var children = await ChildrenLoader(node, cancellation.Token);
      if (cancellation.IsCancellationRequested || version != loadVersion)
      {
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
      return true;
    }
    catch (OperationCanceledException)
    {
      return false;
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
        SyncState();
        return ValueTask.FromResult(true);
      case Key.Up:
        FocusedKey = flattenedNodes[Math.Max(0, index - 1)].Node.Key;
        SyncState();
        return ValueTask.FromResult(true);
      case Key.Right:
        return ValueTask.FromResult(Expand(FocusedKey));
      case Key.Left:
        return ValueTask.FromResult(Collapse(FocusedKey));
      case Key.Space:
        return ValueTask.FromResult(ToggleSelection(FocusedKey));
      default:
        return ValueTask.FromResult(false);
    }
  }

  protected FsusTreeNode? FindNode(string key) => FindNode(Nodes, key);

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
