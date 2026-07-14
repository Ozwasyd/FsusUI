using Avalonia;
using FsusUI.Avalonia.Controls;

namespace FsusUI.Avalonia.PerformanceTests;

public class FsusVirtualizationBudgetTests
{
  [Theory]
  [InlineData(1000)]
  [InlineData(10_000)]
  [InlineData(100_000)]
  public void VirtualListLargeFixturesStayWithinRealizationBudgets(int itemCount)
  {
    var list = new FsusVirtualList
    {
      ItemCount = itemCount,
      FixedItemSize = 32,
      ViewportSize = 640,
      Overscan = 2,
    };

    list.RefreshWindow();
    list.ScrollToIndex(Math.Max(0, itemCount - 200));

    Assert.True(list.IsVirtualized);
    Assert.True(list.RealizedContainerCount <= list.VirtualizationBudget.RealizedContainers);
    Assert.Equal(list.RealizedContainerCount, list.RealizedVisualCount);
    Assert.Equal(list.RealizedContainerCount, list.RealizedContainers.Count);
    Assert.True(list.CreatedContainerCount <= list.RealizedContainerCount + list.ContainerPoolLimit);
    Assert.True(list.RetainedMeasurementCount <= list.VirtualizationBudget.RetainedMeasurements);
    Assert.True(list.EvaluateBudget().WithinBudget);
  }

  [Theory]
  [InlineData(1000)]
  [InlineData(10_000)]
  [InlineData(100_000)]
  public void VariableVirtualListUsesLogarithmicLookupAndBoundedRealVisuals(int itemCount)
  {
    var list = new FsusVirtualList
    {
      ItemCount = itemCount,
      FixedItemSize = 32,
      ViewportSize = 640,
      Overscan = 2,
      SizeMode = FsusVirtualSizeMode.Variable,
    };
    for (var index = 0; index < Math.Min(itemCount, 2048); index++)
    {
      list.SetMeasuredSize(index, 24 + index % 9 * 3);
    }

    list.ScrollToIndex(itemCount - 1);

    var logarithmicStepLimit = (int)Math.Ceiling(Math.Log2(itemCount)) + 2;
    Assert.True(list.LastIndexLookupSteps <= logarithmicStepLimit);
    Assert.True(list.LastOffsetLookupSteps <= logarithmicStepLimit);
    Assert.Equal(list.RealizedContainerCount, list.VisualHost.Children.Count);
    Assert.True(list.RetainedMeasurementCount <= list.VirtualizationBudget.RetainedMeasurements);
  }

  [Theory]
  [InlineData(1000, 8)]
  [InlineData(10_000, 24)]
  [InlineData(100_000, 80)]
  public void TableV2LargeFixturesStayWithinRealizedCellBudgets(int rowCount, int columnCount)
  {
    var table = new FsusTableV2
    {
      RowCount = rowCount,
      ColumnCount = columnCount,
      RowHeight = 32,
      ColumnWidth = 120,
      Overscan = 2,
    };
    table.AttachResizer(new FsusAutoResizer { Viewport = new Size(960, 640) });

    table.RefreshLayout();
    table.ScrollToCell(Math.Max(0, rowCount - 200), Math.Max(0, columnCount - 16));

    Assert.True(table.IsVirtualized);
    Assert.True(table.RealizedCellCount <= table.VirtualizationBudget.RealizedCells);
    Assert.Equal(table.RealizedCellCount, table.RealizedVisualCount);
    Assert.Equal(table.RealizedCellCount, table.RealizedCells.Count);
    Assert.True(table.CreatedCellCount <= table.RealizedCellCount + table.ContainerPoolLimit);
    Assert.True(table.EvaluateBudget().WithinBudget);
  }
}
