using Avalonia;
using Avalonia.Automation;
using Avalonia.Automation.Peers;
using Avalonia.Headless.XUnit;
using Avalonia.Input;
using FsusUI.Avalonia.Controls;
using System.Runtime.CompilerServices;

namespace FsusUI.Avalonia.HeadlessTests;

public class FsusVirtualizationHeadlessTests
{
  [AvaloniaFact]
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
    Assert.Equal(list.RealizedContainerCount, list.RealizedVisualCount);
    Assert.Equal(12, list.VisualHost.Children.Count);
    Assert.All(list.RealizedContainers, container =>
    {
      Assert.True(container.ContainerId > 0);
      Assert.True(container.Index >= 0);
      Assert.NotNull(container.Content);
      var peer = ControlAutomationPeer.CreatePeerForElement(container);
      Assert.NotNull(peer);
      Assert.Equal(AutomationControlType.ListItem, peer.GetAutomationControlType());
    });
    var initialContainerIds = list.RealizedContainers.Select(container => container.ContainerId).Order().ToArray();

    list.ScrollToIndex(500);

    Assert.Equal(498, list.RealizedItems[0].Index);
    Assert.Equal("item-498", list.RealizedItems[0].Key);
    Assert.True(list.RecycledContainerCount > 0);
    Assert.Equal(initialContainerIds, list.RealizedContainers.Select(container => container.ContainerId).Order().ToArray());

    list.SizeMode = FsusVirtualSizeMode.Variable;
    list.SetMeasuredSize(498, 48);
    list.SetMeasuredSize(499, 40);
    list.ScrollToIndex(499);

