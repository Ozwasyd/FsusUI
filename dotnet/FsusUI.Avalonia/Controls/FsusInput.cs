using Avalonia;
using Avalonia.Automation;
using Avalonia.Automation.Peers;
using Avalonia.Controls;
using System.Globalization;
using System.Windows.Input;

namespace FsusUI.Avalonia.Controls;

public sealed class FsusInputValueChangedEventArgs(
  string? oldValue,
  string? newValue) : EventArgs
{
  public string? OldValue { get; } = oldValue;

  public string? NewValue { get; } = newValue;
}

public sealed class FsusInputNumberValueChangedEventArgs(
  decimal? oldValue,
  decimal? newValue) : EventArgs
{
  public decimal? OldValue { get; } = oldValue;

  public decimal? NewValue { get; } = newValue;
}

public sealed class FsusValidationStateChangedEventArgs(
  bool wasInvalid,
  bool isInvalid) : EventArgs
{
  public bool WasInvalid { get; } = wasInvalid;

  public bool IsInvalid { get; } = isInvalid;
}

public class FsusInput : TextBox
{
  public static readonly StyledProperty<FsusComponentSize> SizeProperty =
    AvaloniaProperty.Register<FsusInput, FsusComponentSize>(
      nameof(Size),
      FsusComponentSize.Md);

  public static readonly StyledProperty<bool> IsInvalidProperty =
    AvaloniaProperty.Register<FsusInput, bool>(nameof(IsInvalid));

  public static readonly StyledProperty<bool> IsClearableProperty =
    AvaloniaProperty.Register<FsusInput, bool>(nameof(IsClearable));

  public static readonly StyledProperty<string?> AccessibleNameProperty =
    AvaloniaProperty.Register<FsusInput, string?>(nameof(AccessibleName));

  public static readonly StyledProperty<object?> PrefixContentProperty =
    AvaloniaProperty.Register<FsusInput, object?>(nameof(PrefixContent));

  public static readonly StyledProperty<object?> SuffixContentProperty =
    AvaloniaProperty.Register<FsusInput, object?>(nameof(SuffixContent));

  private bool isComposing;
  private bool isSyncingInnerContent;
  private bool suppressTextValueChanged;
  private string? lastCommittedText;

