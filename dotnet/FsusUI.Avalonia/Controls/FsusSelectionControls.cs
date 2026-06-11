using Avalonia.Controls;

namespace FsusUI.Avalonia.Controls;

public class FsusCheckbox : CheckBox
{
  public FsusCheckbox()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-checkbox");
  }
}

public class FsusRadio : RadioButton
{
  public FsusRadio()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-radio");
  }
}

public class FsusSwitch : ToggleSwitch
{
  public FsusSwitch()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-switch");
  }
}

