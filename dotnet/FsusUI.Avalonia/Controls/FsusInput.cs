using Avalonia;
using Avalonia.Controls;

namespace FsusUI.Avalonia.Controls;

public class FsusInput : TextBox
{
  public static readonly StyledProperty<FsusComponentSize> SizeProperty =
    AvaloniaProperty.Register<FsusInput, FsusComponentSize>(
      nameof(Size),
      FsusComponentSize.Md);

  public static readonly StyledProperty<bool> IsInvalidProperty =
    AvaloniaProperty.Register<FsusInput, bool>(nameof(IsInvalid));

  public static readonly StyledProperty<bool> IsClearableProperty =
    AvaloniaProperty.Register<FsusInput, bool>(nameof(IsClearable));

  public FsusInput()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-input");
    SyncClasses();
  }

  public FsusComponentSize Size
  {
    get => GetValue(SizeProperty);
    set => SetValue(SizeProperty, value);
  }

  public bool IsInvalid
  {
    get => GetValue(IsInvalidProperty);
    set => SetValue(IsInvalidProperty, value);
  }

  public bool IsClearable
  {
    get => GetValue(IsClearableProperty);
    set => SetValue(IsClearableProperty, value);
  }

  protected override void OnPropertyChanged(AvaloniaPropertyChangedEventArgs change)
  {
    base.OnPropertyChanged(change);

    if (
      change.Property == SizeProperty ||
      change.Property == IsInvalidProperty ||
      change.Property == IsClearableProperty)
    {
      SyncClasses();
    }
  }

  protected void SyncClasses()
  {
    FsusComponentClasses.SyncSize(this, Size);
    FsusComponentClasses.Ensure(this, "fsus-invalid", IsInvalid);
    FsusComponentClasses.Ensure(this, "fsus-clearable", IsClearable);
  }
}

