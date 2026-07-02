using Avalonia;
using Avalonia.Automation;
using Avalonia.Automation.Peers;
using Avalonia.Controls;
using Avalonia.Input;
using FsusUI.Avalonia.Overlay;
using System.Collections.ObjectModel;
using System.Globalization;

namespace FsusUI.Avalonia.Controls;

public delegate ValueTask<IEnumerable<FsusOption>> FsusRemoteOptionsProvider(
  string query,
  CancellationToken cancellationToken);

public sealed class FsusPickerSelectionChangedEventArgs(
  IReadOnlyList<object?> oldValue,
  IReadOnlyList<object?> newValue) : EventArgs
{
  public IReadOnlyList<object?> OldValue { get; } = oldValue;
  public IReadOnlyList<object?> NewValue { get; } = newValue;
}

public sealed class FsusCascaderPathSelectedEventArgs(
  IReadOnlyList<object?> selectedValues,
  IReadOnlyList<string> selectedLabels) : EventArgs
{
  public IReadOnlyList<object?> SelectedValues { get; } = selectedValues;
  public IReadOnlyList<string> SelectedLabels { get; } = selectedLabels;
}

public class FsusOption : ContentControl
{
  public object? Value { get; set; }
  public string Label { get; set; } = string.Empty;
  public bool IsDisabled { get; set; }
  public string? GroupLabel { get; internal set; }

  public FsusOption()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-option");
    SyncState(false, false);
  }

  internal void SyncState(bool selected, bool highlighted)
  {
    FsusComponentClasses.Ensure(this, "fsus-selected", selected);
    FsusComponentClasses.Ensure(this, "fsus-highlighted", highlighted);
    FsusComponentClasses.Ensure(this, "fsus-disabled", IsDisabled);
    AutomationProperties.SetName(this, FsusComponentClasses.ResolveName(Label, Content));
    AutomationProperties.SetControlTypeOverride(this, AutomationControlType.ListItem);
    AutomationProperties.SetItemStatus(
      this,
      $"{(selected ? "selected" : "available")}{(IsDisabled ? " disabled" : string.Empty)}");
  }
}

public class FsusOptionGroup : ContentControl
{
  public string Label { get; set; } = string.Empty;
  public bool IsDisabled { get; set; }
  public Collection<FsusOption> Options { get; } = [];

  public FsusOptionGroup()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-option-group");
    SyncState();
  }

  internal void SyncState()
  {
    foreach (var option in Options)
    {
      option.GroupLabel = Label;
      if (IsDisabled)
      {
        option.IsDisabled = true;
      }
    }

    FsusComponentClasses.Ensure(this, "fsus-disabled", IsDisabled);
    AutomationProperties.SetName(this, Label);
    AutomationProperties.SetControlTypeOverride(this, AutomationControlType.Group);
    AutomationProperties.SetItemStatus(this, $"{Options.Count.ToString(CultureInfo.InvariantCulture)} options");
  }
}

public class FsusSelect : ContentControl, IFsusOverlayLifecycle
{
  private readonly List<FsusOption> allOptions = [];
  private readonly List<FsusOption> filteredOptions = [];
  private readonly List<FsusOption> virtualizedOptions = [];
  private readonly List<object?> selectedValues = [];
  private readonly List<string> selectedLabels = [];
  private FsusOverlayHost? overlayHost;

  public FsusSelect() : this("fsus-select")
  {
  }

  protected FsusSelect(string baseClass)
  {
    FsusComponentClasses.SetBaseClasses(this, baseClass);
    if (baseClass != "fsus-select")
    {
      FsusComponentClasses.Ensure(this, "fsus-select", true);
    }

    Focusable = true;
    SyncState();
  }

  public event EventHandler<FsusPickerSelectionChangedEventArgs>? SelectionChanged;

  public Collection<FsusOption> Options { get; } = [];
  public Collection<FsusOptionGroup> OptionGroups { get; } = [];

