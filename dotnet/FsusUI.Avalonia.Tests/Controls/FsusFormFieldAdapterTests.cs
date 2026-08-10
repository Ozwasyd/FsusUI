using Avalonia.Controls;
using FsusUI.Avalonia.Controls;

namespace FsusUI.Avalonia.Tests.Controls;

public class FsusFormFieldAdapterTests
{
  [Fact]
  public async Task UnknownControlWithoutAdapterFailsClearlyInsteadOfGuessing()
  {
    var control = new GuessableControl { Text = "value" };
    var item = new FsusFormItem
    {
      FieldName = "guess",
      Label = "Guess",
      IsRequired = true,
      Content = control,
    };
    var form = new FsusForm();
    form.Children.Add(item);
    form.RefreshFormState();

    Assert.NotNull(item.FieldAdapterError);
    Assert.Equal(FsusFormFieldAdapterErrorKind.UnsupportedControl, item.FieldAdapterError!.Kind);
    Assert.Equal(typeof(GuessableControl), item.FieldAdapterError.ControlType);

    var result = await form.ValidateAsync();

    Assert.False(result.IsValid);
    Assert.Equal("guess", result.Errors[0].FieldName);
    Assert.Contains("cannot be validated", result.Errors[0].Message);
    Assert.Contains("No form field adapter", result.Errors[0].Message);
  }

  [Fact]
  public void ExplicitItemAdapterWinsOverGuessableControlAndBuiltInMapping()
  {
    var control = new GuessableControl { Text = "explicit" };
    var item = new FsusFormItem
    {
      FieldName = "name",
      Content = control,
      FieldAdapter = new TextFieldAdapter(control),
    };
    var form = new FsusForm();
    form.Children.Add(item);
    form.RefreshFormState();

    Assert.Null(item.FieldAdapterError);

    control.Text = "changed";
    item.ResetField();

    Assert.Equal("explicit", control.Text);
    Assert.Null(item.FieldAdapterError);
  }

  [Fact]
  public async Task AttachedAdapterOnFieldControlIsUsed()
  {
    var control = new GuessableControl { Text = "attached" };
    FsusFormFieldAdapter.SetAdapter(control, new TextFieldAdapter(control));
    var item = new FsusFormItem
    {
      FieldName = "name",
      Label = "Name",
      IsRequired = true,
      Content = control,
    };
    var form = new FsusForm();
    form.Children.Add(item);

    var result = await form.ValidateAsync();

    Assert.True(result.IsValid);
    Assert.Null(item.FieldAdapterError);
  }

  [Fact]
  public void ItemAdapterOverridesAttachedAdapterForCaptureAndReset()
  {
    var control = new GuessableControl { Text = "initial" };
    FsusFormFieldAdapter.SetAdapter(control, new FixedValueAdapter(control, "attached"));
    var item = new FsusFormItem
    {
      FieldName = "name",
      Content = control,
      FieldAdapter = new FixedValueAdapter(control, "item"),
    };
    var form = new FsusForm();
    form.Children.Add(item);
    form.RefreshFormState();

    control.Text = "changed";
    item.ResetField();

    Assert.Equal("item", control.Text);
    Assert.Null(item.FieldAdapterError);
  }

  [Fact]
  public void TypeMismatchWriteReturnsLocatableError()
  {
    var control = new GuessableControl { Text = "1" };
    var adapter = new NumericFieldAdapter(control);

    var result = adapter.TryWriteValue("not-a-number");

    Assert.False(result.IsSuccess);
    Assert.Equal(FsusFormFieldAdapterErrorKind.TypeMismatch, result.Error!.Kind);
    Assert.Equal(typeof(GuessableControl), result.Error.ControlType);
    Assert.Equal(nameof(GuessableControl.Text), result.Error.MemberName);
    Assert.Contains("System.Int32", result.Error.Message);
  }

