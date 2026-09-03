using Avalonia;
using Avalonia.Automation;
using Avalonia.Automation.Peers;
using Avalonia.Collections;
using Avalonia.Controls;
using Avalonia.Controls.Primitives;
using Avalonia.Controls.Shapes;
using Avalonia.Input;
using Avalonia.Interactivity;
using Avalonia.Threading;
using FsusUI.Avalonia.Overlay;
using System.Windows.Input;

namespace FsusUI.Avalonia.Controls;

public enum FsusServiceType
{
  Info,
  Success,
  Warning,
  Danger,
}

public enum FsusServicePlacement
{
  TopRight,
  TopLeft,
  BottomRight,
  BottomLeft,
}

public sealed record FsusMessageOptions
{
  public string Message { get; init; } = string.Empty;
  public FsusServiceType Type { get; init; } = FsusServiceType.Info;
  public TimeSpan Duration { get; init; } = TimeSpan.FromSeconds(3);
  public string? GroupKey { get; init; }
  public bool GroupSimilar { get; init; }
  public FsusServicePlacement Placement { get; init; } = FsusServicePlacement.TopRight;
  public bool ReducedMotion { get; init; }
}

public sealed record FsusNotificationOptions
{
  public string Title { get; init; } = string.Empty;
  public string Message { get; init; } = string.Empty;
  public FsusServiceType Type { get; init; } = FsusServiceType.Info;
  public FsusServicePlacement Placement { get; init; } = FsusServicePlacement.TopRight;
  public bool CloseOnClick { get; init; }
  public bool ReducedMotion { get; init; }

  /// <summary>
  /// Auto-close delay. <see cref="TimeSpan.Zero"/> keeps the notification open
  /// until it is dismissed or closed programmatically.
  /// </summary>
  public TimeSpan Duration { get; init; } = TimeSpan.Zero;

  /// <summary>Optional visible label for a single notification action.</summary>
  public string? ActionLabel { get; init; }

  /// <summary>Executed when the action control is activated.</summary>
  public ICommand? ActionCommand { get; init; }
}

public sealed record FsusLoadingOptions
{
  public string Text { get; init; } = string.Empty;
  public bool ReducedMotion { get; init; }
}

public sealed class FsusServiceHandle<TControl>(
  TControl control,
  Func<FsusServiceHandle<TControl>, CancellationToken, ValueTask<bool>> closeAsync)
  where TControl : Control
{
  private readonly Func<FsusServiceHandle<TControl>, CancellationToken, ValueTask<bool>> closeAsync = closeAsync;

  public TControl Control { get; } = control;
  public FsusOverlayEntry? OverlayEntry { get; internal set; }
  public bool IsClosed { get; private set; }

  public async ValueTask<bool> CloseAsync(CancellationToken cancellationToken = default)
  {
    if (IsClosed)
    {
      return true;
    }

    if (cancellationToken.IsCancellationRequested)
    {
      return false;
    }

    var closed = await closeAsync(this, cancellationToken);
    if (closed)
    {
      IsClosed = true;
    }

    return closed;
  }

  public ValueTask<bool> DisposeAsync() => CloseAsync();
}

public sealed class FsusMessageService(FsusOverlayHost host)
{
  private readonly FsusOverlayHost host = host;
  private readonly List<FsusServiceHandle<FsusMessageToast>> activeMessages = [];

  public IReadOnlyList<FsusServiceHandle<FsusMessageToast>> ActiveMessages =>
    activeMessages.AsReadOnly();

