using Avalonia;
using Avalonia.Automation;
using Avalonia.Automation.Peers;
using Avalonia.Controls;

namespace FsusUI.Avalonia.Controls;

public class FsusTag : ContentControl
{
  public static readonly StyledProperty<FsusComponentVariant> VariantProperty =
    AvaloniaProperty.Register<FsusTag, FsusComponentVariant>(
      nameof(Variant),
      FsusComponentVariant.Default);

  public static readonly StyledProperty<bool> IsSelectedProperty =
    AvaloniaProperty.Register<FsusTag, bool>(nameof(IsSelected));

  public static readonly StyledProperty<bool> IsRemovableProperty =
    AvaloniaProperty.Register<FsusTag, bool>(nameof(IsRemovable));

  public static readonly StyledProperty<bool> IsRemovedProperty =
    AvaloniaProperty.Register<FsusTag, bool>(nameof(IsRemoved));

  public static readonly StyledProperty<object?> IconContentProperty =
    AvaloniaProperty.Register<FsusTag, object?>(nameof(IconContent));

  public FsusTag()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-tag");
    SyncClasses();
    SyncAutomation();
  }

  public event EventHandler<EventArgs>? Removed;

  public FsusComponentVariant Variant
  {
    get => GetValue(VariantProperty);
    set => SetValue(VariantProperty, value);
  }

  public bool IsSelected
  {
    get => GetValue(IsSelectedProperty);
    set => SetValue(IsSelectedProperty, value);
  }

  public bool IsRemovable
  {
    get => GetValue(IsRemovableProperty);
    set => SetValue(IsRemovableProperty, value);
  }

  public bool IsRemoved
  {
    get => GetValue(IsRemovedProperty);
    private set => SetValue(IsRemovedProperty, value);
  }

  public object? IconContent
  {
    get => GetValue(IconContentProperty);
    set => SetValue(IconContentProperty, value);
  }

  public void Remove()
  {
    if (!IsRemovable || IsRemoved)
    {
      return;
    }

    IsRemoved = true;
    Removed?.Invoke(this, EventArgs.Empty);
  }

  protected override void OnPropertyChanged(AvaloniaPropertyChangedEventArgs change)
  {
    base.OnPropertyChanged(change);
    if (
      change.Property == VariantProperty ||
      change.Property == IsSelectedProperty ||
      change.Property == IsRemovableProperty ||
      change.Property == IsRemovedProperty ||
      change.Property == IconContentProperty ||
      change.Property == ContentProperty)
    {
      SyncClasses();
      SyncAutomation();
    }
  }

  private void SyncClasses()
  {
    FsusComponentClasses.SyncVariant(this, Variant);
    FsusComponentClasses.Ensure(this, "fsus-selected", IsSelected);
    FsusComponentClasses.Ensure(this, "fsus-removable", IsRemovable);
    FsusComponentClasses.Ensure(this, "fsus-removed", IsRemoved);
    FsusComponentClasses.Ensure(this, "fsus-has-icon", IconContent is not null);
  }

  private void SyncAutomation()
  {
    AutomationProperties.SetControlTypeOverride(
      this,
      IsRemovable ? AutomationControlType.Button : AutomationControlType.Text);
    AutomationProperties.SetName(this, FsusComponentClasses.ResolveName(null, Content));
    AutomationProperties.SetItemStatus(
      this,
      IsRemoved
        ? "removed"
        : IsSelected
          ? "selected"
          : FsusComponentClasses.VariantName(Variant));
  }
}

public class FsusBadge : ContentControl
{
  public static readonly StyledProperty<FsusComponentVariant> VariantProperty =
    AvaloniaProperty.Register<FsusBadge, FsusComponentVariant>(
      nameof(Variant),
      FsusComponentVariant.Primary);

  public static readonly StyledProperty<bool> IsDotProperty =
    AvaloniaProperty.Register<FsusBadge, bool>(nameof(IsDot));

  public static readonly StyledProperty<int> MaxProperty =
    AvaloniaProperty.Register<FsusBadge, int>(nameof(Max), 99);

  public static readonly StyledProperty<string?> AccessibleNameProperty =
    AvaloniaProperty.Register<FsusBadge, string?>(nameof(AccessibleName));

  public static readonly StyledProperty<object?> IconContentProperty =
    AvaloniaProperty.Register<FsusBadge, object?>(nameof(IconContent));

