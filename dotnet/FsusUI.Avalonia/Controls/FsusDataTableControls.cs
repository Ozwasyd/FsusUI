using Avalonia.Automation;
using Avalonia.Automation.Peers;
using Avalonia.Controls;
using Avalonia.Input;
using System.Collections.ObjectModel;
using System.Globalization;

namespace FsusUI.Avalonia.Controls;

public enum FsusDataTableState
{
  Ready,
  Loading,
  Error,
}

public enum FsusSortDirection
{
  None,
  Ascending,
  Descending,
}

public enum FsusDataTableFixedColumn
{
  None,
  Left,
  Right,
}

public sealed record FsusDataTableCellAddress(int RowIndex, int ColumnIndex);

public sealed record FsusDataTableCellContext(
  FsusDataTableRow Row,
  FsusDataTableColumn Column,
  object? Value,
  int RowIndex,
  int ColumnIndex);

public sealed record FsusDataTableRowState(
  string Key,
  bool Selected,
  bool Expanded,
  int RowIndex,
  int RowCount);

public sealed record FsusDataTableColumnState(
  string Key,
  bool Sortable,
  FsusSortDirection SortDirection,
  string SortDirectionName,
  int ColumnIndex,
  int ColumnCount);

public sealed record FsusDataTableVirtualizationBudget(
  int RetainedCellControls,
  double FirstLayoutMs,
  double AllocationsKb);

public sealed record FsusDataTableBudgetResult(
  int RowCount,
  int ColumnCount,
  int EstimatedRetainedCellControls,
  FsusDataTableVirtualizationBudget Budget)
{
  public bool WithinBudget => EstimatedRetainedCellControls <= Budget.RetainedCellControls;

  public override string ToString() =>
    string.Create(
      CultureInfo.InvariantCulture,
      $"rows={RowCount}, columns={ColumnCount}, retained={EstimatedRetainedCellControls}/{Budget.RetainedCellControls}");
}

public static class FsusDataTableBudgets
{
  public static int[] StandardRowFixtureSizes => [1000, 10_000, 100_000];
  public static int[] StandardColumnFixtureSizes => [8, 24, 80];
  public static FsusDataTableVirtualizationBudget DefaultVirtualizationBudget { get; } = new(
    RetainedCellControls: 720,
    FirstLayoutMs: 9d,
    AllocationsKb: 256d);
}

public sealed class FsusDataTableColumn
{
  public FsusDataTableColumn(string key, string header)
  {
    ArgumentException.ThrowIfNullOrWhiteSpace(key);
    Key = key;
    Header = header;
  }

  public string Key { get; }
  public string Header { get; set; }
  public bool Sortable { get; set; }
  public bool Resizable { get; set; } = true;
  public bool Reorderable { get; set; } = true;
  public double Width { get; set; } = 120d;
  public FsusDataTableFixedColumn Fixed { get; set; }
  public Func<FsusDataTableColumn, object?>? HeaderRenderer { get; set; }
  public Func<FsusDataTableCellContext, object?>? CellRenderer { get; set; }

  public object? RenderHeader() => HeaderRenderer?.Invoke(this) ?? Header;
}

public sealed class FsusDataTableRow
{
  private FsusDataTableRow(string key, IReadOnlyDictionary<string, object?> values)
  {
    ArgumentException.ThrowIfNullOrWhiteSpace(key);
    Key = key;
    Values = values;
  }

  public string Key { get; }
  public IReadOnlyDictionary<string, object?> Values { get; }

  public static FsusDataTableRow From(string key, IReadOnlyDictionary<string, object?> values) =>
    new(key, new ReadOnlyDictionary<string, object?>(new Dictionary<string, object?>(values)));

  public object? GetValue(string columnKey) =>
    Values.TryGetValue(columnKey, out var value) ? value : null;

  public string GetString(string columnKey) =>
    Convert.ToString(GetValue(columnKey), CultureInfo.InvariantCulture) ?? string.Empty;
}

public class FsusTable : ContentControl
{
  public FsusTable()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-table");
    Focusable = true;
    SyncTableAutomation("ready", "0 rows, 0 columns");
  }

  public string? AccessibleName { get; set; }
  public Collection<FsusDataTableColumn> Columns { get; } = [];

  protected void SyncTableAutomation(string stateName, string status)
  {
    AutomationProperties.SetName(this, FsusComponentClasses.ResolveName(AccessibleName, stateName));
    AutomationProperties.SetControlTypeOverride(this, AutomationControlType.DataGrid);
    AutomationProperties.SetItemStatus(this, status);
  }
}

