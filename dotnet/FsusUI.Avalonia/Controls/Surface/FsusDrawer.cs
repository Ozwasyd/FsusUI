using Avalonia;
using Avalonia.Automation;
using Avalonia.Automation.Peers;
using Avalonia.Automation.Provider;
using Avalonia.Controls;
using Avalonia.Controls.Primitives;
using Avalonia.Input;
using Avalonia.Interactivity;
using Avalonia.Media;
using Avalonia.VisualTree;
using FsusUI.Avalonia.Overlay;

namespace FsusUI.Avalonia.Controls;

public class FsusDrawer : FsusModalSurface
{
  public static readonly StyledProperty<FsusDrawerPlacement> PlacementProperty =
    AvaloniaProperty.Register<FsusDrawer, FsusDrawerPlacement>(
      nameof(Placement),
      FsusDrawerPlacement.Right);

  public FsusDrawer() : base("fsus-drawer")
  {
    AutomationProperties.SetControlTypeOverride(this, AutomationControlType.Window);
    SyncState();
  }

  public FsusDrawerPlacement Placement
  {
    get => GetValue(PlacementProperty);
    set => SetValue(PlacementProperty, value);
  }

  protected override void OnPropertyChanged(AvaloniaPropertyChangedEventArgs change)
  {
    base.OnPropertyChanged(change);

    if (change.Property == PlacementProperty)
    {
      SyncState();
    }
  }

  protected override void SyncState()
  {
    base.SyncState();
    foreach (var className in new[]
    {
      "fsus-drawer-left",
      "fsus-drawer-right",
      "fsus-drawer-top",
      "fsus-drawer-bottom",
    })
    {
      FsusComponentClasses.Ensure(this, className, false);
    }

    FsusComponentClasses.Ensure(this, $"fsus-drawer-{PlacementName(Placement)}", true);
    AutomationProperties.SetControlTypeOverride(this, AutomationControlType.Window);
    AutomationProperties.SetClassNameOverride(this, "Drawer");
  }

  private static string PlacementName(FsusDrawerPlacement placement) =>
    placement switch
    {
      FsusDrawerPlacement.Left => "left",
      FsusDrawerPlacement.Top => "top",
      FsusDrawerPlacement.Bottom => "bottom",
      _ => "right",
    };
}
