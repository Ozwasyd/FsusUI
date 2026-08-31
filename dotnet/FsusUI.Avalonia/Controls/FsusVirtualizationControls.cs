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

public sealed record FsusTableV2RowsRendered(
  int StartIndex,
  int StopIndex,
  int VisibleStartIndex,
  int VisibleStopIndex);

public sealed record FsusTableV2ScrollPosition(double ScrollLeft, double ScrollTop);

public sealed record FsusTableV2RowExpansion(FsusDataTableRow Row, bool Expanded);

public delegate ValueTask<IReadOnlyList<FsusVirtualListItem>> FsusVirtualListSourceProvider(
  FsusVirtualWindow window,
  CancellationToken cancellationToken);

public class FsusVirtualList : ContentControl
{
  private readonly Dictionary<int, double> measurementCache = [];
  private readonly Queue<int> measurementOrder = [];
  private readonly List<FsusRealizedVirtualItem> realizedItems = [];
  private readonly List<FsusVirtualListItem> loadedItems = [];
  private readonly Dictionary<int, FsusVirtualListItem> loadedItemsByIndex = [];
  private readonly Dictionary<int, FsusVirtualListItemContainer> realizedContainers = [];
  private readonly Queue<FsusVirtualListItemContainer> containerPool = [];
  private readonly FsusVariableSizeIndex variableSizeIndex = new();
  private readonly Canvas itemHost = new();
  private readonly ScrollViewer scrollViewer = new();
  private CancellationTokenSource? loadCancellation;
  private int loadVersion;
  private int nextContainerId;
  private double scrollOffset;
  private FsusVirtualListState state = FsusVirtualListState.Ready;
  private string? lastAutomationName;
  private string? lastAutomationStatus;
  private string? lastStateName;
  private bool isApplyingScroll;

  public FsusVirtualList()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-virtual-list");
    Focusable = true;
    scrollViewer.Content = itemHost;
    scrollViewer.ScrollChanged += (_, _) =>
    {
      if (isApplyingScroll)
      {
        return;
      }

      scrollOffset = Math.Max(0d, scrollViewer.Offset.Y);
      if (scrollViewer.Viewport.Height > 0)
      {
        ViewportSize = scrollViewer.Viewport.Height;
      }
      RefreshWindow(updateScrollViewer: false);
    };
    Content = scrollViewer;
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
  public Func<int, object?>? ItemProvider { get; set; }
  public IDataTemplate? ItemTemplate { get; set; }
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
  public int ContainerPoolLimit { get; set; } = 64;
  public int LoadedWindowLimit { get; set; } = 256;

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

  public bool IsVirtualized => ItemCount > realizedItems.Count;
  public int RealizedContainerCount => realizedContainers.Count;
  public int RealizedVisualCount => itemHost.Children.Count;
  public int RecycledContainerCount { get; private set; }
  public int CreatedContainerCount { get; private set; }
  public int DiscardedContainerCount { get; private set; }
  public int ContainerPoolCount => containerPool.Count;
  public int RetainedMeasurementCount => measurementCache.Count;
  public int LastIndexLookupSteps { get; private set; }
  public int LastOffsetLookupSteps { get; private set; }
  public int AutomationUpdateCount { get; private set; }
  public Canvas VisualHost => itemHost;
  public ScrollViewer ScrollHost => scrollViewer;
  public IReadOnlyList<FsusRealizedVirtualItem> RealizedItems => realizedItems;
  public IReadOnlyList<FsusVirtualListItem> LoadedItems => loadedItems;
  public IReadOnlyCollection<FsusVirtualListItemContainer> RealizedContainers => realizedContainers.Values;
  internal Action<FsusVirtualListItemContainer, int>? ContainerPrepared { get; set; }
  public string DisplayText =>
    State switch
    {
      FsusVirtualListState.Loading => LoadingText,
      FsusVirtualListState.Error => string.IsNullOrWhiteSpace(ErrorMessage) ? ErrorText : ErrorMessage!,
      _ when ItemCount == 0 => EmptyText,
      _ => string.Empty,
    };

  public void RefreshWindow() => RefreshWindow(updateScrollViewer: true);

