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

public sealed class FsusPickerSelectionChangedEventArgs(
  IReadOnlyList<object?> oldValue,
  IReadOnlyList<object?> newValue) : EventArgs
{
  public IReadOnlyList<object?> OldValue { get; } = oldValue;
  public IReadOnlyList<object?> NewValue { get; } = newValue;
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

