using Avalonia;
using Avalonia.Automation;
using Avalonia.Controls;
using Avalonia.Controls.Primitives;
using Avalonia.Headless;
using Avalonia.Headless.XUnit;
using Avalonia.Input;
using Avalonia.Markup.Xaml.Styling;
using Avalonia.Threading;
using FsusUI.Avalonia.Controls;

namespace FsusUI.Avalonia.HeadlessTests;

public class FsusTreeScrollingHeadlessTests
{
  [AvaloniaFact]
  public void ScrollingExpandedRowsPreservesOffsetAndRoutesPointerToRetainedNode()
  {
    var tree = new FsusTree { RowMinHeight = 30, RowPadding = new Thickness(6, 0) };
    for (var index = 0; index < 100; index++)
    {
      var parent = new FsusTreeNode($"p-{index}", $"Parent {index}");
      parent.Children.Add(new FsusTreeNode($"child-{index}", $"Child {index}"));
      tree.Nodes.Add(parent);
    }
    tree.RefreshView();
    var scroll = new ScrollViewer
    {
      Content = tree,
      HorizontalScrollBarVisibility = ScrollBarVisibility.Disabled,
      VerticalScrollBarVisibility = ScrollBarVisibility.Auto,
    };
    var window = new Window { Width = 320, Height = 200, Content = scroll };
    window.Styles.Add(new StyleInclude(new Uri("avares://FsusUI.Avalonia.HeadlessTests"))
    {
      Source = new Uri("avares://FsusUI.Avalonia.Themes/Themes/FsusTheme.axaml"),
    });
    window.Show();
    try
    {
      Dispatcher.UIThread.RunJobs();
      var panel = Assert.IsType<StackPanel>(tree.Content);
      var row = Assert.IsType<Border>(panel.Children[30]);
      scroll.Offset = new Vector(0, 900);
      Dispatcher.UIThread.RunJobs();
      var offset = scroll.Offset;
      Assert.True(offset.Y > 0);

      Assert.True(tree.Expand("p-0"));
      tree.RefreshView();
      Assert.True(tree.FocusNode("p-30"));
      Dispatcher.UIThread.RunJobs();
      Assert.Equal(offset, scroll.Offset);
      Assert.Same(row, panel.Children[31]);
      Assert.Equal("fsus-tree-node-p-30", AutomationProperties.GetAutomationId(row));
      Assert.Equal(31, AutomationProperties.GetPositionInSet(row));

      window.MouseWheel(new Point(100, 100), new Vector(0, -1));
      Dispatcher.UIThread.RunJobs();
      Assert.True(scroll.Offset.Y > offset.Y);
      Assert.Same(row, panel.Children[31]);

      scroll.Offset = new Vector(0, row.TranslatePoint(default, tree)!.Value.Y);
      Dispatcher.UIThread.RunJobs();
      var origin = row.TranslatePoint(default, window)!.Value;
      var point = new Point(origin.X + 100, origin.Y + row.Bounds.Height / 2);
      Assert.InRange(point.Y, 0, scroll.Viewport.Height);
      var activations = new List<string>();
      tree.NodeActivated += (_, args) => activations.Add(args.Key);
      window.MouseDown(point, MouseButton.Left);
      window.MouseUp(point, MouseButton.Left);
      Dispatcher.UIThread.RunJobs();
      Assert.Equal(new[] { "p-30" }, activations);
      Assert.Contains("p-30", tree.SelectedKeys);
      Assert.Equal("p-30", tree.FocusedKey);
      Assert.Same(row, panel.Children[31]);

      offset = scroll.Offset;
      Assert.True(tree.Collapse("p-0"));
      Dispatcher.UIThread.RunJobs();
      Assert.Equal(offset, scroll.Offset);
      Assert.Same(row, panel.Children[30]);
    }
    finally
    {
      window.Close();
    }
  }
}
