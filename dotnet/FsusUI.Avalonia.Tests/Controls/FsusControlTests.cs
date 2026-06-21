using Avalonia.Automation;
using Avalonia.Automation.Peers;
using Avalonia.Controls;
using Avalonia.Input;
using Avalonia.Media;
using FsusUI.Avalonia.Controls;
using System.Windows.Input;

namespace FsusUI.Avalonia.Tests.Controls;

public class FsusControlTests
{
  [Fact]
  public void ButtonSyncsVariantSizeAndLoadingState()
  {
    var button = new FsusButton
    {
      Variant = FsusComponentVariant.Primary,
      Size = FsusComponentSize.Lg,
      IsLoading = true,
    };

    Assert.Contains("fsus-button", button.Classes);
    Assert.Contains("fsus-primary", button.Classes);
    Assert.Contains("fsus-size-lg", button.Classes);
    Assert.Contains("fsus-loading", button.Classes);
    Assert.False(button.IsEnabled);

    button.IsLoading = false;

    Assert.True(button.IsEnabled);
    Assert.DoesNotContain("fsus-loading", button.Classes);
  }

  [Fact]
  public void ButtonExposesProductionStateAndAutomationMetadata()
  {
    var button = new FsusButton
    {
      AccessibleName = "Save changes",
      CustomBackground = Brushes.Red,
      CustomForeground = Brushes.White,
      CustomBorderBrush = Brushes.Blue,
      IconPlacement = FsusButtonIconPlacement.Trailing,
      IsInlineAction = true,
      IsLink = true,
      IsPlain = true,
      IsRound = true,
      IsTextButton = true,
      MotionHooksEnabled = true,
      Size = FsusComponentSize.Sm,
      Variant = FsusComponentVariant.Success,
    };

    Assert.Equal("Save changes", AutomationProperties.GetName(button));
    Assert.Equal(Brushes.Red, button.Background);
    Assert.Equal(Brushes.White, button.Foreground);
    Assert.Equal(Brushes.Blue, button.BorderBrush);
    Assert.Contains("fsus-success", button.Classes);
    Assert.Contains("fsus-size-sm", button.Classes);
    Assert.Contains("fsus-icon-trailing", button.Classes);
    Assert.Contains("fsus-inline-action", button.Classes);
    Assert.Contains("fsus-link", button.Classes);
    Assert.Contains("fsus-plain", button.Classes);
    Assert.Contains("fsus-round", button.Classes);
    Assert.Contains("fsus-text-button", button.Classes);
    Assert.Contains("fsus-motion", button.Classes);
  }

  [Fact]
  public void LoadingButtonSuppressesClickAndCommandActivation()
  {
    var activated = 0;
    var clicked = 0;
    var command = new CountingCommand();
    var button = new ClickableButton
    {
      Command = command,
      IsLoading = true,
    };
    button.Activated += (_, _) => activated++;
    button.Click += (_, _) => clicked++;

    button.InvokeClick();

    Assert.Equal(0, activated);
    Assert.Equal(0, clicked);
    Assert.Equal(0, command.ExecuteCount);
    Assert.False(button.IsEnabled);

    button.IsLoading = false;
    button.InvokeClick();

    Assert.Equal(1, activated);
    Assert.Equal(1, clicked);
    Assert.Equal(1, command.ExecuteCount);
    Assert.True(button.IsEnabled);
  }

