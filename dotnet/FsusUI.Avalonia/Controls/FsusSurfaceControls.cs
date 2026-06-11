using Avalonia;
using Avalonia.Controls;

namespace FsusUI.Avalonia.Controls;

public class FsusCard : ContentControl
{
  public static readonly StyledProperty<bool> IsSelectedProperty =
    AvaloniaProperty.Register<FsusCard, bool>(nameof(IsSelected));

  public FsusCard()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-card");
    SyncClasses();
  }

  public bool IsSelected
  {
    get => GetValue(IsSelectedProperty);
    set => SetValue(IsSelectedProperty, value);
  }

  protected override void OnPropertyChanged(AvaloniaPropertyChangedEventArgs change)
  {
    base.OnPropertyChanged(change);

    if (change.Property == IsSelectedProperty)
    {
      SyncClasses();
    }
  }

  private void SyncClasses()
  {
    FsusComponentClasses.Ensure(this, "fsus-selected", IsSelected);
  }
}

public class FsusDivider : Separator
{
  public FsusDivider()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-divider");
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
