using FsusUI.Avalonia.Controls;

namespace FsusUI.Avalonia.Tests.Controls;

public class FsusMarkdownEditorAdjacentTests
{
  [Fact]
  public void SearchSnapshotsAreQueryAndRevisionBoundAndNavigationWraps()
  {
    const string source = "alpha beta alpha";
    var identity = new FsusMarkdownDocumentIdentity("search", 2);
    var editor = new FsusMarkdownEditor
    {
      Document = source,
      DocumentIdentity = identity,
    };
    var requests = new List<FsusMarkdownSearchRequestedEventArgs>();
    editor.SearchRequested += (_, args) => requests.Add(args);
    var query = new FsusMarkdownSearchQuery("alpha", 4);

    editor.RequestSearch(query);
    var committed = editor.CommitSearch(new(
      identity,
      0,
      query,
      [new(new(0, 5), 4, "text-a"), new(new(11, 16), 4, "text-b")]));

    Assert.True(committed.Accepted);
    Assert.Equal(2, committed.MatchCount);
    Assert.Equal(0, editor.CurrentSearchIndex);
    Assert.Single(requests);
    Assert.Equal(source, requests[0].Source);
    Assert.Equal(1, editor.NavigateSearch(FsusMarkdownSearchDirection.Next).CurrentIndex);
    Assert.Equal(0, editor.NavigateSearch(FsusMarkdownSearchDirection.Next).CurrentIndex);
    Assert.Equal(1, editor.NavigateSearch(FsusMarkdownSearchDirection.Previous).CurrentIndex);

    _ = editor.DispatchTransaction(new(
      [new(source.Length, source.Length, "!")],
      History: "separate",
      Origin: "programmatic",
      DocumentIdentity: identity));
    Assert.Empty(editor.SearchMatches);
    Assert.Equal(2, requests.Count);
    var stale = editor.CommitSearch(new(identity, 0, query, []));
    Assert.False(stale.Accepted);
    Assert.Equal("stale-revision", stale.Reason);
  }

  [Fact]
  public void OutlineConsumesStableHostItemsAndRejectsMalformedOrStaleRanges()
  {
    const string source = "# Heading\n\n## Child\n";
    var identity = new FsusMarkdownDocumentIdentity("outline", 1);
    var editor = new FsusMarkdownEditor
    {
      Document = source,
      DocumentIdentity = identity,
    };
    var valid = new FsusMarkdownOutlineSnapshot(
      identity,
      0,
      [
        new("heading", 1, "Heading", new(0, 9), new(2, 9)),
        new("child", 2, "Child", new(11, 19), new(14, 19), "heading"),
      ]);

    Assert.True(editor.CommitOutline(valid).Accepted);
    Assert.Equal(["heading", "child"], editor.Outline.Select(item => item.NodeId));
    Assert.False(editor.CommitOutline(valid with
    {
      Items = [new("bad", 7, "Bad", new(0, 9), new(2, 9))],
    }).Accepted);

    editor.Document = "# Changed";
    Assert.Empty(editor.Outline);
    Assert.Equal(
      FsusMarkdownRevealStatus.Stale,
      editor.RevealHeading("heading", identity, 0));
  }

  [Fact]
  public async Task OutputHostReceivesCanonicalHtmlBeforePrintAndFailsClosedOnDrift()
  {
    var identity = new FsusMarkdownDocumentIdentity("output", 3);
    var host = new RecordingOutputHost();
    var editor = new FsusMarkdownEditor
    {
      Document = "# Export",
      DocumentIdentity = identity,
      OutputHost = host,
    };

    var exported = await editor.ExportHtmlAsync("https://example.test/docs/");
    var printed = await editor.PrintAsync("Export document");

    Assert.True(exported.Succeeded);
    Assert.Equal("<h1>Export</h1>", exported.Html);
    Assert.True(printed.Succeeded);
    Assert.Equal("<h1>Export</h1>", Assert.Single(host.PrintRequests).Html);
    Assert.Equal(2, host.ExportRequests.Count);
    Assert.All(host.ExportRequests, request => Assert.Equal(identity, request.DocumentIdentity));

    host.OnExport = () => editor.Document = "# Changed while rendering";
    var stale = await editor.ExportHtmlAsync();
    Assert.Equal(FsusMarkdownEditorOutputStatus.Stale, stale.Status);

    editor.Document = "# Print drift";
    host.OnExport = null;
    host.OnPrint = () => editor.Document = "# Changed while printing";
    var stalePrint = await editor.PrintAsync();
    Assert.Equal(FsusMarkdownEditorOutputStatus.Stale, stalePrint.Status);

    editor.OutputHost = null;
    Assert.Equal(
      FsusMarkdownEditorOutputStatus.Unsupported,
      (await editor.PrintAsync()).Status);
  }

