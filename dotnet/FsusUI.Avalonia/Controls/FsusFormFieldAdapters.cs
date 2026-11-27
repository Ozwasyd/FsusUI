using Avalonia.Controls;
using Avalonia.Controls.Primitives;

namespace FsusUI.Avalonia.Controls;

[AttributeUsage(AttributeTargets.Class, AllowMultiple = false, Inherited = false)]
internal sealed class FsusFormFieldAdapterForAttribute : Attribute
{
  public FsusFormFieldAdapterForAttribute(Type controlType) => ControlType = controlType;

  public Type ControlType { get; }
}

internal abstract class FsusBuiltInFieldAdapter<TControl>(
  TControl control,
  Action<TControl, FsusComponentSize>? applySize = null,
  Action<TControl, bool>? applyInvalidState = null) : IFsusFormFieldAdapter
  where TControl : Control
{
  protected TControl Control { get; } = control;

  public FsusFormFieldAdapterCapabilities Capabilities =>
    FsusFormFieldAdapterCapabilities.ReadValue |
    FsusFormFieldAdapterCapabilities.WriteValue |
    FsusFormFieldAdapterCapabilities.ResetValue |
    (applySize is null ? FsusFormFieldAdapterCapabilities.None : FsusFormFieldAdapterCapabilities.ApplySize) |
    (applyInvalidState is null ? FsusFormFieldAdapterCapabilities.None : FsusFormFieldAdapterCapabilities.ApplyInvalidState);

  public abstract FsusFormFieldReadResult ReadValue();

  public FsusFormFieldAdapterResult TryWriteValue(object? value) => TryResetValue(value);

  public abstract FsusFormFieldAdapterResult TryResetValue(object? initialValue);

  public FsusFormFieldAdapterResult TryApplySize(FsusComponentSize size)
  {
    if (applySize is null)
    {
      return Missing(nameof(TryApplySize), "apply size");
    }

    applySize(Control, size);
    return Success;
  }

  public FsusFormFieldAdapterResult TryApplyInvalidState(bool isInvalid)
  {
    if (applyInvalidState is null)
    {
      return Missing(nameof(TryApplyInvalidState), "apply invalid state");
    }

    applyInvalidState(Control, isInvalid);
    return Success;
  }

  protected FsusFormFieldAdapterResult Mismatch(object? value, string member, string expected) =>
    Failure(
      FsusFormFieldAdapterErrorKind.TypeMismatch,
      $"Expected {expected} but received {(value is null ? "null" : value.GetType().Name)}.",
      member);

  private FsusFormFieldAdapterResult Missing(string member, string operation) =>
    Failure(
      FsusFormFieldAdapterErrorKind.MissingCapability,
      $"{typeof(TControl).Name} does not support {operation}.",
      member);

  protected static FsusFormFieldAdapterResult Failure(
    FsusFormFieldAdapterErrorKind kind,
    string message,
    string member) =>
    FsusFormFieldAdapterResult.Failure(new FsusFormFieldAdapterError(kind, message, typeof(TControl), member));

  protected FsusFormFieldAdapterResult Success => FsusFormFieldAdapterResult.Success;
}

internal abstract class FsusPropertyFieldAdapter<TControl, TValue>(
  TControl control,
  string member,
  string expected,
  Func<TControl, TValue> read,
  Action<TControl, TValue> write,
  Action<TControl, FsusComponentSize>? applySize = null,
  Action<TControl, bool>? applyInvalidState = null)
  : FsusBuiltInFieldAdapter<TControl>(control, applySize, applyInvalidState)
  where TControl : Control
{
  public override FsusFormFieldReadResult ReadValue() =>
    FsusFormFieldReadResult.Success(read(Control));

  public override FsusFormFieldAdapterResult TryResetValue(object? initialValue)
  {
    if (initialValue is not null && initialValue is not TValue)
    {
      return Mismatch(initialValue, member, expected);
    }

    write(Control, (TValue)initialValue!);
    return Success;
  }
}

[FsusFormFieldAdapterFor(typeof(FsusInput))]
internal sealed class FsusInputFieldAdapter(FsusInput control)
  : FsusPropertyFieldAdapter<FsusInput, string?>(
    control, nameof(FsusInput.Text), "a string value",
    static field => field.Text, static (field, value) => field.Text = value,
    static (field, size) => field.Size = size,
    static (field, isInvalid) => field.IsInvalid = isInvalid);

[FsusFormFieldAdapterFor(typeof(FsusTextarea))]
internal sealed class FsusTextareaFieldAdapter(FsusTextarea control)
  : FsusPropertyFieldAdapter<FsusTextarea, string?>(
    control, nameof(FsusTextarea.Text), "a string value",
    static field => field.Text, static (field, value) => field.Text = value,
    static (field, size) => field.Size = size,
    static (field, isInvalid) => field.IsInvalid = isInvalid);

[FsusFormFieldAdapterFor(typeof(FsusInputNumber))]
internal sealed class FsusInputNumberFieldAdapter(FsusInputNumber control)
  : FsusPropertyFieldAdapter<FsusInputNumber, decimal?>(
    control, nameof(FsusInputNumber.Value), "a decimal value",
    static field => field.Value, static (field, value) => field.Value = value,
    static (field, size) => field.Size = size,
    static (field, isInvalid) => field.IsInvalid = isInvalid);

[FsusFormFieldAdapterFor(typeof(TextBox))]
internal sealed class TextBoxFieldAdapter(TextBox control)
  : FsusPropertyFieldAdapter<TextBox, string?>(
    control, nameof(TextBox.Text), "a string value",
    static field => field.Text, static (field, value) => field.Text = value);

