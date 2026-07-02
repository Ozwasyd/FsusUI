using Avalonia.Automation;
using Avalonia.Automation.Peers;
using Avalonia.Input;
using FsusUI.Avalonia.Controls;
using FsusUI.Avalonia.Overlay;
using System.Runtime.CompilerServices;

namespace FsusUI.Avalonia.Tests.Controls;

public class FsusTreePrimitiveTests
{
  [Fact]
  public async Task TreeExpandsSelectsChecksFiltersAndKeyboardNavigates()
  {
    var tree = new KeyboardTree
    {
      AccessibleName = "Release tree",
      SelectionMode = FsusTreeSelectionMode.Multiple,
      Checkable = true,
    };
    var root = new FsusTreeNode("root", "Root");
    root.Children.Add(new FsusTreeNode("child-a", "Child A"));
    root.Children.Add(new FsusTreeNode("child-b", "Child B"));
    tree.Nodes.Add(root);
    tree.Nodes.Add(new FsusTreeNode("wide", "Wide sibling"));

    tree.RefreshView();

    Assert.Equal(new[] { "root", "wide" }, tree.FlattenedNodes.Select(node => node.Node.Key));
    Assert.True(tree.Expand("root"));

    Assert.Equal(new[] { "root", "child-a", "child-b", "wide" }, tree.FlattenedNodes.Select(node => node.Node.Key));
    Assert.Equal(2, tree.FlattenedNodes[1].Level);
    Assert.Equal("expanded", tree.GetNodeState("root").ExpandedState);

    Assert.True(await tree.PressAsync(Key.Down));
    Assert.Equal("child-a", tree.FocusedKey);
    Assert.True(await tree.PressAsync(Key.Space));
    Assert.Contains("child-a", tree.SelectedKeys);

    Assert.True(tree.ToggleCheck("child-a"));
    Assert.Contains("child-a", tree.CheckedKeys);

    tree.Filter = node => node.Label.Contains("Child", StringComparison.Ordinal);
    tree.RefreshView();

    Assert.Equal(new[] { "child-a", "child-b" }, tree.FlattenedNodes.Select(node => node.Node.Key));
    Assert.Equal(AutomationControlType.Tree, AutomationProperties.GetControlTypeOverride(tree));
    Assert.Equal("Release tree", AutomationProperties.GetName(tree));
  }

  [Fact]
  public async Task TreeLazyLoadCancelsStaleRequestAndKeepsFocusSelection()
  {
    var first = new FsusTreeNode("async-a", "Async A") { HasLazyChildren = true };
    var second = new FsusTreeNode("async-b", "Async B") { HasLazyChildren = true };
    var tree = new FsusTree();
    tree.Nodes.Add(first);
    tree.Nodes.Add(second);
    tree.RefreshView();
    tree.ToggleSelection("async-a");
    tree.FocusNode("async-a");

    var firstCompletion = new TaskCompletionSource<IReadOnlyList<FsusTreeNode>>();
    var firstCanceled = false;
    var calls = 0;
    tree.ChildrenLoader = (node, cancellationToken) =>
    {
      calls++;
      if (calls == 1)
      {
        cancellationToken.Register(() =>
        {
          firstCanceled = true;
          firstCompletion.TrySetCanceled(cancellationToken);
        });
        return new ValueTask<IReadOnlyList<FsusTreeNode>>(firstCompletion.Task);
      }

      return ValueTask.FromResult<IReadOnlyList<FsusTreeNode>>([
        new FsusTreeNode($"{node.Key}-child", $"{node.Label} child"),
      ]);
    };

    var stale = tree.LoadChildrenAsync("async-a");
    var loaded = await tree.LoadChildrenAsync("async-b");
    var staleResult = await stale;

    Assert.False(staleResult);
    Assert.True(loaded);
    Assert.True(firstCanceled);
    Assert.True(tree.LastLoadCanceled);
    Assert.Equal("async-a", tree.FocusedKey);
    Assert.Contains("async-a", tree.SelectedKeys);
    Assert.Equal(new[] { "async-b-child" }, second.Children.Select(node => node.Key));
  }

