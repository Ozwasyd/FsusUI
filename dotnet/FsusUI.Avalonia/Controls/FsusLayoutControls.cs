using Avalonia;
using Avalonia.Automation;
using Avalonia.Automation.Peers;
using Avalonia.Controls;
using Avalonia.Input;
using Avalonia.Layout;

namespace FsusUI.Avalonia.Controls;

public enum FsusLayoutGap
{
  None,
  Xs,
  Sm,
  Md,
  Lg,
}

public enum FsusLayoutAlignment
{
  Start,
  Center,
  End,
  Stretch,
}

public enum FsusLayoutBreakpoint
{
  Xs,
  Sm,
  Md,
  Lg,
}

public sealed class FsusScrollbarScrolledEventArgs(Vector offset) : EventArgs
{
  public Vector Offset { get; } = offset;
}

public class FsusSpace : StackPanel
{
  public static readonly StyledProperty<FsusLayoutGap> GapProperty =
    AvaloniaProperty.Register<FsusSpace, FsusLayoutGap>(
      nameof(Gap),
      FsusLayoutGap.Sm);

  public static readonly StyledProperty<bool> IsWrapEnabledProperty =
    AvaloniaProperty.Register<FsusSpace, bool>(nameof(IsWrapEnabled));

  public static readonly StyledProperty<FsusLayoutAlignment> AlignProperty =
    AvaloniaProperty.Register<FsusSpace, FsusLayoutAlignment>(
      nameof(Align),
      FsusLayoutAlignment.Start);

  public FsusSpace()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-space");
    Orientation = Orientation.Horizontal;
    SyncLayoutState();
  }

  public FsusLayoutGap Gap
  {
    get => GetValue(GapProperty);
    set => SetValue(GapProperty, value);
  }

  public bool IsWrapEnabled
  {
    get => GetValue(IsWrapEnabledProperty);
    set => SetValue(IsWrapEnabledProperty, value);
  }

  public FsusLayoutAlignment Align
  {
    get => GetValue(AlignProperty);
    set => SetValue(AlignProperty, value);
  }

  public double GapSize => FsusLayoutMetrics.ResolveGap(Gap);

  protected override void OnPropertyChanged(AvaloniaPropertyChangedEventArgs change)
  {
    base.OnPropertyChanged(change);

    if (
      change.Property == GapProperty ||
      change.Property == IsWrapEnabledProperty ||
      change.Property == AlignProperty ||
      change.Property == OrientationProperty)
    {
      SyncLayoutState();
    }
  }

  private void SyncLayoutState()
  {
    Spacing = GapSize;
    FsusLayoutMetrics.SyncGapClasses(this, Gap);
    FsusComponentClasses.Ensure(this, "fsus-wrap", IsWrapEnabled);
    FsusComponentClasses.Ensure(this, "fsus-horizontal", Orientation == Orientation.Horizontal);
    FsusComponentClasses.Ensure(this, "fsus-vertical", Orientation == Orientation.Vertical);
    FsusLayoutMetrics.SyncAlignment(this, Align);
  }
}

public class FsusRow : StackPanel
{
  public static readonly StyledProperty<FsusLayoutGap> GapProperty =
    AvaloniaProperty.Register<FsusRow, FsusLayoutGap>(
      nameof(Gap),
      FsusLayoutGap.Md);

  public static readonly StyledProperty<FsusLayoutBreakpoint> BreakpointProperty =
    AvaloniaProperty.Register<FsusRow, FsusLayoutBreakpoint>(
      nameof(Breakpoint),
      FsusLayoutBreakpoint.Md);

  public FsusRow()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-row");
    Orientation = Orientation.Horizontal;
    SyncLayoutState();
  }

  public FsusLayoutGap Gap
  {
    get => GetValue(GapProperty);
    set => SetValue(GapProperty, value);
  }

  public FsusLayoutBreakpoint Breakpoint
  {
    get => GetValue(BreakpointProperty);
    set => SetValue(BreakpointProperty, value);
  }

  public double GapSize => FsusLayoutMetrics.ResolveGap(Gap);

  public void RefreshResponsiveColumns(double viewportWidth)
  {
    Breakpoint = FsusLayoutMetrics.ResolveBreakpoint(viewportWidth);
    foreach (var column in Children.OfType<FsusCol>())
    {
      column.ApplyBreakpoint(Breakpoint);
    }
    SyncLayoutState();
  }

  protected override void OnPropertyChanged(AvaloniaPropertyChangedEventArgs change)
  {
    base.OnPropertyChanged(change);

    if (change.Property == GapProperty || change.Property == BreakpointProperty)
    {
      SyncLayoutState();
    }
  }

  private void SyncLayoutState()
  {
    Spacing = GapSize;
    FsusLayoutMetrics.SyncGapClasses(this, Gap);
    FsusLayoutMetrics.SyncBreakpointClasses(this, Breakpoint);
  }
}

