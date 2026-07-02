using Avalonia;
using Avalonia.Automation;
using Avalonia.Automation.Peers;
using Avalonia.Controls;
using Avalonia.Input;
using System.Globalization;

namespace FsusUI.Avalonia.Controls;

public enum FsusVirtualSizeMode
{
  Fixed,
  Variable,
}

public enum FsusVirtualListState
{
  Ready,
  Loading,
  Error,
}

public sealed record FsusVirtualWindow(int StartIndex, int Count);

public sealed record FsusVirtualListItem(int Index, string Key, object? Content);

public sealed record FsusRealizedVirtualItem(
  int Index,
  string Key,
  double Offset,
  double Size,
  int ContainerId);

public sealed record FsusVirtualAnchor(string Key, int Index, double Offset);

public sealed record FsusVirtualListBudget(
  int RealizedContainers,
  int RetainedMeasurements,
  double ScrollLatencyMs,
  double MemoryKb);

public sealed record FsusVirtualListBudgetResult(
  int RealizedContainerCount,
  int RetainedMeasurementCount,
  FsusVirtualListBudget Budget)
{
  public bool WithinBudget =>
    RealizedContainerCount <= Budget.RealizedContainers &&
    RetainedMeasurementCount <= Budget.RetainedMeasurements;
}

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

public delegate ValueTask<IReadOnlyList<FsusVirtualListItem>> FsusVirtualListSourceProvider(
  FsusVirtualWindow window,
  CancellationToken cancellationToken);

public class FsusVirtualList : ContentControl
{
  private readonly Dictionary<int, double> measurementCache = [];
  private readonly List<FsusRealizedVirtualItem> realizedItems = [];
  private readonly List<FsusVirtualListItem> loadedItems = [];
  private CancellationTokenSource? loadCancellation;
  private int loadVersion;
  private double scrollOffset;
  private FsusVirtualListState state = FsusVirtualListState.Ready;

