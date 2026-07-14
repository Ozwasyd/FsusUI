using Avalonia.Automation;
using Avalonia.Automation.Peers;
using Avalonia.Input;
using FsusUI.Avalonia.Controls;
using System.Runtime.CompilerServices;

namespace FsusUI.Avalonia.Tests.Controls;

public class FsusDataTablePrimitiveTests
{
  [Fact]
  public void DataTableSortsFiltersRendersCellsAndTracksRowIdentity()
  {
    var table = new KeyboardDataTable
    {
      AccessibleName = "Release table",
      Filter = row => row.GetString("status") == "open",
    };
    table.Columns.Add(new FsusDataTableColumn("name", "Name")
    {
      HeaderRenderer = column => $"{column.Header} header",
    });
    table.Columns.Add(new FsusDataTableColumn("score", "Score")
    {
      Sortable = true,
      Fixed = FsusDataTableFixedColumn.Left,
      CellRenderer = context => $"{context.Value} pts",
    });
    table.Columns.Add(new FsusDataTableColumn("owner", "Owner")
    {
      Fixed = FsusDataTableFixedColumn.Right,
    });
    table.Rows.Add(FsusDataTableRow.From("a", new Dictionary<string, object?>
    {
      ["name"] = "Alpha",
      ["score"] = 3,
      ["status"] = "open",
      ["owner"] = "Core",
    }));
    table.Rows.Add(FsusDataTableRow.From("b", new Dictionary<string, object?>
    {
      ["name"] = "Beta",
      ["score"] = 9,
      ["status"] = "closed",
      ["owner"] = "Docs",
    }));
    table.Rows.Add(FsusDataTableRow.From("c", new Dictionary<string, object?>
    {
      ["name"] = "Gamma",
      ["score"] = 7,
      ["status"] = "open",
      ["owner"] = "Runtime",
    }));

    table.RefreshView();

    Assert.Equal(new[] { "a", "c" }, table.ViewRows.Select(row => row.Key));
    Assert.Equal("Name header", table.Columns[0].RenderHeader());
    Assert.Equal("3 pts", table.RenderCell(table.ViewRows[0], table.Columns[1], 0, 1));
    Assert.Equal(new[] { "score" }, table.FixedLeftColumns.Select(column => column.Key));
    Assert.Equal(new[] { "owner" }, table.FixedRightColumns.Select(column => column.Key));

    Assert.True(table.SortBy("score", FsusSortDirection.Descending));

    Assert.Equal(new[] { "c", "a" }, table.ViewRows.Select(row => row.Key));
    Assert.Equal("score", table.SortColumnKey);
    Assert.Equal(FsusSortDirection.Descending, table.SortDirection);

    Assert.True(table.ToggleRowSelection("c"));
    Assert.True(table.ToggleRowExpansion("c"));

    var rowState = table.GetRowState("c");
    Assert.True(rowState.Selected);
    Assert.True(rowState.Expanded);
    Assert.Equal(1, rowState.RowIndex);
    Assert.Equal(2, rowState.RowCount);
    Assert.Equal("descending", table.GetColumnState("score").SortDirectionName);
  }

  [Fact]
  public async Task DataTableExposesStatesAndKeyboardGridNavigation()
  {
    var table = CreateSmallTable();

    table.RefreshView();

    Assert.Equal(AutomationControlType.DataGrid, AutomationProperties.GetControlTypeOverride(table));
    Assert.Equal("Release table", AutomationProperties.GetName(table));
    Assert.Equal("ready, 2 rows, 3 columns, cell row 1 of 2, column 1 of 3", AutomationProperties.GetItemStatus(table));

    Assert.True(await table.PressAsync(Key.Right));
    Assert.Equal(new FsusDataTableCellAddress(0, 1), table.FocusedCell);

    Assert.True(await table.PressAsync(Key.Down));
    Assert.Equal(new FsusDataTableCellAddress(1, 1), table.FocusedCell);
    Assert.Equal("row 2 of 2, column 2 of 3", table.FocusedCellStatus);

    Assert.True(await table.PressAsync(Key.Space));
    Assert.True(table.IsRowSelected("b"));

    table.State = FsusDataTableState.Loading;
    table.RefreshView();
    Assert.Equal("Loading rows", table.DisplayText);
    Assert.Contains("fsus-loading", table.Classes);

    table.State = FsusDataTableState.Error;
    table.ErrorMessage = "Backend unavailable";
    table.RefreshView();
    Assert.Equal("Backend unavailable", table.DisplayText);
    Assert.Contains("fsus-error", table.Classes);

    table.Rows.Clear();
    table.State = FsusDataTableState.Ready;
    table.RefreshView();
    Assert.Equal("No rows", table.DisplayText);
    Assert.Contains("fsus-empty", table.Classes);
  }