  [Fact]
  public async Task TreeV2TreeSelectAndTreeTableVirtualizeOverlayAndBudgets()
  {
    var tree = new FsusTreeV2
    {
      AccessibleName = "Large tree",
      VirtualizationThreshold = 100,
      VisibleRowLimit = 36,
    };
    for (var index = 0; index < 10_000; index++)
    {
      tree.Nodes.Add(new FsusTreeNode($"node-{index}", $"Node {index}"));
    }

    tree.RefreshView();
    tree.ScrollToIndex(9_950);

    Assert.True(tree.IsVirtualized);
    Assert.Equal(36, tree.VisibleNodes.Count);
    Assert.True(tree.RealizedRowCount <= tree.VirtualizationBudget.RealizedRows);
    Assert.Equal("node-9950", tree.VisibleNodes[0].Node.Key);
    Assert.True(tree.EvaluateBudget().WithinBudget);

    var host = new FsusOverlayHost();
    var treeSelect = new FsusTreeSelect
    {
      AccessibleName = "Choose node",
      Tree = tree,
    };

    treeSelect.Open(host);
    Assert.True(treeSelect.IsOpen);
    Assert.Single(host.OpenOverlays);
    Assert.True(treeSelect.SelectNode("node-9950"));
    Assert.Equal("node-9950", treeSelect.SelectedKey);
    Assert.True(await treeSelect.CloseAsync());
    Assert.Empty(host.OpenOverlays);

    var treeTable = new FsusTreeTable
    {
      AccessibleName = "Tree table",
      Tree = tree,
      VisibleColumnLimit = 4,
    };
    treeTable.Columns.Add(new FsusDataTableColumn("name", "Name"));
    treeTable.Columns.Add(new FsusDataTableColumn("owner", "Owner"));
    treeTable.Columns.Add(new FsusDataTableColumn("status", "Status"));
    treeTable.Columns.Add(new FsusDataTableColumn("score", "Score"));
    treeTable.Columns.Add(new FsusDataTableColumn("updated", "Updated"));
    treeTable.RefreshView();

    Assert.True(treeTable.IsVirtualized);
    Assert.Equal(4, treeTable.VisibleColumns.Count);
    Assert.True(treeTable.RealizedCellCount <= treeTable.VirtualizationBudget.RealizedCells);
    Assert.Equal(AutomationControlType.DataGrid, AutomationProperties.GetControlTypeOverride(treeTable));
  }

  [Fact]
  public void TreeThemeVisualAccessibilityAndPerformanceBaselinesCoverStable35()
  {
    var tree = ReadControlTheme("Tree.axaml");
    foreach (var selector in new[]
    {
      "fsus|FsusTree",
      "fsus|FsusTreeV2",
      "fsus|FsusTreeSelect",
      "fsus|FsusTreeTable",
    })
    {
      Assert.Contains(selector, tree);
    }

    Assert.Contains("FsusThemeTreeSurfaceBrush", tree);
    Assert.Contains("FsusMotionDurationEffective", tree);
    Assert.Contains("fsus-virtualized", tree);

    var theme = ReadTheme("FsusTheme.axaml");
    Assert.Contains("Controls/Tree.axaml", theme);

    var visualFixture = File.ReadAllText(Path.Combine(
      RepositoryRoot(),
      "tests",
      "conformance",
      "visual",
      "fixtures",
      "visual-comparisons.json"));
    Assert.Contains("tree-stable35-web-avalonia", visualFixture);

    var accessibilityEvidence = File.ReadAllText(Path.Combine(
      RepositoryRoot(),
      "tests",
      "conformance",
      "accessibility",
      "automation-snapshots.json"));
    Assert.Contains("tree-stable35", accessibilityEvidence);

    var performanceBudgets = File.ReadAllText(Path.Combine(
      RepositoryRoot(),
      "spec",
      "components",
      "avalonia-stable-performance-budgets.json"));
    Assert.Contains("\"id\": \"tree\"", performanceBudgets);
    Assert.Contains("\"id\": \"tree-table\"", performanceBudgets);
  }

  private sealed class KeyboardTree : FsusTree
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
