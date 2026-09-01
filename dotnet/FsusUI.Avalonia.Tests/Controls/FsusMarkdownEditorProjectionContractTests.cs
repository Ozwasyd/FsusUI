using FsusUI.Avalonia.Controls;

namespace FsusUI.Avalonia.Tests.Controls;

public class FsusMarkdownEditorProjectionContractTests
{
  [Fact]
  public void SourceAndLiveShareOneDocumentSelectionHistoryAndProjectionRequestOwner()
  {
    var identity = new FsusMarkdownDocumentIdentity("document", 4);
    var editor = new FsusMarkdownEditor
    {
      Document = "# Title",
      DocumentIdentity = identity,
      Mode = FsusMarkdownEditorMode.Source,
    };
    var store = editor.TransactionStore;
    var requests = new List<FsusMarkdownProjectionRequestedEventArgs>();
    editor.ProjectionRequested += (_, args) => requests.Add(args);
    var edited = editor.Dispatch(
      new FsusMarkdownEditorTransaction(
        [new FsusMarkdownEditorChange(7, 7, "!")],
        Selection: new FsusMarkdownEditorSelection(8, 8)));

    editor.Mode = FsusMarkdownEditorMode.Live;

    Assert.True(edited.Accepted);
    Assert.Same(store, editor.TransactionStore);
    Assert.Equal(identity, editor.TransactionStore.Identity);
    Assert.Equal("# Title!", editor.Document);
    Assert.Equal(new FsusMarkdownEditorSelection(8, 8), editor.TransactionStore.Selection);
    Assert.True(editor.TransactionStore.History.CanUndo);
    Assert.Equal("source-fallback", editor.CapabilityState);
    var request = Assert.Single(requests);
    Assert.Equal(identity, request.DocumentIdentity);
    Assert.Equal(edited.Revision, request.Revision);
    Assert.Equal("# Title!", request.Source);
    Assert.Same(editor.SourceCoordinateMap, request.Coordinates);

    var undo = editor.UndoDocument();
    Assert.True(undo.Accepted);
    Assert.Equal("# Title", editor.Document);
    Assert.Equal(new FsusMarkdownEditorSelection(7, 7), undo.Selection);
    Assert.Same(store, editor.TransactionStore);
  }

  [Fact]
  public void CommitAcceptsOnlyCurrentCanonicalSourceAndRejectsStaleOrMalformedProjection()
  {
    var identity = new FsusMarkdownDocumentIdentity("projection", 2);
    var editor = new FsusMarkdownEditor
    {
      Document = "**bold**",
      DocumentIdentity = identity,
      Mode = FsusMarkdownEditorMode.Live,
    };
    var valid = new FsusMarkdownProjectionSnapshot(
      identity,
      0,
      "**bold**",
      [
        new("marker-open", new(0, 2), FsusMarkdownProjectionSpanKind.HiddenMarker, ""),
        new("strong-text", new(2, 6), FsusMarkdownProjectionSpanKind.Text, "bold", "strong"),
        new("marker-close", new(6, 8), FsusMarkdownProjectionSpanKind.HiddenMarker, ""),
      ]);

    var accepted = editor.CommitProjection(valid);
    var stale = editor.CommitProjection(valid with { Revision = 1 });
    var wrongSource = editor.CommitProjection(valid with { Source = "**other**" });
    var malformed = editor.CommitProjection(valid with
    {
      Spans =
      [
        new("overlap-a", new(0, 4), FsusMarkdownProjectionSpanKind.Text, "a"),
        new("overlap-b", new(3, 5), FsusMarkdownProjectionSpanKind.Text, "b"),
      ],
    });

    Assert.True(accepted.Accepted);
    Assert.Equal("aligned", editor.CapabilityState);
    Assert.False(stale.Accepted);
    Assert.Equal("stale-revision", stale.Reason);
    Assert.False(wrongSource.Accepted);
    Assert.Equal("source-mismatch", wrongSource.Reason);
    Assert.False(malformed.Accepted);
    Assert.Equal("invalid-projection", malformed.Reason);
    Assert.Equal("**bold**", editor.Document);
    Assert.Same(identity, editor.DocumentIdentity);

    editor.ProjectionFeatureRevision = 3;
    var staleFeature = editor.CommitProjection(valid);
    Assert.False(staleFeature.Accepted);
    Assert.Equal("stale-feature-revision", staleFeature.Reason);
    Assert.Equal("source-fallback", editor.CapabilityState);
  }

