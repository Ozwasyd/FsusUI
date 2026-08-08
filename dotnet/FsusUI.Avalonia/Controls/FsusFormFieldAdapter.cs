using Avalonia;
using Avalonia.Controls;
using Avalonia.Controls.Primitives;
using System;

namespace FsusUI.Avalonia.Controls;

/// <summary>Capabilities a form field adapter declares for a hosted control.</summary>
[Flags]
public enum FsusFormFieldAdapterCapabilities
{
  None = 0,
  ReadValue = 1,
  WriteValue = 2,
  ResetValue = 4,
  ApplySize = 8,
  ApplyInvalidState = 16,
}

/// <summary>Stable error categories returned by form field adapters.</summary>
public enum FsusFormFieldAdapterErrorKind
{
  UnsupportedControl,
  TypeMismatch,
  ReadOnly,
  MissingCapability,
  InvalidOperation,
}

/// <summary>
/// A locatable adapter error. <see cref="ControlType"/> identifies the hosted
/// control and <see cref="MemberName"/> the property that failed, when known.
/// </summary>
public sealed record FsusFormFieldAdapterError(
  FsusFormFieldAdapterErrorKind Kind,
  string Message,
  Type? ControlType = null,
  string? MemberName = null)
{
  public override string ToString() =>
    $"{Kind}: {Message}{(ControlType is null ? string.Empty : $" (control={ControlType.Name})")}{(MemberName is null ? string.Empty : $" (member={MemberName})")}";
}

/// <summary>Stable success/failure result for value, size and validation-state operations.</summary>
public sealed class FsusFormFieldAdapterResult
{
  public static FsusFormFieldAdapterResult Success { get; } = new(true, null);

  public bool IsSuccess { get; }

  public FsusFormFieldAdapterError? Error { get; }

  private FsusFormFieldAdapterResult(bool isSuccess, FsusFormFieldAdapterError? error)
  {
    IsSuccess = isSuccess;
    Error = error;
  }

  public static FsusFormFieldAdapterResult Failure(FsusFormFieldAdapterError error) =>
    new(false, error ?? throw new ArgumentNullException(nameof(error)));

  public FsusFormFieldAdapterResult RequireSuccess(string operation)
  {
    if (!IsSuccess)
    {
      throw new InvalidOperationException(
        $"{operation} failed: {Error}");
    }

    return this;
  }
}

/// <summary>Stable read result combining the current value with its status.</summary>
public sealed record FsusFormFieldReadResult(
  object? Value,
  FsusFormFieldAdapterResult Status)
{
  public static FsusFormFieldReadResult Success(object? value) =>
    new(value, FsusFormFieldAdapterResult.Success);

  public static FsusFormFieldReadResult Failure(FsusFormFieldAdapterError error) =>
    new(null, FsusFormFieldAdapterResult.Failure(error));
}

/// <summary>
/// Minimal, strongly typed runtime adapter contract used by
/// <see cref="FsusFormItem"/> to read, write, reset, size and mark invalid a
/// hosted field control. Third-party controls provide an implementation
/// explicitly through <see cref="FsusFormItem.FieldAdapter"/> or the attached
/// <see cref="FsusFormFieldAdapter.AdapterProperty"/>.
/// </summary>
public interface IFsusFormFieldAdapter
{
  FsusFormFieldAdapterCapabilities Capabilities { get; }

  FsusFormFieldReadResult ReadValue();

  FsusFormFieldAdapterResult TryWriteValue(object? value);

  FsusFormFieldAdapterResult TryResetValue(object? initialValue);

  FsusFormFieldAdapterResult TryApplySize(FsusComponentSize size);

  FsusFormFieldAdapterResult TryApplyInvalidState(bool isInvalid);
}

/// <summary>
/// Attached-property entry point for third-party controls to register an
/// explicit <see cref="IFsusFormFieldAdapter"/> on the hosted control itself.
/// </summary>
public class FsusFormFieldAdapter
{
  public static readonly AttachedProperty<IFsusFormFieldAdapter?> AdapterProperty =
    AvaloniaProperty.RegisterAttached<FsusFormFieldAdapter, Control, IFsusFormFieldAdapter?>(
      nameof(AdapterProperty));

  private FsusFormFieldAdapter()
  {
  }

  public static IFsusFormFieldAdapter? GetAdapter(Control control) =>
    control.GetValue(AdapterProperty);

  public static void SetAdapter(Control control, IFsusFormFieldAdapter? adapter) =>
    control.SetValue(AdapterProperty, adapter);
}

