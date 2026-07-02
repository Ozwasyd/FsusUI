using FsusUI.Avalonia.Controls;

namespace FsusUI.Avalonia.PerformanceTests;

public class FsusDataTableBudgetTests
{
  [Theory]
  [InlineData(1000, 8)]
  [InlineData(10_000, 24)]
  [InlineData(100_000, 80)]
  public void DataTableLargeFixturesStayWithinVirtualizationBudgets(int rows, int columns)
  {
    var table = new FsusDataTable
    {
      VirtualizationThreshold = 250,
      VisibleRowLimit = 48,
      VisibleColumnLimit = 12,
    };
    for (var column = 0; column < columns; column++)
    {
      table.Columns.Add(new FsusDataTableColumn($"c{column}", $"Column {column}"));
    }
    for (var row = 0; row < rows; row++)
    {
      table.Rows.Add(FsusDataTableRow.From($"row-{row}", new Dictionary<string, object?>()));
    }

    table.RefreshView();

    var budget = table.EvaluateBudget(rows, columns);

    Assert.True(table.IsRowVirtualized);
    Assert.True(budget.WithinBudget, budget.ToString());
    Assert.True(table.VisibleRows.Count <= table.VisibleRowLimit);
    Assert.True(table.VisibleColumns.Count <= table.VisibleColumnLimit);
    Assert.True(table.EstimatedRetainedCellControls <= table.VirtualizationBudget.RetainedCellControls);
  }
}
