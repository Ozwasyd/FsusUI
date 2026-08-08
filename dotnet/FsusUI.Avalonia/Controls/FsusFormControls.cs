using Avalonia;
using Avalonia.Automation;
using Avalonia.Controls;
using Avalonia.Controls.Primitives;
using Avalonia.Threading;

namespace FsusUI.Avalonia.Controls;

public enum FsusFormLabelPosition
{
  Right,
  Left,
  Top,
}

public enum FsusFormValidationState
{
  None,
  Validating,
  Success,
  Error,
}

public sealed record FsusFormValidationError(string FieldName, string Message);

public sealed class FsusFormValidationResult(
  bool isValid,
  IReadOnlyList<FsusFormValidationError> errors)
{
  public bool IsValid { get; } = isValid;

  public IReadOnlyList<FsusFormValidationError> Errors { get; } = errors;
}

public sealed class FsusFormFieldValidatedEventArgs(
  string fieldName,
  bool isValid,
  string message) : EventArgs
{
  public string FieldName { get; } = fieldName;

  public bool IsValid { get; } = isValid;

  public string Message { get; } = message;
}

public delegate string? FsusFormValidator(FsusFormItem field);

public delegate ValueTask<string?> FsusAsyncFormValidator(FsusFormItem field);

public class FsusForm : StackPanel
{
  public static readonly StyledProperty<FsusFormLabelPosition> LabelPositionProperty =
    AvaloniaProperty.Register<FsusForm, FsusFormLabelPosition>(
      nameof(LabelPosition),
      FsusFormLabelPosition.Right);

  public static readonly StyledProperty<FsusComponentSize> SizeProperty =
    AvaloniaProperty.Register<FsusForm, FsusComponentSize>(
      nameof(Size),
      FsusComponentSize.Md);

  public static readonly StyledProperty<bool> ScrollToErrorProperty =
    AvaloniaProperty.Register<FsusForm, bool>(nameof(ScrollToError));

  private readonly List<FsusFormItem> fields = [];

