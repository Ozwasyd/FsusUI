using Avalonia;
using Avalonia.Automation;
using Avalonia.Automation.Peers;
using Avalonia.Automation.Provider;
using Avalonia.Controls;
using Avalonia.Controls.Primitives;
using Avalonia.Input;
using Avalonia.Interactivity;
using Avalonia.Media;
using Avalonia.VisualTree;
using FsusUI.Avalonia.Overlay;

namespace FsusUI.Avalonia.Controls;

public class FsusDialog : FsusModalSurface
{
  public static readonly StyledProperty<bool> IsBodyScrollableProperty =
    AvaloniaProperty.Register<FsusDialog, bool>(nameof(IsBodyScrollable));

  public static readonly StyledProperty<double> MaxBodyHeightProperty =
    AvaloniaProperty.Register<FsusDialog, double>(
      nameof(MaxBodyHeight),
      double.PositiveInfinity);

  private ScrollViewer? bodyScrollViewer;
  private Control? bodyPresenter;

  public FsusDialog() : base("fsus-dialog-surface")
  {
    AddClass("fsus-dialog");
    Focusable = true;
    AddHandler(
      InputElement.GotFocusEvent,
      OnChildGotFocus,
      RoutingStrategies.Bubble,
      handledEventsToo: true);
    AddHandler(
      InputElement.KeyDownEvent,
      OnScrollableKeyDown,
      RoutingStrategies.Tunnel,
      handledEventsToo: true);
    SyncScrollableState();
  }

  public bool IsBodyScrollable
  {
    get => GetValue(IsBodyScrollableProperty);
    set => SetValue(IsBodyScrollableProperty, value);
  }

  public double MaxBodyHeight
  {
    get => GetValue(MaxBodyHeightProperty);
    set => SetValue(MaxBodyHeightProperty, value);
  }

  private void ScrollBodyIntoView(Control control)
  {
    ArgumentNullException.ThrowIfNull(control);

    if (bodyScrollViewer is null)
    {
      return;
    }

    control.BringIntoView();

    var contentVisual =
      (bodyScrollViewer.Content as Visual) ?? bodyPresenter ?? bodyScrollViewer;
    var transform = control.TransformToVisual(contentVisual);
    if (!transform.HasValue)
    {
      return;
    }

    var localBounds = new Rect(0, 0, control.Bounds.Width, control.Bounds.Height);
    var contentBounds = localBounds.TransformToAABB(transform.Value);
    var currentY = bodyScrollViewer.Offset.Y;
    var viewportHeight = bodyScrollViewer.Viewport.Height;

    if (viewportHeight <= 0)
    {
      return;
    }

    if (contentBounds.Top < currentY)
    {
      SetBodyOffset(contentBounds.Top);
    }
    else if (contentBounds.Bottom > currentY + viewportHeight)
    {
      SetBodyOffset(contentBounds.Bottom - viewportHeight);
    }
  }

  private void ScrollBodyBy(double deltaY)
  {
    if (bodyScrollViewer is not null)
    {
      SetBodyOffset(bodyScrollViewer.Offset.Y + deltaY);
    }
  }

  private void ScrollPage(int direction)
  {
    if (bodyScrollViewer is not null && direction != 0)
    {
      ScrollBodyBy(bodyScrollViewer.Viewport.Height * Math.Sign(direction));
    }
  }

  protected override void OnApplyTemplate(TemplateAppliedEventArgs e)
  {
    base.OnApplyTemplate(e);
    bodyScrollViewer = e.NameScope.Find<ScrollViewer>("PART_BodyScrollViewer");
    bodyPresenter =
      e.NameScope.Find<Control>("PART_BodyPresenter") ??
      e.NameScope.Find<Control>("PART_ContentPresenter");
    SyncScrollableState();
  }

  protected override Size MeasureOverride(Size availableSize)
  {
    if (!IsBodyScrollable)
    {
      return base.MeasureOverride(availableSize);
    }

    var viewportHeight = ResolveViewportHeight(availableSize.Height);
    var constrainedSize = double.IsInfinity(viewportHeight)
      ? availableSize
      : new Size(availableSize.Width, viewportHeight);
    return base.MeasureOverride(constrainedSize);
  }

  protected override void OnPropertyChanged(AvaloniaPropertyChangedEventArgs change)
  {
    base.OnPropertyChanged(change);

    if (
      change.Property == IsBodyScrollableProperty ||
      change.Property == MaxBodyHeightProperty ||
      change.Property == BodyContentProperty ||
      change.Property == FooterContentProperty ||
      change.Property == ContentProperty ||
      change.Property == TitleProperty)
    {
      SyncScrollableState();
      InvalidateMeasure();
    }
  }

  protected override void SyncState()
  {
    base.SyncState();
    SyncScrollableState();
  }

  private void SyncScrollableState()
  {
    FsusComponentClasses.Ensure(this, "fsus-scrollable-body", IsBodyScrollable);
    FsusComponentClasses.Ensure(
      this,
      "fsus-has-legacy-content",
      Content is not null);
    FsusComponentClasses.Ensure(
      this,
      "fsus-has-body-content",
      BodyContent is not null);

    if (bodyScrollViewer is not null)
    {
      bodyScrollViewer.MaxHeight =
        !double.IsNaN(MaxBodyHeight) && MaxBodyHeight >= 0
          ? MaxBodyHeight
          : double.PositiveInfinity;
    }
  }

  private void OnScrollableKeyDown(object? sender, KeyEventArgs e)
  {
    if (!IsBodyScrollable || bodyScrollViewer is null)
    {
      return;
    }

    if (e.Key == Key.PageDown)
    {
      ScrollPage(1);
      e.Handled = true;
    }
    else if (e.Key == Key.PageUp)
    {
      ScrollPage(-1);
      e.Handled = true;
    }
  }

  private void OnChildGotFocus(object? sender, RoutedEventArgs e)
  {
    if (
      IsBodyScrollable &&
      bodyScrollViewer is not null &&
      e.Source is Control control &&
      IsDescendantOf(control, bodyScrollViewer))
    {
      ScrollBodyIntoView(control);
    }
  }

  private void SetBodyOffset(double targetY)
  {
    if (bodyScrollViewer is null)
    {
      return;
    }

    var maxY = Math.Max(
      0,
      bodyScrollViewer.Extent.Height - bodyScrollViewer.Viewport.Height);
    bodyScrollViewer.Offset = new Vector(
      bodyScrollViewer.Offset.X,
      Math.Clamp(targetY, 0, maxY));
  }

  private double ResolveViewportHeight(double availableHeight)
  {
    var resolved = PositiveOrInfinity(availableHeight);

    if (OverlayEntry?.Options.ViewportBounds.Height is > 0 and var overlayHeight)
    {
      resolved = Math.Min(resolved, overlayHeight);
    }

    if (TopLevel.GetTopLevel(this)?.ClientSize.Height is > 0 and var topLevelHeight)
    {
      resolved = Math.Min(resolved, topLevelHeight);
    }

    if (Parent is Visual parent && parent.Bounds.Height > 0)
    {
      resolved = Math.Min(resolved, parent.Bounds.Height);
    }

    return resolved;
  }

  private static double PositiveOrInfinity(double value) =>
    !double.IsNaN(value) && value > 0 ? value : double.PositiveInfinity;

  private static bool IsDescendantOf(Visual child, Visual parent)
  {
    for (var current = child.GetVisualParent();
      current is not null;
      current = current.GetVisualParent())
    {
      if (ReferenceEquals(current, parent))
      {
        return true;
      }
    }

    return false;
  }
}
