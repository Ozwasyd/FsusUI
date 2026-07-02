using Avalonia;
using Avalonia.Automation;
using Avalonia.Automation.Peers;
using Avalonia.Input;
using FsusUI.Avalonia.Controls;
using System.Runtime.CompilerServices;

namespace FsusUI.Avalonia.Tests.Controls;

public class FsusVirtualizationPrimitiveTests
{
  [Fact]
  public void VirtualListRealizesFixedAndVariableWindowsWithMeasurementCacheAndRecycling()
  {
    var list = new FsusVirtualList
    {
      AccessibleName = "Activity stream",
      ItemCount = 100_000,
      FixedItemSize = 32,
      ViewportSize = 320,
      Overscan = 2,
      ItemKeyProvider = index => $"item-{index}",
    };

    list.RefreshWindow();

    Assert.True(list.IsVirtualized);
    Assert.Equal(12, list.RealizedItems.Count);
    Assert.Equal(0, list.RealizedItems[0].Index);
    Assert.Equal("item-0", list.RealizedItems[0].Key);
    Assert.True(list.RealizedContainerCount <= list.VirtualizationBudget.RealizedContainers);

    list.ScrollToIndex(500);

    Assert.Equal(498, list.RealizedItems[0].Index);
    Assert.Equal("item-498", list.RealizedItems[0].Key);
    Assert.True(list.RecycledContainerCount > 0);

    list.SizeMode = FsusVirtualSizeMode.Variable;
    list.SetMeasuredSize(498, 48);
    list.SetMeasuredSize(499, 40);
    list.ScrollToIndex(499);

    Assert.Equal(2, list.RetainedMeasurementCount);
    Assert.Equal(40, list.GetResolvedSize(499));
    Assert.True(list.RealizedItems.Any(item => item.Index == 499));
  }

  [Fact]
  public async Task VirtualListKeepsAnchorSupportsKeyboardStatesAndAsyncCancellation()
  {
    var list = new KeyboardVirtualList
    {
      AccessibleName = "Async stream",
      ItemCount = 1000,
      FixedItemSize = 24,
      ViewportSize = 120,
      Overscan = 1,
      ItemKeyProvider = index => $"row-{index}",
    };
    list.RefreshWindow();
    list.ScrollToIndex(50);

    var anchor = list.CaptureAnchor();
    list.AdjustForItemsInsertedBeforeAnchor(anchor, insertedCount: 3, insertedSize: 24);

    Assert.Equal("row-50", list.AnchorKey);
    Assert.Equal((50 + 3) * 24, list.ScrollOffset);

    Assert.True(await list.PressAsync(Key.Down));
    Assert.Equal(51, list.FocusedIndex);
    Assert.Equal("ready, 1000 items, focus 52 of 1000", AutomationProperties.GetItemStatus(list));

    list.State = FsusVirtualListState.Loading;
    list.RefreshWindow();
    Assert.Equal("Loading items", list.DisplayText);
    Assert.Contains("fsus-loading", list.Classes);

    list.State = FsusVirtualListState.Error;
    list.ErrorMessage = "Source failed";
    list.RefreshWindow();
    Assert.Equal("Source failed", list.DisplayText);
    Assert.Contains("fsus-error", list.Classes);

    list.ItemCount = 0;
    list.State = FsusVirtualListState.Ready;
    list.RefreshWindow();
    Assert.Equal("No items", list.DisplayText);
    Assert.Contains("fsus-empty", list.Classes);

    var firstCompletion = new TaskCompletionSource<IReadOnlyList<FsusVirtualListItem>>();
    var firstCanceled = false;
    var calls = 0;
    list.SourceProvider = (window, cancellationToken) =>
    {
      calls++;
      if (calls == 1)
      {
        cancellationToken.Register(() =>
        {
          firstCanceled = true;
          firstCompletion.TrySetCanceled(cancellationToken);
        });
        return new ValueTask<IReadOnlyList<FsusVirtualListItem>>(firstCompletion.Task);
      }

      return ValueTask.FromResult<IReadOnlyList<FsusVirtualListItem>>([
        new FsusVirtualListItem(window.StartIndex, $"row-{window.StartIndex}", $"Row {window.StartIndex}"),
      ]);
    };

    var first = list.LoadWindowAsync();
    var second = await list.LoadWindowAsync();
    var firstResult = await first;

    Assert.False(firstResult);
    Assert.True(second);
    Assert.True(firstCanceled);
    Assert.True(list.LastLoadCanceled);
    Assert.Equal("row-0", list.LoadedItems[0].Key);
  }

