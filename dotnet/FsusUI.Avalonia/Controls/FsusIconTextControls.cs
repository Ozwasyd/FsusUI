using Avalonia;
using Avalonia.Automation;
using Avalonia.Automation.Peers;
using Avalonia.Controls;
using Avalonia.Media;
using Avalonia.VisualTree;
using ShapePath = Avalonia.Controls.Shapes.Path;

namespace FsusUI.Avalonia.Controls;

public enum FsusTextVariant
{
  Body,
  Muted,
  Strong,
  Title,
  Monospace,
}

public class FsusIcon : ShapePath
{
  public static readonly StyledProperty<string?> IconKeyProperty =
    AvaloniaProperty.Register<FsusIcon, string?>(nameof(IconKey));

  public static readonly StyledProperty<FsusComponentSize> SizeProperty =
    AvaloniaProperty.Register<FsusIcon, FsusComponentSize>(
      nameof(Size),
      FsusComponentSize.Md);

  public static readonly StyledProperty<string?> AccessibleNameProperty =
    AvaloniaProperty.Register<FsusIcon, string?>(nameof(AccessibleName));

  public static readonly StyledProperty<bool> IsDecorativeProperty =
    AvaloniaProperty.Register<FsusIcon, bool>(
      nameof(IsDecorative),
      true);

  public static readonly StyledProperty<bool> MotionHooksEnabledProperty =
    AvaloniaProperty.Register<FsusIcon, bool>(
      nameof(MotionHooksEnabled),
      true);

  public FsusIcon()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-icon");
    Stretch = Stretch.Uniform;
    Focusable = false;
    SyncClasses();
    SyncAccessibility();
  }

  public string? IconKey
  {
    get => GetValue(IconKeyProperty);
    set => SetValue(IconKeyProperty, value);
  }

  public FsusComponentSize Size
  {
    get => GetValue(SizeProperty);
    set => SetValue(SizeProperty, value);
  }

  public string? AccessibleName
  {
    get => GetValue(AccessibleNameProperty);
    set => SetValue(AccessibleNameProperty, value);
  }

  public bool IsDecorative
  {
    get => GetValue(IsDecorativeProperty);
    set => SetValue(IsDecorativeProperty, value);
  }

  public bool MotionHooksEnabled
  {
    get => GetValue(MotionHooksEnabledProperty);
    set => SetValue(MotionHooksEnabledProperty, value);
  }

  public void ValidateAccessibility()
  {
    if (IsDecorative)
    {
      return;
    }

    if (string.IsNullOrWhiteSpace(AccessibleName))
    {
      throw new InvalidOperationException(
        "FsusIcon requires AccessibleName when IsDecorative is false.");
    }
  }

  protected override void OnAttachedToVisualTree(VisualTreeAttachmentEventArgs e)
  {
    base.OnAttachedToVisualTree(e);
    ResolveIconData();
  }

  protected override void OnPropertyChanged(AvaloniaPropertyChangedEventArgs change)
  {
    base.OnPropertyChanged(change);

    if (
      change.Property == IconKeyProperty)
    {
      ResolveIconData();
    }

    if (
      change.Property == SizeProperty ||
      change.Property == IsDecorativeProperty ||
      change.Property == MotionHooksEnabledProperty ||
      change.Property == IsEnabledProperty)
    {
      SyncClasses();
    }

    if (
      change.Property == AccessibleNameProperty ||
      change.Property == IsDecorativeProperty)
    {
      SyncAccessibility();
    }
  }

  private void ResolveIconData()
  {
    if (string.IsNullOrWhiteSpace(IconKey))
    {
      return;
    }

    if (this.TryFindResource(IconKey, out var resource) && resource is Geometry geometry)
    {
      Data = geometry;
    }
  }

  private void SyncClasses()
  {
    FsusComponentClasses.SyncSize(this, Size);
    FsusComponentClasses.Ensure(this, "fsus-disabled", !IsEnabled);
    FsusComponentClasses.Ensure(this, "fsus-motion", MotionHooksEnabled);
    FsusComponentClasses.Ensure(this, "fsus-motionless", !MotionHooksEnabled);
    FsusComponentClasses.Ensure(this, "fsus-decorative-icon", IsDecorative);
    FsusComponentClasses.Ensure(this, "fsus-semantic-icon", !IsDecorative);
  }

  private void SyncAccessibility()
  {
    if (!IsDecorative && !string.IsNullOrWhiteSpace(AccessibleName))
    {
      AutomationProperties.SetName(this, AccessibleName!);
      AutomationProperties.SetAccessibilityView(this, AccessibilityView.Control);
      return;
    }

    AutomationProperties.SetName(this, string.Empty);
    AutomationProperties.SetAccessibilityView(
      this,
      IsDecorative ? AccessibilityView.Raw : AccessibilityView.Control);
  }
}

