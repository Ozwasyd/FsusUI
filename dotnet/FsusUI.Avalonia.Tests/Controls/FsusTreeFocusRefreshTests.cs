using Avalonia.Controls;
using FsusUI.Avalonia.Controls;

namespace FsusUI.Avalonia.Tests.Controls;

public class FsusTreeFocusRefreshTests
{
  [Fact]
  public void FocusingExpandedNodeDoesNotRebuildItsRows()
  {
    var calls = new List<FsusTreeRowContext>();
    var tree = new FsusTree
    {
      RowPresenter = context => { calls.Add(context); return new TextBlock { Text = context.Node.Label }; },
    };
    var parent = new FsusTreeNode("parent", "Parent");
    parent.Children.Add(new FsusTreeNode("child", "Child"));
    tree.Nodes.Add(parent);
    tree.RefreshView();
    Assert.True(tree.Expand("parent"));
    var panel = Assert.IsType<StackPanel>(tree.Content);
    var rows = panel.Children.ToArray();
    calls.Clear();

    Assert.True(tree.FocusNode("parent"));

    Assert.Empty(calls);
    Assert.Equal(rows, panel.Children.ToArray());
    Assert.Equal("parent", tree.FocusedKey);
    Assert.Contains("parent", tree.ExpandedKeys);
  }

  [Fact]
  public void FocusChangeRefreshesOnlyAffectedContentAndPreservesRowsAndSelection()
  {
    var calls = new List<FsusTreeRowContext>();
    var tree = new FsusTree
    {
      Checkable = true,
      RowPresenter = context => { calls.Add(context); return new TextBlock { Text = context.Node.Label }; },
    };
    foreach (var key in new[] { "first", "second", "third" }) tree.Nodes.Add(new FsusTreeNode(key, key));
    tree.RefreshView();
    tree.ToggleSelection("first");
    tree.ToggleCheck("first");
    var panel = Assert.IsType<StackPanel>(tree.Content);
    var rows = panel.Children.ToArray();
    var untouched = Assert.IsType<Border>(rows[2]).Child;
    calls.Clear();

    Assert.True(tree.FocusNode("second"));

    Assert.Equal(new[] { "first", "second" }, calls.Select(context => context.Key));
    Assert.False(calls[0].IsFocused);
    Assert.True(calls[0].IsSelected);
    Assert.True(calls[0].IsChecked);
    Assert.True(calls[1].IsFocused);
    Assert.Equal(rows, panel.Children.ToArray());
    Assert.Same(untouched, Assert.IsType<Border>(rows[2]).Child);
    Assert.False(tree.FocusNode("missing"));
    Assert.Equal("second", tree.FocusedKey);
  }
}