  [Fact]
  public void ButtonGroupAppliesMembershipAndRestoresDisabledChildren()
  {
    var first = new FsusButton();
    var middle = new FsusButton();
    var last = new FsusButton { IsEnabled = false };
    var group = new FsusButtonGroup
    {
      Size = FsusComponentSize.Lg,
      Variant = FsusComponentVariant.Primary,
    };
    group.Children.Add(first);
    group.Children.Add(middle);
    group.Children.Add(last);

    group.RefreshGroupState();

    Assert.Contains("fsus-button-group", group.Classes);
    Assert.Contains("fsus-grouped", first.Classes);
    Assert.Contains("fsus-group-first", first.Classes);
    Assert.Contains("fsus-group-middle", middle.Classes);
    Assert.Contains("fsus-group-last", last.Classes);
    Assert.Contains("fsus-size-lg", middle.Classes);
    Assert.Contains("fsus-primary", middle.Classes);
    Assert.False(last.IsEnabled);

    group.IsEnabled = false;
    group.RefreshGroupState();

    Assert.False(first.IsEnabled);
    Assert.False(middle.IsEnabled);
    Assert.False(last.IsEnabled);

    group.IsEnabled = true;
    group.RefreshGroupState();

    Assert.True(first.IsEnabled);
    Assert.True(middle.IsEnabled);
    Assert.False(last.IsEnabled);
  }

  [Fact]
  public void InputSyncsInvalidClearableAndSizeState()
  {
    var input = new FsusInput
    {
      IsInvalid = true,
      IsClearable = true,
      Size = FsusComponentSize.Sm,
    };

    Assert.Contains("fsus-input", input.Classes);
    Assert.Contains("fsus-invalid", input.Classes);
    Assert.Contains("fsus-clearable", input.Classes);
    Assert.Contains("fsus-size-sm", input.Classes);
  }

  [Fact]
  public void InputRaisesValueAndClearEventsWithAutomationMetadata()
  {
    var changes = new List<string?>();
    var validationStates = new List<bool>();
    var cleared = 0;
    var input = new FsusInput
    {
      AccessibleName = "Search articles",
      PrefixContent = "Query",
      SuffixContent = "⌘K",
      IsClearable = true,
      IsInvalid = true,
      Text = "draft",
    };
    input.ValueChanged += (_, args) => changes.Add(args.NewValue);
    input.ValidationStateChanged += (_, args) => validationStates.Add(args.IsInvalid);
    input.Cleared += (_, _) => cleared++;

    Assert.Contains("fsus-has-prefix", input.Classes);
    Assert.Contains("fsus-has-suffix", input.Classes);
    Assert.Contains("fsus-has-clear-affordance", input.Classes);
    Assert.NotNull(input.InnerLeftContent);
    var rightContent = Assert.IsType<StackPanel>(input.InnerRightContent);
    Assert.Contains(rightContent.Children, child => child is Button);
    Assert.Equal("Search articles", AutomationProperties.GetName(input));
    Assert.Equal(
      AutomationControlType.Edit,
      AutomationProperties.GetControlTypeOverride(input));

    input.ClearText();

    Assert.Equal(string.Empty, input.Text);
    Assert.Equal(1, cleared);
    Assert.Equal(new string?[] { string.Empty }, changes);

    input.IsInvalid = false;

    Assert.Equal(new[] { false }, validationStates);
  }

  [Fact]
  public void InputCompositionDefersValueChangedUntilCommit()
  {
    var changes = new List<string?>();
    var input = new FsusInput();
    input.ValueChanged += (_, args) => changes.Add(args.NewValue);

    input.BeginImeComposition();
    input.Text = "n";
    input.UpdateImeComposition("ni");

    Assert.Empty(changes);
    Assert.True(input.IsComposing);
    Assert.Contains("fsus-composing", input.Classes);

    input.CommitImeComposition("你");

    Assert.False(input.IsComposing);
    Assert.Equal("你", input.Text);
    Assert.Equal(new string?[] { "你" }, changes);
  }

  [Fact]
  public void InputClearRespectsReadonlyAndDisabledStates()
  {
    var input = new FsusInput
    {
      IsClearable = true,
      Text = "locked",
      IsReadOnly = true,
    };

    input.ClearText();

    Assert.Equal("locked", input.Text);
    Assert.Contains("fsus-readonly", input.Classes);

    input.IsReadOnly = false;
    input.IsEnabled = false;
    input.ClearText();

    Assert.Equal("locked", input.Text);
    Assert.Contains("fsus-disabled", input.Classes);
  }