  public string? AccessibleName { get; set; }
  public bool IsMultiple { get; set; }
  public bool IsFilterable { get; set; }
  public bool IsClearable { get; set; }
  public string FilterText { get; protected set; } = string.Empty;
  public FsusComponentSize Size { get; set; } = FsusComponentSize.Md;
  public FsusAnchoredPlacement Placement { get; set; } = FsusAnchoredPlacement.BottomStart;
  public Rect AnchorBounds { get; set; } = new(0, 0, 240, 32);
  public Size OverlaySize { get; set; } = new(280, 240);
  public Rect ViewportBounds { get; set; } = new(0, 0, 1920, 1080);
  public int VirtualizationThreshold { get; set; } = 250;
  public int VisibleOptionLimit { get; set; } = 32;
  public int HighlightedIndex { get; private set; } = -1;
  public bool IsOpen { get; private set; }
  public FsusOverlayEntry? OverlayEntry { get; private set; }
  public int TotalOptionCount => allOptions.Count;
  public bool IsVirtualized { get; private set; }
  public int VirtualizedStartIndex { get; private set; }
  public int VirtualizedOptionCount => virtualizedOptions.Count;
  public int EstimatedRetainedOptionControls => IsVirtualized ? virtualizedOptions.Count + 4 : filteredOptions.Count;
  public IReadOnlyList<FsusOption> FilteredOptions => filteredOptions.AsReadOnly();
  public IReadOnlyList<FsusOption> VirtualizedOptions => virtualizedOptions.AsReadOnly();
  public IReadOnlyList<object?> SelectedValues => selectedValues.AsReadOnly();
  public IReadOnlyList<string> SelectedLabels => selectedLabels.AsReadOnly();
  public string SelectedLabel => selectedLabels.FirstOrDefault() ?? string.Empty;

  public object? SelectedValue
  {
    get => selectedValues.FirstOrDefault();
    set
    {
      selectedValues.Clear();
      selectedLabels.Clear();
      if (value is not null)
      {
        SelectValue(value);
        return;
      }

      SyncState();
    }
  }

  protected virtual bool SupportsVirtualization => false;
  protected virtual bool IsLoadingState => false;
  protected virtual bool IsRemoteState => false;

  public FsusOverlayEntry Open(FsusOverlayHost host)
  {
    ArgumentNullException.ThrowIfNull(host);
    RefreshOptions();
    return IsOpen && OverlayEntry is not null
      ? OverlayEntry
      : host.Open(this, CreateOverlayOptions());
  }

  public ValueTask<bool> CloseAsync()
  {
    if (OverlayEntry is null || overlayHost is null)
    {
      return ValueTask.FromResult(false);
    }

    return overlayHost.CloseAsync(OverlayEntry);
  }

  public virtual void RefreshOptions()
  {
    allOptions.Clear();
    foreach (var group in OptionGroups)
    {
      group.SyncState();
      allOptions.AddRange(group.Options);
    }

    foreach (var option in Options)
    {
      option.GroupLabel = null;
      allOptions.Add(option);
    }

    RebuildFilteredOptions();
    SyncSelectionLabels();
    SyncOptionStates();
    SyncState();
  }

  public void ApplyFilter(string query)
  {
    FilterText = query ?? string.Empty;
    RebuildFilteredOptions();
    SyncOptionStates();
    SyncState();
  }

  public bool SelectValue(object? value)
  {
    RefreshOptionsIfNeeded();
    var option = allOptions.FirstOrDefault((candidate) => ValuesEqual(candidate.Value, value));
    return option is not null && SelectOption(option);
  }

  public bool SelectOption(FsusOption option)
  {
    ArgumentNullException.ThrowIfNull(option);
    if (option.IsDisabled)
    {
      return false;
    }

    var oldValue = selectedValues.ToArray();
    if (IsMultiple)
    {
      if (selectedValues.Any((value) => ValuesEqual(value, option.Value)))
      {
        selectedValues.RemoveAll((value) => ValuesEqual(value, option.Value));
      }
      else
      {
        selectedValues.Add(option.Value);
      }
    }
    else
    {
      selectedValues.Clear();
      selectedValues.Add(option.Value);
    }

    SyncSelectionLabels();
    SyncOptionStates();
    SyncState();
    EmitSelectionIfChanged(oldValue);
    return true;
  }

  public void ClearSelection()
  {
    if (!IsClearable || selectedValues.Count == 0)
    {
      return;
    }

    var oldValue = selectedValues.ToArray();
    selectedValues.Clear();
    selectedLabels.Clear();
    FilterText = string.Empty;
    RebuildFilteredOptions();
    SyncOptionStates();
    SyncState();
    EmitSelectionIfChanged(oldValue);
  }

