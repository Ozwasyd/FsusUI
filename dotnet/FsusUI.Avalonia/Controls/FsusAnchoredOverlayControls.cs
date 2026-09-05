using Avalonia;
using Avalonia.Automation;
using Avalonia.Automation.Peers;
using Avalonia.Automation.Provider;
using Avalonia.Controls;
using Avalonia.Input;
using FsusUI.Avalonia.Overlay;

namespace FsusUI.Avalonia.Controls;

public enum FsusAnchoredTriggerMode
{
  Hover,
  Focus,
  Click,
  Manual,
}

public enum FsusAnchoredOpenReason
{
  Hover,
  Focus,
  Click,
  Keyboard,
  Manual,
}

public enum FsusAnchoredPlacement
{
  BottomStart,
  BottomEnd,
  TopStart,
  TopEnd,
  LeftStart,
  LeftEnd,
  RightStart,
  RightEnd,
}

public abstract class FsusAnchoredOverlaySurface : ContentControl, IFsusOverlayLifecycle
{
  public static readonly StyledProperty<string?> AccessibleNameProperty =
    AvaloniaProperty.Register<FsusAnchoredOverlaySurface, string?>(nameof(AccessibleName));

  public static readonly StyledProperty<string?> TitleProperty =
    AvaloniaProperty.Register<FsusAnchoredOverlaySurface, string?>(nameof(Title));

  public static readonly StyledProperty<object?> OverlayContentProperty =
    AvaloniaProperty.Register<FsusAnchoredOverlaySurface, object?>(nameof(OverlayContent));

  public static readonly StyledProperty<FsusAnchoredTriggerMode> TriggerModeProperty =
    AvaloniaProperty.Register<FsusAnchoredOverlaySurface, FsusAnchoredTriggerMode>(
      nameof(TriggerMode),
      FsusAnchoredTriggerMode.Click);

  public static readonly StyledProperty<FsusAnchoredPlacement> PlacementProperty =
    AvaloniaProperty.Register<FsusAnchoredOverlaySurface, FsusAnchoredPlacement>(
      nameof(Placement),
      FsusAnchoredPlacement.BottomStart);

  public static readonly StyledProperty<double> OffsetProperty =
    AvaloniaProperty.Register<FsusAnchoredOverlaySurface, double>(nameof(Offset), 8d);

  public static readonly StyledProperty<bool> IsDisabledProperty =
    AvaloniaProperty.Register<FsusAnchoredOverlaySurface, bool>(nameof(IsDisabled));

  public static readonly StyledProperty<bool> ReducedMotionProperty =
    AvaloniaProperty.Register<FsusAnchoredOverlaySurface, bool>(nameof(ReducedMotion));

  public static readonly StyledProperty<Rect> AnchorBoundsProperty =
    AvaloniaProperty.Register<FsusAnchoredOverlaySurface, Rect>(
      nameof(AnchorBounds),
      new Rect(0, 0, 0, 0));

  public static readonly StyledProperty<Size> OverlaySizeProperty =
    AvaloniaProperty.Register<FsusAnchoredOverlaySurface, Size>(
      nameof(OverlaySize),
      new Size(240, 160));

  public static readonly StyledProperty<Rect> ViewportBoundsProperty =
    AvaloniaProperty.Register<FsusAnchoredOverlaySurface, Rect>(
      nameof(ViewportBounds),
      new Rect(0, 0, 1920, 1080));

  private FsusOverlayHost? overlayHost;
  private WeakReference<FsusOverlayHost>? lifecycleHost;

  protected FsusAnchoredOverlaySurface(string baseClass)
  {
    FsusComponentClasses.SetBaseClasses(this, baseClass);
    EffectivePlacement = Placement;
    SyncState();
  }

  public string? AccessibleName
  {
    get => GetValue(AccessibleNameProperty);
    set => SetValue(AccessibleNameProperty, value);
  }

  public string? Title
  {
    get => GetValue(TitleProperty);
    set => SetValue(TitleProperty, value);
  }

  public object? OverlayContent
  {
    get => GetValue(OverlayContentProperty);
    set => SetValue(OverlayContentProperty, value);
  }

