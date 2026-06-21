using Avalonia;
using Avalonia.Automation;
using Avalonia.Automation.Peers;
using Avalonia.Controls;
using Avalonia.Input;

namespace FsusUI.Avalonia.Controls;

public sealed class FsusCheckboxValueChangedEventArgs(
  bool? oldValue,
  bool? newValue,
  object? itemValue) : EventArgs
{
  public bool? OldValue { get; } = oldValue;

  public bool? NewValue { get; } = newValue;

  public object? ItemValue { get; } = itemValue;
}

public sealed class FsusSwitchValueChangedEventArgs(
  bool oldValue,
  bool newValue) : EventArgs
{
  public bool OldValue { get; } = oldValue;

  public bool NewValue { get; } = newValue;
}

public sealed class FsusSelectionChangedEventArgs(
  IReadOnlyList<object?> oldValue,
  IReadOnlyList<object?> newValue) : EventArgs
{
  public IReadOnlyList<object?> OldValue { get; } = oldValue;

  public IReadOnlyList<object?> NewValue { get; } = newValue;
}

public sealed class FsusRadioSelectionChangedEventArgs(
  object? oldValue,
  object? newValue) : EventArgs
{
  public object? OldValue { get; } = oldValue;

  public object? NewValue { get; } = newValue;
}

public class FsusCheckbox : CheckBox
{
  public static readonly StyledProperty<object?> ItemValueProperty =
    AvaloniaProperty.Register<FsusCheckbox, object?>(nameof(ItemValue));

  public static readonly StyledProperty<FsusComponentSize> SizeProperty =
    AvaloniaProperty.Register<FsusCheckbox, FsusComponentSize>(
      nameof(Size),
      FsusComponentSize.Md);

  public static readonly StyledProperty<bool> IsLoadingProperty =
    AvaloniaProperty.Register<FsusCheckbox, bool>(nameof(IsLoading));

  public static readonly StyledProperty<string?> AccessibleNameProperty =
    AvaloniaProperty.Register<FsusCheckbox, string?>(nameof(AccessibleName));

  private bool? enabledBeforeLoading;
  private bool suppressGroupCallback;

  internal FsusCheckboxGroup? OwnerGroup { get; set; }