  public void ScrollToOption(int startIndex)
  {
    RefreshOptionsIfNeeded();
    var maxStart = Math.Max(0, filteredOptions.Count - Math.Max(1, VisibleOptionLimit));
    VirtualizedStartIndex = Math.Clamp(startIndex, 0, maxStart);
    RebuildVirtualizedOptions();
    SyncOptionStates();
    SyncState();
  }

  public virtual void OnOverlayOpened(FsusOverlayEntry entry)
  {
    OverlayEntry = entry;
    overlayHost = entry.Content.Parent as FsusOverlayHost;
    IsOpen = true;
    SyncState();
  }

  public virtual void OnOverlayClosed(FsusOverlayCloseReason reason)
  {
    OverlayEntry = null;
    overlayHost = null;
    IsOpen = false;
    SyncState();
  }

  protected ValueTask<bool> HandleKeyAsync(Key key)
  {
    RefreshOptionsIfNeeded();
    return key switch
    {
      Key.Down => ValueTask.FromResult(MoveHighlight(1)),
      Key.Up => ValueTask.FromResult(MoveHighlight(-1)),
      Key.Enter => ValueTask.FromResult(SelectHighlightedOption()),
      Key.Escape => CloseAsync(),
      _ => ValueTask.FromResult(false),
    };
  }

  protected virtual string ResolveAutomationName() =>
    FsusComponentClasses.ResolveName(AccessibleName, SelectedLabel);

  protected virtual void SyncState()
  {
    FsusComponentClasses.SyncSize(this, Size);
    FsusComponentClasses.Ensure(this, "fsus-open", IsOpen);
    FsusComponentClasses.Ensure(this, "fsus-multiple", IsMultiple);
    FsusComponentClasses.Ensure(this, "fsus-single", !IsMultiple);
    FsusComponentClasses.Ensure(this, "fsus-filterable", IsFilterable);
    FsusComponentClasses.Ensure(this, "fsus-clearable", IsClearable);
    FsusComponentClasses.Ensure(this, "fsus-filtered", !string.IsNullOrWhiteSpace(FilterText));
    FsusComponentClasses.Ensure(this, "fsus-empty", selectedValues.Count == 0);
    FsusComponentClasses.Ensure(this, "fsus-disabled", !IsEnabled);
    FsusComponentClasses.Ensure(this, "fsus-virtualized", IsVirtualized);
    FsusComponentClasses.Ensure(this, "fsus-loading", IsLoadingState);
    FsusComponentClasses.Ensure(this, "fsus-remote", IsRemoteState);
    AutomationProperties.SetName(this, ResolveAutomationName());
    AutomationProperties.SetControlTypeOverride(this, AutomationControlType.ComboBox);
    AutomationProperties.SetItemStatus(
      this,
      $"{(IsOpen ? "open" : "closed")} {(IsMultiple ? "multiple" : "single")} {selectedValues.Count.ToString(CultureInfo.InvariantCulture)} selected");
  }

  private void RefreshOptionsIfNeeded()
  {
    if (allOptions.Count == 0 && (Options.Count > 0 || OptionGroups.Count > 0))
    {
      RefreshOptions();
    }
  }

  private void RebuildFilteredOptions()
  {
    filteredOptions.Clear();
    var query = FilterText.Trim();
    foreach (var option in allOptions)
    {
      if (
        query.Length == 0 ||
        option.Label.Contains(query, StringComparison.OrdinalIgnoreCase) ||
        (option.Value?.ToString() ?? string.Empty).Contains(query, StringComparison.OrdinalIgnoreCase))
      {
        filteredOptions.Add(option);
      }
    }

    HighlightedIndex = FindFirstEnabledIndex(filteredOptions);
    IsVirtualized = SupportsVirtualization && filteredOptions.Count > VirtualizationThreshold;
    VirtualizedStartIndex = 0;
    RebuildVirtualizedOptions();
  }

  private void RebuildVirtualizedOptions()
  {
    virtualizedOptions.Clear();
    if (!IsVirtualized)
    {
      virtualizedOptions.AddRange(filteredOptions);
      return;
    }

    var limit = Math.Max(1, VisibleOptionLimit);
    virtualizedOptions.AddRange(filteredOptions.Skip(VirtualizedStartIndex).Take(limit));
  }