  public FsusAnchoredTriggerMode TriggerMode
  {
    get => GetValue(TriggerModeProperty);
    set => SetValue(TriggerModeProperty, value);
  }

  public FsusAnchoredPlacement Placement
  {
    get => GetValue(PlacementProperty);
    set => SetValue(PlacementProperty, value);
  }

  public double Offset
  {
    get => GetValue(OffsetProperty);
    set => SetValue(OffsetProperty, value);
  }

  public bool IsDisabled
  {
    get => GetValue(IsDisabledProperty);
    set => SetValue(IsDisabledProperty, value);
  }

  public bool ReducedMotion
  {
    get => GetValue(ReducedMotionProperty);
    set => SetValue(ReducedMotionProperty, value);
  }

  public Rect AnchorBounds
  {
    get => GetValue(AnchorBoundsProperty);
    set => SetValue(AnchorBoundsProperty, value);
  }

  public Size OverlaySize
  {
    get => GetValue(OverlaySizeProperty);
    set => SetValue(OverlaySizeProperty, value);
  }

  public Rect ViewportBounds
  {
    get => GetValue(ViewportBoundsProperty);
    set => SetValue(ViewportBoundsProperty, value);
  }

  public FsusOverlayEntry? OverlayEntry { get; private set; }

  public bool IsOpen { get; private set; }

  public FsusAnchoredPlacement EffectivePlacement { get; private set; }

  public FsusOverlayEntry Open(
    FsusOverlayHost host,
    FsusAnchoredOpenReason reason = FsusAnchoredOpenReason.Manual)
  {
    ArgumentNullException.ThrowIfNull(host);
    if (IsDisabled || !AllowsOpen(reason))
    {
      throw new InvalidOperationException("Anchored overlay trigger is disabled.");
    }

    return IsOpen && OverlayEntry is not null
      ? OverlayEntry
      : host.Open(this, CreateOverlayOptions());
  }

  public bool TriggerClick(FsusOverlayHost host)
  {
    if (IsDisabled || TriggerMode != FsusAnchoredTriggerMode.Click)
    {
      return false;
    }

    Open(host, FsusAnchoredOpenReason.Click);
    return true;
  }

  public async ValueTask<bool> CloseAsync()
  {
    if (OverlayEntry is null || overlayHost is null)
    {
      return false;
    }

    return await overlayHost.CloseAsync(OverlayEntry);
  }

  public virtual void OnOverlayOpened(FsusOverlayEntry entry)
  {
    OverlayEntry = entry;
    overlayHost = entry.Content.Parent as FsusOverlayHost;
    if (overlayHost is not null)
    {
      lifecycleHost = new WeakReference<FsusOverlayHost>(overlayHost);
    }
    IsOpen = true;
    EffectivePlacement = FromOverlayPlacement(entry.Placement);
    SyncState();
  }

  public virtual void OnOverlayClosed(FsusOverlayCloseReason reason)
  {
    IsOpen = false;
    OverlayEntry = null;
    overlayHost = null;
    SyncState();
  }

  protected ValueTask<bool> HandleKeyAsync(Key key)
  {
    if (key == Key.Escape)
    {
      return CloseAsync();
    }

    return ValueTask.FromResult(false);
  }

  protected override void OnPropertyChanged(AvaloniaPropertyChangedEventArgs change)
  {
    base.OnPropertyChanged(change);

    if (
      change.Property == AccessibleNameProperty ||
      change.Property == TitleProperty ||
      change.Property == OverlayContentProperty ||
      change.Property == TriggerModeProperty ||
      change.Property == PlacementProperty ||
      change.Property == OffsetProperty ||
      change.Property == IsDisabledProperty ||
      change.Property == ReducedMotionProperty ||
      change.Property == AnchorBoundsProperty ||
      change.Property == OverlaySizeProperty ||
      change.Property == ViewportBoundsProperty)
    {
      EffectivePlacement = IsOpen ? EffectivePlacement : Placement;
      SyncState();
    }
  }

