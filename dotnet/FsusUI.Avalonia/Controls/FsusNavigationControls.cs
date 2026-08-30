using Avalonia;
using Avalonia.Automation;
using Avalonia.Automation.Peers;
using Avalonia.Controls;
using Avalonia.Input;
using Avalonia.Interactivity;
using Avalonia.Threading;
using Avalonia.VisualTree;
using System.Collections.ObjectModel;
using System.Collections.Specialized;
using System.Globalization;

namespace FsusUI.Avalonia.Controls;

public sealed class FsusNavigationSelectionChangedEventArgs(string selectedKey) : EventArgs
{
  public string SelectedKey { get; } = selectedKey;
}

public sealed class FsusNavigationActivatedEventArgs(string key) : EventArgs
{
  public string Key { get; } = key;
}

public sealed class FsusTabPaneContextEventArgs(
  string paneKey,
  FsusTabPane pane,
  FsusTreeInteractionSource source) : RoutedEventArgs(FsusTabs.PaneContextRequestedEvent)
{
  public string PaneKey { get; } = paneKey;
  public FsusTabPane Pane { get; } = pane;
  public FsusTreeInteractionSource InteractionSource { get; } = source;
}

public enum FsusStepStatus
{
  Wait,
  Process,
  Finish,
  Error,
  Success,
}

public class FsusTabs : TabControl
{
  public static readonly StyledProperty<string?> AccessibleNameProperty =
    AvaloniaProperty.Register<FsusTabs, string?>(nameof(AccessibleName));

  private readonly ObservableCollection<FsusTabPane> panes = [];
  private bool paneSelectionCommitPending;