public class FsusDataTable : FsusTable
{
  private readonly List<FsusDataTableRow> viewRows = [];
  private readonly List<FsusDataTableRow> visibleRows = [];
  private readonly List<FsusDataTableColumn> visibleColumns = [];
  private readonly HashSet<string> selectedRowKeys = new(StringComparer.Ordinal);
  private readonly HashSet<string> expandedRowKeys = new(StringComparer.Ordinal);
  private int virtualizedRowStartIndex;
  private int virtualizedColumnStartIndex;
  private FsusDataTableState state = FsusDataTableState.Ready;

  public FsusDataTable()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-data-table");
    SyncState();
  }

  public Collection<FsusDataTableRow> Rows { get; } = [];
  public Func<FsusDataTableRow, bool>? Filter { get; set; }
  public string? SortColumnKey { get; private set; }
  public FsusSortDirection SortDirection { get; private set; } = FsusSortDirection.None;
  public string LoadingText { get; set; } = "Loading rows";
  public string EmptyText { get; set; } = "No rows";
  public string ErrorText { get; set; } = "Unable to load rows";
  public string? ErrorMessage { get; set; }
  public int VirtualizationThreshold { get; set; } = 250;
  public int VisibleRowLimit { get; set; } = 40;
  public int VisibleColumnLimit { get; set; } = 12;
  public FsusDataTableVirtualizationBudget VirtualizationBudget { get; set; } =
    FsusDataTableBudgets.DefaultVirtualizationBudget;
  public FsusDataTableCellAddress FocusedCell { get; private set; } = new(0, 0);

  public FsusDataTableState State
  {
    get => state;
    set
    {
      state = value;
      SyncState();
    }
  }

  public IReadOnlyList<FsusDataTableRow> ViewRows => viewRows.AsReadOnly();
  public IReadOnlyList<FsusDataTableRow> VisibleRows => visibleRows.AsReadOnly();
  public IReadOnlyList<FsusDataTableColumn> VisibleColumns => visibleColumns.AsReadOnly();
  public IReadOnlySet<string> SelectedRowKeys => selectedRowKeys;
  public IReadOnlySet<string> ExpandedRowKeys => expandedRowKeys;
  public IReadOnlyList<FsusDataTableColumn> FixedLeftColumns =>
    Columns.Where(column => column.Fixed == FsusDataTableFixedColumn.Left).ToArray();
  public IReadOnlyList<FsusDataTableColumn> FixedRightColumns =>
    Columns.Where(column => column.Fixed == FsusDataTableFixedColumn.Right).ToArray();
  public IReadOnlyList<FsusDataTableColumn> FixedColumns =>
    Columns.Where(column => column.Fixed != FsusDataTableFixedColumn.None).ToArray();
  public bool IsRowVirtualized => viewRows.Count > VirtualizationThreshold;
  public bool IsColumnVirtualized => Columns.Count > VisibleColumnLimit;
  public int VirtualizedRowStartIndex => virtualizedRowStartIndex;
  public int VirtualizedColumnStartIndex => virtualizedColumnStartIndex;
  public int EstimatedRetainedCellControls =>
    (VisibleRows.Count * VisibleColumns.Count) +
    (VisibleRows.Count * FixedColumns.Count) +
    VisibleColumns.Count +
    16;
  public string DisplayText =>
    State switch
    {
      FsusDataTableState.Loading => LoadingText,
      FsusDataTableState.Error => string.IsNullOrWhiteSpace(ErrorMessage) ? ErrorText : ErrorMessage!,
      _ when viewRows.Count == 0 => EmptyText,
      _ => string.Empty,
    };
  public string FocusedCellStatus =>
    viewRows.Count == 0 || Columns.Count == 0
      ? "no cells"
      : $"row {(FocusedCell.RowIndex + 1).ToString(CultureInfo.InvariantCulture)} of {viewRows.Count.ToString(CultureInfo.InvariantCulture)}, column {(FocusedCell.ColumnIndex + 1).ToString(CultureInfo.InvariantCulture)} of {Columns.Count.ToString(CultureInfo.InvariantCulture)}";

  public void RefreshView()
  {
    viewRows.Clear();
    var filtered = Filter is null ? Rows : Rows.Where(Filter);
    var ordered = ApplySort(filtered);
    viewRows.AddRange(ordered);
    ClampFocus();
    ClampVirtualizedStarts();
    RebuildVisibleWindows();
    SyncState();
  }

  public bool SortBy(string columnKey, FsusSortDirection direction)
  {
    var column = Columns.FirstOrDefault(entry => entry.Key == columnKey);
    if (column is null || !column.Sortable)
    {
      return false;
    }

    SortColumnKey = direction == FsusSortDirection.None ? null : columnKey;
    SortDirection = direction;
    RefreshView();
    return true;
  }

  public object? RenderCell(
    FsusDataTableRow row,
    FsusDataTableColumn column,
    int rowIndex,
    int columnIndex)
  {
    var value = row.GetValue(column.Key);
    return column.CellRenderer?.Invoke(new FsusDataTableCellContext(row, column, value, rowIndex, columnIndex)) ?? value;
  }

  public bool ToggleRowSelection(string rowKey)
  {
    if (!Rows.Any(row => row.Key == rowKey))
    {
      return false;
    }

    if (!selectedRowKeys.Add(rowKey))
    {
      selectedRowKeys.Remove(rowKey);
    }

    SyncState();
    return true;
  }

  public bool ToggleRowExpansion(string rowKey)
  {
    if (!Rows.Any(row => row.Key == rowKey))
    {
      return false;
    }

    if (!expandedRowKeys.Add(rowKey))
    {
      expandedRowKeys.Remove(rowKey);
    }

    SyncState();
    return true;
  }

  public bool IsRowSelected(string rowKey) => selectedRowKeys.Contains(rowKey);

  public FsusDataTableRowState GetRowState(string rowKey)
  {
    var index = viewRows.FindIndex(row => row.Key == rowKey);
    return new FsusDataTableRowState(
      rowKey,
      selectedRowKeys.Contains(rowKey),
      expandedRowKeys.Contains(rowKey),
      index < 0 ? 0 : index + 1,
      viewRows.Count);
  }

  public FsusDataTableColumnState GetColumnState(string columnKey)
  {
    var index = Columns.Select((column, columnIndex) => (column, columnIndex))
      .FirstOrDefault(entry => entry.column.Key == columnKey);
    var direction = SortColumnKey == columnKey ? SortDirection : FsusSortDirection.None;
    return new FsusDataTableColumnState(
      columnKey,
      index.column?.Sortable ?? false,
      direction,
      direction.ToString().ToLower(CultureInfo.InvariantCulture),
      index.column is null ? 0 : index.columnIndex + 1,
      Columns.Count);
  }

  public void ScrollTo(int rowStartIndex, int columnStartIndex)
  {
    virtualizedRowStartIndex = rowStartIndex;
    virtualizedColumnStartIndex = columnStartIndex;
    ClampVirtualizedStarts();
    RebuildVisibleWindows();
    SyncState();
  }

  public FsusDataTableBudgetResult EvaluateBudget(int rowCount, int columnCount) =>
    new(rowCount, columnCount, EstimatedRetainedCellControls, VirtualizationBudget);

  protected ValueTask<bool> HandleKeyAsync(Key key)
  {
    if (viewRows.Count == 0 || Columns.Count == 0)
    {
      return ValueTask.FromResult(false);
    }

    switch (key)
    {
      case Key.Right:
        FocusedCell = FocusedCell with { ColumnIndex = Math.Min(Columns.Count - 1, FocusedCell.ColumnIndex + 1) };
        break;
      case Key.Left:
        FocusedCell = FocusedCell with { ColumnIndex = Math.Max(0, FocusedCell.ColumnIndex - 1) };
        break;
      case Key.Down:
        FocusedCell = FocusedCell with { RowIndex = Math.Min(viewRows.Count - 1, FocusedCell.RowIndex + 1) };
        break;
      case Key.Up:
        FocusedCell = FocusedCell with { RowIndex = Math.Max(0, FocusedCell.RowIndex - 1) };
        break;
      case Key.Home:
        FocusedCell = FocusedCell with { ColumnIndex = 0 };
        break;
      case Key.End:
        FocusedCell = FocusedCell with { ColumnIndex = Columns.Count - 1 };
        break;
      case Key.Space:
        ToggleRowSelection(viewRows[FocusedCell.RowIndex].Key);
        break;
      case Key.Enter:
        ToggleRowExpansion(viewRows[FocusedCell.RowIndex].Key);
        break;
      default:
        return ValueTask.FromResult(false);
    }

    EnsureFocusedCellVisible();
    RebuildVisibleWindows();
    SyncState();
    return ValueTask.FromResult(true);
  }

  private IEnumerable<FsusDataTableRow> ApplySort(IEnumerable<FsusDataTableRow> rows)
  {
    if (SortDirection == FsusSortDirection.None || string.IsNullOrWhiteSpace(SortColumnKey))
    {
      return rows.ToArray();
    }

    var ordered = rows.OrderBy(row => row.GetValue(SortColumnKey), FsusDataTableValueComparer.Instance);
    return SortDirection == FsusSortDirection.Descending
      ? ordered.Reverse().ToArray()
      : ordered.ToArray();
  }

  private void ClampFocus()
  {
    FocusedCell = new FsusDataTableCellAddress(
      Math.Clamp(FocusedCell.RowIndex, 0, Math.Max(0, viewRows.Count - 1)),
      Math.Clamp(FocusedCell.ColumnIndex, 0, Math.Max(0, Columns.Count - 1)));
  }

  private void EnsureFocusedCellVisible()
  {
    if (FocusedCell.RowIndex < virtualizedRowStartIndex)
    {
      virtualizedRowStartIndex = FocusedCell.RowIndex;
    }
    else if (FocusedCell.RowIndex >= virtualizedRowStartIndex + Math.Max(1, VisibleRowLimit))
    {
      virtualizedRowStartIndex = FocusedCell.RowIndex - Math.Max(1, VisibleRowLimit) + 1;
    }

    if (FocusedCell.ColumnIndex < virtualizedColumnStartIndex)
    {
      virtualizedColumnStartIndex = FocusedCell.ColumnIndex;
    }
    else if (FocusedCell.ColumnIndex >= virtualizedColumnStartIndex + Math.Max(1, VisibleColumnLimit))
    {
      virtualizedColumnStartIndex = FocusedCell.ColumnIndex - Math.Max(1, VisibleColumnLimit) + 1;
    }

    ClampVirtualizedStarts();
  }

  private void ClampVirtualizedStarts()
  {
    virtualizedRowStartIndex = Math.Clamp(
      virtualizedRowStartIndex,
      0,
      Math.Max(0, viewRows.Count - Math.Max(1, VisibleRowLimit)));
    virtualizedColumnStartIndex = Math.Clamp(
      virtualizedColumnStartIndex,
      0,
      Math.Max(0, Columns.Count - Math.Max(1, VisibleColumnLimit)));
  }

  private void RebuildVisibleWindows()
  {
    visibleRows.Clear();
    visibleColumns.Clear();
    visibleRows.AddRange(IsRowVirtualized
      ? viewRows.Skip(virtualizedRowStartIndex).Take(Math.Max(1, VisibleRowLimit))
      : viewRows);
    visibleColumns.AddRange(IsColumnVirtualized
      ? Columns.Skip(virtualizedColumnStartIndex).Take(Math.Max(1, VisibleColumnLimit))
      : Columns);
  }

  private void SyncState()
  {
    var stateName = EffectiveStateName();
    foreach (var className in new[] { "fsus-ready", "fsus-empty", "fsus-loading", "fsus-error" })
    {
      FsusComponentClasses.Ensure(this, className, false);
    }

    FsusComponentClasses.Ensure(this, $"fsus-{stateName}", true);
    FsusComponentClasses.Ensure(this, "fsus-virtualized", IsRowVirtualized || IsColumnVirtualized);
    FsusComponentClasses.Ensure(this, "fsus-row-virtualized", IsRowVirtualized);
    FsusComponentClasses.Ensure(this, "fsus-column-virtualized", IsColumnVirtualized);
    FsusComponentClasses.Ensure(this, "fsus-has-selection", selectedRowKeys.Count > 0);
    SyncTableAutomation(
      stateName,
      $"{stateName}, {viewRows.Count.ToString(CultureInfo.InvariantCulture)} rows, {Columns.Count.ToString(CultureInfo.InvariantCulture)} columns, cell {FocusedCellStatus}");
  }

  private string EffectiveStateName() =>
    State switch
    {
      FsusDataTableState.Loading => "loading",
      FsusDataTableState.Error => "error",
      _ when viewRows.Count == 0 => "empty",
      _ => "ready",
    };

  private sealed class FsusDataTableValueComparer : IComparer<object?>
  {
    public static FsusDataTableValueComparer Instance { get; } = new();

    public int Compare(object? x, object? y)
    {
      if (ReferenceEquals(x, y))
      {
        return 0;
      }

      if (x is null)
      {
        return -1;
      }

      if (y is null)
      {
        return 1;
      }

      if (x is IComparable comparable && x.GetType().IsInstanceOfType(y))
      {
        return comparable.CompareTo(y);
      }

      return string.Compare(
        Convert.ToString(x, CultureInfo.InvariantCulture),
        Convert.ToString(y, CultureInfo.InvariantCulture),
        StringComparison.Ordinal);
    }
  }
}