  protected virtual void SyncState()
  {
    FsusComponentClasses.Ensure(this, "fsus-open", IsOpen);
    FsusComponentClasses.Ensure(this, "fsus-disabled", IsDisabled);
    FsusComponentClasses.Ensure(this, "fsus-motion-reduced", ReducedMotion);
    foreach (var className in new[]
    {
      "fsus-placement-bottom-start",
      "fsus-placement-bottom-end",
      "fsus-placement-top-start",
      "fsus-placement-top-end",
      "fsus-placement-left-start",
      "fsus-placement-left-end",
      "fsus-placement-right-start",
      "fsus-placement-right-end",
    })
    {
      FsusComponentClasses.Ensure(this, className, false);
    }

    FsusComponentClasses.Ensure(this, $"fsus-placement-{PlacementName(EffectivePlacement)}", true);
    AutomationProperties.SetName(this, FsusComponentClasses.ResolveName(AccessibleName ?? Title, OverlayContent));
    AutomationProperties.SetItemStatus(this, $"{(IsOpen ? "open" : "closed")} {PlacementName(EffectivePlacement)}");
  }

  private bool TryGetLifecycleHost(out FsusOverlayHost host)
  {
    if (overlayHost is not null)
    {
      host = overlayHost;
      return true;
    }

    if (
      lifecycleHost is not null &&
      lifecycleHost.TryGetTarget(out var retainedHost))
    {
      host = retainedHost;
      return true;
    }

    host = null!;
    return false;
  }

  internal ExpandCollapseState AutomationExpandCollapseState => IsOpen
    ? ExpandCollapseState.Expanded
    : ExpandCollapseState.Collapsed;

  internal void ExpandFromAutomation()
  {
    if (IsOpen)
    {
      return;
    }

    if (
      !IsEnabled ||
      IsDisabled ||
      !TryGetLifecycleHost(out var host))
    {
      throw new InvalidOperationException(
        "The anchored overlay cannot reopen without an enabled lifecycle host.");
    }

    Open(host, FsusAnchoredOpenReason.Manual);
  }

  internal void CollapseFromAutomation()
  {
    if (!IsOpen)
    {
      return;
    }

    _ = CloseAsync().AsTask().GetAwaiter().GetResult();
  }

  private FsusOverlayOptions CreateOverlayOptions() =>
    new()
    {
      IsModal = false,
      CloseOnEscape = true,
      CloseOnPointerOutside = true,
      AnchorBounds = OffsetAnchor(AnchorBounds, Placement, Offset),
      OverlaySize = OverlaySize,
      ViewportBounds = ViewportBounds,
      Placement = ToOverlayPlacement(Placement),
    };

  private bool AllowsOpen(FsusAnchoredOpenReason reason) =>
    TriggerMode == FsusAnchoredTriggerMode.Manual ||
    reason == FsusAnchoredOpenReason.Manual ||
    reason == FsusAnchoredOpenReason.Keyboard ||
    (TriggerMode, reason) is
      (FsusAnchoredTriggerMode.Hover, FsusAnchoredOpenReason.Hover) or
      (FsusAnchoredTriggerMode.Focus, FsusAnchoredOpenReason.Focus) or
      (FsusAnchoredTriggerMode.Click, FsusAnchoredOpenReason.Click);

  private static Rect OffsetAnchor(Rect anchor, FsusAnchoredPlacement placement, double offset) =>
    placement switch
    {
      FsusAnchoredPlacement.TopStart or FsusAnchoredPlacement.TopEnd =>
        new Rect(anchor.X, anchor.Y - offset, anchor.Width, anchor.Height),
      FsusAnchoredPlacement.BottomStart or FsusAnchoredPlacement.BottomEnd =>
        new Rect(anchor.X, anchor.Y, anchor.Width, anchor.Height + offset),
      FsusAnchoredPlacement.LeftStart or FsusAnchoredPlacement.LeftEnd =>
        new Rect(anchor.X - offset, anchor.Y, anchor.Width, anchor.Height),
      FsusAnchoredPlacement.RightStart or FsusAnchoredPlacement.RightEnd =>
        new Rect(anchor.X, anchor.Y, anchor.Width + offset, anchor.Height),
      _ => anchor,
    };

