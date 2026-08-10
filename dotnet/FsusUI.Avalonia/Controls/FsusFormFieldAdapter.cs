using Avalonia;
using Avalonia.Controls;
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
      throw new InvalidOperationException($"{operation} failed: {Error}");
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
