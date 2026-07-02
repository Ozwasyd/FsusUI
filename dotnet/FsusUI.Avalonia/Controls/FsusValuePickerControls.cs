using Avalonia.Automation;
using Avalonia.Automation.Peers;
using Avalonia.Controls;
using Avalonia.Input;
using System.Collections.ObjectModel;
using System.Globalization;

namespace FsusUI.Avalonia.Controls;

public sealed record FsusSliderMark(double Value, string Label);

public sealed class FsusNumericValueChangedEventArgs(
  double oldValue,
  double newValue) : EventArgs
{
  public double OldValue { get; } = oldValue;
  public double NewValue { get; } = newValue;
}

public class FsusSlider : ContentControl
{
  private double min;
  private double max = 100d;
  private double step = 1d;
  private double value;
  private bool isDisabled;

  public FsusSlider()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-slider");
    Focusable = true;
    SyncState();
  }

  public event EventHandler<FsusNumericValueChangedEventArgs>? ValueChanged;

  public string? AccessibleName { get; set; }
  public Collection<FsusSliderMark> Marks { get; } = [];
  public FsusComponentSize Size { get; set; } = FsusComponentSize.Md;

  public double Min
  {
    get => min;
    set
    {
      min = value;
      SetValue(this.value);
    }
  }

  public double Max
  {
    get => max;
    set
    {
      max = value;
      SetValue(this.value);
    }
  }

  public double Step
  {
    get => step;
    set => step = value <= 0d ? 1d : value;
  }

  public double Value
  {
    get => value;
    set => SetValue(value);
  }

  public double SelectedValue => Value;

  public bool IsDisabled
  {
    get => isDisabled;
    set
    {
      isDisabled = value;
      SyncState();
    }
  }

  public void SetValue(double nextValue)
  {
    var oldValue = value;
    value = Snap(Clamp(nextValue));
    SyncState();
    if (!ValuesEqual(oldValue, value))
    {
      ValueChanged?.Invoke(this, new FsusNumericValueChangedEventArgs(oldValue, value));
    }
  }

  public bool DragToRatio(double ratio)
  {
    if (IsDisabled)
    {
      return false;
    }

    SetValue(Min + ((Max - Min) * Math.Clamp(ratio, 0d, 1d)));
    return true;
  }

  protected ValueTask<bool> HandleKeyAsync(Key key)
  {
    if (IsDisabled)
    {
      return ValueTask.FromResult(false);
    }

    if (key == Key.Right || key == Key.Up)
    {
      SetValue(Value + Step);
      return ValueTask.FromResult(true);
    }

    if (key == Key.Left || key == Key.Down)
    {
      SetValue(Value - Step);
      return ValueTask.FromResult(true);
    }

    return ValueTask.FromResult(false);
  }

  protected virtual void SyncState()
  {
    FsusComponentClasses.SyncSize(this, Size);
    FsusComponentClasses.Ensure(this, "fsus-disabled", IsDisabled);
    FsusComponentClasses.Ensure(this, "fsus-has-marks", Marks.Count > 0);
    AutomationProperties.SetName(this, FsusComponentClasses.ResolveName(AccessibleName, Value));
    AutomationProperties.SetControlTypeOverride(this, AutomationControlType.Slider);
    AutomationProperties.SetItemStatus(this, $"{Format(Value)} / {Format(Max)}");
  }

  private double Clamp(double candidate) => Math.Clamp(candidate, Math.Min(Min, Max), Math.Max(Min, Max));

  private double Snap(double candidate)
  {
    var snapped = Min + (Math.Round((candidate - Min) / Step, MidpointRounding.AwayFromZero) * Step);
    return Math.Clamp(Math.Round(snapped, 6), Math.Min(Min, Max), Math.Max(Min, Max));
  }

  private static bool ValuesEqual(double first, double second) =>
    Math.Abs(first - second) < 0.000001d;

  private static string Format(double candidate) =>
    candidate.ToString("0.###", CultureInfo.InvariantCulture);
}

public class FsusRate : ContentControl
{
  private double value;
  private int max = 5;
  private bool allowHalf;
  private bool isDisabled;

