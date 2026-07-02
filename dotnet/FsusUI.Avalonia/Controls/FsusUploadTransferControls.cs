using Avalonia.Automation;
using Avalonia.Automation.Peers;
using Avalonia.Controls;
using Avalonia.Input;
using System.Collections.ObjectModel;
using System.Globalization;

namespace FsusUI.Avalonia.Controls;

public enum FsusUploadItemStatus
{
  Queued,
  Uploading,
  Success,
  Error,
}

public sealed class FsusUploadItem(
  string fileName,
  long sizeBytes,
  string contentType)
{
  public Guid Id { get; } = Guid.NewGuid();
  public string FileName { get; } = fileName;
  public long SizeBytes { get; } = sizeBytes;
  public string ContentType { get; } = contentType;
  public FsusUploadItemStatus Status { get; internal set; } = FsusUploadItemStatus.Queued;
  public double Progress { get; internal set; }
  public string? ErrorMessage { get; internal set; }
  public int RetryCount { get; internal set; }
  public string RemoveActionName => $"Remove {FileName}";
}

public class FsusUpload : ContentControl
{
  private bool isDisabled;

  public FsusUpload()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-upload");
    SyncState();
  }

  public string? AccessibleName { get; set; }
  public Collection<FsusUploadItem> Items { get; } = [];
  public bool IsConfirmRemoveRequired { get; set; }
  public Func<FsusUploadItem, string?>? ValidateItem { get; set; }
  public FsusComponentSize Size { get; set; } = FsusComponentSize.Md;

  public bool IsDisabled
  {
    get => isDisabled;
    set
    {
      isDisabled = value;
      SyncState();
    }
  }

  public FsusUploadItem? AddItem(
    string fileName,
    long sizeBytes,
    string contentType)
  {
    if (IsDisabled)
    {
      return null;
    }

    var item = new FsusUploadItem(fileName, sizeBytes, contentType);
    var validationMessage = ValidateItem?.Invoke(item);
    if (!string.IsNullOrWhiteSpace(validationMessage))
    {
      item.Status = FsusUploadItemStatus.Error;
      item.ErrorMessage = validationMessage;
    }

    Items.Add(item);
    SyncState();
    return item;
  }

  public bool SetProgress(Guid itemId, double progress)
  {
    var item = FindItem(itemId);
    if (item is null || item.Status == FsusUploadItemStatus.Error)
    {
      return false;
    }

    item.Progress = Math.Clamp(progress, 0d, 1d);
    item.Status = item.Progress >= 1d
      ? FsusUploadItemStatus.Success
      : FsusUploadItemStatus.Uploading;
    item.ErrorMessage = null;
    SyncState();
    return true;
  }

  public bool MarkError(Guid itemId, string message)
  {
    var item = FindItem(itemId);
    if (item is null)
    {
      return false;
    }

    item.Status = FsusUploadItemStatus.Error;
    item.ErrorMessage = message;
    SyncState();
    return true;
  }

  public bool Retry(Guid itemId)
  {
    var item = FindItem(itemId);
    if (item is null || item.Status != FsusUploadItemStatus.Error)
    {
      return false;
    }

    item.RetryCount++;
    item.Status = FsusUploadItemStatus.Queued;
    item.Progress = 0d;
    item.ErrorMessage = null;
    SyncState();
    return true;
  }

  public bool RemoveItem(Guid itemId, bool confirmed = false)
  {
    if (IsConfirmRemoveRequired && !confirmed)
    {
      return false;
    }

    var item = FindItem(itemId);
    if (item is null)
    {
      return false;
    }

    Items.Remove(item);
    SyncState();
    return true;
  }

  private FsusUploadItem? FindItem(Guid itemId) =>
    Items.FirstOrDefault((item) => item.Id == itemId);

  private void SyncState()
  {
    FsusComponentClasses.SyncSize(this, Size);
    FsusComponentClasses.Ensure(this, "fsus-empty", Items.Count == 0);
    FsusComponentClasses.Ensure(this, "fsus-disabled", IsDisabled);
    FsusComponentClasses.Ensure(this, "fsus-has-errors", Items.Any((item) => item.Status == FsusUploadItemStatus.Error));
    FsusComponentClasses.Ensure(this, "fsus-uploading", Items.Any((item) => item.Status == FsusUploadItemStatus.Uploading));
    AutomationProperties.SetName(this, FsusComponentClasses.ResolveName(AccessibleName, Items.Count));
    AutomationProperties.SetControlTypeOverride(this, AutomationControlType.List);
    AutomationProperties.SetItemStatus(
      this,
      $"{Items.Count.ToString(CultureInfo.InvariantCulture)} files, {Items.Count((item) => item.Status == FsusUploadItemStatus.Error).ToString(CultureInfo.InvariantCulture)} errors");
  }
}