  [Fact]
  public void TextareaUsesMultilineDefaults()
  {
    var cleared = 0;
    var textarea = new FsusTextarea
    {
      AccessibleName = "Comment body",
      IsClearable = true,
      Text = "First line\nSecond line",
    };
    textarea.Cleared += (_, _) => cleared++;

    Assert.True(textarea.AcceptsReturn);
    Assert.True(textarea.MinLines >= 3);
    Assert.Equal(TextWrapping.Wrap, textarea.TextWrapping);
    Assert.Contains("fsus-textarea", textarea.Classes);

    textarea.ClearText();

    Assert.Equal(string.Empty, textarea.Text);
    Assert.Equal(1, cleared);
  }

  [Fact]
  public void InputNumberClampsStepsAndSyncsTextAutomation()
  {
    var values = new List<decimal?>();
    var input = new FsusInputNumber
    {
      AccessibleName = "Quantity",
      Minimum = 0,
      Maximum = 10,
      Step = 2,
      Value = 4,
    };
    input.ValueChanged += (_, args) => values.Add(args.NewValue);

    Assert.Contains("fsus-input-number", input.Classes);
    Assert.Contains("fsus-has-spin-controls", input.Classes);
    var spinContent = Assert.IsType<StackPanel>(input.InnerRightContent);
    Assert.Equal(2, spinContent.Children.OfType<Button>().Count());
    Assert.Equal("Quantity", AutomationProperties.GetName(input));
    Assert.Equal(
      AutomationControlType.Spinner,
      AutomationProperties.GetControlTypeOverride(input));
    Assert.Equal("4", input.Text);

    input.Increment();
    input.Increment();
    input.Increment();
    input.Increment();

    Assert.Equal(10, input.Value);
    Assert.Equal("10", input.Text);

    input.Decrement();

    Assert.Equal(8, input.Value);
    Assert.Equal(new decimal?[] { 6, 8, 10, 8 }, values);

    input.Text = "-5";
    input.CommitText();

    Assert.Equal(0, input.Value);
    Assert.Equal("0", input.Text);
  }

  [Fact]
  public void CardDialogAndFeedbackControlsExposeStateClasses()
  {
    var card = new FsusCard { IsSelected = true };
    var dialog = new FsusDialog { IsLoading = true };
    var alert = new FsusAlert
    {
      Variant = FsusComponentVariant.Danger,
      IsDismissible = true,
    };

    Assert.Contains("fsus-selected", card.Classes);
    Assert.Contains("fsus-loading", dialog.Classes);
    Assert.Contains("fsus-danger", alert.Classes);
    Assert.Contains("fsus-dismissible", alert.Classes);
  }

  [Fact]
  public void NavigationAndSelectionControlsUseFsusClasses()
  {
    Assert.Contains("fsus-checkbox", new FsusCheckbox().Classes);
    Assert.Contains("fsus-radio", new FsusRadio().Classes);
    Assert.Contains("fsus-switch", new FsusSwitch().Classes);
    Assert.Contains("fsus-tabs", new FsusTabs().Classes);
    Assert.Contains("fsus-menu", new FsusMenu().Classes);
  }

  [Fact]
  public void InteractiveControlsKeepFocusableKeyboardBaseline()
  {
    Assert.True(new FsusButton().Focusable);
    Assert.True(new FsusInput().Focusable);
    Assert.True(new FsusCheckbox().Focusable);
    Assert.True(new FsusRadio().Focusable);
    Assert.True(new FsusSwitch().Focusable);
  }

