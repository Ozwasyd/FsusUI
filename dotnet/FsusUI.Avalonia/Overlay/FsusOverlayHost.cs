using Avalonia;
using Avalonia.Controls;
using Avalonia.Input;
using Avalonia.Interactivity;
using Avalonia.Layout;
using Avalonia.Threading;
using Avalonia.VisualTree;
using FsusUI.Avalonia.Controls;

namespace FsusUI.Avalonia.Overlay;

public enum FsusOverlayPlacement
{
  BottomStart,
  BottomEnd,
  TopStart,
  TopEnd,
  LeftStart,
  LeftEnd,
  RightStart,
  RightEnd,
  Center,
}

public enum FsusOverlayCloseReason
{
  Programmatic,
  Keyboard,
  PointerOutside,
  HostDetached,
}

public enum FsusFocusNavigationDirection
{
  Previous,
  Next,
}

public sealed record FsusOverlayCloseRequest(
  FsusOverlayEntry Entry,
  FsusOverlayCloseReason Reason,
  CancellationToken CancellationToken);

public interface IFsusOverlayLifecycle
{
  void OnOverlayOpened(FsusOverlayEntry entry);
  void OnOverlayClosed(FsusOverlayCloseReason reason);
}

public sealed record FsusOverlayOptions
{
  public bool IsModal { get; init; } = true;
  public bool CloseOnEscape { get; init; } = true;
  public bool CloseOnPointerOutside { get; init; } = true;
  public Control? RestoreFocusTo { get; init; }
  public IReadOnlyList<Control> FocusScope { get; init; } = [];
  public Rect AnchorBounds { get; init; } = new(0, 0, 0, 0);
  public Size OverlaySize { get; init; } = new(320, 240);
  public Rect ViewportBounds { get; init; } = new(0, 0, 1920, 1080);
  public double RenderScaling { get; init; } = 1d;
  public FsusOverlayPlacement Placement { get; init; } =
    FsusOverlayPlacement.BottomStart;
  public Func<FsusOverlayCloseRequest, ValueTask<bool>>? Closing { get; init; }
}

public sealed class FsusOverlayEntry
{
  internal FsusOverlayEntry(
    Guid id,
    Control content,
    FsusOverlayOptions options,
    int zIndex,
    Rect bounds,
    FsusOverlayPlacement placement)
  {
    Id = id;
    Content = content;
    Options = options;
    ZIndex = zIndex;
    Bounds = bounds;
    Placement = placement;
    FocusedElement = options.FocusScope.FirstOrDefault();
  }

  public Guid Id { get; }
  public Control Content { get; }
  public FsusOverlayOptions Options { get; }
  public bool IsModal => Options.IsModal;
  public bool IsClosed { get; private set; }
  public int ZIndex { get; }
  public Rect Bounds { get; }
  public FsusOverlayPlacement Placement { get; }
  public double RenderScaling => Options.RenderScaling;
  public Control? FocusedElement { get; private set; }
  internal Border? Scrim { get; set; }

  internal void MarkClosed()
  {
    IsClosed = true;
    FocusedElement = null;
  }

  internal bool MoveFocus(FsusFocusNavigationDirection direction)
  {
    if (Options.FocusScope.Count == 0)
    {
      return false;
    }

    var currentIndex = FocusedElement is null
      ? -1
      : FindFocusIndex(FocusedElement);
    var delta = direction == FsusFocusNavigationDirection.Next ? 1 : -1;
    var nextIndex = (currentIndex + delta + Options.FocusScope.Count)
      % Options.FocusScope.Count;
    FocusedElement = Options.FocusScope[nextIndex];
    return true;
  }

  private int FindFocusIndex(Control control)
  {
    for (var index = 0; index < Options.FocusScope.Count; index++)
    {
      if (ReferenceEquals(Options.FocusScope[index], control))
      {
        return index;
      }
    }

    return -1;
  }
}

public sealed class FsusOverlayHost : Panel
{
  private readonly List<FsusOverlayEntry> entries = [];

  public int BaseZIndex { get; init; } = FsusTokens.ZOverlayDialogInt32;
  public IReadOnlyList<FsusOverlayEntry> OpenOverlays => entries.AsReadOnly();
  public IReadOnlyList<FsusOverlayEntry> ModalStack =>
    entries.Where((entry) => entry.IsModal && !entry.IsClosed).ToArray();
  public FsusOverlayEntry? Topmost => entries.LastOrDefault();
  public Control? LastFocusedElement { get; set; }
  public Control? LastRestoredFocus { get; private set; }