/// <summary>
/// Internal typed adapter for controls shipped with FsusUI.Avalonia. It is a
/// stopgap until the generator-owned mapping lands; it never reflects and
/// never guesses property names.
/// </summary>
internal sealed class FsusBuiltInFormFieldAdapter : IFsusFormFieldAdapter
{
  private readonly Control control;
  private readonly FsusFormFieldAdapterCapabilities capabilities;

  private FsusBuiltInFormFieldAdapter(
    Control control,
    FsusFormFieldAdapterCapabilities capabilities)
  {
    this.control = control;
    this.capabilities = capabilities;
  }

  public static bool TryResolve(Control control, out IFsusFormFieldAdapter adapter)
  {
    var capabilities = ResolveCapabilities(control);
    if (capabilities == FsusFormFieldAdapterCapabilities.None)
    {
      adapter = null!;
      return false;
    }

    adapter = new FsusBuiltInFormFieldAdapter(control, capabilities);
    return true;
  }

  public FsusFormFieldAdapterCapabilities Capabilities => capabilities;

  public FsusFormFieldReadResult ReadValue()
  {
    if (!capabilities.HasFlag(FsusFormFieldAdapterCapabilities.ReadValue))
    {
      return FsusFormFieldReadResult.Failure(
        Error(FsusFormFieldAdapterErrorKind.MissingCapability, "read value", "Value"));
    }

    return FsusFormFieldReadResult.Success(control switch
    {
      FsusInput input => input.Text,
      TextBox textBox => textBox.Text,
      FsusCheckbox checkbox => checkbox.IsChecked,
      FsusRadio radio => radio.IsChecked,
      FsusSwitch fsusSwitch => fsusSwitch.IsChecked,
      ToggleButton toggleButton => toggleButton.IsChecked,
      ComboBox comboBox => comboBox.SelectedItem,
      FsusDatePicker datePicker => datePicker.Value,
      FsusTimePicker timePicker => timePicker.Value,
      FsusTimeSelect timeSelect => timeSelect.Value,
      _ => throw new InvalidOperationException(
        $"Resolved built-in adapter cannot read {control.GetType().Name}."),
    });
  }

  public FsusFormFieldAdapterResult TryWriteValue(object? value)
  {
    if (!capabilities.HasFlag(FsusFormFieldAdapterCapabilities.WriteValue))
    {
      return FsusFormFieldAdapterResult.Failure(
        Error(FsusFormFieldAdapterErrorKind.ReadOnly, "write value", "Value"));
    }

    switch (control)
    {
      case FsusInput input:
        return WriteText(input, nameof(TextBox.Text), value, text => input.Text = text);
      case TextBox textBox:
        return WriteText(textBox, nameof(TextBox.Text), value, text => textBox.Text = text);
      case FsusCheckbox checkbox:
        return WriteChecked(checkbox, nameof(ToggleButton.IsChecked), value, isChecked => checkbox.IsChecked = isChecked);
      case FsusRadio radio:
        return WriteChecked(radio, nameof(ToggleButton.IsChecked), value, isChecked => radio.IsChecked = isChecked);
      case FsusSwitch fsusSwitch:
        return WriteChecked(fsusSwitch, nameof(ToggleButton.IsChecked), value, isChecked => fsusSwitch.IsChecked = isChecked);
      case ToggleButton toggleButton:
        return WriteChecked(toggleButton, nameof(ToggleButton.IsChecked), value, isChecked => toggleButton.IsChecked = isChecked);
      case ComboBox comboBox:
        comboBox.SelectedItem = value;
        return FsusFormFieldAdapterResult.Success;
      default:
        return FsusFormFieldAdapterResult.Failure(
          Error(FsusFormFieldAdapterErrorKind.UnsupportedControl, "write value", "Value"));
    }
  }

  public FsusFormFieldAdapterResult TryResetValue(object? initialValue)
  {
    if (!capabilities.HasFlag(FsusFormFieldAdapterCapabilities.ResetValue))
    {
      return FsusFormFieldAdapterResult.Failure(
        Error(FsusFormFieldAdapterErrorKind.MissingCapability, "reset value", "Value"));
    }

    return TryWriteValue(initialValue);
  }

