using FsusUI.Avalonia.Controls;

namespace FsusUI.Avalonia.Tests.Controls;

public class FsusMarkdownEditorTransactionTests
{
  [Fact]
  public void SharedHistoryAppliesChangesAndUndo()
  {
    var history = new FsusMarkdownEditorHistory();
    var next = history.Apply("abc", [new FsusMarkdownEditorChange(1, 2, "X")]);
    Assert.Equal("aXc", next);
    Assert.Equal(1, history.UndoDepth);
    Assert.True(history.TryUndo(next, out var previous));
    Assert.Equal("abc", previous);
  }

  [Fact]
  public void DispatcherIsolatesDocumentsAndRejectsStaleRevision()
  {
    var first = new FsusMarkdownEditorTransactionStore(new FsusMarkdownDocumentIdentity("doc-a", 1), "abc");
    var second = new FsusMarkdownEditorTransactionStore(new FsusMarkdownDocumentIdentity("doc-b", 1), "abc");
    var accepted = first.Dispatch(
      new FsusMarkdownEditorTransaction(
        [new FsusMarkdownEditorChange(1, 2, "X")],
        Selection: new FsusMarkdownEditorSelection(2, 2)));
    Assert.True(accepted.Accepted);
    Assert.Equal("aXc", accepted.Value);
    Assert.Equal("abc", second.Value);
    Assert.Equal(0, second.UndoDepth);

    var stale = first.Dispatch(
      new FsusMarkdownEditorTransaction(
        [new FsusMarkdownEditorChange(0, 1, "Z")],
        ExpectedRevision: 0));
    Assert.False(stale.Accepted);
    Assert.Equal("stale-revision", stale.Reason);

    var undone = first.Undo();
    Assert.True(undone.Accepted);
    Assert.Equal("abc", undone.Value);
    Assert.True(first.Redo().Accepted);

    var editor = new FsusMarkdownEditor
    {
      Document = "hi",
      DocumentIdentity = new FsusMarkdownDocumentIdentity("live", 2),
    };
    var dispatched = editor.Dispatch(
      new FsusMarkdownEditorTransaction([new FsusMarkdownEditorChange(2, 2, "!")]));
    Assert.True(dispatched.Accepted);
    Assert.Equal("hi!", editor.Document);
    Assert.Equal("hi", editor.UndoDocument().Value);
  }

  [Fact]
  public void MutationFixturesKillNativeUndoDualAuthorityBareOffsetAndCrossDocument()
  {
    var first = new FsusMarkdownEditorTransactionStore(new FsusMarkdownDocumentIdentity("a", 1), "ab");
    var second = new FsusMarkdownEditorTransactionStore(new FsusMarkdownDocumentIdentity("b", 1), "ab");
    var report = FsusMarkdownEditorTransactionStore.EvaluateMutations(first, second);
    Assert.All(report, mutation =>
    {
      Assert.False(mutation.Accepted);
      Assert.False(mutation.Equivalent);
    });
    Assert.Equal(
      ["native-undo-dual-authority", "bare-offset", "cross-document"],
      report.Select(mutation => mutation.Kind).ToArray());
  }
}
