using Avalonia.Controls;
using Avalonia.Controls.Primitives;

namespace FsusUI.Avalonia.Controls;

[AttributeUsage(AttributeTargets.Class, AllowMultiple = false, Inherited = false)]
internal sealed class FsusFormFieldAdapterForAttribute : Attribute
{
  public FsusFormFieldAdapterForAttribute(Type controlType) => ControlType = controlType;

  public Type ControlType { get; }
}

internal abstract class FsusBuiltInFieldAdapter<TControl>(TControl control) : IFsusFormFieldAdapter
  where TControl : Control
{
  protected TControl Control { get; } = control;

  public abstract FsusFormFieldAdapterCapabilities Capabilities { get; }

  public abstract FsusFormFieldReadResult ReadValue();

  public abstract FsusFormFieldAdapterResult TryWriteValue(object? value);

  public abstract FsusFormFieldAdapterResult TryResetValue(object? initialValue);

  public virtual FsusFormFieldAdapterResult TryApplySize(FsusComponentSize size) =>
    Missing(nameof(TryApplySize), "apply size");

  public virtual FsusFormFieldAdapterResult TryApplyInvalidState(bool isInvalid) =>
    Missing(nameof(TryApplyInvalidState), "apply invalid state");

  protected FsusFormFieldAdapterResult Mismatch(object? value, string member, string expected) =>
    FsusFormFieldAdapterResult.Failure(
      new FsusFormFieldAdapterError(
        FsusFormFieldAdapterErrorKind.TypeMismatch,
        $"Expected {expected} but received {(value is null ? "null" : value.GetType().Name)}.",
        typeof(TControl),
        member));

  protected FsusFormFieldAdapterResult Missing(string member, string operation) =>
    FsusFormFieldAdapterResult.Failure(
      new FsusFormFieldAdapterError(
        FsusFormFieldAdapterErrorKind.MissingCapability,
        $"{typeof(TControl).Name} does not support {operation}.",
        typeof(TControl),
        member));

  protected FsusFormFieldAdapterResult Success => FsusFormFieldAdapterResult.Success;
}

[FsusFormFieldAdapterFor(typeof(FsusInput))]
internal sealed class FsusInputFieldAdapter(FsusInput control) : FsusBuiltInFieldAdapter<FsusInput>(control)
{
  public override FsusFormFieldAdapterCapabilities Capabilities =>
    FsusFormFieldAdapterCapabilities.ReadValue |
    FsusFormFieldAdapterCapabilities.WriteValue |
    FsusFormFieldAdapterCapabilities.ResetValue |
    FsusFormFieldAdapterCapabilities.ApplySize |
    FsusFormFieldAdapterCapabilities.ApplyInvalidState;

  public override FsusFormFieldReadResult ReadValue() =>
    FsusFormFieldReadResult.Success(Control.Text);

  public override FsusFormFieldAdapterResult TryWriteValue(object? value) =>
    TryResetValue(value);

  public override FsusFormFieldAdapterResult TryResetValue(object? initialValue)
  {
    if (initialValue is not null && initialValue is not string)
    {
      return Mismatch(initialValue, nameof(FsusInput.Text), "a string value");
    }

    Control.Text = (string?)initialValue;
    return Success;
  }

  public override FsusFormFieldAdapterResult TryApplySize(FsusComponentSize size)
  {
    Control.Size = size;
    return Success;
  }

  public override FsusFormFieldAdapterResult TryApplyInvalidState(bool isInvalid)
  {
    Control.IsInvalid = isInvalid;
    return Success;
  }
}

[FsusFormFieldAdapterFor(typeof(FsusTextarea))]
internal sealed class FsusTextareaFieldAdapter(FsusTextarea control) : FsusBuiltInFieldAdapter<FsusTextarea>(control)
{
  public override FsusFormFieldAdapterCapabilities Capabilities =>
    FsusFormFieldAdapterCapabilities.ReadValue |
    FsusFormFieldAdapterCapabilities.WriteValue |
    FsusFormFieldAdapterCapabilities.ResetValue |
    FsusFormFieldAdapterCapabilities.ApplySize |
    FsusFormFieldAdapterCapabilities.ApplyInvalidState;