[FsusFormFieldAdapterFor(typeof(FsusCheckbox))]
internal sealed class FsusCheckboxFieldAdapter(FsusCheckbox control)
  : FsusPropertyFieldAdapter<FsusCheckbox, bool?>(
    control, nameof(FsusCheckbox.IsChecked), "a boolean value",
    static field => field.IsChecked, static (field, value) => field.IsChecked = value,
    static (field, size) => field.Size = size);

[FsusFormFieldAdapterFor(typeof(FsusRadio))]
internal sealed class FsusRadioFieldAdapter(FsusRadio control)
  : FsusPropertyFieldAdapter<FsusRadio, bool?>(
    control, nameof(FsusRadio.IsChecked), "a boolean value",
    static field => field.IsChecked, static (field, value) => field.IsChecked = value,
    static (field, size) => field.Size = size);

[FsusFormFieldAdapterFor(typeof(FsusSwitch))]
internal sealed class FsusSwitchFieldAdapter(FsusSwitch control)
  : FsusPropertyFieldAdapter<FsusSwitch, bool?>(
    control, nameof(FsusSwitch.IsChecked), "a boolean value",
    static field => field.IsChecked, static (field, value) => field.IsChecked = value,
    static (field, size) => field.Size = size);

[FsusFormFieldAdapterFor(typeof(ToggleButton))]
internal sealed class ToggleButtonFieldAdapter(ToggleButton control)
  : FsusPropertyFieldAdapter<ToggleButton, bool?>(
    control, nameof(ToggleButton.IsChecked), "a boolean value",
    static field => field.IsChecked, static (field, value) => field.IsChecked = value);

[FsusFormFieldAdapterFor(typeof(ComboBox))]
internal sealed class ComboBoxFieldAdapter(ComboBox control)
  : FsusPropertyFieldAdapter<ComboBox, object?>(
    control, nameof(ComboBox.SelectedItem), "an object value",
    static field => field.SelectedItem, static (field, value) => field.SelectedItem = value);

[FsusFormFieldAdapterFor(typeof(FsusAutocomplete))]
internal sealed class FsusAutocompleteFieldAdapter(FsusAutocomplete control)
  : FsusBuiltInFieldAdapter<FsusAutocomplete>(control, static (field, size) => field.Size = size)
{
  public override FsusFormFieldReadResult ReadValue() =>
    FsusFormFieldReadResult.Success(Control.SelectedValue ?? Control.Text);

  public override FsusFormFieldAdapterResult TryResetValue(object? initialValue)
  {
    if (initialValue is string stringValue && Control.SelectValue(stringValue))
    {
      Control.SelectedValue = stringValue;
    }
    else if (initialValue is not null && Control.SelectValue(initialValue))
    {
      Control.SelectedValue = initialValue;
    }
    else
    {
      Control.SelectedValue = initialValue;
      Control.Text = initialValue?.ToString() ?? string.Empty;
    }

    return Success;
  }
}

internal abstract class FsusDateTimeFieldAdapter<TControl, TValue>(
  TControl control,
  string member,
  string expected,
  Func<TControl, TValue?> read,
  Action<TControl> clear,
  Func<TControl, TValue, bool> select,
  Func<TValue, string> unavailableMessage,
  Action<TControl, FsusComponentSize> applySize)
  : FsusBuiltInFieldAdapter<TControl>(control, applySize)
  where TControl : Control
  where TValue : struct
{
  public override FsusFormFieldReadResult ReadValue() =>
    FsusFormFieldReadResult.Success(read(Control));

  public override FsusFormFieldAdapterResult TryResetValue(object? initialValue)
  {
    if (initialValue is null)
    {
      clear(Control);
      return Success;
    }

    if (initialValue is not TValue value)
    {
      return Mismatch(initialValue, member, expected);
    }

    return select(Control, value)
      ? Success
      : Failure(FsusFormFieldAdapterErrorKind.InvalidOperation, unavailableMessage(value), member);
  }
}

[FsusFormFieldAdapterFor(typeof(FsusDatePicker))]
internal sealed class FsusDatePickerFieldAdapter(FsusDatePicker control)
  : FsusDateTimeFieldAdapter<FsusDatePicker, DateOnly>(
    control, nameof(FsusDatePicker.Value), "a DateOnly value",
    static field => field.Value, static field => field.ClearSelection(),
    static (field, value) => field.SelectDate(value),
    static date => $"The date {date:yyyy-MM-dd} is disabled and cannot be selected.",
    static (field, size) => field.Size = size);

[FsusFormFieldAdapterFor(typeof(FsusTimePicker))]
internal sealed class FsusTimePickerFieldAdapter(FsusTimePicker control)
  : FsusDateTimeFieldAdapter<FsusTimePicker, TimeOnly>(
    control, nameof(FsusTimePicker.Value), "a TimeOnly value",
    static field => field.Value, static field => field.ClearSelection(),
    static (field, value) => field.SelectTime(value),
    static time => $"The time {time:HH:mm} is disabled and cannot be selected.",
    static (field, size) => field.Size = size);

[FsusFormFieldAdapterFor(typeof(FsusTimeSelect))]
internal sealed class FsusTimeSelectFieldAdapter(FsusTimeSelect control)
  : FsusDateTimeFieldAdapter<FsusTimeSelect, TimeOnly>(
    control, nameof(FsusTimeSelect.Value), "a TimeOnly value",
    static field => field.Value, static field => field.ClearSelection(),
    static (field, value) => field.SelectTime(value),
    static time => $"The time {time:HH:mm} is not available and cannot be selected.",
    static (field, size) => field.Size = size);
