using Avalonia.Media;

namespace FsusUI.Avalonia.Controls;

public class FsusTextarea : FsusInput
{
  public FsusTextarea()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-textarea");
    AcceptsReturn = true;
    TextWrapping = TextWrapping.Wrap;
    MinLines = 3;
  }
}

