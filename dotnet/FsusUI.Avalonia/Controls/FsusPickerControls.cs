using Avalonia;
using Avalonia.Automation;
using Avalonia.Automation.Peers;
using Avalonia.Automation.Provider;
using Avalonia.Controls;
using Avalonia.Controls.Primitives;
using Avalonia.Controls.Primitives.PopupPositioning;
using Avalonia.Data;
using Avalonia.Input;
using Avalonia.Interactivity;
using Avalonia.Layout;
using Avalonia.Media;
using Avalonia.VisualTree;
using FsusUI.Avalonia.Overlay;
using System.Collections;
using System.Collections.ObjectModel;
using System.Collections.Specialized;
using System.Diagnostics.CodeAnalysis;
using System.Globalization;
using System.Reflection;

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
  internal FsusSelect? ParentSelect { get; set; }

  public FsusOption()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-option");
    SyncState(false, false);
  }

  internal void SyncState(bool selected, bool highlighted)
  {
    if (Content is null && !string.IsNullOrEmpty(Label))
    {
      Content = Label;
    }
    FsusComponentClasses.Ensure(this, "fsus-selected", selected);
    FsusComponentClasses.Ensure(this, "fsus-highlighted", highlighted);
    FsusComponentClasses.Ensure(this, "fsus-disabled", IsDisabled);
    IsEnabled = !IsDisabled;
    IsHitTestVisible = !IsDisabled;
    AutomationProperties.SetName(this, FsusComponentClasses.ResolveName(Label, Content));
    AutomationProperties.SetControlTypeOverride(this, AutomationControlType.ListItem);
    AutomationProperties.SetItemStatus(
      this,
      $"{(selected ? "selected" : "available")}{(IsDisabled ? " disabled" : string.Empty)}");
  }

  protected override AutomationPeer OnCreateAutomationPeer() =>
    new FsusOptionAutomationPeer(this);

  private sealed class FsusOptionAutomationPeer(FsusOption owner)
    : ControlAutomationPeer(owner), ISelectionItemProvider
  {
    public bool IsSelected => owner.ParentSelect?.SelectedValues.Any(
      value => FsusSelect.ValuesEqual(value, owner.Value)) == true;

    public ISelectionProvider SelectionContainer =>
      owner.ParentSelect is null
        ? null!
        : (ISelectionProvider)CreatePeerForElement(owner.ParentSelect);

    public void AddToSelection() => Select();

    public void RemoveFromSelection()
    {
      if (owner.ParentSelect?.IsMultiple == true && IsSelected)
      {
        owner.ParentSelect.SelectOption(owner);
      }
    }

    public void Select()
    {
      if (!owner.IsDisabled)
      {
        owner.ParentSelect?.SelectOption(owner);
      }
    }
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
  public static readonly StyledProperty<IEnumerable?> ItemsSourceProperty =
    AvaloniaProperty.Register<FsusSelect, IEnumerable?>(nameof(ItemsSource));

  public static readonly StyledProperty<object?> SelectedValueProperty =
    AvaloniaProperty.Register<FsusSelect, object?>(
      nameof(SelectedValue),
      defaultBindingMode: BindingMode.TwoWay);

  public static readonly StyledProperty<string?> DisplayMemberPathProperty =
    AvaloniaProperty.Register<FsusSelect, string?>(nameof(DisplayMemberPath));

  public static readonly StyledProperty<string?> SelectedValuePathProperty =
    AvaloniaProperty.Register<FsusSelect, string?>(nameof(SelectedValuePath));

  protected readonly List<FsusOption> allOptions = [];
  protected readonly List<FsusOption> filteredOptions = [];
  protected readonly List<FsusOption> virtualizedOptions = [];
  protected readonly List<object?> selectedValues = [];
  protected readonly List<string> selectedLabels = [];
  protected FsusOverlayHost? overlayHost;
  private readonly bool hasProductionSelectSurface;
  private readonly TextBlock? selectedText;
  private readonly Popup? selectPopup;
  private readonly Border? popupBorder;
  private readonly ScrollViewer? popupScrollViewer;
  private readonly StackPanel? optionsPanel;
  private bool isUpdatingSelectedValue;

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
    hasProductionSelectSurface = baseClass == "fsus-select";
    if (hasProductionSelectSurface)
    {
      selectedText = new TextBlock
      {
        Name = "PART_SelectedText",
        VerticalAlignment = VerticalAlignment.Center,
        TextTrimming = TextTrimming.CharacterEllipsis,
      };
      selectedText.Classes.Add("fsus-select-selected-text");

      optionsPanel = new StackPanel { Name = "PART_OptionsPanel" };
      optionsPanel.Classes.Add("fsus-select-options");
      AutomationProperties.SetControlTypeOverride(optionsPanel, AutomationControlType.List);
      optionsPanel.AddHandler(
        InputElement.PointerPressedEvent,
        OnOptionsPanelPointerPressed,
        RoutingStrategies.Bubble);

      popupScrollViewer = new ScrollViewer
      {
        Content = optionsPanel,
        MaxHeight = 274,
        HorizontalScrollBarVisibility = ScrollBarVisibility.Disabled,
        VerticalScrollBarVisibility = ScrollBarVisibility.Auto,
      };

      popupBorder = new Border
      {
        Name = "PART_PopupBorder",
        Child = popupScrollViewer,
      };
      popupBorder.Classes.Add("fsus-select-popup-border");

      selectPopup = new Popup
      {
        Name = "PART_Popup",
        Child = popupBorder,
        PlacementTarget = this,
        Placement = PlacementMode.BottomEdgeAlignedLeft,
        PlacementConstraintAdjustment =
          PopupPositionerConstraintAdjustment.FlipY |
          PopupPositionerConstraintAdjustment.SlideX |
          PopupPositionerConstraintAdjustment.SlideY |
          PopupPositionerConstraintAdjustment.ResizeY,
        ShouldUseOverlayLayer = true,
        IsLightDismissEnabled = true,
        InheritsTransform = true,
      };
      selectPopup.Closed += OnSelectPopupClosed;

      var root = new Grid();
      root.Children.Add(selectedText);
      root.Children.Add(selectPopup);
      Content = root;
    }
    SyncState();
  }

  public event EventHandler<FsusPickerSelectionChangedEventArgs>? SelectionChanged;

  public Collection<FsusOption> Options { get; } = [];
  public Collection<FsusOptionGroup> OptionGroups { get; } = [];

  public IEnumerable? ItemsSource
  {
    get => GetValue(ItemsSourceProperty);
    set => SetValue(ItemsSourceProperty, value);
  }

  public object? SelectedValue
  {
    get => IsMultiple ? selectedValues.FirstOrDefault() : GetValue(SelectedValueProperty);
    set => SetValue(SelectedValueProperty, value);
  }

  public string? DisplayMemberPath
  {
    get => GetValue(DisplayMemberPathProperty);
    set => SetValue(DisplayMemberPathProperty, value);
  }

  public string? SelectedValuePath
  {
    get => GetValue(SelectedValuePathProperty);
    set => SetValue(SelectedValuePathProperty, value);
  }

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
  public int HighlightedIndex { get; protected set; } = -1;
  public bool IsOpen { get; protected set; }
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

  protected virtual bool SupportsVirtualization => false;
  protected virtual bool IsLoadingState => false;
  protected virtual bool IsRemoteState => false;
  protected virtual IEnumerable<FsusOption> GetAdditionalOptions()
  {
    if (ItemsSource is null)
    {
      yield break;
    }

    foreach (var item in ItemsSource)
    {
      if (item is FsusOption option)
      {
        yield return option;
        continue;
      }

      var labelValue = ResolveMemberPath(item, DisplayMemberPath);
      var value = string.IsNullOrWhiteSpace(SelectedValuePath)
        ? item
        : ResolveMemberPath(item, SelectedValuePath);
      var label = labelValue?.ToString() ?? string.Empty;
      yield return new FsusOption
      {
        Value = value,
        Label = label,
        Content = label,
      };
    }
  }

  protected virtual bool HasAdditionalOptions() => ItemsSource is not null;

  public FsusOverlayEntry Open(FsusOverlayHost host)
  {
    ArgumentNullException.ThrowIfNull(host);
    RefreshOptions();
    return IsOpen && OverlayEntry is not null
      ? OverlayEntry
      : host.Open(this, CreateOverlayOptions());
  }

  public virtual ValueTask<bool> CloseAsync()
  {
    if (selectPopup?.IsOpen == true)
    {
      CloseProductionPopup();
      return ValueTask.FromResult(true);
    }

    if (OverlayEntry is null || overlayHost is null)
    {
      return ValueTask.FromResult(false);
    }

    return overlayHost.CloseAsync(OverlayEntry);
  }

  public virtual void RefreshOptions()
  {
    allOptions.Clear();
    allOptions.AddRange(GetAdditionalOptions());
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

    foreach (var option in allOptions)
    {
      option.ParentSelect = this;
    }

    RebuildFilteredOptions();
    if (hasProductionSelectSurface)
    {
      SyncSelectionFromBindableValue(SelectedValue, emitChange: false);
    }
    SyncSelectionLabels();
    SyncOptionStates();
    RebuildProductionPopupOptions();
    SyncState();
  }

  public virtual void ApplyFilter(string query)
  {
    FilterText = query ?? string.Empty;
    RebuildFilteredOptions();
    SyncOptionStates();
    SyncState();
  }

  public virtual bool SelectValue(object? value)
  {
    RefreshOptionsIfNeeded();
    var option = allOptions.FirstOrDefault((candidate) => ValuesEqual(candidate.Value, value));
    return option is not null && SelectOption(option);
  }

  public virtual bool SelectOption(FsusOption option)
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
    if (!IsMultiple)
    {
      isUpdatingSelectedValue = true;
      SetCurrentValue(SelectedValueProperty, option.Value);
      isUpdatingSelectedValue = false;
    }
    if (hasProductionSelectSurface && OverlayEntry is null)
    {
      CloseProductionPopup();
    }
    SyncState();
    EmitSelectionIfChanged(oldValue);
    return true;
  }

  public virtual void ClearSelection()
  {
    if (!IsClearable || selectedValues.Count == 0)
    {
      return;
    }

    var oldValue = selectedValues.ToArray();
    selectedValues.Clear();
    selectedLabels.Clear();
    isUpdatingSelectedValue = true;
    SetCurrentValue(SelectedValueProperty, null);
    isUpdatingSelectedValue = false;
    FilterText = string.Empty;
    RebuildFilteredOptions();
    SyncOptionStates();
    SyncState();
    EmitSelectionIfChanged(oldValue);
  }

  public virtual void ScrollToOption(int startIndex)
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

  protected virtual ValueTask<bool> HandleKeyAsync(Key key)
  {
    if (hasProductionSelectSurface && OverlayEntry is null)
    {
      return ValueTask.FromResult(ProcessProductionKey(key));
    }

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
    if (selectedText is not null)
    {
      selectedText.Text = SelectedLabel;
    }
  }

  protected override AutomationPeer OnCreateAutomationPeer() =>
    new FsusSelectAutomationPeer(this);

  protected override void OnPointerPressed(PointerPressedEventArgs e)
  {
    base.OnPointerPressed(e);
    if (!hasProductionSelectSurface || !IsEnabled)
    {
      return;
    }

    if (selectPopup?.IsOpen == true)
    {
      CloseProductionPopup();
    }
    else
    {
      OpenProductionPopup();
    }
    e.Handled = true;
  }

  protected override void OnKeyDown(KeyEventArgs e)
  {
    if (hasProductionSelectSurface && ProcessProductionKey(e.Key))
    {
      e.Handled = true;
      return;
    }

    base.OnKeyDown(e);
  }

  protected override void OnPropertyChanged(AvaloniaPropertyChangedEventArgs change)
  {
    base.OnPropertyChanged(change);

    if (change.Property == ItemsSourceProperty)
    {
      if (change.OldValue is INotifyCollectionChanged oldCollection)
      {
        oldCollection.CollectionChanged -= OnItemsSourceCollectionChanged;
      }
      if (change.NewValue is INotifyCollectionChanged newCollection)
      {
        newCollection.CollectionChanged += OnItemsSourceCollectionChanged;
      }
      RefreshOptions();
    }
    else if (change.Property == SelectedValueProperty && !isUpdatingSelectedValue)
    {
      SyncSelectionFromBindableValue(SelectedValue, emitChange: true);
    }
    else if (
      change.Property == DisplayMemberPathProperty ||
      change.Property == SelectedValuePathProperty)
    {
      RefreshOptions();
    }
    else if (change.Property == IsEnabledProperty)
    {
      if (!IsEnabled)
      {
        CloseProductionPopup();
      }
      SyncState();
    }
  }

  protected void RefreshOptionsIfNeeded()
  {
    if (allOptions.Count == 0 && (Options.Count > 0 || OptionGroups.Count > 0 || HasAdditionalOptions()))
    {
      RefreshOptions();
    }
  }

  protected void RebuildFilteredOptions()
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

  protected void RebuildVirtualizedOptions()
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

  protected void SyncOptionStates()
  {
    for (var index = 0; index < filteredOptions.Count; index++)
    {
      var option = filteredOptions[index];
      option.SyncState(
        selectedValues.Any((value) => ValuesEqual(value, option.Value)),
        index == HighlightedIndex);
    }
  }

  protected void SyncSelectionLabels()
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

  protected bool MoveHighlight(int delta)
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

  private void OnItemsSourceCollectionChanged(object? sender, NotifyCollectionChangedEventArgs e) =>
    RefreshOptions();

  private void OpenProductionPopup()
  {
    if (!hasProductionSelectSurface || !IsEnabled || selectPopup is null || popupBorder is null)
    {
      return;
    }

    RefreshOptions();
    if (filteredOptions.Count == 0)
    {
      return;
    }

    var selectedIndex = filteredOptions.FindIndex(option =>
      selectedValues.Any(value => ValuesEqual(value, option.Value)) && !option.IsDisabled);
    HighlightedIndex = selectedIndex >= 0 ? selectedIndex : FindFirstEnabledIndex(filteredOptions);
    SyncOptionStates();
    RebuildProductionPopupOptions();
    popupBorder.MinWidth = Math.Max(Bounds.Width, 1);
    selectPopup.Placement = ResolveViewportPlacement();
    selectPopup.IsOpen = true;
    IsOpen = true;
    SyncState();
  }

  private void CloseProductionPopup()
  {
    if (selectPopup is not null)
    {
      selectPopup.IsOpen = false;
    }
    IsOpen = false;
    SyncState();
    if (IsEnabled)
    {
      Focus();
    }
  }

  private bool ProcessProductionKey(Key key)
  {
    if (!IsEnabled)
    {
      return false;
    }

    switch (key)
    {
      case Key.Down:
      case Key.Up:
        if (selectPopup?.IsOpen != true)
        {
          OpenProductionPopup();
          return IsOpen;
        }
        var moved = MoveHighlight(key == Key.Down ? 1 : -1);
        RebuildProductionPopupOptions();
        return moved;

      case Key.Enter:
        if (selectPopup?.IsOpen != true)
        {
          OpenProductionPopup();
          return IsOpen;
        }
        var selected = SelectHighlightedOption();
        if (selected)
        {
          CloseProductionPopup();
        }
        return selected;

      case Key.Escape:
        if (selectPopup?.IsOpen == true)
        {
          CloseProductionPopup();
          return true;
        }
        return false;

      default:
        return false;
    }
  }

  private void RebuildProductionPopupOptions()
  {
    if (optionsPanel is null)
    {
      return;
    }

    optionsPanel.Children.Clear();
    var options = IsVirtualized ? VirtualizedOptions : FilteredOptions;
    foreach (var option in options)
    {
      if (option.Parent is Panel parent)
      {
        parent.Children.Remove(option);
      }
      optionsPanel.Children.Add(option);
    }
  }

  private void OnOptionsPanelPointerPressed(object? sender, PointerPressedEventArgs e)
  {
    var option = (e.Source as Visual)?.FindAncestorOfType<FsusOption>(includeSelf: true);
    if (option is not null && !option.IsDisabled && SelectOption(option))
    {
      e.Handled = true;
    }
  }

  private void OnSelectPopupClosed(object? sender, EventArgs e)
  {
    IsOpen = false;
    SyncState();
  }

  private void SyncSelectionFromBindableValue(object? value, bool emitChange)
  {
    var oldValue = selectedValues.ToArray();
    selectedValues.Clear();
    selectedLabels.Clear();
    if (value is not null)
    {
      var option = allOptions.FirstOrDefault(candidate => ValuesEqual(candidate.Value, value));
      if (option is not null && !option.IsDisabled)
      {
        selectedValues.Add(option.Value);
      }
    }

    SyncSelectionLabels();
    SyncOptionStates();
    SyncState();
    if (emitChange)
    {
      EmitSelectionIfChanged(oldValue);
    }
  }

  [UnconditionalSuppressMessage(
    "Trimming",
    "IL2075",
    Justification = "DisplayMemberPath and SelectedValuePath are explicit runtime member-path contracts; dictionary-backed items remain reflection-free.")]
  private static object? ResolveMemberPath(object? item, string? path)
  {
    if (item is null || string.IsNullOrWhiteSpace(path))
    {
      return item;
    }

    object? current = item;
    foreach (var segment in path.Split('.', StringSplitOptions.RemoveEmptyEntries))
    {
      if (current is null)
      {
        return null;
      }
      if (current is IReadOnlyDictionary<string, object?> readOnlyDictionary &&
          readOnlyDictionary.TryGetValue(segment, out var readOnlyValue))
      {
        current = readOnlyValue;
        continue;
      }
      if (current is IDictionary dictionary && dictionary.Contains(segment))
      {
        current = dictionary[segment];
        continue;
      }

      var property = current.GetType().GetProperty(
        segment,
        BindingFlags.Instance | BindingFlags.Public);
      if (property is null || property.GetIndexParameters().Length != 0)
      {
        return null;
      }
      current = property.GetValue(current);
    }
    return current;
  }

  private static PlacementMode ToPopupPlacement(FsusAnchoredPlacement placement) =>
    placement switch
    {
      FsusAnchoredPlacement.BottomEnd => PlacementMode.BottomEdgeAlignedRight,
      FsusAnchoredPlacement.TopStart => PlacementMode.TopEdgeAlignedLeft,
      FsusAnchoredPlacement.TopEnd => PlacementMode.TopEdgeAlignedRight,
      FsusAnchoredPlacement.LeftStart => PlacementMode.LeftEdgeAlignedTop,
      FsusAnchoredPlacement.LeftEnd => PlacementMode.LeftEdgeAlignedBottom,
      FsusAnchoredPlacement.RightStart => PlacementMode.RightEdgeAlignedTop,
      FsusAnchoredPlacement.RightEnd => PlacementMode.RightEdgeAlignedBottom,
      _ => PlacementMode.BottomEdgeAlignedLeft,
    };

  private PlacementMode ResolveViewportPlacement()
  {
    var requested = ToPopupPlacement(Placement);
    if (
      popupBorder is null ||
      popupScrollViewer is null ||
      TopLevel.GetTopLevel(this) is not TopLevel topLevel ||
      this.TranslatePoint(new Point(0, 0), topLevel) is not Point anchor)
    {
      return requested;
    }

    popupScrollViewer.MaxHeight = 274;
    popupBorder.Measure(new Size(Math.Max(Bounds.Width, 1), double.PositiveInfinity));
    var desiredHeight = Math.Min(274, popupBorder.DesiredSize.Height);
    var topAvailable = Math.Max(0, anchor.Y - 8);
    var bottomAvailable = Math.Max(
      0,
      topLevel.ClientSize.Height - anchor.Y - Bounds.Height - 8);
    var isBottom = requested is
      PlacementMode.Bottom or
      PlacementMode.BottomEdgeAlignedLeft or
      PlacementMode.BottomEdgeAlignedRight;
    var isTop = requested is
      PlacementMode.Top or
      PlacementMode.TopEdgeAlignedLeft or
      PlacementMode.TopEdgeAlignedRight;

    var resolved = requested;
    var available = isTop ? topAvailable : bottomAvailable;
    if (isBottom && bottomAvailable < desiredHeight && topAvailable > bottomAvailable)
    {
      resolved = requested == PlacementMode.BottomEdgeAlignedRight
        ? PlacementMode.TopEdgeAlignedRight
        : PlacementMode.TopEdgeAlignedLeft;
      available = topAvailable;
    }
    else if (isTop && topAvailable < desiredHeight && bottomAvailable > topAvailable)
    {
      resolved = requested == PlacementMode.TopEdgeAlignedRight
        ? PlacementMode.BottomEdgeAlignedRight
        : PlacementMode.BottomEdgeAlignedLeft;
      available = bottomAvailable;
    }

    if (isBottom || isTop)
    {
      popupScrollViewer.MaxHeight = Math.Max(1, Math.Min(274, available - 16));
    }
    return resolved;
  }

  private sealed class FsusSelectAutomationPeer(FsusSelect owner)
    : ControlAutomationPeer(owner), IExpandCollapseProvider, ISelectionProvider
  {
    public ExpandCollapseState ExpandCollapseState => owner.IsOpen
      ? ExpandCollapseState.Expanded
      : ExpandCollapseState.Collapsed;

    public bool ShowsMenu => true;

    public bool CanSelectMultiple => owner.IsMultiple;

    public bool IsSelectionRequired => false;

    public void Expand() => owner.OpenProductionPopup();

    public void Collapse() => owner.CloseProductionPopup();

    public IReadOnlyList<AutomationPeer> GetSelection() =>
      owner.allOptions
        .Where(option => owner.selectedValues.Any(value => ValuesEqual(value, option.Value)))
        .Select(CreatePeerForElement)
        .ToArray();
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

  protected internal static bool ValuesEqual(object? first, object? second) =>
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
  public static readonly StyledProperty<string?> TextProperty =
    AvaloniaProperty.Register<FsusAutocomplete, string?>(
      nameof(Text),
      defaultBindingMode: BindingMode.TwoWay);

  public new static readonly StyledProperty<object?> SelectedValueProperty =
    AvaloniaProperty.Register<FsusAutocomplete, object?>(
      nameof(SelectedValue),
      defaultBindingMode: BindingMode.TwoWay);

  public new static readonly StyledProperty<IEnumerable?> ItemsSourceProperty =
    AvaloniaProperty.Register<FsusAutocomplete, IEnumerable?>(
      nameof(ItemsSource));

  public static readonly StyledProperty<string?> PlaceholderTextProperty =
    AvaloniaProperty.Register<FsusAutocomplete, string?>(
      nameof(PlaceholderText));

  private readonly TextBox innerTextBox;
  private readonly Popup innerPopup;
  private readonly StackPanel suggestionsPanel;
  private readonly ScrollViewer popupScrollViewer;
  private readonly Border popupBorder;
  private bool isUpdatingText;
  private bool isUpdatingSelection;

  public FsusAutocomplete() : base("fsus-autocomplete")
  {
    IsFilterable = true;

    innerTextBox = new TextBox
    {
      Name = "PART_TextBox",
      Background = Brushes.Transparent,
      BorderThickness = new Thickness(0),
      Padding = new Thickness(0),
      VerticalAlignment = VerticalAlignment.Center,
      HorizontalAlignment = HorizontalAlignment.Stretch,
    };

    innerTextBox.PropertyChanged += OnInnerTextBoxPropertyChanged;
    innerTextBox.KeyDown += OnInnerTextBoxKeyDown;
    innerTextBox.AddHandler(
      InputElement.PointerPressedEvent,
      OnInnerTextBoxPointerPressed,
      RoutingStrategies.Tunnel | RoutingStrategies.Bubble);
    innerTextBox.GotFocus += OnInnerTextBoxGotFocus;
    GotFocus += OnSelfGotFocus;

    suggestionsPanel = new StackPanel();
    suggestionsPanel.AddHandler(
      InputElement.PointerPressedEvent,
      OnSuggestionsPanelPointerPressed,
      RoutingStrategies.Bubble);

    popupScrollViewer = new ScrollViewer
    {
      Content = suggestionsPanel,
      MaxHeight = 240,
      HorizontalScrollBarVisibility = ScrollBarVisibility.Disabled,
      VerticalScrollBarVisibility = ScrollBarVisibility.Auto,
    };

    popupBorder = new Border
    {
      Child = popupScrollViewer,
      CornerRadius = new CornerRadius(4),
      BorderThickness = new Thickness(1),
      Background = Brushes.White,
    };
    popupBorder.Classes.Add("fsus-autocomplete-popup-border");

    innerPopup = new Popup
    {
      Name = "PART_Popup",
      Child = popupBorder,
      PlacementTarget = this,
      Placement = PlacementMode.Bottom,
      IsLightDismissEnabled = true,
      InheritsTransform = true,
    };
    innerPopup.Closed += OnPopupClosed;

    var container = new Grid();
    container.Children.Add(innerTextBox);
    container.Children.Add(innerPopup);
    Content = container;

    SyncState();
  }

  public string? Text
  {
    get => GetValue(TextProperty);
    set => SetValue(TextProperty, value);
  }

  public new object? SelectedValue
  {
    get => GetValue(SelectedValueProperty);
    set => SetValue(SelectedValueProperty, value);
  }

  public new IEnumerable? ItemsSource
  {
    get => GetValue(ItemsSourceProperty);
    set => SetValue(ItemsSourceProperty, value);
  }

  public string? PlaceholderText
  {
    get => GetValue(PlaceholderTextProperty);
    set => SetValue(PlaceholderTextProperty, value);
  }

  public TextBox? TextBox => innerTextBox;
  public Popup? Popup => innerPopup;

  public FsusRemoteOptionsProvider? RemoteSearchAsync { get; set; }
  public IReadOnlyList<FsusOption> Suggestions => FilteredOptions;
  public bool IsLoading { get; private set; }

  protected override bool SupportsVirtualization => true;
  protected override bool IsLoadingState => IsLoading;
  protected override bool IsRemoteState => RemoteSearchAsync is not null;
  protected override bool HasAdditionalOptions() => ItemsSource is not null;

  public void OpenPopup()
  {
    if (!IsEnabled)
    {
      return;
    }

    RefreshOptionsIfNeeded();
    RebuildPopupSuggestions();

    var targetWidth = Bounds.Width > 0 ? Bounds.Width : OverlaySize.Width;
    if (targetWidth > 0)
    {
      popupBorder.MinWidth = targetWidth;
    }

    innerPopup.IsOpen = true;
    IsOpen = true;
    SyncState();
  }

  public void ClosePopup()
  {
    innerPopup.IsOpen = false;
    IsOpen = false;
    SyncState();
  }

  public override async ValueTask<bool> CloseAsync()
  {
    ClosePopup();
    return await base.CloseAsync();
  }

  public override void OnOverlayOpened(FsusOverlayEntry entry)
  {
    base.OnOverlayOpened(entry);
    innerPopup.IsOpen = true;
    RebuildPopupSuggestions();
  }

  public override void OnOverlayClosed(FsusOverlayCloseReason reason)
  {
    base.OnOverlayClosed(reason);
    innerPopup.IsOpen = false;
  }

  public override bool SelectOption(FsusOption option)
  {
    ArgumentNullException.ThrowIfNull(option);
    if (option.IsDisabled)
    {
      return false;
    }

    var success = base.SelectOption(option);
    if (success)
    {
      isUpdatingSelection = true;
      SelectedValue = option.Value;
      isUpdatingSelection = false;

      isUpdatingText = true;
      Text = option.Label;
      innerTextBox.Text = option.Label;
      isUpdatingText = false;

      ClosePopup();
    }

    return success;
  }

  public override void ClearSelection()
  {
    base.ClearSelection();

    isUpdatingSelection = true;
    SelectedValue = null;
    isUpdatingSelection = false;

    isUpdatingText = true;
    Text = string.Empty;
    innerTextBox.Text = string.Empty;
    isUpdatingText = false;

    ClosePopup();
  }

  public override void ScrollToOption(int startIndex)
  {
    base.ScrollToOption(startIndex);
    RebuildPopupSuggestions();
  }

  public override void ApplyFilter(string query)
  {
    base.ApplyFilter(query);
    RebuildPopupSuggestions();
  }

  public async ValueTask<bool> TypeAsync(
    string query,
    CancellationToken cancellationToken = default)
  {
    FilterText = query ?? string.Empty;
    isUpdatingText = true;
    Text = FilterText;
    innerTextBox.Text = FilterText;
    isUpdatingText = false;

    if (RemoteSearchAsync is null)
    {
      ApplyFilter(FilterText);
      RebuildPopupSuggestions();
      SyncSelectedValueFromText();
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
    RebuildPopupSuggestions();
    SyncSelectedValueFromText();
    return true;
  }

  protected override IEnumerable<FsusOption> GetAdditionalOptions()
  {
    if (ItemsSource is null)
    {
      yield break;
    }

    foreach (var item in ItemsSource)
    {
      if (item is FsusOption option)
      {
        if (option.Content is null && !string.IsNullOrEmpty(option.Label))
        {
          option.Content = option.Label;
        }
        yield return option;
      }
      else if (item is not null)
      {
        var label = item.ToString() ?? string.Empty;
        yield return new FsusOption
        {
          Value = item,
          Label = label,
          Content = label,
        };
      }
    }
  }

  protected override void OnPropertyChanged(AvaloniaPropertyChangedEventArgs change)
  {
    base.OnPropertyChanged(change);

    if (change.Property == TextProperty)
    {
      if (!isUpdatingText)
      {
        var newText = Text;
        isUpdatingText = true;
        innerTextBox.Text = newText;
        isUpdatingText = false;

        FilterText = newText ?? string.Empty;
        RebuildFilteredOptions();
        RebuildPopupSuggestions();
        SyncSelectedValueFromText();
      }
    }
    else if (change.Property == SelectedValueProperty)
    {
      if (!isUpdatingSelection)
      {
        SyncSelectionFromValue(SelectedValue);
      }
    }
    else if (change.Property == ItemsSourceProperty)
    {
      if (change.OldValue is INotifyCollectionChanged oldIncc)
      {
        oldIncc.CollectionChanged -= OnItemsSourceCollectionChanged;
      }
      if (change.NewValue is INotifyCollectionChanged newIncc)
      {
        newIncc.CollectionChanged += OnItemsSourceCollectionChanged;
      }

      RefreshOptions();
      if (SelectedValue is not null)
      {
        SyncSelectionFromValue(SelectedValue);
      }
    }
    else if (change.Property == PlaceholderTextProperty)
    {
      innerTextBox.PlaceholderText = PlaceholderText;
    }
  }

  protected override void OnPointerPressed(PointerPressedEventArgs e)
  {
    base.OnPointerPressed(e);
    if (!IsEnabled)
    {
      return;
    }

    if (!innerPopup.IsOpen)
    {
      OpenPopup();
    }
  }

  private void OnSelfGotFocus(object? sender, RoutedEventArgs e)
  {
    if (!innerTextBox.IsFocused)
    {
      innerTextBox.Focus();
    }

    if (IsEnabled && !innerPopup.IsOpen)
    {
      OpenPopup();
    }
  }

  protected override void OnKeyDown(KeyEventArgs e)
  {
    if (ProcessKey(e.Key))
    {
      e.Handled = true;
      return;
    }
    base.OnKeyDown(e);
  }

  protected override ValueTask<bool> HandleKeyAsync(Key key)
  {
    if (ProcessKey(key))
    {
      return ValueTask.FromResult(true);
    }
    return base.HandleKeyAsync(key);
  }

  protected override string ResolveAutomationName() =>
    !string.IsNullOrWhiteSpace(SelectedLabel)
      ? SelectedLabel
      : !string.IsNullOrWhiteSpace(Text)
        ? Text
        : base.ResolveAutomationName();

  protected override void SyncState()
  {
    base.SyncState();
    AutomationProperties.SetItemStatus(
      this,
      $"{(IsOpen ? "open" : "closed")} {SelectedValues.Count.ToString(CultureInfo.InvariantCulture)} selected");
  }

  private void OnInnerTextBoxPropertyChanged(object? sender, AvaloniaPropertyChangedEventArgs e)
  {
    if (e.Property == TextBox.TextProperty)
    {
      if (isUpdatingText)
      {
        return;
      }

      var newText = innerTextBox.Text;
      isUpdatingText = true;
      Text = newText;
      isUpdatingText = false;

      FilterText = newText ?? string.Empty;

      if (RemoteSearchAsync is null)
      {
        ApplyFilter(FilterText);
        RebuildPopupSuggestions();
        SyncSelectedValueFromText();

        if (!innerPopup.IsOpen && FilteredOptions.Count > 0)
        {
          OpenPopup();
        }
      }
    }
  }

  private void OnInnerTextBoxPointerPressed(object? sender, PointerPressedEventArgs e)
  {
    if (!IsEnabled)
    {
      return;
    }

    if (!innerPopup.IsOpen)
    {
      OpenPopup();
    }
  }

  private void OnInnerTextBoxGotFocus(object? sender, RoutedEventArgs e)
  {
    if (!IsEnabled)
    {
      return;
    }

    if (!innerPopup.IsOpen)
    {
      OpenPopup();
    }
  }

  private void OnInnerTextBoxKeyDown(object? sender, KeyEventArgs e)
  {
    if (ProcessKey(e.Key))
    {
      e.Handled = true;
    }
  }

  private void OnSuggestionsPanelPointerPressed(object? sender, PointerPressedEventArgs e)
  {
    var option = (e.Source as Visual)?.FindAncestorOfType<FsusOption>(includeSelf: true);
    if (option is not null && !option.IsDisabled)
    {
      SelectOption(option);
      e.Handled = true;
    }
  }

  private void OnPopupClosed(object? sender, EventArgs e)
  {
    IsOpen = false;
    SyncState();
  }

  private void OnItemsSourceCollectionChanged(object? sender, NotifyCollectionChangedEventArgs e)
  {
    RefreshOptions();
  }

  private void RebuildPopupSuggestions()
  {
    suggestionsPanel.Children.Clear();
    var list = IsVirtualized ? VirtualizedOptions : FilteredOptions;
    foreach (var option in list)
    {
      if (option.Content is null && !string.IsNullOrEmpty(option.Label))
      {
        option.Content = option.Label;
      }
      if (option.Parent is Panel parent)
      {
        parent.Children.Remove(option);
      }
      suggestionsPanel.Children.Add(option);
    }
  }

  private bool ProcessKey(Key key)
  {
    RefreshOptionsIfNeeded();
    switch (key)
    {
      case Key.Down:
        if (!IsOpen)
        {
          OpenPopup();
          return true;
        }
        var movedDown = MoveHighlight(1);
        if (IsVirtualized && HighlightedIndex >= 0)
        {
          if (HighlightedIndex < VirtualizedStartIndex)
          {
            ScrollToOption(HighlightedIndex);
          }
          else if (HighlightedIndex >= VirtualizedStartIndex + VisibleOptionLimit)
          {
            ScrollToOption(HighlightedIndex - VisibleOptionLimit + 1);
          }
        }
        RebuildPopupSuggestions();
        return movedDown;

      case Key.Up:
        if (!IsOpen)
        {
          OpenPopup();
          return true;
        }
        var movedUp = MoveHighlight(-1);
        if (IsVirtualized && HighlightedIndex >= 0)
        {
          if (HighlightedIndex < VirtualizedStartIndex)
          {
            ScrollToOption(HighlightedIndex);
          }
          else if (HighlightedIndex >= VirtualizedStartIndex + VisibleOptionLimit)
          {
            ScrollToOption(HighlightedIndex - VisibleOptionLimit + 1);
          }
        }
        RebuildPopupSuggestions();
        return movedUp;

      case Key.Enter:
        if (HighlightedIndex >= 0 && HighlightedIndex < FilteredOptions.Count)
        {
          SelectOption(FilteredOptions[HighlightedIndex]);
          ClosePopup();
          return true;
        }
        ClosePopup();
        return false;

      case Key.Escape:
        ClosePopup();
        return true;

      default:
        return false;
    }
  }

  private void SyncSelectedValueFromText()
  {
    RefreshOptionsIfNeeded();
    var match = allOptions.FirstOrDefault(opt =>
      string.Equals(opt.Label, Text, StringComparison.OrdinalIgnoreCase) ||
      string.Equals(opt.Value?.ToString(), Text, StringComparison.OrdinalIgnoreCase));

    if (match is not null)
    {
      if (!ValuesEqual(SelectedValue, match.Value))
      {
        isUpdatingSelection = true;
        selectedValues.Clear();
        selectedValues.Add(match.Value);
        SelectedValue = match.Value;
        SyncSelectionLabels();
        SyncOptionStates();
        SyncState();
        isUpdatingSelection = false;
      }
    }
    else if (SelectedValue is not null)
    {
      isUpdatingSelection = true;
      selectedValues.Clear();
      SelectedValue = null;
      SyncSelectionLabels();
      SyncOptionStates();
      SyncState();
      isUpdatingSelection = false;
    }
  }

  private void SyncSelectionFromValue(object? value)
  {
    isUpdatingSelection = true;
    selectedValues.Clear();
    selectedLabels.Clear();

    if (value is not null)
    {
      RefreshOptionsIfNeeded();
      var match = allOptions.FirstOrDefault(opt => ValuesEqual(opt.Value, value));
      if (match is not null)
      {
        selectedValues.Add(match.Value);
        selectedLabels.Add(match.Label);
        isUpdatingText = true;
        Text = match.Label;
        innerTextBox.Text = match.Label;
        isUpdatingText = false;
        FilterText = match.Label;
        RebuildFilteredOptions();
        RebuildPopupSuggestions();
        SyncOptionStates();
      }
      else
      {
        selectedValues.Add(value);
        var label = value.ToString() ?? string.Empty;
        selectedLabels.Add(label);
        isUpdatingText = true;
        Text = label;
        innerTextBox.Text = label;
        isUpdatingText = false;
      }
    }
    else
    {
      isUpdatingText = true;
      Text = string.Empty;
      innerTextBox.Text = string.Empty;
      isUpdatingText = false;
      FilterText = string.Empty;
      RebuildFilteredOptions();
      RebuildPopupSuggestions();
      SyncOptionStates();
    }

    SyncState();
    isUpdatingSelection = false;
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