  [Fact]
  public void CheckboxTogglesIndeterminateAndReportsAutomationState()
  {
    var changes = new List<bool?>();
    var checkbox = new KeyboardCheckbox
    {
      AccessibleName = "Accept terms",
      IsThreeState = true,
      IsIndeterminate = true,
      ItemValue = "terms",
    };
    checkbox.ValueChanged += (_, args) => changes.Add(args.NewValue);

    Assert.True(checkbox.IsChecked is null);
    Assert.Contains("fsus-indeterminate", checkbox.Classes);
    Assert.Equal("Accept terms", AutomationProperties.GetName(checkbox));
    Assert.Equal(
      AutomationControlType.CheckBox,
      AutomationProperties.GetControlTypeOverride(checkbox));
    Assert.Equal("indeterminate", AutomationProperties.GetItemStatus(checkbox));
    Assert.Equal("terms", checkbox.ItemValue);

    checkbox.Press(Key.Space);

    Assert.True(checkbox.IsChecked);
    Assert.False(checkbox.IsIndeterminate);
    Assert.Contains("fsus-checked", checkbox.Classes);
    Assert.Equal("checked", AutomationProperties.GetItemStatus(checkbox));
    Assert.Equal(new bool?[] { true }, changes);
  }

  [Fact]
  public void CheckboxGroupMaintainsDeterministicValueAndDisabledItems()
  {
    var changes = new List<IReadOnlyList<object?>>();
    var first = new KeyboardCheckbox { ItemValue = "alpha", Content = "Alpha" };
    var second = new KeyboardCheckbox { ItemValue = "beta", Content = "Beta" };
    var disabled = new KeyboardCheckbox
    {
      ItemValue = "gamma",
      Content = "Gamma",
      IsEnabled = false,
    };
    var group = new FsusCheckboxGroup();
    group.SelectionChanged += (_, args) => changes.Add(args.NewValue);
    group.Children.Add(first);
    group.Children.Add(second);
    group.Children.Add(disabled);

    group.SetSelectedValues(["beta", "missing", "alpha"]);

    Assert.Equal(new object?[] { "alpha", "beta" }, group.SelectedValues);
    Assert.True(first.IsChecked);
    Assert.True(second.IsChecked);
    Assert.False(disabled.IsChecked);

    first.Press(Key.Space);
    disabled.Press(Key.Space);

    Assert.Equal(new object?[] { "beta" }, group.SelectedValues);
    Assert.False(first.IsChecked);
    Assert.False(disabled.IsChecked);
    Assert.Equal(new object?[] { "beta" }, changes.Last());
  }

  [Fact]
  public void RadioGroupSupportsArrowNavigationAndValueBinding()
  {
    var changes = new List<object?>();
    var first = new KeyboardRadio { ItemValue = "draft", Content = "Draft" };
    var second = new KeyboardRadio { ItemValue = "review", Content = "Review" };
    var third = new KeyboardRadio
    {
      ItemValue = "published",
      Content = "Published",
      IsEnabled = false,
    };
    var group = new FsusRadioGroup { SelectedValue = "draft" };
    group.SelectionChanged += (_, args) => changes.Add(args.NewValue);
    group.Children.Add(first);
    group.Children.Add(second);
    group.Children.Add(third);
    group.RefreshGroupState();

    Assert.True(first.IsChecked);
    Assert.False(second.IsChecked);
    Assert.Equal("draft", group.SelectedValue);

    first.Press(Key.Right);

    Assert.False(first.IsChecked);
    Assert.True(second.IsChecked);
    Assert.False(third.IsChecked);
    Assert.Equal("review", group.SelectedValue);
    Assert.Equal(new object?[] { "review" }, changes);
    Assert.Equal(
      AutomationControlType.RadioButton,
      AutomationProperties.GetControlTypeOverride(second));
    Assert.Equal("checked", AutomationProperties.GetItemStatus(second));
  }