public class FsusCol : ContentControl
{
  public static readonly StyledProperty<int> SpanProperty =
    AvaloniaProperty.Register<FsusCol, int>(nameof(Span), 24);

  public static readonly StyledProperty<int?> SmSpanProperty =
    AvaloniaProperty.Register<FsusCol, int?>(nameof(SmSpan));

  public static readonly StyledProperty<int?> MdSpanProperty =
    AvaloniaProperty.Register<FsusCol, int?>(nameof(MdSpan));

  public static readonly StyledProperty<int?> LgSpanProperty =
    AvaloniaProperty.Register<FsusCol, int?>(nameof(LgSpan));

  public static readonly StyledProperty<int> OrderProperty =
    AvaloniaProperty.Register<FsusCol, int>(nameof(Order));

  public FsusCol()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-col");
    EffectiveSpan = NormalizeSpan(Span);
    SyncClasses();
  }

  public int Span
  {
    get => GetValue(SpanProperty);
    set => SetValue(SpanProperty, value);
  }

  public int? SmSpan
  {
    get => GetValue(SmSpanProperty);
    set => SetValue(SmSpanProperty, value);
  }

  public int? MdSpan
  {
    get => GetValue(MdSpanProperty);
    set => SetValue(MdSpanProperty, value);
  }

  public int? LgSpan
  {
    get => GetValue(LgSpanProperty);
    set => SetValue(LgSpanProperty, value);
  }

  public int Order
  {
    get => GetValue(OrderProperty);
    set => SetValue(OrderProperty, value);
  }

  public int EffectiveSpan { get; private set; }

  public double WidthRatio => EffectiveSpan / 24d;

  public void ApplyBreakpoint(FsusLayoutBreakpoint breakpoint)
  {
    var candidate = breakpoint switch
    {
      FsusLayoutBreakpoint.Sm => SmSpan ?? Span,
      FsusLayoutBreakpoint.Md => MdSpan ?? SmSpan ?? Span,
      FsusLayoutBreakpoint.Lg => LgSpan ?? MdSpan ?? SmSpan ?? Span,
      _ => Span,
    };
    EffectiveSpan = NormalizeSpan(candidate);
    SyncClasses();
  }

  protected override void OnPropertyChanged(AvaloniaPropertyChangedEventArgs change)
  {
    base.OnPropertyChanged(change);

    if (
      change.Property == SpanProperty ||
      change.Property == SmSpanProperty ||
      change.Property == MdSpanProperty ||
      change.Property == LgSpanProperty ||
      change.Property == OrderProperty)
    {
      EffectiveSpan = NormalizeSpan(Span);
      SyncClasses();
    }
  }

  private void SyncClasses()
  {
    FsusComponentClasses.Ensure(this, "fsus-span-full", EffectiveSpan == 24);
    FsusComponentClasses.Ensure(this, "fsus-span-half", EffectiveSpan == 12);
    FsusComponentClasses.Ensure(this, "fsus-span-quarter", EffectiveSpan == 6);
    FsusComponentClasses.Ensure(this, "fsus-order-2", Order == 2);
  }

  private static int NormalizeSpan(int span) => Math.Clamp(span, 1, 24);
}

public class FsusContainer : StackPanel
{
  public static readonly StyledProperty<FsusLayoutGap> GapProperty =
    AvaloniaProperty.Register<FsusContainer, FsusLayoutGap>(
      nameof(Gap),
      FsusLayoutGap.Md);

  public FsusContainer()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-container");
    AutomationProperties.SetControlTypeOverride(this, AutomationControlType.Group);
    SyncLayoutState();
  }

  public FsusLayoutGap Gap
  {
    get => GetValue(GapProperty);
    set => SetValue(GapProperty, value);
  }

  public void RefreshRegions()
  {
    SyncLayoutState();
    FsusComponentClasses.Ensure(
      this,
      "fsus-nested-regions",
      Children.OfType<FsusRegion>().Count() > 1);

    foreach (var region in Children.OfType<FsusRegion>())
    {
      region.SyncAutomation();
    }
  }

  protected override void OnPropertyChanged(AvaloniaPropertyChangedEventArgs change)
  {
    base.OnPropertyChanged(change);

    if (change.Property == GapProperty || change.Property == OrientationProperty)
    {
      SyncLayoutState();
    }
  }

  private void SyncLayoutState()
  {
    Spacing = FsusLayoutMetrics.ResolveGap(Gap);
    FsusLayoutMetrics.SyncGapClasses(this, Gap);
    FsusComponentClasses.Ensure(this, "fsus-horizontal", Orientation == Orientation.Horizontal);
    FsusComponentClasses.Ensure(this, "fsus-vertical", Orientation == Orientation.Vertical);
  }
}

