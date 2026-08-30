using Avalonia;
using Avalonia.Automation;
using Avalonia.Automation.Peers;
using Avalonia.Automation.Provider;
using Avalonia.Controls;
using Avalonia.Controls.Metadata;
using Avalonia.Controls.Primitives;
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

[PseudoClasses(":dragging", ":disabled")]
[TemplatePart(Name = TrackHostPartName, Type = typeof(Canvas))]
[TemplatePart(Name = TrackPartName, Type = typeof(Border))]
[TemplatePart(Name = FillPartName, Type = typeof(Border))]
[TemplatePart(Name = ThumbPartName, Type = typeof(Border))]
[TemplatePart(Name = FocusRingPartName, Type = typeof(Border))]
public class FsusSlider : ContentControl
{
  private const string FocusRingPartName = "PART_FocusRing";

  public const string TrackHostPartName = "PART_TrackHost";
  public const string TrackPartName = "PART_Track";
  public const string FillPartName = "PART_Fill";
  public const string ThumbPartName = "PART_Thumb";

  public static readonly StyledProperty<string?> AccessibleNameProperty =
    AvaloniaProperty.Register<FsusSlider, string?>(nameof(AccessibleName));

  public static readonly StyledProperty<string?> AccessibleValueTextProperty =
    AvaloniaProperty.Register<FsusSlider, string?>(nameof(AccessibleValueText));

  public static readonly StyledProperty<double> MinProperty =
    AvaloniaProperty.Register<FsusSlider, double>(nameof(Min));

  public static readonly StyledProperty<double> MaxProperty =
    AvaloniaProperty.Register<FsusSlider, double>(nameof(Max), 100d);

  public static readonly StyledProperty<double> StepProperty =
    AvaloniaProperty.Register<FsusSlider, double>(nameof(Step), 1d);

  public static readonly StyledProperty<double> ValueProperty =
    AvaloniaProperty.Register<FsusSlider, double>(nameof(Value));

  public static readonly StyledProperty<FsusComponentSize> SizeProperty =
    AvaloniaProperty.Register<FsusSlider, FsusComponentSize>(
      nameof(Size),
      FsusComponentSize.Md);

  public static readonly StyledProperty<bool> IsDisabledProperty =
    AvaloniaProperty.Register<FsusSlider, bool>(nameof(IsDisabled));

  private Canvas? trackHostPart;
  private Border? trackPart;
  private Border? fillPart;
  private Border? thumbPart;
  private Border? focusRingPart;
  private IPointer? capturedPointer;
  private double gestureStartValue;
  private double lastValue;
  private bool isDragging;

