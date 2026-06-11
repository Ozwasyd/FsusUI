using Avalonia;
using Avalonia.Controls;

namespace FsusUI.Avalonia.Controls;

public class FsusTag : ContentControl
{
  public static readonly StyledProperty<FsusComponentVariant> VariantProperty =
    AvaloniaProperty.Register<FsusTag, FsusComponentVariant>(
      nameof(Variant),
      FsusComponentVariant.Default);

  public FsusTag()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-tag");
    SyncClasses();
  }

  public FsusComponentVariant Variant
  {
    get => GetValue(VariantProperty);
    set => SetValue(VariantProperty, value);
  }

  protected override void OnPropertyChanged(AvaloniaPropertyChangedEventArgs change)
  {
    base.OnPropertyChanged(change);
    if (change.Property == VariantProperty)
    {
      SyncClasses();
    }
  }

  private void SyncClasses()
  {
    FsusComponentClasses.SyncVariant(this, Variant);
  }
}

public class FsusBadge : ContentControl
{
  public static readonly StyledProperty<FsusComponentVariant> VariantProperty =
    AvaloniaProperty.Register<FsusBadge, FsusComponentVariant>(
      nameof(Variant),
      FsusComponentVariant.Primary);

  public FsusBadge()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-badge");
    SyncClasses();
  }

  public FsusComponentVariant Variant
  {
    get => GetValue(VariantProperty);
    set => SetValue(VariantProperty, value);
  }

  protected override void OnPropertyChanged(AvaloniaPropertyChangedEventArgs change)
  {
    base.OnPropertyChanged(change);
    if (change.Property == VariantProperty)
    {
      SyncClasses();
    }
  }

  private void SyncClasses()
  {
    FsusComponentClasses.SyncVariant(this, Variant);
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

  public FsusAlert()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-alert");
    SyncClasses();
  }

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

  protected override void OnPropertyChanged(AvaloniaPropertyChangedEventArgs change)
  {
    base.OnPropertyChanged(change);
    if (change.Property == VariantProperty || change.Property == IsDismissibleProperty)
    {
      SyncClasses();
    }
  }

  private void SyncClasses()
  {
    FsusComponentClasses.SyncVariant(this, Variant);
    FsusComponentClasses.Ensure(this, "fsus-dismissible", IsDismissible);
  }
}