  public override FsusFormFieldReadResult ReadValue() =>
    FsusFormFieldReadResult.Success(Control.Text);

  public override FsusFormFieldAdapterResult TryWriteValue(object? value) =>
    TryResetValue(value);

  public override FsusFormFieldAdapterResult TryResetValue(object? initialValue)
  {
    if (initialValue is not null && initialValue is not string)
    {
      return Mismatch(initialValue, nameof(FsusTextarea.Text), "a string value");
    }

    Control.Text = (string?)initialValue;
    return Success;
  }

  public override FsusFormFieldAdapterResult TryApplySize(FsusComponentSize size)
  {
    Control.Size = size;
    return Success;
  }

  public override FsusFormFieldAdapterResult TryApplyInvalidState(bool isInvalid)
  {
    Control.IsInvalid = isInvalid;
    return Success;
  }
}

[FsusFormFieldAdapterFor(typeof(FsusInputNumber))]
internal sealed class FsusInputNumberFieldAdapter(FsusInputNumber control) : FsusBuiltInFieldAdapter<FsusInputNumber>(control)
{
  public override FsusFormFieldAdapterCapabilities Capabilities =>
    FsusFormFieldAdapterCapabilities.ReadValue |
    FsusFormFieldAdapterCapabilities.WriteValue |
    FsusFormFieldAdapterCapabilities.ResetValue |
    FsusFormFieldAdapterCapabilities.ApplySize |
    FsusFormFieldAdapterCapabilities.ApplyInvalidState;

  public override FsusFormFieldReadResult ReadValue() =>
    FsusFormFieldReadResult.Success(Control.Value);

  public override FsusFormFieldAdapterResult TryWriteValue(object? value) =>
    TryResetValue(value);

  public override FsusFormFieldAdapterResult TryResetValue(object? initialValue)
  {
    if (initialValue is not null && initialValue is not decimal)
    {
      return Mismatch(initialValue, nameof(FsusInputNumber.Value), "a decimal value");
    }

    Control.Value = (decimal?)initialValue;
    return Success;
  }

  public override FsusFormFieldAdapterResult TryApplySize(FsusComponentSize size)
  {
    Control.Size = size;
    return Success;
  }

  public override FsusFormFieldAdapterResult TryApplyInvalidState(bool isInvalid)
  {
    Control.IsInvalid = isInvalid;
    return Success;
  }
}

[FsusFormFieldAdapterFor(typeof(TextBox))]
internal sealed class TextBoxFieldAdapter(TextBox control) : FsusBuiltInFieldAdapter<TextBox>(control)
{
  public override FsusFormFieldAdapterCapabilities Capabilities =>
    FsusFormFieldAdapterCapabilities.ReadValue |
    FsusFormFieldAdapterCapabilities.WriteValue |
    FsusFormFieldAdapterCapabilities.ResetValue;

  public override FsusFormFieldReadResult ReadValue() =>
    FsusFormFieldReadResult.Success(Control.Text);

  public override FsusFormFieldAdapterResult TryWriteValue(object? value) =>
    TryResetValue(value);

  public override FsusFormFieldAdapterResult TryResetValue(object? initialValue)
  {
    if (initialValue is not null && initialValue is not string)
    {
      return Mismatch(initialValue, nameof(TextBox.Text), "a string value");
    }

    Control.Text = (string?)initialValue;
    return Success;
  }
}

