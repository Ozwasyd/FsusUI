using Avalonia;
using Avalonia.Automation;
using Avalonia.Controls;
using Avalonia.Interactivity;
using Avalonia.Media;

namespace FsusUI.Avalonia.Controls;

public enum FsusButtonIconPlacement
{
  None,
  Leading,
  Trailing,
  IconOnly,
}

public class FsusButton : Button
{
  public static readonly RoutedEvent<RoutedEventArgs> ActivatedEvent =
    RoutedEvent.Register<FsusButton, RoutedEventArgs>(
      nameof(Activated),
      RoutingStrategies.Bubble);

  public static readonly StyledProperty<FsusComponentVariant> VariantProperty =
    AvaloniaProperty.Register<FsusButton, FsusComponentVariant>(
      nameof(Variant),
      FsusComponentVariant.Default);

  public static readonly StyledProperty<FsusComponentSize> SizeProperty =
    AvaloniaProperty.Register<FsusButton, FsusComponentSize>(
      nameof(Size),
      FsusComponentSize.Md);

  public static readonly StyledProperty<bool> IsLoadingProperty =
    AvaloniaProperty.Register<FsusButton, bool>(nameof(IsLoading));

  public static readonly StyledProperty<bool> IsPlainProperty =
    AvaloniaProperty.Register<FsusButton, bool>(nameof(IsPlain));

  public static readonly StyledProperty<bool> IsRoundProperty =
    AvaloniaProperty.Register<FsusButton, bool>(nameof(IsRound));

  public static readonly StyledProperty<bool> IsCircleProperty =
    AvaloniaProperty.Register<FsusButton, bool>(nameof(IsCircle));

  public static readonly StyledProperty<bool> IsTextButtonProperty =
    AvaloniaProperty.Register<FsusButton, bool>(nameof(IsTextButton));

  public static readonly StyledProperty<bool> IsLinkProperty =
    AvaloniaProperty.Register<FsusButton, bool>(nameof(IsLink));

  public static readonly StyledProperty<bool> IsInlineActionProperty =
    AvaloniaProperty.Register<FsusButton, bool>(nameof(IsInlineAction));

  public static readonly StyledProperty<bool> MotionHooksEnabledProperty =
    AvaloniaProperty.Register<FsusButton, bool>(
      nameof(MotionHooksEnabled),
      true);

  public static readonly StyledProperty<FsusButtonIconPlacement> IconPlacementProperty =
    AvaloniaProperty.Register<FsusButton, FsusButtonIconPlacement>(
      nameof(IconPlacement),
      FsusButtonIconPlacement.None);

  public static readonly StyledProperty<string?> AccessibleNameProperty =
    AvaloniaProperty.Register<FsusButton, string?>(nameof(AccessibleName));

  public static readonly StyledProperty<IBrush?> CustomBackgroundProperty =
    AvaloniaProperty.Register<FsusButton, IBrush?>(nameof(CustomBackground));

  public static readonly StyledProperty<IBrush?> CustomForegroundProperty =
    AvaloniaProperty.Register<FsusButton, IBrush?>(nameof(CustomForeground));

  public static readonly StyledProperty<IBrush?> CustomBorderBrushProperty =
    AvaloniaProperty.Register<FsusButton, IBrush?>(nameof(CustomBorderBrush));

  private bool? enabledBeforeLoading;

  public event EventHandler<RoutedEventArgs> Activated
  {
    add => AddHandler(ActivatedEvent, value);
    remove => RemoveHandler(ActivatedEvent, value);
  }