  [Fact]
  public void SwitchLoadingBlocksToggleAndRestoresEnabledState()
  {
    var changes = new List<bool>();
    var fsusSwitch = new KeyboardSwitch
    {
      AccessibleName = "Email alerts",
      IsChecked = false,
      IsLoading = true,
    };
    fsusSwitch.ValueChanged += (_, args) => changes.Add(args.NewValue);

    Assert.False(fsusSwitch.IsEnabled);
    Assert.Contains("fsus-loading", fsusSwitch.Classes);
    Assert.Equal("Email alerts", AutomationProperties.GetName(fsusSwitch));
    Assert.Equal(
      AutomationControlType.Button,
      AutomationProperties.GetControlTypeOverride(fsusSwitch));
    Assert.Equal("Switch", AutomationProperties.GetClassNameOverride(fsusSwitch));
    Assert.Equal("loading", AutomationProperties.GetItemStatus(fsusSwitch));

    fsusSwitch.Press(Key.Space);

    Assert.False(fsusSwitch.IsChecked);
    Assert.Empty(changes);

    fsusSwitch.IsLoading = false;
    fsusSwitch.Press(Key.Space);

    Assert.True(fsusSwitch.IsChecked);
    Assert.True(fsusSwitch.IsEnabled);
    Assert.Equal("checked", AutomationProperties.GetItemStatus(fsusSwitch));
    Assert.Equal(new[] { true }, changes);
  }

  [Fact]
  public async Task FormValidatesRequiredFieldsAndMapsAutomationMetadata()
  {
    var input = new FsusInput { Text = string.Empty };
    var item = new FsusFormItem
    {
      FieldName = "displayName",
      Label = "Display name",
      HelpText = "Shown publicly",
      IsRequired = true,
      Content = input,
    };
    var form = new FsusForm
    {
      LabelPosition = FsusFormLabelPosition.Top,
      Size = FsusComponentSize.Sm,
    };
    form.Children.Add(item);

    var result = await form.ValidateAsync();

    Assert.False(result.IsValid);
    Assert.Equal(new[] { "displayName" }, result.Errors.Select(error => error.FieldName));
    Assert.Equal(FsusFormValidationState.Error, item.ValidationState);
    Assert.Equal("Display name is required.", item.ErrorText);
    Assert.True(input.IsInvalid);
    Assert.Equal("Display name", AutomationProperties.GetName(input));
    Assert.Contains("Shown publicly", AutomationProperties.GetHelpText(input));
    Assert.Contains("fsus-label-top", item.Classes);
    Assert.Single(form.Fields);

    input.Text = "Ada";
    result = await form.ValidateAsync();

    Assert.True(result.IsValid);
    Assert.Equal(FsusFormValidationState.Success, item.ValidationState);
    Assert.False(input.IsInvalid);
    Assert.Equal("valid", AutomationProperties.GetItemStatus(input));
  }

  [Fact]
  public async Task FormSupportsAsyncValidationResetAndClearValidation()
  {
    var input = new FsusInput { Text = "taken" };
    var item = new FsusFormItem
    {
      FieldName = "slug",
      Label = "Profile slug",
      Content = input,
      AsyncValidator = field =>
      {
        var text = ((FsusInput)field.FieldControl!).Text;
        return new ValueTask<string?>(Task.FromResult(
          text == "taken" ? "Slug is already reserved." : null));
      },
    };
    var form = new FsusForm();
    form.Children.Add(item);

    var result = await form.ValidateAsync();

    Assert.False(result.IsValid);
    Assert.Equal(FsusFormValidationState.Error, item.ValidationState);
    Assert.Equal("Slug is already reserved.", item.ErrorText);

    item.ClearValidation();

    Assert.Equal(FsusFormValidationState.None, item.ValidationState);
    Assert.Equal(string.Empty, item.ErrorText);
    Assert.False(input.IsInvalid);

    input.Text = "available";
    result = await form.ValidateAsync();

    Assert.True(result.IsValid);

    input.Text = "changed";
    form.ResetFields();

    Assert.Equal("taken", input.Text);
    Assert.Equal(FsusFormValidationState.None, item.ValidationState);
  }

