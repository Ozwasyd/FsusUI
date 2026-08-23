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
}