  [Fact]
  public void CoordinateMapPreservesBomCrLfCjkEmojiAndRtlUtf16Offsets()
  {
    const string raw = "\uFEFF# 标题\r\n😀 مرحبا\rend";
    var map = FsusMarkdownSourceCoordinateMap.Create(raw);

    Assert.Equal("# 标题\n😀 مرحبا\nend", map.NormalizedSource);
    Assert.Equal(0, map.RawToNormalized(0));
    Assert.Equal(0, map.RawToNormalized(1));
    var crlf = raw.IndexOf("\r\n", StringComparison.Ordinal);
    Assert.Equal(map.RawToNormalized(crlf), map.RawToNormalized(crlf + 1));
    Assert.Equal(crlf, map.NormalizedToRaw(map.RawToNormalized(crlf), -1));
    Assert.Equal(crlf + 1, map.NormalizedToRaw(map.RawToNormalized(crlf), 1));
    Assert.Equal(raw.Length, map.NormalizedToRaw(map.NormalizedSource.Length, 1));
  }

  [Fact]
  public void HiddenAndAtomicSpansMapCaretPointerAssociationsBidirectionally()
  {
    const string source = "**bold** ![alt](image.png)";
    var identity = new FsusMarkdownDocumentIdentity("anchors", 1);
    var editor = new FsusMarkdownEditor
    {
      Document = source,
      DocumentIdentity = identity,
      Mode = FsusMarkdownEditorMode.Live,
    };
    var committed = editor.CommitProjection(new(
      identity,
      0,
      source,
      [
        new("open", new(0, 2), FsusMarkdownProjectionSpanKind.HiddenMarker, ""),
        new("text", new(2, 6), FsusMarkdownProjectionSpanKind.Text, "bold"),
        new("close", new(6, 8), FsusMarkdownProjectionSpanKind.HiddenMarker, ""),
        new("image", new(9, source.Length), FsusMarkdownProjectionSpanKind.Atomic, "Image: alt", "image"),
      ]));

    Assert.True(committed.Accepted);
    var map = Assert.IsType<FsusMarkdownProjectionMap>(editor.ProjectionMap);
    Assert.Equal(0, map.SourceToVisual(1, -1));
    Assert.Equal(0, map.SourceToVisual(1, 1));
    Assert.Equal(0, map.VisualToSource(0, -1));
    Assert.Equal(2, map.VisualToSource(0, 1));
    Assert.Equal(6, map.VisualToSource(4, -1));
    Assert.Equal(8, map.VisualToSource(4, 1));
    var atomicStart = map.SourceToVisual(9, -1);
    var atomicEnd = map.SourceToVisual(source.Length, 1);
    Assert.Equal(9, map.VisualToSource(atomicStart, -1));
    Assert.Equal(source.Length, map.VisualToSource(atomicEnd, 1));
  }

