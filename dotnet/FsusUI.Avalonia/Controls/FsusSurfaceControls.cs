using Avalonia;
using Avalonia.Automation;
using Avalonia.Automation.Peers;
using Avalonia.Controls;
using Avalonia.Controls.Presenters;
using Avalonia.Controls.Primitives;
using Avalonia.Controls.Templates;
using Avalonia.Input;
using Avalonia.Interactivity;
using Avalonia.Layout;
using Avalonia.Media;
using Avalonia.VisualTree;
using FsusUI.Avalonia.Overlay;

namespace FsusUI.Avalonia.Controls;

public class FsusCard : ContentControl
{
  public static readonly StyledProperty<FsusComponentVariant> VariantProperty =
    AvaloniaProperty.Register<FsusCard, FsusComponentVariant>(
      nameof(Variant),
      FsusComponentVariant.Default);

  public static readonly StyledProperty<string?> TitleProperty =
    AvaloniaProperty.Register<FsusCard, string?>(nameof(Title));

  public static readonly StyledProperty<string?> DescriptionProperty =
    AvaloniaProperty.Register<FsusCard, string?>(nameof(Description));

  public static readonly StyledProperty<object?> IconContentProperty =
    AvaloniaProperty.Register<FsusCard, object?>(nameof(IconContent));

  public static readonly StyledProperty<object?> ActionContentProperty =
    AvaloniaProperty.Register<FsusCard, object?>(nameof(ActionContent));

  public static readonly StyledProperty<bool> IsSelectedProperty =
    AvaloniaProperty.Register<FsusCard, bool>(nameof(IsSelected));

  public FsusCard()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-card");
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

  public bool IsSelected
  {
    get => GetValue(IsSelectedProperty);
    set => SetValue(IsSelectedProperty, value);
  }

  protected override void OnPropertyChanged(AvaloniaPropertyChangedEventArgs change)
  {
    base.OnPropertyChanged(change);

    if (
      change.Property == VariantProperty ||
      change.Property == IsSelectedProperty ||
      change.Property == TitleProperty ||
      change.Property == DescriptionProperty ||
      change.Property == IconContentProperty ||
      change.Property == ActionContentProperty)
    {
      SyncClasses();
      SyncAutomation();
    }
  }

  private void SyncClasses()
  {
    FsusComponentClasses.SyncVariant(this, Variant);
    FsusComponentClasses.Ensure(this, "fsus-selected", IsSelected);
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
    AutomationProperties.SetItemStatus(this, IsSelected ? "selected" : FsusComponentClasses.VariantName(Variant));
  }
}

public class FsusDivider : Separator
{
  public static readonly StyledProperty<string?> TitleProperty =
    AvaloniaProperty.Register<FsusDivider, string?>(nameof(Title));

  public FsusDivider()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-divider");
    SyncAutomation();
  }

  public string? Title
  {
    get => GetValue(TitleProperty);
    set => SetValue(TitleProperty, value);
  }

  protected override void OnPropertyChanged(AvaloniaPropertyChangedEventArgs change)
  {
    base.OnPropertyChanged(change);

    if (change.Property == TitleProperty)
    {
      SyncAutomation();
      FsusComponentClasses.Ensure(this, "fsus-has-title", !string.IsNullOrWhiteSpace(Title));
    }
  }

  private void SyncAutomation()
  {
    AutomationProperties.SetControlTypeOverride(this, AutomationControlType.Separator);
    AutomationProperties.SetName(this, Title ?? string.Empty);
  }
}

public enum FsusPanelMotionState
{
  Hidden,
  Entering,
  Open,
  Leaving,
}

public enum FsusModalCloseReason
{
  Programmatic,
  Keyboard,
  PointerOutside,
  Confirm,
  Cancel,
}

public enum FsusModalClosePolicy
{
  Any,
  ExplicitOnly,
  Blocked,
}

public enum FsusDrawerPlacement
{
  Left,
  Right,
  Top,
  Bottom,
}

public enum FsusMessageBoxResult
{
  None,
  Confirm,
  Cancel,
  Closed,
}

public sealed class FsusModalCloseRequest(
  FsusModalSurface surface,
  FsusModalCloseReason reason,
  CancellationToken cancellationToken)
{
  public FsusModalSurface Surface { get; } = surface;
  public FsusModalCloseReason Reason { get; } = reason;
  public CancellationToken CancellationToken { get; } = cancellationToken;
}

public sealed class FsusModalClosedEventArgs(FsusModalCloseReason reason) : EventArgs
{
  public FsusModalCloseReason Reason { get; } = reason;
}

public abstract class FsusModalSurface : ContentControl, IFsusOverlayLifecycle
{
  public static readonly StyledProperty<bool> IsModalProperty =
    AvaloniaProperty.Register<FsusModalSurface, bool>(nameof(IsModal), true);