  [Fact]
  public void WritingAidHooksPreserveUpperThirdDefaultAndManualSuspension()
  {
    var editor = new FsusMarkdownEditor();
    var states = new List<FsusMarkdownWritingAidsState>();
    editor.WritingAidsStateChanged += (_, args) => states.Add(args.State);

    Assert.Equal(FsusMarkdownTypewriterAnchor.UpperThird, editor.TypewriterAnchor);
    editor.NotifyWritingAidsInteraction(FsusMarkdownWritingAidsInteraction.UserScroll);
    Assert.Equal(FsusMarkdownWritingAidsState.UserScrollSuspended, editor.WritingAidsState);
    editor.NotifyWritingAidsInteraction(FsusMarkdownWritingAidsInteraction.SelectionDragEnd);
    Assert.Equal(FsusMarkdownWritingAidsState.UserScrollSuspended, editor.WritingAidsState);
    editor.NotifyWritingAidsInteraction(FsusMarkdownWritingAidsInteraction.Input);
    Assert.Equal(FsusMarkdownWritingAidsState.Restoring, editor.WritingAidsState);
    editor.NotifyWritingAidsInteraction(FsusMarkdownWritingAidsInteraction.Input);
    Assert.Equal(FsusMarkdownWritingAidsState.InputDriven, editor.WritingAidsState);
    Assert.Equal(
      [
        FsusMarkdownWritingAidsState.UserScrollSuspended,
        FsusMarkdownWritingAidsState.Restoring,
        FsusMarkdownWritingAidsState.InputDriven,
      ],
      states);

    editor.NotifyWritingAidsInteraction(FsusMarkdownWritingAidsInteraction.SelectionDragStart);
    editor.NotifyWritingAidsInteraction(FsusMarkdownWritingAidsInteraction.SelectionDragEnd);
    Assert.Equal(FsusMarkdownWritingAidsState.Idle, editor.WritingAidsState);
    editor.NotifyWritingAidsInteraction(FsusMarkdownWritingAidsInteraction.CompositionStart);
    editor.NotifyWritingAidsInteraction(FsusMarkdownWritingAidsInteraction.CompositionEnd);
    Assert.Equal(FsusMarkdownWritingAidsState.Idle, editor.WritingAidsState);
  }

  private sealed class RecordingOutputHost : IFsusMarkdownEditorOutputHost
  {
    public FsusMarkdownEditorOutputCapabilities Capabilities { get; } = new(true, true);

    public List<FsusMarkdownHtmlExportRequest> ExportRequests { get; } = [];

    public List<FsusMarkdownPrintRequest> PrintRequests { get; } = [];

    public Action? OnExport { get; set; }

    public Action? OnPrint { get; set; }

    public ValueTask<FsusMarkdownHtmlExportResult> ExportHtmlAsync(
      FsusMarkdownHtmlExportRequest request,
      CancellationToken cancellationToken = default)
    {
      cancellationToken.ThrowIfCancellationRequested();
      ExportRequests.Add(request);
      OnExport?.Invoke();
      return ValueTask.FromResult(new FsusMarkdownHtmlExportResult(
        FsusMarkdownEditorOutputStatus.Succeeded,
        "<h1>Export</h1>"));
    }

    public ValueTask<FsusMarkdownPrintResult> PrintAsync(
      FsusMarkdownPrintRequest request,
      CancellationToken cancellationToken = default)
    {
      cancellationToken.ThrowIfCancellationRequested();
      PrintRequests.Add(request);
      OnPrint?.Invoke();
      return ValueTask.FromResult(new FsusMarkdownPrintResult(
        FsusMarkdownEditorOutputStatus.Succeeded));
    }
  }
}