  public FsusBadge()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-badge");
    SyncClasses();
    SyncAutomation();
  }

  public FsusComponentVariant Variant
  {
    get => GetValue(VariantProperty);
    set => SetValue(VariantProperty, value);
  }

  public bool IsDot
  {
    get => GetValue(IsDotProperty);
    set => SetValue(IsDotProperty, value);
  }

  public int Max
  {
    get => GetValue(MaxProperty);
    set => SetValue(MaxProperty, value);
  }

  public string? AccessibleName
  {
    get => GetValue(AccessibleNameProperty);
    set => SetValue(AccessibleNameProperty, value);
  }

  public object? IconContent
  {
    get => GetValue(IconContentProperty);
    set => SetValue(IconContentProperty, value);
  }

  protected override void OnPropertyChanged(AvaloniaPropertyChangedEventArgs change)
  {
    base.OnPropertyChanged(change);
    if (
      change.Property == VariantProperty ||
      change.Property == IsDotProperty ||
      change.Property == MaxProperty ||
      change.Property == AccessibleNameProperty ||
      change.Property == IconContentProperty ||
      change.Property == ContentProperty)
    {
      SyncClasses();
      SyncAutomation();
    }
  }

  private void SyncClasses()
  {
    FsusComponentClasses.SyncVariant(this, Variant);
    FsusComponentClasses.Ensure(this, "fsus-dot", IsDot);
    FsusComponentClasses.Ensure(this, "fsus-has-icon", IconContent is not null);
  }

  private void SyncAutomation()
  {
    AutomationProperties.SetControlTypeOverride(this, AutomationControlType.Text);
    AutomationProperties.SetName(this, FsusComponentClasses.ResolveName(AccessibleName, Content));
    AutomationProperties.SetItemStatus(this, FsusComponentClasses.VariantName(Variant));
  }
}

public class FsusAlert : ContentControl
{
  public static readonly StyledProperty<FsusComponentVariant> VariantProperty =
    AvaloniaProperty.Register<FsusAlert, FsusComponentVariant>(
      nameof(Variant),
      FsusComponentVariant.Info);

  public static readonly StyledProperty<bool> IsDismissibleProperty =
    AvaloniaProperty.Register<FsusAlert, bool>(nameof(IsDismissible));

  public static readonly StyledProperty<bool> IsDismissedProperty =
    AvaloniaProperty.Register<FsusAlert, bool>(nameof(IsDismissed));

  public static readonly StyledProperty<string?> TitleProperty =
    AvaloniaProperty.Register<FsusAlert, string?>(nameof(Title));

  public static readonly StyledProperty<string?> DescriptionProperty =
    AvaloniaProperty.Register<FsusAlert, string?>(nameof(Description));

  public static readonly StyledProperty<object?> IconContentProperty =
    AvaloniaProperty.Register<FsusAlert, object?>(nameof(IconContent));

  public static readonly StyledProperty<object?> ActionContentProperty =
    AvaloniaProperty.Register<FsusAlert, object?>(nameof(ActionContent));

  public FsusAlert()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-alert");
    SyncClasses();
    SyncAutomation();
  }

  public event EventHandler<EventArgs>? Dismissed;

  public FsusComponentVariant Variant
  {
    get => GetValue(VariantProperty);
    set => SetValue(VariantProperty, value);
  }

  public bool IsDismissible
  {
    get => GetValue(IsDismissibleProperty);
    set => SetValue(IsDismissibleProperty, value);
  }

  public bool IsDismissed
  {
    get => GetValue(IsDismissedProperty);
    private set => SetValue(IsDismissedProperty, value);
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

  public object? ActionContent
  {
    get => GetValue(ActionContentProperty);
    set => SetValue(ActionContentProperty, value);
  }

  public void Dismiss()
  {
    if (!IsDismissible || IsDismissed)
    {
      return;
    }

    IsDismissed = true;
    Dismissed?.Invoke(this, EventArgs.Empty);
  }

  protected override void OnPropertyChanged(AvaloniaPropertyChangedEventArgs change)
  {
    base.OnPropertyChanged(change);
    if (
      change.Property == VariantProperty ||
      change.Property == IsDismissibleProperty ||
      change.Property == IsDismissedProperty ||
      change.Property == TitleProperty ||
      change.Property == DescriptionProperty ||
      change.Property == IconContentProperty ||
      change.Property == ActionContentProperty ||
      change.Property == ContentProperty)
    {
      SyncClasses();
      SyncAutomation();
    }
  }

  private void SyncClasses()
  {
    FsusComponentClasses.SyncVariant(this, Variant);
    FsusComponentClasses.Ensure(this, "fsus-dismissible", IsDismissible);
    FsusComponentClasses.Ensure(this, "fsus-dismissed", IsDismissed);
    FsusComponentClasses.Ensure(this, "fsus-has-title", !string.IsNullOrWhiteSpace(Title));
    FsusComponentClasses.Ensure(this, "fsus-has-description", !string.IsNullOrWhiteSpace(Description));
    FsusComponentClasses.Ensure(this, "fsus-has-icon", IconContent is not null);
    FsusComponentClasses.Ensure(this, "fsus-has-action", ActionContent is not null);
  }

  private void SyncAutomation()
  {
    AutomationProperties.SetControlTypeOverride(this, AutomationControlType.Text);
    AutomationProperties.SetClassNameOverride(this, "Alert");
    AutomationProperties.SetLiveSetting(this, AutomationLiveSetting.Assertive);
    AutomationProperties.SetName(this, FsusComponentClasses.ResolveName(Title, Content));
    AutomationProperties.SetHelpText(this, Description ?? string.Empty);
    AutomationProperties.SetItemStatus(
      this,
      IsDismissed ? "dismissed" : FsusComponentClasses.VariantName(Variant));
  }
}
