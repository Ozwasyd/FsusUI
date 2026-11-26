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