  public FsusTabs()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-tabs");
    Focusable = true;
    panes.CollectionChanged += OnPanesChanged;
    base.SelectionChanged += OnBaseSelectionChanged;
    ItemsSource = panes;
    SyncAutomation();
  }

  public new event EventHandler<FsusNavigationSelectionChangedEventArgs>? SelectionChanged;

  public static readonly RoutedEvent<FsusTabPaneContextEventArgs> PaneContextRequestedEvent =
    RoutedEvent.Register<FsusTabs, FsusTabPaneContextEventArgs>(
      nameof(PaneContextRequested),
      RoutingStrategies.Bubble);

  public event EventHandler<FsusTabPaneContextEventArgs>? PaneContextRequested
  {
    add => AddHandler(PaneContextRequestedEvent, value);
    remove => RemoveHandler(PaneContextRequestedEvent, value);
  }

  public IList<FsusTabPane> Panes => panes;

  public string SelectedKey { get; private set; } = string.Empty;

  public string FocusedKey { get; private set; } = string.Empty;

  public string? AccessibleName
  {
    get => GetValue(AccessibleNameProperty);
    set => SetValue(AccessibleNameProperty, value);
  }

  public void SelectKey(string key)
  {
    var pane = panes.FirstOrDefault((candidate) => candidate.Key == key);
    if (pane is null || !pane.IsEnabled)
    {
      SyncPanes();
      return;
    }

    SelectedKey = pane.Key;
    FocusedKey = pane.Key;
    SelectedItem = pane;
    SyncPanes();
    SelectionChanged?.Invoke(this, new FsusNavigationSelectionChangedEventArgs(pane.Key));
  }

  protected void HandleKey(Key key)
  {
    if (panes.Count == 0)
    {
      return;
    }

    var current = panes.FirstOrDefault((pane) => pane.Key == FocusedKey);
    var currentIndex = Math.Max(0, current is null ? -1 : panes.IndexOf(current));
    var next = key switch
    {
      Key.Right => FindEnabledFrom(currentIndex + 1, 1),
      Key.Left => FindEnabledFrom(currentIndex - 1, -1),
      Key.Home => panes.FirstOrDefault((pane) => pane.IsEnabled),
      Key.End => panes.LastOrDefault((pane) => pane.IsEnabled),
      _ => null,
    };

    if (next is not null)
    {
      SelectKey(next.Key);
    }
  }

  public bool RequestPaneContext(string key, FsusTreeInteractionSource source)
  {
    var pane = panes.FirstOrDefault((candidate) => candidate.Key == key);
    if (pane is null || !pane.IsEnabled)
    {
      return false;
    }

    FocusedKey = pane.Key;
    RaiseEvent(new FsusTabPaneContextEventArgs(pane.Key, pane, source));
    return true;
  }

  protected override void OnKeyDown(KeyEventArgs e)
  {
    base.OnKeyDown(e);
    if (e.Handled || panes.Count == 0)
    {
      return;
    }

    var contextRequested = e.Key switch
    {
      Key.F10 when e.KeyModifiers.HasFlag(KeyModifiers.Shift) => true,
      Key.Apps => true,
      _ => false,
    };

    if (contextRequested && RequestPaneContext(FocusedKey, FsusTreeInteractionSource.Keyboard))
    {
      e.Handled = true;
    }
  }

  private void OnBaseSelectionChanged(
    object? sender,
    global::Avalonia.Controls.SelectionChangedEventArgs e)
  {
    if (SelectedItem is not FsusTabPane pane || !pane.IsEnabled)
    {
      return;
    }

    if (pane.Key == SelectedKey)
    {
      SyncPanes();
      return;
    }

    SelectedKey = pane.Key;
    FocusedKey = pane.Key;
    SyncPanes();
    SelectionChanged?.Invoke(
      this,
      new FsusNavigationSelectionChangedEventArgs(pane.Key));
  }

  protected override void OnPropertyChanged(AvaloniaPropertyChangedEventArgs change)
  {
    base.OnPropertyChanged(change);

    if (change.Property == AccessibleNameProperty)
    {
      SyncAutomation();
    }
  }

  private FsusTabPane? FindEnabledFrom(int startIndex, int direction)
  {
    for (var index = startIndex; index >= 0 && index < panes.Count; index += direction)
    {
      if (panes[index].IsEnabled)
      {
        return panes[index];
      }
    }

    return null;
  }

  private void OnPanesChanged(object? sender, NotifyCollectionChangedEventArgs e)
  {
    var firstEnabled = panes.FirstOrDefault((pane) => pane.IsEnabled);
    if (firstEnabled is null)
    {
      SelectedKey = string.Empty;
      FocusedKey = string.Empty;
    }
    else
    {
      if (!panes.Any((pane) => pane.Key == SelectedKey && pane.IsEnabled))
      {
        SelectedKey = firstEnabled.Key;
      }

      if (!panes.Any((pane) => pane.Key == FocusedKey && pane.IsEnabled))
      {
        FocusedKey = SelectedKey;
      }
    }

    SyncPanes();
    SchedulePaneSelectionCommit();
  }

  private void SchedulePaneSelectionCommit()
  {
    if (paneSelectionCommitPending)
    {
      return;
    }

    paneSelectionCommitPending = true;
    Dispatcher.UIThread.Post(() =>
    {
      paneSelectionCommitPending = false;
      var selectedPane = panes.FirstOrDefault(
        (pane) => pane.Key == SelectedKey && pane.IsEnabled);
      if (!ReferenceEquals(SelectedItem, selectedPane))
      {
        SelectedItem = selectedPane;
      }
    });
  }

  private void SyncPanes()
  {
    foreach (var pane in panes)
    {
      pane.IsSelected = pane.Key == SelectedKey;
      pane.SyncState();
    }

    SyncAutomation();
  }

  private void SyncAutomation()
  {
    AutomationProperties.SetName(this, AccessibleName ?? string.Empty);
    AutomationProperties.SetControlTypeOverride(this, AutomationControlType.Tab);
    AutomationProperties.SetItemStatus(this, string.IsNullOrWhiteSpace(SelectedKey) ? string.Empty : "selected");
  }
}

public class FsusTabPane : TabItem
{
  public static readonly StyledProperty<string> KeyProperty =
    AvaloniaProperty.Register<FsusTabPane, string>(nameof(Key), string.Empty);