  public FsusButton()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-button");
    SyncClasses();
  }

  public FsusComponentVariant Variant
  {
    get => GetValue(VariantProperty);
    set => SetValue(VariantProperty, value);
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

  public bool IsPlain
  {
    get => GetValue(IsPlainProperty);
    set => SetValue(IsPlainProperty, value);
  }

  public bool IsRound
  {
    get => GetValue(IsRoundProperty);
    set => SetValue(IsRoundProperty, value);
  }

  public bool IsCircle
  {
    get => GetValue(IsCircleProperty);
    set => SetValue(IsCircleProperty, value);
  }

  public bool IsTextButton
  {
    get => GetValue(IsTextButtonProperty);
    set => SetValue(IsTextButtonProperty, value);
  }

  public bool IsLink
  {
    get => GetValue(IsLinkProperty);
    set => SetValue(IsLinkProperty, value);
  }

  public bool IsInlineAction
  {
    get => GetValue(IsInlineActionProperty);
    set => SetValue(IsInlineActionProperty, value);
  }

  public bool MotionHooksEnabled
  {
    get => GetValue(MotionHooksEnabledProperty);
    set => SetValue(MotionHooksEnabledProperty, value);
  }

  public FsusButtonIconPlacement IconPlacement
  {
    get => GetValue(IconPlacementProperty);
    set => SetValue(IconPlacementProperty, value);
  }

  public string? AccessibleName
  {
    get => GetValue(AccessibleNameProperty);
    set => SetValue(AccessibleNameProperty, value);
  }

  public IBrush? CustomBackground
  {
    get => GetValue(CustomBackgroundProperty);
    set => SetValue(CustomBackgroundProperty, value);
  }

  public IBrush? CustomForeground
  {
    get => GetValue(CustomForegroundProperty);
    set => SetValue(CustomForegroundProperty, value);
  }

  public IBrush? CustomBorderBrush
  {
    get => GetValue(CustomBorderBrushProperty);
    set => SetValue(CustomBorderBrushProperty, value);
  }

  protected override void OnPropertyChanged(AvaloniaPropertyChangedEventArgs change)
  {
    base.OnPropertyChanged(change);

    if (
      change.Property == VariantProperty ||
      change.Property == SizeProperty ||
      change.Property == IsLoadingProperty ||
      change.Property == IsPlainProperty ||
      change.Property == IsRoundProperty ||
      change.Property == IsCircleProperty ||
      change.Property == IsTextButtonProperty ||
      change.Property == IsLinkProperty ||
      change.Property == IsInlineActionProperty ||
      change.Property == MotionHooksEnabledProperty ||
      change.Property == IconPlacementProperty ||
      change.Property == IsEnabledProperty)
    {
      SyncClasses();
    }

    if (change.Property == AccessibleNameProperty)
    {
      SyncAutomation();
    }

    if (
      change.Property == CustomBackgroundProperty ||
      change.Property == CustomForegroundProperty ||
      change.Property == CustomBorderBrushProperty)
    {
      ApplyCustomBrushes();
    }
  }

  protected override void OnClick()
  {
    if (IsLoading || !IsEnabled)
    {
      return;
    }

    base.OnClick();
    RaiseEvent(new RoutedEventArgs(ActivatedEvent));
  }

  protected void SyncClasses()
  {
    FsusComponentClasses.SyncVariant(this, Variant);
    FsusComponentClasses.SyncSize(this, Size);
    FsusComponentClasses.Ensure(this, "fsus-loading", IsLoading);
    FsusComponentClasses.Ensure(this, "fsus-disabled", !IsEnabled);
    FsusComponentClasses.Ensure(this, "fsus-plain", IsPlain);
    FsusComponentClasses.Ensure(this, "fsus-round", IsRound);
    FsusComponentClasses.Ensure(this, "fsus-circle", IsCircle);
    FsusComponentClasses.Ensure(this, "fsus-text-button", IsTextButton);
    FsusComponentClasses.Ensure(this, "fsus-link", IsLink);
    FsusComponentClasses.Ensure(this, "fsus-inline-action", IsInlineAction);
    FsusComponentClasses.Ensure(this, "fsus-motion", MotionHooksEnabled);
    FsusComponentClasses.Ensure(this, "fsus-motionless", !MotionHooksEnabled);
    FsusComponentClasses.SyncIconPlacement(this, IconPlacement);

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
  }

  private void ApplyCustomBrushes()
  {
    if (CustomBackground is not null)
    {
      Background = CustomBackground;
    }

    if (CustomForeground is not null)
    {
      Foreground = CustomForeground;
    }

    if (CustomBorderBrush is not null)
    {
      BorderBrush = CustomBorderBrush;
    }
  }
}

public class FsusButtonGroup : StackPanel
{
  public static readonly StyledProperty<FsusComponentVariant> VariantProperty =
    AvaloniaProperty.Register<FsusButtonGroup, FsusComponentVariant>(
      nameof(Variant),
      FsusComponentVariant.Default);

  public static readonly StyledProperty<FsusComponentSize> SizeProperty =
    AvaloniaProperty.Register<FsusButtonGroup, FsusComponentSize>(
      nameof(Size),
      FsusComponentSize.Md);

  private readonly Dictionary<FsusButton, bool> enabledBeforeGroupDisabled = [];

  public FsusButtonGroup()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-button-group");
    Orientation = global::Avalonia.Layout.Orientation.Horizontal;
    Spacing = 0;
    Children.CollectionChanged += (_, _) => RefreshGroupState();
    SyncClasses();
  }

  public FsusComponentVariant Variant
  {
    get => GetValue(VariantProperty);
    set => SetValue(VariantProperty, value);
  }

  public FsusComponentSize Size
  {
    get => GetValue(SizeProperty);
    set => SetValue(SizeProperty, value);
  }

  public void RefreshGroupState()
  {
    SyncClasses();

    var buttons = Children.OfType<FsusButton>().ToArray();
    for (var index = 0; index < buttons.Length; index++)
    {
      var button = buttons[index];
      button.Size = Size;
      if (Variant != FsusComponentVariant.Default)
      {
        button.Variant = Variant;
      }
      FsusComponentClasses.Ensure(button, "fsus-grouped", true);
      FsusComponentClasses.Ensure(
        button,
        "fsus-group-single",
        buttons.Length == 1);
      FsusComponentClasses.Ensure(
        button,
        "fsus-group-first",
        buttons.Length > 1 && index == 0);
      FsusComponentClasses.Ensure(
        button,
        "fsus-group-middle",
        buttons.Length > 2 && index > 0 && index < buttons.Length - 1);
      FsusComponentClasses.Ensure(
        button,
        "fsus-group-last",
        buttons.Length > 1 && index == buttons.Length - 1);

      if (!IsEnabled)
      {
        enabledBeforeGroupDisabled.TryAdd(button, button.IsEnabled);
        button.IsEnabled = false;
        continue;
      }

      if (enabledBeforeGroupDisabled.Remove(button, out var wasEnabled))
      {
        button.IsEnabled = wasEnabled;
      }
    }
  }

  protected override void OnPropertyChanged(AvaloniaPropertyChangedEventArgs change)
  {
    base.OnPropertyChanged(change);

    if (
      change.Property == VariantProperty ||
      change.Property == SizeProperty ||
      change.Property == IsEnabledProperty)
    {
      RefreshGroupState();
    }
  }

  private void SyncClasses()
  {
    FsusComponentClasses.SyncVariant(this, Variant);
    FsusComponentClasses.SyncSize(this, Size);
    FsusComponentClasses.Ensure(this, "fsus-disabled", !IsEnabled);
  }
}
