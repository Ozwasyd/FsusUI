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

[TemplatePart(Name = ContentPresenterPartName, Type = typeof(ContentPresenter))]
public class FsusImageViewer : ContentControl, IFsusOverlayLifecycle, IDisposable
{
  public const string ContentPresenterPartName = "PART_ContentPresenter";

  private FsusOverlayHost? overlayHost;
  private int activeIndex;
  private Collection<string> sources = [];
  private Func<string, CancellationToken, Task<object?>>? imageLoader;
  private IFsusImageLoader? sourceLoader;
  private Func<string, object?>? contentFactory;
  private CancellationTokenSource? currentLoadCts;
  private Task<bool>? currentLoadTask;
  private string? currentLoadingSource;
  private object? renderedContent;
  private ContentPresenter? contentPresenter;
  private readonly MatrixTransform imageTransform = new();
  private IPointer? capturedPointer;
  private Point lastPointerPosition;
  private double minimumZoom = 0.1;
  private double maximumZoom = 10;
  private double zoomFactor = 1.1;
  private double zoom = 1;
  private Vector translation;
  private string transformSource = string.Empty;

  public FsusImageViewer()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-image-viewer");
    Focusable = true;
    ClipToBounds = true;
    var initialSources = new ObservableCollection<string>();
    initialSources.CollectionChanged += OnSourcesCollectionChanged;
    sources = initialSources;
    SyncState();
  }

  public string? AccessibleName { get; set; }

  public Collection<string> Sources
  {
    get => sources;
    init
    {
      if (sources is INotifyCollectionChanged oldNotify)
      {
        oldNotify.CollectionChanged -= OnSourcesCollectionChanged;
      }
      sources = value;
      if (sources is INotifyCollectionChanged newNotify)
      {
        newNotify.CollectionChanged += OnSourcesCollectionChanged;
      }
      HandleActiveSourceTransformChange();
      SyncState();
    }
  }

  public int ActiveIndex
  {
    get => activeIndex;
    set
    {
      var clamped = Sources.Count == 0 ? Math.Max(0, value) : Math.Clamp(value, 0, Sources.Count - 1);
      if (activeIndex != clamped)
      {
        activeIndex = clamped;
        SyncState();
        OnActiveSourceChanged();
      }
    }
  }

  public bool IsOpen { get; private set; }
  public FsusOverlayEntry? OverlayEntry { get; private set; }
  public string ActiveSource => Sources.Count == 0 ? string.Empty : Sources[Math.Clamp(ActiveIndex, 0, Sources.Count - 1)];

  public Func<string, CancellationToken, Task<object?>>? ImageLoader
  {
    get => imageLoader;
    set
    {
      if (!ReferenceEquals(imageLoader, value))
      {
        imageLoader = value;
        if (value is not null && (IsOpen || Status != FsusImageStatus.Idle) && !string.IsNullOrWhiteSpace(ActiveSource))
        {
          _ = RefreshAsync();
        }
      }
    }
  }

  public IFsusImageLoader? SourceLoader
  {
    get => sourceLoader;
    set
    {
      if (!ReferenceEquals(sourceLoader, value))
      {
        sourceLoader = value;
        if (value is not null && (IsOpen || Status != FsusImageStatus.Idle) && !string.IsNullOrWhiteSpace(ActiveSource))
        {
          _ = RefreshAsync();
        }
      }
    }
  }

  public Func<string, object?>? ContentFactory
  {
    get => contentFactory;
    set
    {
      if (!ReferenceEquals(contentFactory, value))
      {
        contentFactory = value;
        if (value is not null && (IsOpen || Status != FsusImageStatus.Idle) && !string.IsNullOrWhiteSpace(ActiveSource))
        {
          _ = RefreshAsync();
        }
      }
    }
  }

  public FsusImageStatus Status { get; private set; } = FsusImageStatus.Idle;
  public string? ErrorMessage { get; private set; }
  public object? LoadedContent { get; private set; }
  public Task<bool>? CurrentLoadTask => currentLoadTask;
  public bool HasLoader => ImageLoader is not null || SourceLoader is not null || ContentFactory is not null;

  public double MinimumZoom
  {
    get => minimumZoom;
    set
    {
      if (!double.IsFinite(value) || value <= 0 || value > MaximumZoom)
      {
        throw new ArgumentOutOfRangeException(nameof(value));
      }

      minimumZoom = value;
      SetZoom(Zoom);
    }
  }

  public double MaximumZoom
  {
    get => maximumZoom;
    set
    {
      if (!double.IsFinite(value) || value < MinimumZoom)
      {
        throw new ArgumentOutOfRangeException(nameof(value));
      }

      maximumZoom = value;
      SetZoom(Zoom);
    }
  }

  public double ZoomFactor
  {
    get => zoomFactor;
    set
    {
      if (!double.IsFinite(value) || value <= 1)
      {
        throw new ArgumentOutOfRangeException(nameof(value));
      }

      zoomFactor = value;
    }
  }

  public double Zoom => zoom;
  public Vector Translation => translation;
  public bool PreserveTransformOnSourceChange { get; set; }
  public bool IsPanning => capturedPointer is not null;

  public event EventHandler<FsusActiveSourceChangedEventArgs>? ActiveSourceChanged;
  public event EventHandler<FsusImageViewerTransformChangedEventArgs>? TransformChanged;

  protected override void OnApplyTemplate(TemplateAppliedEventArgs e)
  {
    base.OnApplyTemplate(e);
    contentPresenter = e.NameScope.Find<ContentPresenter>(ContentPresenterPartName);
    if (contentPresenter is not null)
    {
      contentPresenter.SetValue(RenderTransformProperty, imageTransform);
      contentPresenter.RenderTransformOrigin = RelativePoint.Center;
      ApplyTransform();
    }
  }

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
    if (Status == FsusImageStatus.Idle && HasLoader && !string.IsNullOrWhiteSpace(ActiveSource))
    {
      _ = LoadActiveSourceAsync();
    }
  }

  public void OnOverlayClosed(FsusOverlayCloseReason reason)
  {
    currentLoadCts?.Cancel();
    currentLoadCts?.Dispose();
    currentLoadCts = null;
    OverlayEntry = null;
    overlayHost = null;
    IsOpen = false;
    SyncState();
  }

  public Task<bool> RefreshAsync(CancellationToken cancellationToken = default)
  {
    currentLoadingSource = null;
    return LoadActiveSourceAsync(cancellationToken);
  }

  public Task<bool> LoadActiveSourceAsync(CancellationToken cancellationToken = default)
  {
    var sourceToLoad = ActiveSource;
    if (currentLoadTask is not null &&
        string.Equals(currentLoadingSource, sourceToLoad, StringComparison.Ordinal) &&
        !currentLoadTask.IsCompleted)
    {
      return currentLoadTask;
    }

    var task = LoadActiveSourceCoreAsync(cancellationToken);
    currentLoadTask = task;
    return task;
  }

  private async Task<bool> LoadActiveSourceCoreAsync(CancellationToken cancellationToken)
  {
    if (currentLoadCts is not null)
    {
      currentLoadCts.Cancel();
      currentLoadCts.Dispose();
      currentLoadCts = null;
    }

    var sourceToLoad = ActiveSource;
    currentLoadingSource = sourceToLoad;

    if (!HasLoader || string.IsNullOrWhiteSpace(sourceToLoad))
    {
      Status = FsusImageStatus.Idle;
      ErrorMessage = null;
      SetLoadedContent(null, null);
      SyncState();
      return false;
    }

    var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
    currentLoadCts = linkedCts;
    var token = linkedCts.Token;

    Status = FsusImageStatus.Loading;
    ErrorMessage = null;
    SyncState();

    try
    {
      object? raw = null;
      if (ImageLoader is not null)
      {
        raw = await ImageLoader(sourceToLoad, token).ConfigureAwait(true);
      }
      else if (SourceLoader is not null)
      {
        raw = await SourceLoader.LoadAsync(sourceToLoad, token).ConfigureAwait(true);
      }
      else if (ContentFactory is not null)
      {
        raw = ContentFactory(sourceToLoad);
      }

      if (token.IsCancellationRequested || linkedCts != currentLoadCts)
      {
        if (raw is IDisposable disposable)
        {
          disposable.Dispose();
        }
        return false;
      }

      if (raw is null)
      {
        SetLoadedContent(null, null);
        Status = FsusImageStatus.Error;
        ErrorMessage = "Image loader returned null.";
        SyncState();
        return false;
      }

      object? control;
      if (raw is global::Avalonia.Media.IImage avaloniaImage)
      {
        control = new Image { Source = avaloniaImage };
      }
      else
      {
        control = raw;
      }

      SetLoadedContent(raw, control);
      Status = FsusImageStatus.Loaded;
      ErrorMessage = null;
      SyncState();
      return true;
    }
    catch (OperationCanceledException) when (token.IsCancellationRequested)
    {
      return false;
    }
    catch (Exception ex)
    {
      if (token.IsCancellationRequested || linkedCts != currentLoadCts)
      {
        return false;
      }

      SetLoadedContent(null, null);
      Status = FsusImageStatus.Error;
      ErrorMessage = ex.Message;
      SyncState();
      return false;
    }
  }

  public ValueTask<bool> NextAsync() => NavigateRelativeAsync(1);
  public ValueTask<bool> PreviousAsync() => NavigateRelativeAsync(-1);

  protected override void OnKeyDown(KeyEventArgs e)
  {
    base.OnKeyDown(e);
    if (!e.Handled)
    {
      if (e.Key is Key.Escape or Key.Left or Key.Right)
      {
        _ = HandleKeyAsync(e.Key);
        e.Handled = true;
      }
    }
  }

  protected override void OnPointerWheelChanged(PointerWheelEventArgs e)
  {
    base.OnPointerWheelChanged(e);
    if (!e.Handled && Status == FsusImageStatus.Loaded && e.Delta.Y != 0)
    {
      SetZoom(e.Delta.Y > 0 ? Zoom * ZoomFactor : Zoom / ZoomFactor);
      e.Handled = true;
    }
  }

  protected override void OnPointerPressed(PointerPressedEventArgs e)
  {
    base.OnPointerPressed(e);
    if (e.Handled || Status != FsusImageStatus.Loaded)
    {
      return;
    }

    var point = e.GetCurrentPoint(this);
    if (!point.Properties.IsLeftButtonPressed)
    {
      return;
    }

    e.Pointer.Capture(this);
    if (ReferenceEquals(e.Pointer.Captured, this))
    {
      capturedPointer = e.Pointer;
      lastPointerPosition = point.Position;
      FsusComponentClasses.Ensure(this, "fsus-panning", true);
      e.Handled = true;
    }
  }

  protected override void OnPointerMoved(PointerEventArgs e)
  {
    base.OnPointerMoved(e);
    if (!ReferenceEquals(e.Pointer, capturedPointer))
    {
      return;
    }

    var point = e.GetCurrentPoint(this);
    if (!point.Properties.IsLeftButtonPressed)
    {
      EndPan(e.Pointer);
      return;
    }

    var delta = point.Position - lastPointerPosition;
    lastPointerPosition = point.Position;
    SetTranslation(Translation + new Vector(delta.X, delta.Y));
    e.Handled = true;
  }

  protected override void OnPointerReleased(PointerReleasedEventArgs e)
  {
    base.OnPointerReleased(e);
    if (ReferenceEquals(e.Pointer, capturedPointer))
    {
      EndPan(e.Pointer);
      e.Handled = true;
    }
  }

  protected override void OnPointerCaptureLost(PointerCaptureLostEventArgs e)
  {
    base.OnPointerCaptureLost(e);
    if (ReferenceEquals(e.Pointer, capturedPointer))
    {
      capturedPointer = null;
      FsusComponentClasses.Ensure(this, "fsus-panning", false);
    }
  }

  public void ResetTransform()
  {
    EndPan(capturedPointer);
    var changed = Zoom != 1 || Translation != default;
    zoom = Math.Clamp(1, MinimumZoom, MaximumZoom);
    translation = default;
    ApplyTransform();
    if (changed)
    {
      OnTransformChanged();
    }
  }

  protected virtual async ValueTask<bool> HandleKeyAsync(Key key)
  {
    if (key == Key.Escape)
    {
      return await CloseAsync();
    }

    if (key == Key.Right)
    {
      return await NavigateRelativeAsync(1);
    }

    if (key == Key.Left)
    {
      return await NavigateRelativeAsync(-1);
    }

    return false;
  }

  private async ValueTask<bool> NavigateRelativeAsync(int offset)
  {
    if (Sources.Count == 0)
    {
      return false;
    }

    var targetIndex = Math.Clamp(ActiveIndex + offset, 0, Sources.Count - 1);
    if (targetIndex != ActiveIndex)
    {
      ActiveIndex = targetIndex;
      if (currentLoadTask is not null)
      {
        await currentLoadTask;
      }
    }
    return true;
  }

  private void OnActiveSourceChanged()
  {
    HandleActiveSourceTransformChange();
    ActiveSourceChanged?.Invoke(this, new FsusActiveSourceChangedEventArgs(ActiveSource, ActiveIndex));
    if (HasLoader && !string.IsNullOrWhiteSpace(ActiveSource))
    {
      _ = LoadActiveSourceAsync();
    }
  }

  private void OnSourcesCollectionChanged(object? sender, NotifyCollectionChangedEventArgs e)
  {
    var activeSourceChanged = HandleActiveSourceTransformChange();
    SyncState();
    if (
      (activeSourceChanged || Status == FsusImageStatus.Idle) &&
      Sources.Count > 0 &&
      HasLoader &&
      !string.IsNullOrWhiteSpace(ActiveSource))
    {
      _ = LoadActiveSourceAsync();
    }
  }

  private void SetLoadedContent(object? raw, object? control)
  {
    var oldLoaded = LoadedContent;
    var oldControl = renderedContent;

    if (ReferenceEquals(oldLoaded, raw) && ReferenceEquals(oldControl, control))
    {
      return;
    }

    LoadedContent = raw;
    renderedContent = control;
    ApplyContent(control);

    if (oldLoaded is IDisposable disposableLoaded)
    {
      disposableLoaded.Dispose();
    }

    if (oldControl is IDisposable disposableControl && !ReferenceEquals(disposableControl, oldLoaded))
    {
      disposableControl.Dispose();
    }
  }

  private void ApplyContent(object? control)
  {
    if (global::Avalonia.Threading.Dispatcher.UIThread.CheckAccess())
    {
      Content = control;
    }
    else
    {
      try
      {
        Content = control;
      }
      catch (InvalidOperationException)
      {
        if (Application.Current?.ApplicationLifetime is not null)
        {
          global::Avalonia.Threading.Dispatcher.UIThread.Post(() => Content = control);
        }
      }
    }
  }

  public void Dispose()
  {
    EndPan(capturedPointer);
    currentLoadCts?.Cancel();
    currentLoadCts?.Dispose();
    currentLoadCts = null;
    currentLoadingSource = null;
    SetLoadedContent(null, null);
    GC.SuppressFinalize(this);
  }

  private void SyncState()
  {
    if (!global::Avalonia.Threading.Dispatcher.UIThread.CheckAccess())
    {
      if (Application.Current?.ApplicationLifetime is not null)
      {
        global::Avalonia.Threading.Dispatcher.UIThread.Post(SyncStateCore);
      }
      else
      {
        try
        {
          SyncStateCore();
        }
        catch (InvalidOperationException)
        {
        }
      }
      return;
    }

    SyncStateCore();
  }

  private void SyncStateCore()
  {
    foreach (var className in new[] { "fsus-idle", "fsus-loading", "fsus-loaded", "fsus-error" })
    {
      FsusComponentClasses.Ensure(this, className, false);
    }

    FsusComponentClasses.Ensure(this, $"fsus-{StatusName(Status)}", true);
    FsusComponentClasses.Ensure(this, "fsus-open", IsOpen);
    AutomationProperties.SetName(this, FsusComponentClasses.ResolveName(AccessibleName, ActiveSource));
    AutomationProperties.SetControlTypeOverride(this, AutomationControlType.Image);
    AutomationProperties.SetItemStatus(
      this,
      Sources.Count == 0
        ? "empty"
        : TransformStatus($"image {(ActiveIndex + 1).ToString(CultureInfo.InvariantCulture)} of {Sources.Count.ToString(CultureInfo.InvariantCulture)}"));
  }

  private void SetZoom(double value)
  {
    var next = Math.Clamp(value, MinimumZoom, MaximumZoom);
    if (Zoom == next)
    {
      return;
    }

    zoom = next;
    ApplyTransform();
    OnTransformChanged();
  }

  private void SetTranslation(Vector value)
  {
    if (Translation == value)
    {
      return;
    }

    translation = value;
    ApplyTransform();
    OnTransformChanged();
  }

  private void ApplyTransform()
  {
    imageTransform.Matrix = new Matrix(
      Zoom,
      0,
      0,
      Zoom,
      Translation.X,
      Translation.Y);
  }

  private void OnTransformChanged()
  {
    FsusComponentClasses.Ensure(this, "fsus-transformed", Zoom != 1 || Translation != default);
    SyncState();
    TransformChanged?.Invoke(this, new FsusImageViewerTransformChangedEventArgs(Zoom, Translation));
  }

  private void EndPan(IPointer? pointer)
  {
    if (pointer is not null && ReferenceEquals(pointer.Captured, this))
    {
      pointer.Capture(null);
    }

    capturedPointer = null;
    FsusComponentClasses.Ensure(this, "fsus-panning", false);
  }

  private bool HandleActiveSourceTransformChange()
  {
    var source = ActiveSource;
    if (string.Equals(transformSource, source, StringComparison.Ordinal))
    {
      return false;
    }

    transformSource = source;
    EndPan(capturedPointer);
    if (!PreserveTransformOnSourceChange)
    {
      ResetTransform();
    }
    return true;
  }

  private string TransformStatus(string imageStatus)
  {
    if (Zoom == 1 && Translation == default)
    {
      return imageStatus;
    }

    return string.Create(
      CultureInfo.InvariantCulture,
      $"{imageStatus}, zoom {Zoom * 100:0}%, pan {Translation.X:0.#} by {Translation.Y:0.#}");
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