  public FsusSlider()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-slider");
    Focusable = true;
    SyncState();
  }

  public event EventHandler<FsusNumericValueChangedEventArgs>? ValueChanged;
  public event EventHandler<FsusNumericValueChangedEventArgs>? ValueCommitted;

  public string? AccessibleName
  {
    get => GetValue(AccessibleNameProperty);
    set => SetValue(AccessibleNameProperty, value);
  }

  public string? AccessibleValueText
  {
    get => GetValue(AccessibleValueTextProperty);
    set => SetValue(AccessibleValueTextProperty, value);
  }

  public Collection<FsusSliderMark> Marks { get; } = [];

  public FsusComponentSize Size
  {
    get => GetValue(SizeProperty);
    set => SetValue(SizeProperty, value);
  }

  public double Min
  {
    get => GetValue(MinProperty);
    set => SetValue(MinProperty, value);
  }

  public double Max
  {
    get => GetValue(MaxProperty);
    set => SetValue(MaxProperty, value);
  }

  public double Step
  {
    get => GetValue(StepProperty);
    set => SetValue(StepProperty, value);
  }

  public double Value
  {
    get => GetValue(ValueProperty);
    set => SetValue(ValueProperty, value);
  }

  public double SelectedValue => Value;

  public bool IsDisabled
  {
    get => GetValue(IsDisabledProperty);
    set => SetValue(IsDisabledProperty, value);
  }

  protected override bool IsEnabledCore => base.IsEnabledCore && !IsDisabled;

  public void SetValue(double nextValue)
  {
    SetCurrentValue(ValueProperty, Normalize(nextValue));
  }

  public bool DragToRatio(double ratio)
  {
    if (!CanInteract)
    {
      return false;
    }

    SetValue(Min + ((Max - Min) * Math.Clamp(ratio, 0d, 1d)));
    return true;
  }

  protected ValueTask<bool> HandleKeyAsync(Key key)
  {
    if (!CanInteract)
    {
      return ValueTask.FromResult(false);
    }

    var direction = Max >= Min ? 1d : -1d;
    var pageStep = Math.Min(Math.Abs(Max - Min), Step * 10d);
    var nextValue = key switch
    {
      Key.Right or Key.Up => Value + (direction * Step),
      Key.Left or Key.Down => Value - (direction * Step),
      Key.Home => Min,
      Key.End => Max,
      Key.PageUp => Value + (direction * pageStep),
      Key.PageDown => Value - (direction * pageStep),
      _ => double.NaN,
    };

    if (double.IsNaN(nextValue))
    {
      return ValueTask.FromResult(false);
    }

    var previous = Value;
    SetValue(nextValue);
    CommitValue(previous);
    return ValueTask.FromResult(true);
  }

  protected virtual void SyncState()
  {
    FsusComponentClasses.SyncSize(this, Size);
    FsusComponentClasses.Ensure(this, "fsus-disabled", !CanInteract);
    FsusComponentClasses.Ensure(this, "fsus-has-marks", Marks.Count > 0);
    FsusComponentClasses.Ensure(this, "fsus-dragging", isDragging);
    FsusComponentClasses.Ensure(this, "fsus-focus-visible", IsKeyboardFocusWithin);
    PseudoClasses.Set(":dragging", isDragging);
    PseudoClasses.Set(":disabled", !CanInteract);
    AutomationProperties.SetAccessibilityView(this, AccessibilityView.Control);
    AutomationProperties.SetName(
      this,
      string.IsNullOrWhiteSpace(AccessibleName) ? "Slider" : AccessibleName);
    AutomationProperties.SetControlTypeOverride(this, AutomationControlType.Slider);
    AutomationProperties.SetItemStatus(this, ResolveAccessibleValueText());
    AutomationProperties.SetHelpText(
      this,
      $"Range {Format(Math.Min(Min, Max))} to {Format(Math.Max(Min, Max))}; step {Format(Step)}");
    UpdateVisuals();
  }

  protected override AutomationPeer OnCreateAutomationPeer() =>
    new SliderAutomationPeer(this);

  protected override void OnApplyTemplate(TemplateAppliedEventArgs e)
  {
    base.OnApplyTemplate(e);
    if (trackHostPart is not null)
    {
      trackHostPart.SizeChanged -= OnTrackHostSizeChanged;
    }

    trackHostPart = e.NameScope.Find<Canvas>(TrackHostPartName);
    trackPart = e.NameScope.Find<Border>(TrackPartName);
    fillPart = e.NameScope.Find<Border>(FillPartName);
    thumbPart = e.NameScope.Find<Border>(ThumbPartName);
    focusRingPart = e.NameScope.Find<Border>(FocusRingPartName);
    if (trackHostPart is not null)
    {
      trackHostPart.SizeChanged += OnTrackHostSizeChanged;
    }

    UpdateVisuals();
  }

  protected override Size ArrangeOverride(Size finalSize)
  {
    var arranged = base.ArrangeOverride(finalSize);
    UpdateVisuals();
    return arranged;
  }

  protected override void OnKeyDown(KeyEventArgs e)
  {
    base.OnKeyDown(e);
    if (!e.Handled && HandleKeyAsync(e.Key).GetAwaiter().GetResult())
    {
      e.Handled = true;
    }
  }

  protected override void OnPointerPressed(PointerPressedEventArgs e)
  {
    base.OnPointerPressed(e);
    if (e.Handled || !CanInteract ||
        !e.GetCurrentPoint(this).Properties.IsLeftButtonPressed)
    {
      return;
    }

    Focus();
    gestureStartValue = Value;
    capturedPointer = e.Pointer;
    isDragging = true;
    e.Pointer.Capture(this);
    UpdateValueFromPointer(e.GetPosition(this));
    SyncState();
    e.Handled = true;
  }

  protected override void OnPointerMoved(PointerEventArgs e)
  {
    base.OnPointerMoved(e);
    if (!isDragging || !ReferenceEquals(capturedPointer, e.Pointer) ||
        !ReferenceEquals(e.Pointer.Captured, this))
    {
      return;
    }

    UpdateValueFromPointer(e.GetPosition(this));
    e.Handled = true;
  }

  protected override void OnPointerReleased(PointerReleasedEventArgs e)
  {
    base.OnPointerReleased(e);
    if (!isDragging || !ReferenceEquals(capturedPointer, e.Pointer))
    {
      return;
    }

    UpdateValueFromPointer(e.GetPosition(this));
    var previous = gestureStartValue;
    isDragging = false;
    capturedPointer = null;
    e.Pointer.Capture(null);
    SyncState();
    CommitValue(previous);
    e.Handled = true;
  }

  protected override void OnPointerCaptureLost(PointerCaptureLostEventArgs e)
  {
    base.OnPointerCaptureLost(e);
    if (!isDragging)
    {
      return;
    }

    var previous = gestureStartValue;
    isDragging = false;
    capturedPointer = null;
    SyncState();
    CommitValue(previous);
  }

  protected override void OnPropertyChanged(AvaloniaPropertyChangedEventArgs change)
  {
    base.OnPropertyChanged(change);

    if (change.Property == StepProperty && Step <= 0d)
    {
      SetCurrentValue(StepProperty, 1d);
      return;
    }

    if (change.Property == MinProperty || change.Property == MaxProperty ||
        change.Property == StepProperty || change.Property == ValueProperty)
    {
      var normalized = Normalize(Value);
      if (!ValuesEqual(normalized, Value))
      {
        SetCurrentValue(ValueProperty, normalized);
        return;
      }

      if (!ValuesEqual(lastValue, Value))
      {
        var previous = lastValue;
        lastValue = Value;
        SyncState();
        ValueChanged?.Invoke(
          this,
          new FsusNumericValueChangedEventArgs(previous, Value));
      }
      else
      {
        SyncState();
      }
    }

    if (change.Property == IsDisabledProperty)
    {
      if (isDragging)
      {
        isDragging = false;
        capturedPointer?.Capture(null);
        capturedPointer = null;
      }

      UpdateIsEffectivelyEnabled();
      Focusable = !IsDisabled;
      SyncState();
    }

    if (change.Property == IsEnabledProperty ||
        change.Property == IsKeyboardFocusWithinProperty ||
        change.Property == AccessibleNameProperty ||
        change.Property == AccessibleValueTextProperty ||
        change.Property == SizeProperty)
    {
      SyncState();
    }
  }

  private double Clamp(double candidate) => Math.Clamp(candidate, Math.Min(Min, Max), Math.Max(Min, Max));

  private double Snap(double candidate)
  {
    var snapped = Min + (Math.Round((candidate - Min) / Step, MidpointRounding.AwayFromZero) * Step);
    return Math.Clamp(Math.Round(snapped, 6), Math.Min(Min, Max), Math.Max(Min, Max));
  }

  private static bool ValuesEqual(double first, double second) =>
    Math.Abs(first - second) < 0.000001d;

  private bool CanInteract => IsEnabled && !IsDisabled;

  private double Normalize(double candidate) => Snap(Clamp(candidate));

  private double ValueRatio => ValuesEqual(Min, Max)
    ? 0d
    : Math.Clamp((Value - Min) / (Max - Min), 0d, 1d);

  private void UpdateValueFromPointer(Point point)
  {
    var thumbWidth = thumbPart is null || double.IsNaN(thumbPart.Width)
      ? 0d
      : Math.Max(0d, thumbPart.Width);
    var trackWidth = Math.Max(1d, Bounds.Width - thumbWidth);
    DragToRatio((point.X - (thumbWidth / 2d)) / trackWidth);
  }

  private void UpdateVisuals()
  {
    if (trackHostPart is not { } host || trackPart is null ||
        fillPart is null || thumbPart is null || focusRingPart is null)
    {
      return;
    }

    var thumbWidth = double.IsNaN(thumbPart.Width) || thumbPart.Width <= 0d
      ? Math.Max(0d, thumbPart.Bounds.Width)
      : thumbPart.Width;
    var trackWidth = Math.Max(0d, host.Bounds.Width - thumbWidth);
    var trackLeft = thumbWidth / 2d;
    var trackTop = Math.Max(0d, (host.Bounds.Height - trackPart.Height) / 2d);
    var thumbTop = Math.Max(0d, (host.Bounds.Height - thumbPart.Height) / 2d);
    var focusRingWidth = double.IsNaN(focusRingPart.Width)
      ? Math.Max(0d, focusRingPart.Bounds.Width)
      : focusRingPart.Width;
    var focusRingTop = Math.Max(0d, (host.Bounds.Height - focusRingPart.Height) / 2d);
    var thumbCenter = trackLeft + (trackWidth * ValueRatio);

    trackPart.Width = trackWidth;
    Canvas.SetLeft(trackPart, trackLeft);
    Canvas.SetTop(trackPart, trackTop);
    fillPart.Width = trackWidth * ValueRatio;
    Canvas.SetLeft(fillPart, trackLeft);
    Canvas.SetTop(fillPart, trackTop);
    Canvas.SetLeft(focusRingPart, thumbCenter - (focusRingWidth / 2d));
    Canvas.SetTop(focusRingPart, focusRingTop);
    Canvas.SetLeft(thumbPart, thumbCenter - (thumbWidth / 2d));
    Canvas.SetTop(thumbPart, thumbTop);
  }

  private void OnTrackHostSizeChanged(object? sender, SizeChangedEventArgs e) =>
    UpdateVisuals();

  private void CommitValue(double previous)
  {
    if (!ValuesEqual(previous, Value))
    {
      ValueCommitted?.Invoke(
        this,
        new FsusNumericValueChangedEventArgs(previous, Value));
    }
  }

  private string ResolveAccessibleValueText() =>
    string.IsNullOrWhiteSpace(AccessibleValueText)
      ? Format(Value)
      : AccessibleValueText!;

  private sealed class SliderAutomationPeer(FsusSlider owner)
    : ControlAutomationPeer(owner), IRangeValueProvider
  {
    public bool IsReadOnly => !owner.CanInteract;
    public double Minimum => Math.Min(owner.Min, owner.Max);
    public double Maximum => Math.Max(owner.Min, owner.Max);
    public double Value => owner.Value;
    public double SmallChange => owner.Step;
    public double LargeChange => Math.Min(Math.Abs(owner.Max - owner.Min), owner.Step * 10d);

    protected override bool IsEnabledCore() => owner.CanInteract;

    public void SetValue(double value)
    {
      if (IsReadOnly)
      {
        return;
      }

      var previous = owner.Value;
      owner.SetValue(value);
      owner.CommitValue(previous);
    }
  }

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