  public static readonly StyledProperty<bool> IsLoadingProperty =
    AvaloniaProperty.Register<FsusModalSurface, bool>(nameof(IsLoading));

  public static readonly StyledProperty<bool> IsDangerousProperty =
    AvaloniaProperty.Register<FsusModalSurface, bool>(nameof(IsDangerous));

  public static readonly StyledProperty<bool> CloseOnEscapeProperty =
    AvaloniaProperty.Register<FsusModalSurface, bool>(nameof(CloseOnEscape), true);

  public static readonly StyledProperty<bool> CloseOnPointerOutsideProperty =
    AvaloniaProperty.Register<FsusModalSurface, bool>(
      nameof(CloseOnPointerOutside),
      true);

  public static readonly StyledProperty<FsusModalClosePolicy> ClosePolicyProperty =
    AvaloniaProperty.Register<FsusModalSurface, FsusModalClosePolicy>(
      nameof(ClosePolicy),
      FsusModalClosePolicy.Any);

  public static readonly StyledProperty<string?> TitleProperty =
    AvaloniaProperty.Register<FsusModalSurface, string?>(nameof(Title));

  public static readonly StyledProperty<object?> BodyContentProperty =
    AvaloniaProperty.Register<FsusModalSurface, object?>(nameof(BodyContent));

  public static readonly StyledProperty<object?> FooterContentProperty =
    AvaloniaProperty.Register<FsusModalSurface, object?>(nameof(FooterContent));

  public static readonly StyledProperty<object?> ConfirmContentProperty =
    AvaloniaProperty.Register<FsusModalSurface, object?>(nameof(ConfirmContent));

  public static readonly StyledProperty<object?> CancelContentProperty =
    AvaloniaProperty.Register<FsusModalSurface, object?>(nameof(CancelContent));

  public static readonly StyledProperty<bool> IsBodyScrollableProperty =
    AvaloniaProperty.Register<FsusModalSurface, bool>(nameof(IsBodyScrollable));

  public static readonly StyledProperty<double> MaxBodyHeightProperty =
    AvaloniaProperty.Register<FsusModalSurface, double>(
      nameof(MaxBodyHeight),
      double.PositiveInfinity);

  public static readonly StyledProperty<double> ViewportHeightConstraintProperty =
    AvaloniaProperty.Register<FsusModalSurface, double>(
      nameof(ViewportHeightConstraint),
      double.NaN);

  public static readonly StyledProperty<object?> EffectiveBodyContentProperty =
    AvaloniaProperty.Register<FsusModalSurface, object?>(nameof(EffectiveBodyContent));

  public static readonly StyledProperty<object?> EffectiveFooterContentProperty =
    AvaloniaProperty.Register<FsusModalSurface, object?>(nameof(EffectiveFooterContent));

  private readonly List<Control> focusScope = [];
  private FsusOverlayHost? overlayHost;
  private FsusModalCloseReason? pendingCloseReason;
  private ScrollViewer? bodyScrollViewer;
  private Control? headerPresenter;
  private Control? footerPresenter;
  private Control? bodyPresenter;

  static FsusModalSurface()
  {
    TemplateProperty.OverrideDefaultValue<FsusModalSurface>(CreateDefaultTemplate());
  }

  protected FsusModalSurface(string baseClass)
  {
    FsusComponentClasses.SetBaseClasses(this, baseClass);
    MotionState = FsusPanelMotionState.Hidden;
    AddHandler(InputElement.GotFocusEvent, OnChildGotFocus, RoutingStrategies.Bubble);
    UpdateEffectiveContent();
    SyncState();
  }

  public event EventHandler<EventArgs>? Opened;
  public event EventHandler<FsusModalClosedEventArgs>? Closed;
  public event EventHandler<EventArgs>? Confirmed;
  public event EventHandler<EventArgs>? Canceled;

  public bool IsModal
  {
    get => GetValue(IsModalProperty);
    set => SetValue(IsModalProperty, value);
  }

  public bool IsLoading
  {
    get => GetValue(IsLoadingProperty);
    set => SetValue(IsLoadingProperty, value);
  }

  public bool IsDangerous
  {
    get => GetValue(IsDangerousProperty);
    set => SetValue(IsDangerousProperty, value);
  }

  public bool CloseOnEscape
  {
    get => GetValue(CloseOnEscapeProperty);
    set => SetValue(CloseOnEscapeProperty, value);
  }

  public bool CloseOnPointerOutside
  {
    get => GetValue(CloseOnPointerOutsideProperty);
    set => SetValue(CloseOnPointerOutsideProperty, value);
  }