  public FsusInput()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-input");
    ClearCommand = new RelayCommand(_ => ClearText(), _ => CanClearText());
    SyncClasses();
    SyncInnerContent();
    SyncAutomation();
  }

  public event EventHandler<FsusInputValueChangedEventArgs>? ValueChanged;

  public event EventHandler<EventArgs>? Cleared;

  public event EventHandler<FsusValidationStateChangedEventArgs>? ValidationStateChanged;

  public ICommand ClearCommand { get; }

  public FsusComponentSize Size
  {
    get => GetValue(SizeProperty);
    set => SetValue(SizeProperty, value);
  }

  public bool IsInvalid
  {
    get => GetValue(IsInvalidProperty);
    set => SetValue(IsInvalidProperty, value);
  }

  public bool IsClearable
  {
    get => GetValue(IsClearableProperty);
    set => SetValue(IsClearableProperty, value);
  }

  public string? AccessibleName
  {
    get => GetValue(AccessibleNameProperty);
    set => SetValue(AccessibleNameProperty, value);
  }

  public object? PrefixContent
  {
    get => GetValue(PrefixContentProperty);
    set => SetValue(PrefixContentProperty, value);
  }

  public object? SuffixContent
  {
    get => GetValue(SuffixContentProperty);
    set => SetValue(SuffixContentProperty, value);
  }

  public bool IsComposing => isComposing;

  public void ClearText()
  {
    if (!CanClearText())
    {
      return;
    }

    Text = string.Empty;
    Cleared?.Invoke(this, EventArgs.Empty);
  }

  public void BeginImeComposition()
  {
    isComposing = true;
    SyncClasses();
  }

  public void UpdateImeComposition(string? text)
  {
    if (!isComposing)
    {
      BeginImeComposition();
    }

    Text = text;
  }

  public void CommitImeComposition(string? text)
  {
    var oldValue = lastCommittedText;
    isComposing = false;
    suppressTextValueChanged = true;
    Text = text;
    suppressTextValueChanged = false;
    SyncClasses();
    EmitValueChanged(oldValue, Text);
  }

  protected override void OnPropertyChanged(AvaloniaPropertyChangedEventArgs change)
  {
    base.OnPropertyChanged(change);

    if (
      change.Property == SizeProperty ||
      change.Property == IsInvalidProperty ||
      change.Property == IsClearableProperty ||
      change.Property == PrefixContentProperty ||
      change.Property == SuffixContentProperty ||
      change.Property == IsReadOnlyProperty ||
      change.Property == IsEnabledProperty)
    {
      SyncClasses();
    }

    if (
      change.Property == IsInvalidProperty &&
      change.OldValue is bool wasInvalid &&
      change.NewValue is bool isInvalid &&
      wasInvalid != isInvalid)
    {
      ValidationStateChanged?.Invoke(
        this,
        new FsusValidationStateChangedEventArgs(wasInvalid, isInvalid));
    }

    if (
      !isSyncingInnerContent &&
      (change.Property == IsClearableProperty ||
      change.Property == PrefixContentProperty ||
      change.Property == SuffixContentProperty ||
      change.Property == IsReadOnlyProperty ||
      change.Property == IsEnabledProperty ||
      change.Property == TextProperty))
    {
      SyncInnerContent();
    }

    if (change.Property == AccessibleNameProperty)
    {
      SyncAutomation();
    }

    if (change.Property == TextProperty)
    {
      if (!isComposing && !suppressTextValueChanged)
      {
        EmitValueChanged(lastCommittedText, Text);
      }

      SyncClasses();
    }
  }

  protected void SyncClasses()
  {
    FsusComponentClasses.SyncSize(this, Size);
    FsusComponentClasses.Ensure(this, "fsus-invalid", IsInvalid);
    FsusComponentClasses.Ensure(this, "fsus-clearable", IsClearable);
    FsusComponentClasses.Ensure(this, "fsus-has-clear-affordance", IsClearable);
    FsusComponentClasses.Ensure(this, "fsus-has-prefix", PrefixContent is not null);
    FsusComponentClasses.Ensure(this, "fsus-has-suffix", SuffixContent is not null);
    FsusComponentClasses.Ensure(this, "fsus-readonly", IsReadOnly);
    FsusComponentClasses.Ensure(this, "fsus-disabled", !IsEnabled);
    FsusComponentClasses.Ensure(this, "fsus-composing", isComposing);
  }

  protected virtual void SyncInnerContent()
  {
    isSyncingInnerContent = true;
    InnerLeftContent = PrefixContent;
    InnerRightContent = BuildRightContent(IsClearable ? BuildClearButton() : null);
    isSyncingInnerContent = false;
  }

  protected void SyncAutomation()
  {
    if (!string.IsNullOrWhiteSpace(AccessibleName))
    {
      AutomationProperties.SetName(this, AccessibleName!);
    }

    AutomationProperties.SetAccessibilityView(this, AccessibilityView.Control);
    AutomationProperties.SetControlTypeOverride(this, AutomationControlType.Edit);
  }

  protected virtual void EmitValueChanged(string? oldValue, string? newValue)
  {
    if (oldValue == newValue)
    {
      return;
    }

    lastCommittedText = newValue;
    ValueChanged?.Invoke(this, new FsusInputValueChangedEventArgs(oldValue, newValue));
  }

  protected bool CanClearText() =>
    IsClearable &&
    !IsReadOnly &&
    IsEnabled &&
    !string.IsNullOrEmpty(Text);

  protected Button BuildClearButton()
  {
    var button = new Button
    {
      Content = "Clear",
      Command = ClearCommand,
      IsEnabled = CanClearText(),
      MinWidth = 24,
      Padding = new Thickness(6, 0),
    };
    button.Classes.Add("fsus-input-clear");
    AutomationProperties.SetName(button, "Clear input");
    return button;
  }

  protected object? BuildRightContent(params object?[] controls)
  {
    var items = controls
      .Prepend(SuffixContent)
      .Where(item => item is not null)
      .ToArray();

    if (items.Length == 0)
    {
      return null;
    }

    if (items.Length == 1)
    {
      return items[0];
    }

    var panel = new StackPanel
    {
      Orientation = global::Avalonia.Layout.Orientation.Horizontal,
      Spacing = 4,
    };
    panel.Classes.Add("fsus-input-affordances");

    foreach (var item in items)
    {
      if (item is Control control)
      {
        panel.Children.Add(control);
      }
      else
      {
        panel.Children.Add(new TextBlock
        {
          Text = Convert.ToString(item, CultureInfo.InvariantCulture) ?? string.Empty,
          VerticalAlignment = global::Avalonia.Layout.VerticalAlignment.Center,
        });
      }
    }

    return panel;
  }

  private sealed class RelayCommand(
    Action<object?> execute,
    Predicate<object?> canExecute) : ICommand
  {
    public event EventHandler? CanExecuteChanged
    {
      add { }
      remove { }
    }

    public bool CanExecute(object? parameter) => canExecute(parameter);

    public void Execute(object? parameter) => execute(parameter);
  }
}

public class FsusInputNumber : FsusInput
{
  public static readonly StyledProperty<decimal?> ValueProperty =
    AvaloniaProperty.Register<FsusInputNumber, decimal?>(nameof(Value));

  public static readonly StyledProperty<decimal?> MinimumProperty =
    AvaloniaProperty.Register<FsusInputNumber, decimal?>(nameof(Minimum));

  public static readonly StyledProperty<decimal?> MaximumProperty =
    AvaloniaProperty.Register<FsusInputNumber, decimal?>(nameof(Maximum));