  public FsusCheckbox()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-checkbox");
    SyncClasses();
    SyncAutomation();
  }

  public event EventHandler<FsusCheckboxValueChangedEventArgs>? ValueChanged;

  public object? ItemValue
  {
    get => GetValue(ItemValueProperty);
    set => SetValue(ItemValueProperty, value);
  }

  public FsusComponentSize Size
  {
    get => GetValue(SizeProperty);
    set => SetValue(SizeProperty, value);
  }

  public bool IsLoading
  {
    get => GetValue(IsLoadingProperty);
    set => SetValue(IsLoadingProperty, value);
  }

  public string? AccessibleName
  {
    get => GetValue(AccessibleNameProperty);
    set => SetValue(AccessibleNameProperty, value);
  }

  public bool IsIndeterminate
  {
    get => IsChecked is null;
    set
    {
      if (value)
      {
        IsThreeState = true;
        IsChecked = null;
        return;
      }

      if (IsChecked is null)
      {
        IsChecked = false;
      }
    }
  }

  public void ToggleValue()
  {
    if (!CanToggle())
    {
      return;
    }

    IsChecked = IsChecked switch
    {
      true => false,
      false => true,
      _ => true,
    };
  }

  protected bool HandleKey(Key key)
  {
    if (key != Key.Space)
    {
      return false;
    }

    ToggleValue();
    return true;
  }

  internal void SetCheckedFromGroup(bool? isChecked)
  {
    suppressGroupCallback = true;
    IsChecked = isChecked;
    suppressGroupCallback = false;
  }

  protected override void OnClick()
  {
    if (!CanToggle())
    {
      return;
    }

    base.OnClick();
  }

  protected override void OnKeyDown(KeyEventArgs e)
  {
    if (HandleKey(e.Key))
    {
      e.Handled = true;
      return;
    }

    base.OnKeyDown(e);
  }

  protected override void OnPropertyChanged(AvaloniaPropertyChangedEventArgs change)
  {
    base.OnPropertyChanged(change);

    if (
      change.Property == SizeProperty ||
      change.Property == IsLoadingProperty ||
      change.Property == IsEnabledProperty ||
      change.Property == IsCheckedProperty ||
      change.Property == IsThreeStateProperty ||
      change.Property == IsKeyboardFocusWithinProperty)
    {
      SyncClasses();
    }

    if (
      change.Property == AccessibleNameProperty ||
      change.Property == IsLoadingProperty)
    {
      SyncAutomation();
    }

    if (change.Property == IsCheckedProperty)
    {
      SyncAutomation();
      var oldValue = ToNullableBool(change.OldValue);
      var newValue = ToNullableBool(change.NewValue);
      ValueChanged?.Invoke(
        this,
        new FsusCheckboxValueChangedEventArgs(oldValue, newValue, ItemValue));

      if (!suppressGroupCallback)
      {
        OwnerGroup?.UpdateSelectionFromChild(this);
      }
    }
  }

  private bool CanToggle() => IsEnabled && !IsLoading;

  private void SyncClasses()
  {
    FsusComponentClasses.SyncSize(this, Size);
    FsusComponentClasses.Ensure(this, "fsus-checked", IsChecked == true);
    FsusComponentClasses.Ensure(this, "fsus-unchecked", IsChecked == false);
    FsusComponentClasses.Ensure(this, "fsus-indeterminate", IsChecked is null);
    FsusComponentClasses.Ensure(this, "fsus-disabled", !IsEnabled);
    FsusComponentClasses.Ensure(this, "fsus-loading", IsLoading);
    FsusComponentClasses.Ensure(this, "fsus-focus-visible", IsKeyboardFocusWithin);

    if (IsLoading)
    {
      enabledBeforeLoading ??= IsEnabled;
      IsEnabled = false;
      return;
    }

    if (enabledBeforeLoading.HasValue)
    {
      IsEnabled = enabledBeforeLoading.Value;
      enabledBeforeLoading = null;
    }
  }

  private void SyncAutomation()
  {
    if (!string.IsNullOrWhiteSpace(AccessibleName))
    {
      AutomationProperties.SetName(this, AccessibleName!);
    }

    AutomationProperties.SetAccessibilityView(this, AccessibilityView.Control);
    AutomationProperties.SetControlTypeOverride(
      this,
      AutomationControlType.CheckBox);
    AutomationProperties.SetItemStatus(this, ResolveCheckedStatus(IsChecked));
  }

  private static string ResolveCheckedStatus(bool? value) =>
    value switch
    {
      true => "checked",
      false => "unchecked",
      _ => "indeterminate",
    };

  private static bool? ToNullableBool(object? value) =>
    value is bool boolValue ? boolValue : null;
}

public class FsusCheckboxGroup : StackPanel
{
  public static readonly StyledProperty<IReadOnlyList<object?>> SelectedValuesProperty =
    AvaloniaProperty.Register<FsusCheckboxGroup, IReadOnlyList<object?>>(
      nameof(SelectedValues),
      Array.Empty<object?>());

  public static readonly StyledProperty<FsusComponentSize> SizeProperty =
    AvaloniaProperty.Register<FsusCheckboxGroup, FsusComponentSize>(
      nameof(Size),
      FsusComponentSize.Md);

  private bool isSyncingChildren;
  private readonly Dictionary<FsusCheckbox, bool> enabledBeforeGroupDisabled = [];