  public FsusTabPane()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-tab-pane");
    Focusable = true;
    SyncState();
  }

  public string Key
  {
    get => GetValue(KeyProperty);
    set => SetValue(KeyProperty, value);
  }

  protected override void OnPointerPressed(PointerPressedEventArgs e)
  {
    base.OnPointerPressed(e);
    if (string.IsNullOrEmpty(Key) ||
      !e.GetCurrentPoint(this).Properties.IsRightButtonPressed)
    {
      return;
    }

    var owner = FindOwningTabs(this);
    if (owner is null || !owner.RequestPaneContext(Key, FsusTreeInteractionSource.Pointer))
    {
      return;
    }

    e.Handled = true;
  }

  private static FsusTabs? FindOwningTabs(Visual visual)
  {
    var parent = visual.GetVisualParent();
    while (parent is not null)
    {
      if (parent is FsusTabs tabs)
      {
        return tabs;
      }

      parent = parent.GetVisualParent();
    }

    return null;
  }

  protected override void OnPropertyChanged(AvaloniaPropertyChangedEventArgs change)
  {
    base.OnPropertyChanged(change);

    if (
      change.Property == KeyProperty ||
      change.Property == HeaderProperty ||
      change.Property == IsEnabledProperty ||
      change.Property == IsSelectedProperty)
    {
      SyncState();
    }
  }

  internal void SyncState()
  {
    FsusComponentClasses.Ensure(this, "fsus-selected", IsSelected);
    FsusComponentClasses.Ensure(this, "fsus-disabled", !IsEnabled);
    AutomationProperties.SetName(this, FsusComponentClasses.ResolveName(null, Header));
    AutomationProperties.SetControlTypeOverride(this, AutomationControlType.Tab);
    AutomationProperties.SetItemStatus(
      this,
      IsSelected ? "selected" : IsEnabled ? "available" : "disabled");
  }
}

public class FsusMenu : Menu
{
  public static readonly StyledProperty<string?> AccessibleNameProperty =
    AvaloniaProperty.Register<FsusMenu, string?>(nameof(AccessibleName));

  public static readonly StyledProperty<bool> IsCollapsedProperty =
    AvaloniaProperty.Register<FsusMenu, bool>(nameof(IsCollapsed));

  private readonly List<FsusMenuNode> items = [];
  private readonly HashSet<string> activatedKeys = [];