  private void SyncOptionStates()
  {
    for (var index = 0; index < filteredOptions.Count; index++)
    {
      var option = filteredOptions[index];
      option.SyncState(
        selectedValues.Any((value) => ValuesEqual(value, option.Value)),
        index == HighlightedIndex);
    }
  }

  private void SyncSelectionLabels()
  {
    selectedLabels.Clear();
    foreach (var selectedValue in selectedValues)
    {
      var option = allOptions.FirstOrDefault((candidate) => ValuesEqual(candidate.Value, selectedValue));
      selectedLabels.Add(option?.Label ?? selectedValue?.ToString() ?? string.Empty);
    }
  }

  private bool SelectHighlightedOption() =>
    HighlightedIndex >= 0 &&
    HighlightedIndex < filteredOptions.Count &&
    SelectOption(filteredOptions[HighlightedIndex]);

  private bool MoveHighlight(int delta)
  {
    if (filteredOptions.Count == 0)
    {
      return false;
    }

    var current = HighlightedIndex < 0 ? -1 : HighlightedIndex;
    for (var step = 0; step < filteredOptions.Count; step++)
    {
      current = (current + delta + filteredOptions.Count) % filteredOptions.Count;
      if (!filteredOptions[current].IsDisabled)
      {
        HighlightedIndex = current;
        SyncOptionStates();
        SyncState();
        return true;
      }
    }

    return false;
  }

  private void EmitSelectionIfChanged(IReadOnlyList<object?> oldValue)
  {
    if (oldValue.Count == selectedValues.Count &&
      oldValue.Zip(selectedValues).All((pair) => ValuesEqual(pair.First, pair.Second)))
    {
      return;
    }

    SelectionChanged?.Invoke(
      this,
      new FsusPickerSelectionChangedEventArgs(oldValue, selectedValues.ToArray()));
  }

  private FsusOverlayOptions CreateOverlayOptions() =>
    new()
    {
      IsModal = false,
      CloseOnEscape = true,
      CloseOnPointerOutside = true,
      AnchorBounds = AnchorBounds,
      OverlaySize = OverlaySize,
      ViewportBounds = ViewportBounds,
      Placement = ToOverlayPlacement(Placement),
    };

  private static int FindFirstEnabledIndex(IReadOnlyList<FsusOption> options)
  {
    for (var index = 0; index < options.Count; index++)
    {
      if (!options[index].IsDisabled)
      {
        return index;
      }
    }

    return -1;
  }

  private static bool ValuesEqual(object? first, object? second) =>
    EqualityComparer<object?>.Default.Equals(first, second);

  private static FsusOverlayPlacement ToOverlayPlacement(FsusAnchoredPlacement placement) =>
    placement switch
    {
      FsusAnchoredPlacement.BottomEnd => FsusOverlayPlacement.BottomEnd,
      FsusAnchoredPlacement.TopStart => FsusOverlayPlacement.TopStart,
      FsusAnchoredPlacement.TopEnd => FsusOverlayPlacement.TopEnd,
      FsusAnchoredPlacement.LeftStart => FsusOverlayPlacement.LeftStart,
      FsusAnchoredPlacement.LeftEnd => FsusOverlayPlacement.LeftEnd,
      FsusAnchoredPlacement.RightStart => FsusOverlayPlacement.RightStart,
      FsusAnchoredPlacement.RightEnd => FsusOverlayPlacement.RightEnd,
      _ => FsusOverlayPlacement.BottomStart,
    };
}

public class FsusSelectV2 : FsusSelect
{
  public FsusSelectV2() : base("fsus-select-v2")
  {
  }

  protected override bool SupportsVirtualization => true;
}

public class FsusAutocomplete : FsusSelect
{
  public FsusAutocomplete() : base("fsus-autocomplete")
  {
    IsFilterable = true;
    SyncState();
  }

  public FsusRemoteOptionsProvider? RemoteSearchAsync { get; set; }
  public IReadOnlyList<FsusOption> Suggestions => FilteredOptions;
  public bool IsLoading { get; private set; }

  protected override bool IsLoadingState => IsLoading;
  protected override bool IsRemoteState => RemoteSearchAsync is not null;

