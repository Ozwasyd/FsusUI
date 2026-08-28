using Avalonia;
using Avalonia.Automation;
using Avalonia.Automation.Peers;
using Avalonia.Automation.Provider;
using Avalonia.Controls;
using Avalonia.Controls.Presenters;
using Avalonia.Controls.Primitives;
using Avalonia.Controls.Templates;
using Avalonia.Input;
using Avalonia.Layout;
using Avalonia.Media;
using Avalonia.Metadata;
using System.Collections.ObjectModel;
using System.Collections.Specialized;
using System.Globalization;

namespace FsusUI.Avalonia.Controls;

public enum FsusSettingsScrollResetBehavior
{
  Reset,
  Restore,
}

public class FsusSettingsCategory : ContentControl
{
  public static readonly StyledProperty<string> KeyProperty =
    AvaloniaProperty.Register<FsusSettingsCategory, string>(nameof(Key), string.Empty);

  public static readonly StyledProperty<string> HeaderProperty =
    AvaloniaProperty.Register<FsusSettingsCategory, string>(nameof(Header), string.Empty);

  public static readonly StyledProperty<object?> IconProperty =
    AvaloniaProperty.Register<FsusSettingsCategory, object?>(nameof(Icon));

  public static readonly StyledProperty<string?> DescriptionProperty =
    AvaloniaProperty.Register<FsusSettingsCategory, string?>(nameof(Description));

  public static readonly StyledProperty<bool> IsSelectedProperty =
    AvaloniaProperty.Register<FsusSettingsCategory, bool>(nameof(IsSelected));

  public static readonly StyledProperty<string?> AccessibleNameProperty =
    AvaloniaProperty.Register<FsusSettingsCategory, string?>(nameof(AccessibleName));

  internal FsusSettingsShell? ParentShell { get; set; }

