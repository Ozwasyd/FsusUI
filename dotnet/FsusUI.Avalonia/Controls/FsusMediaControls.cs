using Avalonia;
using Avalonia.Automation;
using Avalonia.Automation.Peers;
using Avalonia.Controls;
using Avalonia.Input;
using FsusUI.Avalonia.Overlay;
using System.Collections.ObjectModel;
using System.Globalization;

namespace FsusUI.Avalonia.Controls;

public enum FsusImageStatus
{
  Idle,
  Loading,
  Loaded,
  Error,
}

public enum FsusImageFit
{
  Fill,
  Contain,
  Cover,
  None,
  ScaleDown,
}

public sealed record FsusImageLoadResult(
  bool IsSuccess,
  string Source,
  Size NaturalSize,
  string? ErrorMessage)
{
  public static FsusImageLoadResult Success(string source, Size naturalSize) =>
    new(true, source, naturalSize, null);

  public static FsusImageLoadResult Failure(string errorMessage) =>
    new(false, string.Empty, default, errorMessage);
}

public delegate ValueTask<FsusImageLoadResult> FsusImageLoader(
  string source,
  CancellationToken cancellationToken);

public class FsusImage : ContentControl
{
  public FsusImage()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-image");
    SyncState();
  }

  public string? AccessibleName { get; set; }
  public string Source { get; set; } = string.Empty;
  public string FallbackText { get; set; } = string.Empty;
  public FsusImageFit Fit { get; set; } = FsusImageFit.Contain;
  public FsusImageLoader? Loader { get; set; }
  public FsusImageStatus Status { get; private set; } = FsusImageStatus.Idle;
  public Size NaturalSize { get; private set; }
  public string? ErrorMessage { get; private set; }
  public string DisplayText => Status == FsusImageStatus.Error ? FallbackText : Source;

  public async ValueTask<bool> LoadAsync(CancellationToken cancellationToken = default)
  {
    if (Loader is null || string.IsNullOrWhiteSpace(Source))
    {
      return false;
    }

    Status = FsusImageStatus.Loading;
    SyncState();
    var result = await Loader(Source, cancellationToken);
    if (cancellationToken.IsCancellationRequested)
    {
      return false;
    }

    if (result.IsSuccess)
    {
      Status = FsusImageStatus.Loaded;
      NaturalSize = result.NaturalSize;
      ErrorMessage = null;
      SyncState();
      return true;
    }

    Status = FsusImageStatus.Error;
    ErrorMessage = result.ErrorMessage;
    SyncState();
    return false;
  }

  public FsusImageViewer? OpenPreview(FsusOverlayHost host)
  {
    if (string.IsNullOrWhiteSpace(Source))
    {
      return null;
    }

    var viewer = new FsusImageViewer
    {
      AccessibleName = AccessibleName,
      Sources = { Source },
    };
    viewer.Open(host, this);
    return viewer;
  }

  private void SyncState()
  {
    foreach (var className in new[] { "fsus-idle", "fsus-loading", "fsus-loaded", "fsus-error" })
    {
      FsusComponentClasses.Ensure(this, className, false);
    }

    FsusComponentClasses.Ensure(this, $"fsus-{StatusName(Status)}", true);
    FsusComponentClasses.Ensure(this, $"fsus-fit-{Fit.ToString().ToLower(CultureInfo.InvariantCulture)}", true);
    AutomationProperties.SetName(this, FsusComponentClasses.ResolveName(AccessibleName, DisplayText));
    AutomationProperties.SetControlTypeOverride(this, AutomationControlType.Image);
    AutomationProperties.SetItemStatus(this, StatusName(Status));
  }

  private static string StatusName(FsusImageStatus status) =>
    status switch
    {
      FsusImageStatus.Loading => "loading",
      FsusImageStatus.Loaded => "loaded",
      FsusImageStatus.Error => "error",
      _ => "idle",
    };
}

public class FsusImageViewer : ContentControl, IFsusOverlayLifecycle
{
  private FsusOverlayHost? overlayHost;

  public FsusImageViewer()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-image-viewer");
    Focusable = true;
    SyncState();
  }

  public string? AccessibleName { get; set; }
  public Collection<string> Sources { get; init; } = [];
  public int ActiveIndex { get; set; }
  public bool IsOpen { get; private set; }
  public FsusOverlayEntry? OverlayEntry { get; private set; }
  public string ActiveSource => Sources.Count == 0 ? string.Empty : Sources[Math.Clamp(ActiveIndex, 0, Sources.Count - 1)];

  public FsusOverlayEntry Open(FsusOverlayHost host, Control? restoreFocusTo = null)
  {
    ArgumentNullException.ThrowIfNull(host);
    return IsOpen && OverlayEntry is not null
      ? OverlayEntry
      : host.Open(this, new FsusOverlayOptions
      {
        IsModal = true,
        CloseOnEscape = true,
        CloseOnPointerOutside = true,
        RestoreFocusTo = restoreFocusTo,
      });
  }

  public ValueTask<bool> CloseAsync()
  {
    if (OverlayEntry is null || overlayHost is null)
    {
      return ValueTask.FromResult(false);
    }

    return overlayHost.CloseAsync(OverlayEntry);
  }

  public void OnOverlayOpened(FsusOverlayEntry entry)
  {
    OverlayEntry = entry;
    overlayHost = entry.Content.Parent as FsusOverlayHost;
    IsOpen = true;
    SyncState();
  }

  public void OnOverlayClosed(FsusOverlayCloseReason reason)
  {
    OverlayEntry = null;
    overlayHost = null;
    IsOpen = false;
    SyncState();
  }

  protected ValueTask<bool> HandleKeyAsync(Key key)
  {
    if (key == Key.Escape)
    {
      return CloseAsync();
    }

    if (key == Key.Right)
    {
      ActiveIndex = Math.Min(Sources.Count - 1, ActiveIndex + 1);
      SyncState();
      return ValueTask.FromResult(true);
    }

    if (key == Key.Left)
    {
      ActiveIndex = Math.Max(0, ActiveIndex - 1);
      SyncState();
      return ValueTask.FromResult(true);
    }

    return ValueTask.FromResult(false);
  }

  private void SyncState()
  {
    FsusComponentClasses.Ensure(this, "fsus-open", IsOpen);
    AutomationProperties.SetName(this, FsusComponentClasses.ResolveName(AccessibleName, ActiveSource));
    AutomationProperties.SetControlTypeOverride(this, AutomationControlType.Image);
    AutomationProperties.SetItemStatus(
      this,
      Sources.Count == 0
        ? "empty"
        : $"image {(ActiveIndex + 1).ToString(CultureInfo.InvariantCulture)} of {Sources.Count.ToString(CultureInfo.InvariantCulture)}");
  }
}