  public static readonly StyledProperty<decimal> StepProperty =
    AvaloniaProperty.Register<FsusInputNumber, decimal>(
      nameof(Step),
      1);

  public static readonly StyledProperty<bool> ShowSpinControlsProperty =
    AvaloniaProperty.Register<FsusInputNumber, bool>(
      nameof(ShowSpinControls),
      true);

  private bool syncTextFromNumber;
  private decimal? lastValue;

  public FsusInputNumber()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-input-number");
    SyncNumberClasses();
    SyncNumberAutomation();
  }

  public new event EventHandler<FsusInputNumberValueChangedEventArgs>? ValueChanged;

  public decimal? Value
  {
    get => GetValue(ValueProperty);
    set => SetValue(ValueProperty, Clamp(value));
  }

  public decimal? Minimum
  {
    get => GetValue(MinimumProperty);
    set => SetValue(MinimumProperty, value);
  }

  public decimal? Maximum
  {
    get => GetValue(MaximumProperty);
    set => SetValue(MaximumProperty, value);
  }

  public decimal Step
  {
    get => GetValue(StepProperty);
    set => SetValue(StepProperty, value > 0 ? value : 1);
  }

  public bool ShowSpinControls
  {
    get => GetValue(ShowSpinControlsProperty);
    set => SetValue(ShowSpinControlsProperty, value);
  }

  public void Increment() => ApplyStep(Step);

  public void Decrement() => ApplyStep(-Step);

  public void CommitText()
  {
    if (decimal.TryParse(Text, NumberStyles.Number, CultureInfo.InvariantCulture, out var parsed))
    {
      IsInvalid = false;
      Value = parsed;
      return;
    }

    IsInvalid = !string.IsNullOrWhiteSpace(Text);
  }

  protected override void OnPropertyChanged(AvaloniaPropertyChangedEventArgs change)
  {
    base.OnPropertyChanged(change);

    if (change.Property == ValueProperty)
    {
      SyncText();
      EmitNumberChanged();
    }

    if (
      change.Property == MinimumProperty ||
      change.Property == MaximumProperty)
    {
      Value = Clamp(Value);
    }

    if (
      change.Property == ShowSpinControlsProperty ||
      change.Property == IsEnabledProperty ||
      change.Property == IsReadOnlyProperty ||
      change.Property == TextProperty)
    {
      SyncNumberClasses();
      SyncInnerContent();
    }

    if (change.Property == AccessibleNameProperty)
    {
      SyncNumberAutomation();
    }
  }

  private void ApplyStep(decimal delta)
  {
    if (!IsEnabled || IsReadOnly)
    {
      return;
    }

    var baseline = Value ?? Minimum ?? 0;
    Value = baseline + delta;
  }

  private decimal? Clamp(decimal? value)
  {
    if (!value.HasValue)
    {
      return null;
    }

    var next = value.Value;
    if (Minimum.HasValue && next < Minimum.Value)
    {
      next = Minimum.Value;
    }

    if (Maximum.HasValue && next > Maximum.Value)
    {
      next = Maximum.Value;
    }

    return next;
  }

  private void SyncText()
  {
    syncTextFromNumber = true;
    Text = Value?.ToString(CultureInfo.InvariantCulture) ?? string.Empty;
    syncTextFromNumber = false;
  }

  protected override void EmitValueChanged(string? oldValue, string? newValue)
  {
    if (syncTextFromNumber)
    {
      return;
    }

    base.EmitValueChanged(oldValue, newValue);
  }

  private void EmitNumberChanged()
  {
    if (lastValue == Value)
    {
      return;
    }

    var oldValue = lastValue;
    lastValue = Value;
    ValueChanged?.Invoke(
      this,
      new FsusInputNumberValueChangedEventArgs(oldValue, Value));
  }

  private void SyncNumberClasses()
  {
    FsusComponentClasses.Ensure(this, "fsus-has-spin-controls", ShowSpinControls);
    FsusComponentClasses.Ensure(this, "fsus-readonly", IsReadOnly);
    FsusComponentClasses.Ensure(this, "fsus-disabled", !IsEnabled);
  }

  protected override void SyncInnerContent()
  {
    if (!ShowSpinControls)
    {
      base.SyncInnerContent();
      return;
    }

    InnerLeftContent = PrefixContent;
    InnerRightContent = BuildRightContent(BuildSpinButton("+", Increment), BuildSpinButton("-", Decrement));
  }

  private Button BuildSpinButton(string label, Action action)
  {
    var button = new Button
    {
      Content = label,
      IsEnabled = IsEnabled && !IsReadOnly,
      MinWidth = 24,
      Padding = new Thickness(6, 0),
    };
    button.Classes.Add("fsus-input-number-spin");
    button.Click += (_, _) => action();
    AutomationProperties.SetName(button, label == "+" ? "Increase value" : "Decrease value");
    return button;
  }

  private void SyncNumberAutomation()
  {
    SyncAutomation();
    AutomationProperties.SetControlTypeOverride(this, AutomationControlType.Spinner);
  }
}