  public ValueTask<FsusServiceHandle<FsusMessageToast>?> ShowAsync(
    FsusMessageOptions options,
    CancellationToken cancellationToken = default)
  {
    ArgumentNullException.ThrowIfNull(options);
    if (cancellationToken.IsCancellationRequested)
    {
      return ValueTask.FromResult<FsusServiceHandle<FsusMessageToast>?>(null);
    }

    if (options.GroupSimilar && !string.IsNullOrWhiteSpace(options.GroupKey))
    {
      var grouped = activeMessages.FirstOrDefault(
        (handle) => handle.Control.GroupKey == options.GroupKey);
      if (grouped is not null)
      {
        grouped.Control.Message = options.Message;
        grouped.Control.GroupCount++;
        grouped.Control.SyncState();
        return ValueTask.FromResult<FsusServiceHandle<FsusMessageToast>?>(grouped);
      }
    }

    var toast = new FsusMessageToast
    {
      Message = options.Message,
      Type = options.Type,
      Duration = options.Duration,
      GroupKey = options.GroupKey,
      Placement = options.Placement,
      ReducedMotion = options.ReducedMotion,
    };
    toast.SyncState();
    var handle = new FsusServiceHandle<FsusMessageToast>(
      toast,
      async (current, token) =>
      {
        if (current.OverlayEntry is not null)
        {
          if (!await host.CloseAsync(current.OverlayEntry, cancellationToken: token))
          {
            return false;
          }
        }

        toast.MarkClosed();
        activeMessages.Remove(current);
        return true;
      });
    handle.OverlayEntry = host.Open(
      toast,
      FsusServiceVisuals.CreateServiceOverlayOptions(options.Placement, host));
    activeMessages.Add(handle);
    return ValueTask.FromResult<FsusServiceHandle<FsusMessageToast>?>(handle);
  }
}

public sealed class FsusNotificationService(FsusOverlayHost host)
{
  private readonly FsusOverlayHost host = host;
  private readonly List<FsusServiceHandle<FsusNotification>> activeNotifications = [];

  public IReadOnlyList<FsusServiceHandle<FsusNotification>> ActiveNotifications =>
    activeNotifications.AsReadOnly();

  public ValueTask<FsusServiceHandle<FsusNotification>?> ShowAsync(
    FsusNotificationOptions options,
    CancellationToken cancellationToken = default)
  {
    ArgumentNullException.ThrowIfNull(options);
    if (cancellationToken.IsCancellationRequested)
    {
      return ValueTask.FromResult<FsusServiceHandle<FsusNotification>?>(null);
    }

    var notification = new FsusNotification
    {
      Title = options.Title,
      Message = options.Message,
      Type = options.Type,
      Placement = options.Placement,
      CloseOnClick = options.CloseOnClick,
      ReducedMotion = options.ReducedMotion,
      Duration = options.Duration,
      ActionLabel = options.ActionLabel,
      ActionCommand = options.ActionCommand,
    };
    notification.SyncState();
    var handle = new FsusServiceHandle<FsusNotification>(
      notification,
      async (current, token) =>
      {
        if (current.OverlayEntry is not null)
        {
          if (!await host.CloseAsync(current.OverlayEntry, cancellationToken: token))
          {
            return false;
          }
        }

        notification.MarkClosed();
        activeNotifications.Remove(current);
        return true;
      });
    notification.DismissRequested += (_, _) =>
    {
      _ = handle.CloseAsync();
    };
    handle.OverlayEntry = host.Open(
      notification,
      FsusServiceVisuals.CreateServiceOverlayOptions(options.Placement, host));
    activeNotifications.Add(handle);
    return ValueTask.FromResult<FsusServiceHandle<FsusNotification>?>(handle);
  }
}

public sealed class FsusLoadingService
{
  private readonly Dictionary<Control, FsusServiceHandle<FsusLoadingOverlay>> activeScopes =
    new(ReferenceEqualityComparer.Instance);

  public IReadOnlyCollection<Control> ActiveScopes => activeScopes.Keys;

  public bool IsScopeBusy(Control scope) => activeScopes.ContainsKey(scope);

  public ValueTask<FsusServiceHandle<FsusLoadingOverlay>?> ShowAsync(
    Control scope,
    FsusLoadingOptions options,
    CancellationToken cancellationToken = default)
  {
    ArgumentNullException.ThrowIfNull(scope);
    ArgumentNullException.ThrowIfNull(options);
    if (cancellationToken.IsCancellationRequested)
    {
      return ValueTask.FromResult<FsusServiceHandle<FsusLoadingOverlay>?>(null);
    }

    if (activeScopes.TryGetValue(scope, out var existing))
    {
      return ValueTask.FromResult<FsusServiceHandle<FsusLoadingOverlay>?>(existing);
    }

    var overlay = new FsusLoadingOverlay
    {
      Scope = scope,
      Text = options.Text,
      ReducedMotion = options.ReducedMotion,
    };
    overlay.SyncState();
    var handle = new FsusServiceHandle<FsusLoadingOverlay>(
      overlay,
      (current, token) =>
      {
        if (token.IsCancellationRequested)
        {
          return ValueTask.FromResult(false);
        }

        overlay.MarkClosed();
        activeScopes.Remove(scope);
        return ValueTask.FromResult(true);
      });
    activeScopes[scope] = handle;
    return ValueTask.FromResult<FsusServiceHandle<FsusLoadingOverlay>?>(handle);
  }
}

