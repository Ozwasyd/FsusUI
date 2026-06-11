using FsusUI.Avalonia.Controls;

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
}