  [Fact]
  public void ResetWithoutResetCapabilityFailsClearlyAndDoesNotMutate()
  {
    var control = new GuessableControl { Text = "original" };
    var item = new FsusFormItem
    {
      FieldName = "name",
      Content = control,
      FieldAdapter = new ReadOnlyAdapter(control),
    };
    var form = new FsusForm();
    form.Children.Add(item);
    form.RefreshFormState();

    Assert.NotNull(item.FieldAdapterError);
    Assert.Equal(FsusFormFieldAdapterErrorKind.MissingCapability, item.FieldAdapterError!.Kind);

    item.ResetField();

    Assert.Equal("original", control.Text);
    Assert.NotNull(item.FieldAdapterError);
    Assert.Equal(FsusFormFieldAdapterErrorKind.MissingCapability, item.FieldAdapterError!.Kind);
    Assert.Equal(typeof(GuessableControl), item.FieldAdapterError.ControlType);
    Assert.Equal(nameof(ReadOnlyAdapter.TryResetValue), item.FieldAdapterError.MemberName);
  }

  [Fact]
  public void UnknownControlResetIsNotSilent()
  {
    var control = new GuessableControl { Text = "original" };
    var item = new FsusFormItem { FieldName = "name", Content = control };
    var form = new FsusForm();
    form.Children.Add(item);
    form.RefreshFormState();

    Assert.Equal(FsusFormFieldAdapterErrorKind.UnsupportedControl, item.FieldAdapterError!.Kind);

    item.ResetField();

    Assert.Equal("original", control.Text);
    Assert.Equal(FsusFormFieldAdapterErrorKind.UnsupportedControl, item.FieldAdapterError!.Kind);
  }

  [Fact]
  public void ExplicitAdapterAppliesSizeWithoutControlMemberGuessing()
  {
    var control = new GuessableControl { Text = "a" };
    var item = new FsusFormItem
    {
      FieldName = "title",
      Content = control,
      FieldAdapter = new TextFieldAdapter(control),
    };
    var form = new FsusForm { Size = FsusComponentSize.Lg };
    form.Children.Add(item);
    form.RefreshFormState();

    Assert.Equal(FsusComponentSize.Lg, control.Size);
    Assert.Null(item.FieldAdapterError);
  }

  private sealed class GuessableControl : ContentControl
  {
    public string? Text { get; set; }

    public object? Value { get; set; }

    public object? SelectedValue { get; set; }

    public FsusComponentSize Size { get; set; } = FsusComponentSize.Md;
  }

  private sealed class TextFieldAdapter : IFsusFormFieldAdapter
  {
    private readonly GuessableControl control;

    public TextFieldAdapter(GuessableControl control)
    {
      this.control = control;
    }

    public FsusFormFieldAdapterCapabilities Capabilities =>
      FsusFormFieldAdapterCapabilities.ReadValue |
      FsusFormFieldAdapterCapabilities.WriteValue |
      FsusFormFieldAdapterCapabilities.ResetValue;

    public FsusFormFieldReadResult ReadValue() =>
      FsusFormFieldReadResult.Success(control.Text);

    public FsusFormFieldAdapterResult TryWriteValue(object? value)
    {
      if (value is not null && value is not string)
      {
        return FsusFormFieldAdapterResult.Failure(
          new FsusFormFieldAdapterError(
            FsusFormFieldAdapterErrorKind.TypeMismatch,
            $"Expected a string value but received {value.GetType().Name}.",
            typeof(GuessableControl),
            nameof(GuessableControl.Text)));
      }

      control.Text = (string?)value;
      return FsusFormFieldAdapterResult.Success;
    }

    public FsusFormFieldAdapterResult TryResetValue(object? initialValue) =>
      TryWriteValue(initialValue);

    public FsusFormFieldAdapterResult TryApplySize(FsusComponentSize size)
    {
      control.Size = size;
      return FsusFormFieldAdapterResult.Success;
    }

    public FsusFormFieldAdapterResult TryApplyInvalidState(bool isInvalid) =>
      FsusFormFieldAdapterResult.Success;
  }

  private sealed class FixedValueAdapter : IFsusFormFieldAdapter
  {
    private readonly GuessableControl control;
    private readonly string value;