  private void RefreshWindow(bool updateScrollViewer)
  {
    if (ItemCount <= 0)
    {
      RecycleAllContainers();
      realizedItems.Clear();
      itemHost.Height = 0;
      SyncState();
      return;
    }

    EnsureVariableIndex();
    var visibleCount = ResolveVisibleCount();
    var anchorIndex = ResolveIndexFromOffset(ScrollOffset);
    var startIndex = Math.Clamp(anchorIndex - Overscan, 0, Math.Max(0, ItemCount - visibleCount));
    var endIndex = Math.Min(ItemCount, startIndex + visibleCount);
    var desired = new HashSet<int>();
    for (var index = startIndex; index < endIndex; index++)
    {
      desired.Add(index);
    }

    var staleContainers = realizedContainers
      .Where(pair => !desired.Contains(pair.Key))
      .ToArray();
    var missingIndices = desired
      .Where(index => !realizedContainers.ContainsKey(index))
      .ToArray();
    var reboundCount = Math.Min(staleContainers.Length, missingIndices.Length);
    for (var position = 0; position < reboundCount; position++)
    {
      var stale = staleContainers[position];
      realizedContainers.Remove(stale.Key);
      realizedContainers[missingIndices[position]] = stale.Value;
      RecycledContainerCount++;
    }
    for (var position = reboundCount; position < staleContainers.Length; position++)
    {
      var stale = staleContainers[position];
      realizedContainers.Remove(stale.Key);
      itemHost.Children.Remove(stale.Value);
      RecycleContainer(stale.Value);
    }
    for (var position = reboundCount; position < missingIndices.Length; position++)
    {
      var container = AcquireContainer();
      realizedContainers[missingIndices[position]] = container;
      itemHost.Children.Add(container);
    }

    realizedItems.Clear();
    for (var index = startIndex; index < endIndex; index++)
    {
      var item = ResolveItem(index);
      var size = GetResolvedSize(index);
      var offset = ResolveOffset(index);
      var container = realizedContainers[index];
      container.Bind(item, ItemTemplate, size);
      ContainerPrepared?.Invoke(container, index);
      Canvas.SetTop(container, offset);
      Canvas.SetLeft(container, 0d);
      realizedItems.Add(new FsusRealizedVirtualItem(
        index,
        item.Key,
        offset,
        size,
        container.ContainerId));
    }

    itemHost.Height = ResolveTotalSize();
    itemHost.MinWidth = Math.Max(1d, Bounds.Width);
    if (updateScrollViewer)
    {
      ApplyScrollOffset();
    }

    SyncState();
  }

  public void ScrollToIndex(int index)
  {
    FocusedIndex = Math.Clamp(index, 0, Math.Max(0, ItemCount - 1));
    ScrollOffset = ResolveOffset(FocusedIndex);
    RefreshWindow();
    if (realizedContainers.TryGetValue(FocusedIndex, out var container))
    {
      container.Focus();
    }
  }

  public void ScrollToOffset(double offset)
  {
    ScrollOffset = Math.Min(Math.Max(0d, offset), Math.Max(0d, ResolveTotalSize() - ViewportSize));
    RefreshWindow();
  }

  protected override void OnPropertyChanged(AvaloniaPropertyChangedEventArgs change)
  {
    base.OnPropertyChanged(change);
    if (change.Property == BoundsProperty && Bounds.Width > 0)
    {
      SyncRealizedWidth();
    }
  }

