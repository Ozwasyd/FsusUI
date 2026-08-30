using Avalonia;
using Avalonia.Automation;
using Avalonia.Controls;
using Avalonia.Input;

namespace FsusUI.Avalonia.Controls;

public sealed class FsusCheckboxButtonValueChangedEventArgs(
  bool oldChecked,
  bool newChecked) : EventArgs
{
  public bool OldChecked { get; } = oldChecked;

  public bool NewChecked { get; } = newChecked;
}

/// <summary>
/// Avalonia counterpart of the Vue <c>ElCheckboxButton</c> family: a
/// button-styled toggle that flips <see cref="Checked"/> on click and raises
/// <see cref="CheckedChanged"/>. Naming follows Avalonia style.
/// </summary>
public class FsusCheckboxButton : ContentControl
{
  public static readonly StyledProperty<bool> CheckedProperty =
    AvaloniaProperty.Register<FsusCheckboxButton, bool>(nameof(Checked));

  public static readonly StyledProperty<string?> LabelProperty =
    AvaloniaProperty.Register<FsusCheckboxButton, string?>(nameof(Label));

  public static readonly StyledProperty<bool> DisabledProperty =
    AvaloniaProperty.Register<FsusCheckboxButton, bool>(nameof(Disabled));

  private bool isSyncingDisabled;

  public FsusCheckboxButton()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-checkbox-button");
    SyncClasses();
    SyncAutomation();
  }

  public event EventHandler<FsusCheckboxButtonValueChangedEventArgs>? CheckedChanged;

  public bool Checked
  {
    get => GetValue(CheckedProperty);
    set => SetValue(CheckedProperty, value);
  }

  public string? Label
  {
    get => GetValue(LabelProperty);
    set => SetValue(LabelProperty, value);
  }

  public bool Disabled
  {
    get => GetValue(DisabledProperty);
    set => SetValue(DisabledProperty, value);
  }

  protected override void OnPointerReleased(PointerReleasedEventArgs e)
  {
    base.OnPointerReleased(e);
    if (Disabled || e.InitialPressMouseButton != MouseButton.Left)
    {
      return;
    }

    ToggleChecked();
  }

  public void ToggleChecked()
  {
    if (Disabled)
    {
      return;
    }

    var old = Checked;
    var next = !old;
    isSyncingDisabled = true;
    SetCurrentValue(CheckedProperty, next);
    isSyncingDisabled = false;
    CheckedChanged?.Invoke(
      this,
      new FsusCheckboxButtonValueChangedEventArgs(old, next));
  }

  protected override void OnPropertyChanged(AvaloniaPropertyChangedEventArgs change)
  {
    base.OnPropertyChanged(change);
    if (change.Property == CheckedProperty ||
        change.Property == DisabledProperty ||
        change.Property == LabelProperty)
    {
      SyncClasses();
      SyncAutomation();
    }

    if (change.Property == CheckedProperty && !isSyncingDisabled)
    {
      CheckedChanged?.Invoke(
        this,
        new FsusCheckboxButtonValueChangedEventArgs(
          ToBool(change.OldValue),
          ToBool(change.NewValue)));
    }
  }

  private static bool ToBool(object? value) => value is bool b && b;

  private void SyncClasses()
  {
    FsusComponentClasses.Ensure(this, "fsus-checked", Checked);
    FsusComponentClasses.Ensure(this, "fsus-unchecked", !Checked);
    FsusComponentClasses.Ensure(this, "fsus-disabled", Disabled);
  }

  private void SyncAutomation()
  {
    AutomationProperties.SetName(this,
      FsusComponentClasses.ResolveName(null, Label ?? "CheckboxButton"));
    AutomationProperties.SetHelpText(this, Checked ? "Checked" : "Unchecked");
  }
}