public class FsusMessageToast : ContentControl
{
  public string Message { get; set; } = string.Empty;
  public FsusServiceType Type { get; set; } = FsusServiceType.Info;
  public TimeSpan Duration { get; set; } = TimeSpan.FromSeconds(3);
  public string? GroupKey { get; set; }
  public int GroupCount { get; set; } = 1;
  public FsusServicePlacement Placement { get; set; } = FsusServicePlacement.TopRight;
  public bool ReducedMotion { get; set; }
  public bool IsClosed { get; private set; }

  public FsusMessageToast()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-message-toast");
    SyncState();
  }

  internal void MarkClosed()
  {
    IsClosed = true;
    SyncState();
  }

  internal void SyncState()
  {
    FsusServiceVisuals.SyncServiceClasses(this, Type, Placement, ReducedMotion);
    FsusComponentClasses.Ensure(this, "fsus-grouped", GroupCount > 1);
    FsusComponentClasses.Ensure(this, "fsus-closed", IsClosed);
    AutomationProperties.SetName(this, Message);
    AutomationProperties.SetControlTypeOverride(this, AutomationControlType.Group);
    AutomationProperties.SetItemStatus(
      this,
      $"{FsusServiceVisuals.TypeName(Type)}{(GroupCount > 1 ? $" grouped x{GroupCount}" : string.Empty)}");
  }
}

public class FsusNotification : ContentControl
{
  public static readonly StyledProperty<string> TitleProperty =
    AvaloniaProperty.Register<FsusNotification, string>(nameof(Title), string.Empty);

  public static readonly StyledProperty<string> MessageProperty =
    AvaloniaProperty.Register<FsusNotification, string>(nameof(Message), string.Empty);

  public static readonly StyledProperty<string?> ActionLabelProperty =
    AvaloniaProperty.Register<FsusNotification, string?>(nameof(ActionLabel));

  public static readonly StyledProperty<ICommand?> ActionCommandProperty =
    AvaloniaProperty.Register<FsusNotification, ICommand?>(nameof(ActionCommand));

  private DispatcherTimer? timeoutTimer;
  private Button? actionButton;
  private Button? dismissButton;
  private bool isPointerOver;

  public string Title
  {
    get => GetValue(TitleProperty);
    set => SetValue(TitleProperty, value);
  }

  public string Message
  {
    get => GetValue(MessageProperty);
    set => SetValue(MessageProperty, value);
  }

  public FsusServiceType Type { get; set; } = FsusServiceType.Info;
  public FsusServicePlacement Placement { get; set; } = FsusServicePlacement.TopRight;
  public bool CloseOnClick { get; set; }
  public bool ReducedMotion { get; set; }
  public TimeSpan Duration { get; set; } = TimeSpan.Zero;

  public string? ActionLabel
  {
    get => GetValue(ActionLabelProperty);
    set => SetValue(ActionLabelProperty, value);
  }

  public ICommand? ActionCommand
  {
    get => GetValue(ActionCommandProperty);
    set => SetValue(ActionCommandProperty, value);
  }

  public bool IsClosed { get; private set; }

  /// <summary>Raised when the action control is activated. Distinct from dismissal.</summary>
  public event EventHandler? ActionActivated;

  /// <summary>Raised by the dismiss control, surface click, or timeout.</summary>
  public event EventHandler? DismissRequested;