  public FsusVirtualList()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-virtual-list");
    Focusable = true;
    SyncState();
  }

  public string? AccessibleName { get; set; }
  public int ItemCount { get; set; }
  public double FixedItemSize { get; set; } = 32d;
  public double ViewportSize { get; set; } = 320d;
  public int Overscan { get; set; } = 2;
  public int FocusedIndex { get; private set; }
  public FsusVirtualSizeMode SizeMode { get; set; } = FsusVirtualSizeMode.Fixed;
  public Func<int, string>? ItemKeyProvider { get; set; }
  public FsusVirtualListSourceProvider? SourceProvider { get; set; }
  public FsusVirtualListBudget VirtualizationBudget { get; set; } = new(
    RealizedContainers: 64,
    RetainedMeasurements: 2048,
    ScrollLatencyMs: 8d,
    MemoryKb: 512d);
  public string LoadingText { get; set; } = "Loading items";
  public string EmptyText { get; set; } = "No items";
  public string ErrorText { get; set; } = "Unable to load items";
  public string? ErrorMessage { get; set; }
  public string AnchorKey { get; private set; } = string.Empty;
  public bool LastLoadCanceled { get; private set; }

  public FsusVirtualListState State
  {
    get => state;
    set
    {
      state = value;
      SyncState();
    }
  }

  public double ScrollOffset
  {
    get => scrollOffset;
    private set => scrollOffset = Math.Max(0d, value);
  }

  public bool IsVirtualized => ItemCount > RealizedItems.Count;
  public int RealizedContainerCount => realizedItems.Count;
  public int RecycledContainerCount { get; private set; }
  public int RetainedMeasurementCount => measurementCache.Count;
  public IReadOnlyList<FsusRealizedVirtualItem> RealizedItems => realizedItems.AsReadOnly();
  public IReadOnlyList<FsusVirtualListItem> LoadedItems => loadedItems.AsReadOnly();
  public string DisplayText =>
    State switch
    {
      FsusVirtualListState.Loading => LoadingText,
      FsusVirtualListState.Error => string.IsNullOrWhiteSpace(ErrorMessage) ? ErrorText : ErrorMessage!,
      _ when ItemCount == 0 => EmptyText,
      _ => string.Empty,
    };

  public void RefreshWindow()
  {
    var previousCount = realizedItems.Count;
    var previousStart = realizedItems.FirstOrDefault()?.Index ?? 0;
    realizedItems.Clear();

    if (ItemCount <= 0)
    {
      SyncState();
      return;
    }

    var visibleCount = ResolveVisibleCount();
    var anchorIndex = ResolveIndexFromOffset(ScrollOffset);
    var startIndex = Math.Clamp(anchorIndex - Overscan, 0, Math.Max(0, ItemCount - visibleCount));
    for (var index = startIndex; index < Math.Min(ItemCount, startIndex + visibleCount); index++)
    {
      realizedItems.Add(new FsusRealizedVirtualItem(
        index,
        ResolveKey(index),
        ResolveOffset(index),
        GetResolvedSize(index),
        index - startIndex));
    }

    if (previousCount > 0 && previousStart != startIndex)
    {
      RecycledContainerCount += Math.Min(previousCount, realizedItems.Count);
    }

    SyncState();
  }

  public void ScrollToIndex(int index)
  {
    FocusedIndex = Math.Clamp(index, 0, Math.Max(0, ItemCount - 1));
    ScrollOffset = ResolveOffset(FocusedIndex);
    RefreshWindow();
  }

  public void SetMeasuredSize(int index, double size)
  {
    if (index < 0)
    {
      return;
    }

    measurementCache[index] = Math.Max(1d, size);
  }

  public double GetResolvedSize(int index) =>
    SizeMode == FsusVirtualSizeMode.Variable && measurementCache.TryGetValue(index, out var size)
      ? size
      : Math.Max(1d, FixedItemSize);

  public FsusVirtualAnchor CaptureAnchor()
  {
    var index = FocusedIndex;
    var anchor = new FsusVirtualAnchor(ResolveKey(index), index, ScrollOffset);
    AnchorKey = anchor.Key;
    return anchor;
  }

  public void AdjustForItemsInsertedBeforeAnchor(
    FsusVirtualAnchor anchor,
    int insertedCount,
    double insertedSize)
  {
    AnchorKey = anchor.Key;
    ScrollOffset = anchor.Offset + Math.Max(0, insertedCount) * Math.Max(1d, insertedSize);
    RefreshWindow();
  }

  public async ValueTask<bool> LoadWindowAsync()
  {
    if (SourceProvider is null)
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
    State = FsusVirtualListState.Loading;

    try
    {
      var items = await SourceProvider(
        new FsusVirtualWindow(
          realizedItems.FirstOrDefault()?.Index ?? 0,
          Math.Max(1, realizedItems.Count == 0 ? ResolveVisibleCount() : realizedItems.Count)),
        cancellation.Token);
      if (cancellation.IsCancellationRequested || version != loadVersion)
      {
        return false;
      }

      loadedItems.Clear();
      loadedItems.AddRange(items);
      State = FsusVirtualListState.Ready;
      return true;
    }
    catch (OperationCanceledException)
    {
      return false;
    }
    catch (Exception error)
    {
      ErrorMessage = error.Message;
      State = FsusVirtualListState.Error;
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

  public FsusVirtualListBudgetResult EvaluateBudget() =>
    new(RealizedContainerCount, RetainedMeasurementCount, VirtualizationBudget);

  protected ValueTask<bool> HandleKeyAsync(Key key)
  {
    if (ItemCount <= 0)
    {
      return ValueTask.FromResult(false);
    }

    if (key == Key.Down)
    {
      ScrollToIndex(Math.Min(ItemCount - 1, FocusedIndex + 1));
      return ValueTask.FromResult(true);
    }

    if (key == Key.Up)
    {
      ScrollToIndex(Math.Max(0, FocusedIndex - 1));
      return ValueTask.FromResult(true);
    }

    return ValueTask.FromResult(false);
  }

  private int ResolveVisibleCount() =>
    Math.Min(ItemCount, Math.Max(1, (int)Math.Ceiling(ViewportSize / Math.Max(1d, FixedItemSize)) + Math.Max(0, Overscan)));

  private int ResolveIndexFromOffset(double offset)
  {
    if (SizeMode == FsusVirtualSizeMode.Fixed)
    {
      return Math.Clamp((int)Math.Floor(offset / Math.Max(1d, FixedItemSize)), 0, Math.Max(0, ItemCount - 1));
    }

    var cursor = 0d;
    for (var index = 0; index < ItemCount; index++)
    {
      cursor += GetResolvedSize(index);
      if (cursor > offset)
      {
        return index;
      }
    }

    return Math.Max(0, ItemCount - 1);
  }

  private double ResolveOffset(int index)
  {
    if (SizeMode == FsusVirtualSizeMode.Fixed)
    {
      return Math.Max(0, index) * Math.Max(1d, FixedItemSize);
    }

    var offset = 0d;
    for (var current = 0; current < Math.Clamp(index, 0, Math.Max(0, ItemCount)); current++)
    {
      offset += GetResolvedSize(current);
    }

    return offset;
  }

  private string ResolveKey(int index) =>
    ItemKeyProvider?.Invoke(index) ?? index.ToString(CultureInfo.InvariantCulture);

  private void SyncState()
  {
    var stateName = EffectiveStateName();
    foreach (var className in new[] { "fsus-ready", "fsus-empty", "fsus-loading", "fsus-error" })
    {
      FsusComponentClasses.Ensure(this, className, false);
    }

    FsusComponentClasses.Ensure(this, $"fsus-{stateName}", true);
    FsusComponentClasses.Ensure(this, "fsus-virtualized", IsVirtualized);
    FsusComponentClasses.Ensure(this, "fsus-variable-size", SizeMode == FsusVirtualSizeMode.Variable);
    AutomationProperties.SetName(this, FsusComponentClasses.ResolveName(AccessibleName, ItemCount));
    AutomationProperties.SetControlTypeOverride(this, AutomationControlType.List);
    AutomationProperties.SetItemStatus(
      this,
      $"{stateName}, {ItemCount.ToString(CultureInfo.InvariantCulture)} items, focus {(FocusedIndex + 1).ToString(CultureInfo.InvariantCulture)} of {Math.Max(1, ItemCount).ToString(CultureInfo.InvariantCulture)}");
  }

  private string EffectiveStateName() =>
    State switch
    {
      FsusVirtualListState.Loading => "loading",
      FsusVirtualListState.Error => "error",
      _ when ItemCount == 0 => "empty",
      _ => "ready",
    };
}

public class FsusAutoResizer : ContentControl
{
  public FsusAutoResizer()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-auto-resizer");
    SyncState();
  }

  public string? AccessibleName { get; set; }
  public Size Viewport { get; set; }

  public bool Resize(Size viewport)
  {
    if (Viewport == viewport)
    {
      return false;
    }

    Viewport = viewport;
    SyncState();
    return true;
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
  private Size viewport = new(960, 480);
  private int realizedRowStartIndex;
  private int realizedColumnStartIndex;
  private int realizedRowCount;
  private int realizedColumnCount;

  public FsusTableV2()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-table-v2");
    Focusable = true;
    SyncState();
  }

  public string? AccessibleName { get; set; }
  public int RowCount { get; set; }
  public int ColumnCount { get; set; }
  public double RowHeight { get; set; } = 32d;
  public double ColumnWidth { get; set; } = 120d;
  public int Overscan { get; set; } = 2;
  public int FocusedRowIndex { get; private set; }
  public int FocusedColumnIndex { get; private set; }
  public FsusTableV2Budget VirtualizationBudget { get; set; } = new(
    RealizedRows: 64,
    RealizedColumns: 24,
    RealizedCells: 1536,
    ScrollLatencyMs: 10d,
    MemoryKb: 1024d);

  public bool IsVirtualized =>
    RowCount > RealizedRowCount || ColumnCount > RealizedColumnCount;
  public int RealizedRowStartIndex => realizedRowStartIndex;
  public int RealizedColumnStartIndex => realizedColumnStartIndex;
  public int RealizedRowCount => realizedRowCount;
  public int RealizedColumnCount => realizedColumnCount;
  public int RealizedCellCount => realizedRowCount * realizedColumnCount;
  public int RecycledCellCount { get; private set; }
  public string FocusedCellStatus =>
    $"row {(FocusedRowIndex + 1).ToString(CultureInfo.InvariantCulture)} of {RowCount.ToString(CultureInfo.InvariantCulture)}, column {(FocusedColumnIndex + 1).ToString(CultureInfo.InvariantCulture)} of {ColumnCount.ToString(CultureInfo.InvariantCulture)}";

  public void AttachResizer(FsusAutoResizer resizer)
  {
    ArgumentNullException.ThrowIfNull(resizer);
    viewport = resizer.Viewport.Width <= 0 || resizer.Viewport.Height <= 0
      ? viewport
      : resizer.Viewport;
  }

  public void RefreshLayout()
  {
    var oldCellCount = RealizedCellCount;
    var oldRowStart = realizedRowStartIndex;
    var oldColumnStart = realizedColumnStartIndex;
    realizedRowCount = Math.Min(
      RowCount,
      Math.Max(1, (int)Math.Ceiling(viewport.Height / Math.Max(1d, RowHeight)) + Math.Max(0, Overscan)));
    realizedColumnCount = Math.Min(
      ColumnCount,
      Math.Max(1, (int)Math.Ceiling(viewport.Width / Math.Max(1d, ColumnWidth)) + Math.Max(0, Overscan)));
    ClampStarts();
    if (oldCellCount > 0 && (oldRowStart != realizedRowStartIndex || oldColumnStart != realizedColumnStartIndex))
    {
      RecycledCellCount += Math.Min(oldCellCount, RealizedCellCount);
    }

    SyncState();
  }

  public void ScrollToCell(int rowIndex, int columnIndex)
  {
    var oldCellCount = RealizedCellCount;
    var oldRowStart = realizedRowStartIndex;
    var oldColumnStart = realizedColumnStartIndex;
    FocusedRowIndex = Math.Clamp(rowIndex, 0, Math.Max(0, RowCount - 1));
    FocusedColumnIndex = Math.Clamp(columnIndex, 0, Math.Max(0, ColumnCount - 1));
    realizedRowStartIndex = Math.Clamp(FocusedRowIndex - Math.Max(0, Overscan), 0, Math.Max(0, RowCount - Math.Max(1, realizedRowCount)));
    realizedColumnStartIndex = Math.Clamp(FocusedColumnIndex - Math.Max(0, Overscan), 0, Math.Max(0, ColumnCount - Math.Max(1, realizedColumnCount)));
    RefreshLayout();
    if (oldCellCount > 0 && (oldRowStart != realizedRowStartIndex || oldColumnStart != realizedColumnStartIndex))
    {
      RecycledCellCount += Math.Min(oldCellCount, RealizedCellCount);
    }
  }

  public FsusTableV2BudgetResult EvaluateBudget() =>
    new(RealizedRowCount, RealizedColumnCount, RealizedCellCount, VirtualizationBudget);

  private void ClampStarts()
  {
    realizedRowStartIndex = Math.Clamp(realizedRowStartIndex, 0, Math.Max(0, RowCount - Math.Max(1, realizedRowCount)));
    realizedColumnStartIndex = Math.Clamp(realizedColumnStartIndex, 0, Math.Max(0, ColumnCount - Math.Max(1, realizedColumnCount)));
  }

  private void SyncState()
  {
    FsusComponentClasses.Ensure(this, "fsus-virtualized", IsVirtualized);
    AutomationProperties.SetName(this, FsusComponentClasses.ResolveName(AccessibleName, RowCount));
    AutomationProperties.SetControlTypeOverride(this, AutomationControlType.DataGrid);
    AutomationProperties.SetItemStatus(
      this,
      $"{RowCount.ToString(CultureInfo.InvariantCulture)} rows, {ColumnCount.ToString(CultureInfo.InvariantCulture)} columns, {RealizedCellCount.ToString(CultureInfo.InvariantCulture)} realized cells");
  }
}
