using Avalonia;
using Avalonia.Automation;
using Avalonia.Controls;
using Avalonia.Layout;
using FsusUI.Avalonia.Controls;

namespace FsusUI.Avalonia.Tests.Controls;

public class FsusTreeRowRetentionTests
{
  [Fact]
  public void LargeTreeExpansionAndFocusKeepUnaffectedRowsAttached()
  {
    var tree = new FsusTree();
    for (var index = 0; index < 1000; index++)
    {
      var parent = new FsusTreeNode($"p-{index}", $"Parent {index}");
      for (var child = 0; child < 10; child++)
      {
        parent.Children.Add(new FsusTreeNode($"p-{index}-{child}", $"Child {child}"));
      }
      tree.Nodes.Add(parent);
    }
    tree.RefreshView();
    var panel = Assert.IsType<StackPanel>(tree.Content);
    var originalRows = panel.Children.Cast<Border>().ToArray();
    var originalLabels = originalRows.Select(row => row.Child).ToArray();
    var detachments = 0;
    foreach (var row in originalRows)
    {
      row.DetachedFromLogicalTree += (_, _) => detachments++;
    }

    Assert.True(tree.Expand("p-500"));
    Assert.True(tree.FocusNode("p-501"));
    Assert.Equal(1010, panel.Children.Count);
    for (var index = 0; index < originalRows.Length; index++)
    {
      var offset = index > 500 ? 10 : 0;
      Assert.Same(originalRows[index], panel.Children[index + offset]);
      Assert.Same(originalLabels[index], originalRows[index].Child);
    }
    Assert.StartsWith("▾", Assert.IsType<TextBlock>(originalRows[500].Child).Text);
    Assert.Contains("fsus-focused", originalRows[501].Classes);
    var children = panel.Children.Skip(501).Take(10).ToArray();

    Assert.True(tree.Collapse("p-500"));
    Assert.Equal(originalRows, panel.Children.Cast<Border>());
    Assert.All(children, child => Assert.Null(child.Parent));
    Assert.StartsWith("▸", Assert.IsType<TextBlock>(originalRows[500].Child).Text);
    Assert.Equal(0, detachments);
  }

  [Fact]
  public void ReorderingReplacingAndRemovingNodesUpdatesRowsAndSetMetadata()
  {
    var tree = new FsusTree();
    var first = new FsusTreeNode("first", "First");
    var second = new FsusTreeNode("second", "Second");
    tree.Nodes.Add(first);
    tree.Nodes.Add(second);
    tree.RefreshView();
    var panel = Assert.IsType<StackPanel>(tree.Content);
    var firstRow = Assert.IsType<Border>(panel.Children[0]);
    var secondRow = Assert.IsType<Border>(panel.Children[1]);

    tree.Nodes.Clear();
    tree.Nodes.Add(second);
    tree.Nodes.Add(first);
    tree.RefreshView();
    Assert.Same(secondRow, panel.Children[0]);
    Assert.Same(firstRow, panel.Children[1]);
    Assert.Equal(1, AutomationProperties.GetPositionInSet(secondRow));
    Assert.Equal(2, AutomationProperties.GetPositionInSet(firstRow));

    tree.Nodes[1] = new FsusTreeNode("first", "Replacement") { IsDisabled = true };
    tree.RefreshView();
    var replacement = Assert.IsType<Border>(panel.Children[1]);
    Assert.NotSame(firstRow, replacement);
    Assert.Null(firstRow.Parent);
    Assert.Equal("Replacement", AutomationProperties.GetName(replacement));
    Assert.False(replacement.IsEnabled);
    first.Label = "Obsolete";
    Assert.Equal("Replacement", AutomationProperties.GetName(replacement));

    tree.Nodes.RemoveAt(1);
    tree.RefreshView();
    Assert.Same(secondRow, Assert.Single(panel.Children));
    Assert.Equal(1, AutomationProperties.GetSizeOfSet(secondRow));
    Assert.False(tree.RefreshNodePresentation("first"));
    Assert.Null(replacement.Parent);
  }

