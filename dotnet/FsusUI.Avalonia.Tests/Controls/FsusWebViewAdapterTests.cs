using Avalonia;
using Avalonia.Controls;
using FsusUI.Avalonia.Controls;
using FsusUI.Avalonia.Overlay;
using FsusUI.Avalonia.TestFixtures;
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

  [Theory]
  [InlineData("teh", "", " ")]
  [InlineData(" ", "the", "tech")]
  public void UnusableSuggestionDataOffersNativeMenuEscapeHatch(
    string misspelledWord,
    string firstReplacement,
    string secondReplacement)
  {
    var backend = new FakeBackend(FullCapabilities(FsusWebViewPlatform.Windows));
    using var adapter = new FsusWebViewAdapter(backend);
    var menu = new FsusContextMenu();
    var request = RichRequest() with
    {
      MisspelledWord = misspelledWord,
      SpellingSuggestions =
      [
        new FsusWebViewSpellingSuggestion(firstReplacement, "first"),
        new FsusWebViewSpellingSuggestion(secondReplacement, "second"),
      ],
    };

    adapter.OpenContextMenu(
      new FsusOverlayHost(),
      menu,
      request,
      new Button { Content = "Editor" });

    Assert.DoesNotContain(menu.Items.OfType<FsusContextMenuItem>(),
      item => item.Key.Contains("replace", StringComparison.Ordinal));
    Assert.Contains(menu.Items.OfType<FsusContextMenuItem>(),
      item => item.Key == "fsus-webview:native-menu" && item.IsEnabled);
  }

  [Fact]
  public void BlankSuggestionAccessibleNameFallsBackToReplacement()
  {
    var backend = new FakeBackend(FullCapabilities(FsusWebViewPlatform.Linux));
    using var adapter = new FsusWebViewAdapter(backend);
    var menu = new FsusContextMenu();
    var request = RichRequest() with
    {
      SpellingSuggestions =
      [
        new FsusWebViewSpellingSuggestion("the", " "),
      ],
    };

    adapter.OpenContextMenu(
      new FsusOverlayHost(),
      menu,
      request,
      new Button { Content = "Editor" });

    Assert.Equal(
      "the",
      menu.Items.OfType<FsusContextMenuItem>()
        .Single(item => item.Key.StartsWith("fsus-webview:replace:", StringComparison.Ordinal))
        .Header);
  }

  [Theory]
  [InlineData(
    FsusWebViewPlatform.Windows,
    FsusWebViewPrintTheme.Light,
    "#FFFFFF",
    "#0F0F11")]
  [InlineData(
    FsusWebViewPlatform.Windows,
    FsusWebViewPrintTheme.Dark,
    "#121214",
    "#F0F0F4")]
  [InlineData(
    FsusWebViewPlatform.Linux,
    FsusWebViewPrintTheme.Light,
    "#FFFFFF",
    "#0F0F11")]
  [InlineData(
    FsusWebViewPlatform.Linux,
    FsusWebViewPrintTheme.Dark,
    "#121214",
    "#F0F0F4")]
  public async Task TaggedPdfAndHierarchicalOutlineAreProvenByAdapterSimulation(
    FsusWebViewPlatform platform,
    FsusWebViewPrintTheme theme,
    string expectedPageBackground,
    string expectedTextColor)
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
    Assert.Equal(2, result.Outline[0].Children.Count);
    Assert.Equal("Methods", result.Outline[0].Children[0].Title);
    Assert.Equal(
      "Inputs",
      Assert.Single(result.Outline[0].Children[0].Children).Title);
    Assert.Equal("Results", result.Outline[0].Children[1].Title);
    Assert.All(
      result.Outline.SelectMany(FlattenOutline),
      node => Assert.StartsWith("heading-", node.Destination));
    var printRender = Assert.IsType<FakePrintRenderSnapshot>(backend.LastPrintRender);
    Assert.Equal(expectedPageBackground, printRender.PageBackground);
    Assert.Equal(expectedTextColor, printRender.TextColor);
    Assert.True(printRender.PrintBackgrounds);
    Assert.Collection(
      printRender.HeadingRuns,
      heading =>
      {
        Assert.Equal(("Article", 1, "heading-article", 1, 72, 24),
          (heading.Title, heading.HeadingLevel, heading.Destination,
            heading.Page, heading.Top, heading.FontSize));
      },
      heading => Assert.Equal(("Methods", 2, 1, 168, 22),
        (heading.Title, heading.HeadingLevel, heading.Page, heading.Top, heading.FontSize)),
      heading => Assert.Equal(("Inputs", 3, 1, 264, 20),
        (heading.Title, heading.HeadingLevel, heading.Page, heading.Top, heading.FontSize)),
      heading => Assert.Equal(("Results", 2, 2, 72, 22),
        (heading.Title, heading.HeadingLevel, heading.Page, heading.Top, heading.FontSize)));
    var pdf = Encoding.ASCII.GetString(destination.ToArray());
    Assert.StartsWith("%PDF-1.7", pdf);
    Assert.Contains("/StructTreeRoot", pdf);
    Assert.Contains("/Outlines", pdf);
    Assert.Contains("/S /H1", pdf);
    Assert.Contains("/T (Article)", pdf);
    Assert.Contains("/S /H2", pdf);
    Assert.Contains("/T (Methods)", pdf);
    Assert.Contains("/S /H3", pdf);
    Assert.Contains("/T (Inputs)", pdf);
    Assert.Contains("/Dest (heading-article)", pdf);
    Assert.Contains("/Dest (heading-results)", pdf);
    Assert.Contains($"/PageBackground ({expectedPageBackground})", pdf);
    Assert.Contains($"/TextColor ({expectedTextColor})", pdf);
    Assert.Contains("/PrintBackgrounds true", pdf);
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
  public async Task InFlightCancellationInterruptsBackendAndPreservesDestinationOwnership()
  {
    var backend = new FakeBackend(FullCapabilities(FsusWebViewPlatform.Windows))
    {
      PauseExportUntilCancelled = true,
    };
    using var adapter = new FsusWebViewAdapter(backend);
    using var destination = new MemoryStream();
    using var cancellation = new CancellationTokenSource();

    var export = adapter.ExportPdfAsync(
      new FsusWebViewPdfExportOptions(),
      destination,
      cancellation.Token).AsTask();
    await backend.ExportStarted.Task.WaitAsync(TimeSpan.FromSeconds(2));
    cancellation.Cancel();

    await Assert.ThrowsAnyAsync<OperationCanceledException>(() => export);
    Assert.Equal(1, backend.ExportCalls);
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
    Assert.True(result.DestinationLeftOpen);
    Assert.True(destination.CanWrite);
    Assert.Contains("attempted to close", result.Detail);
  }

  [Fact]
  public async Task BackendCannotClaimSuccessWithoutWritingPdfBytes()
  {
    var backend = new FakeBackend(FullCapabilities(FsusWebViewPlatform.Windows))
    {
      SkipPdfWrite = true,
    };
    using var adapter = new FsusWebViewAdapter(backend);
    using var destination = new MemoryStream();

    var result = await adapter.ExportPdfAsync(
      new FsusWebViewPdfExportOptions(),
      destination);

    Assert.Equal(FsusWebViewCommandStatus.InvalidBackendResult, result.Status);
    Assert.Equal(0, result.BytesWritten);
    Assert.Equal(0, destination.Length);
    Assert.Contains("non-empty PDF write", result.Detail);
  }

  [Fact]
  public async Task BackendCannotClaimPdfStructureOrMissingOutlineDestination()
  {
    var backend = new FakeBackend(FullCapabilities(FsusWebViewPlatform.Linux))
    {
      OmitLastDestination = true,
    };
    using var adapter = new FsusWebViewAdapter(backend);
    using var destination = new MemoryStream();

    var result = await adapter.ExportPdfAsync(
      new FsusWebViewPdfExportOptions
      {
        GenerateTaggedPdf = true,
        GenerateDocumentOutline = true,
      },
      destination);

    Assert.Equal(FsusWebViewCommandStatus.InvalidBackendResult, result.Status);
    Assert.Contains("heading-results", result.Detail);
  }

  [Fact]
  public async Task BackendCannotClaimSuccessWithPdfMarkersButNoObjectGraph()
  {
    var backend = new FakeBackend(FullCapabilities(FsusWebViewPlatform.Windows))
    {
      WritePseudoPdf = true,
    };
    using var adapter = new FsusWebViewAdapter(backend);
    using var destination = new MemoryStream();

    var result = await adapter.ExportPdfAsync(
      new FsusWebViewPdfExportOptions
      {
        GenerateTaggedPdf = true,
        GenerateDocumentOutline = true,
      },
      destination);

    Assert.Equal(FsusWebViewCommandStatus.InvalidBackendResult, result.Status);
    Assert.Contains("complete PDF structure", result.Detail);
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
    TaggedPdf = true,
    DocumentOutline = true,
  };

  private static IEnumerable<FsusWebViewDocumentOutlineNode> FlattenOutline(
    FsusWebViewDocumentOutlineNode node)
  {
    yield return node;
    foreach (var child in node.Children.SelectMany(FlattenOutline))
    {
      yield return child;
    }
  }

  private sealed class FakeBackend(FsusWebViewCapabilities capabilities)
    : IFsusWebViewBackendAdapter
  {
    public FsusWebViewCapabilities Capabilities { get; } = capabilities;
    public event EventHandler<FsusWebViewContextMenuRequestedEventArgs>? ContextMenuRequested;
    public List<FsusWebViewContextCommandRequest> ContextCommands { get; } = [];
    public int ExportCalls { get; private set; }
    public bool ReturnIncompleteOutline { get; init; }
    public bool CloseDestination { get; init; }
    public bool SkipPdfWrite { get; init; }
    public bool OmitLastDestination { get; init; }
    public bool WritePseudoPdf { get; init; }
    public bool PauseExportUntilCancelled { get; init; }
    public TaskCompletionSource ExportStarted { get; } = new(
      TaskCreationOptions.RunContinuationsAsynchronously);
    public FakePrintRenderSnapshot? LastPrintRender { get; private set; }

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

    public async ValueTask<FsusWebViewPdfExportResult> ExportPdfAsync(
      FsusWebViewPdfExportOptions options,
      Stream destination,
      CancellationToken cancellationToken = default)
    {
      cancellationToken.ThrowIfCancellationRequested();
      ExportCalls++;
      ExportStarted.TrySetResult();
      if (PauseExportUntilCancelled)
      {
        await Task.Delay(Timeout.InfiniteTimeSpan, cancellationToken);
      }
      var outline = BuildOutline(PrintableHeadings);
      LastPrintRender = BuildPrintRender(options, PrintableHeadings);
      var pdf = WritePseudoPdf
        ? Encoding.ASCII.GetBytes(
          "%PDF-1.7\n/StructTreeRoot\n/Outlines\n" +
          "/Dest (heading-article)\n/Dest (heading-methods)\n" +
          "/Dest (heading-inputs)\n/Dest (heading-results)\n%%EOF\n")
        : TestWebViewPdfDocument.Create(
          options.Theme == FsusWebViewPrintTheme.Dark,
          options.GenerateTaggedPdf,
          options.GenerateDocumentOutline,
          OmitLastDestination);
      if (!SkipPdfWrite)
      {
        await destination.WriteAsync(pdf, cancellationToken);
      }
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
        BytesWritten = SkipPdfWrite ? 0 : pdf.Length,
        Outline = ReturnIncompleteOutline
          ? Array.Empty<FsusWebViewDocumentOutlineNode>()
          : options.GenerateDocumentOutline
            ? outline
            : Array.Empty<FsusWebViewDocumentOutlineNode>(),
      };
    }

    private static readonly IReadOnlyList<FakeSemanticHeading> PrintableHeadings =
    [
      new("h1", "Article", "heading-article"),
      new("h2", "Methods", "heading-methods"),
      new("h3", "Inputs", "heading-inputs"),
      new("h2", "Results", "heading-results"),
    ];

    private static IReadOnlyList<FsusWebViewDocumentOutlineNode> BuildOutline(
      IReadOnlyList<FakeSemanticHeading> headings)
    {
      var roots = new List<FakeOutlineBuilder>();
      var ancestors = new Stack<FakeOutlineBuilder>();
      foreach (var heading in headings)
      {
        var level = int.Parse(heading.Tag.AsSpan(1));
        while (ancestors.TryPeek(out var ancestor) && ancestor.HeadingLevel >= level)
        {
          ancestors.Pop();
        }

        var builder = new FakeOutlineBuilder(
          heading.Title,
          level,
          heading.Destination);
        if (ancestors.TryPeek(out var parent))
        {
          parent.Children.Add(builder);
        }
        else
        {
          roots.Add(builder);
        }
        ancestors.Push(builder);
      }

      return roots.Select(builder => builder.ToNode()).ToArray();
    }

    private static FakePrintRenderSnapshot BuildPrintRender(
      FsusWebViewPdfExportOptions options,
      IReadOnlyList<FakeSemanticHeading> headings)
    {
      var pageBackground = options.Theme == FsusWebViewPrintTheme.Dark
        ? "#121214"
        : "#FFFFFF";
      var textColor = options.Theme == FsusWebViewPrintTheme.Dark
        ? "#F0F0F4"
        : "#0F0F11";
      var runs = headings.Select((heading, index) =>
      {
        var level = int.Parse(heading.Tag.AsSpan(1));
        return new FakePrintedHeading(
          heading.Title,
          level,
          heading.Destination,
          (index / 3) + 1,
          72 + ((index % 3) * 96),
          Math.Max(14, 26 - (level * 2)));
      }).ToArray();
      return new FakePrintRenderSnapshot(
        pageBackground,
        textColor,
        options.PrintBackgrounds,
        runs);
    }
  }

  private sealed record FakeSemanticHeading(
    string Tag,
    string Title,
    string Destination);

  private sealed record FakePrintedHeading(
    string Title,
    int HeadingLevel,
    string Destination,
    int Page,
    int Top,
    int FontSize);

  private sealed record FakePrintRenderSnapshot(
    string PageBackground,
    string TextColor,
    bool PrintBackgrounds,
    IReadOnlyList<FakePrintedHeading> HeadingRuns);

  private sealed class FakeOutlineBuilder(
    string title,
    int headingLevel,
    string destination)
  {
    public string Title { get; } = title;
    public int HeadingLevel { get; } = headingLevel;
    public string Destination { get; } = destination;
    public List<FakeOutlineBuilder> Children { get; } = [];

    public FsusWebViewDocumentOutlineNode ToNode() => new()
    {
      Title = Title,
      HeadingLevel = HeadingLevel,
      Destination = Destination,
      Children = Children.Select(child => child.ToNode()).ToArray(),
    };
  }
}
