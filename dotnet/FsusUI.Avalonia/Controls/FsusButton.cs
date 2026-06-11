using Avalonia;
using Avalonia.Controls;

namespace FsusUI.Avalonia.Controls;

public class FsusButton : Button
{
  public static readonly StyledProperty<FsusComponentVariant> VariantProperty =
    AvaloniaProperty.Register<FsusButton, FsusComponentVariant>(
      nameof(Variant),
      FsusComponentVariant.Default);

  public static readonly StyledProperty<FsusComponentSize> SizeProperty =
    AvaloniaProperty.Register<FsusButton, FsusComponentSize>(
      nameof(Size),
      FsusComponentSize.Md);

  public static readonly StyledProperty<bool> IsLoadingProperty =
    AvaloniaProperty.Register<FsusButton, bool>(nameof(IsLoading));

  private bool? enabledBeforeLoading;

  public FsusButton()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-button");
    SyncClasses();
  }

  public FsusComponentVariant Variant
  {
    get => GetValue(VariantProperty);
    set => SetValue(VariantProperty, value);
  }

  public FsusComponentSize Size
  {
    get => GetValue(SizeProperty);
    set => SetValue(SizeProperty, value);
  }

  public bool IsLoading
  {
    get => GetValue(IsLoadingProperty);
    set => SetValue(IsLoadingProperty, value);
  }

  protected override void OnPropertyChanged(AvaloniaPropertyChangedEventArgs change)
  {
    base.OnPropertyChanged(change);

    if (
      change.Property == VariantProperty ||
      change.Property == SizeProperty ||
      change.Property == IsLoadingProperty)
    {
      SyncClasses();
    }
  }

  protected void SyncClasses()
  {
    FsusComponentClasses.SyncVariant(this, Variant);
    FsusComponentClasses.SyncSize(this, Size);
    FsusComponentClasses.Ensure(this, "fsus-loading", IsLoading);

    if (IsLoading)
    {
      enabledBeforeLoading ??= IsEnabled;
      IsEnabled = false;
      return;
    }

    if (enabledBeforeLoading.HasValue)
    {
      IsEnabled = enabledBeforeLoading.Value;
      enabledBeforeLoading = null;
    }
  }
}

