using Avalonia;
using Avalonia.Controls;
using Avalonia.Headless.XUnit;
using FsusUI.Avalonia.Controls;

namespace FsusUI.Avalonia.HeadlessTests;

public class FsusTreeExpansionReuseHeadlessTests
{
  [AvaloniaFact]
  public void ExpandingBelowViewportPreservesScrollAndExistingVisualAttachments()
  {
    var tree = new FsusTree { RowMinHeight = 30 };
    for (var index = 0; index < 60; index++)
    {
      var node = new FsusTreeNode($"node-{index}", $"Node {index}");
      node.Children.Add(new FsusTreeNode($"child-{index}", "Child"));
      tree.Nodes.Add(node);
    }
    tree.RefreshView();
    var scroll = new ScrollViewer { Content = tree };
    var window = new Window { Width = 400, Height = 240, Content = scroll };
    window.Show();
    try
    {
      window.UpdateLayout();
      scroll.Offset = new Vector(0, 300);
      window.UpdateLayout();
      var offset = scroll.Offset;
      Assert.True(offset.Y > 0);
      var panel = Assert.IsType<StackPanel>(tree.Content);
      var retainedRow = Assert.IsType<Border>(panel.Children[10]);
      var retainedContent = retainedRow.Child;
      var detached = 0;
      retainedRow.DetachedFromVisualTree += (_, _) => detached++;

      Assert.True(tree.Expand("node-40"));
      window.UpdateLayout();
      Assert.Equal(offset, scroll.Offset);
      Assert.Same(retainedRow, panel.Children[10]);
      Assert.Same(retainedContent, retainedRow.Child);
      Assert.Equal(0, detached);
      Assert.True(tree.Collapse("node-40"));
      window.UpdateLayout();
      Assert.Equal(offset, scroll.Offset);
      Assert.Same(retainedRow, panel.Children[10]);
      Assert.Equal(0, detached);
    }
    finally { window.Close(); }
  }
}