  private static FsusOverlayPlacement ToOverlayPlacement(FsusAnchoredPlacement placement) =>
    placement switch
    {
      FsusAnchoredPlacement.BottomEnd => FsusOverlayPlacement.BottomEnd,
      FsusAnchoredPlacement.TopStart => FsusOverlayPlacement.TopStart,
      FsusAnchoredPlacement.TopEnd => FsusOverlayPlacement.TopEnd,
      FsusAnchoredPlacement.LeftStart => FsusOverlayPlacement.LeftStart,
      FsusAnchoredPlacement.LeftEnd => FsusOverlayPlacement.LeftEnd,
      FsusAnchoredPlacement.RightStart => FsusOverlayPlacement.RightStart,
      FsusAnchoredPlacement.RightEnd => FsusOverlayPlacement.RightEnd,
      _ => FsusOverlayPlacement.BottomStart,
    };

  private static FsusAnchoredPlacement FromOverlayPlacement(FsusOverlayPlacement placement) =>
    placement switch
    {
      FsusOverlayPlacement.BottomEnd => FsusAnchoredPlacement.BottomEnd,
      FsusOverlayPlacement.TopStart => FsusAnchoredPlacement.TopStart,
      FsusOverlayPlacement.TopEnd => FsusAnchoredPlacement.TopEnd,
      FsusOverlayPlacement.LeftStart => FsusAnchoredPlacement.LeftStart,
      FsusOverlayPlacement.LeftEnd => FsusAnchoredPlacement.LeftEnd,
      FsusOverlayPlacement.RightStart => FsusAnchoredPlacement.RightStart,
      FsusOverlayPlacement.RightEnd => FsusAnchoredPlacement.RightEnd,
      _ => FsusAnchoredPlacement.BottomStart,
    };

  protected static string PlacementName(FsusAnchoredPlacement placement) =>
    placement switch
    {
      FsusAnchoredPlacement.BottomEnd => "bottom-end",
      FsusAnchoredPlacement.TopStart => "top-start",
      FsusAnchoredPlacement.TopEnd => "top-end",
      FsusAnchoredPlacement.LeftStart => "left-start",
      FsusAnchoredPlacement.LeftEnd => "left-end",
      FsusAnchoredPlacement.RightStart => "right-start",
      FsusAnchoredPlacement.RightEnd => "right-end",
      _ => "bottom-start",
    };
}

public class FsusTooltip : FsusAnchoredOverlaySurface
{
  public FsusTooltip() : base("fsus-tooltip")
  {
    TriggerMode = FsusAnchoredTriggerMode.Hover;
    AutomationProperties.SetControlTypeOverride(this, AutomationControlType.ToolTip);
  }

  protected override AutomationPeer OnCreateAutomationPeer() =>
    new FsusTooltipAutomationPeer(this);

  protected override void SyncState()
  {
    base.SyncState();
    AutomationProperties.SetControlTypeOverride(this, AutomationControlType.ToolTip);
    AutomationProperties.SetClassNameOverride(this, "Tooltip");
  }

  private sealed class FsusTooltipAutomationPeer(FsusTooltip owner)
    : ControlAutomationPeer(owner), IExpandCollapseProvider
  {
    public ExpandCollapseState ExpandCollapseState =>
      owner.AutomationExpandCollapseState;

    public bool ShowsMenu => false;

    public void Expand() => owner.ExpandFromAutomation();

    public void Collapse() => owner.CollapseFromAutomation();
  }
}

public class FsusPopover : FsusAnchoredOverlaySurface
{
  public FsusPopover() : base("fsus-popover")
  {
    TriggerMode = FsusAnchoredTriggerMode.Click;
    AutomationProperties.SetControlTypeOverride(this, AutomationControlType.Window);
  }

  protected override AutomationPeer OnCreateAutomationPeer() =>
    new FsusPopoverAutomationPeer(this);

  protected override void SyncState()
  {
    base.SyncState();
    AutomationProperties.SetControlTypeOverride(this, AutomationControlType.Window);
    AutomationProperties.SetClassNameOverride(this, "Popover");
  }

