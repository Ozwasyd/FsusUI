using Avalonia.Automation;
using Avalonia.Automation.Peers;
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
  public void TextareaUsesMultilineDefaults()
  {
    var textarea = new FsusTextarea();

    Assert.True(textarea.AcceptsReturn);
    Assert.True(textarea.MinLines >= 3);
    Assert.Contains("fsus-textarea", textarea.Classes);
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
