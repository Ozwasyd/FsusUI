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
        Selection: new FsusMarkdownEditorSelection(2, 2),
        DocumentIdentity: first.Identity));
    Assert.True(accepted.Accepted);
    Assert.Equal("aXc", accepted.Value);
    Assert.Equal(0, accepted.BeforeRevision);
    Assert.Equal(1, accepted.Revision);
    Assert.Equal(2, accepted.PositionMap?.Map(2, 1));
    Assert.Equal("abc", second.Value);
    Assert.Equal(0, second.UndoDepth);

    var stale = first.Dispatch(
      new FsusMarkdownEditorTransaction(
        [new FsusMarkdownEditorChange(0, 1, "Z")],
        ExpectedRevision: 0,
        DocumentIdentity: first.Identity));
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
  public void EditorRoutesTransactionsUndoRedoSelectionAndExternalResetThroughPublicEvents()
  {
    var identity = new FsusMarkdownDocumentIdentity("events", 1);
    var editor = new FsusMarkdownEditor
    {
      Document = "abc",
      DocumentIdentity = identity,
    };
    var store = editor.TransactionStore;
    var transactions = new List<FsusMarkdownEditorTransactionEventArgs>();
    var selections = new List<FsusMarkdownEditorSelectionChangedEventArgs>();
    var histories = new List<FsusMarkdownEditorHistoryChangedEventArgs>();
    editor.Transaction += (_, args) => transactions.Add(args);
    editor.SelectionChange += (_, args) => selections.Add(args);
    editor.HistoryChange += (_, args) => histories.Add(args);

    var dispatched = editor.DispatchTransaction(
      new FsusMarkdownEditorTransaction(
        [new FsusMarkdownEditorChange(3, 3, "!")],
        Selection: new FsusMarkdownEditorSelection(4, 4),
        DocumentIdentity: identity));
    Assert.True(dispatched.Accepted);
    Assert.Equal("abc!", editor.Document);
    Assert.Single(transactions);
    Assert.Single(selections);
    Assert.Single(histories);

    editor.Mode = FsusMarkdownEditorMode.Live;
    Assert.Same(store, editor.TransactionStore);
    Assert.True(editor.TransactionStore.History.CanUndo);

    Assert.True(editor.Undo().Accepted);
    Assert.True(editor.Redo().Accepted);
    Assert.Equal(3, transactions.Count);
    Assert.Equal("redo", transactions[^1].Transaction.Metadata?["action"]);

    editor.Document = "server";
    Assert.Equal("external", transactions[^1].Transaction.Origin);
    Assert.Equal("reset", transactions[^1].Transaction.ExternalUpdate);
    Assert.False(editor.TransactionStore.History.CanUndo);
    Assert.False(editor.Undo().Accepted);
    Assert.Equal("no-history", transactions[^1].Result.Reason);
  }

  [Fact]
  public void MutationFixturesKillNativeUndoDualAuthorityBareOffsetAndCrossDocument()
  {
    var report = FsusMarkdownEditorTransactionStore.EvaluateMutations();
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