  private sealed class FsusPopoverAutomationPeer(FsusPopover owner)
    : ControlAutomationPeer(owner), IExpandCollapseProvider
  {
    public ExpandCollapseState ExpandCollapseState =>
      owner.AutomationExpandCollapseState;

    public bool ShowsMenu => false;

    public void Expand() => owner.ExpandFromAutomation();

    public void Collapse() => owner.CollapseFromAutomation();
  }
}

public class FsusPopconfirm : FsusPopover
{
  public static readonly StyledProperty<string?> ConfirmTextProperty =
    AvaloniaProperty.Register<FsusPopconfirm, string?>(nameof(ConfirmText), "OK");

  public static readonly StyledProperty<string?> CancelTextProperty =
    AvaloniaProperty.Register<FsusPopconfirm, string?>(nameof(CancelText), "Cancel");

  public static readonly StyledProperty<bool> IsDangerousProperty =
    AvaloniaProperty.Register<FsusPopconfirm, bool>(nameof(IsDangerous));

  public FsusPopconfirm()
  {
    FsusComponentClasses.Ensure(this, "fsus-popconfirm", true);
  }

  public event EventHandler<EventArgs>? Confirmed;
  public event EventHandler<EventArgs>? Canceled;

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

  public bool IsDangerous
  {
    get => GetValue(IsDangerousProperty);
    set => SetValue(IsDangerousProperty, value);
  }

  public async ValueTask<bool> ConfirmAsync()
  {
    var closed = await CloseAsync();
    if (closed)
    {
      Confirmed?.Invoke(this, EventArgs.Empty);
    }

    return closed;
  }

  public async ValueTask<bool> CancelAsync()
  {
    var closed = await CloseAsync();
    if (closed)
    {
      Canceled?.Invoke(this, EventArgs.Empty);
    }

    return closed;
  }

  protected override void OnPropertyChanged(AvaloniaPropertyChangedEventArgs change)
  {
    base.OnPropertyChanged(change);

    if (
      change.Property == ConfirmTextProperty ||
      change.Property == CancelTextProperty ||
      change.Property == IsDangerousProperty)
    {
      SyncState();
    }
  }

  protected override void SyncState()
  {
    base.SyncState();
    FsusComponentClasses.Ensure(this, "fsus-popconfirm", true);
    FsusComponentClasses.Ensure(this, "fsus-dangerous", IsDangerous);
    AutomationProperties.SetClassNameOverride(this, "Popconfirm");
  }
}

public class FsusDropdown : FsusAnchoredOverlaySurface
{
  public FsusDropdown()
    : base("fsus-dropdown")
  {
    Menu = new FsusDropdownMenu();
    TriggerMode = FsusAnchoredTriggerMode.Click;
    AutomationProperties.SetControlTypeOverride(this, AutomationControlType.Menu);
  }

  public event EventHandler<FsusNavigationSelectionChangedEventArgs>? SelectionChanged;

  public FsusDropdownMenu Menu { get; }

  public string SelectedKey { get; private set; } = string.Empty;

  protected ValueTask<bool> HandleKeyAsync(Key key, FsusOverlayHost host)
  {
    if (IsDisabled)
    {
      return ValueTask.FromResult(false);
    }

    if (!IsOpen && key is Key.Down or Key.Enter or Key.Space)
    {
      Open(host, FsusAnchoredOpenReason.Keyboard);
      Menu.FocusFirst();
      SyncState();
      return ValueTask.FromResult(true);
    }

    if (!IsOpen)
    {
      return ValueTask.FromResult(false);
    }

    switch (key)
    {
      case Key.Down:
        Menu.MoveFocus(1);
        SyncState();
        return ValueTask.FromResult(true);
      case Key.Up:
        Menu.MoveFocus(-1);
        SyncState();
        return ValueTask.FromResult(true);
      case Key.Enter:
      case Key.Space:
        return SelectFocusedAsync();
      case Key.Escape:
        return CloseAsync();
      default:
        return ValueTask.FromResult(false);
    }
  }

