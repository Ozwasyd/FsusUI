# Form

Component ID: `form`

## Avalonia API

Use `FsusForm` and `FsusFormItem` for field registration, label placement,
sync and async validation, reset, validation clearing, and scroll-to-error
focus targeting.

## Vue Contract Mapping

Vue form models and rules map to public validation adapters and field names.
Slots map to `Content` inside `FsusFormItem`.

## Supported Platform Differences

Focus movement, scroll targeting, and accessible error relationships follow
`docs/avalonia/platform-differences.md`.

## Theme Tokens

Forms use text, muted text, danger, focus, border, density, and disabled theme
resources.

## Minimal Avalonia Example

```csharp
using FsusUI.Avalonia.Controls;

var form = new FsusForm();
form.Children.Add(new FsusFormItem
{
  FieldName = "email",
  Label = "Email",
  Content = new FsusInput { AccessibleName = "Email" },
});
```

## Field adapter contract

`FsusFormItem` reads, writes, resets, sizes and invalid-marks its hosted field
control exclusively through the `IFsusFormFieldAdapter` contract. The contract
is strongly typed: there is no reflection, no `dynamic`, no Activator, no
runtime expression compilation and no assembly scanning, and `FsusFormItem`
never guesses property names such as `SelectedValue`/`Value`/`Text`/`Size`.

### Operations and result types

- `ReadValue()` returns `FsusFormFieldReadResult` with the current value and
  its `FsusFormFieldAdapterResult` status.
- `TryWriteValue(object?)`, `TryResetValue(object?)`, `TryApplySize(...)` and
  `TryApplyInvalidState(...)` return `FsusFormFieldAdapterResult`.
- Failed operations carry a locatable `FsusFormFieldAdapterError` with a stable
  `FsusFormFieldAdapterErrorKind` (`UnsupportedControl`, `TypeMismatch`,
  `ReadOnly`, `MissingCapability`, `InvalidOperation`), the hosted control type
  and, when known, the failing member name.
- `FsusFormFieldAdapterCapabilities` declares which operations an adapter
  supports. Missing `ResetValue`/`ApplySize` capabilities produce a
  deterministic `MissingCapability` error instead of a silent no-op.

### Adapter resolution priority

1. `FsusFormItem.FieldAdapter` (explicit item-level adapter).
2. `FsusFormFieldAdapter.SetAdapter(control, adapter)` attached on the hosted
   control.
3. The internal typed mapping for controls shipped with FsusUI.Avalonia
   (`FsusInput`, `FsusTextarea`, `FsusInputNumber`, `TextBox`, `FsusCheckbox`,
   `FsusRadio`, `FsusSwitch`, `ToggleButton`, `ComboBox`, `FsusDatePicker`,
   `FsusTimePicker`, `FsusTimeSelect`). This stopgap mapping is owned by the
   later form generator; it is never reflection-based.
4. No adapter resolves: the operation fails with an `UnsupportedControl` error
   surfaced on `FsusFormItem.FieldAdapterError`, and required validation reports
   that the field cannot be validated. Nothing is silently ignored.

### Third-party controls

A third-party control implements `IFsusFormFieldAdapter` explicitly and either
sets it on the form item or attaches it to the control:

```csharp
public sealed class MyFieldAdapter : IFsusFormFieldAdapter
{
  private readonly MyControl control;

  public MyFieldAdapter(MyControl control) => this.control = control;

  public FsusFormFieldAdapterCapabilities Capabilities =>
    FsusFormFieldAdapterCapabilities.ReadValue |
    FsusFormFieldAdapterCapabilities.WriteValue |
    FsusFormFieldAdapterCapabilities.ResetValue;

  public FsusFormFieldReadResult ReadValue() =>
    FsusFormFieldReadResult.Success(control.Text);

  public FsusFormFieldAdapterResult TryWriteValue(object? value) { /* typed */ }
  public FsusFormFieldAdapterResult TryResetValue(object? initialValue) { /* typed */ }
  public FsusFormFieldAdapterResult TryApplySize(FsusComponentSize size) => FsusFormFieldAdapterResult.Success;
  public FsusFormFieldAdapterResult TryApplyInvalidState(bool isInvalid) => FsusFormFieldAdapterResult.Success;
}

var field = new FsusFormItem
{
  FieldName = "name",
  Content = control,
  FieldAdapter = new MyFieldAdapter(control),
};
```

Adapters are plain object references: `FsusFormItem` never owns or disposes
them, and it only uses the adapter while it hosts the field control. Setting
`FieldAdapter` re-captures the initial value immediately.

### Migration notes

- The previous fallback that read/wrote `SelectedValue`, `Value` and `Text` by
  name through reflection is removed. A control that relied on it must now
  provide an explicit adapter or be covered by a built-in mapping; otherwise
  the field fails with a locatable `UnsupportedControl` error.
- Invalid-state styling remains optional: an adapter without
  `ApplyInvalidState` is skipped benignly, while missing reset/size
  capabilities surface on `FieldAdapterError`.

## Known Limitations

Vue rule objects are not interpreted directly; adapt them to the public
validation callbacks.
