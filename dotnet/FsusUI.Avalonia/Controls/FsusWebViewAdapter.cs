using Avalonia;
using Avalonia.Controls;
using FsusUI.Avalonia.Overlay;

namespace FsusUI.Avalonia.Controls;

public enum FsusWebViewContextMenuOrigin
{
  Pointer,
  Keyboard,
}

[Flags]
public enum FsusWebViewEditCapabilities
{
  None = 0,
  Cut = 1 << 0,
  Copy = 1 << 1,
  Paste = 1 << 2,
  RichCopy = 1 << 3,
  HtmlCopy = 1 << 4,
  PlainTextPaste = 1 << 5,
  InsertParagraph = 1 << 6,
  RichEdit = 1 << 7,
}

public enum FsusWebViewContextCommand
{
  Cut,
  Copy,
  Paste,
  RichCopy,
  CopyHtml,
  PastePlainText,
  InsertParagraph,
  ReplaceWord,
  AddToDictionary,
  UseNativeMenu,
}

public enum FsusWebViewCommandStatus
{
  Succeeded,
  Unsupported,
  Rejected,
  InvalidBackendResult,
}

public enum FsusWebViewPlatform
{
  Unknown,
  Windows,
  Linux,
  MacOS,
}

public enum FsusWebViewPrintTheme
{
  Light,
  Dark,
}

public sealed record FsusWebViewViewportPoint(double X, double Y)
{
  public bool IsValid =>
    double.IsFinite(X) &&
    double.IsFinite(Y) &&
    X >= 0 &&
    Y >= 0;
}

public sealed record FsusWebViewSpellingSuggestion(
  string Replacement,
  string AccessibleName);

public sealed record FsusWebViewContextMenuRequest
{
  public required FsusWebViewContextMenuOrigin Origin { get; init; }
  public required FsusWebViewViewportPoint ViewportPoint { get; init; }
  public bool IsEditable { get; init; }
  public bool HasSelection { get; init; }
  public bool IsImageContent { get; init; }
  public FsusWebViewEditCapabilities EditCapabilities { get; init; }
  public string? MisspelledWord { get; init; }
  public IReadOnlyList<FsusWebViewSpellingSuggestion> SpellingSuggestions { get; init; } =
    Array.Empty<FsusWebViewSpellingSuggestion>();
  public bool NativeMenuFallbackAvailable { get; init; }
}

public sealed class FsusWebViewContextMenuRequestedEventArgs(
  FsusWebViewContextMenuRequest request) : EventArgs
{
  public FsusWebViewContextMenuRequest Request { get; } = request;
}

public sealed record FsusWebViewContextCommandRequest
{
  public required FsusWebViewContextCommand Command { get; init; }
  public string? Replacement { get; init; }
  public FsusWebViewViewportPoint? ViewportPoint { get; init; }
}

public sealed record FsusWebViewCommandResult(
  FsusWebViewCommandStatus Status,
  string? Detail = null)
{
  public bool Succeeded => Status == FsusWebViewCommandStatus.Succeeded;

  public static FsusWebViewCommandResult Unsupported(string detail) =>
    new(FsusWebViewCommandStatus.Unsupported, detail);
}

public sealed record FsusWebViewCapabilities
{
  public required FsusWebViewPlatform Platform { get; init; }
  public bool SpellingSuggestions { get; init; }
  public bool ReplaceWord { get; init; }
  public bool AddToDictionary { get; init; }
  public bool NativeContextMenu { get; init; }
  public bool DeveloperTools { get; init; }
  public bool TaggedPdf { get; init; }
  public bool DocumentOutline { get; init; }
}

public sealed record FsusWebViewPdfExportOptions
{
  public bool GenerateTaggedPdf { get; init; }
  public bool GenerateDocumentOutline { get; init; }
  public FsusWebViewPrintTheme Theme { get; init; } = FsusWebViewPrintTheme.Light;
  public bool PrintBackgrounds { get; init; } = true;
}