  public FsusModalClosePolicy ClosePolicy
  {
    get => GetValue(ClosePolicyProperty);
    set => SetValue(ClosePolicyProperty, value);
  }

  public string? Title
  {
    get => GetValue(TitleProperty);
    set => SetValue(TitleProperty, value);
  }

  public object? BodyContent
  {
    get => GetValue(BodyContentProperty);
    set => SetValue(BodyContentProperty, value);
  }

  public object? FooterContent
  {
    get => GetValue(FooterContentProperty);
    set => SetValue(FooterContentProperty, value);
  }

  public object? ConfirmContent
  {
    get => GetValue(ConfirmContentProperty);
    set => SetValue(ConfirmContentProperty, value);
  }

  public object? CancelContent
  {
    get => GetValue(CancelContentProperty);
    set => SetValue(CancelContentProperty, value);
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

  public double ViewportHeightConstraint
  {
    get => GetValue(ViewportHeightConstraintProperty);
    set => SetValue(ViewportHeightConstraintProperty, value);
  }

  public object? EffectiveBodyContent
  {
    get => GetValue(EffectiveBodyContentProperty);
    private set => SetValue(EffectiveBodyContentProperty, value);
  }

  public object? EffectiveFooterContent
  {
    get => GetValue(EffectiveFooterContentProperty);
    private set => SetValue(EffectiveFooterContentProperty, value);
  }

  public ScrollViewer? BodyScrollViewer => bodyScrollViewer;

  public Control? RestoreFocusTo { get; set; }

  public Func<FsusModalCloseRequest, ValueTask<bool>>? BeforeClose { get; set; }

  public IList<Control> FocusScope => focusScope;

  public FsusOverlayEntry? OverlayEntry { get; private set; }

  public bool IsOpen { get; private set; }

  public FsusPanelMotionState MotionState { get; private set; }

  public FsusOverlayEntry Open(
    FsusOverlayHost host,
    FsusOverlayOptions? options = null)
  {
    ArgumentNullException.ThrowIfNull(host);
    return host.Open(this, CreateOverlayOptions(options));
  }

  public virtual async ValueTask<bool> ConfirmAsync(
    CancellationToken cancellationToken = default)
  {
    var closed = await RequestCloseAsync(FsusModalCloseReason.Confirm, cancellationToken);
    if (closed)
    {
      Confirmed?.Invoke(this, EventArgs.Empty);
    }

    return closed;
  }

  public virtual async ValueTask<bool> CancelAsync(
    CancellationToken cancellationToken = default)
  {
    var closed = await RequestCloseAsync(FsusModalCloseReason.Cancel, cancellationToken);
    if (closed)
    {
      Canceled?.Invoke(this, EventArgs.Empty);
    }

    return closed;
  }

  public async ValueTask<bool> RequestCloseAsync(
    FsusModalCloseReason reason = FsusModalCloseReason.Programmatic,
    CancellationToken cancellationToken = default)
  {
    if (cancellationToken.IsCancellationRequested)
    {
      return false;
    }

    if (OverlayEntry is null || overlayHost is null)
    {
      if (!await CanCloseAsync(reason, cancellationToken))
      {
        return false;
      }

      MarkClosed(reason);
      return true;
    }

    pendingCloseReason = reason;
    try
    {
      return await overlayHost.CloseAsync(
        OverlayEntry,
        ToOverlayReason(reason),
        cancellationToken);
    }
    finally
    {
      pendingCloseReason = null;
    }
  }

  protected ValueTask<bool> HandleKeyAsync(Key key)
  {
    if (key == Key.Escape && CloseOnEscape)
    {
      return RequestCloseAsync(FsusModalCloseReason.Keyboard);
    }

    if (IsBodyScrollable && bodyScrollViewer is not null)
    {
      if (key == Key.PageDown)
      {
        ScrollPage(1);
        return ValueTask.FromResult(true);
      }
      if (key == Key.PageUp)
      {
        ScrollPage(-1);
        return ValueTask.FromResult(true);
      }
    }

    return ValueTask.FromResult(false);
  }

