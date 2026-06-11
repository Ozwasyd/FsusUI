using Avalonia.Controls;

namespace FsusUI.Avalonia.Controls;

public class FsusTabs : TabControl
{
  public FsusTabs()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-tabs");
  }
}

public class FsusMenu : Menu
{
  public FsusMenu()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-menu");
  }
}

