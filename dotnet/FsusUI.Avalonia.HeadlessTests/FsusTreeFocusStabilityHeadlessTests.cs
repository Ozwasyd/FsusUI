using Avalonia;
using Avalonia.Controls;
using Avalonia.Headless.XUnit;
using Avalonia.Threading;
using Avalonia.VisualTree;
using FsusUI.Avalonia.Controls;

namespace FsusUI.Avalonia.HeadlessTests;

public class FsusTreeFocusStabilityHeadlessTests
{
  [AvaloniaFact]
  public void ProgrammaticFocusPreservesScrollAndAnActiveRenameEditor()
  {
    var tree = new FsusTree { RowMinHeight = 30 };
    for (var index = 0; index < 60; index++) tree.Nodes.Add(new FsusTreeNode($"node-{index}", $"Node {index}"));
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
      var rows = panel.Children.ToArray();

      Assert.True(tree.FocusNode("node-20"));
      window.UpdateLayout();
      Assert.Equal(offset, scroll.Offset);
      Assert.Equal(rows, panel.Children.ToArray());

      Assert.True(tree.StartRename("node-20", "draft name"));
      Dispatcher.UIThread.RunJobs();
      var editor = tree.GetVisualDescendants().OfType<TextBox>().Single();
      editor.Text = "unsaved rename";
      Assert.True(tree.FocusNode("node-20"));
      Assert.Same(editor, tree.GetVisualDescendants().OfType<TextBox>().Single());
      Assert.Equal("unsaved rename", editor.Text);
      Assert.Equal("node-20", tree.ActiveInlineEdit?.Key);
      Assert.True(tree.FocusNode("node-21"));
      Assert.Same(editor, tree.GetVisualDescendants().OfType<TextBox>().Single());
      Assert.DoesNotContain("fsus-focused", Assert.IsType<Border>(panel.Children[20]).Classes);
      Assert.Contains("fsus-focused", Assert.IsType<Border>(panel.Children[21]).Classes);
    }
    finally { window.Close(); }
  }
}