  protected override void OnKeyDown(KeyEventArgs e)
  {
    base.OnKeyDown(e);

    if (e.Handled)
    {
      return;
    }

    if (e.Key == Key.Escape && CloseOnEscape && AllowsPassiveClose())
    {
      e.Handled = true;
      _ = RequestCloseAsync(FsusModalCloseReason.Keyboard);
      return;
    }

    if (IsBodyScrollable && bodyScrollViewer is not null)
    {
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
  }

  protected override void OnApplyTemplate(TemplateAppliedEventArgs e)
  {
    base.OnApplyTemplate(e);

    bodyScrollViewer = e.NameScope.Find<ScrollViewer>("PART_ScrollViewer");
    headerPresenter = e.NameScope.Find<Control>("PART_HeaderPresenter");
    footerPresenter = e.NameScope.Find<Control>("PART_FooterPresenter");
    bodyPresenter = e.NameScope.Find<Control>("PART_BodyPresenter");

    SyncState();
  }

  protected override Size MeasureOverride(Size availableSize)
  {
    if (!IsBodyScrollable)
    {
      return base.MeasureOverride(availableSize);
    }

    var maxViewportHeight = ResolveMaxViewportHeight();
    var constrainedAvailableSize = availableSize;

    if (!double.IsInfinity(maxViewportHeight) && maxViewportHeight > 0)
    {
      var maxAllowedDialogHeight = Math.Max(
        !double.IsNaN(MinHeight) && MinHeight > 0 ? MinHeight : 100,
        maxViewportHeight - 32);

      if (!double.IsNaN(MaxHeight) && MaxHeight > 0 && MaxHeight < maxAllowedDialogHeight)
      {
        maxAllowedDialogHeight = MaxHeight;
      }

      if (double.IsInfinity(constrainedAvailableSize.Height) || constrainedAvailableSize.Height > maxAllowedDialogHeight)
      {
        constrainedAvailableSize = new Size(constrainedAvailableSize.Width, maxAllowedDialogHeight);
      }
    }

    if (bodyScrollViewer is not null)
    {
      if (!double.IsInfinity(MaxBodyHeight) && MaxBodyHeight > 0)
      {
        bodyScrollViewer.MaxHeight = MaxBodyHeight;
      }
      else if (!double.IsInfinity(constrainedAvailableSize.Height))
      {
        var nonBodyHeight = Padding.Top + Padding.Bottom;
        if (headerPresenter is not null && headerPresenter.IsVisible)
        {
          headerPresenter.Measure(new Size(constrainedAvailableSize.Width, double.PositiveInfinity));
          nonBodyHeight += headerPresenter.DesiredSize.Height + headerPresenter.Margin.Top + headerPresenter.Margin.Bottom;
        }
        if (footerPresenter is not null && footerPresenter.IsVisible)
        {
          footerPresenter.Measure(new Size(constrainedAvailableSize.Width, double.PositiveInfinity));
          nonBodyHeight += footerPresenter.DesiredSize.Height + footerPresenter.Margin.Top + footerPresenter.Margin.Bottom;
        }

        var maxBodyAllowed = Math.Max(40, constrainedAvailableSize.Height - nonBodyHeight);
        bodyScrollViewer.MaxHeight = maxBodyAllowed;
      }
      else
      {
        bodyScrollViewer.MaxHeight = double.PositiveInfinity;
      }
    }

    return base.MeasureOverride(constrainedAvailableSize);
  }

  internal FsusOverlayOptions CreateOverlayOptions(FsusOverlayOptions? options = null)
  {
    var resolvedOptions = options ?? new FsusOverlayOptions();
    var externalClosing = resolvedOptions.Closing;
    return resolvedOptions with
    {
      IsModal = IsModal,
      CloseOnEscape = AllowsPassiveClose() && CloseOnEscape,
      CloseOnPointerOutside = AllowsPassiveClose() && CloseOnPointerOutside,
      RestoreFocusTo = RestoreFocusTo ?? resolvedOptions.RestoreFocusTo,
      FocusScope = focusScope.Count > 0 ? focusScope.ToArray() : resolvedOptions.FocusScope,
      Closing = async (request) =>
      {
        var reason = pendingCloseReason ?? FromOverlayReason(request.Reason);
        if (!await CanCloseAsync(reason, request.CancellationToken))
        {
          return false;
        }

        return externalClosing is null || await externalClosing(request);
      },
    };
  }

  public virtual void OnOverlayOpened(FsusOverlayEntry entry)
  {
    OverlayEntry = entry;
    overlayHost = entry.Content.Parent as FsusOverlayHost;
    IsOpen = true;
    MotionState = FsusPanelMotionState.Open;
    SyncState();
    Opened?.Invoke(this, EventArgs.Empty);
  }

  public virtual void OnOverlayClosed(FsusOverlayCloseReason reason)
  {
    MarkClosed(pendingCloseReason ?? FromOverlayReason(reason));
  }

  protected override void OnPropertyChanged(AvaloniaPropertyChangedEventArgs change)
  {
    base.OnPropertyChanged(change);

    if (
      change.Property == IsModalProperty ||
      change.Property == IsLoadingProperty ||
      change.Property == IsDangerousProperty ||
      change.Property == CloseOnEscapeProperty ||
      change.Property == CloseOnPointerOutsideProperty ||
      change.Property == ClosePolicyProperty ||
      change.Property == TitleProperty ||
      change.Property == BodyContentProperty ||
      change.Property == FooterContentProperty ||
      change.Property == ConfirmContentProperty ||
      change.Property == CancelContentProperty ||
      change.Property == ContentProperty ||
      change.Property == IsBodyScrollableProperty ||
      change.Property == MaxBodyHeightProperty ||
      change.Property == ViewportHeightConstraintProperty)
    {
      UpdateEffectiveContent();
      SyncState();
    }
  }

  protected virtual void SyncState()
  {
    FsusComponentClasses.Ensure(this, "fsus-modal", IsModal);
    FsusComponentClasses.Ensure(this, "fsus-loading", IsLoading);
    FsusComponentClasses.Ensure(this, "fsus-dangerous", IsDangerous);
    FsusComponentClasses.Ensure(this, "fsus-open", IsOpen);
    FsusComponentClasses.Ensure(this, "fsus-hidden", !IsOpen);
    FsusComponentClasses.Ensure(this, "fsus-entering", MotionState == FsusPanelMotionState.Entering);
    FsusComponentClasses.Ensure(this, "fsus-leaving", MotionState == FsusPanelMotionState.Leaving);
    FsusComponentClasses.Ensure(this, "fsus-has-title", !string.IsNullOrWhiteSpace(Title));
    FsusComponentClasses.Ensure(this, "fsus-has-footer", EffectiveFooterContent is not null);
    FsusComponentClasses.Ensure(this, "fsus-has-confirm", ConfirmContent is not null);
    FsusComponentClasses.Ensure(this, "fsus-has-cancel", CancelContent is not null);
    FsusComponentClasses.Ensure(this, "fsus-scrollable-body", IsBodyScrollable);
    AutomationProperties.SetName(this, FsusComponentClasses.ResolveName(Title, Content ?? BodyContent));
    AutomationProperties.SetHelpText(this, (BodyContent ?? Content)?.ToString() ?? string.Empty);
    AutomationProperties.SetControlTypeOverride(this, AutomationControlType.Group);
    AutomationProperties.SetClassNameOverride(this, "Dialog");
    AutomationProperties.SetItemStatus(this, ModalStatus());

    if (bodyScrollViewer is not null)
    {
      bodyScrollViewer.VerticalScrollBarVisibility =
        IsBodyScrollable ? ScrollBarVisibility.Auto : ScrollBarVisibility.Disabled;
      bodyScrollViewer.HorizontalScrollBarVisibility = ScrollBarVisibility.Disabled;
    }

    if (headerPresenter is not null)
    {
      headerPresenter.IsVisible = !string.IsNullOrWhiteSpace(Title);
      headerPresenter.Margin = headerPresenter.IsVisible ? new Thickness(0, 0, 0, 16) : new Thickness(0);
    }

    if (footerPresenter is not null)
    {
      footerPresenter.IsVisible = EffectiveFooterContent is not null;
      footerPresenter.Margin = footerPresenter.IsVisible ? new Thickness(0, 16, 0, 0) : new Thickness(0);
    }
  }

  public void ScrollBodyIntoView(Control control)
  {
    ArgumentNullException.ThrowIfNull(control);

    if (bodyScrollViewer is null)
    {
      control.BringIntoView();
      return;
    }

    control.BringIntoView();

    var contentVisual = (bodyScrollViewer.Content as Visual) ?? bodyPresenter ?? (Visual)bodyScrollViewer;
    var transform = control.TransformToVisual(contentVisual);
    if (transform.HasValue)
    {
      var localBounds = new Rect(0, 0, control.Bounds.Width, control.Bounds.Height);
      var contentBounds = localBounds.TransformToAABB(transform.Value);
      var currentY = bodyScrollViewer.Offset.Y;
      var viewportHeight = bodyScrollViewer.Viewport.Height;
      var maxY = Math.Max(0, bodyScrollViewer.Extent.Height - viewportHeight);

      if (viewportHeight > 0)
      {
        if (contentBounds.Top < currentY)
        {
          var targetY = Math.Max(0, contentBounds.Top);
          bodyScrollViewer.Offset = new Vector(bodyScrollViewer.Offset.X, Math.Min(maxY, targetY));
        }
        else if (contentBounds.Bottom > currentY + viewportHeight)
        {
          var targetY = Math.Max(0, contentBounds.Bottom - viewportHeight);
          bodyScrollViewer.Offset = new Vector(bodyScrollViewer.Offset.X, Math.Min(maxY, targetY));
        }
      }
    }
  }

  public void ScrollBodyBy(double deltaY)
  {
    if (bodyScrollViewer is null)
    {
      return;
    }

    var currentY = bodyScrollViewer.Offset.Y;
    var maxY = Math.Max(0, bodyScrollViewer.Extent.Height - bodyScrollViewer.Viewport.Height);
    var targetY = Math.Clamp(currentY + deltaY, 0, maxY);
    bodyScrollViewer.Offset = new Vector(bodyScrollViewer.Offset.X, targetY);
  }

  public void ScrollPage(int direction)
  {
    if (bodyScrollViewer is null)
    {
      return;
    }

    var step = Math.Max(20, bodyScrollViewer.Viewport.Height - 20);
    ScrollBodyBy(step * direction);
  }

  public double ResolveMaxViewportHeight()
  {
    if (!double.IsNaN(ViewportHeightConstraint) && ViewportHeightConstraint > 0)
    {
      return ViewportHeightConstraint;
    }

    if (OverlayEntry is not null && OverlayEntry.Options.ViewportBounds.Height > 0)
    {
      return OverlayEntry.Options.ViewportBounds.Height;
    }

    var topLevel = TopLevel.GetTopLevel(this);
    if (topLevel is not null && topLevel.ClientSize.Height > 0)
    {
      return topLevel.ClientSize.Height;
    }

    if (Parent is Visual parentVisual && parentVisual.Bounds.Height > 0)
    {
      return parentVisual.Bounds.Height;
    }

    return double.PositiveInfinity;
  }

  private void OnChildGotFocus(object? sender, RoutedEventArgs e)
  {
    if (!IsBodyScrollable || bodyScrollViewer is null)
    {
      return;
    }

    if (e.Source is Control control && IsDescendantOf(control, bodyScrollViewer))
    {
      ScrollBodyIntoView(control);
    }
  }

  private static bool IsDescendantOf(Visual child, Visual parent)
  {
    var current = child.GetVisualParent();
    while (current is not null)
    {
      if (ReferenceEquals(current, parent))
      {
        return true;
      }
      current = current.GetVisualParent();
    }
    return false;
  }

  private void UpdateEffectiveContent()
  {
    EffectiveBodyContent = BodyContent ?? Content;
    EffectiveFooterContent = FooterContent ?? CreateDefaultFooterContent();
  }

  private object? CreateDefaultFooterContent()
  {
    if (ConfirmContent is null && CancelContent is null)
    {
      return null;
    }

    var panel = new StackPanel
    {
      Orientation = Orientation.Horizontal,
      Spacing = 8,
      HorizontalAlignment = HorizontalAlignment.Right,
    };

    if (CancelContent is not null)
    {
      var cancelButton = new Button
      {
        Content = CancelContent,
      };
      cancelButton.Classes.Add("fsus-button");
      cancelButton.Click += async (_, _) => await CancelAsync();
      panel.Children.Add(cancelButton);
    }

    if (ConfirmContent is not null)
    {
      var confirmButton = new Button
      {
        Content = ConfirmContent,
      };
      confirmButton.Classes.Add("fsus-button");
      confirmButton.Classes.Add(IsDangerous ? "fsus-danger" : "fsus-primary");
      confirmButton.Click += async (_, _) => await ConfirmAsync();
      panel.Children.Add(confirmButton);
    }

    return panel;
  }

  private static IControlTemplate CreateDefaultTemplate() =>
    new FuncControlTemplate<FsusModalSurface>((control, nameScope) =>
    {
      var border = new Border
      {
        [!Border.BackgroundProperty] = control[!BackgroundProperty],
        [!Border.BorderBrushProperty] = control[!BorderBrushProperty],
        [!Border.BorderThicknessProperty] = control[!BorderThicknessProperty],
        [!Border.CornerRadiusProperty] = control[!CornerRadiusProperty],
        [!Border.PaddingProperty] = control[!PaddingProperty],
      };

      var grid = new Grid
      {
        RowDefinitions = new RowDefinitions("Auto,*,Auto"),
      };

      var header = new ContentPresenter
      {
        Name = "PART_HeaderPresenter",
        [!ContentPresenter.ContentProperty] = control[!TitleProperty],
        FontWeight = FontWeight.SemiBold,
      };
      Grid.SetRow(header, 0);
      nameScope.Register("PART_HeaderPresenter", header);

      var scrollViewer = new ScrollViewer
      {
        Name = "PART_ScrollViewer",
        HorizontalScrollBarVisibility = ScrollBarVisibility.Disabled,
        VerticalScrollBarVisibility = control.IsBodyScrollable
          ? ScrollBarVisibility.Auto
          : ScrollBarVisibility.Disabled,
      };
      Grid.SetRow(scrollViewer, 1);
      nameScope.Register("PART_ScrollViewer", scrollViewer);

      var body = new ContentPresenter
      {
        Name = "PART_BodyPresenter",
        [!ContentPresenter.ContentProperty] = control[!EffectiveBodyContentProperty],
        [!ContentPresenter.ContentTemplateProperty] = control[!ContentTemplateProperty],
      };
      nameScope.Register("PART_BodyPresenter", body);
      scrollViewer.Content = body;

      var footer = new ContentPresenter
      {
        Name = "PART_FooterPresenter",
        [!ContentPresenter.ContentProperty] = control[!EffectiveFooterContentProperty],
      };
      Grid.SetRow(footer, 2);
      nameScope.Register("PART_FooterPresenter", footer);

      grid.Children.Add(header);
      grid.Children.Add(scrollViewer);
      grid.Children.Add(footer);
      border.Child = grid;
      return border;
    });

  protected void AddClass(string className) =>
    FsusComponentClasses.Ensure(this, className, true);

  private async ValueTask<bool> CanCloseAsync(
    FsusModalCloseReason reason,
    CancellationToken cancellationToken)
  {
    if (cancellationToken.IsCancellationRequested || ClosePolicy == FsusModalClosePolicy.Blocked)
    {
      return false;
    }

    if (
      ClosePolicy == FsusModalClosePolicy.ExplicitOnly &&
      reason is FsusModalCloseReason.Keyboard or FsusModalCloseReason.PointerOutside)
    {
      return false;
    }

    return BeforeClose is null ||
      await BeforeClose(new FsusModalCloseRequest(this, reason, cancellationToken));
  }

  private void MarkClosed(FsusModalCloseReason reason)
  {
    if (!IsOpen && OverlayEntry is null)
    {
      return;
    }

    IsOpen = false;
    MotionState = FsusPanelMotionState.Hidden;
    OverlayEntry = null;
    overlayHost = null;
    SyncState();
    Closed?.Invoke(this, new FsusModalClosedEventArgs(reason));
  }

  private bool AllowsPassiveClose() => ClosePolicy == FsusModalClosePolicy.Any;

  private string ModalStatus()
  {
    var parts = new List<string>();
    if (IsModal)
    {
      parts.Add("modal");
    }
    parts.Add(IsOpen ? "open" : "closed");
    if (IsDangerous)
    {
      parts.Add("dangerous");
    }
    if (IsLoading)
    {
      parts.Add("loading");
    }
    if (IsBodyScrollable)
    {
      parts.Add("scrollable");
    }
    return string.Join(' ', parts);
  }

  private static FsusOverlayCloseReason ToOverlayReason(FsusModalCloseReason reason) =>
    reason switch
    {
      FsusModalCloseReason.Keyboard => FsusOverlayCloseReason.Keyboard,
      FsusModalCloseReason.PointerOutside => FsusOverlayCloseReason.PointerOutside,
      _ => FsusOverlayCloseReason.Programmatic,
    };

  protected static FsusModalCloseReason FromOverlayReason(FsusOverlayCloseReason reason) =>
    reason switch
    {
      FsusOverlayCloseReason.Keyboard => FsusModalCloseReason.Keyboard,
      FsusOverlayCloseReason.PointerOutside => FsusModalCloseReason.PointerOutside,
      _ => FsusModalCloseReason.Programmatic,
    };
}

public class FsusDialog : FsusModalSurface
{
  public FsusDialog() : base("fsus-dialog-surface")
  {
    AddClass("fsus-dialog");
  }
}

public class FsusDrawer : FsusModalSurface
{
  public static readonly StyledProperty<FsusDrawerPlacement> PlacementProperty =
    AvaloniaProperty.Register<FsusDrawer, FsusDrawerPlacement>(
      nameof(Placement),
      FsusDrawerPlacement.Right);

