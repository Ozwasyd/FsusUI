using Avalonia;
using Avalonia.Automation;
using Avalonia.Automation.Peers;
using Avalonia.Controls;
using System.Globalization;

namespace FsusUI.Avalonia.Controls;

public enum FsusSkeletonAnimationPolicy
{
  Enabled,
  Reduced,
  Disabled,
}

public class FsusProgress : ProgressBar
{
  public static readonly StyledProperty<FsusComponentVariant> VariantProperty =
    AvaloniaProperty.Register<FsusProgress, FsusComponentVariant>(
      nameof(Variant),
      FsusComponentVariant.Primary);

  public static readonly StyledProperty<bool> ShowTextProperty =
    AvaloniaProperty.Register<FsusProgress, bool>(nameof(ShowText), true);

  public static readonly StyledProperty<string?> TextProperty =
    AvaloniaProperty.Register<FsusProgress, string?>(nameof(Text));

  public static readonly StyledProperty<string> ProgressTextProperty =
    AvaloniaProperty.Register<FsusProgress, string>(
      nameof(ProgressText),
      "0%");

  public static readonly StyledProperty<string?> AccessibleNameProperty =
    AvaloniaProperty.Register<FsusProgress, string?>(nameof(AccessibleName));

  public FsusProgress()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-progress");
    SyncProgressText();
    SyncClasses();
    SyncAutomation();
  }

  public FsusComponentVariant Variant
  {
    get => GetValue(VariantProperty);
    set => SetValue(VariantProperty, value);
  }

  public bool ShowText
  {
    get => GetValue(ShowTextProperty);
    set => SetValue(ShowTextProperty, value);
  }

  public string? Text
  {
    get => GetValue(TextProperty);
    set => SetValue(TextProperty, value);
  }

  public string? AccessibleName
  {
    get => GetValue(AccessibleNameProperty);
    set => SetValue(AccessibleNameProperty, value);
  }

  public string ProgressText
  {
    get => GetValue(ProgressTextProperty);
    private set => SetValue(ProgressTextProperty, value);
  }

  protected override void OnPropertyChanged(AvaloniaPropertyChangedEventArgs change)
  {
    base.OnPropertyChanged(change);

    if (
      change.Property == VariantProperty ||
      change.Property == ShowTextProperty ||
      change.Property == TextProperty ||
      change.Property == AccessibleNameProperty ||
      change.Property == MinimumProperty ||
      change.Property == MaximumProperty ||
      change.Property == ValueProperty ||
      change.Property == IsIndeterminateProperty)
    {
      SyncProgressText();
      SyncClasses();
      SyncAutomation();
    }
  }

  private void SyncProgressText()
  {
    if (!string.IsNullOrWhiteSpace(Text))
    {
      ProgressText = Text!;
      return;
    }

    if (Maximum <= Minimum)
    {
      ProgressText = "0%";
      return;
    }

    var ratio = Math.Clamp((Value - Minimum) / (Maximum - Minimum), 0d, 1d);
    var percent = Math.Round(ratio * 100d, MidpointRounding.AwayFromZero);
    ProgressText = percent.ToString("0", CultureInfo.InvariantCulture) + "%";
  }

  private void SyncClasses()
  {
    FsusComponentClasses.SyncVariant(this, Variant);
    FsusComponentClasses.Ensure(this, "fsus-show-text", ShowText);
    FsusComponentClasses.Ensure(this, "fsus-indeterminate", IsIndeterminate);
  }

  private void SyncAutomation()
  {
    AutomationProperties.SetControlTypeOverride(this, AutomationControlType.ProgressBar);
    AutomationProperties.SetName(this, AccessibleName ?? string.Empty);
    AutomationProperties.SetItemStatus(this, ProgressText);
  }
}

public class FsusSkeleton : ContentControl
{
  public static readonly StyledProperty<int> LineCountProperty =
    AvaloniaProperty.Register<FsusSkeleton, int>(nameof(LineCount), 1);

  public static readonly StyledProperty<FsusSkeletonAnimationPolicy> AnimationPolicyProperty =
    AvaloniaProperty.Register<FsusSkeleton, FsusSkeletonAnimationPolicy>(
      nameof(AnimationPolicy),
      FsusSkeletonAnimationPolicy.Enabled);

  public FsusSkeleton()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-skeleton");
    Focusable = false;
    SyncClasses();
    AutomationProperties.SetAccessibilityView(this, AccessibilityView.Raw);
  }

  public int LineCount
  {
    get => GetValue(LineCountProperty);
    set => SetValue(LineCountProperty, value);
  }

  public FsusSkeletonAnimationPolicy AnimationPolicy
  {
    get => GetValue(AnimationPolicyProperty);
    set => SetValue(AnimationPolicyProperty, value);
  }

  public bool IsAnimationActive => AnimationPolicy == FsusSkeletonAnimationPolicy.Enabled;

  protected override void OnPropertyChanged(AvaloniaPropertyChangedEventArgs change)
  {
    base.OnPropertyChanged(change);

    if (
      change.Property == LineCountProperty ||
      change.Property == AnimationPolicyProperty)
    {
      SyncClasses();
    }
  }

  private void SyncClasses()
  {
    FsusComponentClasses.Ensure(this, "fsus-animated", IsAnimationActive);
    FsusComponentClasses.Ensure(
      this,
      "fsus-motion-reduced",
      AnimationPolicy == FsusSkeletonAnimationPolicy.Reduced);
    FsusComponentClasses.Ensure(
      this,
      "fsus-motion-disabled",
      AnimationPolicy == FsusSkeletonAnimationPolicy.Disabled);
    FsusComponentClasses.Ensure(this, "fsus-multiline", LineCount > 1);
  }
}