  public async ValueTask<bool> TypeAsync(
    string query,
    CancellationToken cancellationToken = default)
  {
    FilterText = query ?? string.Empty;
    if (RemoteSearchAsync is null)
    {
      ApplyFilter(FilterText);
      return true;
    }

    if (cancellationToken.IsCancellationRequested)
    {
      return false;
    }

    IsLoading = true;
    SyncState();
    var options = await RemoteSearchAsync(FilterText, cancellationToken);
    if (cancellationToken.IsCancellationRequested)
    {
      IsLoading = false;
      SyncState();
      return false;
    }

    Options.Clear();
    foreach (var option in options)
    {
      Options.Add(option);
    }

    IsLoading = false;
    RefreshOptions();
    return true;
  }

  protected override string ResolveAutomationName() =>
    !string.IsNullOrWhiteSpace(SelectedLabel)
      ? SelectedLabel
      : base.ResolveAutomationName();

  protected override void SyncState()
  {
    base.SyncState();
    AutomationProperties.SetItemStatus(
      this,
      $"{(IsOpen ? "open" : "closed")} {SelectedValues.Count.ToString(CultureInfo.InvariantCulture)} selected");
  }
}

public sealed class FsusCascaderNode(
  object? value,
  string label)
{
  public object? Value { get; } = value;
  public string Label { get; } = label;
  public bool IsDisabled { get; set; }
  public Collection<FsusCascaderNode> Children { get; init; } = [];
}

public class FsusCascaderPanel : ContentControl
{
  private readonly List<IReadOnlyList<FsusCascaderNode>> columns = [];
  private readonly List<FsusCascaderNode> activePath = [];
  private readonly List<FsusCascaderNode> selectedPath = [];
  private readonly List<int> highlightedIndexes = [];