public abstract class FsusRegion : ContentControl
{
  protected FsusRegion(string className, string roleName)
  {
    FsusComponentClasses.SetBaseClasses(this, className);
    RoleName = roleName;
    SyncAutomation();
  }

  protected string RoleName { get; }

  protected override void OnPropertyChanged(AvaloniaPropertyChangedEventArgs change)
  {
    base.OnPropertyChanged(change);

    if (change.Property == ContentProperty)
    {
      SyncAutomation();
    }
  }

  public void SyncAutomation()
  {
    AutomationProperties.SetControlTypeOverride(this, AutomationControlType.Group);
    AutomationProperties.SetClassNameOverride(this, RoleName);
    AutomationProperties.SetName(this, FsusComponentClasses.ResolveName(null, Content));
  }
}

public class FsusHeader : FsusRegion
{
  public FsusHeader() : base("fsus-header", "Header")
  {
  }
}

public class FsusAside : FsusRegion
{
  public FsusAside() : base("fsus-aside", "Aside")
  {
  }
}

public class FsusMain : FsusRegion
{
  public FsusMain() : base("fsus-main", "Main")
  {
  }
}

public class FsusFooter : FsusRegion
{
  public FsusFooter() : base("fsus-footer", "Footer")
  {
  }
}

public class FsusScrollbar : ContentControl
{
  public static readonly StyledProperty<Vector> ScrollOffsetProperty =
    AvaloniaProperty.Register<FsusScrollbar, Vector>(nameof(ScrollOffset));

  public static readonly StyledProperty<double> KeyboardScrollStepProperty =
    AvaloniaProperty.Register<FsusScrollbar, double>(
      nameof(KeyboardScrollStep),
      FsusTokens.DensityControlCompactYDouble);

  public static readonly StyledProperty<double> PointerScrollStepProperty =
    AvaloniaProperty.Register<FsusScrollbar, double>(
      nameof(PointerScrollStep),
      FsusTokens.Space4Thickness.Left);

  public static readonly StyledProperty<string?> AccessibleNameProperty =
    AvaloniaProperty.Register<FsusScrollbar, string?>(nameof(AccessibleName));

  public FsusScrollbar()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-scrollbar");
    Focusable = true;
    SyncAutomation();
  }

  public event EventHandler<FsusScrollbarScrolledEventArgs>? Scrolled;

  public Vector ScrollOffset
  {
    get => GetValue(ScrollOffsetProperty);
    private set => SetValue(ScrollOffsetProperty, value);
  }

  public double KeyboardScrollStep
  {
    get => GetValue(KeyboardScrollStepProperty);
    set => SetValue(KeyboardScrollStepProperty, value);
  }

  public double PointerScrollStep
  {
    get => GetValue(PointerScrollStepProperty);
    set => SetValue(PointerScrollStepProperty, value);
  }

  public string? AccessibleName
  {
    get => GetValue(AccessibleNameProperty);
    set => SetValue(AccessibleNameProperty, value);
  }

  public void ScrollPointerDelta(Vector delta) =>
    ScrollBy(delta.X * PointerScrollStep, delta.Y * PointerScrollStep);

  public void ScrollBy(double x, double y)
  {
    ScrollOffset = new Vector(
      Math.Max(0d, ScrollOffset.X + x),
      Math.Max(0d, ScrollOffset.Y + y));
    Scrolled?.Invoke(this, new FsusScrollbarScrolledEventArgs(ScrollOffset));
  }

  protected void HandleKey(Key key)
  {
    switch (key)
    {
      case Key.Down:
        ScrollBy(0, KeyboardScrollStep);
        break;
      case Key.Up:
        ScrollBy(0, -KeyboardScrollStep);
        break;
      case Key.PageDown:
        ScrollBy(0, KeyboardScrollStep * 2d);
        break;
      case Key.PageUp:
        ScrollBy(0, KeyboardScrollStep * -2d);
        break;
      case Key.Right:
        ScrollBy(KeyboardScrollStep, 0);
        break;
      case Key.Left:
        ScrollBy(-KeyboardScrollStep, 0);
        break;
    }
  }

  protected override void OnPropertyChanged(AvaloniaPropertyChangedEventArgs change)
  {
    base.OnPropertyChanged(change);

    if (change.Property == AccessibleNameProperty)
    {
      SyncAutomation();
    }
  }

  private void SyncAutomation()
  {
    AutomationProperties.SetControlTypeOverride(this, AutomationControlType.Pane);
    AutomationProperties.SetName(this, AccessibleName ?? string.Empty);
  }
}