  public FsusSettingsCategory()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-settings-category");
    Focusable = true;
    Template = CreateDefaultTemplate();
    SyncState();
  }

  public string Key
  {
    get => GetValue(KeyProperty);
    set => SetValue(KeyProperty, value);
  }

  public string Header
  {
    get => GetValue(HeaderProperty);
    set => SetValue(HeaderProperty, value);
  }

  public object? Icon
  {
    get => GetValue(IconProperty);
    set => SetValue(IconProperty, value);
  }

  public string? Description
  {
    get => GetValue(DescriptionProperty);
    set => SetValue(DescriptionProperty, value);
  }

  public bool IsSelected
  {
    get => GetValue(IsSelectedProperty);
    set => SetValue(IsSelectedProperty, value);
  }

  public string? AccessibleName
  {
    get => GetValue(AccessibleNameProperty);
    set => SetValue(AccessibleNameProperty, value);
  }

  [Content]
  public new object? Content
  {
    get => base.Content;
    set => base.Content = value;
  }

  protected override void OnPointerPressed(PointerPressedEventArgs e)
  {
    base.OnPointerPressed(e);

    if (!IsEnabled)
    {
      return;
    }

    ParentShell?.SelectCategory(this);
    e.Handled = true;
  }

  protected override void OnKeyDown(KeyEventArgs e)
  {
    if (ParentShell is not null && ParentShell.HandleKey(e.Key))
    {
      e.Handled = true;
      return;
    }

    base.OnKeyDown(e);
  }

  protected override AutomationPeer OnCreateAutomationPeer() =>
    new FsusSettingsCategoryAutomationPeer(this);

  protected override void OnPropertyChanged(AvaloniaPropertyChangedEventArgs change)
  {
    base.OnPropertyChanged(change);

    if (
      change.Property == KeyProperty ||
      change.Property == HeaderProperty ||
      change.Property == IconProperty ||
      change.Property == DescriptionProperty ||
      change.Property == IsSelectedProperty ||
      change.Property == IsEnabledProperty ||
      change.Property == AccessibleNameProperty ||
      change.Property == IsKeyboardFocusWithinProperty)
    {
      SyncState();
    }

    if (change.Property == IsSelectedProperty &&
        change.OldValue is bool oldSelection &&
        change.NewValue is bool newSelection)
    {
      (ControlAutomationPeer.FromElement(this) as FsusSettingsCategoryAutomationPeer)
        ?.RaiseSelectionChanged(oldSelection, newSelection);
    }

    if (change.Property == IsKeyboardFocusWithinProperty)
    {
      ParentShell?.SetFocusedCategory(this, IsKeyboardFocusWithin);
    }

    if (change.Property == IsEnabledProperty)
    {
      ParentShell?.NormalizeSelection();
    }

    if (change.Property == ContentProperty)
    {
      ParentShell?.RefreshSelectedContent(this);
    }
  }

  internal void SyncState()
  {
    FsusComponentClasses.Ensure(this, "fsus-selected", IsSelected);
    FsusComponentClasses.Ensure(this, "fsus-disabled", !IsEnabled);
    FsusComponentClasses.Ensure(this, "fsus-has-icon", Icon is not null);
    AutomationProperties.SetName(
      this,
      FsusComponentClasses.ResolveName(
        AccessibleName,
        string.IsNullOrWhiteSpace(Header) ? Key : Header));
    AutomationProperties.SetControlTypeOverride(this, AutomationControlType.TabItem);
    AutomationProperties.SetItemStatus(
      this,
      IsSelected ? "selected" : IsEnabled ? "available" : "disabled");
  }

  private static IControlTemplate CreateDefaultTemplate()
  {
    return new FuncControlTemplate<FsusSettingsCategory>((category, _) =>
    {
      var border = new Border
      {
        Name = "PART_CategoryBorder",
        Padding = new Thickness(12, 8),
        CornerRadius = new CornerRadius(6),
      };

      border[!Border.BackgroundProperty] = category[!BackgroundProperty];
      border[!Border.BorderBrushProperty] = category[!BorderBrushProperty];
      border[!Border.BorderThicknessProperty] = category[!BorderThicknessProperty];
      border[!Border.CornerRadiusProperty] = category[!CornerRadiusProperty];
      border[!Border.PaddingProperty] = category[!PaddingProperty];

      var panel = new Grid
      {
        ColumnSpacing = 8,
        HorizontalAlignment = HorizontalAlignment.Stretch,
        VerticalAlignment = VerticalAlignment.Center,
      };
      panel.ColumnDefinitions.Add(new ColumnDefinition(GridLength.Auto));
      panel.ColumnDefinitions.Add(new ColumnDefinition(GridLength.Star));

      var iconPresenter = new ContentPresenter
      {
        VerticalAlignment = VerticalAlignment.Center,
      };
      iconPresenter.Classes.Add("fsus-settings-category-icon");
      iconPresenter[!ContentPresenter.ContentProperty] = category[!IconProperty];

      var headerPresenter = new TextBlock
      {
        MaxLines = 1,
        TextTrimming = TextTrimming.CharacterEllipsis,
        VerticalAlignment = VerticalAlignment.Center,
      };
      headerPresenter.Classes.Add("fsus-settings-category-header");
      headerPresenter[!TextBlock.TextProperty] = category[!HeaderProperty];

      panel.Classes.Add("fsus-settings-category-content");
      Grid.SetColumn(iconPresenter, 0);
      Grid.SetColumn(headerPresenter, 1);
      panel.Children.Add(iconPresenter);
      panel.Children.Add(headerPresenter);
      border.Child = panel;

      return border;
    });
  }

  private sealed class FsusSettingsCategoryAutomationPeer(FsusSettingsCategory owner)
    : ControlAutomationPeer(owner), ISelectionItemProvider
  {
    public bool IsSelected => owner.IsSelected;

    public ISelectionProvider SelectionContainer =>
      owner.ParentShell is null
        ? null!
        : (ISelectionProvider)CreatePeerForElement(owner.ParentShell);

    public void AddToSelection() => Select();

    public void RemoveFromSelection()
    {
      // Settings category selection is required while an enabled category
      // exists. Removing the selected item without a replacement is invalid.
    }

    public void Select()
    {
      if (owner.IsEnabled)
      {
        owner.ParentShell?.SelectCategory(owner);
      }
    }

    internal void RaiseSelectionChanged(bool oldValue, bool newValue) =>
      RaisePropertyChangedEvent(
        SelectionItemPatternIdentifiers.IsSelectedProperty,
        oldValue,
        newValue);
  }
}

public class FsusSettingsShell : ContentControl
{
  protected override bool BypassFlowDirectionPolicies => true;