[FsusFormFieldAdapterFor(typeof(FsusCheckbox))]
internal sealed class FsusCheckboxFieldAdapter(FsusCheckbox control) : FsusBuiltInFieldAdapter<FsusCheckbox>(control)
{
  public override FsusFormFieldAdapterCapabilities Capabilities =>
    FsusFormFieldAdapterCapabilities.ReadValue |
    FsusFormFieldAdapterCapabilities.WriteValue |
    FsusFormFieldAdapterCapabilities.ResetValue |
    FsusFormFieldAdapterCapabilities.ApplySize;

  public override FsusFormFieldReadResult ReadValue() =>
    FsusFormFieldReadResult.Success(Control.IsChecked);

  public override FsusFormFieldAdapterResult TryWriteValue(object? value) =>
    TryResetValue(value);

  public override FsusFormFieldAdapterResult TryResetValue(object? initialValue)
  {
    if (initialValue is not null && initialValue is not bool)
    {
      return Mismatch(initialValue, nameof(FsusCheckbox.IsChecked), "a boolean value");
    }

    Control.IsChecked = (bool?)initialValue;
    return Success;
  }

  public override FsusFormFieldAdapterResult TryApplySize(FsusComponentSize size)
  {
    Control.Size = size;
    return Success;
  }
}

[FsusFormFieldAdapterFor(typeof(FsusRadio))]
internal sealed class FsusRadioFieldAdapter(FsusRadio control) : FsusBuiltInFieldAdapter<FsusRadio>(control)
{
  public override FsusFormFieldAdapterCapabilities Capabilities =>
    FsusFormFieldAdapterCapabilities.ReadValue |
    FsusFormFieldAdapterCapabilities.WriteValue |
    FsusFormFieldAdapterCapabilities.ResetValue |
    FsusFormFieldAdapterCapabilities.ApplySize;

  public override FsusFormFieldReadResult ReadValue() =>
    FsusFormFieldReadResult.Success(Control.IsChecked);

  public override FsusFormFieldAdapterResult TryWriteValue(object? value) =>
    TryResetValue(value);

  public override FsusFormFieldAdapterResult TryResetValue(object? initialValue)
  {
    if (initialValue is not null && initialValue is not bool)
    {
      return Mismatch(initialValue, nameof(FsusRadio.IsChecked), "a boolean value");
    }

    Control.IsChecked = (bool?)initialValue;
    return Success;
  }

  public override FsusFormFieldAdapterResult TryApplySize(FsusComponentSize size)
  {
    Control.Size = size;
    return Success;
  }
}

[FsusFormFieldAdapterFor(typeof(FsusSwitch))]
internal sealed class FsusSwitchFieldAdapter(FsusSwitch control) : FsusBuiltInFieldAdapter<FsusSwitch>(control)
{
  public override FsusFormFieldAdapterCapabilities Capabilities =>
    FsusFormFieldAdapterCapabilities.ReadValue |
    FsusFormFieldAdapterCapabilities.WriteValue |
    FsusFormFieldAdapterCapabilities.ResetValue |
    FsusFormFieldAdapterCapabilities.ApplySize;

  public override FsusFormFieldReadResult ReadValue() =>
    FsusFormFieldReadResult.Success(Control.IsChecked);

  public override FsusFormFieldAdapterResult TryWriteValue(object? value) =>
    TryResetValue(value);

  public override FsusFormFieldAdapterResult TryResetValue(object? initialValue)
  {
    if (initialValue is not null && initialValue is not bool)
    {
      return Mismatch(initialValue, nameof(FsusSwitch.IsChecked), "a boolean value");
    }

    Control.IsChecked = (bool?)initialValue;
    return Success;
  }

  public override FsusFormFieldAdapterResult TryApplySize(FsusComponentSize size)
  {
    Control.Size = size;
    return Success;
  }
}