  public FsusNotification()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-notification");
    SyncState();
  }

  internal void MarkClosed()
  {
    IsClosed = true;
    StopTimeout();
    SyncState();
  }

  internal void SyncState()
  {
    FsusServiceVisuals.SyncServiceClasses(this, Type, Placement, ReducedMotion);
    FsusComponentClasses.Ensure(this, "fsus-close-on-click", CloseOnClick);
    FsusComponentClasses.Ensure(this, "fsus-has-action", !string.IsNullOrWhiteSpace(ActionLabel));
    FsusComponentClasses.Ensure(this, "fsus-has-title", !string.IsNullOrWhiteSpace(Title));
    FsusComponentClasses.Ensure(this, "fsus-has-message", !string.IsNullOrWhiteSpace(Message));
    FsusComponentClasses.Ensure(this, "fsus-closed", IsClosed);
    AutomationProperties.SetName(this, FsusComponentClasses.ResolveName(Title, Message));
    AutomationProperties.SetHelpText(this, Message);
    AutomationProperties.SetControlTypeOverride(this, AutomationControlType.Group);
    AutomationProperties.SetItemStatus(this, FsusServiceVisuals.TypeName(Type));
  }

  protected override void OnApplyTemplate(TemplateAppliedEventArgs e)
  {
    base.OnApplyTemplate(e);
    actionButton = e.NameScope.Find<Button>("PART_ActionButton");
    dismissButton = e.NameScope.Find<Button>("PART_DismissButton");
    if (actionButton is not null)
    {
      AutomationProperties.SetName(actionButton, ActionLabel ?? "Action");
      actionButton.Click += OnActionClick;
    }
    if (dismissButton is not null)
    {
      AutomationProperties.SetName(dismissButton, "Dismiss");
      dismissButton.Click += OnDismissClick;
    }
  }

  protected override void OnAttachedToVisualTree(VisualTreeAttachmentEventArgs e)
  {
    base.OnAttachedToVisualTree(e);
    isPointerOver = IsPointerOver;
    ArmTimeout();
  }

  protected override void OnDetachedFromVisualTree(VisualTreeAttachmentEventArgs e)
  {
    base.OnDetachedFromVisualTree(e);
    isPointerOver = false;
    StopTimeout();
  }

  protected override void OnPointerEntered(PointerEventArgs e)
  {
    base.OnPointerEntered(e);
    isPointerOver = true;
    StopTimeout();
  }

  protected override void OnPointerExited(PointerEventArgs e)
  {
    base.OnPointerExited(e);
    isPointerOver = false;
    ArmTimeout();
  }

  protected override void OnPointerCaptureLost(PointerCaptureLostEventArgs e)
  {
    base.OnPointerCaptureLost(e);
    if (!IsPointerOver)
    {
      isPointerOver = false;
      ArmTimeout();
    }
  }

  protected override void OnPointerPressed(PointerPressedEventArgs e)
  {
    base.OnPointerPressed(e);

    if (!CloseOnClick || e.Handled || IsClosed)
    {
      return;
    }

    if (IsInsideNamedButton(e.Source as Control))
    {
      return;
    }

    RaiseDismissRequested();
    e.Handled = true;
  }

  private void OnActionClick(object? sender, RoutedEventArgs e)
  {
    if (IsClosed)
    {
      return;
    }

    ActionActivated?.Invoke(this, EventArgs.Empty);
  }

  protected override void OnPropertyChanged(AvaloniaPropertyChangedEventArgs change)
  {
    base.OnPropertyChanged(change);

    if (
      change.Property == TitleProperty ||
      change.Property == MessageProperty ||
      change.Property == ActionLabelProperty ||
      change.Property == ActionCommandProperty)
    {
      SyncState();
    }
  }

  private void OnDismissClick(object? sender, RoutedEventArgs e) => RaiseDismissRequested();

  private void RaiseDismissRequested()
  {
    if (IsClosed)
    {
      return;
    }

    StopTimeout();
    DismissRequested?.Invoke(this, EventArgs.Empty);
  }

  private void ArmTimeout()
  {
    if (Duration <= TimeSpan.Zero || IsClosed || isPointerOver)
    {
      return;
    }

    StopTimeout();
    timeoutTimer = new DispatcherTimer { Interval = Duration };
    timeoutTimer.Tick += OnTimeoutTick;
    timeoutTimer.Start();
  }

  private void StopTimeout()
  {
    if (timeoutTimer is not null)
    {
      timeoutTimer.Stop();
      timeoutTimer.Tick -= OnTimeoutTick;
      timeoutTimer = null;
    }
  }

  private void OnTimeoutTick(object? sender, EventArgs e) => RaiseDismissRequested();

  private bool IsInsideNamedButton(Control? source)
  {
    if (source is null)
    {
      return false;
    }

    return (actionButton is not null && IsSelfOrDescendant(source, actionButton)) ||
      (dismissButton is not null && IsSelfOrDescendant(source, dismissButton));
  }

  private static bool IsSelfOrDescendant(Control source, Control target)
  {
    for (var current = source; current is not null; current = current.Parent as Control)
    {
      if (ReferenceEquals(current, target))
      {
        return true;
      }
    }

    return false;
  }
}