  public FsusDrawer() : base("fsus-drawer")
  {
    AutomationProperties.SetControlTypeOverride(this, AutomationControlType.Pane);
    SyncState();
  }

  public FsusDrawerPlacement Placement
  {
    get => GetValue(PlacementProperty);
    set => SetValue(PlacementProperty, value);
  }

  protected override void OnPropertyChanged(AvaloniaPropertyChangedEventArgs change)
  {
    base.OnPropertyChanged(change);

    if (change.Property == PlacementProperty)
    {
      SyncState();
    }
  }

  protected override void SyncState()
  {
    base.SyncState();
    foreach (var className in new[]
    {
      "fsus-drawer-left",
      "fsus-drawer-right",
      "fsus-drawer-top",
      "fsus-drawer-bottom",
    })
    {
      FsusComponentClasses.Ensure(this, className, false);
    }

    FsusComponentClasses.Ensure(this, $"fsus-drawer-{PlacementName(Placement)}", true);
    AutomationProperties.SetControlTypeOverride(this, AutomationControlType.Pane);
    AutomationProperties.SetClassNameOverride(this, "Drawer");
  }

  private static string PlacementName(FsusDrawerPlacement placement) =>
    placement switch
    {
      FsusDrawerPlacement.Left => "left",
      FsusDrawerPlacement.Top => "top",
      FsusDrawerPlacement.Bottom => "bottom",
      _ => "right",
    };
}

public sealed record FsusMessageBoxOptions
{
  public string? Title { get; init; }
  public string? Message { get; init; }
  public bool IsDangerous { get; init; }
  public bool IsLoading { get; init; }
  public string? ConfirmText { get; init; }
  public string? CancelText { get; init; }
  public Func<FsusModalCloseRequest, ValueTask<bool>>? BeforeClose { get; init; }
}

public class FsusMessageBox : FsusDialog
{
  public static readonly StyledProperty<string?> MessageProperty =
    AvaloniaProperty.Register<FsusMessageBox, string?>(nameof(Message));