  public FsusOverlayEntry Open(
    Control content,
    FsusOverlayOptions? options = null)
  {
    ArgumentNullException.ThrowIfNull(content);

    var resolvedOptions = options ?? new FsusOverlayOptions();
    var zIndex = BaseZIndex + entries.Count + 1;
    var (bounds, placement) = ResolveBounds(resolvedOptions);
    var entry = new FsusOverlayEntry(
      Guid.NewGuid(),
      content,
      resolvedOptions,
      zIndex,
      bounds,
      placement);

    entries.Add(entry);
    if (entry.IsModal)
    {
      var scrim = new Border();
      scrim.Classes.Add("fsus-overlay");
      entry.Scrim = scrim;
      Children.Add(scrim);
    }
    Children.Add(content);
    if (content is IFsusOverlayLifecycle lifecycle)
    {
      lifecycle.OnOverlayOpened(entry);
    }
    FocusEntryAfterLayout(entry);
    return entry;
  }

  public FsusOverlayEntry OpenDialog(
    FsusDialog dialog,
    FsusOverlayOptions? options = null)
  {
    ArgumentNullException.ThrowIfNull(dialog);

    var resolvedOptions = dialog
      .CreateOverlayOptions(options)
      with
      { Placement = FsusOverlayPlacement.Center };
    return Open(dialog, resolvedOptions);
  }

  public FsusOverlayEntry OpenDrawer(
    FsusDrawer drawer,
    FsusOverlayOptions? options = null)
  {
    ArgumentNullException.ThrowIfNull(drawer);
    return Open(drawer, drawer.CreateOverlayOptions(options));
  }

  public FsusOverlayEntry OpenMessageBox(
    FsusMessageBox messageBox,
    FsusOverlayOptions? options = null)
  {
    ArgumentNullException.ThrowIfNull(messageBox);
    return Open(messageBox, messageBox.CreateOverlayOptions(options));
  }

  public ValueTask<bool> CloseTopAsync(
    FsusOverlayCloseReason reason = FsusOverlayCloseReason.Programmatic,
    CancellationToken cancellationToken = default)
  {
    var topmost = Topmost;
    return topmost is null
      ? ValueTask.FromResult(false)
      : CloseAsync(topmost, reason, cancellationToken);
  }

  public async ValueTask<bool> CloseAsync(
    FsusOverlayEntry entry,
    FsusOverlayCloseReason reason = FsusOverlayCloseReason.Programmatic,
    CancellationToken cancellationToken = default)
  {
    ArgumentNullException.ThrowIfNull(entry);

    if (entry.IsClosed)
    {
      return true;
    }

    if (cancellationToken.IsCancellationRequested)
    {
      return false;
    }

    if (entry.Options.Closing is not null)
    {
      var request = new FsusOverlayCloseRequest(entry, reason, cancellationToken);
      if (!await entry.Options.Closing(request) || cancellationToken.IsCancellationRequested)
      {
        return false;
      }
    }

    entries.Remove(entry);
    if (entry.Scrim is { } scrim)
    {
      Children.Remove(scrim);
      entry.Scrim = null;
    }
    Children.Remove(entry.Content);
    entry.MarkClosed();
    if (entry.Content is IFsusOverlayLifecycle lifecycle)
    {
      lifecycle.OnOverlayClosed(reason);
    }
    RestoreFocus(entry);
    return true;
  }

  public ValueTask<bool> DismissPointerOutsideAsync(
    Point point,
    CancellationToken cancellationToken = default)
  {
    var topmost = Topmost;
    if (topmost is null || !topmost.Options.CloseOnPointerOutside)
    {
      return ValueTask.FromResult(false);
    }

    return topmost.Bounds.Contains(point)
      ? ValueTask.FromResult(false)
      : CloseAsync(topmost, FsusOverlayCloseReason.PointerOutside, cancellationToken);
  }

  public ValueTask<bool> DismissKeyboardAsync(CancellationToken cancellationToken = default)
  {
    var topmost = Topmost;
    if (topmost is null || !topmost.Options.CloseOnEscape)
    {
      return ValueTask.FromResult(false);
    }

    return CloseAsync(topmost, FsusOverlayCloseReason.Keyboard, cancellationToken);
  }

  public bool MoveFocus(FsusFocusNavigationDirection direction)
  {
    var target = ModalStack.LastOrDefault() ?? Topmost;
    return target?.MoveFocus(direction) ?? false;
  }