  public FsusCheckboxGroup()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-checkbox-group");
    Spacing = 6;
    Children.CollectionChanged += (_, _) => RefreshGroupState();
    SyncClasses();
  }

  public event EventHandler<FsusSelectionChangedEventArgs>? SelectionChanged;

  public IReadOnlyList<object?> SelectedValues
  {
    get => GetValue(SelectedValuesProperty);
    set => SetValue(SelectedValuesProperty, NormalizeSelectedValues(value));
  }

  public FsusComponentSize Size
  {
    get => GetValue(SizeProperty);
    set => SetValue(SizeProperty, value);
  }

  public void SetSelectedValues(IEnumerable<object?> values)
  {
    SelectedValues = NormalizeSelectedValues(values);
  }

  public void RefreshGroupState()
  {
    SyncClasses();
    SyncChildrenFromValues();
  }

  internal void UpdateSelectionFromChild(FsusCheckbox checkbox)
  {
    if (isSyncingChildren || !checkbox.IsEnabled || checkbox.IsLoading)
    {
      SyncChildrenFromValues();
      return;
    }

    SelectedValues = NormalizeSelectedValues(
      Children
        .OfType<FsusCheckbox>()
        .Where(child => child.IsChecked == true)
        .Select(child => child.ItemValue));
  }

  protected override void OnPropertyChanged(AvaloniaPropertyChangedEventArgs change)
  {
    base.OnPropertyChanged(change);

    if (
      change.Property == SelectedValuesProperty &&
      change.OldValue is IReadOnlyList<object?> oldValue &&
      change.NewValue is IReadOnlyList<object?> newValue)
    {
      SyncChildrenFromValues();
      if (!oldValue.SequenceEqual(newValue))
      {
        SelectionChanged?.Invoke(
          this,
          new FsusSelectionChangedEventArgs(oldValue, newValue));
      }
    }

    if (
      change.Property == SizeProperty ||
      change.Property == IsEnabledProperty)
    {
      RefreshGroupState();
    }
  }

  private IReadOnlyList<object?> NormalizeSelectedValues(
    IEnumerable<object?> values)
  {
    var requested = values.ToArray();
    return Children
      .OfType<FsusCheckbox>()
      .Where(child => requested.Any(value => Equals(value, child.ItemValue)))
      .Select(child => child.ItemValue)
      .ToArray();
  }

  private void SyncChildrenFromValues()
  {
    isSyncingChildren = true;
    var checkboxes = Children.OfType<FsusCheckbox>().ToArray();
    for (var index = 0; index < checkboxes.Length; index++)
    {
      var checkbox = checkboxes[index];
      checkbox.OwnerGroup = this;
      checkbox.Size = Size;
      checkbox.SetCheckedFromGroup(
        SelectedValues.Any(value => Equals(value, checkbox.ItemValue)));
      FsusComponentClasses.Ensure(checkbox, "fsus-grouped", true);
      FsusComponentClasses.Ensure(checkbox, "fsus-group-first", index == 0);
      FsusComponentClasses.Ensure(
        checkbox,
        "fsus-group-last",
        index == checkboxes.Length - 1);
      FsusComponentClasses.Ensure(
        checkbox,
        "fsus-disabled",
        !IsEnabled || !checkbox.IsEnabled);
      if (!IsEnabled)
      {
        enabledBeforeGroupDisabled.TryAdd(checkbox, checkbox.IsEnabled);
        checkbox.IsEnabled = false;
      }
      else if (enabledBeforeGroupDisabled.Remove(checkbox, out var wasEnabled))
      {
        checkbox.IsEnabled = wasEnabled;
      }
      AutomationProperties.SetPositionInSet(checkbox, index + 1);
      AutomationProperties.SetSizeOfSet(checkbox, checkboxes.Length);
    }
    isSyncingChildren = false;
  }

  private void SyncClasses()
  {
    FsusComponentClasses.SyncSize(this, Size);
    FsusComponentClasses.Ensure(this, "fsus-disabled", !IsEnabled);
  }
}

public class FsusRadio : RadioButton
{
  public static readonly StyledProperty<object?> ItemValueProperty =
    AvaloniaProperty.Register<FsusRadio, object?>(nameof(ItemValue));

  public static readonly StyledProperty<FsusComponentSize> SizeProperty =
    AvaloniaProperty.Register<FsusRadio, FsusComponentSize>(
      nameof(Size),
      FsusComponentSize.Md);

  public static readonly StyledProperty<bool> IsLoadingProperty =
    AvaloniaProperty.Register<FsusRadio, bool>(nameof(IsLoading));

  public static readonly StyledProperty<string?> AccessibleNameProperty =
    AvaloniaProperty.Register<FsusRadio, string?>(nameof(AccessibleName));

  private bool? enabledBeforeLoading;
  private bool suppressGroupCallback;

  internal FsusRadioGroup? OwnerGroup { get; set; }

