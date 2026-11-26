using Avalonia;
using Avalonia.Automation;
using Avalonia.Controls;
using Avalonia.Controls.Primitives;
using Avalonia.Data;
using Avalonia.Input;
using Avalonia.Interactivity;
using Avalonia.Layout;
using Avalonia.Media;
using Avalonia.VisualTree;
using FsusUI.Avalonia.Overlay;
using System.Collections;
using System.Collections.Specialized;
using System.Globalization;

namespace FsusUI.Avalonia.Controls;

public delegate ValueTask<IEnumerable<FsusOption>> FsusRemoteOptionsProvider(
  string query,
  CancellationToken cancellationToken);

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