  public FsusMenu()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-menu");
    Focusable = true;
    SyncState();
  }

  public new event EventHandler<FsusNavigationSelectionChangedEventArgs>? SelectionChanged;

  public new IList<FsusMenuNode> Items => items;

  public string SelectedKey { get; private set; } = string.Empty;

  public string FocusedKey { get; private set; } = string.Empty;

  public bool HasOpenPopupSurface { get; private set; }

  public string? AccessibleName
  {
    get => GetValue(AccessibleNameProperty);
    set => SetValue(AccessibleNameProperty, value);
  }

  public bool IsCollapsed
  {
    get => GetValue(IsCollapsedProperty);
    set => SetValue(IsCollapsedProperty, value);
  }

  public void SelectKey(string key)
  {
    var node = FindNode(key);
    if (node is null || !node.IsEnabled)
    {
      SyncState();
      return;
    }

    SelectNode(node);
  }

  protected void HandleKey(Key key)
  {
    switch (key)
    {
      case Key.Down:
        MoveFocus(1);
        break;
      case Key.Up:
        MoveFocus(-1);
        break;
      case Key.Home:
        FocusFirst();
        break;
      case Key.End:
        FocusLast();
        break;
      case Key.Enter:
      case Key.Space:
        ActivateFocused();
        break;
      case Key.Escape:
        HasOpenPopupSurface = false;
        SyncState();
        break;
    }
  }

  protected override void OnPropertyChanged(AvaloniaPropertyChangedEventArgs change)
  {
    base.OnPropertyChanged(change);

    if (
      change.Property == AccessibleNameProperty ||
      change.Property == IsCollapsedProperty)
    {
      SyncState();
    }
  }

  private void SelectNode(FsusMenuNode node)
  {
    SelectedKey = node.Key;
    FocusedKey = node.Key;
    activatedKeys.Add(node.Key);
    if (node is FsusSubMenu submenu)
    {
      submenu.IsOpen = true;
      HasOpenPopupSurface = IsCollapsed;
    }

    SyncState();
    SelectionChanged?.Invoke(this, new FsusNavigationSelectionChangedEventArgs(node.Key));
  }

  private void ActivateFocused()
  {
    var node = FindNode(FocusedKey);
    if (node is null || !node.IsEnabled)
    {
      return;
    }

    SelectNode(node);
    if (node is FsusSubMenu submenu)
    {
      FocusedKey = submenu.Items.FirstOrDefault((child) => child.IsEnabled)?.Key ?? submenu.Key;
      SyncState();
    }
  }

  private void MoveFocus(int direction)
  {
    var visibleItems = VisibleEnabledItems().ToList();
    if (visibleItems.Count == 0)
    {
      return;
    }

    var index = visibleItems.FindIndex((node) => node.Key == FocusedKey);
    var nextIndex = Math.Clamp(index + direction, 0, visibleItems.Count - 1);
    if (index < 0)
    {
      nextIndex = direction > 0 ? 0 : visibleItems.Count - 1;
    }

    FocusedKey = visibleItems[nextIndex].Key;
    SyncState();
  }

  private void FocusFirst()
  {
    var node = VisibleEnabledItems().FirstOrDefault();
    if (node is not null)
    {
      FocusedKey = node.Key;
      SyncState();
    }
  }

  private void FocusLast()
  {
    var node = VisibleEnabledItems().LastOrDefault();
    if (node is not null)
    {
      FocusedKey = node.Key;
      SyncState();
    }
  }

  private IEnumerable<FsusMenuNode> VisibleEnabledItems()
  {
    foreach (var node in items)
    {
      if (node.IsEnabled)
      {
        yield return node;
      }

      if (node is not FsusSubMenu { IsOpen: true } submenu)
      {
        continue;
      }

      foreach (var child in submenu.Items.Where((child) => child.IsEnabled))
      {
        yield return child;
      }
    }
  }

  private FsusMenuNode? FindNode(string key)
  {
    foreach (var node in items)
    {
      if (node.Key == key)
      {
        return node;
      }

      if (node is FsusSubMenu submenu)
      {
        var child = submenu.FindNode(key);
        if (child is not null)
        {
          return child;
        }
      }
      else if (node is FsusMenuItemGroup group)
      {
        var child = group.Items.FirstOrDefault((candidate) => candidate.Key == key);
        if (child is not null)
        {
          return child;
        }
      }
    }

    return null;
  }

  private void SyncState()
  {
    FsusComponentClasses.Ensure(this, "fsus-collapsed", IsCollapsed);
    FsusComponentClasses.Ensure(this, "fsus-open-popup", HasOpenPopupSurface);
    AutomationProperties.SetName(this, AccessibleName ?? string.Empty);
    AutomationProperties.SetControlTypeOverride(this, AutomationControlType.Menu);
    AutomationProperties.SetItemStatus(
      this,
      string.IsNullOrWhiteSpace(SelectedKey) ? string.Empty : "selected");

    foreach (var node in items)
    {
      SyncNode(node);
    }
  }

  private void SyncNode(FsusMenuNode node)
  {
    node.IsSelected = node.Key == SelectedKey || activatedKeys.Contains(node.Key);
    node.IsFocusedWithinMenu = node.Key == FocusedKey;
    node.SyncState();

    if (node is FsusSubMenu submenu)
    {
      foreach (var child in submenu.Items)
      {
        SyncNode(child);
      }
    }
    else if (node is FsusMenuItemGroup group)
    {
      foreach (var child in group.Items)
      {
        SyncNode(child);
      }
    }
  }
}

public abstract class FsusMenuNode : ContentControl
{
  public static readonly StyledProperty<string> KeyProperty =
    AvaloniaProperty.Register<FsusMenuNode, string>(nameof(Key), string.Empty);

  public static readonly StyledProperty<object?> HeaderProperty =
    AvaloniaProperty.Register<FsusMenuNode, object?>(nameof(Header));

  public static readonly StyledProperty<object?> IconContentProperty =
    AvaloniaProperty.Register<FsusMenuNode, object?>(nameof(IconContent));

  public static readonly StyledProperty<bool> IsSelectedProperty =
    AvaloniaProperty.Register<FsusMenuNode, bool>(nameof(IsSelected));

  protected FsusMenuNode(string className)
  {
    FsusComponentClasses.SetBaseClasses(this, className);
    Focusable = true;
    SyncState();
  }

  public string Key
  {
    get => GetValue(KeyProperty);
    set => SetValue(KeyProperty, value);
  }

  public object? Header
  {
    get => GetValue(HeaderProperty);
    set => SetValue(HeaderProperty, value);
  }

  public object? IconContent
  {
    get => GetValue(IconContentProperty);
    set => SetValue(IconContentProperty, value);
  }

  public bool IsSelected
  {
    get => GetValue(IsSelectedProperty);
    set => SetValue(IsSelectedProperty, value);
  }