  public FsusForm()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-form");
    Spacing = 12;
    Children.CollectionChanged += (_, _) => RefreshFormState();
    SyncClasses();
  }

  public event EventHandler<FsusFormFieldValidatedEventArgs>? FieldValidated;

  public FsusFormLabelPosition LabelPosition
  {
    get => GetValue(LabelPositionProperty);
    set => SetValue(LabelPositionProperty, value);
  }

  public FsusComponentSize Size
  {
    get => GetValue(SizeProperty);
    set => SetValue(SizeProperty, value);
  }

  public bool ScrollToError
  {
    get => GetValue(ScrollToErrorProperty);
    set => SetValue(ScrollToErrorProperty, value);
  }

  public IReadOnlyList<FsusFormItem> Fields => fields;

  public FsusFormItem? LastScrollTarget { get; private set; }

  public async Task<FsusFormValidationResult> ValidateAsync()
  {
    RefreshFormState();
    var errors = new List<FsusFormValidationError>();
    foreach (var field in fields)
    {
      var error = await field.ValidateAsync();
      if (error is not null)
      {
        errors.Add(error);
      }
    }

    if (ScrollToError && errors.Count > 0)
    {
      ScrollToFirstError();
    }

    return new FsusFormValidationResult(errors.Count == 0, errors);
  }

  public async Task<FsusFormValidationResult> ValidateFieldAsync(string fieldName)
  {
    RefreshFormState();
    var errors = new List<FsusFormValidationError>();
    foreach (var field in fields.Where(field => field.FieldName == fieldName))
    {
      var error = await field.ValidateAsync();
      if (error is not null)
      {
        errors.Add(error);
      }
    }

    return new FsusFormValidationResult(errors.Count == 0, errors);
  }

  public void ResetFields(IEnumerable<string>? fieldNames = null)
  {
    foreach (var field in FilterFields(fieldNames))
    {
      field.ResetField();
    }
  }

  public void ClearValidation(IEnumerable<string>? fieldNames = null)
  {
    foreach (var field in FilterFields(fieldNames))
    {
      field.ClearValidation();
    }
  }

  public FsusFormItem? ScrollToFirstError()
  {
    foreach (var field in fields)
    {
      FsusComponentClasses.Ensure(field, "fsus-scroll-target", false);
    }

    LastScrollTarget = fields.FirstOrDefault(
      field => field.ValidationState == FsusFormValidationState.Error);
    if (LastScrollTarget is null)
    {
      return null;
    }

    FsusComponentClasses.Ensure(LastScrollTarget, "fsus-scroll-target", true);
    LastScrollTarget.FocusField();
    return LastScrollTarget;
  }

  public void RefreshFormState()
  {
    SyncClasses();
    var nextFields = Children
      .OfType<Control>()
      .SelectMany(CollectFields)
      .Where(field => !string.IsNullOrWhiteSpace(field.FieldName))
      .ToArray();

    foreach (var field in fields.Except(nextFields))
    {
      field.OwnerForm = null;
    }

    fields.Clear();
    fields.AddRange(nextFields);

    foreach (var field in fields)
    {
      field.OwnerForm = this;
      field.ApplyFormState(LabelPosition, Size, !IsEnabled);
    }
  }

  internal void NotifyFieldValidated(FsusFormItem field)
  {
    FieldValidated?.Invoke(
      this,
      new FsusFormFieldValidatedEventArgs(
        field.FieldName,
        field.ValidationState != FsusFormValidationState.Error,
        field.ErrorText));
  }

  protected override void OnPropertyChanged(AvaloniaPropertyChangedEventArgs change)
  {
    base.OnPropertyChanged(change);

    if (
      change.Property == LabelPositionProperty ||
      change.Property == SizeProperty ||
      change.Property == IsEnabledProperty)
    {
      RefreshFormState();
    }
  }

  private IEnumerable<FsusFormItem> FilterFields(IEnumerable<string>? fieldNames)
  {
    RefreshFormState();
    if (fieldNames is null)
    {
      return fields.ToArray();
    }

    var requested = fieldNames.ToArray();
    return fields.Where(field => requested.Contains(field.FieldName)).ToArray();
  }

  private static IEnumerable<FsusFormItem> CollectFields(Control control)
  {
    if (control is FsusFormItem formItem)
    {
      yield return formItem;
      yield break;
    }

    if (control is Panel panel)
    {
      foreach (var child in panel.Children.OfType<Control>())
      {
        foreach (var field in CollectFields(child))
        {
          yield return field;
        }
      }
    }

    if (control is ContentControl contentControl &&
      contentControl.Content is Control content)
    {
      foreach (var field in CollectFields(content))
      {
        yield return field;
      }
    }

    if (control is Decorator decorator && decorator.Child is Control decoratedChild)
    {
      foreach (var field in CollectFields(decoratedChild))
      {
        yield return field;
      }
    }
  }

  private void SyncClasses()
  {
    FsusComponentClasses.SyncSize(this, Size);
    FsusComponentClasses.Ensure(this, "fsus-disabled", !IsEnabled);
  }
}

public class FsusFormItem : ContentControl
{
  public static readonly StyledProperty<string> FieldNameProperty =
    AvaloniaProperty.Register<FsusFormItem, string>(nameof(FieldName), string.Empty);

  public static readonly StyledProperty<string> LabelProperty =
    AvaloniaProperty.Register<FsusFormItem, string>(nameof(Label), string.Empty);

  public static readonly StyledProperty<string> HelpTextProperty =
    AvaloniaProperty.Register<FsusFormItem, string>(nameof(HelpText), string.Empty);

  public static readonly StyledProperty<string> ErrorTextProperty =
    AvaloniaProperty.Register<FsusFormItem, string>(nameof(ErrorText), string.Empty);

  public static readonly StyledProperty<bool> IsRequiredProperty =
    AvaloniaProperty.Register<FsusFormItem, bool>(nameof(IsRequired));