  [Fact]
  public void DataTableVirtualizesRowsColumnsFixedEdgesAndLargeBudgets()
  {
    var table = new FsusDataTable
    {
      AccessibleName = "Large releases",
      VirtualizationThreshold = 1000,
      VisibleRowLimit = 40,
      VisibleColumnLimit = 8,
    };
    for (var column = 0; column < 24; column++)
    {
      table.Columns.Add(new FsusDataTableColumn($"c{column}", $"Column {column}")
      {
        Fixed = column == 0
          ? FsusDataTableFixedColumn.Left
          : column == 23
            ? FsusDataTableFixedColumn.Right
            : FsusDataTableFixedColumn.None,
      });
    }
    for (var row = 0; row < 100_000; row++)
    {
      table.Rows.Add(FsusDataTableRow.From($"row-{row}", new Dictionary<string, object?>
      {
        ["c0"] = row,
        ["c12"] = $"value-{row}",
      }));
    }

    table.RefreshView();

    Assert.True(table.IsRowVirtualized);
    Assert.True(table.IsColumnVirtualized);
    Assert.Equal(40, table.VisibleRows.Count);
    Assert.Equal(8, table.VisibleColumns.Count);
    Assert.Equal(0, table.VirtualizedRowStartIndex);
    Assert.Equal(0, table.VirtualizedColumnStartIndex);

    table.ScrollTo(99_950, 12);

    Assert.Equal(99_950, table.VirtualizedRowStartIndex);
    Assert.Equal(12, table.VirtualizedColumnStartIndex);
    Assert.Equal("row-99950", table.VisibleRows[0].Key);
    Assert.Equal("c12", table.VisibleColumns[0].Key);
    Assert.Equal(new[] { "c0", "c23" }, table.FixedColumns.Select(column => column.Key));
    Assert.True(table.EstimatedRetainedCellControls <= table.VirtualizationBudget.RetainedCellControls);

    var budget = table.EvaluateBudget(100_000, 24);

    Assert.True(budget.WithinBudget, budget.ToString());
    Assert.Equal(new[] { 1000, 10_000, 100_000 }, FsusDataTableBudgets.StandardRowFixtureSizes);
    Assert.Equal(new[] { 8, 24, 80 }, FsusDataTableBudgets.StandardColumnFixtureSizes);
  }

  [Fact]
  public void DataTableThemeVisualAccessibilityAndPerformanceBaselinesCoverStable33()
  {
    var dataTable = ReadControlTheme("DataTable.axaml");
    foreach (var selector in new[]
    {
      "fsus|FsusTable",
      "fsus|FsusDataTable",
    })
    {
      Assert.Contains(selector, dataTable);
    }

    Assert.Contains("FsusThemeDataTableSurfaceBrush", dataTable);
    Assert.Contains("FsusMotionDurationEffective", dataTable);
    Assert.Contains("fsus-virtualized", dataTable);

    var theme = ReadTheme("FsusTheme.axaml");
    Assert.Contains("Controls/DataTable.axaml", theme);

    var visualFixture = File.ReadAllText(Path.Combine(
      RepositoryRoot(),
      "tests",
      "conformance",
      "visual",
      "fixtures",
      "visual-comparisons.json"));
    Assert.Contains("data-table-stable33-web-avalonia", visualFixture);

    var accessibilityEvidence = File.ReadAllText(Path.Combine(
      RepositoryRoot(),
      "tests",
      "conformance",
      "accessibility",
      "automation-snapshots.json"));
    Assert.Contains("data-table-stable33", accessibilityEvidence);

    var performanceBudgets = File.ReadAllText(Path.Combine(
      RepositoryRoot(),
      "spec",
      "components",
      "avalonia-stable-performance-budgets.json"));
    Assert.Contains("\"id\": \"data-table\"", performanceBudgets);

    var measurements = File.ReadAllText(Path.Combine(
      RepositoryRoot(),
      "tests",
      "conformance",
      "performance",
      "avalonia-budget-fixtures.json"));
    Assert.Contains("data-table-virtualized-grid-stable33", measurements);
  }

  private sealed class KeyboardDataTable : FsusDataTable
  {
    public ValueTask<bool> PressAsync(Key key) => HandleKeyAsync(key);
  }

  private static KeyboardDataTable CreateSmallTable()
  {
    var table = new KeyboardDataTable
    {
      AccessibleName = "Release table",
    };
    table.Columns.Add(new FsusDataTableColumn("name", "Name"));
    table.Columns.Add(new FsusDataTableColumn("score", "Score") { Sortable = true });
    table.Columns.Add(new FsusDataTableColumn("owner", "Owner"));
    table.Rows.Add(FsusDataTableRow.From("a", new Dictionary<string, object?>
    {
      ["name"] = "Alpha",
      ["score"] = 3,
      ["owner"] = "Core",
    }));
    table.Rows.Add(FsusDataTableRow.From("b", new Dictionary<string, object?>
    {
      ["name"] = "Beta",
      ["score"] = 9,
      ["owner"] = "Docs",
    }));
    return table;
  }

  private static string ReadControlTheme(string fileName) =>
    File.ReadAllText(Path.Combine(
      RepositoryRoot(),
      "dotnet",
      "FsusUI.Avalonia.Themes",
      "Themes",
      "Controls",
      fileName));

  private static string ReadTheme(string fileName) =>
    File.ReadAllText(Path.Combine(
      RepositoryRoot(),
      "dotnet",
      "FsusUI.Avalonia.Themes",
      "Themes",
      fileName));

  private static string RepositoryRoot([CallerFilePath] string sourceFile = "")
  {
    var candidates = new[]
    {
      Path.GetDirectoryName(sourceFile) ?? string.Empty,
      Directory.GetCurrentDirectory(),
      AppContext.BaseDirectory,
      Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "..")),
    };

    foreach (var candidate in candidates)
    {
      var directory = new DirectoryInfo(candidate);
      while (directory is not null)
      {
        if (
          Directory.Exists(Path.Combine(directory.FullName, ".git")) ||
          File.Exists(Path.Combine(directory.FullName, "dotnet", "FsusUI.Avalonia.slnx")))
        {
          return directory.FullName;
        }

        directory = directory.Parent;
      }
    }

    throw new InvalidOperationException("Could not locate repository root.");
  }
}