[FsusFormFieldAdapterFor(typeof(ToggleButton))]
internal sealed class ToggleButtonFieldAdapter(ToggleButton control) : FsusBuiltInFieldAdapter<ToggleButton>(control)
{
  public override FsusFormFieldAdapterCapabilities Capabilities =>
    FsusFormFieldAdapterCapabilities.ReadValue |
    FsusFormFieldAdapterCapabilities.WriteValue |
    FsusFormFieldAdapterCapabilities.ResetValue;

  public override FsusFormFieldReadResult ReadValue() =>
    FsusFormFieldReadResult.Success(Control.IsChecked);

  public override FsusFormFieldAdapterResult TryWriteValue(object? value) =>
    TryResetValue(value);

  public override FsusFormFieldAdapterResult TryResetValue(object? initialValue)
  {
    if (initialValue is not null && initialValue is not bool)
    {
      return Mismatch(initialValue, nameof(ToggleButton.IsChecked), "a boolean value");
    }

    Control.IsChecked = (bool?)initialValue;
    return Success;
  }
}

[FsusFormFieldAdapterFor(typeof(ComboBox))]
internal sealed class ComboBoxFieldAdapter(ComboBox control) : FsusBuiltInFieldAdapter<ComboBox>(control)
{
  public override FsusFormFieldAdapterCapabilities Capabilities =>
    FsusFormFieldAdapterCapabilities.ReadValue |
    FsusFormFieldAdapterCapabilities.WriteValue |
    FsusFormFieldAdapterCapabilities.ResetValue;

  public override FsusFormFieldReadResult ReadValue() =>
    FsusFormFieldReadResult.Success(Control.SelectedItem);

  public override FsusFormFieldAdapterResult TryWriteValue(object? value) =>
    TryResetValue(value);

  public override FsusFormFieldAdapterResult TryResetValue(object? initialValue)
  {
    Control.SelectedItem = initialValue;
    return Success;
  }
}

[FsusFormFieldAdapterFor(typeof(FsusAutocomplete))]
internal sealed class FsusAutocompleteFieldAdapter(FsusAutocomplete control) : FsusBuiltInFieldAdapter<FsusAutocomplete>(control)
{
  public override FsusFormFieldAdapterCapabilities Capabilities =>
    FsusFormFieldAdapterCapabilities.ReadValue |
    FsusFormFieldAdapterCapabilities.WriteValue |
    FsusFormFieldAdapterCapabilities.ResetValue |
    FsusFormFieldAdapterCapabilities.ApplySize;

  public override FsusFormFieldReadResult ReadValue() =>
    FsusFormFieldReadResult.Success(Control.SelectedValue ?? Control.Text);

  public override FsusFormFieldAdapterResult TryWriteValue(object? value) =>
    TryResetValue(value);

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

  public override FsusFormFieldAdapterResult TryApplySize(FsusComponentSize size)
  {
    Control.Size = size;
    return Success;
  }
}

[FsusFormFieldAdapterFor(typeof(FsusDatePicker))]
internal sealed class FsusDatePickerFieldAdapter(FsusDatePicker control) : FsusBuiltInFieldAdapter<FsusDatePicker>(control)
{
  public override FsusFormFieldAdapterCapabilities Capabilities =>
    FsusFormFieldAdapterCapabilities.ReadValue |
    FsusFormFieldAdapterCapabilities.WriteValue |
    FsusFormFieldAdapterCapabilities.ResetValue |
    FsusFormFieldAdapterCapabilities.ApplySize;

  public override FsusFormFieldReadResult ReadValue() =>
    FsusFormFieldReadResult.Success(Control.Value);

  public override FsusFormFieldAdapterResult TryWriteValue(object? value) =>
    TryResetValue(value);

