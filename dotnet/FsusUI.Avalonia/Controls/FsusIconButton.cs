using Avalonia;
using Avalonia.Automation;

namespace FsusUI.Avalonia.Controls;

public class FsusIconButton : FsusButton
{
  public static readonly StyledProperty<bool> IsDecorativeIconProperty =
    AvaloniaProperty.Register<FsusIconButton, bool>(nameof(IsDecorativeIcon));

  public FsusIconButton()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-icon-button");
    SyncAccessibility();
  }

  public bool IsDecorativeIcon
  {
    get => GetValue(IsDecorativeIconProperty);
    set => SetValue(IsDecorativeIconProperty, value);
  }

  public void ValidateAccessibility()
  {
    if (IsDecorativeIcon)
    {
      return;
    }

    var name = AccessibleName;
    if (string.IsNullOrWhiteSpace(name))
    {
      name = AutomationProperties.GetName(this);
    }

    if (string.IsNullOrWhiteSpace(name))
    {
      throw new InvalidOperationException(
        "FsusIconButton requires AccessibleName unless IsDecorativeIcon is true.");
    }
  }

  protected override void OnPropertyChanged(AvaloniaPropertyChangedEventArgs change)
  {
    base.OnPropertyChanged(change);

    if (
      change.Property == AccessibleNameProperty ||
      change.Property == IsDecorativeIconProperty)
    {
      SyncAccessibility();
    }
  }

  private void SyncAccessibility()
  {
    var hasName = !string.IsNullOrWhiteSpace(AccessibleName);
    if (hasName)
    {
      AutomationProperties.SetName(this, AccessibleName!);
      AutomationProperties.SetAccessibilityView(this, AccessibilityView.Control);
    }
    else if (IsDecorativeIcon)
    {
      AutomationProperties.SetName(this, string.Empty);
      AutomationProperties.SetAccessibilityView(this, AccessibilityView.Raw);
    }
    else
    {
      AutomationProperties.SetName(this, string.Empty);
      AutomationProperties.SetAccessibilityView(this, AccessibilityView.Control);
    }

    FsusComponentClasses.Ensure(this, "fsus-semantic-icon", hasName);
    FsusComponentClasses.Ensure(this, "fsus-decorative-icon", !hasName && IsDecorativeIcon);
  }
}
