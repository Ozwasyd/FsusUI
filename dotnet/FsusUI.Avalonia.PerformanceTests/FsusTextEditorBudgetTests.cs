using FsusUI.Avalonia.Controls;

namespace FsusUI.Avalonia.PerformanceTests;

public class FsusTextEditorBudgetTests
{
  [Fact]
  public async Task TextEditorLargeDocumentPreviewAndUndoStackStayWithinBudgets()
  {
    var editor = new FsusTextEditor
    {
      PreviewDebounce = TimeSpan.Zero,
    };
    var lines = Enumerable
      .Range(0, 10_000)
      .Select(index => $"Paragraph {index}");

    editor.TypeText(string.Join('\n', lines));
    for (var index = 0; index < 180; index++)
    {
      editor.TypeText($"\nEdit {index}");
    }

    Assert.True(await editor.SyncPreviewAsync());
    editor.ScrollEditorToBlock(9_950);

    var budget = editor.EvaluateBudget();

    Assert.True(editor.Preview.IsVirtualized);
    Assert.True(editor.UndoDepth <= budget.Budget.UndoStackEntries);
    Assert.True(editor.Preview.EstimatedRetainedBlockCount <= budget.Budget.PreviewRetainedBlocks);
    Assert.True(budget.WithinBudget);
  }
}