  public static readonly StyledProperty<bool> ShowMessageProperty =
    AvaloniaProperty.Register<FsusFormItem, bool>(nameof(ShowMessage), true);

  public static readonly StyledProperty<bool> InlineMessageProperty =
    AvaloniaProperty.Register<FsusFormItem, bool>(nameof(InlineMessage));

  public static readonly StyledProperty<FsusFormLabelPosition?> LabelPositionProperty =
    AvaloniaProperty.Register<FsusFormItem, FsusFormLabelPosition?>(
      nameof(LabelPosition));

  public static readonly StyledProperty<FsusComponentSize?> SizeProperty =
    AvaloniaProperty.Register<FsusFormItem, FsusComponentSize?>(nameof(Size));

  public static readonly StyledProperty<FsusFormValidationState> ValidationStateProperty =
    AvaloniaProperty.Register<FsusFormItem, FsusFormValidationState>(
      nameof(ValidationState),
      FsusFormValidationState.None);

  public static readonly StyledProperty<FsusFormValidator?> ValidatorProperty =
    AvaloniaProperty.Register<FsusFormItem, FsusFormValidator?>(nameof(Validator));

  public static readonly StyledProperty<FsusAsyncFormValidator?> AsyncValidatorProperty =
    AvaloniaProperty.Register<FsusFormItem, FsusAsyncFormValidator?>(
      nameof(AsyncValidator));

  private bool initialValueCaptured;
  private object? initialValue;
  private bool? enabledBeforeFormDisabled;
  private bool? fieldEnabledBeforeFormDisabled;
  private FsusFormLabelPosition effectiveLabelPosition = FsusFormLabelPosition.Right;
  private FsusComponentSize effectiveSize = FsusComponentSize.Md;