  [Fact]
  public void FormPropagatesDisabledAndSizeToSupportedControls()
  {
    var input = new FsusInput();
    var checkbox = new FsusCheckbox();
    var radio = new FsusRadio();
    var fsusSwitch = new FsusSwitch();
    var disabledInput = new FsusInput { IsEnabled = false };
    var form = new FsusForm
    {
      IsEnabled = false,
      Size = FsusComponentSize.Lg,
    };
    form.Children.Add(new FsusFormItem { FieldName = "title", Content = input });
    form.Children.Add(new FsusFormItem { FieldName = "accept", Content = checkbox });
    form.Children.Add(new FsusFormItem { FieldName = "mode", Content = radio });
    form.Children.Add(new FsusFormItem { FieldName = "alerts", Content = fsusSwitch });
    form.Children.Add(new FsusFormItem { FieldName = "locked", Content = disabledInput });

    form.RefreshFormState();

    Assert.All(new Control[] { input, checkbox, radio, fsusSwitch, disabledInput },
      control => Assert.False(control.IsEnabled));
    Assert.Equal(FsusComponentSize.Lg, input.Size);
    Assert.Equal(FsusComponentSize.Lg, checkbox.Size);
    Assert.Equal(FsusComponentSize.Lg, radio.Size);
    Assert.Equal(FsusComponentSize.Lg, fsusSwitch.Size);

    form.IsEnabled = true;
    form.RefreshFormState();

    Assert.True(input.IsEnabled);
    Assert.True(checkbox.IsEnabled);
    Assert.True(radio.IsEnabled);
    Assert.True(fsusSwitch.IsEnabled);
    Assert.False(disabledInput.IsEnabled);
  }

  [Fact]
  public async Task FormRegistrationCleanupAndScrollToErrorAreDeterministic()
  {
    var first = new FsusFormItem
    {
      FieldName = "first",
      Label = "First",
      IsRequired = true,
      Content = new FsusInput { Text = "ok" },
    };
    var second = new FsusFormItem
    {
      FieldName = "second",
      Label = "Second",
      IsRequired = true,
      Content = new FsusInput { Text = string.Empty },
    };
    var nested = new StackPanel();
    nested.Children.Add(first);
    nested.Children.Add(second);
    var form = new FsusForm { ScrollToError = true };
    form.Children.Add(nested);
    form.RefreshFormState();

    Assert.Equal(new[] { "first", "second" }, form.Fields.Select(field => field.FieldName));

    var result = await form.ValidateAsync();
    var scrollTarget = form.ScrollToFirstError();

    Assert.False(result.IsValid);
    Assert.Same(second, scrollTarget);
    Assert.Same(second, form.LastScrollTarget);
    Assert.Contains("fsus-scroll-target", second.Classes);

    nested.Children.Remove(second);
    form.RefreshFormState();

    Assert.Equal(new[] { "first" }, form.Fields.Select(field => field.FieldName));
    Assert.Null(second.OwnerForm);
  }

  [Fact]
  public void IconButtonRequiresAccessibleNameUnlessExplicitlyDecorative()
  {
    var named = new FsusIconButton { AccessibleName = "Open command palette" };

    Assert.Equal("Open command palette", AutomationProperties.GetName(named));
    Assert.Contains("fsus-semantic-icon", named.Classes);
    named.ValidateAccessibility();
    named.AccessibleName = null;
    Assert.Equal(string.Empty, AutomationProperties.GetName(named));
    Assert.DoesNotContain("fsus-semantic-icon", named.Classes);
    Assert.Throws<InvalidOperationException>(() => named.ValidateAccessibility());

    var decorative = new FsusIconButton { IsDecorativeIcon = true };

    Assert.Equal(AccessibilityView.Raw, AutomationProperties.GetAccessibilityView(decorative));
    Assert.Contains("fsus-decorative-icon", decorative.Classes);
    decorative.ValidateAccessibility();

    Assert.Throws<InvalidOperationException>(() =>
      new FsusIconButton().ValidateAccessibility());
  }