public sealed record FsusWebViewDocumentOutlineNode
{
  public required string Title { get; init; }
  public required int HeadingLevel { get; init; }
  public required string Destination { get; init; }
  public IReadOnlyList<FsusWebViewDocumentOutlineNode> Children { get; init; } =
    Array.Empty<FsusWebViewDocumentOutlineNode>();
}

public sealed record FsusWebViewPdfExportResult
{
  public required FsusWebViewCommandStatus Status { get; init; }
  public bool TaggedPdfApplied { get; init; }
  public bool DocumentOutlineApplied { get; init; }
  public bool DestinationLeftOpen { get; init; } = true;
  public long BytesWritten { get; init; }
  public IReadOnlyList<FsusWebViewDocumentOutlineNode> Outline { get; init; } =
    Array.Empty<FsusWebViewDocumentOutlineNode>();
  public string? Detail { get; init; }
}

public sealed record FsusWebViewContextMenuLabels
{
  public string AccessibleName { get; init; } = "Editor actions";
  public string Cut { get; init; } = "Cut";
  public string Copy { get; init; } = "Copy";
  public string Paste { get; init; } = "Paste";
  public string RichCopy { get; init; } = "Copy with formatting";
  public string CopyHtml { get; init; } = "Copy HTML";
  public string PastePlainText { get; init; } = "Paste as plain text";
  public string InsertParagraph { get; init; } = "Insert paragraph";
  public string AddToDictionary { get; init; } = "Add to dictionary";
  public string UseNativeMenu { get; init; } = "Show system spelling menu";
}

public interface IFsusWebViewBackendAdapter
{
  FsusWebViewCapabilities Capabilities { get; }
  event EventHandler<FsusWebViewContextMenuRequestedEventArgs>? ContextMenuRequested;

  ValueTask<FsusWebViewCommandResult> ExecuteContextCommandAsync(
    FsusWebViewContextCommandRequest request,
    CancellationToken cancellationToken = default);

  ValueTask<FsusWebViewCommandResult> OpenDeveloperToolsAsync(
    CancellationToken cancellationToken = default);

  ValueTask<FsusWebViewPdfExportResult> ExportPdfAsync(
    FsusWebViewPdfExportOptions options,
    Stream destination,
    CancellationToken cancellationToken = default);
}

public sealed class FsusWebViewAdapter : IDisposable
{
  private const string ActionPrefix = "fsus-webview:";
  private readonly IFsusWebViewBackendAdapter backend;
  private readonly Dictionary<string, FsusWebViewContextCommandRequest> menuCommands = [];
  private FsusContextMenu? currentMenu;
  private FsusWebViewViewportPoint? currentViewportPoint;
  private bool disposed;

  public FsusWebViewAdapter(IFsusWebViewBackendAdapter backend)
  {
    this.backend = backend ?? throw new ArgumentNullException(nameof(backend));
    backend.ContextMenuRequested += OnBackendContextMenuRequested;
  }

  public event EventHandler<FsusWebViewContextMenuRequestedEventArgs>? ContextMenuRequested;
  public event EventHandler<FsusWebViewCommandResult>? ContextCommandCompleted;

  public FsusWebViewCapabilities Capabilities => backend.Capabilities;

