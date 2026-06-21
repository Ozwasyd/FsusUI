using Avalonia;
using Avalonia.Controls;
using FsusUI.Avalonia.Controls;

namespace FsusUI.Avalonia.Overlay;

public enum FsusOverlayPlacement
{
  BottomStart,
  BottomEnd,
  TopStart,
  TopEnd,
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
    Children.Add(content);
    return entry;
  }

  public FsusOverlayEntry OpenDialog(
    FsusDialog dialog,
    FsusOverlayOptions? options = null)
  {
    ArgumentNullException.ThrowIfNull(dialog);

    var resolvedOptions = (options ?? new FsusOverlayOptions()) with
    {
      IsModal = dialog.IsModal,
    };
    return Open(dialog, resolvedOptions);
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
    Children.Remove(entry.Content);
    entry.MarkClosed();
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

  private void RestoreFocus(FsusOverlayEntry entry)
  {
    LastRestoredFocus = entry.Options.RestoreFocusTo ?? LastFocusedElement;
    LastFocusedElement = LastRestoredFocus;
  }

  private static (Rect Bounds, FsusOverlayPlacement Placement) ResolveBounds(
    FsusOverlayOptions options)
  {
    var placement = options.Placement;
    var size = options.OverlaySize;
    var viewport = options.ViewportBounds;
    var anchor = options.AnchorBounds;
    var x = placement is FsusOverlayPlacement.BottomEnd or FsusOverlayPlacement.TopEnd
      ? anchor.Right - size.Width
      : anchor.Left;
    var y = placement is FsusOverlayPlacement.TopStart or FsusOverlayPlacement.TopEnd
      ? anchor.Top - size.Height
      : anchor.Bottom;

    if (y + size.Height > viewport.Bottom && anchor.Top - size.Height >= viewport.Top)
    {
      placement = placement is FsusOverlayPlacement.BottomEnd
        ? FsusOverlayPlacement.TopEnd
        : FsusOverlayPlacement.TopStart;
      y = anchor.Top - size.Height;
    }
    else if (y < viewport.Top && anchor.Bottom + size.Height <= viewport.Bottom)
    {
      placement = placement is FsusOverlayPlacement.TopEnd
        ? FsusOverlayPlacement.BottomEnd
        : FsusOverlayPlacement.BottomStart;
      y = anchor.Bottom;
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
