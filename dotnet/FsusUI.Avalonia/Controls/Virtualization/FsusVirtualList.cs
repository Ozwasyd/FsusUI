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
  private readonly Dictionary<int, string> retainedItemKeys = [];
  private readonly Queue<FsusVirtualListItemContainer> containerPool = [];
  private readonly FsusVariableSizeIndex variableSizeIndex = new();
  private readonly Canvas itemHost = new();
  private readonly ScrollViewer scrollViewer = new();
  private CancellationTokenSource? loadCancellation;
  private int loadVersion;
  private int nextContainerId;
  private int previousItemCount;
  private double scrollOffset;
  private FsusVirtualListState state = FsusVirtualListState.Ready;
  private string? lastAutomationName;
  private string? lastAutomationStatus;
  private string? lastStateName;
  private bool isApplyingScroll;
  private Func<int, string>? previousItemKeyProvider;
  private Func<int, object?>? previousItemProvider;
  private FsusVirtualListSourceProvider? previousSourceProvider;

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

  private void RefreshWindow(bool updateScrollViewer, int? restoreFocusIndex = null, bool reconcileIdentities = true)
  {
    if (reconcileIdentities && ReconcileItemIdentities(out var reconciledFocusIndex))
    {
      restoreFocusIndex = reconciledFocusIndex ?? restoreFocusIndex;
      updateScrollViewer = true;
    }
    if (restoreFocusIndex is int targetIndex && targetIndex >= 0 && targetIndex < ItemCount)
    {
      var top = ResolveOffset(targetIndex);
      if (top + GetResolvedSize(targetIndex) <= ScrollOffset || top >= ScrollOffset + ViewportSize)
      {
        ScrollOffset = top;
      }
    }
    FocusedIndex = Math.Clamp(FocusedIndex, 0, Math.Max(0, ItemCount - 1));
    ScrollOffset = Math.Min(ScrollOffset, Math.Max(0d, ResolveTotalSize() - ViewportSize));
    if (ItemCount <= 0)
    {
      if (realizedItems.Count > 0)
      {
        CancelPendingLoad();
        loadedItems.Clear();
        loadedItemsByIndex.Clear();
        measurementCache.Clear();
        measurementOrder.Clear();
      }
      RecycleAllContainers();
      realizedItems.Clear();
      itemHost.Height = 0;
      AnchorKey = string.Empty;
      ApplyScrollOffset();
      RememberItemKeys();
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
    RememberItemKeys();
    // Restoring focus can request scrolling against the previous layout.
    // Apply the preserved anchor after that request.
    if (restoreFocusIndex is int focusedIndex && realizedContainers.TryGetValue(focusedIndex, out var focusedContainer))
    {
      focusedContainer.Focus();
    }
    if (updateScrollViewer)
    {
      ApplyScrollOffset();
    }

    SyncState();
  }

  private void RememberItemKeys()
  {
    previousItemCount = ItemCount;
    previousItemKeyProvider = ItemKeyProvider;
    previousItemProvider = ItemProvider;
    previousSourceProvider = SourceProvider;
    retainedItemKeys.Clear();
    if (ItemKeyProvider is null)
    {
      return;
    }

    var retainedIndices = realizedContainers.Keys
      .Concat(measurementCache.Keys)
      .Concat(loadedItemsByIndex.Keys)
      .Append(FocusedIndex)
      .Distinct();
    foreach (var index in retainedIndices)
    {
      if (index >= 0 && index < ItemCount)
      {
        retainedItemKeys[index] = ResolveKey(index);
      }
    }
  }

  private bool ReconcileItemIdentities(out int? restoreFocusIndex)
  {
    restoreFocusIndex = null;
    var focused = realizedContainers.Values.FirstOrDefault(container => container.IsKeyboardFocusWithin);
    var providerReplaced = !ReferenceEquals(previousItemKeyProvider, ItemKeyProvider) ||
      !ReferenceEquals(previousItemProvider, ItemProvider) ||
      !ReferenceEquals(previousSourceProvider, SourceProvider);
    // Provider rebuilds preserve the viewport independently of keyboard focus.
    // Unfocused growth through unchanged providers still requires insertion notification.
    if (ItemKeyProvider is null || ItemCount <= 0 ||
      (ItemCount > previousItemCount && focused is null && !providerReplaced) ||
      !retainedItemKeys.Any(pair => pair.Key >= ItemCount || ResolveKey(pair.Key) != pair.Value))
    {
      return false;
    }

    var anchor = realizedItems.FirstOrDefault(item => item.Offset <= ScrollOffset && item.Offset + item.Size > ScrollOffset);
    var remaining = retainedItemKeys.Values.ToHashSet(StringComparer.Ordinal);
    var indices = new Dictionary<string, int>(StringComparer.Ordinal);
    for (var index = 0; index < ItemCount && remaining.Count > 0; index++)
    {
      var key = ResolveKey(index);
      if (remaining.Remove(key))
      {
        indices[key] = index;
      }
    }

    int? FindSurvivor(int index) =>
      retainedItemKeys.TryGetValue(index, out var key) && indices.TryGetValue(key, out var nextIndex)
        ? nextIndex
        : null;

    CancelPendingLoad();
    var measurements = measurementOrder
      .Where(measurementCache.ContainsKey)
      .Select(index => (Index: FindSurvivor(index), Size: measurementCache[index]))
      .ToArray();
    measurementCache.Clear();
    measurementOrder.Clear();
    foreach (var measurement in measurements)
    {
      if (measurement.Index is int index)
      {
        measurementCache[index] = measurement.Size;
        measurementOrder.Enqueue(index);
      }
    }
    variableSizeIndex.Ensure(0, FixedItemSize, measurementCache);
    EnsureVariableIndex();

    var loaded = loadedItems.Select(item => (Item: item, Index: FindSurvivor(item.Index))).ToArray();
    loadedItems.Clear();
    loadedItemsByIndex.Clear();
    foreach (var item in loaded)
    {
      if (item.Index is int index)
      {
        var shifted = item.Item with { Index = index };
        loadedItems.Add(shifted);
        loadedItemsByIndex[index] = shifted;
      }
    }

    FocusedIndex = FindSurvivor(FocusedIndex) ?? FocusedIndex;
    if (anchor is not null && FindSurvivor(anchor.Index) is int anchorIndex)
    {
      ScrollOffset += ResolveOffset(anchorIndex) - anchor.Offset;
      AnchorKey = anchor.Key;
    }
    restoreFocusIndex = focused is null ? null : FindSurvivor(focused.Index);
    return true;
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
    var anchorOffset = ResolveOffset(anchorIndex);
    if (!measurementCache.ContainsKey(index))
    {
      measurementOrder.Enqueue(index);
    }
    measurementCache[index] = nextSize;
    variableSizeIndex.Update(index, previousSize, nextSize);
    TrimMeasurementCache();
    if (ItemKeyProvider is not null && index < ItemCount && measurementCache.ContainsKey(index))
    {
      retainedItemKeys[index] = ResolveKey(index);
    }
    if (SizeMode == FsusVirtualSizeMode.Variable)
    {
      ScrollOffset += ResolveOffset(anchorIndex) - anchorOffset;
      RefreshWindow();
    }
    else if (realizedContainers.ContainsKey(index))
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
    var index = ResolveIndexFromOffset(ScrollOffset);
    // The provider may already contain inserted data; realized keys still describe
    // the viewport before its mutation notification.
    var key = ItemCount <= 0 ? string.Empty :
      realizedItems.FirstOrDefault(item => item.Index == index)?.Key ?? ResolveKey(index);
    var anchor = new FsusVirtualAnchor(key, index, ScrollOffset);
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
    var hadItems = ItemCount > 0;
    var actualFocusIndex = realizedContainers.Values.FirstOrDefault(container => container.IsKeyboardFocusWithin)?.Index;
    CancelPendingLoad();
    loadedItemsByIndex.Clear();
    for (var position = 0; position < loadedItems.Count; position++)
    {
      var item = loadedItems[position];
      if (item.Index >= index)
      {
        item = item with { Index = item.Index + insertedCount };
        loadedItems[position] = item;
      }
      loadedItemsByIndex[item.Index] = item;
    }
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
    if (hadItems && index <= anchor.Index)
    {
      ScrollOffset = anchor.Offset + insertedCount * Math.Max(1d, FixedItemSize);
    }
    if (hadItems && index <= FocusedIndex)
    {
      FocusedIndex = Math.Min(ItemCount - 1, FocusedIndex + insertedCount);
    }
    if (actualFocusIndex is int focusIndex && index <= focusIndex)
    {
      actualFocusIndex += insertedCount;
    }
    RefreshWindow(updateScrollViewer: true, restoreFocusIndex: actualFocusIndex, reconcileIdentities: false);
  }

  protected override void OnDetachedFromVisualTree(VisualTreeAttachmentEventArgs e)
  {
    CancelPendingLoad();
    base.OnDetachedFromVisualTree(e);
  }

  private void CancelPendingLoad()
  {
    if (loadCancellation is not null)
    {
      LastLoadCanceled = true;
      loadVersion++;
      loadCancellation.Cancel();
      State = FsusVirtualListState.Ready;
    }
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
        if (cancellation.IsCancellationRequested || version != loadVersion)
        {
          return;
        }
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
      return !cancellation.IsCancellationRequested && version == loadVersion;
    }
    catch (OperationCanceledException)
    {
      return false;
    }
    catch (Exception error)
    {
      if (cancellation.IsCancellationRequested || version != loadVersion)
      {
        return false;
      }
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

  private int ResolveVisibleCount()
  {
    var count = (int)Math.Ceiling(ViewportSize / Math.Max(1d, FixedItemSize));
    if (SizeMode == FsusVirtualSizeMode.Variable && ItemCount > 0)
    {
      var start = ResolveIndexFromOffset(ScrollOffset);
      var end = ResolveIndexFromOffset(ScrollOffset + ViewportSize);
      count = end - start + (ResolveOffset(end) < ScrollOffset + ViewportSize ? 1 : 0);
    }
    return Math.Min(ItemCount, Math.Max(1, count + Math.Max(0, Overscan)));
  }

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
        if (index != FocusedIndex && !realizedContainers.ContainsKey(index) && !loadedItemsByIndex.ContainsKey(index))
        {
          retainedItemKeys.Remove(index);
        }
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