  public FsusOverlayEntry OpenContextMenu(
    FsusOverlayHost host,
    FsusContextMenu menu,
    FsusWebViewContextMenuRequest request,
    Control invoker,
    FsusWebViewContextMenuLabels? labels = null)
  {
    ObjectDisposedException.ThrowIf(disposed, this);
    ArgumentNullException.ThrowIfNull(host);
    ArgumentNullException.ThrowIfNull(menu);
    ArgumentNullException.ThrowIfNull(request);
    ArgumentNullException.ThrowIfNull(invoker);
    if (!request.ViewportPoint.IsValid)
    {
      throw new ArgumentOutOfRangeException(
        nameof(request),
        "Context-menu viewport coordinates must be finite and non-negative.");
    }

    if (currentMenu is not null)
    {
      currentMenu.ItemActivated -= OnMenuItemActivated;
    }

    currentMenu = menu;
    currentViewportPoint = request.ViewportPoint;
    labels ??= new FsusWebViewContextMenuLabels();
    menu.AccessibleName = labels.AccessibleName;
    menu.Items.Clear();
    menuCommands.Clear();
    AddSpellingEntries(menu, request, labels);
    AddEditingEntries(menu, request, labels);
    AddNativeFallback(menu, request, labels);
    NormalizeSeparators(menu);
    menu.ItemActivated += OnMenuItemActivated;

    var source = request.Origin == FsusWebViewContextMenuOrigin.Keyboard
      ? FsusTreeInteractionSource.Keyboard
      : FsusTreeInteractionSource.Pointer;
    return menu.Open(host, new FsusContextMenuRequest(
      "webview-editable-content",
      source,
      new Rect(request.ViewportPoint.X, request.ViewportPoint.Y, 1, 1),
      invoker));
  }

  public ValueTask<FsusWebViewCommandResult> ExecuteContextCommandAsync(
    FsusWebViewContextCommandRequest request,
    CancellationToken cancellationToken = default)
  {
    ObjectDisposedException.ThrowIf(disposed, this);
    ArgumentNullException.ThrowIfNull(request);
    return backend.ExecuteContextCommandAsync(request, cancellationToken);
  }

  public ValueTask<FsusWebViewCommandResult> OpenDeveloperToolsAsync(
    CancellationToken cancellationToken = default)
  {
    ObjectDisposedException.ThrowIf(disposed, this);
    if (!Capabilities.DeveloperTools)
    {
      return ValueTask.FromResult(FsusWebViewCommandResult.Unsupported(
        "Developer tools are unavailable in this backend or build."));
    }

    return backend.OpenDeveloperToolsAsync(cancellationToken);
  }

  public async ValueTask<FsusWebViewPdfExportResult> ExportPdfAsync(
    FsusWebViewPdfExportOptions options,
    Stream destination,
    CancellationToken cancellationToken = default)
  {
    ObjectDisposedException.ThrowIf(disposed, this);
    ArgumentNullException.ThrowIfNull(options);
    ArgumentNullException.ThrowIfNull(destination);
    if (!destination.CanWrite)
    {
      throw new ArgumentException("The PDF destination stream must be writable.", nameof(destination));
    }

    if (options.GenerateTaggedPdf && !Capabilities.TaggedPdf)
    {
      return UnsupportedPdf("Tagged PDF generation is unavailable in this backend.");
    }

    if (options.GenerateDocumentOutline && !Capabilities.DocumentOutline)
    {
      return UnsupportedPdf("Document outline generation is unavailable in this backend.");
    }

    cancellationToken.ThrowIfCancellationRequested();
    var start = destination.CanSeek ? destination.Position : (long?)null;
    var result = await backend.ExportPdfAsync(options, destination, cancellationToken);
    cancellationToken.ThrowIfCancellationRequested();
    var destinationLeftOpen = IsStreamWritable(destination);
    if (!destinationLeftOpen || !IsValidPdfResult(options, result))
    {
      return result with
      {
        Status = FsusWebViewCommandStatus.InvalidBackendResult,
        DestinationLeftOpen = destinationLeftOpen,
        BytesWritten = BytesWritten(destination, start, result.BytesWritten),
        Detail = destinationLeftOpen
          ? "The backend did not prove the requested tagged-PDF or clickable outline result."
          : "The backend closed the caller-owned PDF destination stream.",
      };
    }

    return result with
    {
      DestinationLeftOpen = true,
      BytesWritten = BytesWritten(destination, start, result.BytesWritten),
    };
  }

  public void Dispose()
  {
    if (disposed)
    {
      return;
    }

    disposed = true;
    backend.ContextMenuRequested -= OnBackendContextMenuRequested;
    if (currentMenu is not null)
    {
      currentMenu.ItemActivated -= OnMenuItemActivated;
      currentMenu = null;
    }
  }

