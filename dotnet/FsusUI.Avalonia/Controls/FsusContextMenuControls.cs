using Avalonia;
using Avalonia.Automation;
using Avalonia.Automation.Peers;
using Avalonia.Controls;
using Avalonia.Input;
using Avalonia.Interactivity;
using FsusUI.Avalonia.Overlay;
using System.Runtime.CompilerServices;

namespace FsusUI.Avalonia.Controls;

public sealed record FsusContextMenuRequest(
  string TargetKey,
  FsusTreeInteractionSource Source,
  Rect AnchorBounds,
  Control? Invoker = null);

public sealed class FsusContextMenuItemActivatedEventArgs(
  string targetKey,
  string actionKey) : EventArgs
{
  public string TargetKey { get; } = targetKey;
  public string ActionKey { get; } = actionKey;
}

public abstract class FsusContextMenuEntry(string className) : ContentControl
{
  protected string BaseClassName { get; } = className;
}

public class FsusContextMenuItem : FsusContextMenuEntry
{
  public static readonly StyledProperty<string> KeyProperty =
    AvaloniaProperty.Register<FsusContextMenuItem, string>(nameof(Key), string.Empty);

  public static readonly StyledProperty<object?> HeaderProperty =
    AvaloniaProperty.Register<FsusContextMenuItem, object?>(nameof(Header));

  public static readonly StyledProperty<object?> IconContentProperty =
    AvaloniaProperty.Register<FsusContextMenuItem, object?>(nameof(IconContent));

  public static readonly StyledProperty<string?> AcceleratorProperty =
    AvaloniaProperty.Register<FsusContextMenuItem, string?>(nameof(Accelerator));

  public static readonly StyledProperty<bool> IsDangerousProperty =
    AvaloniaProperty.Register<FsusContextMenuItem, bool>(nameof(IsDangerous));

  public FsusContextMenuItem() : base("fsus-context-menu-item")
  {
    Focusable = true;
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

  public object? IconContent
  {
    get => GetValue(IconContentProperty);
    set => SetValue(IconContentProperty, value);
  }

  public string? Accelerator
  {
    get => GetValue(AcceleratorProperty);
    set => SetValue(AcceleratorProperty, value);
  }

  public bool IsDangerous
  {
    get => GetValue(IsDangerousProperty);
    set => SetValue(IsDangerousProperty, value);
  }

  protected override void OnPropertyChanged(AvaloniaPropertyChangedEventArgs change)
  {
    base.OnPropertyChanged(change);

    if (
      change.Property == KeyProperty ||
      change.Property == HeaderProperty ||
      change.Property == IconContentProperty ||
      change.Property == AcceleratorProperty ||
      change.Property == IsDangerousProperty ||
      change.Property == IsEnabledProperty)
    {
      SyncState();
    }
  }

  internal void SyncState()
  {
    FsusComponentClasses.Ensure(this, "fsus-dangerous", IsDangerous);
    FsusComponentClasses.Ensure(this, "fsus-disabled", !IsEnabled);
    AutomationProperties.SetName(this, FsusComponentClasses.ResolveName(null, Header));
    AutomationProperties.SetItemStatus(this, IsEnabled ? "available" : "disabled");
  }
}

public class FsusContextMenuSeparator : FsusContextMenuEntry
{
  public FsusContextMenuSeparator() : base("fsus-context-menu-separator")
  {
    Focusable = false;
  }
}

public class FsusContextMenu : ContentControl, IFsusOverlayLifecycle
{
  private readonly List<FsusContextMenuEntry> items = [];
  private FsusOverlayHost? overlayHost;

  public FsusContextMenu()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-context-menu");
    AutomationProperties.SetControlTypeOverride(this, AutomationControlType.Menu);
    SyncState();
  }

  public event EventHandler<FsusContextMenuItemActivatedEventArgs>? ItemActivated;

