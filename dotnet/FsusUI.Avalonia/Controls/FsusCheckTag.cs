using Avalonia;
using Avalonia.Automation;
using Avalonia.Controls;
using Avalonia.Input;

namespace FsusUI.Avalonia.Controls;

public sealed class FsusCheckTagValueChangedEventArgs(
  bool oldChecked,
  bool newChecked) : EventArgs
{
  public bool OldChecked { get; } = oldChecked;

  public bool NewChecked { get; } = newChecked;
}

/// <summary>
/// Avalonia counterpart of the Vue <c>ElCheckTag</c> family: a toggleable chip
/// that flips <see cref="Checked"/> on click and raises
/// <see cref="CheckedChanged"/>. Naming follows Avalonia style.
/// </summary>
public class FsusCheckTag : ContentControl
{
  public static readonly StyledProperty<bool> CheckedProperty =
    AvaloniaProperty.Register<FsusCheckTag, bool>(nameof(Checked));

  public FsusCheckTag()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-check-tag");
    SyncClasses();
    Cursor = new Cursor(StandardCursorType.Hand);
  }

  public event EventHandler<FsusCheckTagValueChangedEventArgs>? CheckedChanged;

  public bool Checked
  {
    get => GetValue(CheckedProperty);
    set => SetValue(CheckedProperty, value);
  }

  protected override void OnPointerReleased(PointerReleasedEventArgs e)
  {
    base.OnPointerReleased(e);
    if (e.InitialPressMouseButton != MouseButton.Left)
    {
      return;
    }

    var old = Checked;
    var next = !old;
    SetCurrentValue(CheckedProperty, next);
    CheckedChanged?.Invoke(
      this,
      new FsusCheckTagValueChangedEventArgs(old, next));
  }

  protected override void OnPropertyChanged(AvaloniaPropertyChangedEventArgs change)
  {
    base.OnPropertyChanged(change);
    if (change.Property == CheckedProperty)
    {
      SyncClasses();
      SyncAutomation();
    }
  }

  private void SyncClasses()
  {
    FsusComponentClasses.Ensure(this, "fsus-checked", Checked);
    FsusComponentClasses.Ensure(this, "fsus-unchecked", !Checked);
  }

  private void SyncAutomation()
  {
    AutomationProperties.SetName(this, "CheckTag");
    AutomationProperties.SetHelpText(this, Checked ? "Checked" : "Unchecked");
  }
}