  public void SetMeasuredSize(int index, double size)
  {
    if (index < 0)
    {
      return;
    }

    EnsureVariableIndex();
    var nextSize = Math.Max(1d, size);
    var previousSize = GetResolvedSize(index);
    var anchorIndex = ResolveIndexFromOffset(ScrollOffset);
    if (!measurementCache.ContainsKey(index))
    {
      measurementOrder.Enqueue(index);
    }
    measurementCache[index] = nextSize;
    variableSizeIndex.Update(index, previousSize, nextSize);
    if (index < anchorIndex)
    {
      ScrollOffset += nextSize - previousSize;
    }

    TrimMeasurementCache();
    if (realizedContainers.ContainsKey(index))
    {
      RefreshWindow();
    }
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

  public void NotifyItemsInserted(int index, int insertedCount)
  {
    if (insertedCount <= 0)
    {
      return;
    }

    var anchor = CaptureAnchor();
    var shifted = measurementCache
      .Select(pair => new KeyValuePair<int, double>(
        pair.Key >= index ? pair.Key + insertedCount : pair.Key,
        pair.Value))
      .Where(pair => pair.Key < ItemCount + insertedCount)
      .ToArray();
    measurementCache.Clear();
    measurementOrder.Clear();
    foreach (var (measuredIndex, measuredSize) in shifted)
    {
      measurementCache[measuredIndex] = measuredSize;
      measurementOrder.Enqueue(measuredIndex);
    }

    ItemCount += insertedCount;
    variableSizeIndex.Ensure(ItemCount, FixedItemSize, measurementCache);
    if (index <= anchor.Index)
    {
      FocusedIndex = Math.Min(ItemCount - 1, anchor.Index + insertedCount);
      ScrollOffset = anchor.Offset + insertedCount * Math.Max(1d, FixedItemSize);
    }
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

      var boundedItems = items.Take(Math.Max(1, LoadedWindowLimit)).ToArray();
      await CommitOnUiThreadAsync(() =>
      {
        loadedItems.Clear();
        loadedItems.AddRange(boundedItems);
        loadedItemsByIndex.Clear();
        foreach (var item in boundedItems)
        {
          loadedItemsByIndex[item.Index] = item;
        }
        State = FsusVirtualListState.Ready;
        RefreshWindow();
      });
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

    EnsureVariableIndex();
    var index = variableSizeIndex.FindIndex(offset);
    LastIndexLookupSteps = variableSizeIndex.LastLookupSteps;
    return index;
  }

  private double ResolveOffset(int index)
  {
    if (SizeMode == FsusVirtualSizeMode.Fixed)
    {
      return Math.Max(0, index) * Math.Max(1d, FixedItemSize);
    }

    EnsureVariableIndex();
    var offset = variableSizeIndex.PrefixSize(index);
    LastOffsetLookupSteps = variableSizeIndex.LastLookupSteps;
    return offset;
  }

  private string ResolveKey(int index) =>
    ItemKeyProvider?.Invoke(index) ?? index.ToString(CultureInfo.InvariantCulture);

  private FsusVirtualListItem ResolveItem(int index) =>
    loadedItemsByIndex.TryGetValue(index, out var loaded)
      ? loaded
      : new FsusVirtualListItem(index, ResolveKey(index), ItemProvider?.Invoke(index) ?? $"Item {index + 1}");

  private FsusVirtualListItemContainer AcquireContainer()
  {
    if (containerPool.TryDequeue(out var recycled))
    {
      RecycledContainerCount++;
      return recycled;
    }

    CreatedContainerCount++;
    return new FsusVirtualListItemContainer(++nextContainerId);
  }

  private void RecycleContainer(FsusVirtualListItemContainer container)
  {
    container.Recycle();
    if (containerPool.Count < Math.Max(0, ContainerPoolLimit))
    {
      containerPool.Enqueue(container);
    }
    else
    {
      DiscardedContainerCount++;
    }
  }

  private void RecycleAllContainers()
  {
    foreach (var container in realizedContainers.Values)
    {
      itemHost.Children.Remove(container);
      RecycleContainer(container);
    }
    realizedContainers.Clear();
  }

  private void EnsureVariableIndex() =>
    variableSizeIndex.Ensure(ItemCount, FixedItemSize, measurementCache);

  private double ResolveTotalSize()
  {
    if (SizeMode == FsusVirtualSizeMode.Fixed)
    {
      return Math.Max(0, ItemCount) * Math.Max(1d, FixedItemSize);
    }

    EnsureVariableIndex();
    return variableSizeIndex.TotalSize;
  }

  private void TrimMeasurementCache()
  {
    var limit = Math.Max(0, VirtualizationBudget.RetainedMeasurements);
    while (measurementCache.Count > limit && measurementOrder.TryDequeue(out var index))
    {
      if (measurementCache.Remove(index, out var size))
      {
        variableSizeIndex.Update(index, size, FixedItemSize);
      }
    }
  }

  private void ApplyScrollOffset()
  {
    isApplyingScroll = true;
    try
    {
      scrollViewer.Offset = new Vector(scrollViewer.Offset.X, ScrollOffset);
    }
    finally
    {
      isApplyingScroll = false;
    }
  }

  private void SyncRealizedWidth()
  {
    var width = Math.Max(1d, Bounds.Width);
    itemHost.MinWidth = width;
    foreach (var container in realizedContainers.Values)
    {
      container.Width = width;
    }
  }

  private static async Task CommitOnUiThreadAsync(Action action)
  {
    if (
      Application.Current?.ApplicationLifetime is null ||
      Dispatcher.UIThread.CheckAccess())
    {
      action();
      return;
    }

    await Dispatcher.UIThread.InvokeAsync(action);
  }

  private void SyncState()
  {
    var stateName = EffectiveStateName();
    if (!string.Equals(lastStateName, stateName, StringComparison.Ordinal))
    {
      foreach (var className in new[] { "fsus-ready", "fsus-empty", "fsus-loading", "fsus-error" })
      {
        FsusComponentClasses.Ensure(this, className, false);
      }
      FsusComponentClasses.Ensure(this, $"fsus-{stateName}", true);
      lastStateName = stateName;
    }

    FsusComponentClasses.Ensure(this, "fsus-virtualized", IsVirtualized);
    FsusComponentClasses.Ensure(this, "fsus-variable-size", SizeMode == FsusVirtualSizeMode.Variable);
    var automationName = FsusComponentClasses.ResolveName(AccessibleName, ItemCount);
    if (!string.Equals(lastAutomationName, automationName, StringComparison.Ordinal))
    {
      AutomationProperties.SetName(this, automationName);
      lastAutomationName = automationName;
      AutomationUpdateCount++;
    }
    if (AutomationProperties.GetControlTypeOverride(this) != AutomationControlType.List)
    {
      AutomationProperties.SetControlTypeOverride(this, AutomationControlType.List);
      AutomationUpdateCount++;
    }
    var automationStatus = $"{stateName}, {ItemCount.ToString(CultureInfo.InvariantCulture)} items, focus {(FocusedIndex + 1).ToString(CultureInfo.InvariantCulture)} of {Math.Max(1, ItemCount).ToString(CultureInfo.InvariantCulture)}";
    if (!string.Equals(lastAutomationStatus, automationStatus, StringComparison.Ordinal))
    {
      AutomationProperties.SetItemStatus(this, automationStatus);
      lastAutomationStatus = automationStatus;
      AutomationUpdateCount++;
    }
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
  private readonly Dictionary<(int Row, int Column), FsusTableV2CellContainer> realizedCells = [];
  private readonly Dictionary<int, double> rowMeasurementCache = [];
  private readonly Queue<int> rowMeasurementOrder = [];
  private readonly Queue<FsusTableV2CellContainer> cellPool = [];
  private readonly FsusVariableSizeIndex rowSizeIndex = new();
  private readonly Canvas cellHost = new();
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
    scrollViewer.Content = cellHost;
    scrollViewer.ScrollChanged += (_, _) =>
    {
      if (isApplyingScroll)
      {
        return;
      }

      if (scrollViewer.Viewport.Width > 0 && scrollViewer.Viewport.Height > 0)
      {
        viewport = scrollViewer.Viewport;
      }
      EnsureRowSizeIndex();
      realizedRowStartIndex = ResolveRowStart(scrollViewer.Offset.Y);
      realizedColumnStartIndex = ResolveStart(scrollViewer.Offset.X, ColumnWidth, EffectiveColumnCount, realizedColumnCount);
      RefreshLayout(updateScrollViewer: false);
      NotifyScroll();
    };
    Content = scrollViewer;
    SyncState();
  }

  public string? AccessibleName { get; set; }
  public Collection<FsusDataTableColumn> Columns { get; } = [];
  public Collection<FsusDataTableRow> Data { get; } = [];
  public Collection<FsusDataTableRow> FixedData { get; } = [];
  public Collection<string> DefaultExpandedRowKeys { get; } = [];
  public Collection<string> ExpandedRowKeys { get; } = [];
  public string RowKey { get; set; } = "id";
  public string? ExpandColumnKey { get; set; }
  public int RowCount { get; set; }
  public int ColumnCount { get; set; }
  public double RowHeight { get; set; } = 32d;
  public double? EstimatedRowHeight { get; set; }
  public double ColumnWidth { get; set; } = 120d;
  public int Overscan { get; set; } = 2;
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
  public Action<double>? OnEndReached { get; set; }
  public Action<IReadOnlyList<string>>? OnExpandedRowsChange { get; set; }
  public Action<FsusTableV2RowExpansion>? OnRowExpand { get; set; }
  public Action<FsusTableV2RowsRendered>? OnRowsRendered { get; set; }
  public Action<FsusTableV2ScrollPosition>? OnScroll { get; set; }
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
    scrollViewer.Width = viewport.Width;
    scrollViewer.Height = viewport.Height;
  }

  public void RefreshLayout() => RefreshLayout(updateScrollViewer: true);

  private void RefreshLayout(bool updateScrollViewer)
  {
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
}