  public static readonly StyledProperty<string?> AccessibleNameProperty =
    AvaloniaProperty.Register<FsusSettingsShell, string?>(
      nameof(AccessibleName),
      "Settings shell");

  public static readonly StyledProperty<string> SelectedKeyProperty =
    AvaloniaProperty.Register<FsusSettingsShell, string>(
      nameof(SelectedKey),
      string.Empty);

  public static readonly StyledProperty<double> RailWidthProperty =
    AvaloniaProperty.Register<FsusSettingsShell, double>(
      nameof(RailWidth),
      220d);

  public static readonly StyledProperty<object?> SearchSlotProperty =
    AvaloniaProperty.Register<FsusSettingsShell, object?>(
      nameof(SearchSlot));

  public static readonly StyledProperty<object?> ActionsSlotProperty =
    AvaloniaProperty.Register<FsusSettingsShell, object?>(
      nameof(ActionsSlot));

  public static readonly StyledProperty<object?> RailHeaderProperty =
    AvaloniaProperty.Register<FsusSettingsShell, object?>(
      nameof(RailHeader));

  public static readonly StyledProperty<object?> RailFooterProperty =
    AvaloniaProperty.Register<FsusSettingsShell, object?>(
      nameof(RailFooter));

  public static readonly StyledProperty<bool> IsNarrowProperty =
    AvaloniaProperty.Register<FsusSettingsShell, bool>(
      nameof(IsNarrow));

  public static readonly StyledProperty<double> NarrowBreakpointWidthProperty =
    AvaloniaProperty.Register<FsusSettingsShell, double>(
      nameof(NarrowBreakpointWidth),
      700d);

  public static readonly StyledProperty<double> NarrowRailWidthProperty =
    AvaloniaProperty.Register<FsusSettingsShell, double>(
      nameof(NarrowRailWidth),
      160d);

  public static readonly StyledProperty<FsusSettingsScrollResetBehavior> ScrollResetBehaviorProperty =
    AvaloniaProperty.Register<FsusSettingsShell, FsusSettingsScrollResetBehavior>(
      nameof(ScrollResetBehavior),
      FsusSettingsScrollResetBehavior.Reset);

  private readonly ObservableCollection<FsusSettingsCategory> categories = [];
  private readonly Dictionary<string, Vector> savedScrollOffsets = [];

  private readonly Grid rootGrid = new();
  private readonly Border railBorder = new();
  private readonly Grid railGrid = new();
  private readonly Border searchSlotBorder = new();
  private readonly ContentPresenter searchSlotPresenter = new();
  private readonly ContentPresenter railHeaderPresenter = new();
  private readonly ScrollViewer railScrollViewer = new();
  private readonly StackPanel categoriesPanel = new();
  private readonly ContentPresenter railFooterPresenter = new();

  private readonly Grid contentGrid = new();
  private readonly ScrollViewer contentScrollViewer = new();
  private readonly ContentControl contentHost = new();
  private readonly Border actionsBorder = new();
  private readonly ContentPresenter actionsPresenter = new();

  private Vector contentScrollOffset;
  private string activeKey = string.Empty;
  private bool isUpdatingOffset;
  private bool isSelectingKey;

  public FsusSettingsShell()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-settings-shell");
    Focusable = true;

    categories.CollectionChanged += OnCategoriesCollectionChanged;