  internal bool IsFocusedWithinMenu { get; set; }

  protected override void OnPropertyChanged(AvaloniaPropertyChangedEventArgs change)
  {
    base.OnPropertyChanged(change);

    if (
      change.Property == KeyProperty ||
      change.Property == HeaderProperty ||
      change.Property == IconContentProperty ||
      change.Property == IsSelectedProperty ||
      change.Property == IsEnabledProperty)
    {
      SyncState();
    }
  }

  internal virtual void SyncState()
  {
    FsusComponentClasses.Ensure(this, "fsus-selected", IsSelected);
    FsusComponentClasses.Ensure(this, "fsus-disabled", !IsEnabled);
    FsusComponentClasses.Ensure(this, "fsus-focused", IsFocusedWithinMenu);
    FsusComponentClasses.Ensure(this, "fsus-has-icon", IconContent is not null);
    AutomationProperties.SetName(this, FsusComponentClasses.ResolveName(null, Header));
    AutomationProperties.SetItemStatus(
      this,
      IsSelected ? "selected" : IsEnabled ? "available" : "disabled");
  }
}

public class FsusMenuItem : FsusMenuNode
{
  public FsusMenuItem() : base("fsus-menu-item")
  {
  }
}

public class FsusSubMenu : FsusMenuNode
{
  public static readonly StyledProperty<bool> IsOpenProperty =
    AvaloniaProperty.Register<FsusSubMenu, bool>(nameof(IsOpen));

  private readonly List<FsusMenuNode> items = [];

  public FsusSubMenu() : base("fsus-sub-menu")
  {
  }

  public IList<FsusMenuNode> Items => items;

  public bool IsOpen
  {
    get => GetValue(IsOpenProperty);
    set => SetValue(IsOpenProperty, value);
  }

  internal FsusMenuNode? FindNode(string key)
  {
    foreach (var node in items)
    {
      if (node.Key == key)
      {
        return node;
      }

      if (node is FsusSubMenu submenu)
      {
        var child = submenu.FindNode(key);
        if (child is not null)
        {
          return child;
        }
      }
    }

    return null;
  }

  protected override void OnPropertyChanged(AvaloniaPropertyChangedEventArgs change)
  {
    base.OnPropertyChanged(change);

    if (change.Property == IsOpenProperty)
    {
      SyncState();
    }
  }

  internal override void SyncState()
  {
    base.SyncState();
    FsusComponentClasses.Ensure(this, "fsus-open", IsOpen);
    AutomationProperties.SetItemStatus(
      this,
      IsSelected ? "selected" : IsOpen ? "expanded" : "collapsed");
  }
}

public class FsusMenuItemGroup : FsusMenuNode
{
  private readonly List<FsusMenuNode> items = [];

  public FsusMenuItemGroup() : base("fsus-menu-item-group")
  {
  }

  public IList<FsusMenuNode> Items => items;
}

public class FsusBreadcrumb : ContentControl
{
  public static readonly StyledProperty<string?> AccessibleNameProperty =
    AvaloniaProperty.Register<FsusBreadcrumb, string?>(nameof(AccessibleName));

  private readonly List<FsusBreadcrumbItem> items = [];

  public FsusBreadcrumb()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-breadcrumb");
    SyncState();
  }

  public event EventHandler<FsusNavigationActivatedEventArgs>? Activated;

  public IList<FsusBreadcrumbItem> Items => items;

  public string? AccessibleName
  {
    get => GetValue(AccessibleNameProperty);
    set => SetValue(AccessibleNameProperty, value);
  }

  public void Activate(string key)
  {
    var item = items.FirstOrDefault((candidate) => candidate.Key == key);
    SyncState();
    if (item is null || !item.IsEnabled || item.IsCurrent)
    {
      return;
    }

    Activated?.Invoke(this, new FsusNavigationActivatedEventArgs(key));
  }

  protected override void OnPropertyChanged(AvaloniaPropertyChangedEventArgs change)
  {
    base.OnPropertyChanged(change);

    if (change.Property == AccessibleNameProperty)
    {
      SyncState();
    }
  }

  private void SyncState()
  {
    AutomationProperties.SetName(this, AccessibleName ?? string.Empty);
    AutomationProperties.SetControlTypeOverride(this, AutomationControlType.List);
    foreach (var item in items)
    {
      item.SyncState();
    }
  }
}

