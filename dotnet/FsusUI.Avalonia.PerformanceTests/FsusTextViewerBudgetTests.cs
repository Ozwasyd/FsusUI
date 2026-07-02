using FsusUI.Avalonia.Controls;

namespace FsusUI.Avalonia.PerformanceTests;

public class FsusTextViewerBudgetTests
{
  [Theory]
  [InlineData(1000)]
  [InlineData(10_000)]
  public async Task TextViewerLargeDocumentsStayWithinRetainedBlockBudgets(int blockCount)
  {
    var viewer = new FsusTextViewer
    {
      VirtualizationThreshold = 200,
      VisibleBlockLimit = 96,
    };
    for (var index = 0; index < blockCount; index++)
    {
      viewer.Blocks.Add(new FsusTextContentBlock(FsusTextBlockKind.Paragraph, $"Paragraph {index}"));
    }

    Assert.True(await viewer.RenderAsync());
    viewer.ScrollToBlock(Math.Max(0, blockCount - 120));

    Assert.True(viewer.IsVirtualized);
    Assert.True(viewer.EstimatedRetainedBlockCount <= viewer.RenderBudget.RetainedBlocks);
    Assert.True(viewer.EvaluateBudget().WithinBudget);
  }
}