public class FsusLoadingOverlay : ContentControl
{
  public Control? Scope { get; set; }
  public string Text { get; set; } = string.Empty;
  public bool ReducedMotion { get; set; }
  public bool IsClosed { get; private set; }

  public FsusLoadingOverlay()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-loading-overlay");
    SyncState();
  }

  internal void MarkClosed()
  {
    IsClosed = true;
    SyncState();
  }

  internal void SyncState()
  {
    FsusComponentClasses.Ensure(this, "fsus-motion-reduced", ReducedMotion);
    FsusComponentClasses.Ensure(this, "fsus-closed", IsClosed);
    AutomationProperties.SetName(this, Text);
    AutomationProperties.SetControlTypeOverride(this, AutomationControlType.ProgressBar);
    AutomationProperties.SetItemStatus(this, IsClosed ? "closed" : "loading");
  }
}

public class FsusLoadingIndicator : TemplatedControl
{
  public static readonly StyledProperty<bool> IsActiveProperty =
    AvaloniaProperty.Register<FsusLoadingIndicator, bool>(nameof(IsActive));

  public static readonly StyledProperty<bool> IsIndeterminateProperty =
    AvaloniaProperty.Register<FsusLoadingIndicator, bool>(
      nameof(IsIndeterminate),
      true);

  public static readonly StyledProperty<double> ValueProperty =
    AvaloniaProperty.Register<FsusLoadingIndicator, double>(nameof(Value));

  public static readonly StyledProperty<bool> ReducedMotionProperty =
    AvaloniaProperty.Register<FsusLoadingIndicator, bool>(nameof(ReducedMotion));

  public static readonly StyledProperty<string?> AccessibleNameProperty =
    AvaloniaProperty.Register<FsusLoadingIndicator, string?>(nameof(AccessibleName));

  private const string ProgressArcPartName = "PART_Arc";

  // Mirrors FsusThemeResourceKeys.MotionModeCurrent; the Themes project
  // references this assembly, so the constant cannot be reused from here.
  private const string MotionModeCurrentResourceKey = "FsusMotionModeCurrent";

  private Ellipse? progressArc;

  public FsusLoadingIndicator()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-loading-indicator");
    SyncState();
  }

  public bool IsActive
  {
    get => GetValue(IsActiveProperty);
    set => SetValue(IsActiveProperty, value);
  }

  public bool IsIndeterminate
  {
    get => GetValue(IsIndeterminateProperty);
    set => SetValue(IsIndeterminateProperty, value);
  }

  public double Value
  {
    get => GetValue(ValueProperty);
    set => SetValue(ValueProperty, value);
  }

  public bool ReducedMotion
  {
    get => GetValue(ReducedMotionProperty);
    set => SetValue(ReducedMotionProperty, value);
  }

  public string? AccessibleName
  {
    get => GetValue(AccessibleNameProperty);
    set => SetValue(AccessibleNameProperty, value);
  }

  protected override void OnApplyTemplate(TemplateAppliedEventArgs e)
  {
    base.OnApplyTemplate(e);
    if (progressArc is not null)
    {
      progressArc.PropertyChanged -= OnProgressArcPropertyChanged;
    }

    progressArc = e.NameScope.Find<Ellipse>(ProgressArcPartName);
    if (progressArc is not null)
    {
      progressArc.PropertyChanged += OnProgressArcPropertyChanged;
    }

    UpdateProgressArc();
  }

  private void OnProgressArcPropertyChanged(object? sender, AvaloniaPropertyChangedEventArgs e)
  {
    if (e.Property == BoundsProperty || e.Property == Shape.StrokeThicknessProperty)
    {
      UpdateProgressArc();
    }
  }

  protected override void OnAttachedToVisualTree(VisualTreeAttachmentEventArgs e)
  {
    base.OnAttachedToVisualTree(e);
    SyncState();
    // During a single Show() pass the window's resources can be applied after
    // the attach callback runs; re-sync once the layout queue drains so the
    // theme motion mode is reflected.
    Dispatcher.UIThread.Post(SyncState, DispatcherPriority.Loaded);
  }

  protected override void OnPropertyChanged(AvaloniaPropertyChangedEventArgs change)
  {
    base.OnPropertyChanged(change);

    if (
      change.Property == IsActiveProperty ||
      change.Property == IsIndeterminateProperty ||
      change.Property == ValueProperty ||
      change.Property == ReducedMotionProperty ||
      change.Property == AccessibleNameProperty)
    {
      SyncState();
    }
  }

  internal void SyncState()
  {
    var reducedMotion = EffectiveReducedMotion();
    FsusComponentClasses.Ensure(this, "fsus-active", IsActive);
    FsusComponentClasses.Ensure(this, "fsus-idle", !IsActive);
    FsusComponentClasses.Ensure(this, "fsus-indeterminate", IsIndeterminate);
    FsusComponentClasses.Ensure(this, "fsus-determinate", !IsIndeterminate);
    FsusComponentClasses.Ensure(this, "fsus-motion-reduced", reducedMotion);
    AutomationProperties.SetName(this, AccessibleName ?? "Loading");
    AutomationProperties.SetControlTypeOverride(this, AutomationControlType.ProgressBar);
    AutomationProperties.SetItemStatus(this, IsActive ? "loading" : "idle");
    UpdateProgressArc();
  }

  private bool EffectiveReducedMotion()
  {
    if (ReducedMotion)
    {
      return true;
    }

    if (Application.Current is { } application &&
        application.Resources.TryGetValue(MotionModeCurrentResourceKey, out var mode) &&
        mode is string modeName &&
        (modeName == "reduced" || modeName == "disabled"))
    {
      return true;
    }

    return false;
  }

  private void UpdateProgressArc()
  {
    if (progressArc is null || progressArc.Bounds.Width <= 0)
    {
      return;
    }

    var thickness = progressArc.StrokeThickness;
    var radius = Math.Max(0d, (progressArc.Bounds.Width - thickness) / 2);
    var circumference = 2 * Math.PI * radius;
    var circumferenceUnits = thickness > 0 ? circumference / thickness : 0;
    var dashUnits = IsIndeterminate
      ? circumferenceUnits / 4
      : Math.Clamp(Value, 0d, 1d) * circumferenceUnits;

    progressArc.StrokeDashArray = new AvaloniaList<double>
    {
      dashUnits,
      Math.Max(0d, circumferenceUnits - dashUnits),
    };
  }
}

