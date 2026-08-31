using Avalonia;
using Avalonia.Automation;
using Avalonia.Automation.Peers;
using Avalonia.Automation.Provider;
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
    Focusable = true;
    IsTabStop = true;
    SyncAutomation();
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

    ToggleChecked();
    e.Handled = true;
  }

  protected override void OnKeyDown(KeyEventArgs e)
  {
    base.OnKeyDown(e);
    if (e.Key is not (Key.Enter or Key.Space))
    {
      return;
    }

    ToggleChecked();
    e.Handled = true;
  }

  protected override void OnPropertyChanged(AvaloniaPropertyChangedEventArgs change)
  {
    base.OnPropertyChanged(change);
    if (change.Property == CheckedProperty)
    {
      SyncClasses();
    }
    if (
      change.Property == CheckedProperty ||
      change.Property == ContentControl.ContentProperty)
    {
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
    AutomationProperties.SetName(
      this,
      FsusComponentClasses.ResolveName(null, Content ?? "CheckTag"));
    AutomationProperties.SetHelpText(this, Checked ? "Checked" : "Unchecked");
    AutomationProperties.SetControlTypeOverride(this, AutomationControlType.CheckBox);
  }

  private void ToggleChecked()
  {
    var old = Checked;
    var next = !old;
    SetCurrentValue(CheckedProperty, next);
    CheckedChanged?.Invoke(
      this,
      new FsusCheckTagValueChangedEventArgs(old, next));
  }

  protected override AutomationPeer OnCreateAutomationPeer() =>
    new CheckTagAutomationPeer(this);

  private sealed class CheckTagAutomationPeer(FsusCheckTag owner)
    : ControlAutomationPeer(owner), IToggleProvider
  {
    public ToggleState ToggleState =>
      owner.Checked ? ToggleState.On : ToggleState.Off;

    public void Toggle() => owner.ToggleChecked();
  }
}