  public FsusRadio()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-radio");
    SyncClasses();
    SyncAutomation();
  }

  public object? ItemValue
  {
    get => GetValue(ItemValueProperty);
    set => SetValue(ItemValueProperty, value);
  }

  public FsusComponentSize Size
  {
    get => GetValue(SizeProperty);
    set => SetValue(SizeProperty, value);
  }

  public bool IsLoading
  {
    get => GetValue(IsLoadingProperty);
    set => SetValue(IsLoadingProperty, value);
  }

  public string? AccessibleName
  {
    get => GetValue(AccessibleNameProperty);
    set => SetValue(AccessibleNameProperty, value);
  }

  public void SelectValue()
  {
    if (!CanSelect())
    {
      return;
    }

    if (OwnerGroup is not null)
    {
      OwnerGroup.SelectChild(this);
      return;
    }

    IsChecked = true;
  }

  protected bool HandleKey(Key key)
  {
    switch (key)
    {
      case Key.Space:
        SelectValue();
        return true;
      case Key.Left:
      case Key.Up:
        OwnerGroup?.SelectAdjacent(this, -1);
        return OwnerGroup is not null;
      case Key.Right:
      case Key.Down:
        OwnerGroup?.SelectAdjacent(this, 1);
        return OwnerGroup is not null;
      case Key.Home:
        OwnerGroup?.SelectFirst();
        return OwnerGroup is not null;
      case Key.End:
        OwnerGroup?.SelectLast();
        return OwnerGroup is not null;
      default:
        return false;
    }
  }

  internal void SetCheckedFromGroup(bool isChecked)
  {
    suppressGroupCallback = true;
    IsChecked = isChecked;
    suppressGroupCallback = false;
  }

  protected override void OnClick()
  {
    if (!CanSelect())
    {
      return;
    }

    SelectValue();
    base.OnClick();
  }

  protected override void OnKeyDown(KeyEventArgs e)
  {
    if (HandleKey(e.Key))
    {
      e.Handled = true;
      return;
    }

    base.OnKeyDown(e);
  }

  protected override void OnPropertyChanged(AvaloniaPropertyChangedEventArgs change)
  {
    base.OnPropertyChanged(change);

    if (
      change.Property == SizeProperty ||
      change.Property == IsLoadingProperty ||
      change.Property == IsEnabledProperty ||
      change.Property == IsCheckedProperty ||
      change.Property == IsKeyboardFocusWithinProperty)
    {
      SyncClasses();
    }

    if (
      change.Property == AccessibleNameProperty ||
      change.Property == IsLoadingProperty)
    {
      SyncAutomation();
    }

    if (change.Property == IsCheckedProperty)
    {
      SyncAutomation();
      if (
        !suppressGroupCallback &&
        IsChecked == true &&
        OwnerGroup is not null)
      {
        OwnerGroup.SelectChild(this);
      }
    }
  }

  private bool CanSelect() => IsEnabled && !IsLoading;

  private void SyncClasses()
  {
    FsusComponentClasses.SyncSize(this, Size);
    FsusComponentClasses.Ensure(this, "fsus-checked", IsChecked == true);
    FsusComponentClasses.Ensure(this, "fsus-unchecked", IsChecked != true);
    FsusComponentClasses.Ensure(this, "fsus-disabled", !IsEnabled);
    FsusComponentClasses.Ensure(this, "fsus-loading", IsLoading);
    FsusComponentClasses.Ensure(this, "fsus-focus-visible", IsKeyboardFocusWithin);

    if (IsLoading)
    {
      enabledBeforeLoading ??= IsEnabled;
      IsEnabled = false;
      return;
    }

    if (enabledBeforeLoading.HasValue)
    {
      IsEnabled = enabledBeforeLoading.Value;
      enabledBeforeLoading = null;
    }
  }

  private void SyncAutomation()
  {
    if (!string.IsNullOrWhiteSpace(AccessibleName))
    {
      AutomationProperties.SetName(this, AccessibleName!);
    }

    AutomationProperties.SetAccessibilityView(this, AccessibilityView.Control);
    AutomationProperties.SetControlTypeOverride(
      this,
      AutomationControlType.RadioButton);
    AutomationProperties.SetItemStatus(
      this,
      IsChecked == true ? "checked" : "unchecked");
  }
}

public class FsusRadioGroup : StackPanel
{
  public static readonly StyledProperty<object?> SelectedValueProperty =
    AvaloniaProperty.Register<FsusRadioGroup, object?>(nameof(SelectedValue));

  public static readonly StyledProperty<FsusComponentSize> SizeProperty =
    AvaloniaProperty.Register<FsusRadioGroup, FsusComponentSize>(
      nameof(Size),
      FsusComponentSize.Md);

