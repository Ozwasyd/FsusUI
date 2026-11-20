using Avalonia.Controls;
using FsusUI.Avalonia.Controls;

namespace FsusUI.Avalonia.Tests.Controls;

public class FsusTreeExpansionReuseTests
{
  [Theory]
  [InlineData(false)]
  [InlineData(true)]
  public void DuplicateVisibleKeysFallBackToDistinctRowsBeforeOrAfterExpansion(bool duplicatesInitiallyVisible)
  {
    var tree = new FsusTree();
    var parent = new FsusTreeNode("parent", "Parent");
    parent.Children.Add(new FsusTreeNode("duplicate", "Child"));
    tree.Nodes.Add(parent);
    tree.Nodes.Add(new FsusTreeNode("duplicate", "Sibling"));
    if (duplicatesInitiallyVisible) tree.Nodes.Add(new FsusTreeNode("duplicate", "Other sibling"));
    tree.RefreshView();
    var panel = Assert.IsType<StackPanel>(tree.Content);
    var original = panel.Children[0];

    Assert.True(tree.Expand("parent"));

    Assert.NotSame(original, panel.Children[0]);
    Assert.Equal(duplicatesInitiallyVisible ? 4 : 3, panel.Children.Count);
    Assert.Equal(panel.Children.Count, panel.Children.Distinct().Count());
    Assert.Contains("Child", Assert.IsAssignableFrom<TextBlock>(Assert.IsType<Border>(panel.Children[1]).Child).Text);
    Assert.Contains("Sibling", Assert.IsAssignableFrom<TextBlock>(Assert.IsType<Border>(panel.Children[2]).Child).Text);
    Assert.True(tree.Collapse("parent"));
    Assert.Equal(duplicatesInitiallyVisible ? 3 : 2, panel.Children.Count);
    Assert.Equal(panel.Children.Count, panel.Children.Distinct().Count());
  }

  [Fact]
  public void ExpansionAndCollapseRetainUnchangedRowsAndRefreshOnlyChangedContexts()
  {
    var calls = new List<FsusTreeRowContext>();
    var tree = new FsusTree { RowPresenter = context =>
    {
      calls.Add(context);
      return new TextBlock { Text = context.Node.Label };
    } };
    var parent = new FsusTreeNode("parent", "Parent");
    parent.Children.Add(new FsusTreeNode("child", "Child"));
    tree.Nodes.Add(parent);
    tree.Nodes.Add(new FsusTreeNode("sibling", "Sibling"));
    tree.RefreshView();
    var panel = Assert.IsType<StackPanel>(tree.Content);
    var first = Assert.IsType<Border>(panel.Children[0]);
    var sibling = Assert.IsType<Border>(panel.Children[1]);
    var siblingContent = sibling.Child;
    calls.Clear();

    Assert.True(tree.Expand("parent"));
    Assert.Same(first, panel.Children[0]);
    Assert.Same(sibling, panel.Children[2]);
    Assert.Same(siblingContent, sibling.Child);
    Assert.Equal(new[] { "parent", "child" }, calls.Select(context => context.Key));
    Assert.True(calls[0].IsExpanded);
    calls.Clear();
    Assert.True(tree.Collapse("parent"));
    Assert.Equal(new Control[] { first, sibling }, panel.Children);
    Assert.Equal("parent", Assert.Single(calls).Key);
    Assert.False(calls[0].IsExpanded);
    Assert.Same(siblingContent, sibling.Child);
    Assert.False(tree.Collapse("parent"));

    calls.Clear();
    tree.RefreshView();
    Assert.Equal(new[] { "parent", "sibling" }, calls.Select(context => context.Key));
    Assert.NotSame(first, panel.Children[0]);
  }

  [Fact]
  public void ExpandingAnotherBranchRefreshesPreviousFocusAndKeepsSelectionAndMetadataInvalidation()
  {
    var tree = new FsusTree { Checkable = true };
    foreach (var key in new[] { "first", "second" })
    {
      var node = new FsusTreeNode(key, key);
      node.Children.Add(new FsusTreeNode(key + "-child", key));
      tree.Nodes.Add(node);
    }
    tree.RefreshView();
    tree.ToggleSelection("first");
    tree.ToggleCheck("first");
    tree.Expand("first");
    var panel = Assert.IsType<StackPanel>(tree.Content);
    var first = Assert.IsType<Border>(panel.Children[0]);
    tree.Expand("second");
    Assert.Same(first, panel.Children[0]);
    Assert.DoesNotContain("fsus-focused", first.Classes);
    Assert.Contains("fsus-selected", first.Classes);
    Assert.Contains("first", tree.CheckedKeys);
    Assert.Equal("second", tree.FocusedKey);
    tree.Nodes[0].Label = "Changed";
    Assert.Contains("Changed", Assert.IsAssignableFrom<TextBlock>(first.Child).Text);
  }
}