public class FsusBreadcrumbItem : ContentControl
{
  public static readonly StyledProperty<string> KeyProperty =
    AvaloniaProperty.Register<FsusBreadcrumbItem, string>(nameof(Key), string.Empty);

  public static readonly StyledProperty<object?> HeaderProperty =
    AvaloniaProperty.Register<FsusBreadcrumbItem, object?>(nameof(Header));

  public static readonly StyledProperty<bool> IsCurrentProperty =
    AvaloniaProperty.Register<FsusBreadcrumbItem, bool>(nameof(IsCurrent));

  public FsusBreadcrumbItem()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-breadcrumb-item");
    SyncState();
  }

  public string Key
  {
    get => GetValue(KeyProperty);
    set => SetValue(KeyProperty, value);
  }

  public object? Header
  {
    get => GetValue(HeaderProperty);
    set => SetValue(HeaderProperty, value);
  }

  public bool IsCurrent
  {
    get => GetValue(IsCurrentProperty);
    set => SetValue(IsCurrentProperty, value);
  }

  protected override void OnPropertyChanged(AvaloniaPropertyChangedEventArgs change)
  {
    base.OnPropertyChanged(change);

    if (
      change.Property == KeyProperty ||
      change.Property == HeaderProperty ||
      change.Property == IsCurrentProperty ||
      change.Property == IsEnabledProperty)
    {
      SyncState();
    }
  }

  internal void SyncState()
  {
    FsusComponentClasses.Ensure(this, "fsus-current", IsCurrent);
    FsusComponentClasses.Ensure(this, "fsus-disabled", !IsEnabled);
    AutomationProperties.SetName(this, FsusComponentClasses.ResolveName(null, Header));
    AutomationProperties.SetItemStatus(this, IsCurrent ? "current" : "link");
  }
}

public class FsusPageHeader : ContentControl
{
  public static readonly StyledProperty<string?> TitleProperty =
    AvaloniaProperty.Register<FsusPageHeader, string?>(nameof(Title));

  public static readonly StyledProperty<string?> DescriptionProperty =
    AvaloniaProperty.Register<FsusPageHeader, string?>(nameof(Description));

  public static readonly StyledProperty<object?> IconContentProperty =
    AvaloniaProperty.Register<FsusPageHeader, object?>(nameof(IconContent));

  public static readonly StyledProperty<FsusBreadcrumb?> BreadcrumbProperty =
    AvaloniaProperty.Register<FsusPageHeader, FsusBreadcrumb?>(nameof(Breadcrumb));

  public static readonly StyledProperty<object?> ActionContentProperty =
    AvaloniaProperty.Register<FsusPageHeader, object?>(nameof(ActionContent));

  public FsusPageHeader()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-page-header");
    SyncState();
  }

  public event EventHandler? BackRequested;

  public string? Title
  {
    get => GetValue(TitleProperty);
    set => SetValue(TitleProperty, value);
  }

  public string? Description
  {
    get => GetValue(DescriptionProperty);
    set => SetValue(DescriptionProperty, value);
  }

  public object? IconContent
  {
    get => GetValue(IconContentProperty);
    set => SetValue(IconContentProperty, value);
  }

  public FsusBreadcrumb? Breadcrumb
  {
    get => GetValue(BreadcrumbProperty);
    set => SetValue(BreadcrumbProperty, value);
  }

  public object? ActionContent
  {
    get => GetValue(ActionContentProperty);
    set => SetValue(ActionContentProperty, value);
  }

  public void RequestBack() => BackRequested?.Invoke(this, EventArgs.Empty);

  protected override void OnPropertyChanged(AvaloniaPropertyChangedEventArgs change)
  {
    base.OnPropertyChanged(change);

    if (
      change.Property == TitleProperty ||
      change.Property == DescriptionProperty ||
      change.Property == IconContentProperty ||
      change.Property == BreadcrumbProperty ||
      change.Property == ActionContentProperty)
    {
      SyncState();
    }
  }

  private void SyncState()
  {
    FsusComponentClasses.Ensure(this, "fsus-has-description", !string.IsNullOrWhiteSpace(Description));
    FsusComponentClasses.Ensure(this, "fsus-has-icon", IconContent is not null);
    FsusComponentClasses.Ensure(this, "fsus-has-breadcrumb", Breadcrumb is not null);
    FsusComponentClasses.Ensure(this, "fsus-has-action", ActionContent is not null);
    AutomationProperties.SetName(this, Title ?? string.Empty);
    AutomationProperties.SetControlTypeOverride(this, AutomationControlType.Group);
  }
}