  public string? AccessibleName { get; set; }
  public IList<FsusContextMenuEntry> Items => items;
  public Size OverlaySize { get; set; } = new(200, 240);
  public Rect ViewportBounds { get; set; } = new(0, 0, 1920, 1080);
  public string FocusedKey { get; private set; } = string.Empty;
  public string TargetKey { get; private set; } = string.Empty;
  public string SelectedActionKey { get; private set; } = string.Empty;
  public Control? Invoker { get; private set; }
  public bool IsOpen { get; private set; }
  public FsusOverlayEntry? OverlayEntry { get; private set; }
  public FsusOverlayPlacement EffectivePlacement { get; private set; } =
    FsusOverlayPlacement.BottomStart;

  public FsusOverlayEntry Open(FsusOverlayHost host, FsusContextMenuRequest request)
  {
    ArgumentNullException.ThrowIfNull(host);
    ArgumentNullException.ThrowIfNull(request);
    if (!IsEnabled)
    {
      throw new InvalidOperationException("Context menu is disabled.");
    }

    if (IsOpen && OverlayEntry is not null)
    {
      return OverlayEntry;
    }

    TargetKey = request.TargetKey;
    Invoker = request.Invoker;
    return host.Open(this, new FsusOverlayOptions
    {
      IsModal = false,
      CloseOnEscape = true,
      CloseOnPointerOutside = true,
      RestoreFocusTo = request.Invoker,
      AnchorBounds = request.AnchorBounds,
      OverlaySize = OverlaySize,
      ViewportBounds = ViewportBounds,
      Placement = FsusOverlayPlacement.BottomStart,
    });
  }

  internal void CloseForRewire()
  {
    if (OverlayEntry is not null && overlayHost is not null)
    {
      _ = overlayHost.CloseAsync(OverlayEntry);
    }
  }

  public ValueTask<bool> CloseAsync() =>
    OverlayEntry is null || overlayHost is null
      ? ValueTask.FromResult(false)
      : overlayHost.CloseAsync(OverlayEntry);

  public ValueTask<bool> HandleKeyAsync(Key key)
  {
    if (!IsOpen)
    {
      return ValueTask.FromResult(false);
    }

    switch (key)
    {
      case Key.Down:
        MoveFocus(1);
        return ValueTask.FromResult(true);
      case Key.Up:
        MoveFocus(-1);
        return ValueTask.FromResult(true);
      case Key.Enter:
      case Key.Space:
        return ChooseFocusedAsync();
      case Key.Escape:
        return CloseAsync();
      default:
        return ValueTask.FromResult(false);
    }
  }

  public void FocusFirst()
  {
    var first = SelectableItems().FirstOrDefault();
    if (first is not null)
    {
      FocusedKey = first.Key;
      SyncItems();
    }
  }

  public void MoveFocus(int direction)
  {
    var selectable = SelectableItems().ToList();
    if (selectable.Count == 0)
    {
      return;
    }

    var index = selectable.FindIndex((item) => item.Key == FocusedKey);
    var next = index < 0 ? 0 : (index + direction + selectable.Count) % selectable.Count;
    FocusedKey = selectable[next].Key;
    SyncItems();
  }

  public async ValueTask<bool> ChooseFocusedAsync() =>
    await ChooseAsync(FocusedKey);

  public async ValueTask<bool> ChooseAsync(string key)
  {
    var item = items.OfType<FsusContextMenuItem>()
      .FirstOrDefault((candidate) => candidate.Key == key);
    if (item is null || !item.IsEnabled)
    {
      return false;
    }

    SelectedActionKey = key;
    ItemActivated?.Invoke(
      this,
      new FsusContextMenuItemActivatedEventArgs(TargetKey, key));
    SyncState();
    return await CloseAsync();
  }

  public void OnOverlayOpened(FsusOverlayEntry entry)
  {
    OverlayEntry = entry;
    overlayHost = entry.Content.Parent as FsusOverlayHost;
    IsOpen = true;
    EffectivePlacement = entry.Placement;
    FocusFirst();
    SyncState();
  }

  public void OnOverlayClosed(FsusOverlayCloseReason reason)
  {
    OverlayEntry = null;
    overlayHost = null;
    IsOpen = false;
    SyncState();
  }