  private bool isSyncingChildren;
  private readonly Dictionary<FsusRadio, bool> enabledBeforeGroupDisabled = [];

  public FsusRadioGroup()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-radio-group");
    Spacing = 6;
    Children.CollectionChanged += (_, _) => RefreshGroupState();
    SyncClasses();
  }

  public event EventHandler<FsusRadioSelectionChangedEventArgs>? SelectionChanged;

  public object? SelectedValue
  {
    get => GetValue(SelectedValueProperty);
    set => SetValue(SelectedValueProperty, value);
  }

  public FsusComponentSize Size
  {
    get => GetValue(SizeProperty);
    set => SetValue(SizeProperty, value);
  }

  public void RefreshGroupState()
  {
    SyncClasses();
    SyncChildrenFromValue();
  }

  public void SelectChild(FsusRadio radio)
  {
    if (isSyncingChildren || !radio.IsEnabled || radio.IsLoading)
    {
      SyncChildrenFromValue();
      return;
    }

    SelectedValue = radio.ItemValue;
  }

  public void SelectAdjacent(FsusRadio radio, int offset)
  {
    var radios = EnabledRadios().ToArray();
    var index = Array.IndexOf(radios, radio);
    if (index < 0 || radios.Length == 0)
    {
      return;
    }

    radios[(index + offset + radios.Length) % radios.Length].SelectValue();
  }

  public void SelectFirst()
  {
    EnabledRadios().FirstOrDefault()?.SelectValue();
  }

  public void SelectLast()
  {
    EnabledRadios().LastOrDefault()?.SelectValue();
  }

  protected override void OnPropertyChanged(AvaloniaPropertyChangedEventArgs change)
  {
    base.OnPropertyChanged(change);

    if (change.Property == SelectedValueProperty)
    {
      SyncChildrenFromValue();
      if (!Equals(change.OldValue, change.NewValue))
      {
        SelectionChanged?.Invoke(
          this,
          new FsusRadioSelectionChangedEventArgs(
            change.OldValue,
            change.NewValue));
      }
    }

    if (
      change.Property == SizeProperty ||
      change.Property == IsEnabledProperty)
    {
      RefreshGroupState();
    }
  }

  private IEnumerable<FsusRadio> EnabledRadios() =>
    Children.OfType<FsusRadio>().Where(radio => radio.IsEnabled && !radio.IsLoading);

  private void SyncChildrenFromValue()
  {
    isSyncingChildren = true;
    var radios = Children.OfType<FsusRadio>().ToArray();
    for (var index = 0; index < radios.Length; index++)
    {
      var radio = radios[index];
      radio.OwnerGroup = this;
      radio.Size = Size;
      radio.GroupName = $"fsus-radio-group-{GetHashCode()}";
      radio.SetCheckedFromGroup(Equals(SelectedValue, radio.ItemValue));
      FsusComponentClasses.Ensure(radio, "fsus-grouped", true);
      FsusComponentClasses.Ensure(radio, "fsus-group-first", index == 0);
      FsusComponentClasses.Ensure(
        radio,
        "fsus-group-last",
        index == radios.Length - 1);
      FsusComponentClasses.Ensure(
        radio,
        "fsus-disabled",
        !IsEnabled || !radio.IsEnabled);
      if (!IsEnabled)
      {
        enabledBeforeGroupDisabled.TryAdd(radio, radio.IsEnabled);
        radio.IsEnabled = false;
      }
      else if (enabledBeforeGroupDisabled.Remove(radio, out var wasEnabled))
      {
        radio.IsEnabled = wasEnabled;
      }
      AutomationProperties.SetPositionInSet(radio, index + 1);
      AutomationProperties.SetSizeOfSet(radio, radios.Length);
    }
    isSyncingChildren = false;
  }

  private void SyncClasses()
  {
    FsusComponentClasses.SyncSize(this, Size);
    FsusComponentClasses.Ensure(this, "fsus-disabled", !IsEnabled);
  }
}

public class FsusSwitch : ToggleSwitch
{
  public static readonly StyledProperty<FsusComponentSize> SizeProperty =
    AvaloniaProperty.Register<FsusSwitch, FsusComponentSize>(
      nameof(Size),
      FsusComponentSize.Md);

