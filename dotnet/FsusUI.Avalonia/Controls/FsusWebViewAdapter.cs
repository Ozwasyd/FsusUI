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
    var startLength = destination.CanSeek ? destination.Length : (long?)null;
    using var proof = new PdfProofStream(destination);
    var result = await backend.ExportPdfAsync(options, proof, cancellationToken);
    cancellationToken.ThrowIfCancellationRequested();
    var destinationLeftOpen = IsStreamWritable(destination);
    var bytesWritten = BytesWritten(destination, start, proof.BytesWritten);
    var invalidDetail = InvalidPdfResultDetail(
      options,
      result,
      destination,
      start,
      startLength,
      proof,
      bytesWritten);
    if (!destinationLeftOpen || invalidDetail is not null)
    {
      return result with
      {
        Status = FsusWebViewCommandStatus.InvalidBackendResult,
        DestinationLeftOpen = destinationLeftOpen,
        BytesWritten = bytesWritten,
        Detail = destinationLeftOpen
          ? invalidDetail
          : "The caller-owned PDF destination stream is no longer writable.",
      };
    }

    return result with
    {
      DestinationLeftOpen = true,
      BytesWritten = bytesWritten,
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
        string.IsNullOrWhiteSpace(suggestion.AccessibleName)
          ? suggestion.Replacement
          : suggestion.AccessibleName,
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
      string.IsNullOrWhiteSpace(request.MisspelledWord) ||
      !request.SpellingSuggestions.Any(
        suggestion => !string.IsNullOrWhiteSpace(suggestion.Replacement));
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

  private static string? InvalidPdfResultDetail(
    FsusWebViewPdfExportOptions options,
    FsusWebViewPdfExportResult result,
    Stream destination,
    long? start,
    long? startLength,
    PdfProofStream proof,
    long bytesWritten)
  {
    if (result.Status != FsusWebViewCommandStatus.Succeeded)
    {
      return null;
    }

    if (proof.DisposeAttempted)
    {
      return "The backend attempted to close the caller-owned PDF destination stream.";
    }

    if (
      result.BytesWritten <= 0 ||
      proof.BytesWritten <= 0 ||
      bytesWritten <= 0 ||
      result.BytesWritten != proof.BytesWritten)
    {
      return "The backend did not prove a non-empty PDF write.";
    }

    if (
      !start.HasValue ||
      !startLength.HasValue ||
      !destination.CanSeek ||
      !destination.CanRead ||
      destination.Length <= startLength.Value)
    {
      return "The destination did not expose readable, seekable PDF growth for verification.";
    }

    if (options.GenerateTaggedPdf && !result.TaggedPdfApplied)
    {
      return "The backend did not prove the requested tagged-PDF result.";
    }

    if (
      options.GenerateDocumentOutline &&
      (!result.DocumentOutlineApplied ||
        result.Outline.Count == 0 ||
        !result.Outline.All(IsValidOutlineNode)))
    {
      return "The backend did not prove the requested clickable outline result.";
    }

    var content = ReadWrittenPdf(destination, start.Value, bytesWritten);
    if (
      content is null ||
      !content.StartsWith("%PDF-", StringComparison.Ordinal) ||
      !content.Contains("%%EOF", StringComparison.Ordinal))
    {
      return "The destination does not contain a complete PDF structure.";
    }

    if (
      options.GenerateTaggedPdf &&
      !content.Contains("/StructTreeRoot", StringComparison.Ordinal))
    {
      return "The PDF structure does not contain the requested tag tree.";
    }

    if (options.GenerateDocumentOutline)
    {
      if (!content.Contains("/Outlines", StringComparison.Ordinal))
      {
        return "The PDF structure does not contain the requested outline tree.";
      }

      foreach (var node in result.Outline.SelectMany(FlattenOutline))
      {
        if (!content.Contains($"/Dest ({node.Destination})", StringComparison.Ordinal))
        {
          return $"The PDF structure is missing outline destination '{node.Destination}'.";
        }
      }
    }

    return null;
  }

  private static bool IsValidOutlineNode(FsusWebViewDocumentOutlineNode node) =>
    !string.IsNullOrWhiteSpace(node.Title) &&
    node.HeadingLevel is >= 1 and <= 6 &&
    !string.IsNullOrWhiteSpace(node.Destination) &&
    node.Children.All((child) =>
      child.HeadingLevel > node.HeadingLevel && IsValidOutlineNode(child));

  private static IEnumerable<FsusWebViewDocumentOutlineNode> FlattenOutline(
    FsusWebViewDocumentOutlineNode node)
  {
    yield return node;
    foreach (var child in node.Children.SelectMany(FlattenOutline))
    {
      yield return child;
    }
  }

  private static string? ReadWrittenPdf(Stream destination, long start, long count)
  {
    if (count > int.MaxValue)
    {
      return null;
    }

    var position = destination.Position;
    try
    {
      destination.Position = start;
      var buffer = new byte[(int)count];
      var offset = 0;
      while (offset < buffer.Length)
      {
        var read = destination.Read(buffer, offset, buffer.Length - offset);
        if (read == 0)
        {
          return null;
        }
        offset += read;
      }
      return System.Text.Encoding.ASCII.GetString(buffer);
    }
    finally
    {
      destination.Position = position;
    }
  }

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

  private sealed class PdfProofStream(Stream destination) : Stream
  {
    public long BytesWritten { get; private set; }
    public bool DisposeAttempted { get; private set; }

    public override bool CanRead => destination.CanRead;
    public override bool CanSeek => destination.CanSeek;
    public override bool CanWrite => destination.CanWrite;
    public override long Length => destination.Length;
    public override long Position
    {
      get => destination.Position;
      set => destination.Position = value;
    }

    public override void Flush() => destination.Flush();
    public override Task FlushAsync(CancellationToken cancellationToken) =>
      destination.FlushAsync(cancellationToken);
    public override int Read(byte[] buffer, int offset, int count) =>
      destination.Read(buffer, offset, count);
    public override long Seek(long offset, SeekOrigin origin) =>
      destination.Seek(offset, origin);
    public override void SetLength(long value) => destination.SetLength(value);

    public override void Write(byte[] buffer, int offset, int count)
    {
      destination.Write(buffer, offset, count);
      BytesWritten += count;
    }

    public override void Write(ReadOnlySpan<byte> buffer)
    {
      destination.Write(buffer);
      BytesWritten += buffer.Length;
    }

    public override async ValueTask WriteAsync(
      ReadOnlyMemory<byte> buffer,
      CancellationToken cancellationToken = default)
    {
      await destination.WriteAsync(buffer, cancellationToken);
      BytesWritten += buffer.Length;
    }

    public override async Task WriteAsync(
      byte[] buffer,
      int offset,
      int count,
      CancellationToken cancellationToken)
    {
      await destination.WriteAsync(buffer.AsMemory(offset, count), cancellationToken);
      BytesWritten += count;
    }

    protected override void Dispose(bool disposing)
    {
      if (disposing)
      {
        DisposeAttempted = true;
      }
    }

    public override ValueTask DisposeAsync()
    {
      DisposeAttempted = true;
      return ValueTask.CompletedTask;
    }
  }
}