  private IEnumerable<FsusContextMenuItem> SelectableItems() =>
    items.OfType<FsusContextMenuItem>().Where((item) => item.IsEnabled);

  private void SyncItems()
  {
    foreach (var entry in items)
    {
      if (entry is FsusContextMenuItem item)
      {
        item.SyncState();
        FsusComponentClasses.Ensure(
          item,
          "fsus-focused",
          item.IsEnabled && item.Key == FocusedKey);
      }
    }
  }

  private void SyncState()
  {
    FsusComponentClasses.Ensure(this, "fsus-open", IsOpen);
    AutomationProperties.SetName(this, FsusComponentClasses.ResolveName(AccessibleName, TargetKey));
    AutomationProperties.SetItemStatus(
      this,
      IsOpen ? $"open menu" : "closed menu");
  }
}

public static class FsusContextMenuService
{
  private static readonly ConditionalWeakTable<Control, Registration> Registrations = [];

  public static void Attach(Control target, FsusContextMenu menu, FsusOverlayHost host)
  {
    ArgumentNullException.ThrowIfNull(target);
    ArgumentNullException.ThrowIfNull(menu);
    ArgumentNullException.ThrowIfNull(host);

    if (Registrations.TryGetValue(target, out var existing))
    {
      existing.Detach();
    }

    menu.CloseForRewire();
    var registration = new Registration(target, menu, host);
    Registrations.AddOrUpdate(target, registration);
    registration.Attach();
  }

  public static void Detach(Control target)
  {
    if (Registrations.TryGetValue(target, out var registration))
    {
      registration.Detach();
      Registrations.Remove(target);
    }
  }

  public static bool Request(Control target, FsusTreeInteractionSource source, Rect anchorBounds)
  {
    ArgumentNullException.ThrowIfNull(target);
    if (!Registrations.TryGetValue(target, out var registration) || !target.IsEnabled)
    {
      return false;
    }

    registration.Menu.Open(registration.Host, new FsusContextMenuRequest(
      string.Empty,
      source,
      anchorBounds,
      target));
    return true;
  }

  private sealed class Registration
  {
    public Registration(Control target, FsusContextMenu menu, FsusOverlayHost host)
    {
      Target = target;
      Menu = menu;
      Host = host;
    }

    public Control Target { get; }
    public FsusContextMenu Menu { get; }
    public FsusOverlayHost Host { get; }

    public void Attach()
    {
      Target.ContextRequested += HandleContextRequested;
      Target.KeyDown += HandleKeyDown;
    }

    public void Detach()
    {
      Target.ContextRequested -= HandleContextRequested;
      Target.KeyDown -= HandleKeyDown;
    }

    private void HandleContextRequested(object? sender, ContextRequestedEventArgs e)
    {
      e.Handled = true;
      if (e.TryGetPosition(Target, out var point))
      {
        OpenFrom(point);
        return;
      }

      Request(Target, FsusTreeInteractionSource.Keyboard, AnchorFor(Target));
    }

    private void HandleKeyDown(object? sender, KeyEventArgs e)
    {
      if (!Menu.IsOpen)
      {
        return;
      }

      var pending = Menu.HandleKeyAsync(e.Key);
      if (pending.IsCompleted)
      {
        e.Handled = pending.Result;
        return;
      }

      _ = CompleteKeyAsync(pending, e);
    }

    private static async Task CompleteKeyAsync(ValueTask<bool> pending, KeyEventArgs e) =>
      e.Handled = await pending;

    private void OpenFrom(Point point)
    {
      var offset = Target.TranslatePoint(point, Host) ?? point;
      Menu.Open(Host, new FsusContextMenuRequest(
        string.Empty,
        FsusTreeInteractionSource.Pointer,
        new Rect(offset.X, offset.Y, Target.Bounds.Width, Target.Bounds.Height),
        Target));
    }

    private Rect AnchorFor(Control target) =>
      target.TranslatePoint(new Point(0, 0), Host) is { } origin
        ? new Rect(origin, target.Bounds.Size)
        : new Rect(target.Bounds.Size);
  }
}
