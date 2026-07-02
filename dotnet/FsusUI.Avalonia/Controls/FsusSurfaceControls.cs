using Avalonia;
using Avalonia.Automation;
using Avalonia.Automation.Peers;
using Avalonia.Controls;

namespace FsusUI.Avalonia.Controls;

public class FsusCard : ContentControl
{
  public static readonly StyledProperty<FsusComponentVariant> VariantProperty =
    AvaloniaProperty.Register<FsusCard, FsusComponentVariant>(
      nameof(Variant),
      FsusComponentVariant.Default);

  public static readonly StyledProperty<string?> TitleProperty =
    AvaloniaProperty.Register<FsusCard, string?>(nameof(Title));

  public static readonly StyledProperty<string?> DescriptionProperty =
    AvaloniaProperty.Register<FsusCard, string?>(nameof(Description));

  public static readonly StyledProperty<object?> IconContentProperty =
    AvaloniaProperty.Register<FsusCard, object?>(nameof(IconContent));

  public static readonly StyledProperty<object?> ActionContentProperty =
    AvaloniaProperty.Register<FsusCard, object?>(nameof(ActionContent));

  public static readonly StyledProperty<bool> IsSelectedProperty =
    AvaloniaProperty.Register<FsusCard, bool>(nameof(IsSelected));

  public FsusCard()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-card");
    SyncClasses();
    SyncAutomation();
  }

  public FsusComponentVariant Variant
  {
    get => GetValue(VariantProperty);
    set => SetValue(VariantProperty, value);
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

  public bool IsSelected
  {
    get => GetValue(IsSelectedProperty);
    set => SetValue(IsSelectedProperty, value);
  }

  protected override void OnPropertyChanged(AvaloniaPropertyChangedEventArgs change)
  {
    base.OnPropertyChanged(change);

    if (
      change.Property == VariantProperty ||
      change.Property == IsSelectedProperty ||
      change.Property == TitleProperty ||
      change.Property == DescriptionProperty ||
      change.Property == IconContentProperty ||
      change.Property == ActionContentProperty)
    {
      SyncClasses();
      SyncAutomation();
    }
  }

  private void SyncClasses()
  {
    FsusComponentClasses.SyncVariant(this, Variant);
    FsusComponentClasses.Ensure(this, "fsus-selected", IsSelected);
    FsusComponentClasses.Ensure(this, "fsus-has-title", !string.IsNullOrWhiteSpace(Title));
    FsusComponentClasses.Ensure(this, "fsus-has-description", !string.IsNullOrWhiteSpace(Description));
    FsusComponentClasses.Ensure(this, "fsus-has-icon", IconContent is not null);
    FsusComponentClasses.Ensure(this, "fsus-has-action", ActionContent is not null);
  }

  private void SyncAutomation()
  {
    AutomationProperties.SetControlTypeOverride(this, AutomationControlType.Group);
    AutomationProperties.SetName(this, FsusComponentClasses.ResolveName(Title, Content));
    AutomationProperties.SetHelpText(this, Description ?? string.Empty);
    AutomationProperties.SetItemStatus(this, IsSelected ? "selected" : FsusComponentClasses.VariantName(Variant));
  }
}

public class FsusDivider : Separator
{
  public static readonly StyledProperty<string?> TitleProperty =
    AvaloniaProperty.Register<FsusDivider, string?>(nameof(Title));

  public FsusDivider()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-divider");
    SyncAutomation();
  }

  public string? Title
  {
    get => GetValue(TitleProperty);
    set => SetValue(TitleProperty, value);
  }

  protected override void OnPropertyChanged(AvaloniaPropertyChangedEventArgs change)
  {
    base.OnPropertyChanged(change);

    if (change.Property == TitleProperty)
    {
      SyncAutomation();
      FsusComponentClasses.Ensure(this, "fsus-has-title", !string.IsNullOrWhiteSpace(Title));
    }
  }

  private void SyncAutomation()
  {
    AutomationProperties.SetControlTypeOverride(this, AutomationControlType.Separator);
    AutomationProperties.SetName(this, Title ?? string.Empty);
  }
}

public class FsusDialog : ContentControl
{
  public static readonly StyledProperty<bool> IsModalProperty =
    AvaloniaProperty.Register<FsusDialog, bool>(nameof(IsModal), true);

  public static readonly StyledProperty<bool> IsLoadingProperty =
    AvaloniaProperty.Register<FsusDialog, bool>(nameof(IsLoading));

  public FsusDialog()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-dialog-surface");
    SyncClasses();
  }

  public bool IsModal
  {
    get => GetValue(IsModalProperty);
    set => SetValue(IsModalProperty, value);
  }

  public bool IsLoading
  {
    get => GetValue(IsLoadingProperty);
    set => SetValue(IsLoadingProperty, value);
  }

  protected override void OnPropertyChanged(AvaloniaPropertyChangedEventArgs change)
  {
    base.OnPropertyChanged(change);

    if (change.Property == IsModalProperty || change.Property == IsLoadingProperty)
    {
      SyncClasses();
    }
  }

  private void SyncClasses()
  {
    FsusComponentClasses.Ensure(this, "fsus-modal", IsModal);
    FsusComponentClasses.Ensure(this, "fsus-loading", IsLoading);
  }
}