public class FsusCarouselItem : ContentControl
{
  public FsusCarouselItem()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-carousel-item");
    SyncState(false);
  }

  public FsusCarouselItem(object? content) : this()
  {
    Content = content;
  }

  internal void SyncState(bool active)
  {
    FsusComponentClasses.Ensure(this, "fsus-active", active);
    AutomationProperties.SetName(this, FsusComponentClasses.ResolveName(null, Content));
    AutomationProperties.SetControlTypeOverride(this, AutomationControlType.Group);
  }
}

public class FsusCarousel : ContentControl
{
  public FsusCarousel()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-carousel");
    SyncState();
  }

  public string? AccessibleName { get; set; }
  public Collection<FsusCarouselItem> Items { get; } = [];
  public int ActiveIndex { get; private set; }
  public bool Autoplay { get; set; }
  public bool ReducedMotion { get; set; }

  public void RefreshItems()
  {
    ActiveIndex = Math.Clamp(ActiveIndex, 0, Math.Max(0, Items.Count - 1));
    for (var index = 0; index < Items.Count; index++)
    {
      Items[index].SyncState(index == ActiveIndex);
    }

    SyncState();
  }

  public bool Next()
  {
    if (Items.Count == 0)
    {
      return false;
    }

    ActiveIndex = (ActiveIndex + 1) % Items.Count;
    RefreshItems();
    return true;
  }

  public bool Previous()
  {
    if (Items.Count == 0)
    {
      return false;
    }

    ActiveIndex = (ActiveIndex - 1 + Items.Count) % Items.Count;
    RefreshItems();
    return true;
  }

  public bool AdvanceAutoplayTick()
  {
    if (!Autoplay || ReducedMotion)
    {
      SyncState();
      return false;
    }

    return Next();
  }

  private void SyncState()
  {
    FsusComponentClasses.Ensure(this, "fsus-autoplay", Autoplay);
    FsusComponentClasses.Ensure(this, "fsus-motion-reduced", ReducedMotion);
    AutomationProperties.SetName(this, FsusComponentClasses.ResolveName(AccessibleName, Items.Count));
    AutomationProperties.SetControlTypeOverride(this, AutomationControlType.Group);
    AutomationProperties.SetItemStatus(
      this,
      Items.Count == 0
        ? "empty"
        : $"slide {(ActiveIndex + 1).ToString(CultureInfo.InvariantCulture)} of {Items.Count.ToString(CultureInfo.InvariantCulture)}");
  }
}

public sealed record FsusWatermarkTile(Point Origin, string Text, double Rotate);

public class FsusWatermark : ContentControl
{
  private readonly List<FsusWatermarkTile> tiles = [];

  public FsusWatermark()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-watermark");
    SyncState();
  }

  public string? AccessibleName { get; set; }
  public string ContentText { get; set; } = string.Empty;
  public Size Gap { get; set; } = new(120, 80);
  public Point Offset { get; set; }
  public Size Viewport { get; set; } = new(320, 240);
  public double Rotate { get; set; } = -22d;
  public IReadOnlyList<FsusWatermarkTile> Tiles => tiles.AsReadOnly();

  public void RefreshTiles()
  {
    tiles.Clear();
    var gapX = Math.Max(1d, Gap.Width);
    var gapY = Math.Max(1d, Gap.Height);
    for (var y = Offset.Y; y < Viewport.Height + Offset.Y + gapY; y += gapY)
    {
      for (var x = Offset.X; x < Viewport.Width + Offset.X; x += gapX)
      {
        tiles.Add(new FsusWatermarkTile(new Point(x, y), ContentText, Rotate));
      }
    }

    SyncState();
  }

  private void SyncState()
  {
    AutomationProperties.SetName(this, FsusComponentClasses.ResolveName(AccessibleName, ContentText));
    AutomationProperties.SetControlTypeOverride(this, AutomationControlType.Group);
    AutomationProperties.SetItemStatus(this, $"{Tiles.Count.ToString(CultureInfo.InvariantCulture)} tiles");
  }
}