public sealed class FsusTransferItem(
  object? value,
  string label)
{
  public object? Value { get; } = value;
  public string Label { get; } = label;
  public bool IsDisabled { get; set; }
}

public class FsusTransfer : ContentControl
{
  private readonly List<FsusTransferItem> filteredLeftItems = [];
  private readonly List<FsusTransferItem> filteredRightItems = [];
  private readonly List<FsusTransferItem> virtualizedLeftItems = [];
  private readonly List<object?> targetValues = [];
  private readonly List<object?> selectedLeftValues = [];
  private readonly List<object?> selectedRightValues = [];

  public FsusTransfer()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-transfer");
    Focusable = true;
    SyncState();
  }

  public string? AccessibleName { get; set; }
  public Collection<FsusTransferItem> Items { get; } = [];
  public bool IsFilterable { get; set; }
  public string FilterText { get; private set; } = string.Empty;
  public int HighlightedLeftIndex { get; private set; } = -1;
  public int VirtualizationThreshold { get; set; } = 250;
  public int VisibleItemLimit { get; set; } = 40;
  public int VirtualizedLeftStartIndex { get; private set; }
  public bool IsVirtualized { get; private set; }
  public int EstimatedRetainedItemControls => IsVirtualized ? VirtualizedLeftItems.Count + FilteredRightItems.Count + 8 : SourceCount + TargetValues.Count;
  public int SourceCount => Items.Count((item) => !TargetValues.Any((value) => ValuesEqual(value, item.Value)));
  public IReadOnlyList<object?> TargetValues => targetValues.AsReadOnly();
  public IReadOnlyList<object?> SelectedLeftValues => selectedLeftValues.AsReadOnly();
  public IReadOnlyList<object?> SelectedRightValues => selectedRightValues.AsReadOnly();
  public IReadOnlyList<FsusTransferItem> FilteredLeftItems => filteredLeftItems.AsReadOnly();
  public IReadOnlyList<FsusTransferItem> FilteredRightItems => filteredRightItems.AsReadOnly();
  public IReadOnlyList<FsusTransferItem> VirtualizedLeftItems => virtualizedLeftItems.AsReadOnly();

  public void RefreshLists()
  {
    RebuildFilteredLists();
    SyncState();
  }

  public void ApplyFilter(string query)
  {
    FilterText = query ?? string.Empty;
    RebuildFilteredLists();
    SyncState();
  }

  public bool ToggleLeftSelection(object? value)
  {
    var item = filteredLeftItems.FirstOrDefault((candidate) => ValuesEqual(candidate.Value, value));
    if (item is null || item.IsDisabled)
    {
      return false;
    }

    ToggleValue(selectedLeftValues, value);
    SyncState();
    return true;
  }

  public bool ToggleRightSelection(object? value)
  {
    var item = filteredRightItems.FirstOrDefault((candidate) => ValuesEqual(candidate.Value, value));
    if (item is null || item.IsDisabled)
    {
      return false;
    }

    ToggleValue(selectedRightValues, value);
    SyncState();
    return true;
  }

  public bool MoveSelectedRight()
  {
    var moved = false;
    foreach (var item in filteredLeftItems)
    {
      if (
        selectedLeftValues.Any((value) => ValuesEqual(value, item.Value)) &&
        !item.IsDisabled &&
        !targetValues.Any((value) => ValuesEqual(value, item.Value)))
      {
        targetValues.Add(item.Value);
        moved = true;
      }
    }

    selectedLeftValues.Clear();
    RebuildFilteredLists();
    SyncState();
    return moved;
  }

  public bool MoveSelectedLeft()
  {
    var before = targetValues.Count;
    targetValues.RemoveAll((value) => selectedRightValues.Any((selected) => ValuesEqual(selected, value)));
    selectedRightValues.Clear();
    RebuildFilteredLists();
    SyncState();
    return targetValues.Count != before;
  }

  public void ScrollLeftTo(int startIndex)
  {
    var maxStart = Math.Max(0, filteredLeftItems.Count - Math.Max(1, VisibleItemLimit));
    VirtualizedLeftStartIndex = Math.Clamp(startIndex, 0, maxStart);
    RebuildVirtualizedLeft();
    SyncState();
  }

  protected ValueTask<bool> HandleKeyAsync(Key key)
  {
    RefreshIfNeeded();
    if (key == Key.Down)
    {
      return ValueTask.FromResult(MoveHighlight(1));
    }

    if (key == Key.Up)
    {
      return ValueTask.FromResult(MoveHighlight(-1));
    }

    if (key == Key.Space && HighlightedLeftIndex >= 0 && HighlightedLeftIndex < filteredLeftItems.Count)
    {
      return ValueTask.FromResult(ToggleLeftSelection(filteredLeftItems[HighlightedLeftIndex].Value));
    }

    if (key == Key.Enter)
    {
      return ValueTask.FromResult(MoveSelectedRight());
    }

    return ValueTask.FromResult(false);
  }

  private void RefreshIfNeeded()
  {
    if (filteredLeftItems.Count == 0 && Items.Count > 0)
    {
      RefreshLists();
    }
  }

  private void RebuildFilteredLists()
  {
    filteredLeftItems.Clear();
    filteredRightItems.Clear();
    foreach (var item in Items)
    {
      var inTarget = targetValues.Any((value) => ValuesEqual(value, item.Value));
      if (!MatchesFilter(item))
      {
        continue;
      }

      if (inTarget)
      {
        filteredRightItems.Add(item);
      }
      else
      {
        filteredLeftItems.Add(item);
      }
    }

    HighlightedLeftIndex = FindFirstEnabledIndex(filteredLeftItems);
    IsVirtualized = filteredLeftItems.Count > VirtualizationThreshold;
    VirtualizedLeftStartIndex = 0;
    RebuildVirtualizedLeft();
  }

  private void RebuildVirtualizedLeft()
  {
    virtualizedLeftItems.Clear();
    if (!IsVirtualized)
    {
      virtualizedLeftItems.AddRange(filteredLeftItems);
      return;
    }

    virtualizedLeftItems.AddRange(filteredLeftItems.Skip(VirtualizedLeftStartIndex).Take(Math.Max(1, VisibleItemLimit)));
  }

  private bool MatchesFilter(FsusTransferItem item) =>
    string.IsNullOrWhiteSpace(FilterText) ||
    item.Label.Contains(FilterText, StringComparison.OrdinalIgnoreCase) ||
    (item.Value?.ToString() ?? string.Empty).Contains(FilterText, StringComparison.OrdinalIgnoreCase);

  private bool MoveHighlight(int delta)
  {
    if (filteredLeftItems.Count == 0)
    {
      return false;
    }

    var current = HighlightedLeftIndex < 0 ? -1 : HighlightedLeftIndex;
    for (var step = 0; step < filteredLeftItems.Count; step++)
    {
      current = (current + delta + filteredLeftItems.Count) % filteredLeftItems.Count;
      if (!filteredLeftItems[current].IsDisabled)
      {
        HighlightedLeftIndex = current;
        SyncState();
        return true;
      }
    }

    return false;
  }

  private static int FindFirstEnabledIndex(IReadOnlyList<FsusTransferItem> items)
  {
    for (var index = 0; index < items.Count; index++)
    {
      if (!items[index].IsDisabled)
      {
        return index;
      }
    }

    return -1;
  }

  private static void ToggleValue(List<object?> values, object? value)
  {
    var index = values.FindIndex((candidate) => ValuesEqual(candidate, value));
    if (index >= 0)
    {
      values.RemoveAt(index);
      return;
    }

    values.Add(value);
  }

  private void SyncState()
  {
    FsusComponentClasses.Ensure(this, "fsus-filterable", IsFilterable);
    FsusComponentClasses.Ensure(this, "fsus-filtered", !string.IsNullOrWhiteSpace(FilterText));
    FsusComponentClasses.Ensure(this, "fsus-has-target", TargetValues.Count > 0);
    FsusComponentClasses.Ensure(this, "fsus-virtualized", IsVirtualized);
    AutomationProperties.SetName(this, FsusComponentClasses.ResolveName(AccessibleName, TargetValues.Count));
    AutomationProperties.SetControlTypeOverride(this, AutomationControlType.List);
    AutomationProperties.SetItemStatus(
      this,
      $"{SourceCount.ToString(CultureInfo.InvariantCulture)} source, {TargetValues.Count.ToString(CultureInfo.InvariantCulture)} target");
  }

  private static bool ValuesEqual(object? first, object? second) =>
    EqualityComparer<object?>.Default.Equals(first, second);
}
