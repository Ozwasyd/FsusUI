using FsusUI.Avalonia.Controls;

namespace FsusUI.Avalonia.PerformanceTests;

public class FsusTreeBudgetTests
{
  [Theory]
  [InlineData(1000)]
  [InlineData(10_000)]
  public void TreeV2LargeNodeFixturesStayWithinRealizedRowBudgets(int nodeCount)
  {
    var tree = new FsusTreeV2
    {
      VirtualizationThreshold = 100,
      VisibleRowLimit = 48,
    };
    for (var index = 0; index < nodeCount; index++)
    {
      tree.Nodes.Add(new FsusTreeNode($"node-{index}", $"Node {index}"));
    }

    tree.RefreshView();
    tree.ScrollToIndex(Math.Max(0, nodeCount - 100));

    Assert.True(tree.IsVirtualized);
    Assert.True(tree.RealizedRowCount <= tree.VirtualizationBudget.RealizedRows);
    Assert.True(tree.EvaluateBudget().WithinBudget);
  }

  [Fact]
  public void TreeTableLargeFixturesStayWithinCellAndDepthBudgets()
  {
    var tree = new FsusTreeV2
    {
      VirtualizationThreshold = 100,
      VisibleRowLimit = 40,
    };
    for (var index = 0; index < 10_000; index++)
    {
      tree.Nodes.Add(new FsusTreeNode($"node-{index}", $"Node {index}"));
    }
    tree.RefreshView();

    var treeTable = new FsusTreeTable
    {
      Tree = tree,
      VisibleColumnLimit = 8,
    };
    for (var column = 0; column < 24; column++)
    {
      treeTable.Columns.Add(new FsusDataTableColumn($"c{column}", $"Column {column}"));
    }

    treeTable.RefreshView();

    Assert.True(treeTable.IsVirtualized);
    Assert.True(treeTable.RealizedCellCount <= treeTable.VirtualizationBudget.RealizedCells);
    Assert.True(treeTable.EvaluateBudget().WithinBudget);
  }
}
