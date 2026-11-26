using Avalonia.Automation;
using Avalonia.Automation.Peers;
using Avalonia.Controls;
using FsusUI.Avalonia.Overlay;
using System.Collections.ObjectModel;
using System.Globalization;

namespace FsusUI.Avalonia.Controls;
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