  protected override void SyncState()
  {
    base.SyncState();
    AutomationProperties.SetControlTypeOverride(this, AutomationControlType.Menu);
    AutomationProperties.SetClassNameOverride(this, "Dropdown");
    AutomationProperties.SetItemStatus(
      this,
      string.IsNullOrWhiteSpace(SelectedKey)
        ? (IsOpen ? "open" : "closed")
        : $"selected {SelectedKey}");
  }

  private async ValueTask<bool> SelectFocusedAsync()
  {
    var selected = Menu.ActivateFocused();
    if (string.IsNullOrWhiteSpace(selected))
    {
      return false;
    }

    SelectedKey = selected;
    SelectionChanged?.Invoke(this, new FsusNavigationSelectionChangedEventArgs(selected));
    SyncState();
    await CloseAsync();
    return true;
  }
}

public class FsusDropdownMenu : ContentControl
{
  private readonly List<FsusDropdownItem> items = [];

  public FsusDropdownMenu()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-dropdown-menu");
    AutomationProperties.SetControlTypeOverride(this, AutomationControlType.Menu);
  }

  public IList<FsusDropdownItem> Items => items;

  public string FocusedKey { get; private set; } = string.Empty;

  public string SelectedKey { get; private set; } = string.Empty;

  public void FocusFirst()
  {
    var first = items.FirstOrDefault((item) => item.IsEnabled);
    if (first is not null)
    {
      FocusedKey = first.Key;
      SyncItems();
    }
  }

  public void MoveFocus(int direction)
  {
    var enabled = items.Where((item) => item.IsEnabled).ToList();
    if (enabled.Count == 0)
    {
      return;
    }

    var index = enabled.FindIndex((item) => item.Key == FocusedKey);
    var next = index < 0
      ? 0
      : (index + direction + enabled.Count) % enabled.Count;
    FocusedKey = enabled[next].Key;
    SyncItems();
  }

  public string? ActivateFocused()
  {
    var item = items.FirstOrDefault((candidate) => candidate.Key == FocusedKey);
    if (item is null || !item.IsEnabled)
    {
      return null;
    }

    SelectedKey = item.Key;
    SyncItems();
    return item.Key;
  }

  private void SyncItems()
  {
    foreach (var item in items)
    {
      item.IsSelected = item.Key == SelectedKey;
      item.IsFocusedWithinMenu = item.Key == FocusedKey;
      item.SyncState();
    }
  }
}

public class FsusDropdownItem : ContentControl
{
  public static readonly StyledProperty<string> KeyProperty =
    AvaloniaProperty.Register<FsusDropdownItem, string>(nameof(Key), string.Empty);

  public static readonly StyledProperty<object?> HeaderProperty =
    AvaloniaProperty.Register<FsusDropdownItem, object?>(nameof(Header));

  public FsusDropdownItem()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-dropdown-item");
    SyncState();
  }

  public string Key
  {
    get => GetValue(KeyProperty);
    set => SetValue(KeyProperty, value);
  }

  public object? Header
  {
    get => GetValue(HeaderProperty);
    set => SetValue(HeaderProperty, value);
  }

  public bool IsSelected { get; internal set; }

  internal bool IsFocusedWithinMenu { get; set; }

  protected override void OnPropertyChanged(AvaloniaPropertyChangedEventArgs change)
  {
    base.OnPropertyChanged(change);

    if (
      change.Property == KeyProperty ||
      change.Property == HeaderProperty ||
      change.Property == IsEnabledProperty)
    {
      SyncState();
    }
  }

  internal void SyncState()
  {
    FsusComponentClasses.Ensure(this, "fsus-selected", IsSelected);
    FsusComponentClasses.Ensure(this, "fsus-disabled", !IsEnabled);
    FsusComponentClasses.Ensure(this, "fsus-focused", IsFocusedWithinMenu);
    AutomationProperties.SetName(this, FsusComponentClasses.ResolveName(null, Header));
    AutomationProperties.SetItemStatus(
      this,
      IsSelected ? "selected" : IsEnabled ? "available" : "disabled");
  }
}