  protected override Size ArrangeOverride(Size finalSize)
  {
    var centered = new HashSet<Visual>();
    foreach (var entry in entries)
    {
      entry.Scrim?.Arrange(new Rect(default, finalSize));

      if (
        entry.Placement == FsusOverlayPlacement.Center &&
        entry.Content is Layoutable centeredContent
      )
      {
        var desired = centeredContent.DesiredSize;
        var width = Math.Min(desired.Width, finalSize.Width);
        var height = Math.Min(desired.Height, finalSize.Height);
        var origin = new Point(
          Math.Max(0, (finalSize.Width - width) / 2),
          Math.Max(0, (finalSize.Height - height) / 2));
        centeredContent.Arrange(new Rect(origin, new Size(width, height)));
        centered.Add(centeredContent);
      }
    }

    foreach (var child in Children)
    {
      if (!centered.Contains(child))
      {
        child.Arrange(new Rect(default, finalSize));
      }
    }

    return finalSize;
  }

  protected override void OnAttachedToVisualTree(VisualTreeAttachmentEventArgs e)
  {
    base.OnAttachedToVisualTree(e);
    AddHandler(
      InputElement.KeyDownEvent,
      OnHostKeyDown,
      RoutingStrategies.Bubble);
    AddHandler(
      InputElement.PointerPressedEvent,
      OnHostPointerPressed,
      RoutingStrategies.Bubble);
  }

  protected override void OnDetachedFromVisualTree(VisualTreeAttachmentEventArgs e)
  {
    base.OnDetachedFromVisualTree(e);
    RemoveHandler(InputElement.KeyDownEvent, OnHostKeyDown);
    RemoveHandler(InputElement.PointerPressedEvent, OnHostPointerPressed);
  }

  private void OnHostKeyDown(object? sender, KeyEventArgs e)
  {
    if (e.Key != Key.Escape || entries.Count == 0)
    {
      return;
    }

    DismissKeyboardAsync()
      .AsTask()
      .ContinueWith(
        (task) => _ = task.Exception,
        TaskContinuationOptions.OnlyOnFaulted);
  }

  private void OnHostPointerPressed(object? sender, PointerPressedEventArgs e)
  {
    var topmost = Topmost;
    if (topmost is null || !topmost.Options.CloseOnPointerOutside)
    {
      return;
    }

    var point = e.GetPosition(this);
    if (topmost.Bounds.Contains(point))
    {
      return;
    }

    DismissPointerOutsideAsync(point)
      .AsTask()
      .ContinueWith(
        (task) => _ = task.Exception,
        TaskContinuationOptions.OnlyOnFaulted);
  }

  private static void TryFocus(Control? control)
  {
    if (control is { Focusable: true } && TopLevel.GetTopLevel(control) is not null)
    {
      control.Focus();
    }
  }

  private void FocusEntryAfterLayout(FsusOverlayEntry entry)
  {
    // Logical hosts outside a visual tree have nothing to focus, and the
    // dispatcher may not exist there. Focus assigned synchronously would be
    // cleared again when the content's template applies during the first
    // layout pass, so move focus into the modal once it is loaded.
    if (entry.Content is not Control content || TopLevel.GetTopLevel(content) is null)
    {
      return;
    }

    Dispatcher.UIThread.Post(
      () =>
      {
        if (!entry.IsClosed)
        {
          TryFocus(entry.FocusedElement ?? content);
        }
      },
      DispatcherPriority.Loaded);
  }

  private void RestoreFocus(FsusOverlayEntry entry)
  {
    LastRestoredFocus = entry.Options.RestoreFocusTo ?? LastFocusedElement;
    LastFocusedElement = LastRestoredFocus;
    TryFocus(LastRestoredFocus);
  }

