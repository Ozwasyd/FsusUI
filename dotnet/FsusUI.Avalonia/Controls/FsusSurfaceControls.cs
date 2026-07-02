using Avalonia;
using Avalonia.Automation;
using Avalonia.Automation.Peers;
using Avalonia.Controls;
using Avalonia.Input;
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

  private readonly List<Control> focusScope = [];
  private FsusOverlayHost? overlayHost;
  private FsusModalCloseReason? pendingCloseReason;

  protected FsusModalSurface(string baseClass)
  {
    FsusComponentClasses.SetBaseClasses(this, baseClass);
    MotionState = FsusPanelMotionState.Hidden;
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

  protected ValueTask<bool> HandleKeyAsync(Key key) =>
    key == Key.Escape && CloseOnEscape
      ? RequestCloseAsync(FsusModalCloseReason.Keyboard)
      : ValueTask.FromResult(false);

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
      change.Property == ContentProperty)
    {
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
    FsusComponentClasses.Ensure(this, "fsus-has-footer", FooterContent is not null);
    FsusComponentClasses.Ensure(this, "fsus-has-confirm", ConfirmContent is not null);
    FsusComponentClasses.Ensure(this, "fsus-has-cancel", CancelContent is not null);
    AutomationProperties.SetName(this, FsusComponentClasses.ResolveName(Title, Content));
    AutomationProperties.SetHelpText(this, BodyContent?.ToString() ?? string.Empty);
    AutomationProperties.SetControlTypeOverride(this, AutomationControlType.Group);
    AutomationProperties.SetClassNameOverride(this, "Dialog");
    AutomationProperties.SetItemStatus(this, ModalStatus());
  }

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
