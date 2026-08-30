using Avalonia;
using Avalonia.Controls;
using FsusUI.Avalonia.Controls;
using FsusUI.Avalonia.Overlay;
using System.Text;

namespace FsusUI.Avalonia.Tests.Controls;

public class FsusWebViewAdapterTests
{
  [Fact]
  public void TypedContextRequestPreservesNeutralStateAndCoordinates()
  {
    var backend = new FakeBackend(FullCapabilities(FsusWebViewPlatform.Windows));
    using var adapter = new FsusWebViewAdapter(backend);
    FsusWebViewContextMenuRequest? observed = null;
    adapter.ContextMenuRequested += (_, args) => observed = args.Request;
    var request = RichRequest(FsusWebViewContextMenuOrigin.Keyboard);

    backend.RaiseContextMenu(request);

    Assert.Same(request, observed);
    Assert.Equal(new FsusWebViewViewportPoint(120, 80), observed!.ViewportPoint);
    Assert.True(observed.IsEditable);
    Assert.True(observed.HasSelection);
    Assert.True(observed.IsImageContent);
    Assert.True(observed.EditCapabilities.HasFlag(FsusWebViewEditCapabilities.RichEdit));
    Assert.Equal("teh", observed.MisspelledWord);
    Assert.Equal(["the", "tech"],
      observed.SpellingSuggestions.Select((suggestion) => suggestion.Replacement));
  }

  [Fact]
  public async Task FsusContextMenuCompositionExecutesSuggestionAndRestoresFocus()
  {
    var backend = new FakeBackend(FullCapabilities(FsusWebViewPlatform.Linux));
    using var adapter = new FsusWebViewAdapter(backend);
    var host = new FsusOverlayHost();
    var invoker = new Button { Content = "Editable article" };
    var menu = new FsusContextMenu();
    var completion = new TaskCompletionSource<FsusWebViewCommandResult>(
      TaskCreationOptions.RunContinuationsAsynchronously);
    adapter.ContextCommandCompleted += (_, result) => completion.TrySetResult(result);

    var entry = adapter.OpenContextMenu(host, menu, RichRequest(), invoker);

    Assert.Equal(new Rect(120, 81, 200, 240), entry.Bounds);
    Assert.Equal("Editor actions", menu.AccessibleName);
    Assert.Equal("the", menu.Items.OfType<FsusContextMenuItem>().First().Header);
    Assert.Contains(menu.Items.OfType<FsusContextMenuItem>(),
      (item) => Equals(item.Header, "Copy HTML") && item.IsEnabled);
    Assert.All(menu.Items.OfType<FsusContextMenuItem>(),
      (item) => Assert.StartsWith("fsus-webview:", item.Key));

    Assert.True(await menu.ChooseAsync("fsus-webview:replace:0"));
    var result = await completion.Task.WaitAsync(TimeSpan.FromSeconds(2));
    Assert.True(result.Succeeded);
    var command = Assert.Single(backend.ContextCommands);
    Assert.Equal(FsusWebViewContextCommand.ReplaceWord, command.Command);
    Assert.Equal("the", command.Replacement);
    Assert.Equal(new FsusWebViewViewportPoint(120, 80), command.ViewportPoint);
    Assert.Same(invoker, host.LastRestoredFocus);
  }

  [Fact]
  public void MissingSuggestionDataOffersOnlyExplicitNativeMenuEscapeHatch()
  {
    var capabilities = FullCapabilities(FsusWebViewPlatform.Windows) with
    {
      SpellingSuggestions = false,
      ReplaceWord = false,
      AddToDictionary = false,
    };
    var backend = new FakeBackend(capabilities);
    using var adapter = new FsusWebViewAdapter(backend);
    var menu = new FsusContextMenu();
    var request = RichRequest() with
    {
      SpellingSuggestions = Array.Empty<FsusWebViewSpellingSuggestion>(),
    };

    adapter.OpenContextMenu(
      new FsusOverlayHost(),
      menu,
      request,
      new Button { Content = "Editor" });

    Assert.DoesNotContain(menu.Items.OfType<FsusContextMenuItem>(),
      (item) => item.Key.Contains("replace", StringComparison.Ordinal));
    Assert.Contains(menu.Items.OfType<FsusContextMenuItem>(),
      (item) => item.Key == "fsus-webview:native-menu" && item.IsEnabled);
  }

  [Fact]
  public async Task DeveloperToolsReturnsExplicitUnsupportedWithoutCallingBackend()
  {
    var backend = new FakeBackend(FullCapabilities(FsusWebViewPlatform.Linux) with
    {
      DeveloperTools = false,
    });
    using var adapter = new FsusWebViewAdapter(backend);

    var result = await adapter.OpenDeveloperToolsAsync();

    Assert.Equal(FsusWebViewCommandStatus.Unsupported, result.Status);
    Assert.Contains("unavailable", result.Detail, StringComparison.OrdinalIgnoreCase);
    Assert.Equal(0, backend.DeveloperToolsCalls);
  }