  public static readonly StyledProperty<string?> ConfirmTextProperty =
    AvaloniaProperty.Register<FsusMessageBox, string?>(nameof(ConfirmText), "OK");

  public static readonly StyledProperty<string?> CancelTextProperty =
    AvaloniaProperty.Register<FsusMessageBox, string?>(nameof(CancelText), "Cancel");

  private FsusMessageBoxResult pendingResult = FsusMessageBoxResult.None;

  public FsusMessageBox()
  {
    AddClass("fsus-message-box");
    CloseOnPointerOutside = false;
    SyncState();
  }

  public string? Message
  {
    get => GetValue(MessageProperty);
    set => SetValue(MessageProperty, value);
  }

  public string? ConfirmText
  {
    get => GetValue(ConfirmTextProperty);
    set => SetValue(ConfirmTextProperty, value);
  }

  public string? CancelText
  {
    get => GetValue(CancelTextProperty);
    set => SetValue(CancelTextProperty, value);
  }

  public FsusMessageBoxResult Result { get; private set; } = FsusMessageBoxResult.None;

  public new async ValueTask<FsusMessageBoxResult> ConfirmAsync(
    CancellationToken cancellationToken = default)
  {
    if (cancellationToken.IsCancellationRequested)
    {
      return FsusMessageBoxResult.None;
    }

    pendingResult = FsusMessageBoxResult.Confirm;
    var closed = await base.ConfirmAsync(cancellationToken);
    if (!closed)
    {
      pendingResult = FsusMessageBoxResult.None;
      return FsusMessageBoxResult.None;
    }

    return Result;
  }

