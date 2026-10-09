using Avalonia;
using Avalonia.Controls;
using Avalonia.Headless.XUnit;
using Avalonia.Markup.Xaml.Styling;
using Avalonia.Media;
using Avalonia.Threading;
using FsusUI.Avalonia.Controls;
using Xunit;

namespace FsusUI.Avalonia.HeadlessTests;

public class FsusTreeLayoutHeadlessTests(ITestOutputHelper output)
{
  [AvaloniaFact]
  public void DefaultRowsKeepMeasurementsAcrossExpansionAndFocusAndInvalidateOnRemount()
  {
    var tree = new FsusTree();
    for (var index = 0; index < 1000; index++)
    {
      var parent = new FsusTreeNode($"p-{index}", $"Parent {index}");
      for (var child = 0; child < 10; child++)
        parent.Children.Add(new FsusTreeNode($"p-{index}-{child}", $"Child {child}"));
      tree.Nodes.Add(parent);
    }
    tree.RefreshView();
    var host = new Grid { Width = 1120, Height = 700, Children = { tree } };
    var window = new Window { Width = 1180, Height = 760, Content = host };
    window.Styles.Add(new StyleInclude(new Uri("avares://FsusUI.Avalonia.HeadlessTests"))
    {
      Source = new Uri("avares://FsusUI.Avalonia.Themes/Themes/FsusTheme.axaml"),
    });
    window.Show();
    try
    {
      Dispatcher.UIThread.RunJobs();
      var panel = Assert.IsType<StackPanel>(tree.Content);
      var labels = panel.Children.Cast<Border>().Select(row => Assert.IsType<TextBlock>(row.Child)).ToArray();
      Assert.Equal(1000, labels.Length);
      Assert.All(labels, label => Assert.True(label.IsMeasureValid));
      Assert.True(tree.Expand("p-0"));
      Assert.True(tree.FocusNode("p-1"));
      output.WriteLine($"After expansion/focus: invalid labels {labels.Count(label => !label.IsMeasureValid)}");
      Assert.False(labels[0].IsMeasureValid);
      Assert.All(labels.Skip(1), label => Assert.True(label.IsMeasureValid));
      host.Measure(new Size(1120, 700));
      host.Arrange(new Rect(0, 0, 1120, 700));
      Dispatcher.UIThread.RunJobs();
      Assert.All(labels, label => Assert.True(label.IsMeasureValid));

      var originalFamily = labels[1].FontFamily;
      var originalSize = labels[1].FontSize;
      var originalForeground = labels[1].Foreground;
      var changes = new List<string>();
      labels[1].PropertyChanged += (_, args) =>
      {
        if (args.Property == TextBlock.FontFamilyProperty ||
            args.Property == TextBlock.FontSizeProperty ||
            args.Property == TextBlock.ForegroundProperty)
          changes.Add(args.Property.Name);
      };
      host.Children.Remove(tree);
      host.Children.Add(tree);
      output.WriteLine(string.Join("\n", changes));
      output.WriteLine($"After remount: invalid labels {labels.Count(label => !label.IsMeasureValid)}");
      Assert.Equal(originalFamily, labels[1].FontFamily);
      Assert.Equal(originalSize, labels[1].FontSize);
      Assert.Same(originalForeground, labels[1].Foreground);
      Assert.True(tree.Expand("p-1"));
      Assert.True(tree.FocusNode("p-2"));
      host.Measure(new Size(1120, 700));
      host.Arrange(new Rect(0, 0, 1120, 700));
      Assert.All(labels, label => Assert.True(label.IsMeasureValid));
    }
    finally
    {
      window.Close();
    }
  }

  [AvaloniaFact]
  public void DefaultRowsApplyNewHostTypographyAndLivePresentationAfterRemount()
  {
    var tree = new FsusTree();
    var node = new FsusTreeNode("file", "File");
    tree.Nodes.Add(node);
    tree.RefreshView();
    var first = new Window { Width = 320, Height = 200, FontSize = 14, Content = tree };
    var second = new Window
    {
      Width = 320,
      Height = 200,
      FontSize = 23,
      FontFamily = new FontFamily("Noto Sans CJK SC"),
    };
    first.Show();
    try
    {
      Dispatcher.UIThread.RunJobs();
      var panel = Assert.IsType<StackPanel>(tree.Content);
      var row = Assert.IsType<Border>(Assert.Single(panel.Children));
      var label = Assert.IsType<TextBlock>(row.Child);
      Assert.Equal(14, label.FontSize);
      first.Content = null;
      second.Content = tree;
      second.Show();
      Dispatcher.UIThread.RunJobs();
      Assert.Same(row, Assert.Single(panel.Children));
      Assert.Same(label, row.Child);
      Assert.Equal(23, label.FontSize);
      Assert.Equal(second.FontFamily, label.FontFamily);
      Assert.True(label.IsMeasureValid);

      tree.FontSize = 26;
      tree.Foreground = Brushes.Red;
      Dispatcher.UIThread.RunJobs();
      Assert.Equal(26, label.FontSize);
      Assert.Same(Brushes.Red, label.Foreground);
      Assert.True(label.IsMeasureValid);
      node.Label = "Renamed 中文";
      Dispatcher.UIThread.RunJobs();
      Assert.Equal("  Renamed 中文", Assert.IsType<TextBlock>(row.Child).Text);
      Assert.Equal("Renamed 中文", global::Avalonia.Automation.AutomationProperties.GetName(row));
    }
    finally
    {
      first.Close();
      second.Close();
    }
  }
}
