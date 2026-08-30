using Avalonia;
using Avalonia.Automation;
using Avalonia.Automation.Peers;
using Avalonia.Controls;
using Avalonia.Layout;
using Avalonia.Media;
using Avalonia.VisualTree;

namespace FsusUI.Avalonia.Controls;

public enum FsusAvatarShape
{
  Circle,
  Square,
}

/// <summary>
/// Avalonia counterpart of the Vue <c>ElAvatar</c> family: a centered,
/// clipped (circle or square) tile that renders a source image or a fallback
/// content/slot. Naming follows Avalonia style.
/// </summary>
public class FsusAvatar : ContentControl
{
  public static readonly StyledProperty<double> SizeProperty =
    AvaloniaProperty.Register<FsusAvatar, double>(
      nameof(Size),
      40);

  public static readonly StyledProperty<FsusAvatarShape> ShapeProperty =
    AvaloniaProperty.Register<FsusAvatar, FsusAvatarShape>(
      nameof(Shape),
      FsusAvatarShape.Circle);

  public static readonly StyledProperty<string?> SourceProperty =
    AvaloniaProperty.Register<FsusAvatar, string?>(nameof(Source));

  public static readonly StyledProperty<string?> FallbackTextProperty =
    AvaloniaProperty.Register<FsusAvatar, string?>(nameof(FallbackText));

  public FsusAvatar()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-avatar");
    HorizontalAlignment = HorizontalAlignment.Left;
    VerticalAlignment = VerticalAlignment.Top;
    SyncClasses();
    SyncAutomation();
  }

  public double Size
  {
    get => GetValue(SizeProperty);
    set => SetValue(SizeProperty, value);
  }

  public FsusAvatarShape Shape
  {
    get => GetValue(ShapeProperty);
    set => SetValue(ShapeProperty, value);
  }

  public string? Source
  {
    get => GetValue(SourceProperty);
    set => SetValue(SourceProperty, value);
  }

  public string? FallbackText
  {
    get => GetValue(FallbackTextProperty);
    set => SetValue(FallbackTextProperty, value);
  }

  protected override Size ArrangeOverride(Size finalSize)
  {
    foreach (var child in this.GetVisualChildren().OfType<Control>())
    {
      child.Measure(new Size(Size, Size));
      child.Arrange(new Rect(0, 0, Size, Size));
    }

    return new Size(Size, Size);
  }

  protected override Size MeasureOverride(Size availableSize)
  {
    foreach (var child in this.GetVisualChildren().OfType<Control>())
    {
      child.Measure(new Size(Size, Size));
    }

    return new Size(Size, Size);
  }

  protected override void OnPropertyChanged(AvaloniaPropertyChangedEventArgs change)
  {
    base.OnPropertyChanged(change);
    if (change.Property == SizeProperty ||
        change.Property == ShapeProperty ||
        change.Property == SourceProperty ||
        change.Property == FallbackTextProperty)
    {
      SyncClasses();
      SyncAutomation();
    }

    if (change.Property == SizeProperty)
    {
      InvalidateMeasure();
      InvalidateArrange();
    }
  }

  private void SyncClasses()
  {
    FsusComponentClasses.Ensure(this, "fsus-circle", Shape == FsusAvatarShape.Circle);
    FsusComponentClasses.Ensure(this, "fsus-square", Shape == FsusAvatarShape.Square);
    FsusComponentClasses.Ensure(this, "fsus-icon", Content is null);

    if (Content is null && !string.IsNullOrEmpty(FallbackText))
    {
      SetCurrentValue(ContentProperty, FallbackText);
    }
  }

  private void SyncAutomation()
  {
    var name = FallbackText
      ?? Source
      ?? string.Empty;
    AutomationProperties.SetName(this,
      FsusComponentClasses.ResolveName(AccessibilityName, name));
    AutomationProperties.SetControlTypeOverride(this, AutomationControlType.Image);
  }

  private string AccessibilityName => string.Empty;
}