  public override FsusFormFieldAdapterResult TryResetValue(object? initialValue)
  {
    if (initialValue is null)
    {
      Control.ClearSelection();
      return Success;
    }

    if (initialValue is not DateOnly date)
    {
      return Mismatch(initialValue, nameof(FsusDatePicker.Value), "a DateOnly value");
    }

    return Control.SelectDate(date)
      ? Success
      : FsusFormFieldAdapterResult.Failure(
          new FsusFormFieldAdapterError(
            FsusFormFieldAdapterErrorKind.InvalidOperation,
            $"The date {date:yyyy-MM-dd} is disabled and cannot be selected.",
            typeof(FsusDatePicker),
            nameof(FsusDatePicker.Value)));
  }

  public override FsusFormFieldAdapterResult TryApplySize(FsusComponentSize size)
  {
    Control.Size = size;
    return Success;
  }
}

[FsusFormFieldAdapterFor(typeof(FsusTimePicker))]
internal sealed class FsusTimePickerFieldAdapter(FsusTimePicker control) : FsusBuiltInFieldAdapter<FsusTimePicker>(control)
{
  public override FsusFormFieldAdapterCapabilities Capabilities =>
    FsusFormFieldAdapterCapabilities.ReadValue |
    FsusFormFieldAdapterCapabilities.WriteValue |
    FsusFormFieldAdapterCapabilities.ResetValue |
    FsusFormFieldAdapterCapabilities.ApplySize;

  public override FsusFormFieldReadResult ReadValue() =>
    FsusFormFieldReadResult.Success(Control.Value);

  public override FsusFormFieldAdapterResult TryWriteValue(object? value) =>
    TryResetValue(value);

  public override FsusFormFieldAdapterResult TryResetValue(object? initialValue)
  {
    if (initialValue is null)
    {
      Control.ClearSelection();
      return Success;
    }

    if (initialValue is not TimeOnly time)
    {
      return Mismatch(initialValue, nameof(FsusTimePicker.Value), "a TimeOnly value");
    }

    return Control.SelectTime(time)
      ? Success
      : FsusFormFieldAdapterResult.Failure(
          new FsusFormFieldAdapterError(
            FsusFormFieldAdapterErrorKind.InvalidOperation,
            $"The time {time:HH:mm} is disabled and cannot be selected.",
            typeof(FsusTimePicker),
            nameof(FsusTimePicker.Value)));
  }

  public override FsusFormFieldAdapterResult TryApplySize(FsusComponentSize size)
  {
    Control.Size = size;
    return Success;
  }
}

[FsusFormFieldAdapterFor(typeof(FsusTimeSelect))]
internal sealed class FsusTimeSelectFieldAdapter(FsusTimeSelect control) : FsusBuiltInFieldAdapter<FsusTimeSelect>(control)
{
  public override FsusFormFieldAdapterCapabilities Capabilities =>
    FsusFormFieldAdapterCapabilities.ReadValue |
    FsusFormFieldAdapterCapabilities.WriteValue |
    FsusFormFieldAdapterCapabilities.ResetValue |
    FsusFormFieldAdapterCapabilities.ApplySize;

  public override FsusFormFieldReadResult ReadValue() =>
    FsusFormFieldReadResult.Success(Control.Value);

  public override FsusFormFieldAdapterResult TryWriteValue(object? value) =>
    TryResetValue(value);

  public override FsusFormFieldAdapterResult TryResetValue(object? initialValue)
  {
    if (initialValue is null)
    {
      Control.ClearSelection();
      return Success;
    }

    if (initialValue is not TimeOnly time)
    {
      return Mismatch(initialValue, nameof(FsusTimeSelect.Value), "a TimeOnly value");
    }

    return Control.SelectTime(time)
      ? Success
      : FsusFormFieldAdapterResult.Failure(
          new FsusFormFieldAdapterError(
            FsusFormFieldAdapterErrorKind.InvalidOperation,
            $"The time {time:HH:mm} is not available and cannot be selected.",
            typeof(FsusTimeSelect),
            nameof(FsusTimeSelect.Value)));
  }

  public override FsusFormFieldAdapterResult TryApplySize(FsusComponentSize size)
  {
    Control.Size = size;
    return Success;
  }
}