  public FsusFormFieldAdapterResult TryApplySize(FsusComponentSize size)
  {
    if (!capabilities.HasFlag(FsusFormFieldAdapterCapabilities.ApplySize))
    {
      return FsusFormFieldAdapterResult.Failure(
        Error(FsusFormFieldAdapterErrorKind.MissingCapability, "apply size", "Size"));
    }

    switch (control)
    {
      case FsusInput input:
        input.Size = size;
        return FsusFormFieldAdapterResult.Success;
      case FsusCheckbox checkbox:
        checkbox.Size = size;
        return FsusFormFieldAdapterResult.Success;
      case FsusRadio radio:
        radio.Size = size;
        return FsusFormFieldAdapterResult.Success;
      case FsusSwitch fsusSwitch:
        fsusSwitch.Size = size;
        return FsusFormFieldAdapterResult.Success;
      case FsusDatePicker datePicker:
        datePicker.Size = size;
        return FsusFormFieldAdapterResult.Success;
      case FsusTimePicker timePicker:
        timePicker.Size = size;
        return FsusFormFieldAdapterResult.Success;
      case FsusTimeSelect timeSelect:
        timeSelect.Size = size;
        return FsusFormFieldAdapterResult.Success;
      default:
        return FsusFormFieldAdapterResult.Failure(
          Error(FsusFormFieldAdapterErrorKind.MissingCapability, "apply size", "Size"));
    }
  }

  public FsusFormFieldAdapterResult TryApplyInvalidState(bool isInvalid)
  {
    if (!capabilities.HasFlag(FsusFormFieldAdapterCapabilities.ApplyInvalidState))
    {
      return FsusFormFieldAdapterResult.Failure(
        Error(FsusFormFieldAdapterErrorKind.MissingCapability, "apply invalid state", "IsInvalid"));
    }

    if (control is FsusInput input)
    {
      input.IsInvalid = isInvalid;
      return FsusFormFieldAdapterResult.Success;
    }

    return FsusFormFieldAdapterResult.Failure(
      Error(FsusFormFieldAdapterErrorKind.MissingCapability, "apply invalid state", "IsInvalid"));
  }

  private static FsusFormFieldAdapterCapabilities ResolveCapabilities(Control control) =>
    control switch
    {
      FsusInput => FsusFormFieldAdapterCapabilities.ReadValue |
        FsusFormFieldAdapterCapabilities.WriteValue |
        FsusFormFieldAdapterCapabilities.ResetValue |
        FsusFormFieldAdapterCapabilities.ApplySize |
        FsusFormFieldAdapterCapabilities.ApplyInvalidState,
      TextBox => FsusFormFieldAdapterCapabilities.ReadValue |
        FsusFormFieldAdapterCapabilities.WriteValue |
        FsusFormFieldAdapterCapabilities.ResetValue,
      FsusCheckbox or FsusRadio or FsusSwitch => FsusFormFieldAdapterCapabilities.ReadValue |
        FsusFormFieldAdapterCapabilities.WriteValue |
        FsusFormFieldAdapterCapabilities.ResetValue |
        FsusFormFieldAdapterCapabilities.ApplySize,
      ToggleButton => FsusFormFieldAdapterCapabilities.ReadValue |
        FsusFormFieldAdapterCapabilities.WriteValue |
        FsusFormFieldAdapterCapabilities.ResetValue,
      ComboBox => FsusFormFieldAdapterCapabilities.ReadValue |
        FsusFormFieldAdapterCapabilities.WriteValue |
        FsusFormFieldAdapterCapabilities.ResetValue,
      FsusDatePicker or FsusTimePicker or FsusTimeSelect =>
        FsusFormFieldAdapterCapabilities.ReadValue |
        FsusFormFieldAdapterCapabilities.ApplySize,
      _ => FsusFormFieldAdapterCapabilities.None,
    };

  private static FsusFormFieldAdapterResult WriteText(
    TextBox textBox,
    string memberName,
    object? value,
    Action<string?> write)
  {
    if (value is not null && value is not string)
    {
      return FsusFormFieldAdapterResult.Failure(
        new FsusFormFieldAdapterError(
          FsusFormFieldAdapterErrorKind.TypeMismatch,
          $"Expected a string value but received {value.GetType().Name}.",
          textBox.GetType(),
          memberName));
    }

    write((string?)value);
    return FsusFormFieldAdapterResult.Success;
  }

  private static FsusFormFieldAdapterResult WriteChecked(
    ToggleButton toggleButton,
    string memberName,
    object? value,
    Action<bool?> write)
  {
    if (value is not null && value is not bool)
    {
      return FsusFormFieldAdapterResult.Failure(
        new FsusFormFieldAdapterError(
          FsusFormFieldAdapterErrorKind.TypeMismatch,
          $"Expected a boolean value but received {value.GetType().Name}.",
          toggleButton.GetType(),
          memberName));
    }

    write((bool?)value);
    return FsusFormFieldAdapterResult.Success;
  }

  private FsusFormFieldAdapterError Error(
    FsusFormFieldAdapterErrorKind kind,
    string operation,
    string memberName) =>
    new(
      kind,
      $"{control.GetType().Name} does not support {operation}.",
      control.GetType(),
      memberName);
}