  [Fact]
  public void CustomPresenterStillRefreshesMutablePayloadAndRestoresDefaultContent()
  {
    var node = new FsusTreeNode("file", "File");
    var text = "First payload";
    var contexts = new List<FsusTreeRowContext>();
    var tree = new FsusTree
    {
      RowPresenter = context =>
      {
        contexts.Add(context);
        return new TextBlock { Text = text, VerticalAlignment = VerticalAlignment.Top };
      },
    };
    tree.Nodes.Add(node);
    tree.RefreshView();
    var panel = Assert.IsType<StackPanel>(tree.Content);
    var row = Assert.IsType<Border>(Assert.Single(panel.Children));
    var content = row.Child;
    text = "Changed payload";
    tree.RefreshView();
    Assert.Same(row, Assert.Single(panel.Children));
    Assert.NotSame(content, row.Child);
    Assert.Equal("Changed payload", Assert.IsType<TextBlock>(row.Child).Text);
    tree.ToggleSelection(node.Key);
    Assert.True(contexts[^1].IsSelected);

    tree.RowPresenter = null;
    var defaultLabel = Assert.IsType<TextBlock>(row.Child);
    Assert.Equal("  File", defaultLabel.Text);
    Assert.Equal(VerticalAlignment.Center, defaultLabel.VerticalAlignment);
    tree.FocusNode(node.Key);
    Assert.Same(defaultLabel, row.Child);
  }

  [Fact]
  public void RetainedRowsUpdateGeometryPresentationSelectionAndAutomation()
  {
    var tree = new FsusTree();
    var node = new FsusTreeNode("file", "File");
    tree.Nodes.Add(node);
    tree.RefreshView();
    var panel = Assert.IsType<StackPanel>(tree.Content);
    var row = Assert.IsType<Border>(Assert.Single(panel.Children));
    tree.RowMinHeight = 30;
    tree.RowPadding = new Thickness(6, 0);
    tree.ToggleSelection(node.Key);
    Assert.Same(row, Assert.Single(panel.Children));
    Assert.Equal(30, row.MinHeight);
    Assert.Equal(new Thickness(6, 0), row.Padding);
    Assert.Contains("fsus-selected", row.Classes);
    Assert.Contains("selected", AutomationProperties.GetItemStatus(row));

    node.Label = "Renamed";
    Assert.Equal("  Renamed", Assert.IsType<TextBlock>(row.Child).Text);
    Assert.Equal("Renamed", AutomationProperties.GetName(row));
    node.IsDisabled = true;
    Assert.False(row.IsEnabled);
    Assert.Contains("fsus-disabled", row.Classes);
    node.HasLazyChildren = true;
    tree.RefreshView();
    Assert.Same(row, Assert.Single(panel.Children));
    Assert.StartsWith("▸", Assert.IsType<TextBlock>(row.Child).Text);
    Assert.Contains("collapsed", AutomationProperties.GetItemStatus(row));
  }

  [Fact]
  public void RetainedRowLeavesRenameModeAndRemovesTransientCreateRows()
  {
    var tree = new FsusTree();
    var node = new FsusTreeNode("file", "File");
    tree.Nodes.Add(node);
    tree.RefreshView();
    var panel = Assert.IsType<StackPanel>(tree.Content);
    var row = Assert.IsType<Border>(Assert.Single(panel.Children));

    Assert.True(tree.StartRename(node.Key, node.Label));
    var editor = Assert.IsType<TextBox>(row.Child);
    editor.Text = "Draft";
    node.InvalidatePresentation();
    Assert.Same(editor, row.Child);
    Assert.True(tree.CancelInlineEdit());
    Assert.Same(row, Assert.Single(panel.Children));
    Assert.Equal("  File", Assert.IsType<TextBlock>(row.Child).Text);

    Assert.True(tree.StartCreate("draft"));
    var transient = panel.Children[1];
    Assert.True(tree.CancelInlineEdit());
    Assert.Same(row, Assert.Single(panel.Children));
    Assert.Null(transient.Parent);
    Assert.False(tree.RefreshNodePresentation("draft"));
  }
}