  private static (Rect Bounds, FsusOverlayPlacement Placement) ResolveBounds(
    FsusOverlayOptions options)
  {
    var placement = options.Placement;
    var size = options.OverlaySize;
    var viewport = options.ViewportBounds;
    var anchor = options.AnchorBounds;
    var (x, y) = ResolveOrigin(placement, anchor, size, viewport);

    if (
      IsBottomPlacement(placement) &&
      y + size.Height > viewport.Bottom &&
      anchor.Top - size.Height >= viewport.Top)
    {
      placement = placement is FsusOverlayPlacement.BottomEnd
        ? FsusOverlayPlacement.TopEnd
        : FsusOverlayPlacement.TopStart;
      y = anchor.Top - size.Height;
    }
    else if (
      IsTopPlacement(placement) &&
      y < viewport.Top &&
      anchor.Bottom + size.Height <= viewport.Bottom)
    {
      placement = placement is FsusOverlayPlacement.TopEnd
        ? FsusOverlayPlacement.BottomEnd
        : FsusOverlayPlacement.BottomStart;
      y = anchor.Bottom;
    }

    if (
      IsRightPlacement(placement) &&
      x + size.Width > viewport.Right &&
      anchor.Left - size.Width >= viewport.Left)
    {
      placement = placement is FsusOverlayPlacement.RightEnd
        ? FsusOverlayPlacement.LeftEnd
        : FsusOverlayPlacement.LeftStart;
      x = anchor.Left - size.Width;
    }
    else if (
      IsLeftPlacement(placement) &&
      x < viewport.Left &&
      anchor.Right + size.Width <= viewport.Right)
    {
      placement = placement is FsusOverlayPlacement.LeftEnd
        ? FsusOverlayPlacement.RightEnd
        : FsusOverlayPlacement.RightStart;
      x = anchor.Right;
    }

    if (x + size.Width > viewport.Right)
    {
      x = Math.Max(viewport.Left, viewport.Right - size.Width);
    }
    if (x < viewport.Left)
    {
      x = viewport.Left;
    }

    return (new Rect(x, y, size.Width, size.Height), placement);
  }

  private static (double X, double Y) ResolveOrigin(
    FsusOverlayPlacement placement,
    Rect anchor,
    Size size,
    Rect viewport) =>
    placement switch
    {
      FsusOverlayPlacement.TopEnd => (anchor.Right - size.Width, anchor.Top - size.Height),
      FsusOverlayPlacement.BottomEnd => (anchor.Right - size.Width, anchor.Bottom),
      FsusOverlayPlacement.LeftStart => (anchor.Left - size.Width, anchor.Top),
      FsusOverlayPlacement.LeftEnd => (anchor.Left - size.Width, anchor.Bottom - size.Height),
      FsusOverlayPlacement.RightStart => (anchor.Right, anchor.Top),
      FsusOverlayPlacement.RightEnd => (anchor.Right, anchor.Bottom - size.Height),
      FsusOverlayPlacement.TopStart => (anchor.Left, anchor.Top - size.Height),
      FsusOverlayPlacement.Center => (
        viewport.Left + (viewport.Width - size.Width) / 2,
        viewport.Top + (viewport.Height - size.Height) / 2),
      _ => (anchor.Left, anchor.Bottom),
    };

  private static bool IsTopPlacement(FsusOverlayPlacement placement) =>
    placement is FsusOverlayPlacement.TopStart or FsusOverlayPlacement.TopEnd;

  private static bool IsBottomPlacement(FsusOverlayPlacement placement) =>
    placement is FsusOverlayPlacement.BottomStart or FsusOverlayPlacement.BottomEnd;

  private static bool IsLeftPlacement(FsusOverlayPlacement placement) =>
    placement is FsusOverlayPlacement.LeftStart or FsusOverlayPlacement.LeftEnd;

  private static bool IsRightPlacement(FsusOverlayPlacement placement) =>
    placement is FsusOverlayPlacement.RightStart or FsusOverlayPlacement.RightEnd;
}

public sealed class FsusOverlayHostService
{
  private readonly Dictionary<object, FsusOverlayHost> hosts =
    new(ReferenceEqualityComparer.Instance);

  public int HostCount => hosts.Count;

  public FsusOverlayHost RegisterHost(object windowKey, FsusOverlayHost? host = null)
  {
    ArgumentNullException.ThrowIfNull(windowKey);
    var resolvedHost = host ?? new FsusOverlayHost();
    hosts[windowKey] = resolvedHost;
    return resolvedHost;
  }

  public FsusOverlayHost GetOrCreateHost(object windowKey)
  {
    ArgumentNullException.ThrowIfNull(windowKey);
    if (hosts.TryGetValue(windowKey, out var host))
    {
      return host;
    }

    host = new FsusOverlayHost();
    hosts[windowKey] = host;
    return host;
  }

  public bool TryGetHost(object windowKey, out FsusOverlayHost? host) =>
    hosts.TryGetValue(windowKey, out host);

  public bool RemoveHost(object windowKey) => hosts.Remove(windowKey);
}