  public FsusFormItem()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-form-item");
    SyncClasses();
  }

  public FsusForm? OwnerForm { get; internal set; }

  public string FieldName
  {
    get => GetValue(FieldNameProperty);
    set => SetValue(FieldNameProperty, value);
  }

  public string Label
  {
    get => GetValue(LabelProperty);
    set => SetValue(LabelProperty, value);
  }

  public string HelpText
  {
    get => GetValue(HelpTextProperty);
    set => SetValue(HelpTextProperty, value);
  }

  public string ErrorText
  {
    get => GetValue(ErrorTextProperty);
    set => SetValue(ErrorTextProperty, value);
  }

  public bool IsRequired
  {
    get => GetValue(IsRequiredProperty);
    set => SetValue(IsRequiredProperty, value);
  }

  public bool ShowMessage
  {
    get => GetValue(ShowMessageProperty);
    set => SetValue(ShowMessageProperty, value);
  }

  public bool InlineMessage
  {
    get => GetValue(InlineMessageProperty);
    set => SetValue(InlineMessageProperty, value);
  }

  public FsusFormLabelPosition? LabelPosition
  {
    get => GetValue(LabelPositionProperty);
    set => SetValue(LabelPositionProperty, value);
  }

  public FsusComponentSize? Size
  {
    get => GetValue(SizeProperty);
    set => SetValue(SizeProperty, value);
  }

  public FsusFormValidationState ValidationState
  {
    get => GetValue(ValidationStateProperty);
    set => SetValue(ValidationStateProperty, value);
  }

  public FsusFormValidator? Validator
  {
    get => GetValue(ValidatorProperty);
    set => SetValue(ValidatorProperty, value);
  }

  public FsusAsyncFormValidator? AsyncValidator
  {
    get => GetValue(AsyncValidatorProperty);
    set => SetValue(AsyncValidatorProperty, value);
  }

  private IFsusFormFieldAdapter? fieldAdapter;

  /// <summary>
  /// Explicit strongly typed adapter for the hosted field control. When set it
  /// wins over the attached <see cref="FsusFormFieldAdapter.AdapterProperty"/>
  /// and the built-in control mapping. FsusFormItem never owns or disposes the
  /// adapter; the reference is used only while this item hosts its field.
  /// </summary>
  public IFsusFormFieldAdapter? FieldAdapter
  {
    get => fieldAdapter;
    set
    {
      if (ReferenceEquals(fieldAdapter, value))
      {
        return;
      }

      fieldAdapter = value;
      initialValueCaptured = false;
      CaptureInitialValue();
      ApplySizeToField(effectiveSize);
    }
  }

  /// <summary>
  /// Last locatable adapter error (unsupported control, type mismatch, missing
  /// capability, ...). Cleared whenever an adapter operation succeeds. Unknown
  /// controls fail clearly through this property instead of silently no-op.
  /// </summary>
  public FsusFormFieldAdapterError? FieldAdapterError { get; private set; }

  public Control? FieldControl => Content as Control;

  public async ValueTask<FsusFormValidationError?> ValidateAsync()
  {
    var fieldName = await OnUiThreadAsync(() =>
    {
      CaptureInitialValue();
      SetValidationState(FsusFormValidationState.Validating, string.Empty);
      return FieldName;
    });
    var message = await OnUiThreadAsync(ResolveRequiredError);
    if (string.IsNullOrWhiteSpace(message) && Validator is not null)
    {
      message = await OnUiThreadAsync(() => Validator(this));
    }

    if (string.IsNullOrWhiteSpace(message) && AsyncValidator is not null)
    {
      message = await OnUiThreadAsync(async () => await AsyncValidator(this));
    }

    if (!string.IsNullOrWhiteSpace(message))
    {
      await OnUiThreadAsync(() =>
      {
        SetValidationState(FsusFormValidationState.Error, message!);
        OwnerForm?.NotifyFieldValidated(this);
      });
      return new FsusFormValidationError(fieldName, message!);
    }

    await OnUiThreadAsync(() =>
    {
      SetValidationState(FsusFormValidationState.Success, string.Empty);
      OwnerForm?.NotifyFieldValidated(this);
    });
    return null;
  }

  public void ResetField()
  {
    if (initialValueCaptured)
    {
      ResetFieldValue(initialValue);
    }

    ClearValidation();
  }

  public void ClearValidation()
  {
    SetValidationState(FsusFormValidationState.None, string.Empty);
  }

  public void FocusField()
  {
    FieldControl?.Focus();
  }

  internal void ApplyFormState(
    FsusFormLabelPosition formLabelPosition,
    FsusComponentSize formSize,
    bool disabledByForm)
  {
    effectiveLabelPosition = LabelPosition ?? formLabelPosition;
    effectiveSize = Size ?? formSize;
    ApplyDisabledState(disabledByForm);
    ApplySizeToField(effectiveSize);
    CaptureInitialValue();
    SyncClasses();
    SyncFieldAutomation();
  }

  protected override void OnPropertyChanged(AvaloniaPropertyChangedEventArgs change)
  {
    base.OnPropertyChanged(change);

    if (change.Property == ContentProperty)
    {
      initialValueCaptured = false;
      CaptureInitialValue();
      ApplySizeToField(effectiveSize);
      SyncFieldAutomation();
    }

    if (
      change.Property == FieldNameProperty ||
      change.Property == LabelProperty ||
      change.Property == HelpTextProperty ||
      change.Property == ErrorTextProperty ||
      change.Property == IsRequiredProperty ||
      change.Property == ShowMessageProperty ||
      change.Property == InlineMessageProperty ||
      change.Property == LabelPositionProperty ||
      change.Property == SizeProperty ||
      change.Property == ValidationStateProperty ||
      change.Property == IsEnabledProperty)
    {
      SyncClasses();
      SyncFieldAutomation();
    }

    if (change.Property == SizeProperty || change.Property == LabelPositionProperty)
    {
      OwnerForm?.RefreshFormState();
    }
  }

  private void SetValidationState(
    FsusFormValidationState state,
    string message)
  {
    ValidationState = state;
    ErrorText = message;
    ApplyInvalidStateToField(state == FsusFormValidationState.Error);
    SyncClasses();
    SyncFieldAutomation();
  }

  private string? ResolveRequiredError()
  {
    if (!IsRequired)
    {
      return null;
    }

    var read = GetFieldValue();
    if (!read.Status.IsSuccess)
    {
      var label = !string.IsNullOrWhiteSpace(Label) ? Label : FieldName;
      return $"{label} cannot be validated: {read.Status.Error!.Message}";
    }

    if (!IsEmptyFieldValue(read.Value))
    {
      return null;
    }

    var requiredLabel = !string.IsNullOrWhiteSpace(Label) ? Label : FieldName;
    return $"{requiredLabel} is required.";
  }

  private FsusFormFieldReadResult GetFieldValue()
  {
    var adapter = ResolveFieldAdapter();
    if (adapter is null)
    {
      var error = CreateUnsupportedAdapterError();
      SetFieldAdapterError(error);
      return FsusFormFieldReadResult.Failure(error);
    }

    var result = adapter.ReadValue();
    SetFieldAdapterError(result.Status.Error);
    return result;
  }

  private void ResetFieldValue(object? initialValue)
  {
    var adapter = ResolveFieldAdapter();
    if (adapter is null)
    {
      SetFieldAdapterError(CreateUnsupportedAdapterError());
      return;
    }

    SetFieldAdapterError(adapter.TryResetValue(initialValue).Error);
  }

  private void CaptureInitialValue()
  {
    if (initialValueCaptured || FieldControl is null)
    {
      return;
    }

    initialValue = GetFieldValue().Value;
    initialValueCaptured = true;
  }

  private IFsusFormFieldAdapter? ResolveFieldAdapter()
  {
    if (FieldAdapter is not null)
    {
      return FieldAdapter;
    }

    if (FieldControl is Control attachedControl &&
      FsusFormFieldAdapter.GetAdapter(attachedControl) is { } attached)
    {
      return attached;
    }

    if (FieldControl is Control control &&
      FsusBuiltInFormFieldAdapter.TryResolve(control, out var builtIn))
    {
      return builtIn;
    }

    return null;
  }

  private void SetFieldAdapterError(FsusFormFieldAdapterError? error)
  {
    if (ReferenceEquals(FieldAdapterError, error))
    {
      return;
    }

    FieldAdapterError = error;
  }

  private FsusFormFieldAdapterError CreateUnsupportedAdapterError()
  {
    var controlType = FieldControl?.GetType();
    return new FsusFormFieldAdapterError(
      FsusFormFieldAdapterErrorKind.UnsupportedControl,
      $"No form field adapter is registered for control type {controlType?.Name ?? "null"}. " +
      "Provide an IFsusFormFieldAdapter explicitly through FsusFormItem.FieldAdapter " +
      "or FsusFormFieldAdapter.SetAdapter.",
      controlType);
  }

  private static bool IsEmptyFieldValue(object? value) =>
    value switch
    {
      null => true,
      string text => string.IsNullOrWhiteSpace(text),
      bool boolValue => !boolValue,
      Array array => array.Length == 0,
      System.Collections.ICollection collection => collection.Count == 0,
      _ => false,
    };

  private void ApplyDisabledState(bool disabledByForm)
  {
    var fieldControl = FieldControl;
    if (disabledByForm)
    {
      enabledBeforeFormDisabled ??= IsEnabled;
      IsEnabled = false;
      if (fieldControl is not null)
      {
        fieldEnabledBeforeFormDisabled ??= fieldControl.IsEnabled;
        fieldControl.IsEnabled = false;
      }
      return;
    }

    if (enabledBeforeFormDisabled.HasValue)
    {
      IsEnabled = enabledBeforeFormDisabled.Value;
      enabledBeforeFormDisabled = null;
    }

    if (
      fieldControl is not null &&
      fieldEnabledBeforeFormDisabled.HasValue)
    {
      fieldControl.IsEnabled = fieldEnabledBeforeFormDisabled.Value;
      fieldEnabledBeforeFormDisabled = null;
    }
  }

  private void ApplySizeToField(FsusComponentSize size)
  {
    var control = FieldControl;
    if (control is null)
    {
      return;
    }

    var adapter = ResolveFieldAdapter();
    if (adapter is null)
    {
      SetFieldAdapterError(CreateUnsupportedAdapterError());
      return;
    }

    SetFieldAdapterError(adapter.TryApplySize(size).Error);
  }

  private void ApplyInvalidStateToField(bool isInvalid)
  {
    var adapter = ResolveFieldAdapter();
    if (adapter is null)
    {
      return;
    }

    var result = adapter.TryApplyInvalidState(isInvalid);
    if (result.Error?.Kind == FsusFormFieldAdapterErrorKind.MissingCapability)
    {
      return;
    }

    SetFieldAdapterError(result.Error);
  }

  private void SyncClasses()
  {
    FsusComponentClasses.SyncSize(this, effectiveSize);
    FsusComponentClasses.Ensure(this, "fsus-required", IsRequired);
    FsusComponentClasses.Ensure(this, "fsus-disabled", !IsEnabled);
    FsusComponentClasses.Ensure(this, "fsus-inline-message", InlineMessage);
    FsusComponentClasses.Ensure(this, "fsus-show-message", ShowMessage);
    FsusComponentClasses.Ensure(
      this,
      "fsus-label-left",
      effectiveLabelPosition == FsusFormLabelPosition.Left);
    FsusComponentClasses.Ensure(
      this,
      "fsus-label-right",
      effectiveLabelPosition == FsusFormLabelPosition.Right);
    FsusComponentClasses.Ensure(
      this,
      "fsus-label-top",
      effectiveLabelPosition == FsusFormLabelPosition.Top);
    FsusComponentClasses.Ensure(
      this,
      "fsus-validating",
      ValidationState == FsusFormValidationState.Validating);
    FsusComponentClasses.Ensure(
      this,
      "fsus-success",
      ValidationState == FsusFormValidationState.Success);
    FsusComponentClasses.Ensure(
      this,
      "fsus-error",
      ValidationState == FsusFormValidationState.Error);
  }

  private void SyncFieldAutomation()
  {
    if (FieldControl is not StyledElement field)
    {
      return;
    }

    if (!string.IsNullOrWhiteSpace(Label))
    {
      AutomationProperties.SetName(field, Label);
    }

    var helpParts = new[] { HelpText, ErrorText }
      .Where(value => !string.IsNullOrWhiteSpace(value));
    AutomationProperties.SetHelpText(field, string.Join(" ", helpParts));
    AutomationProperties.SetItemStatus(field, ValidationState switch
    {
      FsusFormValidationState.Validating => "validating",
      FsusFormValidationState.Success => "valid",
      FsusFormValidationState.Error => "invalid",
      _ => "none",
    });
  }

  private static async ValueTask<T> OnUiThreadAsync<T>(Func<T> action)
  {
    if (!ShouldInvokeOnDispatcher())
    {
      return action();
    }

    return await Dispatcher.UIThread.InvokeAsync(action);
  }

  private static async ValueTask<T> OnUiThreadAsync<T>(Func<ValueTask<T>> action)
  {
    if (!ShouldInvokeOnDispatcher())
    {
      return await action();
    }

    var completion = new TaskCompletionSource<T>(
      TaskCreationOptions.RunContinuationsAsynchronously);
    Dispatcher.UIThread.Post(async () =>
    {
      try
      {
        completion.SetResult(await action());
      }
      catch (Exception exception)
      {
        completion.SetException(exception);
      }
    });

    return await completion.Task;
  }

  private static async ValueTask OnUiThreadAsync(Action action)
  {
    if (!ShouldInvokeOnDispatcher())
    {
      action();
      return;
    }

    await Dispatcher.UIThread.InvokeAsync(action);
  }

  private static bool ShouldInvokeOnDispatcher() =>
    !Dispatcher.UIThread.CheckAccess() &&
    Application.Current?.ApplicationLifetime is not null;
}