    Assert.Equal(2, list.RetainedMeasurementCount);
    Assert.Equal(40, list.GetResolvedSize(499));
    Assert.Contains(list.RealizedItems, item => item.Index == 499);
  }

  [AvaloniaFact]
  public void VariableListUsesLogarithmicIndexMaintainsAnchorAndBoundsCachesAndPool()
  {
    var list = new FsusVirtualList
    {
      ItemCount = 100_000,
      FixedItemSize = 32,
      ViewportSize = 320,
      Overscan = 2,
      SizeMode = FsusVirtualSizeMode.Variable,
      ContainerPoolLimit = 2,
      VirtualizationBudget = new FsusVirtualListBudget(64, 4, 8, 512),
    };
    list.RefreshWindow();
    list.ScrollToIndex(50_000);
    var offsetBeforeMeasurement = list.ScrollOffset;

    list.SetMeasuredSize(10, 64);

    Assert.Equal(offsetBeforeMeasurement + 32, list.ScrollOffset);
    Assert.InRange(list.LastIndexLookupSteps, 1, 18);
    Assert.InRange(list.LastOffsetLookupSteps, 1, 18);
    for (var index = 0; index < 12; index++)
    {
      list.SetMeasuredSize(index, 40 + index);
    }
    Assert.Equal(4, list.RetainedMeasurementCount);

    list.ItemCount = 1;
    list.ScrollToIndex(0);
    Assert.InRange(list.ContainerPoolCount, 0, 2);
    Assert.True(list.DiscardedContainerCount > 0);
  }

  [AvaloniaFact]
  public async Task VirtualListBoundsLoadedWindowAndDoesNotRepeatAutomationWrites()
  {
    var list = new FsusVirtualList
    {
      AccessibleName = "Bounded async stream",
      ItemCount = 10_000,
      LoadedWindowLimit = 8,
      SourceProvider = (window, _) => ValueTask.FromResult<IReadOnlyList<FsusVirtualListItem>>(
        Enumerable.Range(window.StartIndex, 64)
          .Select(index => new FsusVirtualListItem(index, $"item-{index}", $"Item {index}"))
          .ToArray()),
    };
    list.RefreshWindow();
    var automationUpdates = list.AutomationUpdateCount;
    list.RefreshWindow();

    Assert.Equal(automationUpdates, list.AutomationUpdateCount);
    Assert.True(await list.LoadWindowAsync());
    Assert.Equal(8, list.LoadedItems.Count);
    Assert.Equal(list.RealizedContainerCount, list.VisualHost.Children.Count);
  }

  [AvaloniaFact]
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

  [AvaloniaFact]
  public void AutoResizerObservesArrangedViewportAndHonorsDisabledAxes()
  {
    var observations = new List<Size>();
    var resizer = new FsusAutoResizer
    {
      OnResize = observations.Add,
    };

    resizer.Measure(new Size(320, 180));
    resizer.Arrange(new Rect(0, 0, 320, 180));

    Assert.Equal(new Size(320, 180), resizer.Viewport);
    Assert.Equal(new Size(320, 180), Assert.Single(observations));

    resizer.DisableWidth = true;
    Assert.True(resizer.Resize(new Size(640, 240)));
    Assert.Equal(new Size(320, 240), resizer.Viewport);
    Assert.Equal(new Size(320, 240), observations[^1]);

    resizer.DisableHeight = true;
    Assert.False(resizer.Resize(new Size(800, 500)));
    Assert.Equal(2, observations.Count);
  }

  [AvaloniaFact]
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
    Assert.Equal(table.RealizedCellCount, table.RealizedVisualCount);
    Assert.True(table.RealizedCellCount < table.RowCount * table.ColumnCount);
    Assert.All(table.RealizedCells, cell =>
    {
      Assert.True(cell.RowIndex >= 0);
      Assert.True(cell.ColumnIndex >= 0);
      Assert.NotNull(cell.Content);
      var peer = ControlAutomationPeer.CreatePeerForElement(cell);
      Assert.NotNull(peer);
      Assert.Equal(AutomationControlType.DataItem, peer.GetAutomationControlType());
    });
    var initialCellIds = table.RealizedCells.Select(cell => cell.ContainerId).Order().ToArray();

    table.ScrollToCell(99_950, 70);

    Assert.Equal(99_948, table.RealizedRowStartIndex);
    Assert.Equal(68, table.RealizedColumnStartIndex);
    Assert.Equal("row 99951 of 100000, column 71 of 80", table.FocusedCellStatus);
    Assert.True(table.RecycledCellCount > 0);
    Assert.Equal(initialCellIds, table.RealizedCells.Select(cell => cell.ContainerId).Order().ToArray());
    Assert.Equal(AutomationControlType.DataGrid, AutomationProperties.GetControlTypeOverride(table));
  }

  [AvaloniaFact]
  public async Task TableV2VirtualizesFrozenAxesNavigatesAndRejectsStaleBackgroundResults()
  {
    var table = new KeyboardTableV2
    {
      RowCount = 100_000,
      ColumnCount = 80,
      RowHeight = 32,
      ColumnWidth = 120,
      Overscan = 2,
      FrozenRowCount = 1,
      FrozenColumnCount = 1,
      LoadedRowIndexLimit = 4,
    };
    table.AttachResizer(new FsusAutoResizer { Viewport = new Size(960, 480) });
    table.RefreshLayout();
    table.ScrollToCell(50_000, 40);

    Assert.Contains(table.RealizedCells, cell => cell.RowIndex == 0);
    Assert.Contains(table.RealizedCells, cell => cell.ColumnIndex == 0);
    Assert.Contains(table.RealizedCells, cell => cell.RowIndex == 50_000 && cell.ColumnIndex == 40);
    Assert.True(await table.PressAsync(Key.Right));
    Assert.Equal(41, table.FocusedColumnIndex);

    var firstCompletion = new TaskCompletionSource<IReadOnlyList<int>>();
    var firstCanceled = false;
    var first = table.UpdateRowIndexAsync(token =>
    {
      token.Register(() =>
      {
        firstCanceled = true;
        firstCompletion.TrySetCanceled(token);
      });
      return new ValueTask<IReadOnlyList<int>>(firstCompletion.Task);
    });
    var second = await table.UpdateRowIndexAsync(_ =>
      ValueTask.FromResult<IReadOnlyList<int>>([9, 8, 7, 6, 5, 4]));

    Assert.False(await first);
    Assert.True(second);
    Assert.True(firstCanceled);
    Assert.True(table.LastBackgroundCanceled);
    Assert.Equal([9, 8, 7, 6], table.LoadedRowIndex);
    var automationUpdates = table.AutomationUpdateCount;
    table.RefreshLayout();
    Assert.Equal(automationUpdates, table.AutomationUpdateCount);
  }

  [AvaloniaFact]
  public void VirtualizationThemeVisualAccessibilityPerformanceAndPlatformBaselinesCoverStable34()
  {
    var virtualization = ReadControlTheme("Virtualization.axaml");
    foreach (var selector in new[]
    {
      "fsus|FsusVirtualList",
      "fsus|FsusAutoResizer",
      "fsus|FsusTableV2",
      "fsus|FsusVirtualListItemContainer",
      "fsus|FsusTableV2CellContainer",
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

  private sealed class KeyboardTableV2 : FsusTableV2
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