    public FixedValueAdapter(GuessableControl control, string value)
    {
      this.control = control;
      this.value = value;
    }

    public FsusFormFieldAdapterCapabilities Capabilities =>
      FsusFormFieldAdapterCapabilities.ReadValue |
      FsusFormFieldAdapterCapabilities.WriteValue |
      FsusFormFieldAdapterCapabilities.ResetValue;

    public FsusFormFieldReadResult ReadValue() => FsusFormFieldReadResult.Success(value);

    public FsusFormFieldAdapterResult TryWriteValue(object? value) =>
      TryResetValue(value);

    public FsusFormFieldAdapterResult TryResetValue(object? initialValue)
    {
      control.Text = this.value;
      return FsusFormFieldAdapterResult.Success;
    }

    public FsusFormFieldAdapterResult TryApplySize(FsusComponentSize size) =>
      FsusFormFieldAdapterResult.Success;

    public FsusFormFieldAdapterResult TryApplyInvalidState(bool isInvalid) =>
      FsusFormFieldAdapterResult.Success;
  }

  private sealed class NumericFieldAdapter : IFsusFormFieldAdapter
  {
    private readonly GuessableControl control;

    public NumericFieldAdapter(GuessableControl control)
    {
      this.control = control;
    }

    public FsusFormFieldAdapterCapabilities Capabilities =>
      FsusFormFieldAdapterCapabilities.ReadValue |
      FsusFormFieldAdapterCapabilities.WriteValue |
      FsusFormFieldAdapterCapabilities.ResetValue;

    public FsusFormFieldReadResult ReadValue() =>
      FsusFormFieldReadResult.Success(
        int.TryParse(control.Text, out var parsed) ? parsed : null);

    public FsusFormFieldAdapterResult TryWriteValue(object? value)
    {
      if (value is not null && value is not int)
      {
        return FsusFormFieldAdapterResult.Failure(
          new FsusFormFieldAdapterError(
            FsusFormFieldAdapterErrorKind.TypeMismatch,
            $"Expected System.Int32 but received {value.GetType().Name}.",
            typeof(GuessableControl),
            nameof(GuessableControl.Text)));
      }

      control.Text = value?.ToString();
      return FsusFormFieldAdapterResult.Success;
    }

    public FsusFormFieldAdapterResult TryResetValue(object? initialValue) =>
      TryWriteValue(initialValue);

    public FsusFormFieldAdapterResult TryApplySize(FsusComponentSize size) =>
      FsusFormFieldAdapterResult.Success;

    public FsusFormFieldAdapterResult TryApplyInvalidState(bool isInvalid) =>
      FsusFormFieldAdapterResult.Success;
  }

  private sealed class ReadOnlyAdapter : IFsusFormFieldAdapter
  {
    private readonly GuessableControl control;

    public ReadOnlyAdapter(GuessableControl control)
    {
      this.control = control;
    }

    public FsusFormFieldAdapterCapabilities Capabilities =>
      FsusFormFieldAdapterCapabilities.ReadValue;

    public FsusFormFieldReadResult ReadValue() =>
      FsusFormFieldReadResult.Success(control.Text);

    public FsusFormFieldAdapterResult TryWriteValue(object? value) =>
      Missing(nameof(TryWriteValue), "write value");

    public FsusFormFieldAdapterResult TryResetValue(object? initialValue) =>
      Missing(nameof(TryResetValue), "reset value");

    public FsusFormFieldAdapterResult TryApplySize(FsusComponentSize size) =>
      Missing(nameof(TryApplySize), "apply size");

    public FsusFormFieldAdapterResult TryApplyInvalidState(bool isInvalid) =>
      Missing(nameof(TryApplyInvalidState), "apply invalid state");

    private FsusFormFieldAdapterResult Missing(string member, string operation) =>
      FsusFormFieldAdapterResult.Failure(
        new FsusFormFieldAdapterError(
          FsusFormFieldAdapterErrorKind.MissingCapability,
          $"{control.GetType().Name} does not support {operation}.",
          control.GetType(),
          member));
  }
}
