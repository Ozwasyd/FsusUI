using Avalonia;
using Avalonia.Automation;
using Avalonia.Controls;
using Avalonia.Input;
using Avalonia.LogicalTree;

namespace FsusUI.Avalonia.Controls;

public sealed class FsusCollapseValueChangedEventArgs(
  IReadOnlyList<object?> oldActiveNames,
  IReadOnlyList<object?> newActiveNames) : EventArgs
{
  public IReadOnlyList<object?> OldActiveNames { get; } = oldActiveNames;

  public IReadOnlyList<object?> NewActiveNames { get; } = newActiveNames;
}

/// <summary>
/// Avalonia counterpart of the Vue <c>ElCollapse</c> family. Mirrors the Web
/// behavioral contract (accordion + active model value + change event) without
/// adopting Element Plus type/class names.
/// </summary>
public class FsusCollapse : ContentControl
{
  public static readonly StyledProperty<bool> AccordionProperty =
    AvaloniaProperty.Register<FsusCollapse, bool>(nameof(Accordion));

  public static readonly StyledProperty<IReadOnlyList<object?>> ActiveNamesProperty =
    AvaloniaProperty.Register<FsusCollapse, IReadOnlyList<object?>>(
      nameof(ActiveNames),
      Array.Empty<object?>());

  private bool isSyncingChildren;

  public FsusCollapse()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-collapse");
  }

  public event EventHandler<FsusCollapseValueChangedEventArgs>? ValueChanged;

  public bool Accordion
  {
    get => GetValue(AccordionProperty);
    set => SetValue(AccordionProperty, value);
  }

  public IReadOnlyList<object?> ActiveNames
  {
    get => GetValue(ActiveNamesProperty);
    set => SetValue(ActiveNamesProperty, value);
  }

  internal bool IsActive(object? itemKey)
  {
    foreach (var item in ActiveNames)
    {
      if (Equals(item, itemKey))
      {
        return true;
      }
    }

    return false;
  }

  internal void RequestToggle(object? itemKey)
  {
    var current = ActiveNames;
    var next = new List<object?>(current);
    var active = IsActive(itemKey);
    if (Accordion)
    {
      next.Clear();
      if (!active)
      {
        next.Add(itemKey);
      }
    }
    else
    {
      if (active)
      {
        next.Remove(itemKey);
      }
      else
      {
        next.Add(itemKey);
      }
    }

    if (next.Count == current.Count && !next.Except(current).Any())
    {
      return;
    }

    isSyncingChildren = true;
    SetCurrentValue(ActiveNamesProperty, next);
    isSyncingChildren = false;
    ValueChanged?.Invoke(
      this,
      new FsusCollapseValueChangedEventArgs(current, next));
  }

  private void SyncChildren()
  {
    foreach (var item in this.GetLogicalDescendants().OfType<FsusCollapseItem>())
    {
      item.SetIsActiveFromParent(IsActive(item.ItemKey));
    }
  }

  protected override void OnAttachedToLogicalTree(LogicalTreeAttachmentEventArgs e)
  {
    base.OnAttachedToLogicalTree(e);
    SyncChildren();
  }

  protected override void OnPropertyChanged(AvaloniaPropertyChangedEventArgs change)
  {
    base.OnPropertyChanged(change);
    if (change.Property == ActiveNamesProperty && !isSyncingChildren)
    {
      SyncChildren();
    }

    if (change.Property == AccordionProperty || change.Property == ActiveNamesProperty)
    {
      FsusComponentClasses.Ensure(this, "fsus-accordion", Accordion);
    }
  }
}

/// <summary>
/// Avalonia counterpart of the Vue <c>ElCollapseItem</c> family. Presents a
/// heading (toggle region) plus an expandable content area, and mirrors the
/// Web contract's title/itemKey/disabled/isActive semantics. The key is named
/// <see cref="ItemKey"/> to follow Avalonia naming style rather than Element
/// Plus <c>name</c>.
/// </summary>
public class FsusCollapseItem : ContentControl
{
  public static readonly StyledProperty<string> TitleProperty =
    AvaloniaProperty.Register<FsusCollapseItem, string>(
      nameof(Title),
      string.Empty);

  public static readonly StyledProperty<object?> ItemKeyProperty =
    AvaloniaProperty.Register<FsusCollapseItem, object?>(nameof(ItemKey));

  public static readonly StyledProperty<bool> DisabledProperty =
    AvaloniaProperty.Register<FsusCollapseItem, bool>(nameof(Disabled));

  public static readonly StyledProperty<bool> IsActiveProperty =
    AvaloniaProperty.Register<FsusCollapseItem, bool>(nameof(IsActive));

  public FsusCollapseItem()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-collapse-item");
    SyncClasses();
    SyncAutomation();
  }

  public string Title
  {
    get => GetValue(TitleProperty);
    set => SetValue(TitleProperty, value);
  }

  public object? ItemKey
  {
    get => GetValue(ItemKeyProperty);
    set => SetValue(ItemKeyProperty, value);
  }

  public bool Disabled
  {
    get => GetValue(DisabledProperty);
    set => SetValue(DisabledProperty, value);
  }

  public bool IsActive
  {
    get => GetValue(IsActiveProperty);
    set => SetValue(IsActiveProperty, value);
  }

  protected override void OnPointerPressed(PointerPressedEventArgs e)
  {
    base.OnPointerPressed(e);
    if (Disabled)
    {
      return;
    }

    var parent = this.FindLogicalAncestorOfType<FsusCollapse>();
    if (parent is not null)
    {
      parent.RequestToggle(ItemKey);
    }
  }

  internal void SetIsActiveFromParent(bool active)
  {
    SetCurrentValue(IsActiveProperty, active);
  }

  protected override void OnPropertyChanged(AvaloniaPropertyChangedEventArgs change)
  {
    base.OnPropertyChanged(change);
    if (change.Property == IsActiveProperty ||
        change.Property == DisabledProperty ||
        change.Property == TitleProperty)
    {
      SyncClasses();
      SyncAutomation();
    }
  }

  private void SyncClasses()
  {
    FsusComponentClasses.Ensure(this, "fsus-active", IsActive);
    FsusComponentClasses.Ensure(this, "fsus-disabled", Disabled);
  }

  private void SyncAutomation()
  {
    var fallback = ItemKey?.ToString() ?? string.Empty;
    AutomationProperties.SetName(this, string.IsNullOrEmpty(Title) ? fallback : Title);
    AutomationProperties.SetHelpText(this, IsActive ? "Expanded" : "Collapsed");
  }
}