  private void AddSpellingEntries(
    FsusContextMenu menu,
    FsusWebViewContextMenuRequest request,
    FsusWebViewContextMenuLabels labels)
  {
    if (
      !Capabilities.SpellingSuggestions ||
      string.IsNullOrWhiteSpace(request.MisspelledWord) ||
      request.SpellingSuggestions.Count == 0)
    {
      return;
    }

    foreach (var suggestion in request.SpellingSuggestions)
    {
      if (string.IsNullOrWhiteSpace(suggestion.Replacement))
      {
        continue;
      }

      AddAction(
        menu,
        $"replace:{menuCommands.Count}",
        suggestion.AccessibleName,
        new FsusWebViewContextCommandRequest
        {
          Command = FsusWebViewContextCommand.ReplaceWord,
          Replacement = suggestion.Replacement,
          ViewportPoint = request.ViewportPoint,
        },
        Capabilities.ReplaceWord);
    }

    if (Capabilities.AddToDictionary)
    {
      AddAction(
        menu,
        "add-to-dictionary",
        labels.AddToDictionary,
        new FsusWebViewContextCommandRequest
        {
          Command = FsusWebViewContextCommand.AddToDictionary,
          Replacement = request.MisspelledWord,
          ViewportPoint = request.ViewportPoint,
        },
        true);
    }

    if (menu.Items.Count > 0)
    {
      menu.Items.Add(new FsusContextMenuSeparator());
    }
  }

  private void AddEditingEntries(
    FsusContextMenu menu,
    FsusWebViewContextMenuRequest request,
    FsusWebViewContextMenuLabels labels)
  {
    var capabilities = request.EditCapabilities;
    AddEditAction(menu, "cut", labels.Cut, FsusWebViewContextCommand.Cut,
      capabilities.HasFlag(FsusWebViewEditCapabilities.Cut));
    AddEditAction(menu, "copy", labels.Copy, FsusWebViewContextCommand.Copy,
      capabilities.HasFlag(FsusWebViewEditCapabilities.Copy));
    AddEditAction(menu, "paste", labels.Paste, FsusWebViewContextCommand.Paste,
      capabilities.HasFlag(FsusWebViewEditCapabilities.Paste));
    AddEditAction(menu, "rich-copy", labels.RichCopy, FsusWebViewContextCommand.RichCopy,
      capabilities.HasFlag(FsusWebViewEditCapabilities.RichCopy));
    AddEditAction(menu, "copy-html", labels.CopyHtml, FsusWebViewContextCommand.CopyHtml,
      capabilities.HasFlag(FsusWebViewEditCapabilities.HtmlCopy));
    AddEditAction(menu, "paste-plain", labels.PastePlainText,
      FsusWebViewContextCommand.PastePlainText,
      capabilities.HasFlag(FsusWebViewEditCapabilities.PlainTextPaste));
    AddEditAction(menu, "insert-paragraph", labels.InsertParagraph,
      FsusWebViewContextCommand.InsertParagraph,
      capabilities.HasFlag(FsusWebViewEditCapabilities.InsertParagraph));
  }

  private void AddEditAction(
    FsusContextMenu menu,
    string key,
    string header,
    FsusWebViewContextCommand command,
    bool isEnabled) =>
    AddAction(menu, key, header, new FsusWebViewContextCommandRequest
    {
      Command = command,
      ViewportPoint = currentViewportPoint,
    }, isEnabled);

