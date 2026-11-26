using Avalonia;
using Avalonia.Automation;
using Avalonia.Automation.Peers;
using Avalonia.Controls;
using Avalonia.Controls.Templates;
using Avalonia.Input;
using Avalonia.Threading;
using System.Collections.ObjectModel;
using System.Globalization;

namespace FsusUI.Avalonia.Controls;

public sealed record FsusTableV2Budget(
  int RealizedRows,
  int RealizedColumns,
  int RealizedCells,
  double ScrollLatencyMs,
  double MemoryKb);

public sealed record FsusTableV2BudgetResult(
  int RealizedRowCount,
  int RealizedColumnCount,
  int RealizedCellCount,
  FsusTableV2Budget Budget)
{
  public bool WithinBudget =>
    RealizedRowCount <= Budget.RealizedRows &&
    RealizedColumnCount <= Budget.RealizedColumns &&
    RealizedCellCount <= Budget.RealizedCells;
}

public sealed record FsusTableV2RowsRendered(
  int StartIndex,
  int StopIndex,
  int VisibleStartIndex,
  int VisibleStopIndex);

public sealed record FsusTableV2ScrollPosition(double ScrollLeft, double ScrollTop);

public sealed record FsusTableV2RowExpansion(FsusDataTableRow Row, bool Expanded);

public sealed record FsusTableV2Sort(string Key, FsusSortDirection Order);

public sealed record FsusTableV2HeaderContext(
  IReadOnlyList<object?> Cells,
  IReadOnlyList<FsusDataTableColumn> Columns,
  int HeaderIndex);

public sealed record FsusTableV2HeaderCellContext(
  IReadOnlyList<FsusDataTableColumn> Columns,
  FsusDataTableColumn Column,
  int ColumnIndex,
  int HeaderIndex,
  IReadOnlyDictionary<string, object?> Style);

public sealed record FsusTableV2RowContext(
  IReadOnlyList<object?> Cells,
  IReadOnlyDictionary<string, object?> Style,
  IReadOnlyList<FsusDataTableColumn> Columns,
  int Depth,
  FsusDataTableRow RowData,
  int RowIndex,
  bool IsScrolling);

public class FsusAutoResizer : ContentControl
{
  public FsusAutoResizer()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-auto-resizer");
    SyncState();
  }

  public string? AccessibleName { get; set; }
  public bool DisableHeight { get; set; }
  public bool DisableWidth { get; set; }
  public Action<Size> OnResize { get; set; } = static _ => { };
  public Size Viewport { get; set; }

  public bool Resize(Size viewport)
  {
    var next = new Size(
      DisableWidth ? Viewport.Width : viewport.Width,
      DisableHeight ? Viewport.Height : viewport.Height);
    if (Viewport == next)
    {
      return false;
    }

    Viewport = next;
    SyncState();
    OnResize(next);
    return true;
  }

  protected override Size ArrangeOverride(Size finalSize)
  {
    var arranged = base.ArrangeOverride(finalSize);
    Resize(finalSize);
    return arranged;
  }

  private void SyncState()
  {
    AutomationProperties.SetName(this, FsusComponentClasses.ResolveName(AccessibleName, Viewport));
    AutomationProperties.SetControlTypeOverride(this, AutomationControlType.Group);
    AutomationProperties.SetItemStatus(
      this,
      $"{Viewport.Width.ToString(CultureInfo.InvariantCulture)} x {Viewport.Height.ToString(CultureInfo.InvariantCulture)}");
  }
}

public class FsusTableV2 : ContentControl
{
  public static readonly StyledProperty<double> HeaderHeightProperty =
    AvaloniaProperty.Register<FsusTableV2, double>(nameof(HeaderHeight), 50d);
  public static readonly StyledProperty<int> OverscanProperty =
    AvaloniaProperty.Register<FsusTableV2, int>(nameof(Overscan), 2);

  private readonly Dictionary<(int Row, int Column), FsusTableV2CellContainer> realizedCells = [];
  private readonly Dictionary<int, double> rowMeasurementCache = [];
  private readonly Queue<int> rowMeasurementOrder = [];
  private readonly Queue<FsusTableV2CellContainer> cellPool = [];
  private readonly FsusVariableSizeIndex rowSizeIndex = new();
  private readonly Canvas cellHost = new();
  private readonly Canvas headerCellHost = new();
  private readonly Canvas rowContentHost = new();
  private readonly ContentControl emptyHost = new();
  private readonly ContentControl footerHost = new();
  private readonly Canvas headerHost = new();
  private readonly ContentControl overlayHost = new();
  private readonly Grid bodyViewport = new();
  private readonly Grid scrollContent = new();
  private readonly Grid rootGrid = new();
  private readonly ScrollViewer scrollViewer = new();
  private readonly List<int> loadedRowIndex = [];
  private Size viewport = new(960, 480);
  private int realizedRowStartIndex;
  private int realizedColumnStartIndex;
  private int realizedRowCount;
  private int realizedColumnCount;
  private int nextContainerId;
  private CancellationTokenSource? backgroundCancellation;
  private int backgroundVersion;
  private bool isApplyingScroll;
  private string? lastAutomationName;
  private string? lastAutomationStatus;