public class FsusVisualHidden : ContentControl
{
  public FsusVisualHidden()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-visual-hidden");
    Focusable = false;
    IsHitTestVisible = false;
    Opacity = 0d;
    Width = 1d;
    Height = 1d;
    AutomationProperties.SetAccessibilityView(this, AccessibilityView.Control);
    SyncAutomation();
  }

  protected override Size MeasureOverride(Size availableSize) => new(1d, 1d);

  protected override Size ArrangeOverride(Size finalSize) => new(1d, 1d);

  protected override void OnPropertyChanged(AvaloniaPropertyChangedEventArgs change)
  {
    base.OnPropertyChanged(change);

    if (change.Property == ContentProperty)
    {
      SyncAutomation();
    }
  }

  private void SyncAutomation()
  {
    AutomationProperties.SetName(this, FsusComponentClasses.ResolveName(null, Content));
  }
}

internal static class FsusLayoutMetrics
{
  public static double ResolveGap(FsusLayoutGap gap) =>
    gap switch
    {
      FsusLayoutGap.Xs => FsusTokens.Space1Thickness.Left,
      FsusLayoutGap.Sm => FsusTokens.Space2Thickness.Left,
      FsusLayoutGap.Md => FsusTokens.Space3Thickness.Left,
      FsusLayoutGap.Lg => FsusTokens.Space4Thickness.Left,
      _ => 0d,
    };

  public static FsusLayoutBreakpoint ResolveBreakpoint(double viewportWidth) =>
    viewportWidth switch
    {
      < 600d => FsusLayoutBreakpoint.Sm,
      < 960d => FsusLayoutBreakpoint.Md,
      _ => FsusLayoutBreakpoint.Lg,
    };

  public static void SyncGapClasses(Control control, FsusLayoutGap gap)
  {
    foreach (var className in new[]
    {
      "fsus-gap-none",
      "fsus-gap-xs",
      "fsus-gap-sm",
      "fsus-gap-md",
      "fsus-gap-lg",
    })
    {
      FsusComponentClasses.Ensure(control, className, false);
    }

    FsusComponentClasses.Ensure(
      control,
      gap switch
      {
        FsusLayoutGap.Xs => "fsus-gap-xs",
        FsusLayoutGap.Sm => "fsus-gap-sm",
        FsusLayoutGap.Md => "fsus-gap-md",
        FsusLayoutGap.Lg => "fsus-gap-lg",
        _ => "fsus-gap-none",
      },
      true);
  }

  public static void SyncAlignment(Control control, FsusLayoutAlignment align)
  {
    foreach (var className in new[]
    {
      "fsus-align-start",
      "fsus-align-center",
      "fsus-align-end",
      "fsus-align-stretch",
    })
    {
      FsusComponentClasses.Ensure(control, className, false);
    }

    FsusComponentClasses.Ensure(
      control,
      align switch
      {
        FsusLayoutAlignment.Center => "fsus-align-center",
        FsusLayoutAlignment.End => "fsus-align-end",
        FsusLayoutAlignment.Stretch => "fsus-align-stretch",
        _ => "fsus-align-start",
      },
      true);
  }

  public static void SyncBreakpointClasses(Control control, FsusLayoutBreakpoint breakpoint)
  {
    foreach (var className in new[]
    {
      "fsus-breakpoint-xs",
      "fsus-breakpoint-sm",
      "fsus-breakpoint-md",
      "fsus-breakpoint-lg",
    })
    {
      FsusComponentClasses.Ensure(control, className, false);
    }

    FsusComponentClasses.Ensure(
      control,
      breakpoint switch
      {
        FsusLayoutBreakpoint.Sm => "fsus-breakpoint-sm",
        FsusLayoutBreakpoint.Md => "fsus-breakpoint-md",
        FsusLayoutBreakpoint.Lg => "fsus-breakpoint-lg",
        _ => "fsus-breakpoint-xs",
      },
      true);
  }
}