  [Fact]
  public void AutoResizerAndTableV2VirtualizeRowsColumnsResizeAndBudget()
  {
    var resizer = new FsusAutoResizer
    {
      AccessibleName = "Table viewport",
    };

    Assert.True(resizer.Resize(new Size(960, 480)));
    Assert.Equal(new Size(960, 480), resizer.Viewport);

    var table = new FsusTableV2
    {
      AccessibleName = "Large table",
      RowCount = 100_000,
      ColumnCount = 80,
      RowHeight = 32,
      ColumnWidth = 120,
      Overscan = 2,
    };
    table.AttachResizer(resizer);
    table.RefreshLayout();

    Assert.True(table.IsVirtualized);
    Assert.True(table.RealizedRowCount <= table.VirtualizationBudget.RealizedRows);
    Assert.True(table.RealizedColumnCount <= table.VirtualizationBudget.RealizedColumns);
    Assert.True(table.RealizedCellCount <= table.VirtualizationBudget.RealizedCells);

    table.ScrollToCell(99_950, 70);

    Assert.Equal(99_948, table.RealizedRowStartIndex);
    Assert.Equal(68, table.RealizedColumnStartIndex);
    Assert.Equal("row 99951 of 100000, column 71 of 80", table.FocusedCellStatus);
    Assert.True(table.RecycledCellCount > 0);
    Assert.Equal(AutomationControlType.DataGrid, AutomationProperties.GetControlTypeOverride(table));
  }

  [Fact]
  public void VirtualizationThemeVisualAccessibilityPerformanceAndPlatformBaselinesCoverStable34()
  {
    var virtualization = ReadControlTheme("Virtualization.axaml");
    foreach (var selector in new[]
    {
      "fsus|FsusVirtualList",
      "fsus|FsusAutoResizer",
      "fsus|FsusTableV2",
    })
    {
      Assert.Contains(selector, virtualization);
    }

    Assert.Contains("FsusThemeVirtualizationSurfaceBrush", virtualization);
    Assert.Contains("FsusMotionDurationEffective", virtualization);
    Assert.Contains("fsus-virtualized", virtualization);

    var theme = ReadTheme("FsusTheme.axaml");
    Assert.Contains("Controls/Virtualization.axaml", theme);

    var visualFixture = File.ReadAllText(Path.Combine(
      RepositoryRoot(),
      "tests",
      "conformance",
      "visual",
      "fixtures",
      "visual-comparisons.json"));
    Assert.Contains("virtualization-stable34-web-avalonia", visualFixture);

    var accessibilityEvidence = File.ReadAllText(Path.Combine(
      RepositoryRoot(),
      "tests",
      "conformance",
      "accessibility",
      "automation-snapshots.json"));
    Assert.Contains("virtualization-stable34", accessibilityEvidence);

    var performanceBudgets = File.ReadAllText(Path.Combine(
      RepositoryRoot(),
      "spec",
      "components",
      "avalonia-stable-performance-budgets.json"));
    Assert.Contains("\"id\": \"virtual-list\"", performanceBudgets);
    Assert.Contains("\"id\": \"table-v2\"", performanceBudgets);

    var overrides = File.ReadAllText(Path.Combine(
      RepositoryRoot(),
      "spec",
      "platform-overrides",
      "avalonia-virtualization.yaml"));
    Assert.Contains("scroll-anchoring-avalonia-presenter", overrides);
  }

  private sealed class KeyboardVirtualList : FsusVirtualList
  {
    public ValueTask<bool> PressAsync(Key key) => HandleKeyAsync(key);
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