  public FsusTableV2()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-table-v2");
    Focusable = true;
    scrollContent.Children.Add(cellHost);
    scrollContent.Children.Add(rowContentHost);
    scrollViewer.Content = scrollContent;
    bodyViewport.Children.Add(scrollViewer);
    bodyViewport.Children.Add(emptyHost);
    bodyViewport.Children.Add(overlayHost);
    rootGrid.RowDefinitions.Add(new RowDefinition(GridLength.Auto));
    rootGrid.RowDefinitions.Add(new RowDefinition(new GridLength(1, GridUnitType.Star)));
    rootGrid.RowDefinitions.Add(new RowDefinition(GridLength.Auto));
    var headerLayer = new Grid();
    headerLayer.Children.Add(headerCellHost);
    headerLayer.Children.Add(headerHost);
    rootGrid.Children.Add(headerLayer);
    Grid.SetRow(bodyViewport, 1);
    rootGrid.Children.Add(bodyViewport);
    Grid.SetRow(footerHost, 2);
    rootGrid.Children.Add(footerHost);
    scrollViewer.ScrollChanged += (_, _) =>
    {
      if (isApplyingScroll)
      {
        return;
      }

      if (scrollViewer.Viewport.Width > 0 && scrollViewer.Viewport.Height > 0)
      {
        viewport = scrollViewer.Viewport;
        ViewportWidth = viewport.Width;
        ViewportHeight = viewport.Height;
      }
      EnsureRowSizeIndex();
      realizedRowStartIndex = ResolveRowStart(scrollViewer.Offset.Y);
      realizedColumnStartIndex = ResolveStart(scrollViewer.Offset.X, ColumnWidth, EffectiveColumnCount, realizedColumnCount);
      RefreshLayout(updateScrollViewer: false);
      NotifyScroll();
    };
    Content = rootGrid;
    SyncState();
  }

  public string? AccessibleName { get; set; }
  public Collection<FsusDataTableColumn> Columns { get; } = [];
  public Collection<FsusDataTableRow> Data { get; } = [];
  public Collection<FsusDataTableRow> FixedData { get; } = [];
  public Collection<string> DefaultExpandedRowKeys { get; } = [];
  public Collection<string> ExpandedRowKeys { get; } = [];
  public double HeaderHeight
  {
    get => GetValue(HeaderHeightProperty);
    set => SetValue(HeaderHeightProperty, value);
  }
  public Collection<double> HeaderHeights { get; } = [];
  public string RowKey { get; set; } = "id";
  public string? ExpandColumnKey { get; set; }
  public int RowCount { get; set; }
  public int ColumnCount { get; set; }
  public double FooterHeight { get; set; }
  public double ViewportWidth { get; set; } = 960d;
  public double ViewportHeight { get; set; } = 480d;
  public double? ViewportMaxHeight { get; set; }
  public double RowHeight { get; set; } = 32d;
  public double? EstimatedRowHeight { get; set; }
  public double ColumnWidth { get; set; } = 120d;
  public int Overscan
  {
    get => GetValue(OverscanProperty);
    set => SetValue(OverscanProperty, value);
  }
  public int FrozenRowCount { get; set; }
  public int FrozenColumnCount { get; set; }
  public int ContainerPoolLimit { get; set; } = 1536;
  public int RetainedRowMeasurementLimit { get; set; } = 2048;
  public int LoadedRowIndexLimit { get; set; } = 4096;
  public Func<int, int, object?>? CellProvider { get; set; }
  public Func<FsusDataTableCellContext, object?>? DataGetter { get; set; }
  public IDataTemplate? CellTemplate { get; set; }
  public IDataTemplate? CellContent
  {
    get => CellTemplate;
    set => CellTemplate = value;
  }
  public IDataTemplate? EmptyContent { get; set; }
  public IDataTemplate? FooterContent { get; set; }
  public IDataTemplate? HeaderCellContent { get; set; }
  public IDataTemplate? HeaderContent { get; set; }
  public IDataTemplate? OverlayContent { get; set; }
  public IDataTemplate? RowContent { get; set; }
  public Action<double>? OnEndReached { get; set; }
  public Action<FsusTableV2Sort>? OnColumnSort { get; set; }
  public Action<IReadOnlyList<string>>? OnExpandedRowsChange { get; set; }
  public Action<FsusTableV2RowExpansion>? OnRowExpand { get; set; }
  public Action<FsusTableV2RowsRendered>? OnRowsRendered { get; set; }
  public Action<FsusTableV2ScrollPosition>? OnScroll { get; set; }
  public FsusTableV2Sort? SortBy { get; private set; }
  public FsusTableV2Sort? SortState { get; set; }
  public int FocusedRowIndex { get; private set; }
  public int FocusedColumnIndex { get; private set; }
  public FsusTableV2Budget VirtualizationBudget { get; set; } = new(
    RealizedRows: 64,
    RealizedColumns: 24,
    RealizedCells: 1536,
    ScrollLatencyMs: 10d,
    MemoryKb: 1024d);

  public bool IsVirtualized =>
    EffectiveRowCount > RealizedRowCount || EffectiveColumnCount > RealizedColumnCount;
  public int EffectiveRowCount =>
    FixedData.Count + (Data.Count > 0 ? Data.Count : RowCount);
  public int EffectiveColumnCount => Columns.Count > 0 ? Columns.Count : ColumnCount;
  public int RealizedRowStartIndex => realizedRowStartIndex;
  public int RealizedColumnStartIndex => realizedColumnStartIndex;
  public int RealizedRowCount => realizedRowCount;
  public int RealizedColumnCount => realizedColumnCount;
  public int RealizedCellCount => realizedCells.Count;
  public int RealizedVisualCount => cellHost.Children.Count;
  public int RecycledCellCount { get; private set; }
  public int CreatedCellCount { get; private set; }
  public int DiscardedCellCount { get; private set; }
  public int CellPoolCount => cellPool.Count;
  internal int HeaderContentPresenterCount =>
    headerCellHost.Children.Count + headerHost.Children.Count;
  internal int RowContentPresenterCount => rowContentHost.Children.Count;
  internal bool IsEmptyContentVisible => emptyHost.IsVisible;
  internal bool IsFooterContentVisible => footerHost.IsVisible;
  internal bool IsOverlayContentVisible => overlayHost.IsVisible;
  public int RetainedRowMeasurementCount => rowMeasurementCache.Count;
  public int AutomationUpdateCount { get; private set; }
  public bool LastBackgroundCanceled { get; private set; }
  public int BackgroundVersion => backgroundVersion;
  public Canvas VisualHost => cellHost;
  public ScrollViewer ScrollHost => scrollViewer;
  public IReadOnlyCollection<FsusTableV2CellContainer> RealizedCells => realizedCells.Values;
  public IReadOnlyList<int> LoadedRowIndex => loadedRowIndex;
  public string FocusedCellStatus =>
    $"row {(FocusedRowIndex + 1).ToString(CultureInfo.InvariantCulture)} of {EffectiveRowCount.ToString(CultureInfo.InvariantCulture)}, column {(FocusedColumnIndex + 1).ToString(CultureInfo.InvariantCulture)} of {EffectiveColumnCount.ToString(CultureInfo.InvariantCulture)}";

  public void AttachResizer(FsusAutoResizer resizer)
  {
    ArgumentNullException.ThrowIfNull(resizer);
    viewport = resizer.Viewport.Width <= 0 || resizer.Viewport.Height <= 0
      ? viewport
      : resizer.Viewport;
    ViewportWidth = viewport.Width;
    ViewportHeight = viewport.Height;
    scrollViewer.Width = viewport.Width;
    scrollViewer.Height = viewport.Height;
  }

  public void RefreshLayout() => RefreshLayout(updateScrollViewer: true);

  private void RefreshLayout(bool updateScrollViewer)
  {
    viewport = new Size(
      Math.Max(1d, ViewportWidth),
      Math.Max(1d, Math.Min(ViewportHeight, ViewportMaxHeight ?? double.PositiveInfinity)));
    scrollViewer.Width = viewport.Width;
    scrollViewer.Height = viewport.Height;
    var rowCount = EffectiveRowCount;
    var columnCount = EffectiveColumnCount;
    EnsureRowSizeIndex();
    realizedRowCount = Math.Min(
      rowCount,
      ResolveVisibleRowCount(rowCount));
    realizedColumnCount = Math.Min(
      columnCount,
      Math.Max(1, (int)Math.Ceiling(viewport.Width / Math.Max(1d, ColumnWidth)) + Math.Max(0, Overscan)));
    ClampStarts();
    var rows = ResolveAxisIndices(
      realizedRowStartIndex,
      realizedRowCount,
      rowCount,
      FrozenRowCount,
      Enumerable.Range(0, FixedData.Count));
    var fixedColumns = Columns
      .Select((column, index) => (column, index))
      .Where(entry => entry.column.Fixed != FsusDataTableFixedColumn.None)
      .Select(entry => entry.index);
    var columns = ResolveAxisIndices(
      realizedColumnStartIndex,
      realizedColumnCount,
      columnCount,
      FrozenColumnCount,
      fixedColumns);
    var desired = new HashSet<(int Row, int Column)>();
    foreach (var row in rows)
    {
      foreach (var column in columns)
      {
        desired.Add((row, column));
      }
    }

    var staleCells = realizedCells
      .Where(pair => !desired.Contains(pair.Key))
      .ToArray();
    var missingCells = desired
      .Where(key => !realizedCells.ContainsKey(key))
      .ToArray();
    var reboundCount = Math.Min(staleCells.Length, missingCells.Length);
    for (var position = 0; position < reboundCount; position++)
    {
      var stale = staleCells[position];
      realizedCells.Remove(stale.Key);
      realizedCells[missingCells[position]] = stale.Value;
      RecycledCellCount++;
    }
    for (var position = reboundCount; position < staleCells.Length; position++)
    {
      var stale = staleCells[position];
      realizedCells.Remove(stale.Key);
      cellHost.Children.Remove(stale.Value);
      RecycleCell(stale.Value);
    }
    for (var position = reboundCount; position < missingCells.Length; position++)
    {
      var container = AcquireCell();
      realizedCells[missingCells[position]] = container;
      cellHost.Children.Add(container);
    }

    foreach (var key in desired)
    {
      var container = realizedCells[key];
      var sourceRow = ResolveSourceRow(key.Row);
      var dataRow = ResolveDataRow(sourceRow);
      var column = key.Column < Columns.Count ? Columns[key.Column] : null;
      var content = CellProvider?.Invoke(sourceRow, key.Column) ??
        (dataRow is not null && column is not null
          ? ResolveCellContent(dataRow, column, sourceRow, key.Column)
          : $"R{sourceRow + 1} C{key.Column + 1}");
      container.Bind(key.Row, key.Column, content, CellTemplate, ColumnWidth, RowHeight);
      Canvas.SetLeft(container, key.Column * Math.Max(1d, ColumnWidth));
      Canvas.SetTop(container, ResolveRowOffset(key.Row));
      container.Height = ResolveRowHeight(key.Row);
    }

    cellHost.Width = Math.Max(0, columnCount) * Math.Max(1d, ColumnWidth);
    cellHost.Height = ResolveTotalRowHeight();
    scrollContent.Width = cellHost.Width;
    scrollContent.Height = cellHost.Height;
    RefreshContentRegions(rowCount, columnCount, rows);
    if (updateScrollViewer)
    {
      ApplyScrollOffset();
    }
    NotifyRowsRendered();
    SyncState();
  }

  public void ScrollToCell(int rowIndex, int columnIndex)
  {
    FocusedRowIndex = Math.Clamp(rowIndex, 0, Math.Max(0, EffectiveRowCount - 1));
    FocusedColumnIndex = Math.Clamp(columnIndex, 0, Math.Max(0, EffectiveColumnCount - 1));
    realizedRowStartIndex = Math.Clamp(FocusedRowIndex - Math.Max(0, Overscan), 0, Math.Max(0, EffectiveRowCount - Math.Max(1, realizedRowCount)));
    realizedColumnStartIndex = Math.Clamp(FocusedColumnIndex - Math.Max(0, Overscan), 0, Math.Max(0, EffectiveColumnCount - Math.Max(1, realizedColumnCount)));
    RefreshLayout();
    if (realizedCells.TryGetValue((FocusedRowIndex, FocusedColumnIndex), out var container))
    {
      container.Focus();
    }
  }

  public void ScrollTo(double scrollLeft, double scrollTop)
  {
    realizedColumnStartIndex = ResolveStart(scrollLeft, ColumnWidth, EffectiveColumnCount, realizedColumnCount);
    EnsureRowSizeIndex();
    realizedRowStartIndex = ResolveRowStart(scrollTop);
    RefreshLayout();
    NotifyScroll();
  }

  public void ScrollToLeft(double scrollLeft) =>
    ScrollTo(scrollLeft, ResolveRowOffset(realizedRowStartIndex));

  public void ScrollToRow(int rowIndex) => ScrollToCell(rowIndex, FocusedColumnIndex);

  public void ScrollToTop(double scrollTop) =>
    ScrollTo(realizedColumnStartIndex * Math.Max(1d, ColumnWidth), scrollTop);

  public void SetMeasuredRowHeight(int rowIndex, double height)
  {
    if (rowIndex < 0 || rowIndex >= EffectiveRowCount)
    {
      return;
    }

    EnsureRowSizeIndex();
    var nextHeight = Math.Max(1d, height);
    var previousHeight = ResolveRowHeight(rowIndex);
    if (!rowMeasurementCache.ContainsKey(rowIndex))
    {
      rowMeasurementOrder.Enqueue(rowIndex);
    }
    rowMeasurementCache[rowIndex] = nextHeight;
    rowSizeIndex.Update(rowIndex, previousHeight, nextHeight);
    TrimRowMeasurementCache();
    RefreshLayout();
  }

  public bool SetRowExpanded(string rowKey, bool expanded)
  {
    ArgumentException.ThrowIfNullOrWhiteSpace(rowKey);
    var currentlyExpanded = ExpandedRowKeys.Contains(rowKey);
    if (currentlyExpanded == expanded)
    {
      return false;
    }
    if (expanded)
    {
      ExpandedRowKeys.Add(rowKey);
    }
    else
    {
      ExpandedRowKeys.Remove(rowKey);
    }
    var row = FixedData.Concat(Data).FirstOrDefault(candidate => candidate.Key == rowKey);
    if (row is not null)
    {
      OnRowExpand?.Invoke(new FsusTableV2RowExpansion(row, expanded));
    }
    OnExpandedRowsChange?.Invoke(ExpandedRowKeys.ToArray());
    return true;
  }

  public void ResetExpandedRows()
  {
    ExpandedRowKeys.Clear();
    foreach (var rowKey in DefaultExpandedRowKeys.Distinct(StringComparer.Ordinal))
    {
      ExpandedRowKeys.Add(rowKey);
    }
    OnExpandedRowsChange?.Invoke(ExpandedRowKeys.ToArray());
  }

  public bool SortColumn(string columnKey, FsusSortDirection direction)
  {
    ArgumentException.ThrowIfNullOrWhiteSpace(columnKey);
    if (!Columns.Any(column => column.Key == columnKey && column.Sortable))
    {
      return false;
    }

    var sorted = direction switch
    {
      FsusSortDirection.Ascending => Data
        .OrderBy(row => row.GetValue(columnKey), FsusTableV2ValueComparer.Instance)
        .ToArray(),
      FsusSortDirection.Descending => Data
        .OrderByDescending(row => row.GetValue(columnKey), FsusTableV2ValueComparer.Instance)
        .ToArray(),
      _ => Data.ToArray(),
    };
    Data.Clear();
    foreach (var row in sorted)
    {
      Data.Add(row);
    }
    SortBy = new FsusTableV2Sort(columnKey, direction);
    SortState = SortBy;
    RefreshLayout();
    OnColumnSort?.Invoke(SortBy);
    return true;
  }

  public async ValueTask<bool> UpdateRowIndexAsync(
    Func<CancellationToken, ValueTask<IReadOnlyList<int>>> provider)
  {
    ArgumentNullException.ThrowIfNull(provider);
    if (backgroundCancellation is not null)
    {
      LastBackgroundCanceled = true;
      backgroundCancellation.Cancel();
    }

    using var cancellation = new CancellationTokenSource();
    backgroundCancellation = cancellation;
    var version = ++backgroundVersion;
    try
    {
      var result = await provider(cancellation.Token);
      if (cancellation.IsCancellationRequested || version != backgroundVersion)
      {
        return false;
      }

      var bounded = result.Take(Math.Max(1, LoadedRowIndexLimit)).ToArray();
      await CommitOnUiThreadAsync(() =>
      {
        if (version != backgroundVersion)
        {
          return;
        }
        loadedRowIndex.Clear();
        loadedRowIndex.AddRange(bounded);
        RefreshLayout();
      });
      return true;
    }
    catch (OperationCanceledException)
    {
      return false;
    }
    finally
    {
      if (ReferenceEquals(backgroundCancellation, cancellation))
      {
        backgroundCancellation = null;
      }
    }
  }

  protected ValueTask<bool> HandleKeyAsync(Key key)
  {
    var row = FocusedRowIndex;
    var column = FocusedColumnIndex;
    switch (key)
    {
      case Key.Down:
        row++;
        break;
      case Key.Up:
        row--;
        break;
      case Key.Right:
        column++;
        break;
      case Key.Left:
        column--;
        break;
      default:
        return ValueTask.FromResult(false);
    }

    ScrollToCell(row, column);
    return ValueTask.FromResult(true);
  }

  protected override void OnKeyDown(KeyEventArgs e)
  {
    base.OnKeyDown(e);
    if (e.Handled)
    {
      return;
    }

    e.Handled = HandleKeyAsync(e.Key).GetAwaiter().GetResult();
  }

  public FsusTableV2BudgetResult EvaluateBudget() =>
    new(RealizedRowCount, RealizedColumnCount, RealizedCellCount, VirtualizationBudget);

  private void ClampStarts()
  {
    realizedRowStartIndex = Math.Clamp(realizedRowStartIndex, 0, Math.Max(0, EffectiveRowCount - Math.Max(1, realizedRowCount)));
    realizedColumnStartIndex = Math.Clamp(realizedColumnStartIndex, 0, Math.Max(0, EffectiveColumnCount - Math.Max(1, realizedColumnCount)));
  }

  private static int ResolveStart(double offset, double size, int count, int realizedCount) =>
    Math.Clamp(
      (int)Math.Floor(Math.Max(0d, offset) / Math.Max(1d, size)),
      0,
      Math.Max(0, count - Math.Max(1, realizedCount)));

  private static int[] ResolveAxisIndices(
    int start,
    int count,
    int total,
    int frozen,
    IEnumerable<int>? fixedIndices = null)
  {
    var indices = new HashSet<int>();
    for (var index = 0; index < Math.Min(total, Math.Max(0, frozen)); index++)
    {
      indices.Add(index);
    }
    for (var index = start; index < Math.Min(total, start + count); index++)
    {
      indices.Add(index);
    }
    foreach (var index in fixedIndices ?? [])
    {
      if (index >= 0 && index < total)
      {
        indices.Add(index);
      }
    }
    return indices.Order().ToArray();
  }

  private int ResolveSourceRow(int row) =>
    row >= 0 && row < loadedRowIndex.Count ? loadedRowIndex[row] : row;

  private FsusDataTableRow? ResolveDataRow(int row)
  {
    if (row >= 0 && row < FixedData.Count)
    {
      return FixedData[row];
    }
    var dataIndex = row - FixedData.Count;
    return dataIndex >= 0 && dataIndex < Data.Count ? Data[dataIndex] : null;
  }

  private object? ResolveCellContent(
    FsusDataTableRow row,
    FsusDataTableColumn column,
    int rowIndex,
    int columnIndex)
  {
    var context = new FsusDataTableCellContext(
      row,
      column,
      row.GetValue(column.Key),
      rowIndex,
      columnIndex);
    return DataGetter?.Invoke(context) ??
      column.CellRenderer?.Invoke(context) ??
      context.Value;
  }

  private void RefreshContentRegions(
    int rowCount,
    int columnCount,
    IReadOnlyList<int> realizedRows)
  {
    var headerHeights = (HeaderHeights.Count > 0 ? HeaderHeights : [HeaderHeight])
      .Select(value => Math.Max(0d, value))
      .ToArray();
    var headerHeight = headerHeights.Sum();
    var headerCells = Columns
      .Select(column => column.RenderHeader())
      .ToArray();
    headerHost.Children.Clear();
    headerHost.Height = headerHeight;
    headerHost.Width = Math.Max(0, columnCount) * Math.Max(1d, ColumnWidth);
    headerHost.IsVisible = HeaderContent is not null && headerHeight > 0;
    if (HeaderContent is not null)
    {
      var top = 0d;
      for (var headerIndex = 0; headerIndex < headerHeights.Length; headerIndex++)
      {
        var rowHeight = headerHeights[headerIndex];
        var presenter = new ContentControl
        {
          Content = new FsusTableV2HeaderContext(headerCells, Columns, headerIndex),
          ContentTemplate = HeaderContent,
          Width = headerHost.Width,
          Height = rowHeight,
        };
        Canvas.SetTop(presenter, top);
        headerHost.Children.Add(presenter);
        top += rowHeight;
      }
    }

    headerCellHost.Children.Clear();
    headerCellHost.Height = headerHeight;
    headerCellHost.Width = Math.Max(0, columnCount) * Math.Max(1d, ColumnWidth);
    if (HeaderContent is null && HeaderCellContent is not null && headerHeight > 0)
    {
      var top = 0d;
      for (var headerIndex = 0; headerIndex < headerHeights.Length; headerIndex++)
      {
        var rowHeight = headerHeights[headerIndex];
        for (var columnIndex = 0; columnIndex < Columns.Count; columnIndex++)
        {
          var presenter = new ContentControl
          {
            Content = new FsusTableV2HeaderCellContext(
              Columns,
              Columns[columnIndex],
              columnIndex,
              headerIndex,
              new Dictionary<string, object?>
              {
                ["left"] = columnIndex * Math.Max(1d, ColumnWidth),
                ["top"] = top,
                ["width"] = Math.Max(1d, ColumnWidth),
                ["height"] = rowHeight,
              }),
            ContentTemplate = HeaderCellContent,
            Width = Math.Max(1d, ColumnWidth),
            Height = rowHeight,
          };
          Canvas.SetLeft(presenter, columnIndex * Math.Max(1d, ColumnWidth));
          Canvas.SetTop(presenter, top);
          headerCellHost.Children.Add(presenter);
        }
        top += rowHeight;
      }
    }

    rowContentHost.Children.Clear();
    rowContentHost.Width = cellHost.Width;
    rowContentHost.Height = cellHost.Height;
    if (RowContent is not null)
    {
      foreach (var rowIndex in realizedRows)
      {
        var row = ResolveDataRow(ResolveSourceRow(rowIndex));
        if (row is null) continue;
        var presenter = new ContentControl
        {
          Content = new FsusTableV2RowContext(
            Columns.Select(column => ResolveCellContent(
              row,
              column,
              rowIndex,
              Columns.IndexOf(column))).ToArray(),
            new Dictionary<string, object?>
            {
              ["top"] = ResolveRowOffset(rowIndex),
              ["height"] = ResolveRowHeight(rowIndex),
              ["width"] = cellHost.Width,
            },
            Columns,
            0,
            row,
            rowIndex,
            false),
          ContentTemplate = RowContent,
          Width = cellHost.Width,
          Height = ResolveRowHeight(rowIndex),
        };
        Canvas.SetTop(presenter, ResolveRowOffset(rowIndex));
        rowContentHost.Children.Add(presenter);
      }
    }

    emptyHost.Content = Data;
    emptyHost.ContentTemplate = EmptyContent;
    emptyHost.IsVisible = rowCount == 0 && EmptyContent is not null;
    overlayHost.Content = Data;
    overlayHost.ContentTemplate = OverlayContent;
    overlayHost.IsVisible = OverlayContent is not null;
    footerHost.Height = Math.Max(0d, FooterHeight);
    footerHost.Content = Data;
    footerHost.ContentTemplate = FooterContent;
    footerHost.IsVisible = FooterContent is not null && FooterHeight > 0;
  }

  private FsusTableV2CellContainer AcquireCell()
  {
    if (cellPool.TryDequeue(out var cell))
    {
      RecycledCellCount++;
      return cell;
    }

    CreatedCellCount++;
    return new FsusTableV2CellContainer(++nextContainerId);
  }

  private void RecycleCell(FsusTableV2CellContainer cell)
  {
    cell.Recycle();
    if (cellPool.Count < Math.Max(0, ContainerPoolLimit))
    {
      cellPool.Enqueue(cell);
    }
    else
    {
      DiscardedCellCount++;
    }
  }

  private void ApplyScrollOffset()
  {
    isApplyingScroll = true;
    try
    {
      scrollViewer.Offset = new Vector(
        realizedColumnStartIndex * Math.Max(1d, ColumnWidth),
        ResolveRowOffset(realizedRowStartIndex));
    }
    finally
    {
      isApplyingScroll = false;
    }
  }

  private void EnsureRowSizeIndex() =>
    rowSizeIndex.Ensure(EffectiveRowCount, EstimatedRowHeight ?? RowHeight, rowMeasurementCache);

  private double ResolveRowHeight(int rowIndex) =>
    EstimatedRowHeight is not null && rowMeasurementCache.TryGetValue(rowIndex, out var measured)
      ? measured
      : Math.Max(1d, EstimatedRowHeight ?? RowHeight);

  private double ResolveRowOffset(int rowIndex) =>
    EstimatedRowHeight is null
      ? Math.Clamp(rowIndex, 0, EffectiveRowCount) * Math.Max(1d, RowHeight)
      : rowSizeIndex.PrefixSize(rowIndex);

  private double ResolveTotalRowHeight() =>
    EstimatedRowHeight is null
      ? Math.Max(0, EffectiveRowCount) * Math.Max(1d, RowHeight)
      : rowSizeIndex.TotalSize;

  private int ResolveRowStart(double offset) =>
    EstimatedRowHeight is null
      ? ResolveStart(offset, RowHeight, EffectiveRowCount, realizedRowCount)
      : Math.Clamp(
          rowSizeIndex.FindIndex(offset),
          0,
          Math.Max(0, EffectiveRowCount - Math.Max(1, realizedRowCount)));

  private int ResolveVisibleRowCount(int rowCount)
  {
    if (rowCount <= 0)
    {
      return 0;
    }

    var visible = 0;
    var covered = 0d;
    for (var row = realizedRowStartIndex; row < rowCount && covered < viewport.Height; row++)
    {
      covered += ResolveRowHeight(row);
      visible++;
    }
    return Math.Max(1, visible + Math.Max(0, Overscan));
  }

  private void TrimRowMeasurementCache()
  {
    while (rowMeasurementCache.Count > Math.Max(0, RetainedRowMeasurementLimit) &&
      rowMeasurementOrder.TryDequeue(out var rowIndex))
    {
      if (!rowMeasurementCache.Remove(rowIndex, out var previousHeight))
      {
        continue;
      }
      rowSizeIndex.Update(rowIndex, previousHeight, Math.Max(1d, EstimatedRowHeight ?? RowHeight));
    }
  }

  private void NotifyRowsRendered()
  {
    if (EffectiveRowCount == 0 || realizedRowCount == 0)
    {
      return;
    }
    var stopIndex = Math.Min(EffectiveRowCount - 1, realizedRowStartIndex + realizedRowCount - 1);
    OnRowsRendered?.Invoke(new FsusTableV2RowsRendered(
      realizedRowStartIndex,
      stopIndex,
      realizedRowStartIndex,
      stopIndex));
  }

  private void NotifyScroll()
  {
    var position = new FsusTableV2ScrollPosition(
      realizedColumnStartIndex * Math.Max(1d, ColumnWidth),
      ResolveRowOffset(realizedRowStartIndex));
    OnScroll?.Invoke(position);
    var distance = Math.Max(0d, ResolveTotalRowHeight() - position.ScrollTop - viewport.Height);
    if (distance <= 0d)
    {
      OnEndReached?.Invoke(distance);
    }
  }

  private static async Task CommitOnUiThreadAsync(Action action)
  {
    if (Dispatcher.UIThread.CheckAccess())
    {
      action();
      return;
    }

    await Dispatcher.UIThread.InvokeAsync(action);
  }

  private void SyncState()
  {
    FsusComponentClasses.Ensure(this, "fsus-virtualized", IsVirtualized);
    var automationName = FsusComponentClasses.ResolveName(AccessibleName, EffectiveRowCount);
    if (!string.Equals(lastAutomationName, automationName, StringComparison.Ordinal))
    {
      AutomationProperties.SetName(this, automationName);
      lastAutomationName = automationName;
      AutomationUpdateCount++;
    }
    if (AutomationProperties.GetControlTypeOverride(this) != AutomationControlType.DataGrid)
    {
      AutomationProperties.SetControlTypeOverride(this, AutomationControlType.DataGrid);
      AutomationUpdateCount++;
    }
    var automationStatus = $"{EffectiveRowCount.ToString(CultureInfo.InvariantCulture)} rows, {EffectiveColumnCount.ToString(CultureInfo.InvariantCulture)} columns, {RealizedCellCount.ToString(CultureInfo.InvariantCulture)} realized cells";
    if (!string.Equals(lastAutomationStatus, automationStatus, StringComparison.Ordinal))
    {
      AutomationProperties.SetItemStatus(this, automationStatus);
      lastAutomationStatus = automationStatus;
      AutomationUpdateCount++;
    }
  }

  private sealed class FsusTableV2ValueComparer : IComparer<object?>
  {
    public static FsusTableV2ValueComparer Instance { get; } = new();

    public int Compare(object? left, object? right)
    {
      if (ReferenceEquals(left, right)) return 0;
      if (left is null) return -1;
      if (right is null) return 1;
      if (left is IComparable comparable)
      {
        try
        {
          return comparable.CompareTo(right);
        }
        catch (ArgumentException)
        {
          // Fall through to invariant text comparison for mixed value types.
        }
      }
      return string.Compare(
        Convert.ToString(left, CultureInfo.InvariantCulture),
        Convert.ToString(right, CultureInfo.InvariantCulture),
        StringComparison.Ordinal);
    }
  }
}