public sealed class FsusAffixChangedEventArgs(bool isAffixed) : EventArgs
{
  public bool IsAffixed { get; } = isAffixed;
}

public class FsusAffix : ContentControl
{
  public static readonly StyledProperty<double> ThresholdProperty =
    AvaloniaProperty.Register<FsusAffix, double>(nameof(Threshold));

  public static readonly StyledProperty<double> OffsetProperty =
    AvaloniaProperty.Register<FsusAffix, double>(nameof(Offset));

  public static readonly StyledProperty<object?> ScrollTargetProperty =
    AvaloniaProperty.Register<FsusAffix, object?>(nameof(ScrollTarget));

  public FsusAffix()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-affix");
    SyncState();
  }

  public event EventHandler<FsusAffixChangedEventArgs>? AffixedChanged;

  public double Threshold
  {
    get => GetValue(ThresholdProperty);
    set => SetValue(ThresholdProperty, value);
  }

  public double Offset
  {
    get => GetValue(OffsetProperty);
    set => SetValue(OffsetProperty, value);
  }

  public object? ScrollTarget
  {
    get => GetValue(ScrollTargetProperty);
    set => SetValue(ScrollTargetProperty, value);
  }

  public bool IsAffixed { get; private set; }

  public double CurrentOffset { get; private set; }

  public void UpdateScroll(double scrollOffset)
  {
    var next = scrollOffset >= Threshold;
    CurrentOffset = next ? Offset : 0d;
    if (next != IsAffixed)
    {
      IsAffixed = next;
      AffixedChanged?.Invoke(this, new FsusAffixChangedEventArgs(next));
    }

    SyncState();
  }

  protected override void OnPropertyChanged(AvaloniaPropertyChangedEventArgs change)
  {
    base.OnPropertyChanged(change);
    if (
      change.Property == ThresholdProperty ||
      change.Property == OffsetProperty ||
      change.Property == ScrollTargetProperty)
    {
      SyncState();
    }
  }

  private void SyncState()
  {
    FsusComponentClasses.Ensure(this, "fsus-affixed", IsAffixed);
    AutomationProperties.SetControlTypeOverride(this, AutomationControlType.Group);
    AutomationProperties.SetItemStatus(this, IsAffixed ? "affixed" : "normal");
  }
}