  public static readonly StyledProperty<bool> IsLoadingProperty =
    AvaloniaProperty.Register<FsusSwitch, bool>(nameof(IsLoading));

  public static readonly StyledProperty<string?> AccessibleNameProperty =
    AvaloniaProperty.Register<FsusSwitch, string?>(nameof(AccessibleName));

  private bool? enabledBeforeLoading;

  public FsusSwitch()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-switch");
    SyncClasses();
    SyncAutomation();
  }

  public event EventHandler<FsusSwitchValueChangedEventArgs>? ValueChanged;

  public FsusComponentSize Size
  {
    get => GetValue(SizeProperty);
    set => SetValue(SizeProperty, value);
  }

  public bool IsLoading
  {
    get => GetValue(IsLoadingProperty);
    set => SetValue(IsLoadingProperty, value);
  }

  public string? AccessibleName
  {
    get => GetValue(AccessibleNameProperty);
    set => SetValue(AccessibleNameProperty, value);
  }

  public void ToggleValue()
  {
    if (!CanToggle())
    {
      return;
    }

    IsChecked = IsChecked != true;
  }

  protected bool HandleKey(Key key)
  {
    if (key != Key.Space)
    {
      return false;
    }

    ToggleValue();
    return true;
  }

  protected override void OnClick()
  {
    if (!CanToggle())
    {
      return;
    }

    base.OnClick();
  }

  protected override void OnKeyDown(KeyEventArgs e)
  {
    if (HandleKey(e.Key))
    {
      e.Handled = true;
      return;
    }

    base.OnKeyDown(e);
  }

  protected override void OnPropertyChanged(AvaloniaPropertyChangedEventArgs change)
  {
    base.OnPropertyChanged(change);

    if (
      change.Property == SizeProperty ||
      change.Property == IsLoadingProperty ||
      change.Property == IsEnabledProperty ||
      change.Property == IsCheckedProperty ||
      change.Property == IsKeyboardFocusWithinProperty)
    {
      SyncClasses();
    }

    if (
      change.Property == AccessibleNameProperty ||
      change.Property == IsLoadingProperty)
    {
      SyncAutomation();
    }

    if (change.Property == IsCheckedProperty)
    {
      SyncAutomation();
      var oldValue = ToBool(change.OldValue);
      var newValue = ToBool(change.NewValue);
      if (oldValue != newValue)
      {
        ValueChanged?.Invoke(
          this,
          new FsusSwitchValueChangedEventArgs(oldValue, newValue));
      }
    }
  }

  private bool CanToggle() => IsEnabled && !IsLoading;

  private void SyncClasses()
  {
    FsusComponentClasses.SyncSize(this, Size);
    FsusComponentClasses.Ensure(this, "fsus-checked", IsChecked == true);
    FsusComponentClasses.Ensure(this, "fsus-unchecked", IsChecked != true);
    FsusComponentClasses.Ensure(this, "fsus-on", IsChecked == true);
    FsusComponentClasses.Ensure(this, "fsus-off", IsChecked != true);
    FsusComponentClasses.Ensure(this, "fsus-disabled", !IsEnabled);
    FsusComponentClasses.Ensure(this, "fsus-loading", IsLoading);
    FsusComponentClasses.Ensure(this, "fsus-focus-visible", IsKeyboardFocusWithin);

    if (IsLoading)
    {
      enabledBeforeLoading ??= IsEnabled;
      IsEnabled = false;
      return;
    }

    if (enabledBeforeLoading.HasValue)
    {
      IsEnabled = enabledBeforeLoading.Value;
      enabledBeforeLoading = null;
    }
  }

  private void SyncAutomation()
  {
    if (!string.IsNullOrWhiteSpace(AccessibleName))
    {
      AutomationProperties.SetName(this, AccessibleName!);
    }

    AutomationProperties.SetAccessibilityView(this, AccessibilityView.Control);
    AutomationProperties.SetControlTypeOverride(this, AutomationControlType.Button);
    AutomationProperties.SetClassNameOverride(this, "Switch");
    AutomationProperties.SetItemStatus(
      this,
      IsLoading ? "loading" : IsChecked == true ? "checked" : "unchecked");
  }

  private static bool ToBool(object? value) => value is bool boolValue && boolValue;
}