  public FsusCascaderPanel()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-cascader-panel");
    Focusable = true;
    SyncState();
  }

  public event EventHandler<FsusCascaderPathSelectedEventArgs>? PathSelected;

  public Collection<FsusCascaderNode> Nodes { get; } = [];
  public IReadOnlyList<IReadOnlyList<FsusCascaderNode>> Columns => columns.AsReadOnly();
  public IReadOnlyList<int> HighlightedIndexes => highlightedIndexes.AsReadOnly();
  public IReadOnlyList<object?> ActivePathValues => activePath.Select((node) => node.Value).ToArray();
  public IReadOnlyList<object?> SelectedPathValues => selectedPath.Select((node) => node.Value).ToArray();
  public IReadOnlyList<string> SelectedPathLabels => selectedPath.Select((node) => node.Label).ToArray();
  public object? SelectedValue => selectedPath.LastOrDefault()?.Value;
  public string SelectedLabel => string.Join(" / ", SelectedPathLabels);

  public void RefreshColumns()
  {
    columns.Clear();
    highlightedIndexes.Clear();
    columns.Add(Nodes.ToArray());
    highlightedIndexes.Add(FindFirstEnabledIndex(Nodes));
    SyncState();
  }

  public bool NavigateTo(object? value)
  {
    EnsureColumns();
    var columnIndex = Math.Max(0, columns.Count - 1);
    var column = columns[columnIndex];
    var node = column.FirstOrDefault((candidate) => ValuesEqual(candidate.Value, value));
    if (node is null || node.IsDisabled)
    {
      return false;
    }

    while (activePath.Count > columnIndex)
    {
      activePath.RemoveAt(activePath.Count - 1);
    }

    activePath.Add(node);
    RebuildColumnsFromActivePath();
    SyncState();
    return true;
  }

  public bool SelectPath(IEnumerable<object?> values)
  {
    ArgumentNullException.ThrowIfNull(values);
    var nextPath = new List<FsusCascaderNode>();
    IReadOnlyList<FsusCascaderNode> currentNodes = Nodes;
    foreach (var value in values)
    {
      var node = currentNodes.FirstOrDefault((candidate) => ValuesEqual(candidate.Value, value));
      if (node is null || node.IsDisabled)
      {
        return false;
      }

      nextPath.Add(node);
      currentNodes = node.Children;
    }

    activePath.Clear();
    activePath.AddRange(nextPath.Take(Math.Max(0, nextPath.Count - 1)));
    selectedPath.Clear();
    selectedPath.AddRange(nextPath);
    RebuildColumnsForPath(nextPath);
    EmitSelectedPath();
    SyncState();
    return true;
  }

  protected ValueTask<bool> HandleKeyAsync(Key key)
  {
    EnsureColumns();
    return key switch
    {
      Key.Down => ValueTask.FromResult(MoveHighlight(1)),
      Key.Up => ValueTask.FromResult(MoveHighlight(-1)),
      Key.Enter => ValueTask.FromResult(SelectHighlightedNode()),
      _ => ValueTask.FromResult(false),
    };
  }

  private bool SelectHighlightedNode()
  {
    var node = HighlightedNode();
    if (node is null || node.IsDisabled)
    {
      return false;
    }

    if (node.Children.Count > 0)
    {
      return NavigateTo(node.Value);
    }

    selectedPath.Clear();
    selectedPath.AddRange(activePath);
    selectedPath.Add(node);
    EmitSelectedPath();
    SyncState();
    return true;
  }

  private bool MoveHighlight(int delta)
  {
    var columnIndex = highlightedIndexes.Count - 1;
    if (columnIndex < 0)
    {
      return false;
    }

    var column = columns[columnIndex];
    if (column.Count == 0)
    {
      return false;
    }

    var current = highlightedIndexes[columnIndex] < 0 ? -1 : highlightedIndexes[columnIndex];
    for (var step = 0; step < column.Count; step++)
    {
      current = (current + delta + column.Count) % column.Count;
      if (!column[current].IsDisabled)
      {
        highlightedIndexes[columnIndex] = current;
        SyncState();
        return true;
      }
    }

    return false;
  }

  private FsusCascaderNode? HighlightedNode()
  {
    if (columns.Count == 0 || highlightedIndexes.Count == 0)
    {
      return null;
    }

    var column = columns.Last();
    var highlightedIndex = highlightedIndexes.Last();
    return highlightedIndex >= 0 && highlightedIndex < column.Count
      ? column[highlightedIndex]
      : null;
  }

  private void EnsureColumns()
  {
    if (columns.Count == 0)
    {
      RefreshColumns();
    }
  }

  private void RebuildColumnsFromActivePath()
  {
    columns.Clear();
    highlightedIndexes.Clear();
    columns.Add(Nodes.ToArray());
    highlightedIndexes.Add(IndexOf(Nodes, activePath.FirstOrDefault()));
    IReadOnlyList<FsusCascaderNode> currentNodes = Nodes;
    foreach (var node in activePath)
    {
      currentNodes = node.Children;
      if (currentNodes.Count == 0)
      {
        continue;
      }

      columns.Add(currentNodes.ToArray());
      highlightedIndexes.Add(FindFirstEnabledIndex(currentNodes));
    }
  }

  private void RebuildColumnsForPath(IReadOnlyList<FsusCascaderNode> path)
  {
    columns.Clear();
    highlightedIndexes.Clear();
    columns.Add(Nodes.ToArray());
    var currentNodes = Nodes;
    foreach (var node in path)
    {
      highlightedIndexes.Add(IndexOf(currentNodes, node));
      currentNodes = node.Children;
      if (currentNodes.Count > 0)
      {
        columns.Add(currentNodes.ToArray());
      }
    }
  }

  private void EmitSelectedPath()
  {
    PathSelected?.Invoke(
      this,
      new FsusCascaderPathSelectedEventArgs(SelectedPathValues, SelectedPathLabels));
  }

  private void SyncState()
  {
    FsusComponentClasses.Ensure(this, "fsus-empty", selectedPath.Count == 0);
    FsusComponentClasses.Ensure(this, "fsus-selected", selectedPath.Count > 0);
    AutomationProperties.SetName(this, SelectedLabel);
    AutomationProperties.SetControlTypeOverride(this, AutomationControlType.Tree);
    AutomationProperties.SetItemStatus(
      this,
      selectedPath.Count == 0
        ? "empty"
        : $"selected depth {selectedPath.Count.ToString(CultureInfo.InvariantCulture)}");
  }

  private static int IndexOf(IReadOnlyList<FsusCascaderNode> nodes, FsusCascaderNode? node)
  {
    if (node is null)
    {
      return FindFirstEnabledIndex(nodes);
    }

    for (var index = 0; index < nodes.Count; index++)
    {
      if (ReferenceEquals(nodes[index], node))
      {
        return index;
      }
    }

    return FindFirstEnabledIndex(nodes);
  }

  private static int FindFirstEnabledIndex(IReadOnlyList<FsusCascaderNode> nodes)
  {
    for (var index = 0; index < nodes.Count; index++)
    {
      if (!nodes[index].IsDisabled)
      {
        return index;
      }
    }

    return -1;
  }

  private static bool ValuesEqual(object? first, object? second) =>
    EqualityComparer<object?>.Default.Equals(first, second);
}