  public FsusRate()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-rate");
    Focusable = true;
    SyncState();
  }

  public string? AccessibleName { get; set; }
  public FsusComponentSize Size { get; set; } = FsusComponentSize.Md;

  public int Max
  {
    get => max;
    set
    {
      max = Math.Max(1, value);
      SetValue(this.value);
    }
  }

  public bool AllowHalf
  {
    get => allowHalf;
    set
    {
      allowHalf = value;
      SetValue(this.value);
    }
  }

  public double Value
  {
    get => value;
    set => SetValue(value);
  }

  public double SelectedValue => Value;

  public bool IsDisabled
  {
    get => isDisabled;
    set
    {
      isDisabled = value;
      SyncState();
    }
  }

  public void SetValue(double nextValue)
  {
    value = Quantize(Math.Clamp(nextValue, 0d, Max));
    SyncState();
  }

  public bool DragToRatio(double ratio)
  {
    if (IsDisabled)
    {
      return false;
    }

    SetValue(Max * Math.Clamp(ratio, 0d, 1d));
    return true;
  }

  protected ValueTask<bool> HandleKeyAsync(Key key)
  {
    if (IsDisabled)
    {
      return ValueTask.FromResult(false);
    }

    var delta = AllowHalf ? 0.5d : 1d;
    if (key == Key.Right || key == Key.Up)
    {
      SetValue(Value + delta);
      return ValueTask.FromResult(true);
    }

    if (key == Key.Left || key == Key.Down)
    {
      SetValue(Value - delta);
      return ValueTask.FromResult(true);
    }

    return ValueTask.FromResult(false);
  }

  private double Quantize(double candidate)
  {
    var unit = AllowHalf ? 0.5d : 1d;
    return Math.Clamp(Math.Round(candidate / unit, MidpointRounding.AwayFromZero) * unit, 0d, Max);
  }

  private void SyncState()
  {
    FsusComponentClasses.SyncSize(this, Size);
    FsusComponentClasses.Ensure(this, "fsus-empty", Value <= 0d);
    FsusComponentClasses.Ensure(this, "fsus-selected", Value > 0d);
    FsusComponentClasses.Ensure(this, "fsus-half", AllowHalf && Math.Abs(Value % 1d) > 0.000001d);
    FsusComponentClasses.Ensure(this, "fsus-disabled", IsDisabled);
    AutomationProperties.SetName(this, FsusComponentClasses.ResolveName(AccessibleName, Value));
    AutomationProperties.SetControlTypeOverride(this, AutomationControlType.Slider);
    AutomationProperties.SetItemStatus(this, $"{Format(Value)} / {Max.ToString(CultureInfo.InvariantCulture)}");
  }

  private static string Format(double candidate) =>
    candidate.ToString("0.###", CultureInfo.InvariantCulture);
}

public class FsusColorPicker : ContentControl
{
  private byte red;
  private byte green;
  private byte blue;
  private double alpha = 1d;
  private string? value;
  private bool isDisabled;

  public FsusColorPicker()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-color-picker");
    Focusable = true;
    SyncState();
  }

  public string? AccessibleName { get; set; }
  public Collection<string> PresetColors { get; } = [];
  public bool IsClearable { get; set; }
  public bool ShowAlpha { get; set; }
  public FsusComponentSize Size { get; set; } = FsusComponentSize.Md;
  public string? Value => value;
  public string? SelectedValue => value;

  public bool IsDisabled
  {
    get => isDisabled;
    set
    {
      isDisabled = value;
      SyncState();
    }
  }

  public double Alpha
  {
    get => alpha;
    set => SetAlpha(value);
  }

  public bool SelectPreset(string color)
  {
    if (!PresetColors.Contains(color, StringComparer.OrdinalIgnoreCase))
    {
      return false;
    }

    return SelectColor(color);
  }

  public bool SelectColor(string color)
  {
    if (IsDisabled || !TryParseHex(color, out red, out green, out blue))
    {
      return false;
    }

    value = FormatValue();
    SyncState();
    return true;
  }

  public bool SetAlpha(double nextAlpha)
  {
    if (IsDisabled)
    {
      return false;
    }

    alpha = Math.Clamp(nextAlpha, 0d, 1d);
    if (value is not null)
    {
      value = FormatValue();
    }

    SyncState();
    return true;
  }

  public void ClearSelection()
  {
    if (!IsClearable || IsDisabled)
    {
      return;
    }

    value = null;
    SyncState();
  }

  protected ValueTask<bool> HandleKeyAsync(Key key)
  {
    if (key is not (Key.Delete or Key.Back))
    {
      return ValueTask.FromResult(false);
    }

    var hadValue = value is not null;
    ClearSelection();
    return ValueTask.FromResult(hadValue && value is null);
  }

  private string FormatValue() =>
    ShowAlpha
      ? string.Create(
        CultureInfo.InvariantCulture,
        $"rgba({red},{green},{blue},{alpha:0.00})")
      : $"#{red:X2}{green:X2}{blue:X2}";

  private void SyncState()
  {
    FsusComponentClasses.SyncSize(this, Size);
    FsusComponentClasses.Ensure(this, "fsus-empty", value is null);
    FsusComponentClasses.Ensure(this, "fsus-selected", value is not null);
    FsusComponentClasses.Ensure(this, "fsus-clearable", IsClearable);
    FsusComponentClasses.Ensure(this, "fsus-alpha", ShowAlpha);
    FsusComponentClasses.Ensure(this, "fsus-has-presets", PresetColors.Count > 0);
    FsusComponentClasses.Ensure(this, "fsus-disabled", IsDisabled);
    AutomationProperties.SetName(this, FsusComponentClasses.ResolveName(AccessibleName, value));
    AutomationProperties.SetControlTypeOverride(this, AutomationControlType.ComboBox);
    AutomationProperties.SetItemStatus(this, value is null ? "empty" : $"selected {value}");
  }

  private static bool TryParseHex(
    string color,
    out byte red,
    out byte green,
    out byte blue)
  {
    red = 0;
    green = 0;
    blue = 0;
    var value = color.Trim().TrimStart('#');
    if (value.Length == 3)
    {
      value = string.Concat(value.Select((character) => $"{character}{character}"));
    }

    if (value.Length != 6)
    {
      return false;
    }

    return
      byte.TryParse(value[..2], NumberStyles.HexNumber, CultureInfo.InvariantCulture, out red) &&
      byte.TryParse(value[2..4], NumberStyles.HexNumber, CultureInfo.InvariantCulture, out green) &&
      byte.TryParse(value[4..6], NumberStyles.HexNumber, CultureInfo.InvariantCulture, out blue);
  }
}