  [Fact]
  public void IconSyncsKeySizeAndAutomationMetadata()
  {
    var icon = new FsusIcon
    {
      IconKey = "FsusIconSearch",
      Size = FsusComponentSize.Lg,
      AccessibleName = "Search",
      IsDecorative = false,
    };

    Assert.Contains("fsus-icon", icon.Classes);
    Assert.Contains("fsus-size-lg", icon.Classes);
    Assert.Contains("fsus-semantic-icon", icon.Classes);
    Assert.Equal("FsusIconSearch", icon.IconKey);
    Assert.Equal("Search", AutomationProperties.GetName(icon));
    Assert.Equal(AccessibilityView.Control, AutomationProperties.GetAccessibilityView(icon));
    icon.ValidateAccessibility();

    icon.AccessibleName = null;

    Assert.Throws<InvalidOperationException>(() => icon.ValidateAccessibility());

    icon.IsDecorative = true;

    Assert.Equal(AccessibilityView.Raw, AutomationProperties.GetAccessibilityView(icon));
    Assert.Contains("fsus-decorative-icon", icon.Classes);
    icon.ValidateAccessibility();
  }

  [Fact]
  public void TextSyncsVariantsTruncationAndAutomationMetadata()
  {
    var text = new FsusText
    {
      Text = "Archive completed",
      Variant = FsusTextVariant.Monospace,
      IsTruncated = true,
      AccessibleName = "Archive status",
    };

    Assert.Contains("fsus-text-control", text.Classes);
    Assert.Contains("fsus-text-monospace", text.Classes);
    Assert.Contains("fsus-text-truncated", text.Classes);
    Assert.Equal(TextTrimming.CharacterEllipsis, text.TextTrimming);
    Assert.Equal(TextWrapping.NoWrap, text.TextWrapping);
    Assert.Equal("Archive status", AutomationProperties.GetName(text));

    text.Variant = FsusTextVariant.Strong;
    text.IsTruncated = false;

    Assert.Contains("fsus-text-strong", text.Classes);
    Assert.DoesNotContain("fsus-text-monospace", text.Classes);
    Assert.DoesNotContain("fsus-text-truncated", text.Classes);
    Assert.Equal(0, text.MaxLines);
    Assert.Equal(TextTrimming.None, text.TextTrimming);
  }

  [Fact]
  public void LinkActivatesCommandAndRoutedEventWithAutomationMetadata()
  {
    var activated = 0;
    var command = new CountingCommand();
    var link = new ClickableLink
    {
      Content = "Read release notes",
      AccessibleName = "Open release notes",
      NavigateUri = new Uri("https://example.test/releases"),
      Command = command,
    };
    link.Activated += (_, _) => activated++;

    Assert.True(link.Focusable);
    Assert.Contains("fsus-link-control", link.Classes);
    Assert.Contains("fsus-link", link.Classes);
    Assert.Contains("fsus-text-button", link.Classes);
    Assert.Equal("Open release notes", AutomationProperties.GetName(link));
    Assert.Equal(AccessibilityView.Control, AutomationProperties.GetAccessibilityView(link));
    Assert.Equal(
      AutomationControlType.Hyperlink,
      AutomationProperties.GetControlTypeOverride(link));

    link.InvokeClick();

    Assert.Equal(1, command.ExecuteCount);
    Assert.Equal(1, activated);

    link.IsEnabled = false;
    link.InvokeClick();

    Assert.Equal(1, command.ExecuteCount);
    Assert.Equal(1, activated);
    Assert.Contains("fsus-disabled", link.Classes);
  }

  private sealed class ClickableButton : FsusButton
  {
    public void InvokeClick() => OnClick();
  }

  private sealed class ClickableLink : FsusLink
  {
    public void InvokeClick() => OnClick();
  }

  private sealed class KeyboardCheckbox : FsusCheckbox
  {
    public void Press(Key key) => HandleKey(key);
  }

  private sealed class KeyboardRadio : FsusRadio
  {
    public void Press(Key key) => HandleKey(key);
  }

  private sealed class KeyboardSwitch : FsusSwitch
  {
    public void Press(Key key) => HandleKey(key);
  }

  private sealed class CountingCommand : ICommand
  {
    public int ExecuteCount { get; private set; }

    public event EventHandler? CanExecuteChanged
    {
      add { }
      remove { }
    }

    public bool CanExecute(object? parameter) => true;

    public void Execute(object? parameter) => ExecuteCount++;
  }
}