public class FsusSteps : ContentControl
{
  public static readonly StyledProperty<int> ActiveIndexProperty =
    AvaloniaProperty.Register<FsusSteps, int>(nameof(ActiveIndex));

  private readonly List<FsusStep> items = [];

  public FsusSteps()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-steps");
    SyncAutomation();
  }

  public IList<FsusStep> Items => items;

  public int ActiveIndex
  {
    get => GetValue(ActiveIndexProperty);
    set => SetValue(ActiveIndexProperty, value);
  }

  public void RefreshStepStatus()
  {
    for (var index = 0; index < items.Count; index++)
    {
      var step = items[index];
      step.EffectiveStatus = step.Status ?? ResolveStatus(index);
      step.SyncState();
    }

    SyncAutomation();
  }

  protected override void OnPropertyChanged(AvaloniaPropertyChangedEventArgs change)
  {
    base.OnPropertyChanged(change);

    if (change.Property == ActiveIndexProperty)
    {
      RefreshStepStatus();
    }
  }

  private FsusStepStatus ResolveStatus(int index)
  {
    if (index < ActiveIndex)
    {
      return FsusStepStatus.Finish;
    }

    return index == ActiveIndex ? FsusStepStatus.Process : FsusStepStatus.Wait;
  }

  private void SyncAutomation()
  {
    AutomationProperties.SetControlTypeOverride(this, AutomationControlType.List);
  }
}

public class FsusStep : ContentControl
{
  public static readonly StyledProperty<string?> TitleProperty =
    AvaloniaProperty.Register<FsusStep, string?>(nameof(Title));

  public static readonly StyledProperty<string?> DescriptionProperty =
    AvaloniaProperty.Register<FsusStep, string?>(nameof(Description));

  public static readonly StyledProperty<object?> IconContentProperty =
    AvaloniaProperty.Register<FsusStep, object?>(nameof(IconContent));

  public static readonly StyledProperty<FsusStepStatus?> StatusProperty =
    AvaloniaProperty.Register<FsusStep, FsusStepStatus?>(nameof(Status));

  public FsusStep()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-step");
    SyncState();
  }

  public string? Title
  {
    get => GetValue(TitleProperty);
    set => SetValue(TitleProperty, value);
  }

  public string? Description
  {
    get => GetValue(DescriptionProperty);
    set => SetValue(DescriptionProperty, value);
  }

  public object? IconContent
  {
    get => GetValue(IconContentProperty);
    set => SetValue(IconContentProperty, value);
  }

  public FsusStepStatus? Status
  {
    get => GetValue(StatusProperty);
    set => SetValue(StatusProperty, value);
  }

  public FsusStepStatus EffectiveStatus { get; internal set; } = FsusStepStatus.Wait;

  protected override void OnPropertyChanged(AvaloniaPropertyChangedEventArgs change)
  {
    base.OnPropertyChanged(change);

    if (
      change.Property == TitleProperty ||
      change.Property == DescriptionProperty ||
      change.Property == IconContentProperty ||
      change.Property == StatusProperty)
    {
      EffectiveStatus = Status ?? EffectiveStatus;
      SyncState();
    }
  }

  internal void SyncState()
  {
    foreach (var className in new[]
    {
      "fsus-step-wait",
      "fsus-step-process",
      "fsus-step-finish",
      "fsus-step-error",
      "fsus-step-success",
    })
    {
      FsusComponentClasses.Ensure(this, className, false);
    }

    FsusComponentClasses.Ensure(this, $"fsus-step-{StatusName(EffectiveStatus)}", true);
    FsusComponentClasses.Ensure(this, "fsus-has-description", !string.IsNullOrWhiteSpace(Description));
    FsusComponentClasses.Ensure(this, "fsus-has-icon", IconContent is not null);
    AutomationProperties.SetName(this, Title ?? string.Empty);
    AutomationProperties.SetItemStatus(this, StatusName(EffectiveStatus));
  }

  private static string StatusName(FsusStepStatus status) =>
    status.ToString().ToLower(CultureInfo.InvariantCulture);
}