  public new async ValueTask<FsusMessageBoxResult> CancelAsync(
    CancellationToken cancellationToken = default)
  {
    if (cancellationToken.IsCancellationRequested)
    {
      return FsusMessageBoxResult.None;
    }

    pendingResult = FsusMessageBoxResult.Cancel;
    var closed = await base.CancelAsync(cancellationToken);
    if (!closed)
    {
      pendingResult = FsusMessageBoxResult.None;
      return FsusMessageBoxResult.None;
    }

    return Result;
  }

  public override void OnOverlayClosed(FsusOverlayCloseReason reason)
  {
    Result = pendingResult == FsusMessageBoxResult.None
      ? FsusMessageBoxResult.Closed
      : pendingResult;
    pendingResult = FsusMessageBoxResult.None;
    base.OnOverlayClosed(reason);
  }

  protected override void OnPropertyChanged(AvaloniaPropertyChangedEventArgs change)
  {
    base.OnPropertyChanged(change);

    if (
      change.Property == MessageProperty ||
      change.Property == ConfirmTextProperty ||
      change.Property == CancelTextProperty)
    {
      BodyContent = Message;
      ConfirmContent = ConfirmText;
      CancelContent = CancelText;
      SyncState();
    }
  }

  protected override void SyncState()
  {
    base.SyncState();
    FsusComponentClasses.Ensure(this, "fsus-result-confirm", Result == FsusMessageBoxResult.Confirm);
    FsusComponentClasses.Ensure(this, "fsus-result-cancel", Result == FsusMessageBoxResult.Cancel);
    AutomationProperties.SetClassNameOverride(this, "MessageBox");
  }
}

public sealed class FsusMessageBoxService(FsusOverlayHost host)
{
  private readonly FsusOverlayHost host = host;

  public FsusMessageBox Show(FsusMessageBoxOptions options)
  {
    ArgumentNullException.ThrowIfNull(options);
    var messageBox = new FsusMessageBox
    {
      Title = options.Title,
      Message = options.Message,
      BodyContent = options.Message,
      ConfirmText = options.ConfirmText ?? "OK",
      CancelText = options.CancelText ?? "Cancel",
      ConfirmContent = options.ConfirmText ?? "OK",
      CancelContent = options.CancelText ?? "Cancel",
      IsDangerous = options.IsDangerous,
      IsLoading = options.IsLoading,
      BeforeClose = options.BeforeClose,
    };

    host.OpenMessageBox(messageBox);
    return messageBox;
  }
}