public class FsusText : TextBlock
{
  private static readonly string[] VariantClasses =
  [
    "fsus-text-body",
    "fsus-text-muted",
    "fsus-text-strong",
    "fsus-text-title",
    "fsus-text-monospace",
  ];

  public static readonly StyledProperty<FsusTextVariant> VariantProperty =
    AvaloniaProperty.Register<FsusText, FsusTextVariant>(
      nameof(Variant),
      FsusTextVariant.Body);

  public static readonly StyledProperty<bool> IsTruncatedProperty =
    AvaloniaProperty.Register<FsusText, bool>(nameof(IsTruncated));

  public static readonly StyledProperty<string?> AccessibleNameProperty =
    AvaloniaProperty.Register<FsusText, string?>(nameof(AccessibleName));

  public FsusText()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-text-control");
    Focusable = false;
    SyncClasses();
    SyncTruncation();
  }

  public FsusTextVariant Variant
  {
    get => GetValue(VariantProperty);
    set => SetValue(VariantProperty, value);
  }

  public bool IsTruncated
  {
    get => GetValue(IsTruncatedProperty);
    set => SetValue(IsTruncatedProperty, value);
  }

  public string? AccessibleName
  {
    get => GetValue(AccessibleNameProperty);
    set => SetValue(AccessibleNameProperty, value);
  }

  protected override void OnPropertyChanged(AvaloniaPropertyChangedEventArgs change)
  {
    base.OnPropertyChanged(change);

    if (change.Property == VariantProperty)
    {
      SyncClasses();
    }

    if (change.Property == IsTruncatedProperty)
    {
      SyncTruncation();
      SyncClasses();
    }

    if (change.Property == AccessibleNameProperty)
    {
      SyncAutomation();
    }
  }

  private void SyncClasses()
  {
    foreach (var className in VariantClasses)
    {
      FsusComponentClasses.Ensure(this, className, false);
    }

    FsusComponentClasses.Ensure(this, VariantClasses[(int)Variant], true);
    FsusComponentClasses.Ensure(this, "fsus-text-truncated", IsTruncated);
  }

  private void SyncTruncation()
  {
    if (IsTruncated)
    {
      TextTrimming = TextTrimming.CharacterEllipsis;
      TextWrapping = TextWrapping.NoWrap;
      MaxLines = 1;
      return;
    }

    TextTrimming = TextTrimming.None;
    TextWrapping = TextWrapping.Wrap;
    MaxLines = 0;
  }

  private void SyncAutomation()
  {
    if (!string.IsNullOrWhiteSpace(AccessibleName))
    {
      AutomationProperties.SetName(this, AccessibleName!);
      AutomationProperties.SetAccessibilityView(this, AccessibilityView.Control);
    }
  }
}

public class FsusLink : FsusButton
{
  public static readonly StyledProperty<Uri?> NavigateUriProperty =
    AvaloniaProperty.Register<FsusLink, Uri?>(nameof(NavigateUri));

  public FsusLink()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-link-control");
    Variant = FsusComponentVariant.Text;
    IsLink = true;
    IsTextButton = true;
    IsInlineAction = true;
    SyncLinkState();
  }

  public Uri? NavigateUri
  {
    get => GetValue(NavigateUriProperty);
    set => SetValue(NavigateUriProperty, value);
  }

  public void ValidateAccessibility()
  {
    if (string.IsNullOrWhiteSpace(ResolvedAccessibleName()))
    {
      throw new InvalidOperationException(
        "FsusLink requires AccessibleName or text content.");
    }
  }

  protected override void OnPropertyChanged(AvaloniaPropertyChangedEventArgs change)
  {
    base.OnPropertyChanged(change);

    if (
      change.Property == AccessibleNameProperty ||
      change.Property == ContentProperty ||
      change.Property == CommandProperty ||
      change.Property == NavigateUriProperty)
    {
      SyncLinkState();
    }
  }

  private void SyncLinkState()
  {
    FsusComponentClasses.Ensure(this, "fsus-link-navigable", NavigateUri is not null);
    FsusComponentClasses.Ensure(this, "fsus-link-command", Command is not null);

    var name = ResolvedAccessibleName();
    if (!string.IsNullOrWhiteSpace(name))
    {
      AutomationProperties.SetName(this, name!);
    }

    AutomationProperties.SetAccessibilityView(this, AccessibilityView.Control);
    AutomationProperties.SetControlTypeOverride(this, AutomationControlType.Hyperlink);
  }

  private string? ResolvedAccessibleName()
  {
    if (!string.IsNullOrWhiteSpace(AccessibleName))
    {
      return AccessibleName;
    }

    return Content as string;
  }
}
