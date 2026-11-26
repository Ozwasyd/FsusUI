using Avalonia;
using Avalonia.Automation;
using Avalonia.Automation.Peers;
using Avalonia.Automation.Provider;
using Avalonia.Controls;
using Avalonia.Controls.Primitives;
using Avalonia.Input;
using Avalonia.Interactivity;
using Avalonia.Media;
using Avalonia.VisualTree;
using FsusUI.Avalonia.Overlay;

namespace FsusUI.Avalonia.Controls;

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