  [Theory]
  [InlineData(FsusWebViewPlatform.Windows, FsusWebViewPrintTheme.Light)]
  [InlineData(FsusWebViewPlatform.Windows, FsusWebViewPrintTheme.Dark)]
  [InlineData(FsusWebViewPlatform.Linux, FsusWebViewPrintTheme.Light)]
  [InlineData(FsusWebViewPlatform.Linux, FsusWebViewPrintTheme.Dark)]
  public async Task TaggedPdfAndHierarchicalOutlineAreProvenByAdapterSimulation(
    FsusWebViewPlatform platform,
    FsusWebViewPrintTheme theme)
  {
    var backend = new FakeBackend(FullCapabilities(platform));
    using var adapter = new FsusWebViewAdapter(backend);
    using var destination = new MemoryStream();
    var options = new FsusWebViewPdfExportOptions
    {
      GenerateTaggedPdf = true,
      GenerateDocumentOutline = true,
      Theme = theme,
    };

    var result = await adapter.ExportPdfAsync(options, destination);

    Assert.Equal(FsusWebViewCommandStatus.Succeeded, result.Status);
    Assert.True(result.TaggedPdfApplied);
    Assert.True(result.DocumentOutlineApplied);
    Assert.True(result.DestinationLeftOpen);
    Assert.True(destination.CanWrite);
    Assert.Equal(destination.Length, result.BytesWritten);
    Assert.Equal("Article", Assert.Single(result.Outline).Title);
    Assert.Equal("Methods", Assert.Single(result.Outline[0].Children).Title);
    var pdf = Encoding.ASCII.GetString(destination.ToArray());
    Assert.StartsWith("%PDF-1.7", pdf);
    Assert.Contains("/StructTreeRoot", pdf);
    Assert.Contains("/Outlines", pdf);
    Assert.Contains("/Dest (heading-article)", pdf);
    Assert.Contains($"% Platform={platform}; Theme={theme}", pdf);
  }

  [Fact]
  public async Task UnsupportedPdfCapabilityDoesNotInvokeBackendOrTouchStream()
  {
    var backend = new FakeBackend(FullCapabilities(FsusWebViewPlatform.MacOS) with
    {
      TaggedPdf = false,
      DocumentOutline = false,
    });
    using var adapter = new FsusWebViewAdapter(backend);
    using var destination = new MemoryStream();

    var result = await adapter.ExportPdfAsync(
      new FsusWebViewPdfExportOptions { GenerateDocumentOutline = true },
      destination);

    Assert.Equal(FsusWebViewCommandStatus.Unsupported, result.Status);
    Assert.Equal(0, backend.ExportCalls);
    Assert.Equal(0, destination.Length);
    Assert.True(destination.CanWrite);
  }

  [Fact]
  public async Task CancellationPropagatesAndDestinationOwnershipStaysWithCaller()
  {
    var backend = new FakeBackend(FullCapabilities(FsusWebViewPlatform.Windows));
    using var adapter = new FsusWebViewAdapter(backend);
    using var destination = new MemoryStream();
    using var cancellation = new CancellationTokenSource();
    cancellation.Cancel();

    await Assert.ThrowsAsync<OperationCanceledException>(async () =>
      await adapter.ExportPdfAsync(
        new FsusWebViewPdfExportOptions(),
        destination,
        cancellation.Token));

    Assert.Equal(0, backend.ExportCalls);
    Assert.True(destination.CanWrite);
  }

  [Fact]
  public async Task BackendCannotSilentlyClaimRequestedOutlineWasApplied()
  {
    var backend = new FakeBackend(FullCapabilities(FsusWebViewPlatform.Linux))
    {
      ReturnIncompleteOutline = true,
    };
    using var adapter = new FsusWebViewAdapter(backend);
    using var destination = new MemoryStream();

    var result = await adapter.ExportPdfAsync(
      new FsusWebViewPdfExportOptions { GenerateDocumentOutline = true },
      destination);

    Assert.Equal(FsusWebViewCommandStatus.InvalidBackendResult, result.Status);
    Assert.Contains("did not prove", result.Detail);
    Assert.True(destination.CanWrite);
  }

  [Fact]
  public async Task BackendCannotCloseCallerOwnedPdfStream()
  {
    var backend = new FakeBackend(FullCapabilities(FsusWebViewPlatform.Windows))
    {
      CloseDestination = true,
    };
    using var adapter = new FsusWebViewAdapter(backend);
    var destination = new MemoryStream();

    var result = await adapter.ExportPdfAsync(
      new FsusWebViewPdfExportOptions(),
      destination);

    Assert.Equal(FsusWebViewCommandStatus.InvalidBackendResult, result.Status);
    Assert.False(result.DestinationLeftOpen);
    Assert.Contains("closed", result.Detail);
  }