public class FsusBacktop : ContentControl
{
  public static readonly StyledProperty<double> VisibilityHeightProperty =
    AvaloniaProperty.Register<FsusBacktop, double>(nameof(VisibilityHeight), 200d);

  public static readonly StyledProperty<object?> ScrollTargetProperty =
    AvaloniaProperty.Register<FsusBacktop, object?>(nameof(ScrollTarget));

  public FsusBacktop()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-backtop");
    Focusable = true;
    SyncState();
  }

  public event EventHandler<EventArgs>? BacktopRequested;

  public double VisibilityHeight
  {
    get => GetValue(VisibilityHeightProperty);
    set => SetValue(VisibilityHeightProperty, value);
  }

  public object? ScrollTarget
  {
    get => GetValue(ScrollTargetProperty);
    set => SetValue(ScrollTargetProperty, value);
  }

  public double ScrollOffset { get; private set; }

  public void UpdateScroll(double scrollOffset)
  {
    ScrollOffset = Math.Max(0d, scrollOffset);
    IsVisible = ScrollOffset >= VisibilityHeight;
    SyncState();
  }

  protected ValueTask<bool> HandleKeyAsync(Key key)
  {
    if (key is not (Key.Enter or Key.Space) || !IsVisible)
    {
      return ValueTask.FromResult(false);
    }

    Activate();
    return ValueTask.FromResult(true);
  }

  public void Activate()
  {
    ScrollOffset = 0d;
    IsVisible = false;
    SyncState();
    BacktopRequested?.Invoke(this, EventArgs.Empty);
  }

  protected override void OnPropertyChanged(AvaloniaPropertyChangedEventArgs change)
  {
    base.OnPropertyChanged(change);
    if (
      change.Property == VisibilityHeightProperty ||
      change.Property == ScrollTargetProperty)
    {
      SyncState();
    }
  }

  private void SyncState()
  {
    FsusComponentClasses.Ensure(this, "fsus-visible", IsVisible);
    AutomationProperties.SetName(this, "Back to top");
    AutomationProperties.SetControlTypeOverride(this, AutomationControlType.Button);
    AutomationProperties.SetItemStatus(this, IsVisible ? "visible" : "hidden");
  }
}

internal static class FsusServiceVisuals
{
  public static void SyncServiceClasses(
    Control control,
    FsusServiceType type,
    FsusServicePlacement placement,
    bool reducedMotion)
  {
    foreach (var className in new[]
    {
      "fsus-info",
      "fsus-success",
      "fsus-warning",
      "fsus-danger",
      "fsus-placement-top-right",
      "fsus-placement-top-left",
      "fsus-placement-bottom-right",
      "fsus-placement-bottom-left",
    })
    {
      FsusComponentClasses.Ensure(control, className, false);
    }

    FsusComponentClasses.Ensure(control, $"fsus-{TypeName(type)}", true);
    FsusComponentClasses.Ensure(control, $"fsus-placement-{PlacementName(placement)}", true);
    FsusComponentClasses.Ensure(control, "fsus-motion-reduced", reducedMotion);
  }

  public static FsusOverlayOptions CreateServiceOverlayOptions(
    FsusServicePlacement placement,
    FsusOverlayHost host) =>
    new()
    {
      IsModal = false,
      CloseOnEscape = true,
      CloseOnPointerOutside = false,
      Placement = placement is FsusServicePlacement.TopLeft or FsusServicePlacement.BottomLeft
        ? FsusOverlayPlacement.TopStart
        : FsusOverlayPlacement.TopEnd,
      AnchorBounds = new Rect(0, 0, host.Bounds.Width, 0),
      OverlaySize = new Size(320, 80),
      ViewportBounds = new Rect(0, 0, host.Bounds.Width, host.Bounds.Height),
    };

  public static string TypeName(FsusServiceType type) =>
    type switch
    {
      FsusServiceType.Success => "success",
      FsusServiceType.Warning => "warning",
      FsusServiceType.Danger => "danger",
      _ => "info",
    };

  private static string PlacementName(FsusServicePlacement placement) =>
    placement switch
    {
      FsusServicePlacement.TopLeft => "top-left",
      FsusServicePlacement.BottomRight => "bottom-right",
      FsusServicePlacement.BottomLeft => "bottom-left",
      _ => "top-right",
    };
}