public class FsusEmpty : ContentControl
{
  public static readonly StyledProperty<string?> TitleProperty =
    AvaloniaProperty.Register<FsusEmpty, string?>(nameof(Title));

  public static readonly StyledProperty<string?> DescriptionProperty =
    AvaloniaProperty.Register<FsusEmpty, string?>(nameof(Description));

  public static readonly StyledProperty<object?> IllustrationContentProperty =
    AvaloniaProperty.Register<FsusEmpty, object?>(nameof(IllustrationContent));

  public static readonly StyledProperty<object?> ActionContentProperty =
    AvaloniaProperty.Register<FsusEmpty, object?>(nameof(ActionContent));

  public FsusEmpty()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-empty");
    SyncClasses();
    SyncAutomation();
  }

  public string? Title
  {
    get => GetValue(TitleProperty);
    set => SetValue(TitleProperty, value);
  }

  public string? Description
  {
    get => GetValue(DescriptionProperty);
    set => SetValue(DescriptionProperty, value);
  }

  public object? IllustrationContent
  {
    get => GetValue(IllustrationContentProperty);
    set => SetValue(IllustrationContentProperty, value);
  }

  public object? ActionContent
  {
    get => GetValue(ActionContentProperty);
    set => SetValue(ActionContentProperty, value);
  }

  protected override void OnPropertyChanged(AvaloniaPropertyChangedEventArgs change)
  {
    base.OnPropertyChanged(change);

    if (
      change.Property == TitleProperty ||
      change.Property == DescriptionProperty ||
      change.Property == IllustrationContentProperty ||
      change.Property == ActionContentProperty ||
      change.Property == ContentProperty)
    {
      SyncClasses();
      SyncAutomation();
    }
  }

  private void SyncClasses()
  {
    FsusComponentClasses.Ensure(this, "fsus-has-title", !string.IsNullOrWhiteSpace(Title));
    FsusComponentClasses.Ensure(this, "fsus-has-description", !string.IsNullOrWhiteSpace(Description));
    FsusComponentClasses.Ensure(this, "fsus-has-illustration", IllustrationContent is not null);
    FsusComponentClasses.Ensure(this, "fsus-has-action", ActionContent is not null);
  }

  private void SyncAutomation()
  {
    AutomationProperties.SetControlTypeOverride(this, AutomationControlType.Group);
    AutomationProperties.SetName(this, FsusComponentClasses.ResolveName(Title, Content));
    AutomationProperties.SetHelpText(this, Description ?? string.Empty);
    AutomationProperties.SetItemStatus(this, "empty");
  }
}

public class FsusResult : ContentControl
{
  public static readonly StyledProperty<FsusComponentVariant> VariantProperty =
    AvaloniaProperty.Register<FsusResult, FsusComponentVariant>(
      nameof(Variant),
      FsusComponentVariant.Info);

  public static readonly StyledProperty<string?> TitleProperty =
    AvaloniaProperty.Register<FsusResult, string?>(nameof(Title));

  public static readonly StyledProperty<string?> DescriptionProperty =
    AvaloniaProperty.Register<FsusResult, string?>(nameof(Description));

  public static readonly StyledProperty<object?> IconContentProperty =
    AvaloniaProperty.Register<FsusResult, object?>(nameof(IconContent));

  public static readonly StyledProperty<object?> ActionContentProperty =
    AvaloniaProperty.Register<FsusResult, object?>(nameof(ActionContent));

  public FsusResult()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-result");
    SyncClasses();
    SyncAutomation();
  }

  public FsusComponentVariant Variant
  {
    get => GetValue(VariantProperty);
    set => SetValue(VariantProperty, value);
  }

  public string? Title
  {
    get => GetValue(TitleProperty);
    set => SetValue(TitleProperty, value);
  }

  public string? Description
  {
    get => GetValue(DescriptionProperty);
    set => SetValue(DescriptionProperty, value);
  }

  public object? IconContent
  {
    get => GetValue(IconContentProperty);
    set => SetValue(IconContentProperty, value);
  }

  public object? ActionContent
  {
    get => GetValue(ActionContentProperty);
    set => SetValue(ActionContentProperty, value);
  }

  protected override void OnPropertyChanged(AvaloniaPropertyChangedEventArgs change)
  {
    base.OnPropertyChanged(change);

    if (
      change.Property == VariantProperty ||
      change.Property == TitleProperty ||
      change.Property == DescriptionProperty ||
      change.Property == IconContentProperty ||
      change.Property == ActionContentProperty ||
      change.Property == ContentProperty)
    {
      SyncClasses();
      SyncAutomation();
    }
  }

  private void SyncClasses()
  {
    FsusComponentClasses.SyncVariant(this, Variant);
    FsusComponentClasses.Ensure(this, "fsus-has-title", !string.IsNullOrWhiteSpace(Title));
    FsusComponentClasses.Ensure(this, "fsus-has-description", !string.IsNullOrWhiteSpace(Description));
    FsusComponentClasses.Ensure(this, "fsus-has-icon", IconContent is not null);
    FsusComponentClasses.Ensure(this, "fsus-has-action", ActionContent is not null);
  }

  private void SyncAutomation()
  {
    AutomationProperties.SetControlTypeOverride(this, AutomationControlType.Group);
    AutomationProperties.SetName(this, FsusComponentClasses.ResolveName(Title, Content));
    AutomationProperties.SetHelpText(this, Description ?? string.Empty);
    AutomationProperties.SetItemStatus(this, FsusComponentClasses.VariantName(Variant));
  }
}