  [Fact]
  public void OrdinaryEditRetainsUnaffectedNodeIdentityAndRejectsOldProjectionCommit()
  {
    const string source = "# Heading\nparagraph";
    var identity = new FsusMarkdownDocumentIdentity("retention", 1);
    var editor = new FsusMarkdownEditor
    {
      Document = source,
      DocumentIdentity = identity,
      Mode = FsusMarkdownEditorMode.Live,
    };
    var initial = new FsusMarkdownProjectionSnapshot(
      identity,
      0,
      source,
      [
        new("heading-marker", new(0, 2), FsusMarkdownProjectionSpanKind.HiddenMarker, ""),
        new("heading-text", new(2, 9), FsusMarkdownProjectionSpanKind.Text, "Heading", "heading"),
      ]);
    Assert.True(editor.CommitProjection(initial).Accepted);
    var requests = new List<FsusMarkdownProjectionRequestedEventArgs>();
    editor.ProjectionRequested += (_, args) => requests.Add(args);

    var edited = editor.Dispatch(new FsusMarkdownEditorTransaction(
      [new FsusMarkdownEditorChange(source.Length, source.Length, "!")],
      Selection: new FsusMarkdownEditorSelection(source.Length + 1, source.Length + 1)));

    Assert.True(edited.Accepted);
    var request = Assert.Single(requests);
    Assert.Equal(edited.Revision, request.Revision);
    Assert.Equal(source + "!", request.Source);
    Assert.Equal("source-fallback", editor.CapabilityState);
    Assert.Contains("heading-marker", editor.RetainedProjectionNodeIds);
    Assert.Contains("heading-text", editor.RetainedProjectionNodeIds);

    var stale = editor.CommitProjection(initial);
    var refreshed = editor.CommitProjection(initial with
    {
      Revision = edited.Revision,
      Source = source + "!",
      Spans =
      [
        .. initial.Spans,
        new("paragraph", new(10, source.Length + 1), FsusMarkdownProjectionSpanKind.Text, "paragraph!"),
      ],
    });

    Assert.False(stale.Accepted);
    Assert.Equal("stale-revision", stale.Reason);
    Assert.True(refreshed.Accepted);
    Assert.Equal("aligned", editor.CapabilityState);
    Assert.Equal(
      ["heading-marker", "heading-text"],
      refreshed.RetainedNodeIds.Order(StringComparer.Ordinal).ToArray());
    Assert.Equal(["paragraph"], refreshed.RebuiltNodeIds);
  }

  [Fact]
  public void InvalidatingOnePresentationSpanInvalidatesItsWholeStableNode()
  {
    const string source = "**bold** tail";
    var identity = new FsusMarkdownDocumentIdentity("multi-span", 1);
    var editor = new FsusMarkdownEditor
    {
      Document = source,
      DocumentIdentity = identity,
      Mode = FsusMarkdownEditorMode.Live,
    };
    Assert.True(editor.CommitProjection(new(
      identity,
      0,
      source,
      [
        new("strong", new(0, 2), FsusMarkdownProjectionSpanKind.HiddenMarker, ""),
        new("strong", new(2, 6), FsusMarkdownProjectionSpanKind.Text, "bold"),
        new("strong", new(6, 8), FsusMarkdownProjectionSpanKind.HiddenMarker, ""),
        new("tail", new(8, source.Length), FsusMarkdownProjectionSpanKind.Text, " tail"),
      ])).Accepted);

    var edited = editor.Dispatch(new FsusMarkdownEditorTransaction(
      [new FsusMarkdownEditorChange(3, 4, "a")],
      Selection: new FsusMarkdownEditorSelection(4, 4)));

    Assert.True(edited.Accepted);
    Assert.DoesNotContain("strong", editor.RetainedProjectionNodeIds);
    Assert.Contains("tail", editor.RetainedProjectionNodeIds);
    Assert.Equal("**bald** tail", editor.Document);
  }

  [Fact]
  public void ExternalDocumentUpdateKeepsStoreAndIdentityButInvalidatesProjection()
  {
    var identity = new FsusMarkdownDocumentIdentity("external", 1);
    var editor = new FsusMarkdownEditor
    {
      Document = "# source",
      DocumentIdentity = identity,
      Mode = FsusMarkdownEditorMode.Live,
    };
    var store = editor.TransactionStore;
    Assert.True(editor.CommitProjection(new(
      identity,
      0,
      "# source",
      [
        new(
          "source",
          new(0, 8),
          FsusMarkdownProjectionSpanKind.SourceFallback,
          "# source",
          FallbackReason: "localized-source"),
      ])).Accepted);

    editor.Document = "# updated source";

    Assert.Same(store, editor.TransactionStore);
    Assert.Same(identity, editor.DocumentIdentity);
    Assert.Equal(identity, editor.TransactionStore.Identity);
    Assert.Null(editor.ProjectionMap);
    Assert.Equal("source-fallback", editor.CapabilityState);
  }
}