    BuildVisualTree();
    SyncState();
  }

  public event EventHandler<FsusNavigationSelectionChangedEventArgs>? SelectionChanged;

  public ObservableCollection<FsusSettingsCategory> Categories => categories;

  public string? AccessibleName
  {
    get => GetValue(AccessibleNameProperty);
    set => SetValue(AccessibleNameProperty, value);
  }

  public string SelectedKey
  {
    get => GetValue(SelectedKeyProperty);
    set => SetValue(SelectedKeyProperty, value);
  }

  public double RailWidth
  {
    get => GetValue(RailWidthProperty);
    set => SetValue(RailWidthProperty, value);
  }

  public object? SearchSlot
  {
    get => GetValue(SearchSlotProperty);
    set => SetValue(SearchSlotProperty, value);
  }

  public object? ActionsSlot
  {
    get => GetValue(ActionsSlotProperty);
    set => SetValue(ActionsSlotProperty, value);
  }

  public object? RailHeader
  {
    get => GetValue(RailHeaderProperty);
    set => SetValue(RailHeaderProperty, value);
  }

  public object? RailFooter
  {
    get => GetValue(RailFooterProperty);
    set => SetValue(RailFooterProperty, value);
  }

  public bool IsNarrow
  {
    get => GetValue(IsNarrowProperty);
    set => SetValue(IsNarrowProperty, value);
  }

  public double NarrowBreakpointWidth
  {
    get => GetValue(NarrowBreakpointWidthProperty);
    set => SetValue(NarrowBreakpointWidthProperty, value);
  }

  public double NarrowRailWidth
  {
    get => GetValue(NarrowRailWidthProperty);
    set => SetValue(NarrowRailWidthProperty, value);
  }

  public FsusSettingsScrollResetBehavior ScrollResetBehavior
  {
    get => GetValue(ScrollResetBehaviorProperty);
    set => SetValue(ScrollResetBehaviorProperty, value);
  }

  public string FocusedKey { get; private set; } = string.Empty;

  public FsusSettingsCategory? SelectedCategory =>
    categories.FirstOrDefault((cat) => cat.Key == activeKey);

  public ScrollViewer ContentScrollViewer => contentScrollViewer;

  public ScrollViewer RailScrollViewer => railScrollViewer;

  public Vector ContentScrollOffset =>
    contentScrollViewer.Offset != default ? contentScrollViewer.Offset : contentScrollOffset;

  public bool HasSearchSlot => SearchSlot is not null;

  public bool HasActionsSlot => ActionsSlot is not null;

  public void SelectCategory(FsusSettingsCategory category)
  {
    if (category is null || !category.IsEnabled)
    {
      return;
    }

    SelectKeyCore(category.Key);
  }

  public void SelectKey(string key)
  {
    var category = categories.FirstOrDefault((c) => c.Key == key);
    if (category is null || !category.IsEnabled)
    {
      return;
    }

    SelectKeyCore(key);
  }

  public void ResetScroll()
  {
    SetContentScrollOffset(new Vector(0, 0));
  }

  public void SetContentScrollOffset(Vector offset)
  {
    contentScrollOffset = offset;
    isUpdatingOffset = true;
    try
    {
      contentScrollViewer.Offset = offset;
      if (!string.IsNullOrEmpty(SelectedKey))
      {
        savedScrollOffsets[SelectedKey] = offset;
      }
    }
    finally
    {
      isUpdatingOffset = false;
    }
  }

  public Vector GetCategoryScrollOffset(string key)
  {
    return savedScrollOffsets.GetValueOrDefault(key, new Vector(0, 0));
  }

  public bool HandleKey(Key key)
  {
    var enabled = categories.Where((c) => c.IsEnabled).ToList();
    if (enabled.Count == 0)
    {
      return false;
    }

    var activeKey = string.IsNullOrEmpty(FocusedKey) ? SelectedKey : FocusedKey;
    var currentIndex = enabled.FindIndex((c) => c.Key == activeKey);

    FsusSettingsCategory? next = key switch
    {
      Key.Down => enabled[currentIndex < 0 ? 0 : Math.Min(enabled.Count - 1, currentIndex + 1)],
      Key.Up => enabled[currentIndex < 0 ? 0 : Math.Max(0, currentIndex - 1)],
      Key.Home => enabled[0],
      Key.End => enabled[^1],
      Key.Enter or Key.Space when currentIndex >= 0 => enabled[currentIndex],
      _ => null,
    };

    if (next is null)
    {
      return false;
    }

    SelectKeyCore(next.Key);
    next.Focus();
    return true;
  }

  public void ApplyViewport(double viewportWidth)
  {
    IsNarrow = viewportWidth > 0 && viewportWidth < NarrowBreakpointWidth;
    SyncNarrowState();
  }

  protected override void OnKeyDown(KeyEventArgs e)
  {
    if (ReferenceEquals(e.Source, this) && HandleKey(e.Key))
    {
      e.Handled = true;
      return;
    }

    base.OnKeyDown(e);
  }

  protected override void OnSizeChanged(SizeChangedEventArgs e)
  {
    base.OnSizeChanged(e);

    if (e.NewSize.Width > 0)
    {
      SetCurrentValue(IsNarrowProperty, e.NewSize.Width < NarrowBreakpointWidth);
      SyncNarrowState();
    }
  }

  protected override AutomationPeer OnCreateAutomationPeer() =>
    new FsusSettingsShellAutomationPeer(this);

  protected override void OnPropertyChanged(AvaloniaPropertyChangedEventArgs change)
  {
    base.OnPropertyChanged(change);

    if (change.Property == SelectedKeyProperty)
    {
      if (!isSelectingKey)
      {
        SelectKeyCore(SelectedKey);
      }
    }
    else if (
      change.Property == RailWidthProperty ||
      change.Property == NarrowRailWidthProperty ||
      change.Property == IsNarrowProperty)
    {
      SyncNarrowState();
    }
    else if (change.Property == NarrowBreakpointWidthProperty && Bounds.Width > 0)
    {
      SetCurrentValue(IsNarrowProperty, Bounds.Width < NarrowBreakpointWidth);
      SyncNarrowState();
    }
    else if (change.Property == FlowDirectionProperty)
    {
      SyncFlowDirection();
    }
    else if (
      change.Property == AccessibleNameProperty ||
      change.Property == SearchSlotProperty ||
      change.Property == ActionsSlotProperty ||
      change.Property == RailHeaderProperty ||
      change.Property == RailFooterProperty)
    {
      SyncState();
    }
  }

  private void SelectKeyCore(string key)
  {
    if (isSelectingKey)
    {
      return;
    }

    var requestedCategory = categories.FirstOrDefault(
      (category) => category.Key == key && category.IsEnabled);
    if (requestedCategory is null)
    {
      var currentCategory = categories.FirstOrDefault(
        (category) => category.Key == activeKey && category.IsEnabled);
      requestedCategory = currentCategory ?? categories.FirstOrDefault((category) => category.IsEnabled);
    }

    var normalizedKey = requestedCategory?.Key ?? string.Empty;
    var oldKey = activeKey;
    if (oldKey == normalizedKey)
    {
      SetCurrentValue(SelectedKeyProperty, normalizedKey);
      contentHost.Content = requestedCategory?.Content;
      SyncCategoriesVisual();
      SyncAutomation();
      return;
    }

    isSelectingKey = true;
    try
    {
      if (!string.IsNullOrEmpty(oldKey))
      {
        savedScrollOffsets[oldKey] = ContentScrollOffset;
      }

      activeKey = normalizedKey;
      SetCurrentValue(SelectedKeyProperty, normalizedKey);
      contentHost.Content = requestedCategory?.Content;

      var targetOffset = ScrollResetBehavior == FsusSettingsScrollResetBehavior.Restore
        ? savedScrollOffsets.GetValueOrDefault(normalizedKey, new Vector(0, 0))
        : new Vector(0, 0);

      SetContentScrollOffset(targetOffset);

      SyncCategoriesVisual();
      SyncAutomation();

      SelectionChanged?.Invoke(this, new FsusNavigationSelectionChangedEventArgs(normalizedKey));
    }
    finally
    {
      isSelectingKey = false;
    }
  }

  private void BuildVisualTree()
  {
    rootGrid.ColumnDefinitions.Add(new ColumnDefinition(GridLength.Auto));
    rootGrid.ColumnDefinitions.Add(new ColumnDefinition(GridLength.Star));

    // Rail column
    railBorder.Classes.Add("fsus-settings-rail");
    railBorder.BorderThickness = new Thickness(0, 0, 1, 0);
    railBorder.Width = RailWidth;

    railGrid.RowDefinitions.Add(new RowDefinition(GridLength.Auto)); // RailHeader
    railGrid.RowDefinitions.Add(new RowDefinition(GridLength.Auto)); // SearchSlot
    railGrid.RowDefinitions.Add(new RowDefinition(GridLength.Star)); // Categories
    railGrid.RowDefinitions.Add(new RowDefinition(GridLength.Auto)); // RailFooter

    railHeaderPresenter.Margin = new Thickness(12, 12, 12, 4);
    searchSlotBorder.Padding = new Thickness(12, 8, 12, 8);
    searchSlotBorder.Child = searchSlotPresenter;

    categoriesPanel.Spacing = 4;
    categoriesPanel.Margin = new Thickness(8, 4, 8, 8);
    railScrollViewer.Content = categoriesPanel;
    railScrollViewer.HorizontalScrollBarVisibility = ScrollBarVisibility.Disabled;
    railScrollViewer.VerticalScrollBarVisibility = ScrollBarVisibility.Auto;

    railFooterPresenter.Margin = new Thickness(12, 4, 12, 12);

    Grid.SetRow(railHeaderPresenter, 0);
    Grid.SetRow(searchSlotBorder, 1);
    Grid.SetRow(railScrollViewer, 2);
    Grid.SetRow(railFooterPresenter, 3);

    railGrid.Children.Add(railHeaderPresenter);
    railGrid.Children.Add(searchSlotBorder);
    railGrid.Children.Add(railScrollViewer);
    railGrid.Children.Add(railFooterPresenter);

    railBorder.Child = railGrid;
    Grid.SetColumn(railBorder, 0);
    rootGrid.Children.Add(railBorder);

    // Main content column
    contentGrid.Classes.Add("fsus-settings-main");
    contentGrid.RowDefinitions.Add(new RowDefinition(GridLength.Star)); // Content
    contentGrid.RowDefinitions.Add(new RowDefinition(GridLength.Auto)); // Actions

    contentScrollViewer.Classes.Add("fsus-settings-content-scroll");
    contentScrollViewer.HorizontalScrollBarVisibility = ScrollBarVisibility.Disabled;
    contentScrollViewer.VerticalScrollBarVisibility = ScrollBarVisibility.Auto;
    contentScrollViewer.ScrollChanged += OnContentScrollChanged;

    contentHost.Margin = new Thickness(24);
    contentScrollViewer.Content = contentHost;

    actionsBorder.Classes.Add("fsus-settings-actions");
    actionsBorder.BorderThickness = new Thickness(0, 1, 0, 0);
    actionsBorder.Padding = new Thickness(24, 16);
    actionsBorder.Child = actionsPresenter;

    Grid.SetRow(contentScrollViewer, 0);
    Grid.SetRow(actionsBorder, 1);

    contentGrid.Children.Add(contentScrollViewer);
    contentGrid.Children.Add(actionsBorder);

    Grid.SetColumn(contentGrid, 1);
    rootGrid.Children.Add(contentGrid);

    Content = rootGrid;
  }

  private void OnContentScrollChanged(object? sender, ScrollChangedEventArgs e)
  {
    if (isUpdatingOffset)
    {
      return;
    }

    if (!string.IsNullOrEmpty(SelectedKey))
    {
      savedScrollOffsets[SelectedKey] = contentScrollViewer.Offset;
    }
  }

  private void OnCategoriesCollectionChanged(object? sender, NotifyCollectionChangedEventArgs e)
  {
    if (e.OldItems is not null)
    {
      foreach (FsusSettingsCategory item in e.OldItems)
      {
        item.ParentShell = null;
        categoriesPanel.Children.Remove(item);
      }
    }

    if (e.NewItems is not null)
    {
      var index = e.NewStartingIndex >= 0 ? e.NewStartingIndex : categoriesPanel.Children.Count;
      foreach (FsusSettingsCategory item in e.NewItems)
      {
        item.ParentShell = this;
        if (index <= categoriesPanel.Children.Count)
        {
          categoriesPanel.Children.Insert(index++, item);
        }
        else
        {
          categoriesPanel.Children.Add(item);
        }
      }
    }

    if (e.Action == NotifyCollectionChangedAction.Reset)
    {
      foreach (var category in categoriesPanel.Children.OfType<FsusSettingsCategory>())
      {
        category.ParentShell = null;
      }
      categoriesPanel.Children.Clear();
      savedScrollOffsets.Clear();
    }

    NormalizeSelection();
    (ControlAutomationPeer.FromElement(this) as FsusSettingsShellAutomationPeer)
      ?.InvalidateOwnedChildren();
  }

  private void SyncCategoriesVisual()
  {
    foreach (var category in categories)
    {
      category.IsSelected = category.Key == activeKey;
      category.SyncState();
    }
  }

  private void SyncNarrowState()
  {
    FsusComponentClasses.Ensure(this, "fsus-narrow", IsNarrow);
    railBorder.Width = IsNarrow ? NarrowRailWidth : RailWidth;
    foreach (var category in categories)
    {
      FsusComponentClasses.Ensure(category, "fsus-narrow", IsNarrow);
    }
  }

  private void SyncState()
  {
    railHeaderPresenter.Content = RailHeader;
    railHeaderPresenter.IsVisible = RailHeader is not null;

    searchSlotPresenter.Content = SearchSlot;
    searchSlotBorder.IsVisible = SearchSlot is not null;
    FsusComponentClasses.Ensure(this, "fsus-has-search", SearchSlot is not null);

    railFooterPresenter.Content = RailFooter;
    railFooterPresenter.IsVisible = RailFooter is not null;

    actionsPresenter.Content = ActionsSlot;
    actionsBorder.IsVisible = ActionsSlot is not null;
    FsusComponentClasses.Ensure(this, "fsus-has-actions", ActionsSlot is not null);

    SyncFlowDirection();
    SyncNarrowState();
    SyncCategoriesVisual();
    SyncAutomation();
  }

  private void SyncAutomation()
  {
    AutomationProperties.SetName(this, AccessibleName ?? "Settings shell");
    AutomationProperties.SetControlTypeOverride(this, AutomationControlType.Group);
    AutomationProperties.SetLiveSetting(this, AutomationLiveSetting.Polite);
    AutomationProperties.SetItemStatus(
      this,
      string.IsNullOrWhiteSpace(activeKey)
        ? $"{categories.Count.ToString(CultureInfo.InvariantCulture)} categories"
        : $"active {activeKey}, {categories.Count.ToString(CultureInfo.InvariantCulture)} categories");

    for (var index = 0; index < categories.Count; index++)
    {
      AutomationProperties.SetPositionInSet(categories[index], index + 1);
      AutomationProperties.SetSizeOfSet(categories[index], categories.Count);
    }
  }

  internal void SetFocusedCategory(FsusSettingsCategory category, bool isFocused)
  {
    if (isFocused)
    {
      FocusedKey = category.Key;
    }
    else if (FocusedKey == category.Key)
    {
      FocusedKey = string.Empty;
    }
  }

  internal void RefreshSelectedContent(FsusSettingsCategory category)
  {
    if (category.Key == activeKey)
    {
      contentHost.Content = category.Content;
    }
  }

  internal void NormalizeSelection()
  {
    var current = categories.FirstOrDefault(
      (category) => category.Key == activeKey && category.IsEnabled);
    SelectKeyCore((current ?? categories.FirstOrDefault((category) => category.IsEnabled))?.Key ?? string.Empty);
  }

  private void SyncFlowDirection()
  {
    var isRightToLeft =
      FlowDirection == global::Avalonia.Media.FlowDirection.RightToLeft;
    FsusComponentClasses.Ensure(this, "fsus-rtl", isRightToLeft);

    // Use a stable internal coordinate system and map shell flow direction to
    // rail/content order explicitly. This avoids mirroring the entire visual
    // subtree (including glyphs) while allowing slotted content to declare its
    // own bidi direction.
    rootGrid.FlowDirection = global::Avalonia.Media.FlowDirection.LeftToRight;
    rootGrid.ColumnDefinitions[0].Width =
      isRightToLeft ? GridLength.Star : GridLength.Auto;
    rootGrid.ColumnDefinitions[1].Width =
      isRightToLeft ? GridLength.Auto : GridLength.Star;
    Grid.SetColumn(railBorder, isRightToLeft ? 1 : 0);
    Grid.SetColumn(contentGrid, isRightToLeft ? 0 : 1);
    railBorder.BorderThickness = isRightToLeft
      ? new Thickness(1, 0, 0, 0)
      : new Thickness(0, 0, 1, 0);
  }

  private sealed class FsusSettingsShellAutomationPeer(FsusSettingsShell owner)
    : ControlAutomationPeer(owner), ISelectionProvider
  {
    public bool CanSelectMultiple => false;

    public bool IsSelectionRequired => owner.categories.Any((category) => category.IsEnabled);

    public IReadOnlyList<AutomationPeer> GetSelection()
    {
      var selected = owner.SelectedCategory;
      return selected is null
        ? []
        : [CreatePeerForElement(selected)];
    }

    internal void InvalidateOwnedChildren() => InvalidateChildren();
  }
}
