using Avalonia;
using Avalonia.Automation;
using Avalonia.Automation.Peers;
using Avalonia.Controls;
using Avalonia.Controls.Metadata;
using Avalonia.Controls.Presenters;
using Avalonia.Controls.Primitives;
using Avalonia.Input;
using Avalonia.Media;
using FsusUI.Avalonia.Overlay;
using System.Collections.ObjectModel;
using System.Collections.Specialized;
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

public interface IFsusImageLoader
{
  Task<object?> LoadAsync(string source, CancellationToken cancellationToken);
}

public sealed class FsusActiveSourceChangedEventArgs(string source, int index) : EventArgs
{
  public string Source { get; } = source;
  public int Index { get; } = index;
}

public sealed class FsusImageViewerTransformChangedEventArgs(
  double zoom,
  Vector translation) : EventArgs
{
  public double Zoom { get; } = zoom;
  public Vector Translation { get; } = translation;
}

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
  public Func<string, CancellationToken, Task<object?>>? PreviewLoader { get; set; }
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

  public FsusImageViewer? OpenPreview(FsusOverlayHost host) =>
    OpenPreview(host, null);

  public FsusImageViewer? OpenPreview(
    FsusOverlayHost host,
    Func<string, CancellationToken, Task<object?>>? previewLoader)
  {
    if (string.IsNullOrWhiteSpace(Source))
    {
      return null;
    }

    var viewer = new FsusImageViewer
    {
      AccessibleName = AccessibleName,
      Sources = { Source },
      ImageLoader = previewLoader ?? PreviewLoader,
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