public class FsusCascader : ContentControl, IFsusOverlayLifecycle
{
  private FsusCascaderPanel panel = new();
  private FsusOverlayHost? overlayHost;

  public FsusCascader()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-cascader");
    Focusable = true;
    panel.PathSelected += HandlePanelPathSelected;
    SyncState();
  }

  public string? AccessibleName { get; set; }
  public FsusAnchoredPlacement Placement { get; set; } = FsusAnchoredPlacement.BottomStart;
  public Rect AnchorBounds { get; set; } = new(0, 0, 240, 32);
  public Size OverlaySize { get; set; } = new(320, 280);
  public Rect ViewportBounds { get; set; } = new(0, 0, 1920, 1080);
  public FsusOverlayEntry? OverlayEntry { get; private set; }
  public bool IsOpen { get; private set; }
  public object? SelectedValue => Panel.SelectedValue;
  public IReadOnlyList<object?> SelectedPathValues => Panel.SelectedPathValues;
  public string SelectedLabel => Panel.SelectedLabel;

  public FsusCascaderPanel Panel
  {
    get => panel;
    set
    {
      panel.PathSelected -= HandlePanelPathSelected;
      panel = value ?? new FsusCascaderPanel();
      panel.PathSelected += HandlePanelPathSelected;
      SyncState();
    }
  }

  public FsusOverlayEntry Open(FsusOverlayHost host)
  {
    ArgumentNullException.ThrowIfNull(host);
    Panel.RefreshColumns();
    return IsOpen && OverlayEntry is not null
      ? OverlayEntry
      : host.Open(this, CreateOverlayOptions());
  }

  public bool SelectPath(IEnumerable<object?> values)
  {
    var selected = Panel.SelectPath(values);
    SyncState();
    return selected;
  }

  public ValueTask<bool> CloseAsync()
  {
    if (OverlayEntry is null || overlayHost is null)
    {
      return ValueTask.FromResult(false);
    }

    return overlayHost.CloseAsync(OverlayEntry);
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

  private void HandlePanelPathSelected(object? sender, FsusCascaderPathSelectedEventArgs args) =>
    SyncState();

  private void SyncState()
  {
    FsusComponentClasses.Ensure(this, "fsus-open", IsOpen);
    FsusComponentClasses.Ensure(this, "fsus-empty", SelectedPathValues.Count == 0);
    FsusComponentClasses.Ensure(this, "fsus-selected", SelectedPathValues.Count > 0);
    AutomationProperties.SetName(this, FsusComponentClasses.ResolveName(AccessibleName, SelectedLabel));
    AutomationProperties.SetControlTypeOverride(this, AutomationControlType.ComboBox);
    AutomationProperties.SetItemStatus(
      this,
      $"{(IsOpen ? "open" : "closed")} {SelectedPathValues.Count.ToString(CultureInfo.InvariantCulture)} levels");
  }

  private FsusOverlayOptions CreateOverlayOptions() =>
    new()
    {
      IsModal = false,
      CloseOnEscape = true,
      CloseOnPointerOutside = true,
      AnchorBounds = AnchorBounds,
      OverlaySize = OverlaySize,
      ViewportBounds = ViewportBounds,
      Placement = ToOverlayPlacement(Placement),
    };

  private static FsusOverlayPlacement ToOverlayPlacement(FsusAnchoredPlacement placement) =>
    placement switch
    {
      FsusAnchoredPlacement.BottomEnd => FsusOverlayPlacement.BottomEnd,
      FsusAnchoredPlacement.TopStart => FsusOverlayPlacement.TopStart,
      FsusAnchoredPlacement.TopEnd => FsusOverlayPlacement.TopEnd,
      FsusAnchoredPlacement.LeftStart => FsusOverlayPlacement.LeftStart,
      FsusAnchoredPlacement.LeftEnd => FsusOverlayPlacement.LeftEnd,
      FsusAnchoredPlacement.RightStart => FsusOverlayPlacement.RightStart,
      FsusAnchoredPlacement.RightEnd => FsusOverlayPlacement.RightEnd,
      _ => FsusOverlayPlacement.BottomStart,
    };
}