  private void AddNativeFallback(
    FsusContextMenu menu,
    FsusWebViewContextMenuRequest request,
    FsusWebViewContextMenuLabels labels)
  {
    var suggestionDataUnavailable =
      !Capabilities.SpellingSuggestions ||
      request.SpellingSuggestions.Count == 0;
    if (
      !suggestionDataUnavailable ||
      !request.NativeMenuFallbackAvailable ||
      !Capabilities.NativeContextMenu)
    {
      return;
    }

    menu.Items.Add(new FsusContextMenuSeparator());
    AddAction(menu, "native-menu", labels.UseNativeMenu, new FsusWebViewContextCommandRequest
    {
      Command = FsusWebViewContextCommand.UseNativeMenu,
      ViewportPoint = request.ViewportPoint,
    }, true);
  }

  private void AddAction(
    FsusContextMenu menu,
    string key,
    string header,
    FsusWebViewContextCommandRequest command,
    bool isEnabled)
  {
    var actionKey = $"{ActionPrefix}{key}";
    menuCommands[actionKey] = command;
    menu.Items.Add(new FsusContextMenuItem
    {
      Key = actionKey,
      Header = header,
      IsEnabled = isEnabled,
    });
  }

  private static void NormalizeSeparators(FsusContextMenu menu)
  {
    while (menu.Items.FirstOrDefault() is FsusContextMenuSeparator)
    {
      menu.Items.RemoveAt(0);
    }

    while (menu.Items.LastOrDefault() is FsusContextMenuSeparator)
    {
      menu.Items.RemoveAt(menu.Items.Count - 1);
    }

    for (var index = menu.Items.Count - 1; index > 0; index--)
    {
      if (
        menu.Items[index] is FsusContextMenuSeparator &&
        menu.Items[index - 1] is FsusContextMenuSeparator)
      {
        menu.Items.RemoveAt(index);
      }
    }
  }

  private async void OnMenuItemActivated(
    object? sender,
    FsusContextMenuItemActivatedEventArgs args)
  {
    if (!menuCommands.TryGetValue(args.ActionKey, out var command))
    {
      return;
    }

    FsusWebViewCommandResult result;
    try
    {
      result = await ExecuteContextCommandAsync(command);
    }
    catch (Exception exception)
    {
      result = new FsusWebViewCommandResult(
        FsusWebViewCommandStatus.Rejected,
        exception.Message);
    }

    ContextCommandCompleted?.Invoke(this, result);
  }

  private void OnBackendContextMenuRequested(
    object? sender,
    FsusWebViewContextMenuRequestedEventArgs args) =>
    ContextMenuRequested?.Invoke(this, args);

  private static FsusWebViewPdfExportResult UnsupportedPdf(string detail) => new()
  {
    Status = FsusWebViewCommandStatus.Unsupported,
    DestinationLeftOpen = true,
    Detail = detail,
  };

  private static bool IsValidPdfResult(
    FsusWebViewPdfExportOptions options,
    FsusWebViewPdfExportResult result)
  {
    if (result.Status != FsusWebViewCommandStatus.Succeeded)
    {
      return true;
    }

    if (options.GenerateTaggedPdf && !result.TaggedPdfApplied)
    {
      return false;
    }

    return !options.GenerateDocumentOutline ||
      result.DocumentOutlineApplied &&
      result.Outline.Count > 0 &&
      result.Outline.All(IsValidOutlineNode);
  }

  private static bool IsValidOutlineNode(FsusWebViewDocumentOutlineNode node) =>
    !string.IsNullOrWhiteSpace(node.Title) &&
    node.HeadingLevel is >= 1 and <= 6 &&
    !string.IsNullOrWhiteSpace(node.Destination) &&
    node.Children.All((child) =>
      child.HeadingLevel > node.HeadingLevel && IsValidOutlineNode(child));

  private static bool IsStreamWritable(Stream destination)
  {
    try
    {
      return destination.CanWrite;
    }
    catch (ObjectDisposedException)
    {
      return false;
    }
  }

  private static long BytesWritten(Stream destination, long? start, long reported)
  {
    try
    {
      return start.HasValue && destination.CanSeek
        ? Math.Max(0, destination.Position - start.Value)
        : Math.Max(0, reported);
    }
    catch (ObjectDisposedException)
    {
      return Math.Max(0, reported);
    }
  }
}