  private static FsusWebViewContextMenuRequest RichRequest(
    FsusWebViewContextMenuOrigin origin = FsusWebViewContextMenuOrigin.Pointer) => new()
    {
      Origin = origin,
      ViewportPoint = new FsusWebViewViewportPoint(120, 80),
      IsEditable = true,
      HasSelection = true,
      IsImageContent = true,
      EditCapabilities =
      FsusWebViewEditCapabilities.Cut |
      FsusWebViewEditCapabilities.Copy |
      FsusWebViewEditCapabilities.Paste |
      FsusWebViewEditCapabilities.RichCopy |
      FsusWebViewEditCapabilities.HtmlCopy |
      FsusWebViewEditCapabilities.PlainTextPaste |
      FsusWebViewEditCapabilities.InsertParagraph |
      FsusWebViewEditCapabilities.RichEdit,
      MisspelledWord = "teh",
      SpellingSuggestions =
    [
      new FsusWebViewSpellingSuggestion("the", "the"),
      new FsusWebViewSpellingSuggestion("tech", "tech"),
    ],
      NativeMenuFallbackAvailable = true,
    };

  private static FsusWebViewCapabilities FullCapabilities(FsusWebViewPlatform platform) => new()
  {
    Platform = platform,
    SpellingSuggestions = true,
    ReplaceWord = true,
    AddToDictionary = true,
    NativeContextMenu = true,
    DeveloperTools = true,
    TaggedPdf = true,
    DocumentOutline = true,
  };

  private sealed class FakeBackend(FsusWebViewCapabilities capabilities)
    : IFsusWebViewBackendAdapter
  {
    public FsusWebViewCapabilities Capabilities { get; } = capabilities;
    public event EventHandler<FsusWebViewContextMenuRequestedEventArgs>? ContextMenuRequested;
    public List<FsusWebViewContextCommandRequest> ContextCommands { get; } = [];
    public int DeveloperToolsCalls { get; private set; }
    public int ExportCalls { get; private set; }
    public bool ReturnIncompleteOutline { get; init; }
    public bool CloseDestination { get; init; }

    public void RaiseContextMenu(FsusWebViewContextMenuRequest request) =>
      ContextMenuRequested?.Invoke(this, new FsusWebViewContextMenuRequestedEventArgs(request));

    public ValueTask<FsusWebViewCommandResult> ExecuteContextCommandAsync(
      FsusWebViewContextCommandRequest request,
      CancellationToken cancellationToken = default)
    {
      cancellationToken.ThrowIfCancellationRequested();
      ContextCommands.Add(request);
      return ValueTask.FromResult(new FsusWebViewCommandResult(
        FsusWebViewCommandStatus.Succeeded));
    }

    public ValueTask<FsusWebViewCommandResult> OpenDeveloperToolsAsync(
      CancellationToken cancellationToken = default)
    {
      cancellationToken.ThrowIfCancellationRequested();
      DeveloperToolsCalls++;
      return ValueTask.FromResult(new FsusWebViewCommandResult(
        FsusWebViewCommandStatus.Succeeded));
    }

    public async ValueTask<FsusWebViewPdfExportResult> ExportPdfAsync(
      FsusWebViewPdfExportOptions options,
      Stream destination,
      CancellationToken cancellationToken = default)
    {
      cancellationToken.ThrowIfCancellationRequested();
      ExportCalls++;
      var pdf = Encoding.ASCII.GetBytes(
        $"%PDF-1.7\n% Platform={Capabilities.Platform}; Theme={options.Theme}\n" +
        "/StructTreeRoot << /Type /StructTreeRoot >>\n" +
        "/Outlines << /First 1 0 R >>\n" +
        "/Title (Article) /Dest (heading-article)\n" +
        "/Title (Methods) /Dest (heading-methods)\n%%EOF\n");
      await destination.WriteAsync(pdf, cancellationToken);
      if (CloseDestination)
      {
        destination.Dispose();
      }
      return new FsusWebViewPdfExportResult
      {
        Status = FsusWebViewCommandStatus.Succeeded,
        TaggedPdfApplied = options.GenerateTaggedPdf,
        DocumentOutlineApplied = options.GenerateDocumentOutline,
        DestinationLeftOpen = true,
        BytesWritten = pdf.Length,
        Outline = ReturnIncompleteOutline
          ? Array.Empty<FsusWebViewDocumentOutlineNode>()
          :
          [
            new FsusWebViewDocumentOutlineNode
            {
              Title = "Article",
              HeadingLevel = 1,
              Destination = "heading-article",
              Children =
              [
                new FsusWebViewDocumentOutlineNode
                {
                  Title = "Methods",
                  HeadingLevel = 2,
                  Destination = "heading-methods",
                },
              ],
            },
          ],
      };
    }
  }
}
